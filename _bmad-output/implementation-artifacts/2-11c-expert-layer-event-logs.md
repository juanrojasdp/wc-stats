---
baseline_commit: 4682639
---

# Story 2.11c: Expert Layer — Full Event Logs

Status: done

<!-- Re-baselined from 163fa20 to 4682639 (post change-set CS-1) at create-story, 2026-08-04.
     The two rulings that shape this story were made by Juan at create-story and are stated in
     Dev Notes BEFORE the tasks that depend on them. -->

## Story

As Diego,
I want the full event logs reachable from the Expert Layer,
So that every marker and every connection the report carries is readable as text (FR-23, UX-DR16/18).

> **Depends on 2.11a** (the shared sortable `DataTable` and `TableColumn<Row>`) **and 2.11b** (the
> Expert Layer shell it mounts into). Both are `done`.
>
> **DO NOT START DEV UNTIL 2.11b's REVIEW PATCHES ARE COMMITTED.** At the moment this context was
> written, `git status` showed `ExpertLayer.tsx`, `expert-model.ts`, `DataTable.tsx`, `en.ts` and
> `es.ts` **modified and uncommitted** by the 2.11b review session, while `sprint-status.yaml`
> already reads `2-11b-…: done`. Every quotation below is taken from the WORKING-TREE state, which
> is the post-review shape. Re-read the four files you are extending before editing them, and
> **never `git add -A`** — commit your own slice by path.

## Acceptance Criteria (from `epics.md:848`)

**And** full event logs render: shot log, cross log, pass matrix, receiving log, defensive-actions log — the same tables that serve as the viz data-table alternatives (UX-DR18).

Discharged as three testable criteria:

1. **AC 1 — the five logs are enumerated and reachable from the Expert Layer.** The layer carries a
   named "full event logs" block. Four of AC 1's five logs are the *already-rendered* viz data-table
   alternatives and are reached by an in-page anchor that names where the table is and what opens it;
   ruling 6 adds two more anchors for 2.9's aggregate surfaces, so **the link list holds six
   entries**. AC 1's fifth log — the receiving log — has no existing home and **renders in the Expert
   Layer**, behind `anyReceivingEvents()`.

   > **THE COUNTS, once, so no later step has to guess.** AC 1 enumerates **five** logs. The link
   > list has **six** `<li>` (four AC-1 logs + two aggregate surfaces per ruling 6). The receiving log
   > is **not** an `<li>` — it is a heading plus a table below the list. Total items on screen: **six
   > links, plus the receiving block when `anyReceivingEvents()` is true.**
2. **AC 2 — the receiving log is a real, sorted `<table>`.** Columns: team, player, minute, X, Y,
   event type, movement type. It goes through the shared `DataTable` / `TableColumn<Row>` contract,
   states its own default order in its caption, and self-removes on data where
   `events.receiving === null`.
3. **AC 3 — no table on the match page is duplicated and no two tables share a caption.** The count
   of rendered `<DataTable>` instances on a match route goes from **27 to 28**, and the one new
   caption is distinct from all 27.

---

## Tasks / Subtasks

### Task 1 — The receiving log model (AC 1, AC 2)

A **new pure module**. `receiving-model.ts` is NOT the place: it is the Domain-G aggregate model for
`#offers-to-receive` / `#movement-to-receive`, its docblock bans reading an event table in so many
words, and 2.9 ruled that ban. This is the app's **first and only** reader of `bundle.events.receiving`.

- [x] **1.1** Create `app/src/viz/receiving-log-model.ts`. Imports — copy this block exactly; note
  what is absent:
  ```ts
  import type { DictionaryKey } from "@/lib/i18n";
  import type { OfferMovementType, ReceivingEvent, ReceivingEventType } from "@/lib/contract/contract-types";
  import { formatGoalMinute } from "@/lib/match-hero";
  import { orderByMinute } from "@/viz/marker-layout";
  import { resolveSide, sideRank, type LogSide } from "@/viz/marker-model";
  import { offerMovementKey } from "@/viz/receiving-model";
  ```
  **No `@/lib/format` and no `t()`** — `src/viz/**` is pure by ESLint-enforced discipline; a `t()`
  call here is a lint error. Keys and raw numbers out; the component resolves them.
- [x] **1.2** Define `ReceivingLogRow`. **The first seven field names are not a style choice** — they
  are the structural contract `ShotLogRow`, `CrossLogRow` and `DefensiveLogRow` already share, and
  they are what makes the shipped presence gates accept these rows unmodified (1.5).
  ```ts
  export interface ReceivingLogRow {
    key: string;
    teamCode: string;
    playerName: string | null;
    minuteLabel: string | null;
    /** NULL when the event carries no clock — never 0. The 2.11a decision-3 contract. */
    minute: number | null;
    stoppageMinute: number | null;
    x: number;
    y: number;
    /** `enums.receivingEventType.<offer|movement>` — the discriminator (see ruling 3). */
    eventTypeKey: DictionaryKey;
    /** null ⇒ the report did not classify this event; see `anyMovementType`. */
    movementTypeKey: DictionaryKey | null;
  }
  ```
- [x] **1.3** Export `receivingEventTypeKey(type: ReceivingEventType): DictionaryKey` returning
  `` `enums.receivingEventType.${type}` as DictionaryKey ``, and a frozen
  `RECEIVING_EVENT_TYPES: readonly ReceivingEventType[]` **derived from a
  `Record<ReceivingEventType, true>`** so a contract enum change is a compile error here rather than
  a silently missing label. `OFFER_MOVEMENT_TYPES` in `receiving-model.ts` is the pattern — copy its
  shape, and read its docblock.
- [x] **1.4** Export `receivingLogRows(events, home, away)`. Structure it on `defensiveRows` —
  **read that function before writing this one**; it is the closest sibling and every line of it is
  load-bearing:
  - `events === null || events.length === 0` → `[]`. Both, not just null.
  - `assertPlottable(event, index, "receiving-log-model")` per event — **copy it verbatim** from
    `defensive-actions-model.ts` (rename only the table string). A non-finite `x`/`y` must throw at
    MODEL ENTRY, on load, inside the sibling error boundary. It must not reach `formatDecimal`,
    whose `assertFinite` throws — and unlike Domain G, this table has coordinates. 2.9's review found
    the live consequence of getting this wrong: the throw fires when a reader opens the table, far
    from its cause. **Validate, never clamp or adjust (AR-6 / AD-6).**
  - `resolveSide(event.teamId, home, away, "receiving-log-model")` — throws NAMING the stray id. A
    silent drop is the class of finding prior reviews flagged twice. Note the schema `$comment`:
    **`teamId` is the RECEIVING player's team.**
  - Pre-sort by `sideRank`, then `orderByMinute` — both stable, giving minute major / side minor /
    artifact order last. Import `orderByMinute`; never re-implement it, or the table's default order
    and the roving order can disagree.
  - `key: \`receiving-row-${index}\`` — `DataTable` is `Row extends { key: string }` and uses it as
    the React key and the focus-restore identity.
  - `minuteLabel: event.at == null ? null : formatGoalMinute(event.at)`;
    `minute: event.at?.minute ?? null`; `stoppageMinute: event.at?.stoppageMinute ?? null`.
    **`?? null`, never `?? 0`** — 2.11a decision 3.
  - `playerName`: `null` for both absent AND empty-string, matching `playerNameOf` in
    `defensive-actions-model.ts`.
  - `movementTypeKey`: `null` when `event.movementType` is null or undefined, else
    `offerMovementKey(event.movementType)`. **Reuse `offerMovementKey`** — `i18n.test.ts` pins
    `enums.offerMovement`'s key set to `OFFER_MOVEMENT_TYPES` exactly, so a seventh set turns it red.
- [x] **1.5** Export **one** new gate, and reuse two shipped ones.
  ```ts
  /**
   * Does this bundle carry a receiving event table at all? FD-1 applied to the
   * whole log: it renders on fixtures (270 events) and SELF-REMOVES on corpus
   * data, where `events.receiving` is null.
   */
  export function anyReceivingEvents(events: readonly ReceivingEvent[] | null): boolean {
    return events !== null && events.length > 0;
  }

  /** Does the log need a movement-type column? `movementType` is contract-nullable. */
  export function anyMovementType(rows: readonly { movementTypeKey: DictionaryKey | null }[]): boolean {
    return rows.some((row) => row.movementTypeKey !== null);
  }
  ```
  For the player and minute columns, **import `anyPlayerName` and `anyMinute` from
  `@/viz/defensive-actions-model`. Do not re-derive them.** They are declared with STRUCTURAL
  parameters — `readonly { playerName: string | null }[]` and `readonly { minuteLabel: string | null }[]`
  — so they accept `ReceivingLogRow[]` with zero modification. That is why 1.2's field names are
  fixed. (The cross-family import is noted in Task 5.3 as a lift candidate; do not lift it here.)

### Task 2 — Locale keys (AC 1, AC 2)

`es.ts` is canonical (`export type Dictionary = typeof es`); a missing EN key is a **tsc error**, and
`i18n.test.ts`'s AD-12 sweep asserts `keyShape(en).sort()` equals `keyShape(es).sort()` with every
leaf a non-empty string. Write `es.ts` first, mirror to `en.ts`.

- [x] **2.1** Mint `enums.receivingEventType` — **two keys, a new namespace**. There is no existing
  label for `ReceivingEventType` anywhere in either locale; confirmed by grep.
  ```
  es: { offer: "Ofrecimiento", movement: "Desmarque" }
  en: { offer: "Offer",        movement: "Movement" }
  ```
  **The Spanish is derived from shipped copy, and the derivation matters — read it before changing a
  word.** The discriminator's two values name the two *sections* the array feeds, so the labels are
  the singular of those two shipped section titles: `viz.offers.title` is **"Ofrecimientos para
  recibir"** and `viz.movement.title` is **"Desmarques"**. That makes the column self-documenting — a
  reader maps a row to a section — and it is consistent with `enums.offerMovement`'s own docblock,
  which states that *"desmarque is the regional term for the movement itself, so the enum labels name
  the DIRECTION and the section title carries the noun."*

  **Two corrections to the drafting record, so you do not re-derive them from a stale claim.** (a)
  2.11b's Task 3.8 ruled the **opposite** of "Ofrecimientos" — it said `enums.offerMovement["no-movement"]`
  = "Sin desmarque" fixes the house term for *offer* as **desmarque**. "Ofrecimientos" shipped as a
  **declared DEPARTURE** from that task, recorded in 2.11b's Completion Notes and re-affirmed at its
  code review; **2.18 decision 3 is the ruling that actually binds.** (b) There is therefore a knowing
  near-collision on screen: a row can read event type **"Desmarque"** beside movement type **"Sin
  desmarque"**. That is what the source data says — the movement-to-receive map records an event whose
  movement classification is "no movement" — and it is not a defect to paper over. **Record it in
  Completion Notes as a knowing near-collision.** If you would rather split the terms, that is a
  ruling, not a dev choice: raise it, do not silently pick a third word.
- [x] **2.2** Add two `viz.table.*` column heads (this namespace is the shared column-head vocabulary
  and already carries `team`/`player`/`minute`/`x`/`y`):
  ```
  es: { eventType: "Tipo de evento", movementType: "Tipo de desmarque" }
  en: { eventType: "Event type",     movementType: "Movement type" }
  ```
  **"Tipo de desmarque" is REQUIRED, not a choice** — it is already the shipped Spanish for exactly
  this classification, in `viz.movement.totalsCaption` (*"Totales por equipo y tipo de desmarque."*)
  and `viz.movement.barNote` (*"…entre los seis tipos de desmarque."*). Minting "Tipo de movimiento"
  would put a second Spanish name on one enum. The EN head stays "Movement type", matching
  `viz.movement.title`.
- [x] **2.3** Add the `expert.logs.*` block. Six link labels, one heading, and the receiving log's own
  strings:
  ```
  expert.logs.heading          es "Registros completos"             en "Full event logs"
  expert.logs.shotLog          es "Registro de tiros"               en "Shot log"
  expert.logs.crossLog         es "Registro de centros"             en "Cross log"
  expert.logs.passMatrix       es "Matriz de pases"                 en "Pass matrix"
  expert.logs.offers           es "Tabla de ofrecimientos"          en "Offers table"
  expert.logs.movement         es "Tabla de desmarques"             en "Movement table"
  expert.logs.defensive        es "Registro de acciones defensivas" en "Defensive-actions log"
  expert.logs.receivingHeading es "Registro de recepciones"         en "Receiving log"
  expert.logs.receivingOrder   es "Ordenado por minuto, luego local antes que visitante."
                               en "Sorted by minute, then home before away."
  expert.logs.receivingName    es "Tabla del registro de recepciones"
                               en "Receiving log table"
  ```
  **`expert.logs.offers` and `expert.logs.movement` must NOT repeat their section titles.** The
  shipped `viz.offers.title` is already *"Ofrecimientos para recibir"* / *"Offers to receive"* and
  `viz.movement.title` is already *"Desmarques"* / *"Movement to receive"* — and Task 3.4 composes the
  section title into the hint beside the label, so a label equal to its own title prints the same
  phrase twice on one line. **"Tabla de …" / "… table" is also the more truthful name**: these two are
  2.9's *aggregate* tables, not event logs, and ruling 6 adds them as pointers, not as AC-1 logs.
  Verify at implementation time that **none of the six labels equals its paired
  `viz.*.title` in either locale** — the other four differ today (`Mapa de tiros`, `Mapa de centros`,
  `Red de pases`, `Acciones defensivas`), but that is a fact about shipped copy, not a guarantee.
- [x] **2.3a** `expert.logs.receivingOrder` states the order; the **rendered caption is composed**, so
  it carries the table's name like the other ten sections do:
  ```tsx
  const receivingCaption = `${t("expert.logs.receivingHeading")}${CAPTION_SEPARATOR}${t("expert.logs.receivingOrder")}`;
  ```
  **Do not reuse `viz.table.caption`** (*"Ordenado por minuto."*): three tables already resolve that
  string and AC 3 forbids a fourth. And **do not ship the order string bare** — `expert.tableCaption`
  is the one unprefixed caption on the page today; a second one would give the Expert Layer two
  captions that both open "Ordenado por…" and neither names its table.
- [x] **2.4** Update `expert.summary` to the **full mockup string**. 2.11b shipped the tables-only
  form deliberately and left a comment in `es.ts` (anchor: *"2.11c updates this leaf when it lands"*)
  saying this story closes it. With the logs block landing, the mockup copy stops being a false claim:
  ```
  es: "En posesión · Sin posesión · Físico — tablas por jugador y registros completos"
  en: "In possession · Out of possession · Physical — per-player tables and full event logs"
  ```
  **Delete the two comments that justified the short form** (the `es.ts` block quoted above and the
  `en.ts` one-liner `// Tables only — the "full logs" half of the mockup's copy is Story 2.11c's.`) —
  leaving them makes the file lie about its own state. Replace with a one-line note that the string
  is the mockup's, verbatim.
- [x] **2.5** Do **not** add an `expert.logs.*` empty state. When `anyReceivingEvents()` is false the
  receiving heading and table are absent entirely (FD-1: absence is removal, never an em dash and
  never an empty panel). **The six link entries are unconditional** — the sections they point at own
  their own empty states, and a link to an empty section is still a true statement about where that
  data lives.

### Task 3 — The logs block in the Expert Layer (AC 1, AC 2, AC 3)

All of this lands in `app/src/components/ExpertLayer.tsx`. Nothing outside this file, the two
locales, the new model and the tests is touched.

- [x] **3.0** **PLACEMENT — get this right first; it is the one structural decision here and it is
  easy to get subtly wrong.** The logs block goes inside `<div id={CONTENT_ID}>` and is a **SIBLING
  of the `isAbsent ? <EmptyStatePanel …/> : <>…</>` ternary, placed after it — NOT inside the
  non-absent branch.**

  Why: `isAbsent` is `bundle.players === null`, the report-does-not-carry-**Domain G** state. The logs
  block does not read `players` at all. A bundle with `players: null` and a populated
  `events.receiving` is contract-legal, and putting the block inside the false branch would hide six
  links and an 87-row table behind an absence that has nothing to do with them. It would also make
  Task 2.4's rewritten summary — *"tablas por jugador **y registros completos**"* — a false claim
  sitting directly above a panel saying the report carries no per-player pages, which is exactly the
  class of defect the comment 2.4 deletes was written to prevent.

  `hasNoRows` likewise does not gate it: that flag is about the Domain G table's visible rows.
- [x] **3.1** Read `bundle.events.receiving`. The component already takes the whole `bundle` as a
  **declared exception** to the narrow-props house rule (2.11b ruling 14), so no prop signature change
  is needed. **Correct the docblock while you are there:** it currently reads *"Story 2.11c adds the
  five `events` slices to the same prop"* — `EventTables` declares **seven** required slices (`shots`,
  `shootoutAttempts`, `crosses`, `passNetworkNodes`, `passNetworkEdges`, `receiving`,
  `defensiveActions`), and this story reads exactly **one** of them. Rewrite it to say that, in the
  present tense. Do not re-ship the wrong count.
- [x] **3.2** Render the block heading as an `<h3>` with a stable id, and label the `<ul>` with it via
  `aria-labelledby`. The layer's own heading is the `<h2>` (`HEADING_ID = "expert-heading"`); an
  `<h2>` here would sit as a sibling of the layer title and break the outline. **The heading levels
  in this block are h2 → h3 (the logs block) → h4 (the receiving log, Task 3.9)** — state them
  together so no step guesses.
- [x] **3.3** Render the six links as a `<ul>` of plain `<a href="#…">`. **This is a new markup
  pattern in `app/src`** — the only in-page anchor today is `SiteHeader`'s `#main-content` skip link.
  Follow it exactly: a plain `<a>`, **not** `next/link`, no `onClick`, no `preventDefault`, no
  `focus()` call. Fragment navigation is the browser's; `globals.css`'s `html { scroll-padding-top: 4.5rem }`
  already clears the sticky header, and `TacticalLayer`'s `hashchange` listener already auto-expands
  the target section below `lg`.

  | label key | `href` | section title key to compose |
  |---|---|---|
  | `expert.logs.shotLog` | `#shot-maps` | `viz.shotMap.title` |
  | `expert.logs.crossLog` | `#shot-maps` | `viz.crossMap.title` |
  | `expert.logs.passMatrix` | `#pass-networks` | `viz.passNetwork.title` |
  | `expert.logs.offers` | `#offers-to-receive` | `viz.offers.title` |
  | `expert.logs.movement` | `#movement-to-receive` | `viz.movement.title` |
  | `expert.logs.defensive` | `#defensive-actions` | `viz.defensiveActions.title` |

- [x] **3.4** **Each link must state where the table is and that it is behind a control** — that is
  the whole of ruling 2, and an unqualified "Shot log" link would be a promise the anchor does not
  keep. Compose at the call site from keys that already ship, with module-const separators (the
  `CAPTION_SEPARATOR` house pattern — a bare `" — "` in JSX is an i18n-gate error):
  ```tsx
  const CONTROL_SEPARATOR = " · ";
  // "Mapa de tiros · Ver los datos"
  const hint = `${t(sectionTitleKey)}${CONTROL_SEPARATOR}${t("viz.viewData")}`;
  ```
  `viz.viewData` is `"Ver los datos"` / `"View data"` — the exact visible string on every one of those
  controls. Reuse it; a paraphrase can drift out of sync with the button.

  **The hint must reach the accessible name, and a bare sibling `<span>` does not.** Render the label
  inside the `<a>` and the hint in a `<span>` beside it carrying a **per-row id**, then point the
  anchor at it with `aria-describedby`. With the hint merely adjacent, a screen-reader user in
  links-list mode gets six anchors naming neither location nor control — which is the exact failure
  ruling 2 exists to avoid, and would make AC 1 false for the readers AC 1 is for.
  `aria-describedby` is **not** one of the sixteen gated prop names, so an id-valued expression is
  legal; do not put the hint in `aria-label`, which is gated and would also *replace* the link text
  rather than extend it.
- [x] **3.5** Build the receiving log's rows. **`ExpertLayer` has no `home`/`away`** — its only side
  data is `sideCodes`, two uppercased strings with no `teamId`, and `resolveSide` matches on
  `teamId` and throws otherwise. Every other consumer receives `LogSide` as a prop built by
  `TacticalLayer`; this component has no such hand-off and must build both objects from
  `bundle.metadata` itself.

  **Build them INSIDE the `useMemo` callback.** This is not style:
  ```tsx
  const receivingRows = useMemo(
    () =>
      receivingLogRows(
        bundle.events.receiving,
        {
          teamId: bundle.metadata.homeTeam.teamId,
          teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
        },
        {
          teamId: bundle.metadata.awayTeam.teamId,
          teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
        }
      ),
    [bundle]
  );
  ```
  Hoisting the two objects above the memo and leaving `[bundle]` is a `react-hooks/exhaustive-deps`
  **warning**, and `npm run lint` is `eslint . --max-warnings 0` and is step 1 of `npm run build` — so
  it fails the build, not just the lint. Adding them to the dependency array instead defeats the memo
  entirely, because fresh object literals are a new identity every render; that is precisely the
  defect 2.11b's review patched on `buildExpertRows`. **`.toUpperCase()` is required** — `ExpertRow.teamCode`
  is uppercased by the model and the two tables on this layer must agree.
- [x] **3.5a** Build the columns. **Gates first, columns second**, on the `DefensiveActionsSection`
  idiom — the spread-empty-array conditional, never an em dash:
  ```tsx
  const showReceiving = anyReceivingEvents(bundle.events.receiving);
  const showPlayer = anyPlayerName(receivingRows);
  const showMinute = anyMinute(receivingRows);
  const showMovementType = anyMovementType(receivingRows);
  ```
  Column order: `team`, `player` (gated), `minute` (gated), `x`, `y`, `eventType`, `movementType`
  (gated). Every `key` is a stable string, **never an index** — a closing gate shifts every later
  column by one, which is exactly why `TableColumn.key` is declared the way it is.
  - `x` / `y`: `formatDecimal(row.x, locale, 2)` — two decimals, matching the schema's
    `x-decimals: 2` and the three shipped logs.
  - `minute`: renders `row.minuteLabel ?? unknown`, sorts on
    `clockSortValue(row.minute, row.stoppageMinute)` — imported from `@/lib/table-sort`, never
    re-derived. Never sort on the `"45+2′"` string, which collates after `"9′"`.
  - `player`: renders `row.playerName ?? unknown`, sorts on `row.playerName` — **the raw null, not
    the em dash**, so an unnamed player sorts to the array END in both directions.
  - `eventType` / `movementType`: render `t(row.eventTypeKey)` and sort on the **resolved** string,
    so the order follows the EN toggle. Sorting on the raw key would order by
    `"enums.receivingEventType.movement"`. `movementType` renders `row.movementTypeKey === null ?
    unknown : t(row.movementTypeKey)` — a `t()` on a null key throws.
  - `unknown` is `t("viz.table.unknown")` (`"—"`), hoisted to an identifier.
- [x] **3.6** Render the table, **wrapped**. `DataTable` renders no scroll container of its own and
  must not — its own docblock says so. All 27 shipped instances sit inside one: the 20 disclosure
  tables inside `ViewDataDisclosure`'s `<div className="mt-tile-gap w-full overflow-x-auto">`, and
  the Domain G table inside `SCROLLPORT`. A bare `<DataTable>` here would let 7 columns × 87–96 rows
  overflow the ~345px content box at 390px **onto the document**, giving the whole match route
  horizontal body scroll — a page-level regression, and a direct UX-DR16 violation ("data tables keep
  internal-scroll exception" means the table scrolls, not the page).
  ```tsx
  <div className="w-full overflow-x-auto">
    <DataTable
      caption={receivingCaption}
      columns={receivingColumns}
      rows={receivingRows}
      surface="canvas"
      tableName={t("expert.logs.receivingName")}
    />
  </div>
  ```
  - **`overflow-x-auto`, not `SCROLLPORT`.** `SCROLLPORT` is height-bounded and pairs with `sticky`;
    reusing it here would cap an 87-row table at 70vh for no reason.
  - **`surface="canvas"`, not `"pitch"`** — this table sits on the page canvas. Getting that backwards
    is the defect Story 2.7's review headlined (`--ink-on-pitch` computes 1.09:1 on a white card).
  - **Do NOT pass `sticky`.** It requires a height-bounded scrolling ancestor; this table has none,
    and 2.11a's declared departure was precisely a sticky rule inside an unbounded ancestor, which
    computes correctly and silently does nothing.
  - **Do NOT give it a `key`.** The neighbouring Domain G table carries
    `key={\`${isMd ? "wide" : "narrow"}-${group}\`}` because *its* column set changes with the
    breakpoint and the group tab. This table's gates are bundle-constant, so copying that `key` would
    remount it on every breakpoint cross and silently discard the reader's sort for nothing.
- [x] **3.7** Gate the receiving heading and table on `showReceiving`. When false, neither renders and
  the block is the `<h3>` plus **six** links. Per 2.5, there is no empty panel.
- [x] **3.8** Confirm the i18n gate passes: every user-facing string comes from `t()`; the glyph
  separators are module consts; `href` and `aria-describedby` are not among the sixteen gated prop
  names, so the fragment literals and the id expression are legal. Run `npm run lint` — it is step 1
  of `npm run build`, so a gate violation fails the build, not just the lint.
- [x] **3.9** Render `expert.logs.receivingHeading` as an `<h4>` immediately **after** the `</ul>`,
  with the table below it. **The receiving log is not an `<li>`** — the list holds only the six
  anchors, and nesting an 87-row table inside a labelled list item would make the list unreadable to
  a screen reader enumerating it. The `<h4>` sits under the block's `<h3>`, completing the h2 → h3 →
  h4 outline from 3.2.
- [x] **3.10** **The `<md` team selector does NOT filter this table, and that must not read as a
  bug.** Below md, the layer mounts a team `ToggleGroup` (`aria-label={t("viz.teamSelector")}`) and
  filters the Domain G rows to one side. The receiving log sits below that block and carries **both**
  teams — its own `Equipo` column and its caption ("local antes que visitante") are what carry the
  split, exactly as the shot, cross and defensive logs do. Verify at 390px that the selector visibly
  governs only the table it sits above; if it reads as governing both, say so in Completion Notes
  rather than filtering this table to match — filtering it would contradict its own caption.

### Task 4 — Tests (there is no jsdom; push decisions into pure modules)

- [x] **4.1** Create `app/src/viz/receiving-log-model.test.ts`. Copy the harness from
  `defensive-actions-model.test.ts` verbatim — `readFixture(slug)` via `node:fs` (the client-import
  seam bars `@/lib/build-data` inside `src/viz`), `m001` / `m002` / `m074`, `ALL`, `sides(bundle)`,
  and module-level `HOME` / `AWAY` constants. Assert against these **measured** numbers; hard-coding
  them is the point, because a drifting fixture must turn the suite red:
  - `receivingLogRows` length: m001 **87**, m002 **87**, m074 **96** — **270** total.
  - All seven contract fields non-null on **270/270**; `movementTypeKey` non-null on **270/270**.
  - `type` split: m001 44 offer / 43 movement, m002 44 / 43, m074 48 / 48.
  - Distinct `playerId`: 29 / 29 / 32. Minute range m074 is **5–118** (extra time, a plain `minute`
    with no stoppage — the log must render 118 and not treat it as an error).
  - Field-set pin: `Object.keys(row).sort()` equals the ten names from 1.2, exactly. This is what
    catches a silently-added column.
  - `eventTypeKey` matches `/^enums\.receivingEventType\./`; `movementTypeKey` matches
    `/^enums\.offerMovement\./`.
- [x] **4.2** The three **constructed** tests, none of which any fixture can produce. Use the
  authorised cast idiom from `defensive-actions-model.test.ts` (anchor: *"THE CAST IS AUTHORISED HERE
  AND ONLY HERE"*) — bundles reach the app as `as`-cast unvalidated JSON, which is the path these
  simulate.
  - **`movementType: null`** → `movementTypeKey` is null and `anyMovementType(rows)` is **false**, so
    the column disappears. Fixtures carry it non-null on 270/270; **this branch is unreachable from
    any fixture render.**
  - **`at` absent** → `minuteLabel` null, `minute` null, `anyMinute(rows)` **false**; and with a
    second event that has a clock, the clock-less row sorts **LAST** and `anyMinute` flips true.
  - **`stoppageMinute` non-null** → `minuteLabel` is `"90+2′"`. Null on **270/270** fixtures, so the
    stoppage branch of `formatGoalMinute` is likewise constructed-test-only.
- [x] **4.3** The three failure modes: `receivingLogRows(null, …)` and `receivingLogRows([], …)` both
  return `[]`; a stray `teamId` throws matching `/receiving-log-model/`; a non-finite `x` throws from
  `assertPlottable` (test `undefined`, not just `NaN` — the defensive test does).
- [x] **4.4** Extend `app/src/lib/i18n.test.ts`:
  - Pin the new namespace to the union: `Object.keys(es.enums.receivingEventType).sort()` equals
    `[...RECEIVING_EVENT_TYPES].sort()`, **importing the list from the model that owns it, never
    hand-copying it here** — the 2.9 review patched exactly that mistake.
  - Resolution sweep over `receivingEventTypeKey`'s full domain **in both locales**: non-empty, and
    not containing `"enums.receivingEventType"`.
  - Assert `expert.logs.receivingOrder` is **distinct from `viz.table.caption` in both locales**.
  - **Assert every one of the six link labels differs from the `viz.*.title` it is composed against**,
    in both locales — the check Task 2.3 asks you to make by hand, made permanent.
  - The AD-12 mirroring sweep (`keyShape(en).sort()` vs `keyShape(es).sort()`) already covers the
    new keys; no change needed there.
- [x] **4.4a** **Pin the six `href` fragments to `SECTION_IDS`.** Import the frozen list from
  `@/lib/tactical-sections` and assert each href, stripped of its `#`, is a member. This is the
  cheapest test in the story and it guards the story's largest silent-failure mode: a typo like
  `#pass-network` yields a dead anchor that no type, no lint and no other test catches, because
  `sectionIdFromHash` is exact-match and returns `null` **silently** — which ruling 2 documents.
- [x] **4.4b** **AC 3's caption-uniqueness test compares COMPOSED captions, never raw keys.** Three
  shipped keys already resolve byte-identical strings (see Caption discipline below); a key-level
  test would go red on a pre-existing condition and the dev would not be able to tell whether it was
  their regression. Assert over the strings each table actually renders.
- [x] **4.5** **Do not add a defensive-log constructed test — it already exists.** See the correction
  in Dev Notes. `defensive-actions-model.test.ts` already asserts `anyPlayerName(rows)` and
  `anyMinute(rows)` are both false on `CORPUS_SHAPED_EVENT` and both flip true when a name or a clock
  is added. Confirm it is still green; write nothing new.
- [x] **4.6** Full chain: `npm run lint && npm run typecheck && npm test`. Baseline is 707 tests
  across 25 files after 2.11b's review patches; report the new total.

### Task 5 — Verification and ledger

- [x] **5.1** Browser-verify at 390 / 768 / 1280. **The bundle-cache trap is real**: a hard reload
  does not refresh bundle data — override `fetch` with `no-store`, as 2.11b's Debug Log records.
  Verify against the **static export** (`npm run build` + a local static server), not `next dev`:
  there is no `app/public/`, so under `next dev` the fixture fetch 404s and the Expert Layer never
  mounts. If `app/` will not compile because of the concurrent session, verify in an isolated
  worktree on a private port.
- [x] **5.2** Record in Completion Notes, as numbers not adjectives:
  - The rendered `<DataTable>` count on the match route: **27 before, 28 after** (AC 3).
  - A digest of every **composed** caption on the page, proving no two are equal (AC 3). Note the
    pre-existing key-level cluster named under Caption discipline so a reader can tell your
    measurement from that condition.
  - Rows in the receiving log per fixture, and the column count with all gates open (7).
  - `document.body.scrollWidth === document.body.clientWidth` at 390px with the layer expanded —
    the Task 3.6 wrapper's whole job.
  - The knowing "Desmarque" / "Sin desmarque" near-collision from Task 2.1, as seen on screen.
  - What each of the six links actually does at 390 and at 1280 — including, honestly, that at ≥lg
    the target section is already expanded so the link is a scroll-and-focus, and that the target
    table remains behind its own "Ver los datos" in both cases. **This is the ruled behaviour, not a
    defect to hide.**
  - That the `events.receiving === null` branch was **never seen on screen** — all three fixtures
    populate it — so AC 2's self-removal is discharged by 4.2/4.3 only.
- [x] **5.3** File to `deferred-work.md`, appended as a new `## Filed by Story 2.11c implementation
  (…, 2026-08-XX)` section. Entries are plain bullets, hard-wrapped ~100 cols, `**bold claim.**` +
  evidence + `**Deferred: …**` + `**Owner:** …`. **Append; never edit an earlier paragraph** — a
  correction is recorded as its own bullet.
  - **The Expert log links land on the section, not on an open table.** Name the four blockers:
    `ViewDataDisclosure`'s `open` is a private `useState(false)` with no prop and a `useId()` region
    that does not exist in the DOM while closed; `PitchPanel` forwards only `panelTitle` and
    `trailing`; `sectionIdFromHash` is exact-match against the eleven `SectionId`s so no finer
    fragment resolves; and `#shot-maps` is ambiguous, holding two independent disclosures. **Owner:
    2.19 or whichever story next needs deep-linking into a disclosure.**
  - **CORRECTION, measured: the receiving-log AC is not unbuildable.** Grep the existing entry
    *"Story 2.11's receiving-log AC is UNBUILDABLE"*. It is true of the CORPUS and false of the
    BUILD. State the 270 fixture events and the ruling. **Say "unpopulatable on corpus data;
    fixture-only today", never "unbuildable".**
  - **CORRECTION: the constructed defensive-gate test the split asked for already exists** — 2.9's
    review wrote it. Point at `defensive-actions-model.test.ts`'s `CORPUS_SHAPED_EVENT` block.
  - **The contract's `ReceivingEvent` description is STALE.** It still claims *"Story 2.9 renders
    #offers-to-receive and #movement-to-receive from the same array"*, which 2.9 reversed — 2.9 reads
    `bundle.players`, and `events.receiving` had **no reader in `app/` at all** until this story.
    Stale in `contract/match-bundle.schema.json` and in both generated `contract-types.d.ts` copies.
    **`/contract` is NOT edited by this story. Owner: the next contract change-set.**
  - **`anyPlayerName` / `anyMinute` are family-agnostic and want lifting.** They live in
    `defensive-actions-model.ts` but are structurally typed and now have a cross-family consumer.
    `marker-model.ts` is the natural home. **Deferred: the lift touches a shipped module for no
    behaviour change. Owner: whichever story next adds a fourth log.**
  - **Three CS-1 tripwires now assert a false premise.** `i18n.test.ts` (×2) and `glossary.test.ts`
    say *"CS-1 has not landed"* in their names and rationales; CS-1 landed in `093a1b2`. They are
    still CORRECT as assertions and must stay green. **Owner: 2.13/2.18, which must delete them
    deliberately when detail labels ship.** Note the glossary one is a blunt
    `expect(id).not.toContain("detail")` that will reject *any* future glossary id containing
    "detail".
- [x] **5.4** `sprint-status.yaml`: `2-11c-expert-layer-event-logs: review`, and append a dated note
  in the house style. Update `last_updated`.

### Review Findings

Code review 2026-08-05 — three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance
Auditor) over the uncommitted working tree against `baseline_commit: 4682639`. The Acceptance
Auditor independently re-ran `lint`/`typecheck`/`vitest` (**743/26, green**) and re-derived AC 3's
27→28 from source rather than from the Completion Notes. **No AC violation, no ruling violation, no
scope-boundary breach, no falsified `[x]`.** 21 findings after dedupe; 17 dismissed after reading
the code at each location — including three that changed rating on inspection (see below).

- [x] [Review][Decision] **`aria-describedby` does not deliver Task 3.4's stated goal** — Task 3.4
  requires that "the hint must reach the accessible name" and picks `aria-describedby` to do it,
  rejecting `aria-label` because it is one of the sixteen gated prop names. But a description is not
  part of the accessible *name*, and the links-list mode the task names (NVDA/JAWS/VoiceOver)
  enumerates names only — so the six anchors still list as bare labels, which is the exact failure
  ruling 2 exists to avoid. `aria-labelledby={`${selfId} ${hintId}`}` is **not** gated and would
  work, as would folding the location into the link text. The mechanism is spec-ruled, so changing
  it is Juan's call, not a dev fix. [`app/src/components/ExpertLayer.tsx:977-1005`]
  **RULED (Juan, 2026-08-05): `aria-labelledby`, self + hint.** Give the `<a>` its own per-row id
  and set `aria-labelledby={`${linkId} ${hintId}`}`, so the accessible NAME becomes "Registro de
  tiros Mapa de tiros · Ver los datos" and links-list mode gets the location and the control. The
  visible layout, the hint `<span>` and the composed hint string are unchanged; `aria-labelledby`
  is not among the sixteen gated prop names, so the i18n gate is unaffected. This is Task 3.4's
  stated goal, finally true — the ruling stands, the mechanism was wrong. **Becomes a patch.**
- [x] [Review][Decision] **`LOG_LINKS` is exported from a `"use client"` component and imported by
  the i18n unit suite** — every comparable frozen list in the project lives in a pure module
  (`SECTION_IDS` in `lib/tactical-sections.ts`, `OFFER_MOVEMENT_TYPES` in `viz/receiving-model.ts`)
  precisely so it is testable without the component graph. This pulls `lib/i18n.test.ts` through
  `DataTable` → `SortAnnouncer` → `radix-ui` under `environment: "node"`. Green today; it breaks
  opaquely the day anything in that chain touches `window` at module scope, and it widens
  `ExpertLayer`'s public API purely for a test. Moving it adds a file the story's Project Structure
  Notes did not list, so the placement is a decision. [`app/src/components/ExpertLayer.tsx:113-150`,
  `app/src/lib/i18n.test.ts:58`]
  **RULED (Juan, 2026-08-05): move it to a pure module.** New `app/src/lib/expert-logs.ts` holds
  `ExpertLogLink` and `LOG_LINKS`; `ExpertLayer.tsx` and `i18n.test.ts` both import from it, and
  `ExpertLayer` stops exporting them. This matches the `SECTION_IDS` / `OFFER_MOVEMENT_TYPES`
  precedent, narrows `ExpertLayer`'s public API back to the component, and decouples the i18n suite
  from `DataTable` → `SortAnnouncer` → `radix-ui`. `lib/` rather than `viz/` because the list is
  navigation config, not a viz model. One file beyond the story's declared list, ruled deliberately.
  **Becomes a patch.** The matching ledger entry is superseded — see the correction filed below it.
- [x] [Review][Patch] **`es.ts` docblock states a false fact about the EN head** — the comment
  justifying `viz.table.movementType` reads "The EN head stays 'Movement type', matching
  `viz.movement.title`." `en.viz.movement.title` is **"Movement to receive"** (`en.ts:613`), not
  "Movement type". Verified. The comment is the stated justification for the whole label choice.
  [`app/src/locales/es.ts` — `viz.table.movementType`]
- [x] [Review][Patch] **The AC 3 test's docblock describes something the test does not do** —
  it claims "`DefensiveActionsSection`'s caption is conditional, so BOTH branches are listed and the
  count is checked against the branch the fixtures take." Only the clocked branch is listed, and
  listing both would contradict the `toHaveLength(27)` three lines below. The assertion is correct;
  the comment is not. [`app/src/lib/i18n.test.ts` — `composedCaptions` docblock]
- [x] [Review][Patch] **`RECEIVING_HEADING_ID` is a dead identifier** — declared and stamped on the
  `<h4>`, referenced by nothing (grep returns exactly those two hits). Reads as an abandoned
  `aria-labelledby` and the next reader will assume the `<h4>` names something.
  [`app/src/components/ExpertLayer.tsx:72,1031`]
- [x] [Review][Patch] **The distinct-player test measures `playerName` where Task 4.1 measured
  `playerId`** — `new Set(rows.map(r => r.playerName)).size` against `[29, 29, 32]`. Names and ids
  are 1:1 on all three fixtures today, so it is green by coincidence; two players sharing a printed
  name would fail it for a reason unrelated to the model. The ids are readable straight off
  `bundle.events.receiving`. [`app/src/viz/receiving-log-model.test.ts`]
- [x] [Review][Patch] **A test's name does not match what it asserts** — "resolves the movement
  column through `enums.offerMovement`, minting no second set" never touches `receivingLogRows` or
  `movementTypeKeyOf`; it re-runs the pre-existing `OFFER_MOVEMENT_TYPES` label loop. If
  `movementTypeKeyOf` started returning `enums.receivingMovement.*`, it would still pass.
  [`app/src/lib/i18n.test.ts`]
- [x] [Review][Patch] **`LOG_LINKS[].id` uniqueness is unpinned** — the suite pins length 6, label ≠
  title, labels mutually distinct, and `href` ∈ `SECTION_IDS`, but never `id`. A repeated `id` gives
  a duplicate React key on the `<li>` and two DOM elements sharing one `hintId`, so one link's
  description silently points at the other's span. One-line test. [`app/src/lib/i18n.test.ts`]
- [x] [Review][Patch] **The `<ul>` loses its list role in Safari/VoiceOver** — Tailwind v4's
  preflight sets `list-style: none` on `ul`, which drops the list role in WebKit. This is the one
  `<ul>` in the codebase that *argues from* list semantics: it carries `aria-labelledby`, and the
  receiving table is deliberately kept outside it because "nesting an 87-row table inside a labelled
  list item would make the list unreadable to a screen reader enumerating it." `role="list"` appears
  nowhere in `app/src`, so this is additive. [`app/src/components/ExpertLayer.tsx:971`]
- [x] [Review][Patch] **Four `as unknown as ReceivingEvent` casts sit on legal shapes** — the block's
  own comment authorises the cast because the shapes "are not constructible through the types". True
  for the two `delete`-shaped cases; false for `BASE_EVENT`, `{...BASE_EVENT, movementType: null}`,
  `{...BASE_EVENT, at: {minute: 90, stoppageMinute: 2}}` and `{...BASE_EVENT, playerName: ""}`. On a
  legal shape the cast suppresses real contract drift — drop `"offer"` from `ReceivingEventType` and
  every one of these still compiles. [`app/src/viz/receiving-log-model.test.ts`]
- [x] [Review][Patch] **`href` is typed `string` where `` `#${SectionId}` `` would make the typo a
  compile error** — the story calls the `SECTION_IDS` pin "the cheapest test in the story" and "the
  story's largest silent failure"; typing the field deletes the failure mode outright. The diff
  already uses this technique 40 lines away (`RECEIVING_EVENT_ORDER: Record<ReceivingEventType,
  true>`, chosen on exactly the "makes a contract change a COMPILE ERROR" argument).
  [`app/src/components/ExpertLayer.tsx:113`]
- [x] [Review][Patch] **The Change Log records a status transition that did not happen** — it says
  "status ready-for-dev -> review", but `sprint-status.yaml` at `HEAD` had this story at `backlog`;
  create-story never moved it. Task 5.4's required end state is correct. [this file, Change Log]
- [x] [Review][Defer] **The receiving caption asserts a minute ordering the table may not have** —
  when no event carries `at`, `showMinute` closes and the caption still reads "Ordenado por minuto,
  luego local antes que visitante." `DefensiveActionsSection` branches to
  `viz.defensiveActions.tableCaptionNoClock` for exactly this. Unreachable today: 270/270 fixture
  events carry `at`, and on corpus data `events.receiving` is null so the whole log self-removes.
  [`app/src/components/ExpertLayer.tsx:770-775`] — deferred, latent; the fix mints locale copy that
  Task 2.5 barred.
- [x] [Review][Defer] **`events.receiving === undefined` throws an unnamed `TypeError`** — both new
  entry points guard `=== null` / `!== null` then read `.length`, so an absent key crashes the layer
  with no module name. Copied faithfully from `defensive-actions-model.ts:228,377`, whose comment
  documents `!== null` ONLY as deliberate for `[]` semantics. Same class: a null array element, and
  an absent `metadata.*.teamCode` reaching `.toUpperCase()`.
  [`app/src/viz/receiving-log-model.ts:176,213`] — deferred, family-wide pattern.
- [x] [Review][Defer] **`formatGoalMinute` renders `"33+undefined′"` and `"90+0′"`** — it branches on
  `at.stoppageMinute !== null`, so an absent key (`undefined`) and a literal `0` both take the
  stoppage path. One line below, `?? null` normalises the sort key correctly, so the label and the
  sort disagree. [`app/src/lib/match-hero.ts:73`] — deferred, pre-existing in a shared helper every
  log calls.
- [x] [Review][Defer] **Unknown enum codes fabricate dictionary keys with no runtime guard** —
  `receivingEventTypeKey` and `offerMovementKey` interpolate blindly and cast. Verified as the
  documented house convention across seven sibling models (`expert-model.ts:175` states it).
  [`app/src/viz/receiving-log-model.ts:73`] — deferred, family-wide convention.
- [x] [Review][Defer] **Whitespace-only `playerName` defeats the presence gate** — `playerNameOf`
  tests `=== ""` only, so `"   "` keeps the whole player column open for a table of blank cells.
  Copied verbatim from the sibling, as Task 1.4 required.
  [`app/src/viz/receiving-log-model.ts:132`] — deferred, family-wide.
- [x] [Review][Defer] **`home.teamId === away.teamId` silently mislabels every row** — `resolveSide`
  returns `home` on the first branch for all events and `sideRank` returns 0 for all, so every row
  prints the home code, the side pre-sort is a no-op and the caption's "then home before away" is
  meaningless — with no throw. [`app/src/viz/marker-model.ts`] — deferred, pre-existing, affects
  every log.
- [x] [Review][Defer] **The 87–96 row table has no row header** — no column sets `rowHeader: true`,
  so all ~609 body cells are `<td>` and a screen reader announcing a cell gets the column head with
  no row identity. The Domain G table 400 lines up in the same file sets it on the player column for
  exactly that reason; the three shipped logs do not, so the family is consistent and this is the
  wrong story to break it. (`sticky` is correctly absent — Task 3.6's reasoning holds.)
  [`app/src/components/ExpertLayer.tsx:700-760`] — deferred, family-wide.
- [x] [Review][Defer] **Two links share `#shot-maps`, so the second consecutive click is a silent
  no-op below lg** — browsers do not fire `hashchange` for an unchanged hash, which is the ledgered
  defect the block's own comment names. Both the ambiguity and the re-entry defect are already filed
  by Task 5.3. [`app/src/components/ExpertLayer.tsx:120,126`] — deferred, already ledgered.
- [x] [Review][Defer] **Nothing exercises the closed-gate four-column render** — all three column
  gates are true on all three fixtures and the harness has no jsdom, so the only shape corpus-real
  data would ever take is the least verified thing in the change. The model-level `any*` helpers are
  tested; the table they produce is not. [`app/src/components/ExpertLayer.tsx:700-760`] — deferred,
  harness limit the story acknowledges in Task 4's own title.

**Dismissed after reading the code (17).** The `expert.summary` / "Registros completos" over-claim
and the link-vs-table gap (rulings 1, 2, 6, 7 — ruled by Juan); the `<md` selector not filtering the
log (Task 3.10, ruled and measured); the hard-coded fixture counts (Task 4.1 — "hard-coding them is
the point"); `as DictionaryKey` being removable (**re-rated**: it is the documented house convention
in all seven sibling models); model allocation count and the pre-`open` gate computation (copied
sibling patterns); the two hoisted heading identifiers, the `<h4>`'s `type-stat-label` styling and
the link-list `gap-1` (taste; targets measure 44px); `assertPlottable` not being byte-verbatim (the
message noun changed — an improvement); `-0` rendering as `-0,00`; duplicate DOM ids on a second
mount and dead links when the Tactical boundary trips (unreachable by construction); and four
low-value test-vacuity complaints (`toHaveLength(27)`, `not.toContain("in-front")`, the compile-time
key-set equality, and `composedCaptions` re-implementing composition — Task 4.4b directed it).

---

## Dev Notes

### THE TWO RULINGS THAT DEFINE THIS STORY — made by Juan at create-story, 2026-08-04

The stub carried an open question marked *"Rule this before writing a line."* It is ruled. Both
rulings are load-bearing; do not re-litigate them mid-implementation.

**RULING 1 — AC 1's "the same tables" means ONE rendered instance reached from TWO entry points, not
two instances.** The Expert log slots are **links** to the existing viz disclosures. The two rejected
readings and why:

- *Remove the viz disclosures and let the logs live only in Expert* — **ruled out on the spec, not on
  taste.** UX-DR9 (`epics.md:112`) requires that *"every panel carries 'Ver los datos / View data'
  opening the equivalent data table"*, and NFR-2/UX-DR16 make that the accessibility floor. Deleting
  them breaks a shipped requirement.
- *Duplicate, with a distinct caption per instance* — **rejected on cost.** Nine logs re-rendered
  makes eighteen tables at ~63–104 rows each on fixtures and ~153/team for defensive at corpus
  density, needs ten new caption keys across two locales, and gives a reader listing the page's
  tables thirty-six entries.

The normative text settles it. UX-DR18 (`epics.md:121`) assigns the Expert layer *"Domain G tables +
full event logs **doubling as** viz alternatives"*, and EXPERIENCE.md's layer table says the logs
*"**double as** the viz data-table alternatives"*. "Doubling as" is one artifact serving two roles.
EXPERIENCE.md's Visualization-Layering table says the same thing a second way: the "Expert altitude"
column for each viz **is** its data table — an altitude, not a location.

**RULING 2 — the links are honest anchors; this story builds NO disclosure-opening plumbing.**

A plain anchor does not deliver a reader to a table, and the story must not pretend otherwise. Every
data table on the match page sits behind a `ViewDataDisclosure` whose `open` is a private
`useState(false)`: no `open` prop, no `defaultOpen`, no ref, no context, and a `useId()` region id
that is not authorable and does not exist in the DOM while closed. `PitchPanel` forwards exactly two
props (`panelTitle`, `trailing`). `TacticalLayer`'s `sectionIdFromHash` is whole-string equality
against the eleven `SectionId`s, so `#shot-maps-log` returns `null` and is silently ignored. And
`#shot-maps` is ambiguous: it holds two independent disclosures.

Making the links actually open a table would mean an `openNonce` + authored id on
`ViewDataDisclosure`, a per-panel key through `PitchPanel`, a finer fragment grammar, a relaxed
`sectionIdFromHash`, and edits to all five section components — **~12 files, every match-page
section, while the concurrent session is still settling 2.11b in the same area.** It would also
inherit the three ledgered hash-re-entry defects (grep *"Hash re-entry has three unhandled paths"*),
of which (a) is fatal here: browsers do not fire `hashchange` for an unchanged hash, so clicking the
same log link twice is a silent no-op.

**So: the link label states where the table is and that "Ver los datos" opens it (Task 3.4), and the
gap is FILED as a named deferred item (Task 5.3), not hidden.** What the reader gets is honest
navigation, which is more than they have today, and the plumbing question stays open for a story that
can afford the blast radius.

*Consequence for AC 1's wording:* the four linked logs already **render** — they have since 2.7, 2.8
and 2.9. This story does not re-render them; it makes them reachable from Expert altitude and builds
the one log that was missing. That is AC 1 discharged under ruling 1's reading. If a later reviewer
reads "render" as "render a second time", point them here.

### CORRECTIONS carried from the split — do not regress, and do not redo

**The receiving log is NOT "unbuildable".** `deferred-work.md` says so; the claim is true of the
corpus and **false of the build**.

- *Corpus:* Story 1.13 measured `ReceivingEvent` unfulfillable over 104 reports / 416 pages. (The
  ledger says "all eight required fields"; 1.13's own Task 7.1 enumerates seven — `teamId` is
  derivable from the per-team page anchor. The conclusion is unaffected: none of EXPERIENCE.md:221's
  four columns has a corpus source.)
- *Fixtures:* `events.receiving` ships **270 events** — m001 87, m002 87, m074 96 — with **all eight
  fields non-null on 270/270**. Every column this story renders has a source in the data the app
  serves today. A dev can confirm it in thirty seconds.

**RULED (Juan, 2026-08-04):** build it behind `anyReceivingEvents()` — the same shape as the shipped
`anyExpectedGoals` (FD-1) and `anyContestType` / `anyPlayerName` / `anyMinute` gates. It renders on
fixtures and **self-removes on corpus data**, so AC 1's fifth log is satisfied **by construction**,
with no re-scope and no waiver. The earlier draft's asymmetry — a presence gate for xG and for three
defensive columns, but outright deletion for receiving, which has *better* data — was the thing to
fix. **Say "unpopulatable on corpus data; fixture-only today", never "unbuildable".** And **keep
2.9's aggregate tables** (decision 19 parity): a per-player event log does not satisfy UX-DR16 for a
team-level figure, and the two are different data — aggregates versus events — so this is additive,
never a duplicate.

**The defensive log's absent columns are REMOVED, not em dashes — and that already shipped.** 2.9's
code review extended the FD-1 gate from `anyContestType` to all three absent-on-corpus fields.
`DefensiveActionsSection` already imports all three, already drops the columns with the
spread-empty-array idiom, and already swaps its caption to
`viz.defensiveActions.tableCaptionNoClock`. Under ruling 1 this story does not re-render that log at
all, so there is nothing here to implement.

**A THIRD CORRECTION, found at create-story: the constructed test the stub asks for already exists.**
The stub flags the trap correctly — all three gates return **true** on fixtures (237/237 rows carry
`playerId`, `playerName` and `at`; 60/237 carry `contestType`), so the corpus-real shape is
exercisable only by a constructed test. But 2.9's review **wrote that test**:
`defensive-actions-model.test.ts` builds a `CORPUS_SHAPED_EVENT` through the authorised
`as unknown as` cast and asserts `anyPlayerName(rows)` and `anyMinute(rows)` are both `false`, then
flips each to `true` with a clock-carrying and a name-carrying event. **Confirm it is green and move
on. Do not write a duplicate.** (The trap itself still applies to the NEW model — Task 4.2 is where
you pay it.)

### CS-1 landed under this story and changes NOTHING here

The baseline moved from `163fa20` to `4682639`, crossing change-set CS-1 (`093a1b2` + `4682639`):
`schemaVersion` 2 → 3, `ShotOutcomeDetail` 22 → 24 values (adding bare `incomplete` and `on-target`),
and `x-maps-to-outcome["deflected-on-target-defensive-event"]` becoming an **array**. Measured impact
on this story: **none.** Recorded so it is not re-investigated:

- **The shot log does not render `ShotOutcomeDetail`.** `ShotLogRow` carries `outcomeKey`, built by
  `shotOutcomeKey(shot.outcome)` from the stable **five-value** `ShotOutcome` — AD-14 decision CR-2
  makes `outcome` authoritative for marker encoding and forbids deriving it from `outcomeDetail`.
  There is no `enums.shotOutcomeDetail` namespace in either locale; all 24 values are unlabelled, on
  purpose.
- **No code in `app/src` reads `x-maps-to-outcome` at all** — the only occurrence is generated JSDoc
  prose. The array/scalar heterogeneity is handled correctly and exclusively in `pipeline/`
  (`DETAIL_COMPATIBLE_OUTCOMES` normalises scalar-or-sequence; a test pins that exactly one entry is
  an array). **There is no TS representation of the map — do not create one here.**
- **`schemaVersion` is already correct.** `MatchBundleRegion` guards on the generated
  `SCHEMA_VERSION`, never a literal, and `schema-version.ts` reads `3`. All seven fixtures are
  re-pinned to v3.
- **Three tripwires now carry a stale rationale** and must stay green (Task 5.3 files them):
  `i18n.test.ts`'s *"does NOT carry ShotOutcomeDetail labels — those ride CS-1"* and *"still mints NO
  ShotOutcomeDetail namespace (decision 12 — CS-1 has not landed)"*, plus `glossary.test.ts`'s
  *"mints no ShotOutcomeDetail id"*. Two stale comments say the same thing (`es.ts`, `glossary.ts`).
  **Not this story's to delete** — 2.13/2.18 own that, deliberately.

### The receiving log — the only table this story renders

**The data.** `ReceivingEvent` has eight fields, **exactly one of which is nullable**:
`movementType: OfferMovementType | null`. `teamId`, `playerId`, `playerName` (schema `minLength: 1`),
`type`, `at`, `x`, `y` are all required and non-nullable — but the bundle arrives as **`as`-cast
unvalidated JSON**, which is why Task 1.4's guards are not belt-and-braces. `at` is a `MinuteStamp`
(`{ minute, stoppageMinute: number | null }`). `x`/`y` are `0–100`, `x-decimals: 2`. The schema
`$comment` on the type: **`teamId` is the RECEIVING player's team.**

**Two enums, and EXPERIENCE.md:221 names only one of them ambiguously.** The spec column reads
*"Receiving log table (player, minute, coordinates, type)"*. The event carries **two** candidates for
"type": the discriminator `type: "offer" | "movement"`, and `movementType: OfferMovementType | null`
(the six values `in-front`, `in-between`, `out-to-in`, `in-to-out`, `in-behind`, `no-movement`).

**RULING 3: render both.** `#offers-to-receive` and `#movement-to-receive` are two separate surfaces
fed from one array, and the log merges them into one table — so **without the discriminator a reader
cannot tell an offer row from a movement row**, and the log would be actively misleading on 270/270
rows. `movementType` is the finer classification and is what carries analytical content. Two columns,
both gated where the contract allows null. `movementType` reuses the shipped `enums.offerMovement`
labels through `offerMovementKey`; only the two-value discriminator namespace is new.

**Where it must NOT go.** `receiving-model.ts` is the Domain-G aggregate model for the two 2.9
sections. Its docblock bans exactly what this story does — *"built from Domain G — NOT from
`events.receiving` (Story 2.9 ruled decision 2)"* — and states two hard bans that still hold: those
aggregates *"are never rendered as events, and never placed on a pitch"*. Nothing about ruling 3
touches that; the new module is a separate file with a separate purpose. **Import `offerMovementKey`
from it; add nothing to it.**

### The five existing logs — where they are, and what they already do

Twenty-seven `<DataTable>` instances render across eleven components on a match route today. The five
AC 1 names, plus the two 2.9 aggregate surfaces the links also point at:

| AC 1 log | component | anchor | disclosure | caption composition |
|---|---|---|---|---|
| shot log | `ShotMapsSection` | `#shot-maps` | via `PitchPanel` | `viz.shotMap.title` + `viz.table.caption` |
| cross log | `ShotMapsSection` | `#shot-maps` | via `PitchPanel` (a **second** one) | `viz.crossMap.title` + `viz.table.caption` |
| pass matrix | `PassNetworksSection` | `#pass-networks` | via `PitchPanel`, **two tables in one** | `+ viz.table.captionNodes` / `captionEdges` |
| receiving log | — | — | **does not exist** | this story |
| defensive log | `DefensiveActionsSection` | `#defensive-actions` | via `PitchPanel` | `+ viz.table.caption` **or** `tableCaptionNoClock`, conditional |
| offers (2.9) | `OffersToReceiveSection` | `#offers-to-receive` | its **own**, `surface="canvas"` | `viz.offers.totalsCaption` / `tableCaption` |
| movement (2.9) | `MovementToReceiveSection` | `#movement-to-receive` | its **own**, `surface="canvas"` | `viz.movement.totalsCaption` / `tableCaption` |

`ShotMapsSection` documents why every one of those captions is title-prefixed, and it is the sentence
ruling 1 protects: *"Two panels on one page previously shipped two identical 'Ver los datos' buttons
and two identical 'Ordenado por minuto.' captions, so a reader listing the page's tables or buttons
got two indistinguishable entries with nothing separating shots from crosses."*

**Do not touch any of these components.** 2.11b's scope boundary says it plainly: *"Do not remove or
restructure any existing viz disclosure table — 2.11c may need them intact."* Under ruling 1 it needs
them exactly as they are.

### Caption discipline

`viz.table.caption` is literally *"Ordenado por minuto."* / *"Sorted by minute."* and is a **false
claim** on any clock-less table. Three tables resolve it today (shot, cross, and defensive
conditionally); five tables mint their own key to avoid it. **AC 3 forbids a fourth consumer** — the
receiving log gets `expert.logs.receivingOrder`, which states its real order: minute, then home
before away.

**There is a pre-existing byte-identical-string cluster. Know it before you write the AC 3 test.** In
`es.ts`, **four** keys resolve to *"Ordenado por equipo y dorsal."* — `viz.table.captionNodes`,
`viz.offers.tableCaption`, `viz.movement.tableCaption`, and `expert.tableCaption` (shipped by 2.11b).
In `en.ts` it is **three**, because `expert.tableCaption` reads "Sorted by team and shirt number."
while the other three read "Sorted by team, then shirt number." **This is not a live defect and not
this story's to fix**: every rendered `<caption>` except `expert.tableCaption`'s is disambiguated by
its `${title} — ` prefix, and `expert.tableCaption` is the only unprefixed one on the page. It is a
dedupe candidate, filed as Open Question 2. The operational consequence for this story is Task 4.4b:
**assert AC 3 over composed captions, not over keys**, or the test goes red on a condition that
predates it — and Task 2.3a, which is why the receiving caption is prefixed rather than bare.

The caption **states the default order and never mutates** (2.11a decision 7). There is no
`defaultSort`; every table mounts at artifact order with every `<th>` at `aria-sort="none"`, and
"default sort is stated" is discharged by the caption alone (decision 5).

### Density at real data

The defensive log is the one that grows: corpus **min 62 / median 97 / max 153 markers per team
figure** over 208 team-innings, against the fixtures' 30–59 per team. Filed for 2.19; not this
story's, and under ruling 1 this story adds none of it. The receiving log adds **87–96 rows** to a
page that already renders ~1,700 Expert cells — but the whole layer is collapsed by default at every
width and lazy-mounts on expand, so none of it is on first load. **Measure and record; do not gate**
(NFR-1 is a later story's).

### Rulings

1. **AC 1's "the same tables" = one instance, two entry points. Ruled by Juan, 2026-08-04.** Expert
   log slots are links. See the full ruling above.
2. **No disclosure-opening plumbing. Ruled by Juan, 2026-08-04.** Honest anchors; the gap is filed.
   See above.
3. **The receiving log renders BOTH `type` and `movementType`.** A merged log without its
   discriminator is misleading on every row. See above.
4. **Build the receiving log behind `anyReceivingEvents()`. Ruled by Juan, 2026-08-04.** FD-1 applied
   symmetrically: it renders on fixtures and self-removes on corpus data.
5. **A NEW module, `receiving-log-model.ts`.** Not `receiving-model.ts`, whose docblock bans reading
   the event table and whose ban 2.9 ruled.
6. **The link list is SIX entries: AC 1's four linked logs, plus offers and movement, which AC 1 does
   not enumerate.** AC 1 names five logs; offers and movement are 2.9's *aggregate* surfaces, not
   event logs — which is why 2.3 names them "Tabla de …" rather than "Registro de …". They are
   included because a link is a pointer, not a rendered table, so 2.11b's *"whether these four also
   surface at Expert altitude is filed, not answered — do not build them here"* is about tables and
   is not violated. **Cheap to reverse:** delete two `<li>`, two locale keys and two rows of Task
   3.3's table. If a reviewer objects, that is the whole fix — nothing else in the story depends on
   the count.
7. **`expert.summary` takes the full mockup string.** 2.11b shipped the tables-only form precisely
   because *"registros completos"* named content the reader could not find. The logs block is that
   content. Delete the comments that justified the short form.
8. **Player names are plain text, never links.** UX-DR22's cross-link rule is scoped to LINEUP names;
   `/players/{slug}` ships in 2.15.
9. **No `aria-pressed`; sort state is `aria-sort`** (2.11a decision 10). And no second live region —
   there is exactly one `SortAnnouncer`, mounted in `MatchBundleRegion` (2.11a decision 9).
10. **Guard `null` AND `[]` at every entry point.** `[]` is `ready` with zero rows, not absence —
    `match-bundle.schema.json` states verbatim that *"Empty array and null are distinct states"*, and
    2.11b's review found the live consequence of conflating them.
11. **`@/lib/format` throws on non-finite input, and this log carries coordinates.** Guard at model
    entry, fail loud on load — never inside a lazily-mounted subtree where the throw fires far from
    its cause.
12. **`src/viz/**` is pure** — returns `DictionaryKey`s and raw numbers; components resolve them. A
    `t()` there is a lint error, and `@/lib/format` is kept out by the same discipline (which is why
    `table-sort.ts` lives in `src/lib/`).

### Scope boundary — do NOT build here

- **Any change to `ViewDataDisclosure`, `PitchPanel`, `TacticalLayer`, `TacticalSection`,
  `lib/tactical-sections.ts`, or any of the five section components.** Ruling 2 exists to keep this
  boundary; crossing it is the story growing by 8 files.
- **Any change to `DataTable.tsx` or `lib/table-sort.ts`.** 2.11a and 2.11b settled that contract;
  the receiving log needs nothing new from it. `components/ui/**` is vendored and off-limits.
- **`/contract`.** The stale `ReceivingEvent` description is FILED, not fixed (Task 5.3).
- **Deleting the three CS-1 tripwires**, or minting `enums.shotOutcomeDetail`. 2.13/2.18 own that.
- **Removing or restructuring 2.9's aggregate tables.** Decision 19 parity; they stay.
- **Sortability changes to the pass matrix** — 2.11a already discharged that ledger item; all
  instances are sortable through the shared component.
- Glossary tooltips on Expert headings (2.18), `/players/{slug}` (2.15), the Tournament Hub tables
  (2.12), phone-density clustering (2.19).

---

## Project Structure Notes

**New**
- `app/src/viz/receiving-log-model.ts`
- `app/src/viz/receiving-log-model.test.ts`

**Modified**
- `app/src/components/ExpertLayer.tsx` — the logs block, the six links, the receiving table
- `app/src/locales/es.ts` — `enums.receivingEventType`, two `viz.table.*` heads, `expert.logs.*`,
  the `expert.summary` rewrite
- `app/src/locales/en.ts` — the same key tree, mirrored
- `app/src/lib/i18n.test.ts` — the `enums.receivingEventType` ↔ `RECEIVING_EVENT_TYPES` pin, the
  both-locales resolution sweep, the caption-distinctness assertion, the six-label-vs-title
  distinctness assertion, and the `href` ↔ `SECTION_IDS` pin (Tasks 4.4 / 4.4a / 4.4b)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Placement rules.** New pure model code goes in `src/viz/**`; a co-located `<module>.test.ts` is
mandatory. `DataTable.tsx` lives in `src/components/`, never `src/components/ui/` (vendored shadcn
primitives only). A new top-level `src/` directory silently escapes the ESLint client-import seam —
do not create one.

**Concurrent-session hazard — this is the sharpest operational risk in the story.** `locales/es.ts`,
`locales/en.ts` and `lib/i18n.test.ts` are the three hottest files in the repo, and the 2.11b review
session is (or was) editing all three plus `ExpertLayer.tsx` — **the exact files this story extends**.
2.11a's own record documents its work being swept into another story's commit by a sweeping
`git add`. Therefore: **wait for 2.11b's review commit before starting**; re-read all four files
before editing; **commit your slice early and by explicit path**; **never `git add -A`**. If `app/`
will not compile because of in-flight changes, verify in an isolated worktree on a private port
rather than fighting the shared tree. **Cite shared artifacts by quoted anchor phrase, not line
number** — the numbers in the files you are reading will have shifted.

**Toolchain, pinned.** next `16.2.11`, react `19.2.8`, typescript `~6.0.3`, vitest `^3.2.7`,
tailwindcss `~4.3.3`, node `>=24`. `npm run build` = `lint → typecheck → assert:schema-version →
next build → copy-data`, so the i18n gate is a **build** failure, not a lint warning. `npm test` is
`vitest run`.

**The i18n gate, concretely.** `react/jsx-no-literals` with `noStrings: true` bans any bare JSX text
child and any `{'literal'}`. Sixteen prop names are gated on ANY element — `aria-label`,
`aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-braillelabel`, `aria-valuetext`,
`title`, `alt`, `placeholder`, `label`, `message`, `text`, `description`, `caption`, `heading`,
`tooltip` — including template literals and the operands of concatenation/ternary/logical
expressions inside them. `href` is **not** gated, so the fragment literals in Task 3.3 are legal.
`headText` and `headTitle` on `TableColumn` are named as they are precisely to sit outside that list.

---

## References

- `epics.md:848` (the AC); **UX-DR9** (`:112` — every panel carries "Ver los datos", the reason
  ruling 1 rejected removal), **UX-DR16** (`:119`), **UX-DR18** (`:121` — *"full event logs doubling
  as viz alternatives"*, the phrase ruling 1 turns on), **NFR-2** (`:1022`).
- `EXPERIENCE.md` — the Layer-assignment table (*"full event logs … which double as the viz
  data-table alternatives"*), the Visualization-Layering table's "Expert altitude" column, and `:221`
  (*"Receiving log table (player, minute, coordinates, type)"*).
- Stories **2.11a** (the `TableColumn` contract, decisions 2/3/5/7/8/9/10), **2.11b** (the shell,
  rulings 2/9/12/14/15; its Scope boundary and Open Question), **2.9** (the aggregate re-scope, the
  three-gate extension, the `CORPUS_SHAPED_EVENT` test), **2.7** (the log columns and the
  caption-collision fix), **1.13** (the receiving probe).
- `deferred-work.md` — grep *"Story 2.11's receiving-log AC is UNBUILDABLE"* (corrected here),
  *"Hash re-entry has three unhandled paths"* (inherited, not fixed), *"Rendering decision FD-1"*,
  *"The pass matrix ships PLAIN"* (**already discharged by 2.11a** — do not act on it).
- Change-set **CS-1** (`093a1b2`, `4682639`) and **AD-14 decision CR-2** — see the CS-1 section above
  for why neither reaches this story.

---

## Open Questions (filed, not answered)

1. **Should the four linked logs eventually render at Expert altitude for real?** Ruling 1 says no
   for now and ruling 2 says the link cannot open the table today. If a future story builds the
   disclosure-opening plumbing (Task 5.3's filed item), this question reopens with a cheaper answer
   available. **Not this story's.**
2. **Do the four byte-identical Spanish caption strings want deduping?** `viz.table.captionNodes`,
   `viz.offers.tableCaption`, `viz.movement.tableCaption` and `expert.tableCaption` all resolve to
   *"Ordenado por equipo y dorsal."* in `es.ts` (three of them do in `en.ts` — `expert.tableCaption`
   diverges there, which is its own small inconsistency). Harmless today because every rendered
   `<caption>` except `expert.tableCaption`'s is title-prefixed. Filed, not fixed.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context)

### Debug Log References

**The start blocker was checked, not assumed.** The story bars dev until 2.11b's review patches are
committed. At session start `git log -1 -- app/src/components/ExpertLayer.tsx` returned `9df15df`
("Story 2.11b code review: 4 decisions ruled, 14 patches applied, status done") and `git status`
showed `app/` completely clean — no concurrent session in flight. All four extended files were
re-read from the committed state before editing. `git add -A` was never used.

**Verified against the STATIC EXPORT** (`npm run build` + `npx serve` on a private port 4311), never
`next dev`: there is no `app/public/`, so under `next dev` the fixture fetch 404s and the Expert
Layer never mounts. The bundle-cache trap did not bite — the fixtures were not edited by this story,
and the export was freshly built and freshly served, so every measurement is against current code.

**Viewports were emulated with same-origin iframes** (Story 2.9's precedent). `resize_window` had no
effect on the maximized Chrome window — the inner width stayed at 1261 after resizing to 429 — so
320 / 390 / 768 / 1236 were all measured inside iframes, whose media queries resolve against the
iframe viewport. Iframe widths were set 4px wider than the target to absorb the scrollbar
(`width: 394px` yields `innerWidth: 390`).

**The overflow finding came from a differential, not from reading the offender list.** The raw
"elements whose right edge exceeds the viewport" sweep returned 713 entries at 390px, almost all of
them descendants of the Domain G scrollport (which clips them, so they are not document overflow).
The conclusive method was to hide one subtree at a time and re-read `document.body.scrollWidth`:
hiding the entire logs block left it unchanged, hiding 2.11b's column-group ToggleGroup fixed it
exactly.

### Completion Notes List

**AC 1 — the five logs are enumerated and reachable.** The Expert Layer carries an `<h3>` "Registros
completos" block holding six `<li>` anchors and, below the list, the receiving log as an `<h4>` plus
a table. Heading outline confirmed in the DOM as h2 -> h3 -> h4; the `<ul>` carries
`aria-labelledby="expert-logs-heading"`; `ul.querySelector("table")` is **false**, so the 87-row
table is not nested inside a list item. All six `href` targets resolve to a real element
(`document.querySelector(href)` non-null on all six), and each anchor measures exactly **44px** tall.

**AC 2 — the receiving log is a real, sorted `<table>`.** Seven columns with all gates open —
Equipo, Jugador, Minuto, X, Y, Tipo de evento, Tipo de desmarque — over **87 / 87 / 96 rows**
(m001 / m002 / m074). Every `<th>` reads `aria-sort="none"` on mount (2.11a decision 5: "none" IS
the artifact order). Sorting works and the caption does not mutate (decision 7): clicking the event
head sorted ascending with the caption unchanged.

**AC 3 — 27 rendered `<DataTable>` instances before, 28 after.** Measured on the m001 route with
every disclosure expanded: **28 `<table>` elements, 28 DISTINCT composed captions, zero duplicates**,
of which exactly one is `"Registro de recepciones — Ordenado por minuto, luego local antes que
visitante."` One new caption in a set of 28 distinct means 27 pre-existing, which also reconciles
with the source count (25 JSX sites, two of which — `PhasesSection.tableFor`, `PressingSection.rateTable`
— render twice).

**Decision-2's payoff proven live.** With a sort active on the movement-type column, the EN toggle
RE-SORTS the rows, because `sort.valueOf` returns the call-site-resolved label rather than the raw
key: `A la espalda / De dentro a fuera / De fuera a dentro / Entre líneas / Por delante / Sin
desmarque` becomes `In behind / In between / In front / In to out / No movement / Out to in` — a
genuinely different ordering of the same six codes. The caption and all seven heads switched locale
with it.

**What the six links actually do, at both widths, stated honestly because it is the ruled behaviour
and not a defect to hide.** At **390px** (below lg), clicking the `#defensive-actions` link set the
hash, `TacticalLayer`'s `hashchange` listener auto-expanded the section (`aria-expanded` false ->
true), and the section top landed at **exactly 72px** — `globals.css`'s `scroll-padding-top: 4.5rem`
clearing the sticky header to the pixel. The target's "Ver los datos" disclosure remained
`aria-expanded="false"` and the section contained **zero** tables. At **1236px** (>= lg) the section
was already expanded, so the same click was a pure scroll to the same 72px, with the same closed
disclosure and no table. **In both cases the reader still has to press "Ver los datos"** — which is
exactly what each link's own `aria-describedby` hint states ("Acciones defensivas · Ver los datos").
Ruling 2, working as ruled; the plumbing gap is filed, not hidden.

**`document.body.scrollWidth === document.body.clientWidth` at 390px in ES, with the layer expanded:
375 == 375.** Task 3.6's wrapper does its whole job — the table's own container measures
`clientWidth: 343` against `scrollWidth: 523` with `overflow-x: auto`, so the TABLE scrolls and the
PAGE does not. At 768px the page is clean (753 == 753) and the wrapper does not even need to scroll.

**A REAL RESIDUAL, AND IT IS 2.11b's — PROVEN BY DIFFERENTIAL, NOT ASSERTED.** At 390px **in EN**,
expanding the layer takes `document.body.scrollWidth` to **412** against `clientWidth: 375` — a 37px
horizontal body scroll (WCAG 1.4.10). Hiding this story's **entire logs block** leaves it at 412;
hiding 2.11b's `aria-label="Column group"` ToggleGroup **alone** returns it to 375. That control is
`w-fit` with `shrink-0` items and renders **396px** on the EN labels against **323px** on the
Spanish ones, which is precisely why 2.11b's review — measured in ES — could not see it. At **320px
the same control overflows in BOTH locales** (339 vs 305, again unchanged by hiding the logs block;
the 5px present while still collapsed is 2.18's already-filed Key Statistics tile pair). **Filed to
the ledger, not fixed:** the candidate remedy is one class (`flex-wrap`) or shorter EN group labels,
but it is a shipped narrow-layout control and a copy/layout ruling this story was not given.

**Task 3.10 — the `<md` team selector governs only the table it sits above, and does not read as
governing both.** Measured at 390px: selecting RSA filtered the Domain G table from 16 rows to 15
and left the receiving log at **87 rows carrying both MEX and RSA**. It also does not read as
governing it — an `<h3>`, six links and an `<h4>` sit between the selector and the log, and the log
carries its own `Equipo` column and a caption saying "local antes que visitante", exactly as the
shot, cross and defensive logs do. Filtering it would have contradicted its own caption.

**The knowing "Desmarque" / "Sin desmarque" near-collision SHIPPED and is visible on screen.** Row 1
of m001 reads event type **"Desmarque"** beside movement type **"Sin desmarque"**. That is what the
source data says — the movement-to-receive map records an event whose movement classification is "no
movement" — and it is recorded here rather than papered over, per Task 2.1. Both labels are derived
from shipped copy, not chosen: the discriminator is the singular of the two section titles it names
(`viz.offers.title`, `viz.movement.title`), and "Tipo de desmarque" was already the shipped Spanish
for that classification in `viz.movement.totalsCaption` and `viz.movement.barNote`. Splitting the
terms would be a ruling, not a dev choice.

**The `events.receiving === null` branch was NEVER SEEN ON SCREEN.** All three fixtures populate it
(270 events), so AC 2's self-removal is discharged by the unit tests alone — `anyReceivingEvents`
false for both `null` and `[]`, asserted in `receiving-log-model.test.ts`. Likewise the three
constructed branches: `movementType: null` (non-null on 270/270), an absent `at` (present on
270/270), and a non-null `stoppageMinute` (null on 270/270) are unreachable from any fixture render
and are covered only by the constructed block.

**Every measured number the story hard-codes was re-measured and held.** 270 receiving events
(87 / 87 / 96); all eight contract fields non-null on 270/270; discriminator split 44/43, 44/43,
48/48; 29 / 29 / 32 distinct players; m074 spanning minutes **5 to 118**, with "118′" rendering as a
plain extra-time minute and not an error.

**One tripwire was INVERTED, deliberately — it was left for this story.** `i18n.test.ts` asserted
`es.expert.summary` does NOT contain "registros completos" and `en.expert.summary` does not contain
"full logs", with a comment naming 2.11c as the story that closes it. It now asserts the mockup
string verbatim in both locales, and that each summary contains its own `expert.logs.heading`. The
two comments in `es.ts` / `en.ts` that justified the short form were deleted, as Task 2.4 requires.
**The three CS-1 tripwires were NOT touched** — they still carry a stale rationale in their names but
remain CORRECT as assertions (no `enums.shotOutcomeDetail` namespace exists, on purpose), and
2.13/2.18 own deleting them.

**AC 3's test compares COMPOSED captions, never keys, and that is load-bearing.** Four `es` keys
already resolve byte-identical to "Ordenado por equipo y dorsal." (`viz.table.captionNodes`,
`viz.offers.tableCaption`, `viz.movement.tableCaption`, `expert.tableCaption`; three in `en`, where
`expert.tableCaption` diverges), so a key-level test would have gone red on a condition that
predates the story. The suite now enumerates all 27 shipped compositions plus the new one and
asserts 28 distinct in BOTH locales — and the 27 are themselves asserted distinct, which is what
makes the new one's distinctness meaningful.

**Task 4.5 discharged as a confirmation, not as new code.** `defensive-actions-model.test.ts`'s
`CORPUS_SHAPED_EVENT` block already asserts `anyPlayerName` and `anyMinute` both false and both
flipping true. Confirmed green in the full run; no duplicate written.

**Suite 707/25 -> 743/26** (+36 tests, +1 file). Full chain green: `eslint . --max-warnings 0`,
`tsc --noEmit`, `assert:schema-version`, `next build` (all 8 pages exporting), `copy-data`. **Zero
console messages** across the entire browser pass, on all three fixtures, including a post-load
locale toggle and a post-load theme toggle.

**Seven ledger entries appended**, with the append-only property PROVEN programmatically: the first
**247,062 bytes are byte-identical** to the committed file and **8,098 bytes** were appended, with
no CRLF introduced. The two corrections (the "UNBUILDABLE" claim and the already-existing
constructed test) are recorded as their own bullets; no earlier paragraph was edited.

**NOT COMMITTED.** Staging is Juan's call, and the story bars `git add -A`; the slice is seven files
and is listed below by explicit path.

### Change Log

- **2026-08-05 — Story 2.11c implemented, status backlog -> review.** (`sprint-status.yaml` at
  `HEAD` carried this story at `backlog`; create-story moved the file's own Status line to
  `ready-for-dev` but never synced the sprint file, so the transition recorded here is the real one.
  Corrected at the code review — the earlier entry claimed `ready-for-dev -> review`.) New pure model
  `receiving-log-model.ts` (the app's first and only reader of `bundle.events.receiving`) with its
  co-located test; the full-event-logs block in `ExpertLayer.tsx` (an `<h3>`, six `aria-describedby`
  anchors and the receiving log's gated 7-column table inside its own `overflow-x-auto` wrapper);
  `enums.receivingEventType`, two `viz.table.*` heads and the `expert.logs.*` block minted in both
  locales, with `expert.summary` rewritten to the mockup string and the two comments that justified
  the short form deleted; ten new assertions in `i18n.test.ts` including the `href` -> `SECTION_IDS`
  pin and the composed-caption uniqueness sweep, plus one pre-existing tripwire inverted. Rendered
  `<DataTable>` count 27 -> 28. Suite 707/25 -> 743/26.

### File List

**New**
- `app/src/viz/receiving-log-model.ts`
- `app/src/viz/receiving-log-model.test.ts`

**Modified**
- `app/src/components/ExpertLayer.tsx`
- `app/src/locales/es.ts`
- `app/src/locales/en.ts`
- `app/src/lib/i18n.test.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-11c-expert-layer-event-logs.md` (this file)

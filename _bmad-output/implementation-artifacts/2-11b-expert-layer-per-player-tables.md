---
baseline_commit: 163fa20
---

# Story 2.11b: Expert Layer Shell & Domain G Per-Player Tables

Status: backlog

<!-- STUB. Created alongside 2.11a during the three-way split of epic Story 2.11 (ruled by Juan,
     2026-08-04). Everything below was MEASURED at that split and is carried forward so it is not
     re-derived. Run create-story on this key to finish it; do not start dev from this file. -->

## Story

As Diego,
I want the Expert Layer to open in place with every per-player metric the report carries,
So that I can drill to complete depth without leaving the page (FR-23, UJ-2, SM-C2).

> **Depends on 2.11a**, which ships the shared sortable `DataTable`, `table-sort.ts`, the
> `SortAnnouncer` provider and the `TableColumn<Row>` contract. This story consumes them.

## Acceptance Criteria (from `epics.md:845-848` and `:855-857`)

**AC 1 (partial — the per-player half)**
**Given** the Expert Layer shell (`#expert`, EXPERTO/EXPERT pill)
**When** it is expanded (collapsed by default at all widths, expands in place)
**Then** per-player tables expose every Domain G field from the bundle — in-possession, out-of-possession, physical — with no "lite" versions (FR-23, SM-C2)

**AC 3**
**Given** a `<md` viewport
**When** Expert tables render
**Then** column groups tab as En posesión / Sin posesión / Físico with a sticky player column and horizontal scroll inside the table container only — every field remains reachable (UX-DR17).

> **BINDING: the shell does not exist and this story builds it.** Verified at `163fa20`:
> `MatchBundleRegion.tsx`'s loaded branch renders `<TacticalErrorBoundary><TacticalLayer/></…>` and
> nothing else. `git grep -ni expert -- app/src` returns **six comment/doc references plus one test
> line** — and **zero locale keys**, **zero `experto` occurrences**, no `ExpertLayer` component and
> no `#expert` section. AC 1's "Given" is a requirement to create, not a precondition.

## Carried-forward findings — measured at the split, do not re-derive

### The Expert Layer is a SIBLING, never a twelfth `SectionId`

`app/src/lib/tactical-sections.ts` must **not** be touched. `SectionId` is a closed union of eleven;
`sectionDataState`'s `default:` branch carries a `const unexpected: never = id` exhaustiveness check;
and **`tactical-sections.test.ts` already asserts `sectionDataState(m001, "expert" as SectionId)`
THROWS**. Adding `"expert"` to the registry turns that green test red.
`TacticalSection` cannot be reused either — its `id` prop is typed `SectionId`, and the ledger
already routes a *different* widening of that same component (`title: string` → `ReactNode`) to
Story 2.18. Build a separate shell; copy `TacticalSection`'s focus/nonce contract rather than
importing it.

### The mockup specifies this layer concretely — build from it

`ux-designs/ux-wc-stats-2026-07-21/mockups/key-match-dashboard-mobile.html` (the desktop mockup has
**no** Expert block):

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
7.03 dark / 6.65 light — passes. `--spacing-layer-gap: 4rem` already exists (`mt-layer-gap`); there
is no `layer-gap` class. Record any departure explicitly — `tactical-sections.ts` shows the house
precedent of departing from this same mockup and saying so.

### Domain G in full — 51 leaves, 50 rendered columns, in contract `required[]` order

`PlayerRecord`'s schema description is the AC restated: *"Every field the Expert Layer's per-player
tables show is here — **there is no reduced variant**."* Column order **is** the `required[]` order,
which is the source page's print order. Never alphabetical, never JSON key order (fixtures serialize
alphabetically).

- **Identity (5):** `teamId`, `playerId`, `playerName`, `shirtNumber`, `position`
- **`inPossession` (17 → 16 scalar columns + the nested block):** `passesAttempted`,
  `passesCompleted`, `passCompletion`*, `switchesOfPlay`, `crossesAttempted`, `crossesCompleted`,
  `lineBreaksAttempted`, `lineBreaksCompleted`, `lineBreakCompletion`*, `ballProgressions`,
  `takeOns`, `stepIns`, `attemptsAtGoal`, `goals`, `totalOffers`, `offersByMovementType` → nested,
  `offersReceived`
- **`offersByMovementType` (6):** `inFront`, `inBetween`, `outToIn`, `inToOut`, `inBehind`,
  `noMovement`
- **`outOfPossession` (15):** `tacklesMade`, `tacklesWon`, `blocks`, `interceptions`,
  `pressingDirect`, `pressingIndirect`, `duelsWonAerial`, `duelsWonPhysical`,
  `possessionContestsWon`, `clearances`, `looseBallReceptions`, `pushingOn`, `pushingOnIntoPressing`,
  `possessionRegains`, `possessionInterrupted`
- **`physical` (9):** `totalDistance`†, `distanceZone1..5`†, `highSpeedRuns`, `sprints`, `topSpeed`‡

\* `Percentage`, 0-100, **1 dp**, and **stored** — never recomputed from attempted/completed.
† `Metres`, **1 dp**. Bands are the page's own: Z1 0-7 km/h, Z2 7-15, Z3 15-20, Z4 20-25, Z5 25+.
‡ `KmPerHour`, **1 dp**. Everything untagged is `Count` → `formatInteger`.

**51 leaves = 46 data columns + 5 identity; 50 RENDERED columns** (46 data + team-code, shirt, name,
position). `playerId` is a join key and React key; `teamId` renders as its **resolved team code**
(there is no `teamCode` on `PlayerRecord` — join via `resolveSide` from `viz/marker-model.ts`, which
fails loud on a stray id). **FR-23 is fully satisfied**: `pipeline/extract/domain_g.py` emits 3
identity fields + 46 metrics = 49, all rendered.

**Nullability: there is none.** Zero `?`, zero `| null` inside `PlayerRecord` or its sub-blocks; the
only nullable point is the container, `Players = PlayerRecords | null`. **Fixture census: 96 rows
(m001 31, m002 31, m074 34), 51/51 populated, 0 nulls, 0 missing keys.** `(teamId, shirtNumber)` is
unique per bundle.
**So no Domain G cell may ever render an em dash and no FD-1 presence gate applies.** Zeros are dense
and real — `goals` 0 on 90/96, `crossesCompleted` 0 on 68/96, `inBehind` 0 on 73/96, `noMovement` 0
on 64/96, `attemptsAtGoal` 0 on 60/96. **Print `0`.**

**There is no minutes-played, substitution or card data in Domain G** — those live in `Lineup` /
`LineupEntry`. If a column seems to need "minutes", it is not available here.

### Rulings already made at the split

1. **Error boundary — ruled by Juan.** Wrap `<ExpertLayer>` in a **second, sibling**
   `TacticalErrorBoundary` in `MatchBundleRegion`. Additive; zero change to `TacticalLayer`.
   **But the boundary's copy is WRONG as shipped** — `match.bundle.crashed` is literally *"No pudimos
   mostrar el análisis táctico de este partido." / "We could not display the tactical analysis for
   this match."*, and it hardcodes `console.error("TacticalLayer render failed", …)`. Both would be
   **false statements** over an Expert crash while eleven healthy Tactical sections render above.
   **Ruled:** parameterise the boundary additively — optional copy-override keys + a console `label`,
   **both defaulting to today's values** so the Tactical mount stays byte-identical — and mint
   `match.bundle.crashedExpert` / `crashedExpertExplanation`. Two instances are structurally safe:
   `state` is a per-instance class field and there is no module-level state.
   *Still open, re-filed:* there is no **per-section** boundary inside `TacticalLayer`.
2. **Distance unit — ruled by Juan: METRES, verbatim.** Mint `enums.unit.m`; do **not** convert to km
   (AD-7 keeps artifacts raw and a conversion is a derivation the contract never asks for, it loses a
   digit, and the zones collapse toward 0,0). **The unit goes in the COLUMN HEAD, never per-cell** —
   46 columns with per-cell units is unreadable at 11px. Note the Hero's Key-Statistics row says
   "Distancia (km)"; that is a different, team-level metric and the difference is intentional.
3. **Domain G labels get a NEW namespace — NOT `enums.metric`.** `i18n.test.ts` asserts
   `Object.keys(es.enums.metric).sort()` equals **exactly** `KEY_STAT_FIELDS` (19 keys, all Domain
   B). Adding Domain G labels there turns it red. Mint `expert.field.*` — **40 keys, not 46**: the
   six `offersByMovementType` columns reuse `enums.offerMovement.*` via the shipped
   `OFFER_MOVEMENT_PROPERTY` bridge in `receiving-model.ts`. `enums.position.*` (gk/df/mf/fw →
   Arquero/Defensa/Mediocampista/Delantero) is likewise reused. **The exhaustiveness test must drive
   from the three field sets MINUS those six**, or it goes red on a correct implementation.
4. **`<md` column groups are a `ToggleGroup`, not Radix `Tabs`** — 2.7 decision 7's *"'team tabs' in
   the AC names the affordance, not the ARIA role"*. `ui/toggle-group.tsx` is vendored with
   radiogroup semantics and roving focus. The three labels are ruled verbatim in EXPERIENCE.md's
   i18n table: **En posesión / Sin posesión / Físico**.
5. **The sticky run is `team` + `shirt` + `player`**, `player` carrying `scope="row"`. A sticky column
   must be a leftmost *run* — sticking `player` alone while `team` and `shirt` scroll under it is
   broken. `position` scrolls with the data.
6. **Sticky headers land HERE, not in 2.11a**, and need a real scrollport. 2.11a filed the departure:
   `ViewDataDisclosure`'s region is a height-unbounded `overflow-x-auto`, so `position: sticky`
   silently never offsets there. The Expert tables own their own `max-h-[70vh] overflow-auto`
   container. Two mechanics that must be built, not assumed:
   - **`border-collapse` defeats a sticky header** — under collapsed borders the *table* paints cell
     borders, so the sticky `<th>`'s bottom border scrolls away. Use `border-separate
     border-spacing-0` with per-cell `border-b` and an **opaque** fill on every sticky cell.
   - **The corner cell** must be sticky on **both** axes at a strictly higher `z-index` (20 corner /
     10 header / 10 row-header / auto body) or body cells paint over header cells on diagonal scroll.
7. **The delimiter is ruled, not left to the browser.** DESIGN's `data-table.header-background:
   surface-raised` is a **1.00:1 NO-OP** here — `--surface-raised` and `--card` are byte-identical in
   both themes (`#171b1f` / `#ffffff`) and these tables sit on `--surface-raised`. A hairline is
   1.31/1.32. **Use `--surface-overlay` fill (1.12/1.14) PLUS a doubled bottom border**; neither
   alone reads. `--shadow-overlay` is the fallback **only** with a declared departure, since
   `globals.css` scopes shadows to *"true overlays"*.
8. **Expert tables are PRIMARY content, not behind "Ver los datos"** — the layer is already collapsed
   by default; a disclosure would put them two taps deep.
9. **Player names are plain text, never links.** `/players/{slug}` does not exist in `src/app/`, so a
   link 404s in the static export; UX-DR22's cross-link rule is scoped to **lineup** names, and that
   route ships in 2.15.
10. **No leader treatment. Declared departure from UX-DR7** — 2.10 decision 11's structural argument:
    the accent-plus-glyph treatment is a **head-to-head tile** pattern, and a 34-row table is not two
    compared values. Do **not** import `resolveLeader`.
11. **The empty state names DOMAIN G, not "the Expert Layer".** `players` is `PlayerRecords | null`,
    so the branch is reachable, and the generic *"El informe oficial no incluye esta sección."* would
    be a false statement over a report whose other pages are present. Override **both** copy halves
    (2.9 decision 4's mechanism). `[]` is **not** empty — it is `ready` with zero rows.
12. **`ExpertLayer` takes the whole `bundle` — a DECLARED exception** to the house rule that props
    are narrow and explicit (2.5 Task 5.1). It genuinely needs `players`, `metadata` and five
    `events` slices. State it in the docblock.
13. **`PendingSectionPanel`: KEEP, re-route the delete.** 2.10 decision 20 routes the keep-or-delete
    call here on the grounds that *"the Expert Layer (2.11) may want the same shell"*. **It does
    not** — the absence state is a real `EmptyStatePanel`. But deleting a component plus live locale
    keys is a change three exhaustiveness tests must be reasoned about. Keep both; record that the
    Expert Layer declined it; re-file.
14. **No skeleton and no `next/dynamic`.** The layer is collapsed at every width and lazy-mounts.
    `MomentumSection`'s is the codebase's only `next/dynamic` and is documented as its first.
15. **No nav, TOC or skip-link exists to register `#expert` in** — the app's only anchor is
    `SiteHeader`'s `#main-content`. Add none. The layer needs its **own** hash listener (mount-time
    read **plus** `hashchange`), because `TacticalLayer`'s `sectionIdFromHash` returns `null` for
    `#expert` by design.

### The speed-zone claim — corrected, and a fixture defect worth filing

`pipeline/extract/domain_g.py` ships a self-validation check `domain-g-zone-sum` asserting the six
zones sum to `totalDistance` within `ZONE_SUM_TOLERANCE_M = 0.35`, **corpus-verified worst drift
0.200 m over 3,289 rows**. **But the three fixtures break it on 79 of 96 rows, worst 4.400 m.** The
fixtures are not corpus-faithful for Domain G physical data.
**Render all seven values verbatim; derive nothing (AD-5); make no on-screen sum claim** while the
fixtures contradict the corpus. **File the fixture divergence** to 2.19 / 1.16 — it is a fixture
defect, not a rendering decision. (Also: `domain_g.py` records `goals <= attemptsAtGoal` as
corpus-FALSE on 4 of 104 reports — do not build a consistency affordance on it either.)

### Open question carried forward

**EXPERIENCE.md's Visualization Layering table assigns more at Expert altitude than AC 1 enumerates**
— *"underlying series in data table"* (momentum), *"Exact percentages and per-match splits in
tables"* (phases/pressing/blocks), *"Set-play log"*. Those are 2-10's four sections, each already
carrying a Tactical-altitude table. AC 1's five-log enumeration controls for 2.11c; whether these
four also surface at Expert altitude is **filed, not answered**.

### Performance note

34 players × 50 columns ≈ **1,700 cells** in one layer. **AD-4's 500 KB is a JSON *payload* budget
measured pipeline-side** and does not constrain render; the binding one is **NFR-1** (Lighthouse
mobile ≥ 90), verified in a later story. The defence is real — the layer is collapsed at every width
and lazy-mounts, so none of this renders on first load. **Measure and record; do not gate.** If NFR-1
later fails, the escape hatch is pre-authorised: `EXPERIENCE.md:107` bans infinite scroll *because*
*"the dataset is finite and **paginated/sectioned**"* — pagination is the sanctioned alternative.
Density moves behind disclosure, never deleted (SM-C2).

### References

`epics.md:845-848`, `:855-857` (the ACs); UX-DR6 (`epics.md:109`, Expert shell collapsed at all
widths), UX-DR17 (`:120`), UX-DR2 (`:105`), UX-DR19 (`:122`); `EXPERIENCE.md:45` (`#expert` anchor),
`:72` (collapsed-by-default, carries an `[ASSUMPTION]` tag), `:133` (the Expert-tables Responsive
row — **this story gets no "no row exists" departure**), `:207`, `:276` (the ruled group labels),
`:278` (the per-term minting procedure); `DESIGN.md` (the EXPERTO pill, `layer-gap`, `data-table`
tokens, the `--ink-muted` restriction); `prd.md` FR-23, SM-C2, FR-22; `ARCHITECTURE-SPINE.md` AD-5,
AD-7, AD-11; `contract/match-bundle.schema.json` `$defs.PlayerRecord` (+ `common.schema.json` for
`Count` / `Percentage` / `Metres` / `KmPerHour` and their `x-decimals`);
`deferred-work.md` grep `"kills all eleven Tactical sections"`.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List

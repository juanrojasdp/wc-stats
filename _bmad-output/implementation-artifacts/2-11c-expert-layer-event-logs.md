---
baseline_commit: 163fa20
---

# Story 2.11c: Expert Layer — Full Event Logs

Status: backlog

<!-- STUB. Created alongside 2.11a during the three-way split of epic Story 2.11 (ruled by Juan,
     2026-08-04). Everything below was MEASURED at that split and is carried forward so it is not
     re-derived. Run create-story on this key to finish it; do not start dev from this file. -->

## Story

As Diego,
I want the full event logs on the match page,
So that every marker and every connection the report carries is readable as text (FR-23, UX-DR16/18).

> **Depends on 2.11a** (the shared sortable `DataTable` and `TableColumn<Row>`) **and 2.11b** (the
> Expert Layer shell it mounts into).

## Acceptance Criteria (from `epics.md:848`)

**And** full event logs render: shot log, cross log, pass matrix, receiving log, defensive-actions log — the same tables that serve as the viz data-table alternatives (UX-DR18).

> **THE OPEN QUESTION THIS STORY MUST RESOLVE FIRST.** AC 1 says *"**the same tables** that serve as
> the viz data-table alternatives"*. Read literally that means **the same rendered instances**, not
> copies. If the Expert Layer re-renders each log while the viz disclosures keep theirs, the match
> page carries **eighteen duplicate tables** — the shot log twice, the cross log twice, both pass
> tables twice, both offers tables twice, both movement tables twice, the defensive log twice — at
> ~63-104 rows each on fixtures and ~153 rows/team for defensive at corpus density. It would also
> re-create, page-wide, the exact defect `ShotMapsSection` documents fixing: *"two panels on one page
> previously shipped two identical 'Ordenado por minuto.' captions, so a reader listing the page's
> tables got two indistinguishable entries."*
> **Three defensible resolutions, none yet ruled:** (a) the Expert log slots render **links** to the
> existing `#shot-maps` … `#defensive-actions` disclosures; (b) the viz disclosures are removed and
> the logs live **only** in Expert; (c) duplication is accepted and **every Expert instance mints a
> distinct caption key** so no two tables on the page share a caption. **Rule this before writing a
> line.**

## Carried-forward findings — measured at the split, do not re-derive

### The receiving log — ruled by Juan: apply FD-1 symmetrically

The ledger routes this story a claim that the receiving log is **unbuildable**
(grep `"Story 2.11's receiving-log AC is UNBUILDABLE"`). **That claim is true of the corpus and
FALSE of the build, and the story must not repeat it as written.**

- **Corpus:** Story 1.13 measured `ReceivingEvent` unfulfillable over 104 reports / 416 pages. The
  ledger says "all eight required fields"; **1.13's own Task 7.1 enumerates seven** — `teamId` is
  derivable from the per-team page anchor. The conclusion is unaffected: none of
  `EXPERIENCE.md:221`'s four columns (player, minute, coordinates, type) has a corpus source.
- **Fixtures:** `events.receiving` ships **270 events** (m001 87, m002 87, m074 96) with **all eight
  fields non-null on 270/270 rows**. Every one of those four columns has a source in the data the app
  renders **today**.

**RULED (Juan, 2026-08-04): build the log behind `anyReceivingEvents(events.receiving)`** — the same
three lines as the shipped `anyExpectedGoals` (FD-1) and `anyContestType` / `anyPlayerName` /
`anyMinute` gates. It renders on fixtures, **self-removes on corpus data**, and AC 1's fifth log is
satisfied **by construction** with no re-scope, no waiver and no duplicate of 2.9's aggregate tables.
The earlier draft's asymmetry — a presence gate for xG and for three defensive columns, but outright
deletion for receiving, which has *better* data — was the thing to fix.
**Say "unpopulatable on corpus data; fixture-only today", never "unbuildable".** A dev runs
`jq '.events.receiving | length'` and gets 87 in thirty seconds.
**Also keep 2.9's aggregate tables** (decision 19 parity — a per-player table alone does not satisfy
UX-DR16 for a team-level figure). And **file**: the contract's `ReceivingEvent` description is stale,
still claiming *"Story 2.9 renders `#offers-to-receive` and `#movement-to-receive` from the same
array"*, which 2.9 reversed. `/contract` is not edited here.

### The defensive-actions log — the absent columns are REMOVED, not em dashes

A **correction** to the routing brief. 2.9's code review extended the FD-1 gate from `anyContestType`
to **all three** absent-on-corpus fields. Import `anyContestType`, `anyPlayerName`, `anyMinute` from
`defensive-actions-model.ts`; do not re-derive them.

- **Corpus:** `playerId` / `playerName` / `at` have **no carrier at all**; `contest_type` is null on
  **20,169/20,169**. All three columns vanish and the caption swaps to
  `viz.defensiveActions.tableCaptionNoClock` (*"Ordenado por equipo; el informe no registra el
  minuto."*).
- **Fixtures:** all three gates return **true** — 237/237 rows carry `playerId`, `playerName` and
  `at`; 60/237 carry `contestType`. **So the corpus-real shape is exercised by constructed tests
  only, never by a fixture render.** Write the constructed test; 2.9 documented this exact trap.
- Only **two of four** `DefensiveActionType` values are plottable (`block` and `possession-contest`
  have no coordinates anywhere), but **all four are labelled** in both locales — deliberately, since
  the log may carry them.

### FD-1 and the xG column

Per-shot xG does not exist in the source (team totals only), so the shot log **omits the xG column**
while `ShotEvent.expectedGoals` is `null`; the nullable slot stays as the forward-compatible landing
zone. **Measured: 0 of 70 fixture shots carry a non-null value**, so `showXg` is `false` on every
fixture today and the gated `<td>`'s fallback is unreachable from any fixture. Reuse
`anyExpectedGoals`; never mint a second xG gate. (Team xG **is** read from `keyStatistics` — that is
a real artifact total.)

### The row models, and the one 2.11a fixes

| model | minute fields | note |
|---|---|---|
| `ShotLogRow` | `number` via `?? 0` → **2.11a changes to `number \| null`** | the last one still wrong |
| `CrossLogRow` | `number \| null` via `?? null` | already correct — the ledger's "does the same" is stale |
| `DefensiveLogRow` | `number \| null` | fixed by 2.9's review, with a docblock naming 2.11 as owner |

**None of the three carries the raw `at` object** — only flattened fields plus a pre-formatted
`minuteLabel` (`"90+2′"`), which is **not sortable**. That is why 2.11a's `TableColumn.sort` for a
clock column must compute `minute * 1000 + (stoppageMinute ?? 0)` with `null` when `at` is absent,
and why the `?? 0` had to go: it would have ordered every clock-less corpus row as minute 0,
silently, pinned green by fixtures that populate `at` on 100% of rows.

Default orders already shipped and stated in captions — **do not change them** (AD-5: canonical order
comes from the artifact):
- shot / cross / defensive logs: minute, then home before away (`orderByMinute` + `sideRank`)
- pass nodes: side then shirt ascending; pass edges: side then volume **descending**
- offers / movement: team then shirt number

### Caption discipline

`viz.table.caption` is literally *"Ordenado por minuto."* / *"Sorted by minute."* and is a **false
claim** on every clock-less table. Five tables already mint their own caption keys to avoid it, and
`#defensive-actions` selects its caption **conditionally**. Any new Expert instance must state its
own real order. Two existing keys are byte-identical strings under different names
(`viz.offers.tableCaption`, `viz.movement.tableCaption`) — a dedupe candidate, not a defect.

### Density at real data

The defensive log is the one that grows: corpus **min 62 / median 97 / max 153 markers per team
figure** over 208 team-innings, against the fixtures' **30-59 per team** (63-104 per match). Filed
for 2.19. The map's phone-density collapse is a separate, already-filed 2.19 item; the **log** is
unaffected by clustering but not by DOM weight.

### Standing rules this story inherits

- Player names **plain text, never links** — `/players/{slug}` ships in 2.15.
- **No `aria-pressed`**; sort state is `aria-sort` (2.11a decision 10).
- Every entry point guards `null` **and** `[]`; `[]` is `ready` with zero rows, and a team with no
  rows gets a dedicated zero line **naming the absence**, never zeros.
- `@/lib/format` **throws on non-finite input** — and unlike Domain G, these logs carry nullable
  `x` / `y` / `expectedGoals`. 2.9's review found the live consequence: a `formatDecimal` throw
  inside a lazily-mounted disclosure fires when the reader opens "Ver los datos". **Guard at model
  entry, fail loud on load.**
- `src/viz/**` is pure — returns `DictionaryKey`s and raw numbers; components resolve them.

### References

`epics.md:848` (the AC); `EXPERIENCE.md:207` (the Expert-layer log list), `:221` (*"Receiving log
table (player, minute, coordinates, type)"*), `:115`; UX-DR16 (`epics.md:119`), UX-DR18 (`:121`);
`deferred-work.md` grep `"Story 2.11's receiving-log AC is UNBUILDABLE"`, `"Rendering decision FD-1"`,
`"only two of four"`; story **2.9** (the aggregate re-scope, decision 11's table parity, Task 8.6
which routes this AC here by name), story **1.13** (the receiving probe).

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

### File List

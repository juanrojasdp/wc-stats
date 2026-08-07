---
baseline_commit: 119b707d9cf1ba613d51c487557f3dc2d24c4b9f
---

# Story 2.15: Player Profile

Status: done

**Baseline:** `5d251bb` (verified HEAD at creation). **Scope: `app/` + the two locale files + `EXPERIENCE.md`'s policy table + the two ledger artifacts.** Nothing under `pipeline/`, `contract/`, or `data/`.

---

## Story

As Diego,
I want any player's aggregated stats, physical profile, per-match series, and trends,
so that I can track a player across the whole tournament (FR-27).

---

## Acceptance Criteria

Verbatim from `_bmad-output/planning-artifacts/epics.md:919-939`:

> **Given** `player-profiles/{player-id}.json`
> **When** `/players/{player-slug}` renders
> **Then** headline aggregates lead (hero altitude), cross-match trend charts follow (recharts, `viz-single` series), and full per-match tables close (profile disclosure grammar) — all values verbatim from the artifact, aggregation never client-side (AR-5, UX-DR18)
> **And** the physical profile shows speed zones 1–5, high-speed runs, sprints, and top speed.
>
> **Given** per-match rows
> **When** the user taps any value
> **Then** it navigates to that Match Dashboard anchored to the relevant section, auto-expanding it (UX-DR22)
> **And** a "Comparar" action deep-links `/compare?type=players&a={slug}` (FR-29 entry).
>
> **Given** the build
> **When** routes generate
> **Then** every player in the route manifest pre-renders with name + team `<title>`/OG meta (NFR-4).

Numbered for task mapping:

1. `/players/{slug}` renders from `player-profiles/{playerId}.json` in disclosure-grammar order — headline aggregates at hero altitude, cross-match trend charts second, **full** per-match tables last. Every value verbatim; no client-side aggregation.
2. The physical profile shows speed zones 1–5, high-speed runs, sprints, and top speed.
3. Tapping any per-match row value navigates to that Match Dashboard, anchored and auto-expanded.
4. A "Comparar" action deep-links `/compare?type=players&a={slug}`.
5. Every player in the route manifest pre-renders with name + team `<title>` **and OG** meta.
6. **(Routed here by name, not from the epic.)** The recharts vendor-chunk duplication is fixed, and the win is **measured on the built export**. 2.13 ruling 2: *"The recharts vendor-chunk fix → Story 2.15. Its AC declares recharts by name … so 2.15 is the genuine third importer and the first story that can verify the win on its own route."*

---

## READ THIS FIRST

**1. Your input artifact is being rewritten right now.** Story 1.18 (`review`) owns `data/fixtures/index/player-profiles/` and has **1,296 uncommitted artifacts** under `data/index/`. Story 1.17 (`review`) owns the route manifest. At `5d251bb` the fixture manifest lists **one** player; the working tree lists **two**. **Re-run every count in §Data Reality before designing against it.**

**2. `app/` is contested by Story 2.14 (`in-progress`).** Modified at creation: `SiteHeader.tsx`, `TournamentHubRegion.tsx`, `use-glossary-popover.ts`, `hub-model.ts`, `format.ts`, `package.json`, `package-lock.json`, **`es.ts`, `en.ts`, `i18n.test.ts`, `static-output.test.ts`** — the last four are files **this story must also edit**. Untracked: `HeaderSearch.tsx`, `HeaderSearch.test.tsx`, `ui/dialog.tsx`, `search-model.ts`, `tournament-index.ts`.
**Every shared-file edit is APPEND-ONLY. Never `git add -A` — commit by explicit path. Cite ledger and spec entries by a short quoted fragment, never by line number** (ledger line numbers drift; several anchors quoted in earlier stories no longer match exactly).

**3. Four of the five per-match deep links you build will 404 on the fixture tree, and that is expected.** `quinones-julian-mex.matches[]` = `m001, m028, m053, m079, m092`. `data/fixtures/index/tournament.json.entities.matches` = `m001, m002, m074, m082`. **Only `m001` resolves.** Verify AC 3 against `m001` and disclose the rest; do not "fix" it, and do not assert all five in a test. It resolves at real data (104 bundles).

---

## Ruled Decisions

### D1 — One lazy boundary, not a re-export module. The recorded remedy misdiagnoses the cause.

**Baseline, reproduced live at creation** against `app/out/_next/static/chunks`:

| Size | Chunk | What it is |
|---|---|---|
| 300.4 KB | `4035807z_nmpd.js` | recharts **vendor** — `CartesianAxis`, `ReferenceDot`, `LabelList`, `Brush`, `redux` |
| 300.4 KB | `2dgghmp7zldth.js` | recharts **vendor** — the same internals again |
| 47.2 KB | `34-mbdb7vpaam.js` | `MomentumChart` leaf |
| 34.5 KB | `3c3bopdas9l-q.js` | `TacticalCharts` leaf |

> ⚠️ **`CartesianAxis` alone does not identify a vendor chunk** — the 34.5 KB `TacticalCharts` **leaf** contains that string too. Discriminate on **`CartesianAxis` AND `Brush` AND `redux` together**; today exactly the two 300.4 KB chunks match, and the leaves carry zero `Brush`/`redux`.

**Why the ledger's remedy — *"a single shared re-export module that both leaves import"* — is insufficient as written.** Both leaves already import the **identical bare specifier** `"recharts"` (`MomentumChart.tsx:4-13`, `TacticalCharts.tsx:4`). Module identity was never the problem. **The duplication is per async chunk group**, and there are two groups because there are two distinct `dynamic()` **import specifiers**. A barrel both leaves import leaves both groups intact.

**The converse is proven in-repo.** `PhasesSection.tsx:80-93`: *"Both handles share one chunk: `next/dynamic` dedupes on the import specifier, so this costs nothing at the network layer."* Five `dynamic()` handles across three files point at `@/components/TacticalCharts` and produce **one** group.

**RULED: create `app/src/components/Charts.tsx` — a `"use client"` barrel re-exporting every recharts leaf — and point every `dynamic()` call site at that ONE specifier.**

```tsx
// app/src/components/Charts.tsx
"use client";
export { MomentumChart } from "@/components/MomentumChart";
export { DistributionChart, InvolvementChart } from "@/components/TacticalCharts";
export { TrendChart, SpeedZoneChart } from "@/components/ProfileCharts";
```

**Both new charts (D6's `TrendChart` and D7's `SpeedZoneChart`) live in one new leaf `ProfileCharts.tsx` and are exported through the barrel. This is not optional and not a judgement call — a chart reached by any other specifier mints the fourth chunk group AC 6 exists to remove.**

Call sites to migrate (four lexical sites, five handles):

| File | Current specifier | New |
|---|---|---|
| `MomentumSection.tsx:68` | `@/components/MomentumChart` | `@/components/Charts` |
| `GoalkeepingSection.tsx:77` | `@/components/TacticalCharts` | `@/components/Charts` |
| `PhasesSection.tsx:96` (factory, 2 handles) | `@/components/TacticalCharts` | `@/components/Charts` |
| `PressingSection.tsx:78` (factory, 2 handles) | `@/components/TacticalCharts` | `@/components/Charts` |

Each keeps its own `loading` fallback and `ssr: false`; preserve the one-handle-per-height factories.

**You are licensed to touch `MomentumChart.tsx` / `MomentumSection.tsx` / `TacticalCharts.tsx`** — they were on 2.10's do-not-touch list, which 2.13 discharged by routing the fix here. Correct the now-false docblocks in both chart files.

#### The cost is real and lands partly on the Lighthouse-gated route. Measure it; do not hand-wave it.

`ALWAYS_EXPANDED_SECTION_IDS = ["key-stats", "momentum"]` (`tactical-sections.ts:48`), and `MomentumSection.tsx:43-44` says so: *"`momentum` is in ALWAYS_EXPANDED_SECTION_IDS, so it gets NONE of UX-DR6's lazy-mount deferral."* So `MomentumChart`'s `dynamic()` fires on **every** Match Dashboard mount, at every width.

| Scenario | Today | After |
|---|---|---|
| Match page, `<lg`, reader opens nothing | vendor + Momentum leaf | vendor + **all** leaves (+~35 KB + `ProfileCharts`) — **a regression** |
| Match page, `≥lg` (Tactical sections default open, so phases/pressing/goalkeeping charts mount) | **two** vendors + 2 leaves | **one** vendor + all leaves — **−300.4 KB** |
| Match page, `<lg`, reader opens any second chart section | two vendors | one vendor — **−300.4 KB** |
| `/players/{slug}` | n/a | one shared vendor instead of a third — **−300.4 KB** |

**Acceptance is a measured three-scenario report, not a single number.** Record all four rows above with real bytes. NFR-1's Lighthouse ≥ 90 gate covers **Match Dashboard and Tournament Hub only** (`epics.md:67`) — `/players/{slug}` is not gated, which is exactly why the mobile match-page regression is the number that matters.

**If the `<lg` match-page regression exceeds ~40 KB gzip, stop and report before proceeding.** Escape hatch to investigate in that case: a Turbopack chunking/`cacheGroup`-equivalent that forces a shared recharts chunk without collapsing the groups. Do not adopt it unmeasured.

**Verification command** (run before and after):

```bash
cd app && python -c "
import os,glob
for f in sorted(glob.glob('out/_next/static/chunks/*.js')):
    s=open(f,encoding='utf-8',errors='ignore').read()
    if 'CartesianAxis' in s:
        kind='VENDOR' if ('Brush' in s and 'redux' in s) else 'leaf'
        print('%8.1f KB  %-8s %s'%(os.path.getsize(f)/1024, kind, os.path.basename(f)))
"
```

**Pass = exactly ONE chunk classified `VENDOR`.** Leaves may be several.

### D2 — The per-match table uses ONE `RowAnchor` per row to `/matches/{matchId}/#expert`. Not thirteen cell links.

**The anchor target.** `#expert` is deliberately **not** a `SectionId` (`tactical-sections.ts` closes it at eleven; `TacticalLayer.tsx:58-62`'s `sectionIdFromHash` returns `null` and its caller early-returns). `ExpertLayer.tsx:226-249` owns its own listener, and it is **whole-string equality** on `window.location.hash === "#expert"` — `#expert-content` or anything finer is silently ignored:

```tsx
  /*
   * ITS OWN HASH LISTENER. `TacticalLayer`'s `sectionIdFromHash` returns null
   * for "#expert" BY DESIGN — do not extend it …
   * The MOUNT-TIME READ is load-bearing, not belt-and-braces: this layer is
   * client-only under AR-11 and mounts inside MatchBundleRegion's loaded
   * branch, so the browser has already abandoned a "#expert" deep link by the
   * time the target exists.
   */
```

**RULED: the href is `` `${matchHref(row.matchId)}#expert` ``.** The trailing slash before `#` is mandatory (`trailingSlash: true`; `hub-model.ts:135-145` emits it, and a slash-less href is rewritten at request time and loses the fragment).

**Why `#expert` and not a Tactical section:** all sixteen `PlayerMatchRow` fields are Domain G **per-player** fields, and the Expert Layer's Table 1 (46 Domain G data columns per player) is the only Match Dashboard surface carrying that player's own numbers. `#shot-maps` would land the reader on a **team-level** map that does not show the number they tapped.

**RULED: one `RowAnchor` per row, not one link per cell.** Reuse the shipped 2.12 pattern verbatim — `TournamentHub.tsx:93-136`: an anchor carrying `after:absolute after:inset-0` over a `<tr className="relative">` (via `DataTable`'s `rowClass`), plus an `sr-only` `accessiblePrefix`. **The whole row becomes the tap target**, which is what AC 3's *"tapping any value"* actually asks for.

Thirteen per-cell links were considered and rejected on four independent grounds:

- **2.13 ruling 3 drew a line this story must not cross silently:** *"A leaderboard row is therefore on the same footing as a lineup name, **not the same footing as a pass-network node or an Expert table cell**."* 2.11b ruled table cells plain text.
- **Link purpose in context (WCAG 2.4.4):** thirteen links per row, same href, different visible text.
- **Keyboard cost:** 8 rows × 13 anchors ≈ **104 tab stops in one table**, with no bypass.
- **`text-accent-cyan` is both the house link colour** (`AttributionFooter.tsx:26`, `ExpertLayer.tsx:963`) **and `DataTable.tsx:114`'s active-sort head cue** — thirteen cyan cells per row erase the sort cue.

**Open ledger item this triggers, and you own it:** *"the row-link focus ring paints on the ANCHOR's box, not on the row … Owner: whichever story rules the linked-row pattern."* You are ruling the linked-row pattern on a second surface. Address it or restate it with evidence.

**The hashchange no-op defect does not bite here** — but not for the reason it might seem. Every row's href is distinct (`matches[]` is one row per match), and a `next/link` navigation to another route is a **soft App Router navigation** in which `ExpertLayer` unmounts and remounts inside `MatchBundleRegion`'s loaded branch, so its **mount-time** `openFromHash()` fires regardless of whether `hashchange` does.

### D3 — `perNinety` is NOT rendered on this route.

Not named in the AC. The denominator explodes: **62 players have 1–14 minutes**; corpus maximum `perNinety` is **104,139.0** (`stewart-ross-sco`, `totalDistance`, 1,157.1 m over **1 minute**); `henderson-jordan-eng` reads value **1,790.7** / perNinety **26,860.5**. A minutes threshold would be a product rule this story does not have; unsuppressed it puts a six-digit number beside a four-digit one.

**RULED: no `perNinety` anywhere on `/players/{slug}`.** The field stays in the artifact untouched. File the deferral with these numbers; owner = whichever story first needs a rate.

**Objection recorded:** per-90 is arguably the most analyst-useful column on a profile, and dropping it thins FR-27. The counter is SM-C2 (depth behind disclosure, not deleted) and that a rate with an unruled denominator policy is worse than no rate. If review overturns, the remedy is a ruled minutes floor **plus copy**, not a bare column.

### D4 — Zero-valued appearances render as real zeros. Two distinct cases, both ruled.

**(a) `minutesPlayed: 0` with `played > 0`** — 20 players, filed by 1.18 with this story named owner. 1.18's ruling: *"`0` is the honest floor."* **RULED: render verbatim through the same integer formatter as every other minutes cell. No `<1`, no dash, no footnote.** AR-5 requires verbatim; `<1` is a client-side reinterpretation; and the em dash is the **missing-data** glyph — `MomentumSection.tsx:284-290`: *"The em dash is this codebase's missing-data glyph and asserted absence of information where the information exists."*

**(b) `passCompletion: 0.0` meaning "attempted no passes"** — 1.18 ruled `Σ passesAttempted == 0 ⇒ value 0.0, aggregation "average", perNinety null`, true for **17 players and 52 emitted match rows**. This renders as `0,0 %`, which reads as *"completed none of many"* rather than *"attempted none"*. **RULED: render the `0,0 %` verbatim, and let the adjacent `passesAttempted: 0` in the same row carry the disambiguation** — the per-match table renders both columns, so the honest reading is available without minting an interpretive gloss. **In the hero tile and the aggregates table, where `passesAttempted` is not adjacent, this is a real ambiguity: file it, do not paper over it.**

D3 moots the null-`perNinety` half of the 0-minutes ledger item; close its minutes half and note the `perNinety` half travels with D3.

### D5 — Hero carries four selected aggregates. All eighteen stay on the page. Units ride the row-header label.

AD-5 permits *"filter, select"*; selecting a hero subset is legal, deriving one is not.

**RULED: hero tiles = `goals`, `topSpeed`, `totalDistance`, `passCompletion`, plus an appearances line** from `appearances{played, started, substituteAppearances, minutesPlayed}`. **All eighteen `aggregates[]` rows render in a `DataTable` in artifact order** — SM-C2 forbids deleting depth to tidy a hero.

**The aggregates table is TRANSPOSED, so 2.13's unit ruling cannot apply as written.** 2.13/2.11b ruled *"the unit goes in the COLUMN HEAD, never per-cell"* — but eighteen metrics spanning Count, Metres, KmPerHour and Percentage share **one** value column, so there is no head that can carry a unit. **RULED: the unit rides the metric label in the row-header cell**, composed as a **string** on `KeyStatisticsSection.statLabel()`'s pattern (the same one `StoryStatTiles.tsx:112-120` uses):

```ts
const label = `${t(leaderboardMetricKey(code))} (${t(leaderboardUnitKey(unit))})`;
```

Percentage metrics take **no** unit suffix — `formatPercent` appends `%` itself with no space (a deliberate, logged choice against RAE spacing). Composing in JSX as `{t(a)} ({t(b)})` emits literal `" ("` children and **fails the i18n gate**.

**The artifact repeats four values on purpose; render them, do not dedupe.** `totalDistance`, `topSpeed`, `highSpeedRuns` and `sprints` appear in **both** `aggregates[]` and `physical{}`. **RULED: `physical{}` is the source for the physical section; `aggregates[]` is the source for the aggregates table; the hero tiles read `aggregates[]`.** Deduping would be a client-side edit of a verbatim surface (AR-5). The repetition is an artifact property.

**Build a new `ProfileStatTiles.tsx`; do not extend `StoryStatTiles.tsx`.** `EXPERIENCE.md:73` spec's the stat tile for *"Hero Story Stats, profiles, comparison"*, but its head-to-head clauses (two values, accented leader, ▲ glyph, sr-only «líder») exist only in head-to-head context. A single-entity profile has **no leader**: **no ▲ glyph, no side accent, no `resolveLeader`.** Copy the token recipe verbatim:

| Element | classes |
|---|---|
| Grid | `mt-5 grid grid-cols-2 gap-tile-gap` |
| Tile card | `rounded-md bg-surface-raised p-3` (+ `col-span-2` when wide) |
| Tile label | `type-stat-label text-center text-ink-secondary` |
| Value | `type-stat-value text-ink-primary` + `tabular-nums` |
| Caption / code | `type-label-caps text-ink-secondary` |

**The tile is not a tap target** (`EXPERIENCE.md:73`). The only focusable thing inside is a `GlossaryTerm`.

### D6 — One trend chart with a `ToggleGroup` metric selector.

The artifact carries **six** trend series in fixed order: `ballProgressions`, `goals`, `passCompletion`, `passesCompleted`, `topSpeed`, `totalDistance`.

**RULED: one `TrendChart` (single-series) plus a `ToggleGroup type="single"` selecting the series. Default = the artifact's first series (canonical order, AR-5).** Six simultaneous `ResponsiveContainer`s — six recharts instances and six figure landmarks on one route — rejected.

**`ToggleGroup` is the only vendored selector.** `app/src/components/ui/` holds exactly seven files: `button`, `card`, `dialog`, `dropdown-menu`, `popover`, `toggle`, `toggle-group`. **No `tabs.tsx`, no `select.tsx`, no `slider.tsx`**; `grep -rn 'role="tab"' app/src/components/` returns nothing. **Do not vendor a new primitive.** Semantics are `role="radiogroup"` / `role="radio"` + `aria-checked` (`ui/toggle-group.tsx:10-16`), **not** tablist/`aria-selected`.

Four non-negotiables at every shipped call site (`ExpertLayer.tsx:766-815`, `PitchPanel.tsx:1160-1188`, `SiteHeader.tsx:86-110`):

1. `type="single"` + controlled `value` / `onValueChange`;
2. **the empty-string guard** — Radix emits `""` when the active segment is re-clicked; the active option must not be deselectable;
3. `aria-label` from a locale key, never a literal;
4. `min-h-11 min-w-11` on each **item** — UX-DR15 is ≥44×**44**, and `min-h-11` alone is height only.

**Axis rules.** `matches[]` never exceeds **8** entries corpus-wide, so plot every match with no tick thinning. **x-tick label = the opponent's team code** (`opponent.id` → code), which is the only per-point label that is meaningful across all six metrics. **Ticks per metric family**, because the six series span four unit types: `percentTicks`/`percentAxisMax` for `passCompletion`; `countTicks`/`countAxisMax` for `goals`, `passesCompleted`, `ballProgressions`; **a new decimal-aware generator** for `topSpeed` (km/h, ~25–36 range, 1 dp) and `totalDistance` (metres, thousands) — a count-floored generator compresses a 30–36 km/h series into one or two ticks. Property-test it on `momentumYTicks`' model.

**The data-table alternative behind `ViewDataDisclosure` carries all six series, not just the charted one** (NFR-2: the text alternative renders the same artifact slice).

### D7 — Physical section: a single-series zone chart plus three tiles. New height helper.

**RULED:** `distanceZone1..5` render as a single-series bar chart in metres, with the band descriptors as `headTitle` / axis context. `highSpeedRuns`, `sprints`, `topSpeed` render as three tiles beside it. Data-table alternative via `ViewDataDisclosure` with `surface="canvas"` and the attribution as `trailing`.

**Do not reuse `distributionChartHeightClass`** — `phases-model.ts:373` accepts only `3 | 4 | 8 | 9` with an exhaustive `never` throw, and a five-zone chart throws at runtime. Add a sibling returning **literal, statically-written** Tailwind classes with its own `never` default.

**The zone sum does NOT equal `totalDistance`.** 1.10's tolerance is `|total_distance − Σ(distance_zone_1..5)| <= 0.35` m (worst observed 0.200 m across 3,289 rows). **Never render a zone-derived total, never assert equality in a test, never present the chart as a decomposition of `totalDistance`.**

**Band descriptors already ship — reuse, do not re-mint:** `expert.fieldTitle.distanceZone1..5` = `"0-7 km/h"`, `"7-15 km/h"`, `"15-20 km/h"`, `"20-25 km/h"`, `"25 km/h o más"`.

### D8 — The artifact is TOTAL in shape. Branch on emptiness for rendering, never on shape for structure.

1.18 R2 shipped totality on all 1,248 files: every player carries **all 18 aggregates** and **all 6 trend series**, including the **209 zero-appearance players (16.7%)** whose values are all `0` and whose `trends[].points` and `matches[]` are `[]`.

**RULED:**

- **Never write a structural branch on shape** — no `if (aggregates.length === 0)`, no `if (trends.length < 6)`, no per-position column sets. 1.18 rejected non-total artifacts precisely so the App has no such branch: *"it re-introduces the branch the totality argument exists to remove, and 16.7% of files is not an edge case the App may treat as one."*
- **DO branch on emptiness for section rendering** — `matches.length === 0` and `points.length === 0` render an `EmptyStatePanel`. That is not a shape branch; it is UX-DR13, and `EXPERIENCE.md` now scopes the panel to *"Any missing section on any surface — Match Dashboard (FR-22), Profiles, Comparison"*, occupying the slot *"never a silent absence, never layout collapse."*
- **Aggregates and physical print their zeros.** `ExpertLayer.tsx:392-397` governs: *"NO PRESENCE GATE AND NO EM DASH, ever. Domain G has zero nullable leaves … a zero is a real, dense measurement … Print it."*
- **No ruled copy exists for the profile empty state.** State Patterns rules only Match Dashboard / momentum / comparison / 404 / fetch-failure. Author it under Voice and Tone, **append** a policy-table row (rows are appended, never renumbered), and flag it in Completion Notes as **`PROPOSED — Juan to confirm or overturn at review`**, per 2.12's and 2.18's precedent.

`acevedo-carlos-mex` (the zero-appearance goalkeeper) is the fixture for this path.

### D9 — `<title>` **and `openGraph`** composed by a pure helper.

AC 5 forces the question 2.18 and 2.13 both refused and 2.12 took. Follow 2.12's precedent (data-bearing routes export metadata; `/about` and `/glossary` deliberately do not).

`matches/[slug]/page.tsx:22-51` states the binding rule: **the title string MUST be built by a pure helper, never inline** — *"the i18n lint gate flags any template/concat that is the direct value of a `title:`/`description:` property."* Mirror `composeMatchTitle`; put `composePlayerTitle()` in **`src/lib/match-hero.ts`'s sibling position — a new `src/lib/player-profile.ts`** (it must be server-importable, so not `src/viz/**` and not a `"use client"` module).

**Return `{ title, description, openGraph: { title, description } }`** — a `description` alone emits no OG tags, and AC 5 says OG. **No `og:image`** (AR-11, zero external requests). Content = **player name + team**. The `name` is source-passthrough English (AD-7) and renders untranslated in both locales.

`generateMetadata` is the **one** place a server `t()` from `@/lib/i18n` is correct. Record in Completion Notes that this route **inherits** the unruled `<title>`-language ledger item (owner: Juan, currently unfiled under 2.12) — **do not file a duplicate**.

### D10 — `generateStaticParams` maps the manifest 1:1 with NO existence filter.

**RULED:** `readTournament().entities.players.map((p) => ({ slug: p.playerId }))`, plus `export const dynamicParams = false` — the `matches/[slug]` shape exactly. **Do not filter on artifact existence.** AD-4's bijection is pipeline-asserted (*"one profile artifact per listed entity — empty sections allowed, absence not"*); a filter converts a real pipeline breach into a silently missing route.

**Next 16 route signatures** (`matches/[slug]/page.tsx:18, 29-34, 53-58`): `generateStaticParams` is **synchronous**; `generateMetadata` and the page component both receive `params: Promise<{ slug: string }>` and must `await` it.

`readPlayerProfile(playerId)` goes in `build-data.ts` beside its siblings and **fails loud twice**: the existing not-found throw, plus a `schemaVersion` gate on `readLeaderboards`'s pattern.

**`playerId` is the slug (AD-3); no `encodeURIComponent`** — `hub-model.ts:163-182` records that `common.schema.json` constrains it to `^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$`, **0 violations across all 1,248 real ids**. Use the shipped `playerHref()` / `matchHref()` / `teamHref()`; **never interpolate a route inline** — that is the failure `hub-model.ts:135-145` exists to prevent.

**Three surfaces interpolate `/players/` inline today and all three become live links when this route ships:** `LineupsDisclosure.tsx:34`, `LeaderboardsSection.tsx:200`, `LeaderboardsRegion.tsx:424`. Switch all three to `playerHref()`.

### D11 — This story opens `TacticalCharts.tsx`, so it inherits that file's filed defect.

2.13 filed and re-verified that `InvolvementChart` ships the **unfixed, edge-drawn** copy of the Team B hatch `<pattern>` (`x1={0} x2={0}` where `DistributionChart` centres at `HATCH_TILE_PX / 2`), producing a clipped 0.75px stripe. Owner: *"whoever next opens that file."* That is you. **Fix it and verify the stripe in a browser in both themes.**

**NOT yours, explicitly routed away:**

- **The Team B non-hue channel → 2.16 / 2.17.** 2.13 ruling 2: *"2.15 is `viz-single` — single-series — so it needs no second channel at all."* **Do not build a hatch pattern for your own charts.**
- **`seriesLabelIndex`'s all-equal-series overlap** → *"the first successor story to reuse `DistributionChart`"*. You do not reuse it. Leave it routed.

### D12 — Reuse. Almost nothing needs minting, and six terms you might think are yours already ship.

**The six policy rows 2.18 recorded as not-yet-used are, in fact, already shipped as per-surface keys by 2.11b and 2.18:**

| Term | Where it already lives |
|---|---|
| speed zones (band descriptors) | `expert.fieldTitle.distanceZone1..5` — `"0-7 km/h"` … `"25 km/h o más"` |
| speed zone labels | `expert.field.distanceZone1..5` — `"Zona 1"` … `"Zona 5"` |
| high-speed run + `"CARR. ALTA VEL."` | `expert.field.highSpeedRuns`, `expert.fieldAbbr.highSpeedRuns` |
| sprint | `expert.field.sprints` = `"Sprints"` |
| take-on | `expert.field.takeOns` = `"Regates"` |
| step-in | `expert.field.stepIns` = `"Irrupciones"` |
| positions | `enums.position.{gk,df,mf,fw}` = Arquero / Defensa / Mediocampista / Delantero |
| duels | `expert.field.duelsWon*` — e.g. `"Duelos aéreos ganados"` |

`es.ts` warns in place that *restating those labels would be two sources for one term.* **RULED: reuse every one of them. Mint nothing for these.** The glossary already carries the terms; 2.18's dead-key prohibition cuts against minting, not for it.

**Reuse list:** `viz.table.{player,team,shirt,position,unknown}`, `enums.position.*`, `enums.stage.*`, `enums.unit.{km,m,kmh}`, `enums.leaderboardMetric.*` / `enums.leaderboardMetricAbbr.*` (both `Record<MetricCode, …>` — full coverage of all 18 player-scope codes), `expert.field.*` (40 keys) / `expert.fieldTitle.*` (7) / `expert.fieldAbbr.*`, `viz.viewData` / `viz.hideData`, `viz.attribution`, `viz.table.sort*`, `hub.standings.rowLink`-style row-link prefixes.

**`enums.metric` is SEALED** — `i18n.test.ts` pins it exactly to `KEY_STAT_FIELDS` (19 Domain B fields) and `tactical-sections.ts` is do-not-touch. **Never add Domain G labels to it.**

**`attemptsAtGoal` and `passesAttempted` are NOT `MetricCode`s** (1.18). Labels come from `expert.field.*`.

**Five `PlayerMatchRow` fields have no existing key and are genuinely yours to mint:** `minutesPlayed`, `stage` (the value maps via `enums.stage.*` but the **column head** does not exist), `date`, `opponent`, `started`. Put them in the new `player` namespace.

**Mint only what this route renders.** Append one `player` namespace at the tail of `es.ts` (canonical), then mirror in `en.ts` — **after 2.14's `search` namespace**, append-only. Register: *"tuteo, neutral LatAm, no exclamation marks."*

**No glossary marking inside a sortable head** — 2.13: *"structurally invalid — `glossary.ts` bans nesting a focusable trigger inside `<button aria-expanded>`."* **No dotted underline where no popover opens** (2.5 decision 8).

---

## Route Composition (resolves the section-order ambiguity)

Disclosure grammar, `EXPERIENCE.md:209`: *"Profiles and the Hub apply the same grammar at smaller scale: headline aggregates first (hero altitude), tactical identity/trend visualizations second, full per-match tables last."*

**RULED order for `/players/{slug}`:**

1. **Hero (pre-rendered, build-time)** — `sr-only <h1>`; visible identity block (**the player's name renders visibly** as a `type-title` heading, with shirt-number badge, position and a `teamHref()` link); appearances line; four `ProfileStatTiles`; the "Comparar" action.
2. **Physical profile** (`<h2>`) — zone chart + three tiles + data table.
3. **Trends** (`<h2>`) — one chart + `ToggleGroup` + data table (all six series).
4. **Aggregates** (`<h2>`) — the 18-row `DataTable`.
5. **Per-match** (`<h2>`) — the full `matches[]` `DataTable`, last.

**There is no collapsible section shell on this route.** `TacticalSection` is do-not-touch and its `id` prop is typed to the closed eleven-member `SectionId`; `ViewDataDisclosure` is the **viz-alternative** control, not a section shell; and 2.11b ruled Expert tables are *not* behind "Ver los datos". Sections 2–5 are plain `<section>` + `<h2>` blocks in normal flow, each with a stable `id` for anchoring. **Do not widen `SectionId` and do not build a second expansion model.**

**AC 1 says "full" per-match tables — render all sixteen `PlayerMatchRow` fields.** `matchId` is the link target rather than a column; the other fifteen render: `stage` (via `enums.stage.*`), `date` (via `formatDate` — which **throws** on a malformed ISO string, so guard at model entry), `opponent` (name + link context), `started` (boolean → a ruled label pair, not a raw `true`), `minutesPlayed`, `goals`, `attemptsAtGoal`, `passesAttempted`, `passesCompleted`, `passCompletion`, `ballProgressions`, `duelsWonAerial`, `duelsWonPhysical`, `totalDistance`, `topSpeed`.

**`totalDistance` is METRES on a player profile** (`Metres`, 1 dp). `distanceCovered` is the team-scope km field. Do not cross that boundary — 1.10: *"convert explicitly and once."* The hero tile and every table cell use metres with `enums.unit.m`.

---

## Data Reality — re-verify before designing

Measured on the **uncommitted working tree** at creation. `data/index/player-profiles/` and `data/index/team-profiles/` are **untracked**.

### The artifact

`contract/player-profile.schema.json`, `schemaVersion: 4`, `additionalProperties: false` at every level, all 11 top-level keys required. **`perNinety` is the only nullable field in the entire type.**

```ts
export interface PlayerProfile {
  schemaVersion: 4;
  playerId: PlayerId;          // === filename stem === URL slug
  name: string;                // "Julian QUINONES" — Given SURNAME, source passthrough
  team: EntityRef;             // { id, name }
  position: "gk" | "df" | "mf" | "fw";
  shirtNumber: number;
  appearances: { played; started; substituteAppearances; minutesPlayed };
  aggregates: AggregateMetric[];   // ALWAYS 18, fixed alphabetical order
  physical: PhysicalProfile;       // 9 fields
  matches: PlayerMatchRow[];       // 0..8 rows, chronological
  trends: TrendSeries[];           // ALWAYS 6, fixed order
}
export interface AggregateMetric { metricCode: MetricCode; value: number; aggregation: "sum"|"max"|"average"; perNinety: number | null; }
export interface PhysicalProfile { totalDistance; distanceZone1..distanceZone5;  // Metres
                                   highSpeedRuns; sprints;                        // Count
                                   topSpeed; }                                    // KmPerHour
export interface PlayerMatchRow { matchId; stage; date; opponent: EntityRef; started: boolean;
  minutesPlayed; goals; attemptsAtGoal; passesAttempted; passesCompleted; passCompletion;
  ballProgressions; duelsWonAerial; duelsWonPhysical; totalDistance; topSpeed; }
export interface TrendSeries { metricCode: MetricCode; points: { matchId; value }[]; }
```

**Uniformity verified across all 1,248 files:** one top-level keyset, one aggregate sequence, one trend sequence, one `physical` keyset, one match-row keyset across all 3,288 rows. **No optional fields, no polymorphic shapes.**

The 18 aggregate codes in emitted order: `ballProgressions, crossesCompleted, duelsWonAerial, duelsWonPhysical, goals, highSpeedRuns, interceptions, lineBreaksCompleted, passCompletion, passesCompleted, possessionRegains, sprints, stepIns, switchesOfPlay, tacklesWon, takeOns, topSpeed, totalDistance`. Semantics: `passCompletion` = `average` (**weighted**), `topSpeed` = `max`, the other 16 = `sum`.

> ⚠️ **`aggregation` is NOT a safe basis for a user-facing "how this was computed" label.** 1.18: the same word `"average"` means a **weighted** arithmetic on a player profile and an **unweighted** mean on a team profile — *"the same word 'average' means two different arithmetics in the two artifacts, and both are correct."*

**Precision (1.18):** metres 1 dp, km/h 1 dp, percentages 1 dp, kilometres 2, counts/minutes/shirt numbers 0.

### Counts and sizes

| | Fixtures (what you build against) | Real `data/index/` (2.19's cutover) |
|---|---|---|
| Manifest players | **2** working tree / **1** at `5d251bb` | **1,248** |
| Profile artifacts | **2** (`quinones-julian-mex`, `acevedo-carlos-mex`) | **1,248** |
| Manifest ↔ artifact bijection | **holds exactly (2 ↔ 2)** | **holds exactly (1,248 ↔ 1,248)**, 0 mismatches either direction |
| Pre-rendered player routes | **2** | **1,248** |
| Manifest matches | 4 | 104 |
| Artifact bytes | 3,149 + 8,533 | **7,484,064 raw / 1,203,607 gzip-9** |
| Largest raw | 8,533 B | 11,741 B (`mac-allister-alexis-arg`) → 1,498 B gzip-9 |
| Largest gzip-9 | — | **1,543 B** (`bellingham-jude-eng`, 11,572 B raw) — 0.31% of the 500 KB ceiling |

**The build reads `data/fixtures/`.** `build-data.ts:20` — `DATA_ROOT = path.join(process.cwd(), "..", "data", "fixtures")`, and `readTournament()` itself appends `index/tournament.json`. **This story's build generates 2 player routes, not 1,248.** The 1,248-route pre-render is 2.19's cutover.

**Client fetch path:** `data.ts:7` sets `DATA_ROOT = "/data/fixtures"` and `fetchArtifact` prefixes it, so the call is `` fetchArtifact<PlayerProfile>(`/index/player-profiles/${slug}.json`) ``. `scripts/copy-data.mjs` copies the whole `data/` tree verbatim into `out/data`, so the fixture profiles ship with **no script change**.

**`matches[]` length distribution** (real): 0 → **209 players**, 1 → 191, 2 → 183, 3 → 271, 4 → 214, 5 → 95, 6 → 37, 7 → 19, 8 → 29. **Positions:** df 421, mf 369, fw 313, **gk 145**.

**Fixture leaderboards reference 20 player ids; 19 have no fixture profile artifact.** Those links stay dead after this story — a fixture property 2.13 already disclosed (*"this resolves at real data; it is a fixture property, not a design flaw"*). **Do not assert that every leaderboard player link resolves.**

### Two data realities to design for

**A goalkeeper's profile has NO goalkeeping data — and that is correct.** CS-2 ruling D2b made `GoalkeepingBlock` per-**team** because *"no goalkeeper name appears on any of the four goalkeeping page families and 7 of 208 team-innings used two goalkeepers"*; 1.18 R1(A), ruled by Juan, followed: *"Emit no goalkeeping-shaped field and synthesize nothing."* Verified on `martinez-emiliano-arg` (8 starts, 810 min): same 11 keys, same 18 outfield aggregates, same 16 outfield match-row fields, zero goalkeeping-shaped anything. **Render what 1.18 emits. Never attribute a team block to a starter; never imply the page is incomplete for a keeper.**

**`henderson-jordan-eng` renders as an honest absence, not a gap.** 1.10's Domain G reconciliation (corrected by code review, reproduced independently by 1.14): `PMSR-M92-MEX-V-ENG` away #14 Jordan HENDERSON is an unused substitute the report prints an **all-zero row** for. 1.18 filters `matches[]` to lineups-with-minutes, so **his m092 row is absent from the artifact entirely** — *"the zero surfaces as the correct absence of an appearance, not as a zeroed appearance."* His profile is otherwise ordinary (1 appearance, `m067-panama-england`, 6 min). **Do not add a "why is this match missing?" note keyed off the team's match count.** Nothing in his artifact is null or missing.

### The fail-loud contract

`@/lib/format` **throws** on non-finite input (`format.ts:32-36`):

```ts
function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`format: non-finite value ${value} — handle null/absent fields before formatting`);
  }
}
```

Throwers: `formatDecimal`, `formatInteger`, `formatPercent` (transitively), `formatDate`, `formatKickoff`.

2.9's review found the live consequence: *"the log table is inside the lazily-mounted disclosure, so that throw fires when a reader opens 'Ver los datos', i.e. the deferred-throw the eager-build convention exists to prevent. **Guard at model entry and fail loud on load.**"*

**Binding here** (your trend table sits behind a disclosure):

1. **Guard at model entry.** `hub-model.ts:253-273`'s `listOf()` is the pattern — *"THREE ABSENT STATES, NOT TWO … a field the contract declares required can still be `undefined` at runtime"*; `fetchArtifact<T>` asserts the shape, it does not check it.
2. **Build rows EAGERLY** so a bad value fails on load, not on expand (2.11b).
3. **Keep anything that can throw inside a `TacticalErrorBoundary`.**
4. **Exhaustive `never` throws on closed enums** — the house idiom.
5. **Runtime payload gate:** `payload.playerId !== slug || payload.schemaVersion !== SCHEMA_VERSION` → status `"invalid"`, **not `"error"`** — `LeaderboardsRegion.tsx:120-130`: *"a retry cannot change the answer"*, and *"`boards` IS TYPED NON-NULL, WHICH PROVES NOTHING HERE — this is the untyped fetch boundary and the type is a cast."*

**Mirror `MatchBundleRegion.tsx:63-94` / `LeaderboardsRegion.tsx` for the client region:** `"use client"`, the four-state machine (`loading | loaded | error | invalid`), the `cancelled` cleanup flag, the retry `attempt` counter, and skeletons per State Patterns.

### Null / absent rendering — four ruled conventions, in precedence order

1. **Whole section absent** → `EmptyStatePanel` (UX-DR13).
2. **Whole column or table absent** → **gate it away** (FD-1, `leaderboard-model.ts:369-374`): *"NEVER render it as a run of em dashes either; the gate removes it."*
3. **Some rows absent** → `t("viz.table.unknown")` = `"—"` visually; **raw `null` for sorting**; `viz.marker.unknown*` **words** for speech (*"an em dash is a typographic mark that most screen readers announce as nothing"*).
4. **Contract-non-nullable** → print the value. With D3 removing `perNinety`, **case 3 should not arise on this route at all.** Reaching for an em dash means re-reading D8.

---

## The Recharts Contract — copy it exactly

`TacticalCharts.tsx:37-62`:

```
 *   accessibilityLayer={false}  — defaults TRUE in v3 and installs
 *       role="application" plus its own tabIndex and arrow-key handler.
 *   isAnimationActive={false}   — the global prefers-reduced-motion CSS kill
 *       switch does NOT reach recharts' JS-driven animation.
 *   explicit `ticks` and `domain`, never degenerate.
 *   colours as var(--token) PRESENTATION PROPS — Tailwind fill-* utilities do
 *       not reliably reach recharts' internally-rendered <text>.
 *   tick text via { className, fill } — `type-caption` deliberately carries no
 *       font-variant-numeric, SO THE TABULAR HALF OF DESIGN.md:301's MANDATORY
 *       PAIRING COMES FROM THE TAILWIND UTILITY.
 *   NO <Tooltip>  — hover-only, banned outright (UX-DR15).
 *   NO <Legend>   — direct series labels only.
 *   axis titles via <Label>, never `name`.
 *   a parent with a RESOLVED HEIGHT — a height-less ResponsiveContainer renders
 *       nothing at all, recharts' single most common failure mode.
```

> **Tick style is `{ className: "type-caption tabular-nums", fill: "var(--ink-secondary)" }`** — every shipped call site passes both classes (`TacticalCharts.tsx:292,491`; `MomentumChart.tsx:463`). `type-caption` alone drops DESIGN.md:301's mandatory tabular numerals.

**The colour token is `--viz-single`, and there is no `--viz-single-light`.** `globals.css:68` declares `--viz-single: var(--viz-team-a)` **once**, inside `:root, .dark`; `.light` redeclares only `--viz-team-a` (`:205`), so `--viz-single` is already theme-aware through the indirection. The Tailwind bridge is `--color-viz-single` (`:272`). **Use `fill="var(--viz-single)"`. Do not mint a `-light` sibling** — that would break the single-declaration pattern.

**The y-tick trap names you.** `deferred-work.md` (grep `non-uniform`), re-stated at `phases-model.ts:318-321`: on m074 (peak 17) recharts emitted `+17, +1, -8, -17` — *"four ticks, unevenly spaced, with no zero tick at all"* — while m001 came out clean, *"which is exactly how this would have shipped unnoticed by a green suite."*

**Three shipped tick generators to model on**, all pure with co-located property tests: `momentumYTicks(peak)` (`momentum-model.ts:463-520`, the test model the others cite), `percentTicks`/`percentAxisMax` (`phases-model.ts:282-347`), `countTicks`/`countAxisMax` (`goalkeeping-model.ts:705-745`). All floor the max so `[0, 0]` is impossible.

**Your closest structural precedent is `InvolvementChart`, not `DistributionChart`** — it is the single-series one. Copy its axis block (`TacticalCharts.tsx:540-582`) and its role ruling: **`role="img"` when the chart sits inside a block that is already a `<figure>`; `role="figure"` only when it is a top-level surface.** Either way it carries a localized one-sentence `figureSummary` (`PhasesSection.tsx:162,181` shows the composition).

**Two landmines:**

- **Never a runtime-interpolated Tailwind height class.** `` className={`h-[${n*22}px]`} `` is a class Tailwind v4 never generates → silent zero height → a height-less `ResponsiveContainer` renders nothing. Export a pure function returning one of a fixed set of **literal** classes with an exhaustive `never` throw.
- **Only `import type` may cross into a chart module.** `MomentumSection.tsx:6-13`: *"A value import from this module … creates a static module-graph edge into the very module next/dynamic exists to defer, linking recharts back onto the critical path."*

**The i18n ESLint gate does not reach recharts** — it delivers text through object-shaped props. Every text value is a pre-resolved identifier **"BY DISCIPLINE, NOT ENFORCEMENT."** The section owns the locale; the chart resolves no copy.

---

## Architecture Compliance

| Rule | Source | Here |
|---|---|---|
| **AD-11 rendering split** | `ARCHITECTURE-SPINE.md:106-110` | Build-time fs read for static params, meta and **Hero-critical content only**; client fetch below. **No third path, no inlining the artifact into HTML.** 2.13 measured `out/index.html` at **98,640 B** projected vs **~989,436 B** un-projected. **Pass the hero a projection.** |
| **AD-5 / AR-5** | `:70-74` | Every cross-match number precomputed, read verbatim. **Filter, select, and user-initiated re-order only.** The single-bundle carve-out does not apply — a profile is cross-match by definition. |
| **AD-4** | `:64-68` | `tournament.json`'s entity lists are the route manifest; pre-render **exactly and only** those entities. Each profile artifact ≤ 500 KB gzip-9, **measured by the Pipeline — the App never re-measures.** |
| **AD-10** | `:100-104` | URL + localStorage + ephemeral component state. **No state library, no client cache.** The trend selector is ephemeral. |
| **AD-7** | `:82-86` | Artifacts are unformatted; all `Intl` in the App. Source proper names pass through **as-is in English**. |
| **AD-3** | `:62` | `playerId` **is** the slug. An id, once emitted, never changes. |
| **AD-12** | `:112-116` | Typed dictionaries, `t()` only, `jsx-no-literals` + `no-restricted-syntax`. **Every string — `aria-label`s and metadata included — is a locale key or the build fails.** |
| **NFR-1** | `epics.md:67` | Lighthouse ≥ 90 covers **Match Dashboard and Tournament Hub only**. `/players/{slug}` is not gated — which is why D1's mobile match-page cost is the number that matters. |
| **NFR-2 / UX-DR9, UX-DR16** | | Every viz needs a reachable data-table alternative rendering **the same artifact slice**, plus `role=figure|img` with a localized one-sentence `aria-label`. |
| **NFR-3 / UX-DR17** | | Mobile = layout changes, **never data removal**. |
| **NFR-10 / UX-DR21** | | Attribution on every route — pass it as `ViewDataDisclosure`'s `trailing` so it *"survives a screenshot taken with the table closed."* |

**Placement rules** (2.13): new pure model code → `src/viz/**` with a mandatory co-located `<module>.test.ts`; **anything importing `@/lib/format` goes in `src/lib/`**; components → `src/components/`, **never** `src/components/ui/`; **do not create a new top-level `src/` directory** — it silently escapes the ESLint client-import seam.

**The client-import seam** (`eslint.config.mjs:183-219`): `src/components/**` and `src/viz/**` may not import `t` from `@/lib/i18n` (use `useT()`), and **may not import `@/lib/build-data` at all**. Type-only imports of `DictionaryKey`/`Locale` stay legal. **This applies to `.test.tsx` too — no test exemption.**

**The 16 gated prop names:** `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`, `aria-braillelabel`, `aria-valuetext`, `title`, `alt`, `placeholder`, `label`, `message`, `text`, `description`, `caption`, `heading`, `tooltip` — including template literals and the operands of concatenation/ternary/logical expressions inside them. **`href` is not gated.** Metadata `title`/`description` literals **are**. House prop names: `figureSummary`, `headText`, `headTitle`, `panelTitle`, `labelNode`, `accessiblePrefix`, `termId`.

**`"use client"` + `useT()` on the hero, never a server `t()`** — `MatchHero.tsx:19-28`: a server-`t()` surface *"would freeze Spanish and ignore the language toggle."*

---

## Reuse Inventory — do not rebuild any of this

| Need | Use | Do NOT |
|---|---|---|
| Sortable table | `DataTable` + `TableColumn<Row>` (`table-sort.ts:33-75`) | mint a table; add `defaultSort`; add `aria-pressed`; add a scroll container inside `DataTable` |
| **Whole-row link** | **`RowAnchor` pattern — `TournamentHub.tsx:93-136`**: `after:absolute after:inset-0` + `<tr className="relative">` via `DataTable`'s `rowClass`, + `sr-only accessiblePrefix` | make each cell a link |
| `<md` column reduction + sort menu | `HubTable.tsx`, `TableSortMenu.tsx`, `useTableSort` | invent a mobile table |
| Sort helpers | `sortRows`, `nextSortState`, `ariaSortFor`, `compareNumberNullLast`, `compareTextNullLast`, `composeSortAnnouncement`, `composeHeadAccessibleName` | write a comparator |
| Metric value formatting | `leaderboard-format.ts` — `formatLeaderboardValue`, `leaderboardUnitKey`, `NBSP` | call `Intl` directly |
| Metric labels/units | `viz/leaderboard-model.ts` — `LEADERBOARD_UNIT`, `LEADERBOARD_FORMAT`, `leaderboardMetricKey`, `leaderboardMetricAbbrKey`, `ABBREVIATED_METRICS` | add to `enums.metric` (sealed) |
| Domain G field labels | `viz/expert-model.ts` frozen lists + `expert.field.*` / `expert.fieldTitle.*` / `expert.fieldAbbr.*` | re-derive an order from `Object.keys` on a fixture |
| Number/date/text | `@/lib/format` | hand-format |
| Route hrefs | `hub-model.ts` — `playerHref`, `matchHref`, `teamHref` | interpolate inline |
| Chart data alternative | `ViewDataDisclosure` (`panelTitle`, `surface`, `trailing`, `children`) | build a disclosure |
| Empty state | `EmptyStatePanel` (`headline`, `explanation`) + `useEmptyHeadline()` | invent copy structure |
| Error boundary | `TacticalErrorBoundary` (`headlineKey`, `explanationKey`, `logLabel`) | let a throw escape |
| Glossary term | `GlossaryTerm` — props are **exactly** `{ termId, termLang?, children }` | name a prop `title`/`label`/`tooltip`/… |
| Selector | `ui/toggle-group.tsx` | vendor `tabs`/`select`/`slider` |
| Sort live region | **exactly one** `SortAnnouncerProvider` per route, and **pass `tableName` on every `DataTable`** — mandatory once a page carries more than one table | mount a second provider; omit `tableName` |
| Hero recipe | `MatchHero.tsx` + `StoryStatTiles.tsx` token table | extend `StoryStatTiles` (head-to-head) |

**`ViewDataDisclosure`'s `surface` prop is a contrast trap:** `"pitch"` is the default and computes **1.10:1 — an invisible control** — on a `--surface-raised` card. **Every use here is `surface="canvas"`.**

**`DataTable` renders no scroll container and still must not.** The caller supplies the height/width-bounded scrollport. 2.13 shipped a WCAG 1.4.10 failure from exactly this and fixed it with `min-w-0`; 2.11b's lesson is that `truncate` widens the column. The 15-column per-match table needs an `overflow-x-auto` wrapper **with visible affordance** (UX-DR15 allows horizontal scroll only inside wide containers) and `min-w-0` on the flex ancestor.

---

## Tasks / Subtasks

### Task 1 — Baseline, coordination, re-verification (blocking)
- [x] 1.1 Confirm `git rev-parse HEAD`. If not `5d251bb`, diff `app/`, `data/fixtures/index/`, `data/index/` and re-run every count in §Data Reality.
- [x] 1.2 Re-read `data/fixtures/index/tournament.json`, both fixture player profiles, and `contract/player-profile.schema.json`. Record: manifest player count, artifact filenames, bijection, schema delta.
- [x] 1.3 Re-read `hub-model.ts`, `format.ts`, `es.ts`, `en.ts`, `i18n.test.ts`, `static-output.test.ts` **immediately before editing each**. 2.14 is live in all six.
- [x] 1.4 Run D1's verification command and record the **before** table.

### Task 2 — The recharts consolidation (AC 6) — BEFORE ADDING ANY CHART
- [x] 2.1 Create `app/src/components/ProfileCharts.tsx` (the new leaf, `"use client"`) — stub exports are fine at this point.
- [x] 2.2 Create `app/src/components/Charts.tsx` (`"use client"`) re-exporting `MomentumChart`, `DistributionChart`, `InvolvementChart`, `TrendChart`, `SpeedZoneChart`.
- [x] 2.3 Migrate all four `dynamic()` call sites to `@/components/Charts`. Each keeps its own `loading` fallback and `ssr: false`; preserve the one-handle-per-height factories.
- [x] 2.4 Correct the now-false docblocks in `MomentumChart.tsx` and `TacticalCharts.tsx:14-20`.
- [x] 2.5 Fix the `InvolvementChart` edge-drawn hatch (D11).
- [x] 2.6 `npm run build`, re-run the measurement. **Pass = exactly one `VENDOR`-classified chunk.** Record the full three-scenario cost table from D1. **If the `<lg` match-page regression exceeds ~40 KB gzip, stop and report.**
- [x] 2.7 Browser-verify `#momentum`, `#phases`, `#pressing`, `#goalkeeping` still render, **both themes**.

### Task 3 — Route shell, static params, metadata (AC 5)
- [x] 3.1 `readPlayerProfile(playerId)` in `build-data.ts` — not-found throw **and** a `schemaVersion` gate.
- [x] 3.2 `app/src/app/players/[slug]/page.tsx`: `dynamicParams = false`; **synchronous** `generateStaticParams` from `readTournament().entities.players`, **no existence filter** (D10).
- [x] 3.3 `generateMetadata({ params }: { params: Promise<{ slug: string }> })` — `await params`; `{ title, description, openGraph: { title, description } }` from a pure `composePlayerTitle()` in `src/lib/player-profile.ts`. **No `og:image`.**
- [x] 3.4 Page body (`params` is a Promise here too): build-time read → **projection** → pre-rendered `<PlayerHero>`, then `<PlayerProfileRegion slug={slug} />`. Mirror `matches/[slug]/page.tsx`'s container classes.

### Task 4 — Pure models
- [x] 4.1 `app/src/viz/player-profile-model.ts` + test: hero projection, aggregates rows, physical rows, per-match rows (`key = matchId`), trend series selection, chart height classes (**literal** Tailwind classes, exhaustive `never`), and the tick generators — reusing `percentTicks` / `countTicks` where the family fits and adding the decimal-aware one for km/h and metres, property-tested on `momentumYTicks`' model.
- [x] 4.2 `app/src/lib/player-profile-format.ts` + test — anything importing `@/lib/format`.
- [x] 4.3 Guard at model entry: normalize the three absent states (`listOf`), reject non-finite numerics, validate the ISO `date` before `formatDate` sees it, throw naming the offending `playerId`/`metricCode`. **Rows built eagerly.**

### Task 5 — Hero altitude (AC 1, AC 4)
- [x] 5.1 `PlayerHero.tsx` (`"use client"` + `useT()`): `sr-only <h1>` (name + team + position); **visible** name as `type-title`; shirt badge (`grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-overlay type-label-caps text-ink-secondary`); position via `enums.position.*`; team name as `teamHref()` link with `min-h-11 min-w-11` and `prefetch={false}`; appearances line.
- [x] 5.2 `ProfileStatTiles.tsx` — four single-value tiles (D5). **No leader glyph, no side accent.** Units composed as strings above the JSX. `tabular-nums` on every value.
- [x] 5.3 The **"Comparar"** action (AC 4): `/compare?type=players&a={slug}`, `prefetch={false}`. The route does not exist — link it anyway (2.12 D2, 2.13 ruling 3; `LineupsDisclosure`/`MatchHero` already ship exactly this, pinned green by `matches/static-output.test.ts`). **Do not build a placeholder route.**
- [x] 5.4 Every composed string hoisted into a `const` above the JSX; separators dictionary-owned.

### Task 6 — Trends (AC 1)
- [x] 6.1 `TrendChart` in `ProfileCharts.tsx` — single-series, `fill="var(--viz-single)"`, `role="img"` inside a `<figure>`, localized `figureSummary`. Full recharts contract: `accessibilityLayer={false}`, `isAnimationActive={false}`, explicit `ticks` + `domain`, `var(--token)` presentation props, `{ className: "type-caption tabular-nums", fill: "var(--ink-secondary)" }`, **no `<Tooltip>`, no `<Legend>`**, `<Label>` axis titles, resolved parent height.
- [x] 6.2 Mount via `dynamic()` on the `@/components/Charts` specifier with a correctly sized skeleton.
- [x] 6.3 `TrendsSection.tsx` — `ToggleGroup type="single"` over the six series in artifact order, default = first, all four non-negotiables incl. `min-h-11 min-w-11`. Ticks and formatter switch per metric family (D6).
- [x] 6.4 `ViewDataDisclosure` (`surface="canvas"`, `panelTitle`, attribution as `trailing`) carrying **all six series**.
- [x] 6.5 Empty `points` → `EmptyStatePanel`.

### Task 7 — Physical profile (AC 2)
- [x] 7.1 `SpeedZoneChart` in `ProfileCharts.tsx`, exported through `Charts.tsx`, mounted via `dynamic()` on `@/components/Charts`. Same full contract as 6.1. **New** height helper — `distributionChartHeightClass` throws on 5 categories.
- [x] 7.2 Three tiles for `highSpeedRuns`, `sprints`, `topSpeed`. Band descriptors from `expert.fieldTitle.distanceZone1..5` (**reuse**).
- [x] 7.3 **Never** render a zone-derived total or assert zone-sum equality (D7).
- [x] 7.4 `ViewDataDisclosure` (`surface="canvas"`) with the attribution `trailing`.

### Task 8 — Aggregates and per-match tables (AC 1, AC 3)
- [x] 8.1 Aggregates `DataTable` — 18 rows, artifact order, unit on the row-header label (D5), `tableName`, caption stating default order and never mutating.
- [x] 8.2 Per-match `DataTable` — **all fifteen rendered fields** (§Route Composition), `key = matchId`, artifact order, no `defaultSort`, `tableName`, caption. Caller-supplied `overflow-x-auto` scrollport with visible affordance and `min-w-0`.
- [x] 8.3 **One `RowAnchor` per row** to `` `${matchHref(row.matchId)}#expert` `` (D2) — `after:absolute after:inset-0`, `<tr className="relative">` via `rowClass`, `sr-only accessiblePrefix`, `prefetch={false}`.
- [x] 8.4 Address or restate the open *"row-link focus ring paints on the ANCHOR's box, not on the row"* ledger item — you are ruling the linked-row pattern on its second surface.
- [x] 8.5 `sort.valueOf` returns the **rendered semantic value**; `?? null` never `?? 0`; nulls to the array end in both directions.
- [x] 8.6 Exactly one `SortAnnouncerProvider`, in `PlayerProfileRegion`.
- [x] 8.7 `matches: []` → `EmptyStatePanel`.
- [x] 8.8 `<md` column reduction + `TableSortMenu` per UX-DR17 — reuse `HubTable`/`useTableSort`; **layout change, never data removal** (NFR-3).

### Task 9 — Build, tests, sizing
- [x] 9.1 `app/src/app/players/static-output.test.ts` on `matches/static-output.test.ts`'s pattern: skip guard keyed on `out/`; **bijection** (`readdirSync(PLAYERS_DIR)` vs manifest, `toEqual`, plus `length > 0`); `<title>` and OG built from **fixture literals, never by calling the function under test**; a **shape** no-inline guard (assert the HTML does **not** contain `"aggregation"` or `"perNinety"` — *"so it fails on the first row rather than at some threshold"*); a **locale-formatted** value to prove the component ran; the `/compare?type=players&a=` link; the `#expert` href **for `m001` only** (READ THIS FIRST, item 3); `classAttrCount` for any class count.
- [x] 9.2 Extend `i18n.test.ts`: a describe for the new `player` namespace (es/en parity, resolution in both locales) **and update the caption-uniqueness list** — it carries one entry per rendered `DataTable` and this route adds three. 2.13 warns *"it has gone red on a stale count before."* Check the forbidden-register sweep and key-builder sweep still pass.
- [x] 9.3 **Read `static-output.test.ts` first — its artifact allow-list already handles template literals** (`FETCH_ARTIFACT_PATH` matches both `"…"` and `` `…` ``, added by 2.14 for exactly this reason) **and already uses per-route allow-lists.** Add a `/players/[slug]` entry for `/index/player-profiles/{}.json`; do **not** break the existing `/matches` and `/` assertions.
- [x] 9.4 **Size the real-data pre-render once, then revert.** `build-data.ts:14-18` is explicit: *"This constant and DATA_ROOT in `src/lib/data.ts` are the TWO cutover points and MUST flip together."* Point **both** at the real tree — `DATA_ROOT = path.join(cwd, "..", "data")` (**not** `data/index`; `readTournament()` appends `index/` itself) and `"/data"` — build, and record: player route count, **match route count (104 — this flip generates those too)**, wall-clock build time, `out/` size, anything that times out. **Revert both.** This is a measurement for 2.19, not a change to ship.
- [x] 9.5 Full chain green: `npm run build` and `npm test`. `assert-schema-version.test.ts` already times out against the grown data tree — the ledger records conflicting owners (1.17 / 1.18 / 1.19) and files the contradiction itself. **Report it; do not fix it and do not claim an owner.**

### Task 10 — Locale, terminology, contrast, reflow
- [x] 10.1 Append one `player` namespace to `es.ts`, mirror in `en.ts`, **after 2.14's `search` namespace**, append-only. **Reuse everything in D12's table — those eight terms already ship.** Mint only: the five per-match column heads (`minutesPlayed`, `stage`, `date`, `opponent`, `started`), the route's section headings, the empty-state copy, the row-link prefix, and the ToggleGroup's `aria-label`.
- [x] 10.2 Append policy-table rows to `EXPERIENCE.md` only for genuinely new terms. **Append, never renumber.** Flag them in Completion Notes as **`PROPOSED — Juan to confirm or overturn at review`**.
- [x] 10.3 **Mint no dead keys.** Audit that every key added has a live call site.
- [x] 10.4 **Measure contrast in BOTH themes** — `var(--viz-single)` in dark and light, every tick/label/axis colour, `ViewDataDisclosure` on `surface="canvas"`, the empty-state panel, the row-link colour against `DataTable`'s active-sort cue. **Every first-consumer story so far found a light-theme failure from this position.** `ink-muted` is barred for real content (3.30–4.04:1, below the 4.5:1 floor).
- [x] 10.5 **Reflow and zoom** (UX-DR16), per 2.11a/2.13's ruled protocol: `body.scrollWidth` vs `clientWidth` at **390 and 320 px**, **both locales**, everything expanded, plus 200% zoom holding a single-column hero.
- [x] 10.6 `prefers-reduced-motion` — verify `getAnimations({ subtree: true }).length === 0` on the route, not just `isAnimationActive={false}`.
- [x] 10.7 Glossary marking where a term appears in a heading or summary — **never inside a sortable head**; no dotted underline where no popover opens.

### Task 11 — Browser verification (both themes, 320/390 px and ≥lg)
- [x] 11.1 `/players/quinones-julian-mex/` — full profile, 5 match rows, all six trends.
- [x] 11.2 `/players/acevedo-carlos-mex/` — the **zero-appearance goalkeeper**: zeros print, empty sections show panels, nothing crashes, nothing implies the page is broken.
- [x] 11.3 Click the `m001` row → lands on `/matches/m001-mexico-south-africa/#expert` with the Expert Layer **expanded and focused**. The other four rows 404 on fixtures — expected, disclose it.
- [x] 11.4 "Comparar" emits the exact URL and 404s cleanly (2.17 owns it).
- [x] 11.5 Keyboard: `ToggleGroup` arrows, active segment not deselectable; **row-link focus ring visible under real key presses** (`element.focus()` is not a substitute — 2.13's ruling); tab order follows reading order; sort never loses row focus.
- [x] 11.6 Bundle-cache caveat: a hard reload does **not** refresh bundled data — override `fetch` with `no-store` when verifying artifact changes.

### Task 12 — Ledger and status
- [x] 12.1 `deferred-work.md`, append-only, cited by short quoted fragment: **close** the recharts vendor-chunk entry with the measured three-scenario table; **close** the `/players` half of the dead-link entry (all three call sites); **close** the minutes half of the 0-minutes entry (D4a); **file** the `perNinety` deferral with its numbers (D3); **file** the `passCompletion 0,0 %` ambiguity at hero/aggregate altitude (D4b); **close or restate** the `InvolvementChart` hatch entry; record the y-tick trap as discharged; **rule or restate** the row-link focus-ring item (D2).
- [x] 12.2 Note that this route **inherits** the unruled `<title>`-language item (owner: Juan) — **do not duplicate 2.12's entry**.
- [x] 12.3 Update `sprint-status.yaml`: `2-15-player-profile: review`, with a note block carrying the measured chunk table, the Task 9.4 real-data sizing, and every ruling that moved.

### Review Findings

Code review 2026-08-07. Three parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) over the `119b707 → worktree` diff scoped to this story's File List. 43 raw findings, 16 dismissed after reading the code at each location.

- [x] [Review][Decision] **RULED by Juan at review: 2.16's anchor-box ring wins.** Delete `PlayerMatchesSection`'s private `RowAnchor`, import `@/components/RowAnchor`, drop `outline-none` and the `focus-within` row ring, and repoint the `<md` disclosure at `HubTable` now that `rowClass="relative"` is what this surface needs. 2.15's measured `<tr>`-level ring is given up; the ledger's row-link focus-ring entry is restated to 2.16's ruling rather than closed on 2.15's. Becomes a patch. Original finding: **the row-link focus ring is ruled two contradictory ways in one tree, and the duplicate `RowAnchor` this story shipped is the reason** — 2.15 ruled the ring onto the `<tr>` via `focus-within`, verified under a real Tab press, and closed the ledger item. Story 2.16 then hoisted `@/components/RowAnchor.tsx` (shipped at HEAD in `79bd7aa`) whose docblock rules the opposite — *"THE FOCUS RING IS THE ANCHOR'S OWN BOX, and that is ruled (Story 2.16 Q2, taken by Juan) … NO `outline-none` appears in this file"* — and names `PlayerMatchesSection.tsx` as the private copy 2.11a decision 1 requires deleting. Three consequences ride on the same call: (a) `PlayerMatchesSection.tsx:69` keeps a private `RowAnchor` the tree already exports; (b) `ROW_CLASS`'s `focus-within:` matches on **mouse** focus too, so clicking a row paints a persistent 2px ring that the anchor's suppressed `focus-visible` ring never did; (c) because `HubTable` hardcodes `rowClass="relative"` (`HubTable.tsx:206`), keeping the row-level ring is what forced the `<md` disclosure fork — `PlayerMatchesSection.tsx:151-364` restates `HIDDEN_COLUMN_CLASS`, `hiddenKeys`, `renderedColumns` and `menuController` byte-for-byte from `HubTable.tsx:53-175`, undisclosed. If 2.16's anchor-box ring wins, all three collapse: delete the private anchor, use `@/components/RowAnchor`, and `HubTable` becomes usable as-is.
- [x] [Review][Decision] **RULED by Juan at review: all eight copy rows CONFIRMED; the `Stage` enum unifies on "Etapa" sitewide.** Change `player.column.stage` to `"Etapa"` (en unchanged: "Round"), on 2.16's reasoning — `viz.table.phase` already owns "Fase", so "Etapa" is the non-colliding name for the enum on every route. Re-mark the eight `EXPERIENCE.md` rows `CONFIRMED at code review 2026-08-07` rather than `PROPOSED`. Becomes a patch. Original finding: **eight `PROPOSED — Juan to confirm or overturn` copy rows ship on a live route, and one collides with 2.16** — `EXPERIENCE.md:313-320` plus `player.empty.*`, `player.region.*` and `player.trendSelector` in both dictionaries. `player.empty.trendsHeadline` / `matchesHeadline` are the only text the 209 zero-appearance players (16.7 % of the corpus) ever see below the Hero. Separately, this diff mints two Spanish names for one `Stage` enum: `player.column.stage: "Fase"` (`es.ts:2480`) and `team.column.stage: "Etapa"` (`es.ts:2713`), the latter carrying an explicit justification the former never answers. The i18n duplicate-value checks are per-namespace, so nothing catches it.
- [x] [Review][Decision] **RULED by Juan at review: drop the value-column sort.** The metric column stays sortable; `value` becomes an unsorted column. Sorting eighteen metrics spanning Count, Metres, KmPerHour and Percentage by raw magnitude produces an ordering with no meaning, and the caption already states the artifact's canonical order. Becomes a patch. Original finding: **the transposed aggregates table offers a numeric sort over a column mixing four unit families** — `PlayerAggregatesSection.tsx:80-92`. The `value` column sorts all eighteen aggregates by raw magnitude, ranking `totalDistance: 47.274,9 m` above `passCompletion: 82,2 %` above `goals: 4` as if comparable. The file's own docblock reasons at length about why the transposition forces the unit onto the row header and never notices it also makes the value column unsortable. Keep the sort, or drop it and leave the metric column sortable alone?
- [ ] [Review][Patch] The loading skeleton drops its accessible name — `aria-label` on a role-less `<div>` is name-from-author prohibited, the exact defect the 2.13 review patched in `LeaderboardsRegion` with `role="group"` [app/src/components/PlayerProfileRegion.tsx:113-120]
- [ ] [Review][Patch] The speed-band column's text sort puts zone 5 between zones 1 and 2 — `Intl.Collator("es")` orders `0-7 | 15-20 | 20-25 | 25 km/h o más | 7-15`; the adjacent column already carries the correct `kind: "number", valueOf: row.zone` [app/src/components/PhysicalSection.tsx:209-216]
- [ ] [Review][Patch] The `Fase` column sorts stages alphabetically, not by tournament order — es resolves to `Cuartos | Dieciseisavos | Fase de grupos | Final | Octavos | Semifinal | Tercer puesto`; `STAGES` in `hub-model.ts:66` is the shipped ordered list the sort should index [app/src/components/PlayerMatchesSection.tsx:228-236]
- [ ] [Review][Patch] `readPlayerProfile` gates `schemaVersion` but not `playerId`, though `PlayerProfileRegion` gates both — a mis-keyed artifact pre-renders player A's Hero above the runtime "invalid" panel, which is exactly the two-halves-contradict-each-other failure the function's own docblock says its gate exists to prevent [app/src/lib/build-data.ts:104-115]
- [ ] [Review][Patch] A blank line orphans all eight new policy rows from the policy table — in GFM a blank line terminates a table, so `EXPERIENCE.md:313-320` renders as a paragraph of literal pipes rather than appended rows. The File List also says "seven appended policy rows" (there are eight) and the PROPOSED enumeration omits `region states` and `trend selector` [EXPERIENCE.md:312]
- [ ] [Review][Patch] Two physical tiles carry `normal-case`, the third does not — `type-stat-label` sets `text-transform: uppercase` (`globals.css:375`), so the row reads "Carreras a alta velocidad", "Sprints", "VELOCIDAD MÁXIMA (KM/H)". The `normal-case` arrived with the glossary marking and no comment justifies it [app/src/components/PhysicalSection.tsx:153, 171, 180]
- [ ] [Review][Patch] `everyRouteHtml()` never opens `out/players/**`, so seven assertions titled "on EVERY exported route" do not cover the route family this story adds; the floor is `>= 4` rather than a real count [app/src/app/static-output.test.ts:510-527, 541]
- [ ] [Review][Patch] AC 3's `#expert` href and its mandatory trailing slash have no test anywhere — Task 9.1 is checked and claims one, and `grep expert app/src/app/players/static-output.test.ts` returns nothing. The href is client-composed so the exported HTML genuinely cannot carry it, but that impossibility is disclosed nowhere and D2's stated single point of failure is regression-unprotected [app/src/app/players/static-output.test.ts]
- [ ] [Review][Patch] `decimalAxis` emits a negative minimum for a flat-zero series — `decimalAxis([0], 1)` returns `min: -0.1`, ticks `[-0.1, 0, 0.1]`, i.e. a negative distance or top speed. Not reachable on the corpus (0 of 1,248 files carry a flat-zero `topSpeed`/`totalDistance` trend), and the property test's `axis.min <= low` invariant cannot detect it [app/src/viz/player-profile-model.ts:426-433]
- [ ] [Review][Patch] `topSpeed`'s `headTitle` is a strict substring of its own `headText`, so the `<th>` gets a native tooltip repeating a shortened head; `totalDistance` six lines above has the identical `composeMetricLabel` shape and correctly passes `null`. `table-sort.ts:38-39`: *"Full term when headText is abbreviated; null otherwise"* [app/src/components/PlayerMatchesSection.tsx:314-317]
- [ ] [Review][Patch] The three new key builders resolve inside the story's own describe rather than the key-builder sweep — reintroducing exactly what 2.14's review patched out four hours earlier, with the note still in the file at `i18n.test.ts:2264-2266` [app/src/lib/i18n.test.ts:2402-2422]
- [ ] [Review][Patch] Two test names overclaim: "ships the artifact path as the region's only fetch" asserts only `aria-busy="true"`, and "renders the player's own name and position" searches the whole document, so `<title>` and `og:description` satisfy it — the file's own `heroHeader()` helper exists to prevent exactly that [app/src/app/players/static-output.test.ts:167-172, 252-260]
- [ ] [Review][Patch] The ledger's `/players/{slug}` row reads **−89 KB**, which is a build-artifact claim reported in a page-weight table — per page this route loads the merged 103.2 KB chunk instead of its own ~89.2 KB vendor plus its own leaf, so the sign is inverted. Both numbers are already in the table above it; no rebuild needed [deferred-work.md, chunk-consolidation table]
- [ ] [Review][Patch] `matchRowStage` is exported, called nowhere and untested; `profileUnitKey` is a zero-value alias documented as *"Re-exported for one import"* with four call sites, each of which could import `leaderboardUnitKey` directly [app/src/viz/player-profile-model.ts:286, app/src/lib/player-profile-format.ts]
- [x] [Review][Defer] The 15-column per-match scrollport ships no visible affordance [app/src/components/PlayerMatchesSection.tsx:432] — deferred, pre-existing: the spec required one, but no shipped surface has any (`ExpertLayer.tsx:1019`, `HubTable.tsx:189`, `LeaderboardsRegion.tsx:591` are all bare `overflow-x-auto`), so this is a codebase-wide gap rather than this story's regression
- [x] [Review][Defer] `MatchBundleRegion`'s loading skeleton carries the same role-less `aria-label` [app/src/components/MatchBundleRegion.tsx:110-116] — deferred, pre-existing: it is the unpatched sibling this story copied; `LeaderboardsRegion` was patched at the 2.13 review and this one was missed

---

## Testing Requirements

**Harness:** vitest, `environment: "node"`, `include: ["src/**/*.test.{ts,tsx}"]`, alias `@` → `./src`.

**The render-test seam is half-landed.** 2.14 has added `jsdom`, `@testing-library/react`, `user-event` and `jest-dom` to `package.json` devDependencies, but `vitest.config.ts` still declares `environment: "node"` with no per-file opt-in and no setup file. **If 2.14 has wired it by the time you start, you may use it. If not, do not wire it yourself** — that owner slot is 2.14's, and the pure-model tier is sufficient for everything this story needs to assert.

**What gets tested:** the pure model/derivation layer. Every `src/viz/*-model.ts` and `src/lib/*-model.ts` has a paired test. Components stay thin and are asserted through the exported HTML.

**Two rules learned the hard way in the shipped suites:**

- Build an expectation from **fixture literals**, never by calling the function under test — *"an expectation built by the function under test reproduces that function's bugs and can only prove it was called."*
- Count classes with `classAttrCount` (real `class="…"` attributes only) — *"the RSC flight payload carries 'className' strings that must not be counted."*

**Do not assert bytes.** *"The App never measures bytes."* D1's chunk measurement is a **verification step you run and record**, not a committed test.

---

## Project Structure

**New**
- `app/src/app/players/[slug]/page.tsx`
- `app/src/app/players/static-output.test.ts`
- `app/src/components/Charts.tsx` — the single lazy boundary (D1)
- `app/src/components/ProfileCharts.tsx` — `TrendChart` + `SpeedZoneChart`
- `app/src/components/PlayerHero.tsx`, `ProfileStatTiles.tsx`, `PlayerProfileRegion.tsx`
- `app/src/components/TrendsSection.tsx`, `PhysicalSection.tsx`, `PlayerAggregatesSection.tsx`, `PlayerMatchesSection.tsx`
- `app/src/viz/player-profile-model.ts` + `player-profile-model.test.ts`
- `app/src/lib/player-profile-format.ts` + `player-profile-format.test.ts`
- `app/src/lib/player-profile.ts` — `composePlayerTitle()` (server-importable)

**Modified**
- `app/src/lib/build-data.ts` — `readPlayerProfile`
- `app/src/components/{MomentumSection,GoalkeepingSection,PhasesSection,PressingSection}.tsx` — dynamic specifier
- `app/src/components/TacticalCharts.tsx` — hatch fix + docblock; `MomentumChart.tsx` — docblock
- `app/src/components/{LineupsDisclosure,LeaderboardsSection,LeaderboardsRegion}.tsx` — inline `/players/` → `playerHref()`
- `app/src/locales/es.ts`, `en.ts` — append `player` namespace **after** `search`
- `app/src/lib/i18n.test.ts`, `app/src/app/static-output.test.ts`
- `_bmad-output/planning-artifacts/ux-designs/…/EXPERIENCE.md` — appended policy rows
- `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`

**Never touched:** `pipeline/`, `contract/`, `data/`, `src/components/ui/**` (vendored — do not vendor a new primitive), `tactical-sections.ts` (`SectionId` stays eleven), `TacticalSection.tsx`, `table-sort.ts`, `DataTable.tsx`.

---

## Open Questions for Juan

1. **`perNinety` (D3).** Ruled off this surface — no ruled minutes floor exists and the corpus maximum is 104,139.0 over one minute. Confirm, or rule a floor + copy and it goes in.
2. **D1's mobile cost.** Consolidating puts every chart leaf on the always-expanded momentum path, so the `<lg` Match Dashboard — a Lighthouse-gated route — gains ~35 KB+ while gaining back 300.4 KB the moment a reader opens a second chart section (and always at `≥lg`). Task 2.6 measures it; confirm the trade or set a threshold.
3. **`passCompletion: 0,0 %` at hero and aggregate altitude (D4b).** Seventeen players attempted zero passes. Adjacent `passesAttempted` disambiguates it in the per-match table but not in a tile. Accept the ambiguity, or rule copy?
4. **The `<title>`/OG language decision (D9).** Unruled and unfiled since 2.12 took it for `/`. AC 5 puts it on 1,248 routes at 2.19. Worth ruling before then.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- **D1 chunk measurement** (before/after), `app/` — the story's own classifier, discriminating on
  `CartesianAxis` AND `Brush` AND `redux` together.
- **Corpus scans** over `data/index/player-profiles/*.json` (1,248 files): trend↔match join
  totality, per-field fractional-value counts, per-metric trend value ranges.
- **Browser verification** against the static export on a private port (127.0.0.1:8215, then
  :8216 for the isolated worktree).

### Completion Notes List

**All six ACs are satisfied and were verified on the built export, not only in tests.**

**AC 6 passes, and the ledger's recorded remedy for it was wrong.** The filed fix was "a shared
re-export module that both LEAVES import" — but both leaves already imported the identical bare
specifier `"recharts"`, so module identity was never the cause. The duplication is **per async
chunk group**, and there were two groups because there were two distinct `dynamic()` **import
specifiers**. `Charts.tsx` is a barrel every **call site** names. Measured: **2 VENDOR chunks
(89.4 + 89.2 KB gzip-9) → exactly 1 (103.2 KB)**. Three-scenario cost: `<lg` match page **+0.5 KB
gzip** (against D1's ~40 KB stop-threshold, so no escape hatch was needed), `≥lg` **−99.1 KB**,
second-chart-open **−99.1 KB**, `/players/{slug}` avoids minting a third ~89 KB vendor.

**Four defects found in the browser that no test in this harness could see:**

1. **`expert.field.highSpeedRuns` is `"CARR. ALTA VEL."` — an abbreviation, not the term** D12's
   reuse table calls it. Legitimate in an Expert `<th>` (whose `headTitle` carries the full term);
   an unexplained all-caps string in a stat tile, which has no such slot. Switched to
   `enums.leaderboardMetric.highSpeedRuns` ("Carreras a alta velocidad") — equally shipped, equally
   a reuse — and filed, since other `expert.field.*` entries D12 lists may be abbreviations too.
2. **`useEmptyHeadline()` composes "…para este partido"**, which is false on a profile. The Hub had
   silently worked around it; this route authors `player.empty.*` and files the gap for 2.16/2.17.
3. **D6's x-tick ruling names a field that does not exist here.** `opponent` is an `EntityRef`;
   `teamCode` lives only on match metadata and `entities.teams[]`, neither reachable from a profile
   without breaching the route's own artifact allow-list — and on fixtures 4 of 5 opponents are not
   in the manifest at all. **Amended to the match date** (new `formatDateShort` in the sole
   formatting path), which satisfies D6's stated criterion; the opponent is carried in the data
   alternative, the figure summary and the per-match table. `month:"short"` was rejected on
   measurement: es-CO renders "11 de jun" (9 chars) against a ~220 px plot at 320 px.
4. **`LEADERBOARD_FORMAT.totalDistance` is `"integer"` — a silent AR-5 breach on this route.**
   918/1,248 aggregates and 2,937/3,288 match rows are fractional, so it would round 47.274,9 m to
   "47.275" invisibly. Scoped around with `profileMetricFormat()`; the unit table is untouched.

**The decimal-aware tick generator earns its keep, measured live.** `topSpeed` renders
**32,0 / 32,5 / 33,0** — a real 1 km/h band. `countTicks` would have produced `[0, 18, 36]` and a
flat line pinned to the plot top, which is exactly what D6 predicted.

**[OVERTURNED at code review 2026-08-07 — Juan ruled 2.16 Q2's anchor-box ring. The paragraph below
records what this story shipped and why it was reversed; `:focus-within` also matched MOUSE focus,
painting the row ring for pointer users. See the Review Findings above.]** The open row-link
focus-ring item is FIXED, not restated. The ring moves off the anchor and
onto the `<tr>` via `focus-within`. Verified under a **real Tab press** (2.13: `element.focus()` is
not a substitute): anchor `outline-style: none`, `<tr>` `solid 2px rgb(14,116,144)` at `-2px`
offset, ring box **1411×63** against the anchor's **58×50**. `DataTable.tsx`'s own note — *"this is
what keeps it satisfied when 2.15 makes those names links"* — is discharged.

**AC 3 verified end to end** — in the BROWSER. Task 9.1 also claimed a committed assertion on the
`#expert` href and the suite never had one; it cannot, because the table is client-rendered and the
string never reaches the exported HTML. Closed at code review by extracting `matchAnchorHref()` into
`player-profile-model.ts` with a co-located test that pins the trailing slash. Exactly one anchor per
row (5 rows, 5 anchors), each `/matches/{id}/#expert` with the mandatory trailing slash. Activating the `m001` row lands on the
Match Dashboard with the Expert Layer **expanded** (`aria-expanded="true"`, 118 rows), scrolled
clear of the sticky header, focus moved to its heading. The other four rows 404 on fixtures — a
fixture property (the manifest carries 4 matches, only `m001` overlaps), disclosed, not "fixed".

**Accessibility, measured in both themes.** Contrast clears 4.5:1 everywhere; light is the tighter
theme (`--viz-single` and `accent-cyan` both **4.99**), `ink-muted` is unused for content. Reflow:
**zero page overflow** at 320 and 390 px, both locales, both themes, both fixtures, everything
expanded — the 772 px table scrolls inside its own container (UX-DR16's data-table exception).
`getAnimations({subtree:true})` returns only the Chrome extension's own overlay; the page contributes
none. Glossary marks open real popovers on the two physical tiles and appear in **no** sortable head.

**Zero dead keys** — all 50 `player.*` leaves have a live call site, audited programmatically.

**PROPOSED COPY — Juan to confirm or overturn at review** (EXPERIENCE.md rows appended, never
renumbered): the four section headings, the five per-match column heads, the transposed table's
`Métrica`/`Valor`, the `started` Sí/No pair, the appearances line, and both empty states.

**Reported, not fixed, no owner claimed:** `assert-schema-version.test.ts` did **not** time out —
it passed in 694 ms and 497 ms — contradicting the story's expectation.

**This route inherits the unruled `<title>`/OG language item** (owner: Juan, filed once under 2.12).
Not duplicated. At 2.19's cutover it applies to 1,248 routes.

**Coordination — and it changed how this story was verified.** Story 2.14's code-review session ran
a sweeping `git add` and committed this story's in-progress work inside commit `79bd7aa` ("Story
2.14 code review…"). Story 2.16's session then put `app/` in a red state — 23 `tsc` errors in
`TeamFormationsSection.tsx`, `TeamIdentitySection.tsx` and `team-profile-model.test.ts`, all
referencing a `team.*` namespace not yet in `es.ts`, and **zero in any 2.15 file**. The full gate
and full suite were therefore run in an **isolated worktree** at HEAD plus this story's own diff:
**`npm run build` green, 1,060 tests green, exactly one VENDOR chunk.** In the shared tree, lint is
green and every `tsc` error is attributable to 2.16.

### File List

Paths relative to the repository root.

**New**

- `app/src/app/players/[slug]/page.tsx` — the route: `dynamicParams = false`, synchronous
  `generateStaticParams` with no existence filter, `generateMetadata` (title + description +
  openGraph, no `og:image`), and the projected Hero + client region.
- `app/src/app/players/static-output.test.ts` — 17 assertions over the exported HTML.
- `app/src/components/Charts.tsx` — **the one lazy boundary** (AC 6).
- `app/src/components/ProfileCharts.tsx` — `TrendChart` (line, non-zero baseline) and
  `SpeedZoneChart` (horizontal bars, zero-based).
- `app/src/components/PlayerHero.tsx`
- `app/src/components/ProfileStatTiles.tsx`
- `app/src/components/PlayerProfileRegion.tsx` — the four-state machine and the ONE
  `SortAnnouncerProvider`.
- `app/src/components/PhysicalSection.tsx`
- `app/src/components/TrendsSection.tsx`
- `app/src/components/PlayerAggregatesSection.tsx`
- `app/src/components/PlayerMatchesSection.tsx`
- `app/src/viz/player-profile-model.ts` + `player-profile-model.test.ts` (38 tests)
- `app/src/lib/player-profile-format.ts` + `player-profile-format.test.ts` (19 tests)
- `app/src/lib/player-profile.ts` + `player-profile.test.ts` (8 tests)

**Modified**

- `app/src/lib/build-data.ts` — `readPlayerProfile`, failing loud twice.
- `app/src/lib/format.ts` — `formatDateShort` (the chart axis's only viable date form).
- `app/src/components/MomentumSection.tsx`, `GoalkeepingSection.tsx`, `PhasesSection.tsx`,
  `PressingSection.tsx` — `dynamic()` specifier → `@/components/Charts`.
- `app/src/components/TacticalCharts.tsx` — the `InvolvementChart` hatch fix + corrected docblock.
- `app/src/components/MomentumChart.tsx` — corrected docblock (its "ONLY place recharts is
  imported" claim was already false).
- `app/src/components/LineupsDisclosure.tsx`, `LeaderboardsSection.tsx`, `LeaderboardsRegion.tsx`
  — inline `/players/` → `playerHref()` (and `teamHref()` in the two ternaries).
- `app/src/locales/es.ts`, `app/src/locales/en.ts` — the `player` namespace, appended after
  2.14's `search`.
- `app/src/lib/i18n.test.ts` — the `player`-namespace describe + four profile captions added to
  the uniqueness inventory.
- `app/src/app/static-output.test.ts` — the `/players/[slug]` artifact allow-list.
- `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md` — **eight**
  appended policy rows (this said "seven"; corrected at code review) plus two "deliberately not a
  new row" notes. All eight were CONFIRMED by Juan at the review and are marked as such.
- `_bmad-output/implementation-artifacts/deferred-work.md` — append-only (192 insertions, 0
  deletions).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-15-player-profile: review` plus
  the note block.

**Measured once and reverted** (Task 9.4, both cutover points, `git diff` on `data.ts` empty):
`app/src/lib/build-data.ts`, `app/src/lib/data.ts`.

**Not touched:** `pipeline/`, `contract/`, `data/`, `src/components/ui/**`,
`tactical-sections.ts`, `TacticalSection.tsx`, `table-sort.ts`, `DataTable.tsx`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | Story 2.15 implemented: `/players/{slug}` pre-rendered from `player-profiles/{id}.json` — hero altitude, physical profile, trends with a metric selector, all 18 aggregates, the full 15-column per-match table with one row anchor to `/matches/{id}/#expert`, and the "Comparar" deep link (AC 1–5). |
| 2026-08-07 | AC 6: recharts consolidated behind one lazy boundary (`Charts.tsx`). Two 300.4 KB VENDOR chunks → one; `<lg` match-page cost +0.5 KB gzip, `≥lg` −99.1 KB. |
| 2026-08-07 | Ledger: closed 4 entries (vendor chunk, `/players` dead links, `InvolvementChart` hatch, 0-minutes copy), ruled AND fixed the row-link focus ring, recorded the y-tick trap discharged, filed 6 new items. |
| 2026-08-07 | Four browser-only defects found and fixed: an abbreviation used as a tile term, a match-scoped empty-state helper, D6's unavailable team-code field, and `LEADERBOARD_FORMAT.totalDistance` rounding a fractional value. |
| 2026-08-07 | Task 9.4 real-data sizing measured for Story 2.19 (1,248 + 104 routes, 76 s, 79.3 MB) and both cutover points reverted. |
| 2026-08-07 | Status → review. |

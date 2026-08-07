---
baseline_commit: 79bd7aa
---

# Story 2.17: Comparison Mode

Status: review

**Scope: `app/` + the two locale files + `i18n.test.ts` + `static-output.test.ts` + `EXPERIENCE.md`'s policy table + the two ledger artifacts.** Nothing under `pipeline/`, `contract/`, or `data/`. You consume `data/fixtures/index/tournament.json`, `data/fixtures/index/player-profiles/*.json`, `data/fixtures/index/team-profiles/*.json` and `data/fixtures/matches/*.json`; you never write any of them.

---

## Story

As Diego,
I want two players, teams, or matches side by side with a shareable URL,
So that one composite view replaces manual notes across a dozen PDFs (FR-29, UJ-3).

---

## Acceptance Criteria

Verbatim from `epics.md:965-980`.

1. **Given** `/compare`, **when** the shell loads, **then** the type selector (Jugadores/Equipos/Partidos) + two Command search-selects over the Tournament Index render; selections update `?type=&a=&b=` (URL is the only comparison state, AR-10) and fetch exactly the two entities' bundles/index slices (FR-34).
2. **And** a swap-sides control exchanges A/B.
3. **Given** two selected entities, **when** the comparison renders, **then** mirrored stat rows share centered labels with entity-accent top-borders only; each side's precomputed values render verbatim — shared axis domains and leader-accent determination are the only client derivations, never displayed cross-entity numbers (AR-5, UX-DR23).
4. **And** vizzes render per entity with identical scales; at `<md` sections stack A above B with a sticky mini-header naming whose viz is on screen (UX-DR17).
5. **Given** partial or invalid params, **when** the page loads, **then** the picker-first empty state ("Elige dos {…} para comparar."), single-column partial state, and invalid-slug state ("No encontramos {slug}…", valid side preserved, invalid param dropped) all behave per State Patterns (UX-DR14).
6. **And** a pasted comparison URL reproduces the same comparison (UJ-3 climax).

---

## READ THIS FIRST

Eight things will cost you a review cycle if you learn them late.

1. **THE ROUTE ALREADY HAS LIVE INBOUND LINKS, AND THEY DISAGREE WITH EACH OTHER.** `PlayerHero.tsx:195` ships `/compare/?type=players&a=${playerId}` — **with** the slash — and `players/static-output.test.ts:201,204` pins that exact escaped string green. The uncommitted `compareTeamHref` (`team-profile.ts:172`) returns `/compare?type=teams&a=${teamId}` — **without** it. `PlayerHero.tsx:189-191` assigns the reconciliation to you by name: *"2.17 owns the shape and should mint the helper with it."* See **D2**.
2. **THIS APP HAS NEVER READ A QUERY PARAMETER.** `useSearchParams`, `useRouter`, `usePathname`, any `next/navigation` import, `history.pushState`, `history.replaceState`, `Suspense` and `React.lazy` are **all zero-occurrence in `app/src`**. The only URL-derived state that ships is `window.location.hash`, in three places. You are establishing the pattern. See **D1** — and note that the obvious choice (`useSearchParams`) **fails the build** unless you also introduce this codebase's first `<Suspense>`.
3. **"VIZZES RENDER PER ENTITY" MEANS TWO CHARTS, NOT ONE CHART WITH TWO SERIES.** `EXPERIENCE.md:78`: *"each viz rendered **per entity** with identical scales/axes so sides are comparable."* Every design decision below follows from that. The shared axis domain is what makes them comparable, and it is one of exactly two derivations you are permitted. See **D5**.
4. **YOU ARE THE SOLE OWNER OF THE TEAM B NON-HUE CHANNEL AND THE EVIDENCE IS ALREADY MEASURED.** Do not re-derive a single number. See **D4** — and note the binding conclusion that the declared dashed-stroke fallback **cannot work on a filled bar at all**.
5. **`t()` HAS NO INTERPOLATION, AND TWO OF YOUR THREE RULED STRINGS ARE TEMPLATES.** `i18n.ts:46` is `t(key, locale)` and nothing else. `"Elige dos {jugadores} para comparar."` and `"No encontramos {slug}. Elige de la lista."` must be composed from `…Before`/`…After` fragments **into a `const`**, never inline in JSX. See **D11**.
6. **TWO SESSIONS ARE WRITING `app/` RIGHT NOW AND ONE HAS ALREADY SWEPT ANOTHER STORY'S FILES INTO A COMMIT.** `79bd7aa` — nominally "Story 2.14 code review" — is the adding commit for 2.15's *entire* player surface **and for `viz/team-profile-model.ts`, which belongs to a story that is still `ready-for-dev`.** Tracked-ness is no signal of story completion. Run the full chain before your first edit and record the pre-existing failures (Task 1.2).
7. **THE BUILD IS FIXTURE-DRIVEN.** `DATA_ROOT` is `/data/fixtures` (`data.ts:7`) and `build-data.ts:25` points at `../data/fixtures`. The fixture index carries **1 team, 2 players, 4 matches**. Most pickable slugs on the built export dead-end; that is expected and 2.19 owns the cutover. Verify against what the fixture actually contains.
8. **YOU ARE THE FIRST GENUINE `DistributionChart` REUSER, SO ITS OPEN DEFECT FINALLY BECOMES YOURS.** `seriesLabelIndex` is still unfixed. See **D9**.

---

## Ruled Decisions

Fourteen decisions taken here. One open ruling (**R1**) goes to Juan; the work proceeds under the recommendation.

### D1 — Read the query string with `useSyncExternalStore` over `window.location.search`. NO `useSearchParams`. NO `<Suspense>`.

`EXPERIENCE.md:43` gives the shape but not the mechanism: *"The `/compare` route is one pre-rendered shell; **params are read client-side** and the two entity bundles are fetched on demand."* Nothing in the PRD, the spine or the UX docs rules the mechanism. It is ruled here.

**Why not `useSearchParams()`.** Under `output: "export"` an unwrapped `useSearchParams()` throws `BailoutToCSRError` (`E394`) during prerender, which `app-render.js` logs as *"`useSearchParams()` should be wrapped in a suspense boundary at page `/compare`"* and **re-throws — `next build` fails.** Wrapping it works, but React then serialises **the boundary's fallback** into `out/compare/index.html` for that whole subtree, so the exported document loses the real route shell. This codebase has **zero** `<Suspense>` anywhere, so there is no fallback a11y precedent to copy either.

**RULED — a `useUrlQuery()` hook on `use-media-query.ts`'s exact shape**, in a new `src/lib/use-url-query.ts`:

- `getSnapshot: () => window.location.search` — **a primitive**, so React's `Object.is` check needs no memoized snapshot (`use-media-query.ts:85` states this reason in place).
- `getServerSnapshot: () => ""` — the empty query is the honest pre-render answer and it renders the picker-first empty state, which is exactly what the static document should contain.
- `subscribe`: `popstate` **plus** a module-scope notifier set that your own URL writes call, because `history.replaceState` does not fire `popstate`. Guard `addEventListener` in `try/catch` the way `use-media-query.ts:66-80` does.

This gives the parsed params on the **first client render after hydration** — not one frame late, the way a mount effect would (`use-media-query.ts:5-11`: *"getSnapshot reads `.matches` synchronously, so the FIRST client render is already at the right breakpoint; an effect-based hook renders one frame at the wrong one"*). No build gate, no Suspense, no new test-mocking convention: jsdom supplies `window.location.search` natively.

**AC 6 IS DISCHARGED HONESTLY, NOT OVERCLAIMED.** There is no server; `out/compare/index.html` is byte-identical for every query string. State it in the Completion Notes the way `static-output.test.ts:83-96` states the same property for the Hub: *"the exported HTML carries the route's shell in its `loading` state and NOT a single standings or result row. That is the property under test here, not a limitation of it."* **The claim you may make: a pasted URL reproduces the same comparison with no user input, on the first client render, through the same four-state region machine the other five routes use.** Do not write "on first paint" anywhere.

### D2 — ONE `compareHref` helper, in `src/lib/compare-url.ts`, and the slash is written out.

`next.config.ts` sets `trailingSlash: true`, so a slash-less href is a **redirect, not a link** — `hub-model.ts:171-173` already rules this for the three entity hrefs, all of which are `` `/x/${id}/` ``.

**RULED:**

```ts
export type CompareType = "players" | "teams" | "matches";
/** The canonical entry URL. `trailingSlash: true` makes a slash-less href a redirect, not a link. */
export function compareHref(type: CompareType, a: string, b?: string): string
```

- Always emits `/compare/?type=…&a=…` (and `&b=…` when present). The `a`/`b` values are entity **ids**, which are the slugs permanently (AD-3).
- `PlayerHero.tsx:195`'s inline literal and the uncommitted `compareTeamHref` **both repoint at this helper**. `compareTeamHref` is deleted; its call site (`TeamHero.tsx:185`) takes `compareHref("teams", teamId)`.
- **`players/static-output.test.ts:201,204` must stay byte-identical green.** If your helper changes that string you have broken a shipped assertion, not improved it.
- **Coordination condition:** `team-profile.ts` and `TeamHero.tsx` are **uncommitted 2.16 files**. Check `git status --porcelain` at Task 1.3. **If they are dirty, do NOT edit them** — ship `compareHref`, repoint only `PlayerHero.tsx`, and **file the `compareTeamHref` repoint** in the ledger naming 2.16 or 2.19. A stranded duplicate helper is cheaper than a merge collision in another session's unlanded file.

### D3 — Route shape: server shell over a client body. No `generateStaticParams`, no route metadata.

`/compare` has no dynamic segment, so there are no static params. The house pattern is stated in `players/[slug]/page.tsx:14-22`: *"A SERVER COMPONENT over client bodies — the shipped house pattern (`/about`, `/glossary`, `/404`). The client boundary is what makes the language toggle work at all."* `/about` and `/glossary` are 15- and 22-line server shells; copy that.

**`export const metadata` is NOT taken here, and that is a ruling, not an omission.** Three reasons, in order of force:

- **It would mint dead keys.** `<title>`/OG stay Spanish after an EN toggle (`EXPERIENCE.md:40`, filed at `deferred-work.md:975`), so `en.*` metadata keys are unreachable by construction — precisely the pattern 2.18's **BINDING** prohibition forbids, and precisely the open ruling 2.18 filed rather than resolved (its Decision 2: *"Either both routes take metadata or neither does; that is the open ruling the story was told to file, not resolve."*). That ruling is Juan's and is still open.
- **NFR-4 excludes this route by enumeration.** `epics.md:70`, `prd.md:390` and `EXPERIENCE.md:42` each name exactly three route classes — match, player, team. Story 2.17's ACs are silent on `<title>`/OG, unlike 2.15's (`epics.md:939`) and 2.16's (`epics.md:956`), which name it explicitly.
- **Entity-specific OG is architecturally impossible here.** One shell, one static `<head>`, no per-`?a=&b=` variant under `output: 'export'`.

**Task 12.2 files the consequence** in the `EXPERIENCE.md:40` style — *a shared comparison link's preview card is the generic shell's* — rather than pretending it is solved. **Do not re-file the `<title>`-language decision itself; it is 2.12's, owner Juan.**

### D4 — The Team B non-hue channel. YOURS, SOLE OWNER. The hatch ships. Do not re-derive one number.

Routing chain, each link quoted: 2.10 filed the evidence with **Owner:** *"whichever of 2.13 / 2.15 / 2.16 / 2.17 lands first"* (`deferred-work.md:806`). 2.13 ruling 2 routed it to *"2.16 / 2.17"* — *"the first real two-team surface is a profile or comparison chart"* (`deferred-work.md:2383-2387`). 2.16's D1 killed the profile half — *"no chart on `/teams/{slug}` plots two teams. The Team B channel is NOT this story's — route it onward to Story 2.17, the genuine first two-team surface."* 2.15's shipped code says the same in place (`ProfileCharts.tsx:46-49`). `DESIGN.md:266` scopes the pair to *"Head-to-head visualizations (Momentum Timeline, pass networks, phases-of-play, **comparison views**)"*. **You are it.**

**THE MEASURED EVIDENCE, CARRIED VERBATIM (`deferred-work.md:785-806`). RE-MEASURING IT IS WASTED WORK:**

| Mark | Dark | Light | Measured against |
|---|---|---|---|
| `--viz-team-a` | **13.56** | **4.99** | `--surface-raised` (the card — never the pitch) |
| `--viz-team-b` | **10.30** | **5.36** | `--surface-raised` |
| team-a vs team-b | **1.32:1** | **1.07:1** | each other — *"which is why a second channel is mandatory at all"* |
| hatch stripe (`--ink-primary`) | **1.53** | **3.30** | its own **solid** `--viz-team-b` ground |

**Why 1.53 dark does not trip decision 10(b), in the decision's own words:** with the hatch over a *solid* ground rather than transparent gaps, *"the measured solid figures … govern, and the hatch only adds texture"*. WCAG 1.4.11's 3:1 floor applies to the mark against its background — **10.30 / 5.36**, which passes in both themes — not to a mark's internal texture.

**THE BINDING CONCLUSION (`deferred-work.md:799-806`):** *"the declared dashed-stroke fallback **cannot work on a filled bar at all** — a dashed `--viz-team-b` stroke over a solid `--viz-team-b` fill is invisible … So for BARS the fallback as written is not available, and a future story that needs one should rule a new mechanism rather than reach for it."* A card-coloured stripe is **also** closed — it is the *"transparent gaps"* case 10(b) bans by name.

**RULED — both UX-DR11 channels, per mark geometry:**

- **Channel 1, always, every chart:** direct series labels (the entity's short code at the bar/line end). Never a `<Legend>` — decision 10(a).
- **Channel 2, side B only:**
  - **Filled bars → the 2.10 hatch, copied exactly.** 6×6 `userSpaceOnUse` `<pattern>` with `patternTransform="rotate(45)"`; a solid `<rect fill="var(--viz-team-b)">` ground; a `<line>` at `x1 = x2 = HATCH_TILE_PX / 2` in `var(--ink-primary)` at `strokeWidth={HATCH_STROKE_PX}`; plus a solid `var(--viz-team-b)` stroke at `strokeWidth={1}` on the bar. **Centred, not edge-drawn** — an SVG pattern tile clips rather than wraps, so an edge-drawn 1.5 px stroke renders as 0.75 px with no compensating mark (`TacticalCharts.tsx:332-340`).
  - **Line/area marks → `TEAM_B_DASH_ARRAY` on the stroke**, which is what `MomentumChart` already does and what a filled bar cannot use.
- **Pattern ids must be minted per instance** — `` `compare-b-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}` ``. React 19 emits guillemet-delimited ids (`«r3»`), which are not valid XML NCName start characters (`TacticalCharts.tsx:276-286`).

**No new mechanism is needed and none may be invented.** Every mark form on this route is a bar or a line, and both are already discharged.

### D5 — Per-side entity accents, NOT `viz-single`. This resolves a live ambiguity in the UX docs.

`EXPERIENCE.md:78` says each viz is *"rendered per entity"*, which reads as single-series, and UX-DR11 routes single-series charts to `viz-single`. But **`globals.css:68` declares `--viz-single: var(--viz-team-a)`** — so a naive read paints side A and side B **the same colour**, and the alias's own safety argument (`DESIGN.md:260`: *"safe because single-entity charts have no second series"*) fails the moment two of them sit side by side under one comparison.

`DESIGN.md:266` lists *"comparison views"* under head-to-head, and `DESIGN.md:176-177` defines `entity-a-accent: '{colors.viz-team-a}'` / `entity-b-accent: '{colors.viz-team-b}'` for exactly this component.

**RULED: on `/compare`, side A's chart is `var(--viz-team-a)` and side B's chart is `var(--viz-team-b)` + the D4 non-hue channel. `--viz-single` does not appear on this route.** This is what makes D4 necessary at all; the two rulings stand or fall together.

**Corollary for `type=matches`:** a match chart is inherently two-series (home vs away) and the home/away pair already owns `viz-team-a` / `viz-team-b` inside that chart. **Inside any one chart, the accents mean home and away.** Side A/B identity is carried by the column header's top border and the sticky mini-header **only** — never by series colour. This is `DESIGN.md:260`'s *"One color means one thing per visualization"* held exactly, and `DESIGN.md:338`'s *"The accent border is the only entity color — no full-tinted columns"* held exactly.

### D6 — Build `CompareCharts.tsx`. Do NOT edit `ProfileCharts.tsx` or `TacticalCharts.tsx`'s chart bodies.

`SpeedZoneChart` and `TrendChart` hard-code `fill="var(--viz-single)"` / `stroke="var(--viz-single)"` (`ProfileCharts.tsx:176-178, :278-280`). They cannot serve D5 without a colour prop, and that file is 2.15's — with a **pending 2.16 rename** to `CategoryBarChart` that has not happened (`ProfileCharts.tsx` still exports `SpeedZoneChart` at `:203`).

**RULED: a new `src/components/CompareCharts.tsx`** exporting a `CompareBarChart` and a `CompareLineChart`, each taking `{ colorVar: string; hatch: boolean; … }`. Zero edits to `ProfileCharts.tsx`. Zero regression surface on 2.15's four shipped mounts. Zero risk from 2.16's rename landing under you.

**IT MUST BE EXPORTED FROM `src/components/Charts.tsx` AND REACHED BY NO OTHER `dynamic()` SPECIFIER.** `Charts.tsx:37-41`: *"ADDING A CHART? EXPORT IT HERE. A chart reached by any other `dynamic()` specifier mints a fresh chunk group and a fresh vendor copy — the precise defect this file exists to remove. This module holds re-exports ONLY: it must never grow logic."* Add one line to the barrel; nothing else.

### D7 — The chunk pass condition is "still exactly ONE vendor chunk", measured before and after.

**The ledger and a shipped test are both STALE and you must not trust either.** `deferred-work.md:807-820` records two 300.4 KB vendor chunks, and `static-output.test.ts:364-375` still asserts *"There are exactly two recharts import specifiers in the app and the vendor duplication is PER SPECIFIER."* 2.15 fixed it with `Charts.tsx` and **filed nothing**.

**Measured live on the current `out/` at story creation: exactly ONE vendor chunk — `1sxly1jl9kd60.js`, 367,636 B raw / 105,253 B gzip — and it is referenced by ZERO route HTML.** Three recharts leaves now share it.

The classifier, run before your first edit and again after your last:

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

**Pass = exactly one line classified `VENDOR`.** Discriminate on `CartesianAxis` **AND** `Brush` **AND** `redux` together — `CartesianAxis` alone also matches a leaf. **Do not assert a byte count**; the vendor grew 300.4 → 367.6 KB when the leaves folded in, and it will grow again with yours. Assert the *count*, record the *size*. `static-output.test.ts:364-375`'s stale two-specifier comment is corrected in the same task.

### D8 — The derivation whitelist. Enumerate every derived value and check each against AD-5.

`ARCHITECTURE-SPINE.md:74`, the clause written *for this surface*:

> Comparison mode renders each side's precomputed values verbatim; the App may derive **presentation geometry only** (shared axis domains, leader-accent determination between two displayed values) and never displays a derived cross-entity number (no deltas, no ratios) unless it ships in an artifact.

That clause exists because `review-adversary.md:97-101` (finding **M2**) constructed both failure modes — *"One under-builds (mismatched axes …), one over-builds (client-derived cross-match numbers on screen …)"*. **M2 is closed in the spine. You inherit the resolution, not the question.**

**THE COMPLETE LIST OF DERIVATIONS THIS ROUTE PERFORMS. Anything not on it is a defect:**

| Derivation | Displayed? | Verdict |
|---|---|---|
| shared axis `domain` + `ticks` across A and B | as axis geometry + tick **labels** | **LICENSED** — named in AD-5. Tick labels are the axis's own scale, not a cross-entity number. |
| `resolveLeader(aValue, bValue)` → `"home" \| "away" \| "tie"` | as an accent + ▲ + «líder» | **LICENSED** — named in AD-5. |
| selecting which metrics to show | — | **LICENSED** — AD-5 permits *"filter, select"*. |
| user-initiated re-ordering | — | **LICENSED** — AD-5, and only user-initiated. |
| `Intl` number/date formatting | yes | **LICENSED** — AD-7 puts all formatting in the App. |
| A − B, A ÷ B, "+3 more", "12% better", a difference column, a combined total, a rank between the two | — | **BANNED.** No exceptions. |
| a chart series computed from both sides (e.g. a difference bar) | — | **BANNED.** |
| a sparkline of the gap | — | **BANNED.** |

Write this table into the Completion Notes with each row marked as implemented or absent. AC 3 is the only AC a reviewer can check purely by reading your diff, and this is how you make that cheap.

### D9 — `seriesLabelIndex`'s `-1` sentinel is YOURS. The ownership condition finally fires.

The ledger's owner line is *"the first successor story to reuse `DistributionChart`"* (`deferred-work.md:837`). 2.13 did not reuse it. 2.15 did not (*"You do not reuse it. Leave it routed."*). 2.16 does not. **`type=matches` renders a two-series home/away distribution — you are the first.**

**Verified present at this baseline, `TacticalCharts.tsx:238-247`:**

```ts
function seriesLabelIndex(values: readonly number[]): number {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[best]) { best = index; }
  }
  return best;
}
```

`best` starts at `0` and the comparison is strict `>`, so an all-equal series (the all-zero case included) returns `0` for **both** series and `SeriesEndLabel` anchors both team codes at the axis origin, overlapping. That is decision 10(a)'s primary UX-DR11 channel failing silently.

**RULED — the recorded remedy, and it is two lines.** Return `-1` when no value beats the first. `SeriesEndLabel`'s existing guard (`TacticalCharts.tsx:212-214`, `if (index !== labelIndex) return null`) is **already sentinel-compatible** — no bar index equals `-1`, so the label suppresses itself. Add the co-located test; there is none today. **This is the only edit you make to `TacticalCharts.tsx`.**

**The ledger's citation `:229-237` has drifted to `:238-247`. Correct the citation when you close it.**

### D10 — Mirrored rows: DOM order is label → A → B; the *visual* order is A → label → B.

`DESIGN.md:338` is the spec: *"Entity header (name, crest placeholder, meta) top-bordered 2px in its entity accent; mirrored stat rows share a centered label. The accent border is the only entity color — no full-tinted columns."* **The reading order is a genuine spec gap and is ruled here.**

**RULED:** a three-column CSS grid per row. **DOM order: `label`, `A value`, `B value`.** Visual placement by explicit grid column — label in column 2, A in column 1, B in column 3. A screen reader therefore hears *"Posesión — 54% líder — 46%"*, which is the meaningful sequence (1.3.2); a sighted reader sees the mirrored layout. Focus order is unaffected: the only focusable child of a row is a `GlossaryTerm` inside the label, which correctly comes first.

- **Not a `<table>`, and not ARIA table roles.** These are paired scalars under a shared label, not a grid of records; `DataTable` is do-not-touch and its sort contract is meaningless here.
- Values carry `tabular-nums` — **mandatory** in comparison columns (`DESIGN.md:301`).
- At `<md` the three columns collapse to `label` above a two-up value row; the label stays first in DOM either way, so nothing about the announcement changes.
- **No column-gap token exists in the design system.** Use `gap-tile-gap` (12px) and say so in the Completion Notes.

### D11 — Composed copy: `…Before` / `…After` fragments hoisted into a `const`. Never inline.

`t()` takes `(key, locale)` and nothing else (`i18n.ts:46`). The shipped idiom is `EmptyStatePanel.tsx:60-64`, whose docblock states the rule: *"`t()` carries no interpolation by design, so the headline is composed around an already-resolved title."* 2.14 uses the same idiom three times (`search.noResultsBefore`/`After`, `search.cappedBefore`/`Middle`/`After`).

**`{t(a)} {value} {t(b)}` IN JSX EMITS LITERAL WHITESPACE CHILDREN AND FAILS THE i18n GATE.** Build the sentence into a `const` string, then render `{sentence}`.

**Ruled copy** (both strings are **RULED, not proposed** — `EXPERIENCE.md:93-94` quotes the Spanish verbatim, so you implement rather than author):

- Empty: `"Elige dos "` + *(resolved plural type word)* + `" para comparar."`
- Invalid: `"No encontramos "` + *(the raw slug)* + `". Elige de la lista."` — **note the AC truncates this; `EXPERIENCE.md:94` carries the second sentence and it ships.**

**Neither string has an English variant anywhere in the UX docs.** You author the `en` half under the same per-term procedure and append a policy row.

### D12 — Type-selector labels: MINT `compare.type.*`, and here is why that is not a duplicate.

This is the sharpest reuse-vs-mint question in the story, and it must be argued in the diff, not decided silently.

**The pressure against minting.** `EXPERIENCE.md:322` is binding and specific: *"**Entity-type labels are deliberately NOT a new row.** A search result's kind is labelled with the already-ruled `viz.table.player` / `viz.table.team` / `hub.results.column.match` — 'Jugador' / 'Equipo' / 'Partido'. A second pair of names for those terms is precisely the drift `leaderboards`' docblock rules against."* And the plurals already exist: `leaderboards.scope.player` = `"Jugadores"`, `leaderboards.scope.team` = `"Equipos"`, `player.appearances.played` = `"Partidos"`.

**Why minting is nonetheless correct.** Those are three different things in three different registers, and reusing them would be the *worse* drift:

- `viz.table.*` are **singular column heads**. AC 1 names the selector *"Jugadores/Equipos/Partidos"* — plural. A column head is not a filter label.
- `leaderboards.scope.*` carries a docblock scoping it to *"what the whole board ranks"* — board vocabulary on a non-board surface, the same objection 2.14 raised when it declined `leaderboards.filterLabel`.
- `player.appearances.played` = `"Partidos"` is a **counter label on one player's appearance line**. Reusing it as a type-selector segment is a coincidence of spelling, not a shared term.
- There is **no `"Partidos"` plural in the entity vocabulary at all** — `hub.results.column.match` is singular. So even a full reuse strategy would have to mint one of the three, leaving the selector with two homes for one concept.

**RULED: mint `compare.type.players` / `.teams` / `.matches` as a coherent triple, and append an `EXPERIENCE.md` policy row recording this analysis.** **Juan may overturn this; see Open Questions.**

**DO NOT AUTHOR A `compare.*` NO-DUPLICATE SWEEP, AND DO NOT INVENT SYNONYMS TO DODGE ONE.** Several story specs in this epic — 2.16 Task 10.4 among them — assert that *"a value that already exists verbatim elsewhere is a second home for one term, and `i18n.test.ts` enforces it."* **That is not what the suite enforces.** The only such sweep is `i18n.test.ts:2304`, which 2.14 authored and scoped to `dictionary.search`; nothing checks any other namespace. Duplicate values across namespaces are normal and in places **deliberately pinned** — `i18n.test.ts` asserts `es.expert.field.ballProgressions` *equals* `es.enums.metric.ballProgressions`, and `enums.metric.*` / `enums.leaderboardMetric.*` ship identical strings for `possession`, `shots`, `expectedGoals` and `distanceCovered`. Copying 2.14's sweep here would manufacture a gate that does not exist and push you toward awkward near-synonyms for `"Jugadores"`. **The real distinctness gate in this suite is the composed caption inventory** (`new Set(shipped).size` against hardcoded counts at `i18n.test.ts:1568`, `:1569`, `:1576` — three literals for two numbers, which 2.16 also edits). Reconcile those only if you add a `DataTable` caption.

The house rule that *does* bind is reuse-first (2.11a decision 1, no private copies): reuse an existing key whenever the term is genuinely the same. D12's four bullets are the argument that these three are **not** the same term — that argument is the justification, not a gate exemption.

**Note the URL values are English enum codes** (`players|teams|matches`, `EXPERIENCE.md:43`) while the labels are Spanish. That mapping is the locale layer's job (AD-7); the URL never carries a display string.

### D13 — The sticky mini-header (UX-DR17). Net-new; there is no `IntersectionObserver` in this codebase.

`EXPERIENCE.md:134`: *"vizzes stack A above B with a sticky mini-header naming whose viz is on screen"*. `grep IntersectionObserver app/src` returns **zero**. No measurement is given for it anywhere in the UX docs.

**RULED:**

- `sticky top-14 z-30`. `SiteHeader` is `sticky top-0 z-40` at `h-14` (`SiteHeader.tsx:67-68`) — the mini-header nests **under** it in both offset and stacking.
- **Visibility is CSS (`md:hidden`), not JS.** `hidden` is `display: none`, which removes the element from the accessibility tree, so exactly one header is exposed at any width — the reasoning `HeaderSearch.tsx:60-72` already ships.
- **The observer is gated on `useMediaQuery(MD_MEDIA_QUERY) === false`** so it does no work at `≥md`. `useMediaQuery` **is** permitted here — unlike in `HeaderSearch`, this region mounts only after the client fetch resolves, so there is no server markup to mismatch (the `TacticalLayer.tsx:47-56` precedent, stated in place).
- Announce the change through a polite live region, and **do not** move focus.
- **`scroll-padding-top` must equal header + mini-header height**, or a focused row lands underneath it — `EXPERIENCE.md:76` already rules this for sticky table headers.
- **VERIFY IT LIVE.** `deferred-work.md:1134-1152` records twenty-two sticky headers that shipped green and **silently did not stick** — *"Verified live at Task 9.2: `getComputedStyle(thead).position === 'sticky'` is 0 across all 22."* A sticky child of a non-scrolling ancestor never offsets. Assert `getComputedStyle(el).position` in the browser pass, not in a test.

### D14 — Leader treatment: reuse `resolveLeader`, `▲`, and the shipped «líder». Mint none of them.

`review-accessibility.md:26` filed this as **[high]**, naming this surface: *"'leading values carry each side's entity accent' (EXPERIENCE → UJ-3 step 4, Comparison column) encode *who leads* by color alone — a direct 1.4.1 fail on the Hero head-to-head tiles … and Comparison Mode."* The fix is already shipped for the Hero and is reused verbatim here.

- **`resolveLeader(a: number, b: number): "home" | "away" | "tie"`** — `match-hero.ts:146-156`. **Do not mint a second.** Ties get **no** marks.
- **`const LEADER_GLYPH = "▲"`** — `StoryStatTiles.tsx:22`. A module `const`, never a bare JSX literal; the i18n gate fires on literals.
- The glyph is `aria-hidden`; the accessible name gets an `sr-only` span carrying **`match.hero.leader` = `"líder"`, which already ships** (`es.ts:472`).
- Accent classes: `text-viz-team-a` / `text-viz-team-b` (`StoryStatTiles.tsx:38`).

**`StoryStatTiles` itself is NOT widened.** `ProfileStatTiles.tsx:5-26` already ruled why: *"Widening `StoryStatTiles` would mean making `awayValue`, `homeCode`, `awayCode` and `leader` optional on a component whose whole job is comparing two of them, which is how a comparison component quietly becomes a component that sometimes compares."* You are the third case in `EXPERIENCE.md:73`'s trio; build the third component and reuse the primitives.

---

## R1 — OPEN RULING FOR JUAN: what does `type=matches` actually compare?

**The situation.** `players` and `teams` are clean: each side is one entity with one flat set of precomputed scalars. **A match is not.** `MatchBundle` is already two-sided — `storyStats`, `keyStatistics` and `tacticalIdentity` each carry `{ home, away }`. Comparing two matches therefore compares **four team-innings**, and there is almost nothing in a bundle that is a genuine match-level scalar: `keyStatistics.contestedPossession` and the score, and that is close to all of it.

**Why it cannot be solved by arithmetic.** The obvious move — sum or average home and away into a match total — is a **displayed derived number** and is banned outright by D8/AD-5. There is no artifact that ships a match-level total.

**The gap in the documents.** `EXPERIENCE.md:34` says only *"Two players, two teams, or two matches side by side"*. `prd.md:331-344` (FR-29) says only *"two matches"*. `epics.md:969` names the type in the selector and nothing else. **No document anywhere states which measures a match-vs-match comparison shows.** `review-adversary.md`'s M2 raised match-vs-match by name but closed only the derivation question, not the content question.

**Recommended (A) — a side is a whole match, rendered as its own two-team block.** Each side shows that match's `storyStats` (5 paired tiles) and its `keyStatistics` mirrored rows via the **already-shipped `buildKeyStatRows(keyStatistics)`** (`tactical-sections.ts:276`), with the shipped home/away accents inside the block and `resolveLeader` giving the within-match leader. Cross-side comparability comes from the **shared axis domain across all four series** — the one licensed derivation. Side A/B identity lives in the header top border and the mini-header only (D5's corollary).

- **Reuses everything and derives nothing.** `buildKeyStatRows`, `KEY_STAT_FIELDS`, `KEY_STAT_FORMAT`, `resolveLeader` and `DistributionChart` all ship today.
- **Holds `DESIGN.md:260` exactly** — inside any one chart the two accents mean home and away, one meaning per colour.
- **Costs the most payload of the three types** (see Data Reality) but stays far inside budget.

**(B) — restrict `matches` to the handful of true match-level scalars.** Honest and cheap, but the resulting surface is three or four rows and does not plausibly *"replace manual notes across a dozen PDFs"*.

**(C) — drop `Partidos` from the selector for now.** Cleanest engineering, but it contradicts FR-29 and the AC verbatim, and 2.19 would inherit a half-built type selector.

**Proceed under (A).** If Juan overturns it at review, only the `matches` branch of the section registry changes; the shell, the picker, the URL layer and the players/teams branches are untouched by the choice. Everything shipped under (A) is flagged in the Completion Notes as **RULED UNDER R1 — Juan to confirm or overturn**.

---

## Route Composition

The disclosure grammar, defined once at `EXPERIENCE.md:209`: *"headline aggregates first (hero altitude), tactical identity/trend visualizations second, full per-match tables last."*

**Ruled section order** (identical for all three types; the *content* of each section is type-dispatched):

1. **Picker region** — always present, never hidden. Type selector + two search-selects + swap-sides. This is the "picker-first" state's home and stays mounted once a comparison renders, because AC 1 requires selections to keep updating the URL.
2. **Header row** (`<h2>` per side, `sr-only` where the visual header carries the name) — entity name, meta, and the **2px accent top border**. `border-t-2 border-viz-team-a` / `border-viz-team-b`.
3. **Mirrored stat rows** (`<h2>`, `id="stats"`) — D10's grid.
4. **Vizzes** (`<h2>`, `id="charts"`) — one chart per entity, shared domain, D5 accents, D4 channel. The `<md` sticky mini-header (D13) belongs to this section.

**No collapsible section shell.** `TacticalSection` is do-not-touch and its `id` is typed to the closed eleven-member `SectionId`. **Do not widen `SectionId`.** Sections are plain `<section>` + `<h2>` with stable **English** anchor ids (`deferred-work.md:2236-2243`).

**Every viz needs its data-table alternative** via `ViewDataDisclosure`, and **every use is `surface="canvas"`** — `"pitch"` is the default and computes **1.10:1**, an invisible control, on a `--surface-raised` card.

Spacing: `section-gap` (48px) within a layer, `layer-gap` (64px) at the picker → comparison boundary.

**Page wrapper:** `<div className="mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">` — **`pb-`, not `py-`**; every shipped route uses `pb-`.

**The `md`→`lg` band is unspecified in the UX docs.** `EXPERIENCE.md:125-134`'s responsive table has only `≥lg` and `<md` columns. **RULED: the two-column layout begins at `md`, and the `<md` stacked treatment plus the sticky mini-header applies below it** — this matches where every other breakpoint decision in the app sits and keeps one threshold, not two. Record it as a ruled gap-fill.

---

## The URL Contract

**Canonical form:** `/compare/?type={players|teams|matches}&a={id}&b={id}` — slash before the query, ids not display names.

**Reads.** D1's `useUrlQuery()`. Parse with `new URLSearchParams`. `type` falls back to `players` when absent or unrecognised.

**Writes.** Two kinds, and they are not the same:

- **User-initiated** (pick, swap, type change) → this is the shareable-state write. Measure `router.replace` vs `history.replaceState` with `performance.getEntriesByType("resource").length` before and after, and **record the number**. `router.replace` may fetch `out/compare/index.txt` (the RSC payload — you can see it in `out/`); `history.replaceState` costs zero network but does not notify the App Router, which is harmless because D1 does not use `useSearchParams`. **There is no in-repo precedent for either; this is a measurement, not an assumption** — Story 2.6 decision 21 is the standing lesson that what a route "loads" must be measured on the built export, never inferred.
- **Invalid-param cleanup** (AC 5's *"invalid param dropped from URL"*) → `history.replaceState`, once, on the render that detects it. **Guard it against re-entry** — the notifier you added in D1 will fire your own subscription, and an ungated write is an infinite loop.

**Swap-sides is a URL rewrite, nothing else.** `a` and `b` exchange values and the component re-renders from the new query. **No component state may hold the comparison** (AR-10). If you can break the page by editing the address bar, you have held state you should not have.

**Validation order, which decides which of the three states you show:**

1. `type` missing/unknown → treat as `players`, drop the bad param.
2. `a`/`b` both absent → **empty state**.
3. A slug present but **not in the route manifest** → **invalid state** for that side; the *other* side is preserved and still renders; the bad param is dropped.
4. Both present and in the manifest → fetch both.

**Validate against the manifest, not against a 404.** `tournament.json`'s entity lists **are** the route manifest and the Pipeline asserts one artifact per listed entity (AD-4 / adversary H3), so a manifest hit guarantees an artifact. A failed fetch after a manifest hit is a genuine `error` (retry may help), which is a different state from `invalid` (retry cannot). Conflating them is the bug 2.14 was careful to avoid.

---

## Data Reality — re-verify before designing

**Measured on the built export at story creation. HEAD has moved under a story before. Task 1 re-measures all of it.**

### What the route fetches

| Artifact | When | Path |
|---|---|---|
| `tournament.json` | always — picker corpus **and** slug validator | `loadTournamentIndex()` |
| player profile ×2 | `type=players` | `/index/player-profiles/{id}.json` |
| team profile ×2 | `type=teams` | `/index/team-profiles/{id}.json` |
| match bundle ×2 | `type=matches` | `/matches/{id}.json` |

**Maximum three artifacts. AC 1's "exactly the two entities' bundles/index slices" is about the entity artifacts; the index is the picker's corpus and the manifest, and it is shared with the header search through `loadTournamentIndex()`'s module-scope promise — so on a page where the reader has also used search, it is fetched once, not twice.** State that reconciliation in the Completion Notes.

### Measured sizes (real `/data`, gzip -9)

| Family | count | max raw | notes |
|---|---:|---:|---|
| `index/tournament.json` | 1 | 409,524 B / **38,625 B gzip** | dominates every type except `matches` |
| `index/player-profiles/*` | 1,248 | 11,741 B | two sides ≈ **2 KB gzip** |
| `index/team-profiles/*` | 48 | 5,974 B | two sides ≈ **2.6 KB gzip** |
| `matches/*` | 104 | 212,713 B | two sides ≈ **24 KB gzip** — the budget item |

**FR-34 verdict: comfortable.** Worst case (`type=matches`) lands near **63 KB gzip** for the whole route against the **500 KB** cap. Note the doc gap and do not paper over it: **AD-4 enumerates exactly three route-payload sets — Match Bundle, profile artifact, and `tournament.json` + `leaderboards.json` combined — and `/compare` is not one of them.** The adversary review closed that hole for the Hub only (`review-adversary.md:33-41`, C3). File the gap; the risk is nil on real data.

**`/compare` also carries no Lighthouse target.** NFR-1 names only the Match Dashboard and the Hub. Its JS weight is ungoverned by any written rule — which is exactly why D7's chunk count is the gate you self-impose.

### Fixture-scale disclosures — expect these, do not "fix" them

- The fixture index carries **1 team, 2 players, 4 matches**. The picker will look almost empty. That is the corpus, not a bug.
- **Zero non-ASCII characters in the fixture index**, so the search fold's accent-insensitivity is not browser-verifiable here. Already filed, **owner 2.19** — do not re-file.
- `DATA_ROOT` is `/data/fixtures`; the real tree also ships to `out/data/`. The two `DATA_ROOT` constants (`data.ts:7`, `build-data.ts:25`) **flip together at 2.19** and neither is yours.

---

## The Recharts Contract — copy it exactly

From `TacticalCharts.tsx:41-65`, obeyed identically by `ProfileCharts.tsx`:

- **`accessibilityLayer={false}`** — v3 defaults TRUE and installs `role="application"`.
- **`isAnimationActive={false}`** — the reduced-motion CSS kill switch does not reach recharts' JS animation.
- **Explicit `ticks` AND `domain`, never degenerate.** Never rely on recharts' generation — on m074 it emitted four unevenly-spaced ticks with **no zero tick**, and the ledger filed that finding against successors by name.
- **Colours as `var(--token)` presentation props**, never Tailwind `fill-*`.
- **Tick text** via `{ className: "type-caption tabular-nums", fill: "var(--ink-secondary)" }` — `type-caption` carries no `font-variant-numeric` on its own.
- **NO `<Tooltip>`** (hover-only, banned by UX-DR15). **NO `<Legend>`** — direct labels only (decision 10(a)).
- Axis titles via `<Label>`, never `name` — `name` feeds only the banned tooltip/legend payloads.
- **A parent with a RESOLVED HEIGHT.** A height-less `ResponsiveContainer` renders nothing. **Height classes are literal `const`s from a pure model, never arithmetic** — `` className={`h-[${n}px]`} `` is a class Tailwind v4 never generates.
- **Only `import type` may cross into a chart module.** A value import re-links recharts onto the critical path — that is Story 2.6 decision 21's measured defect.
- The `loading` fallback needs `aria-busy="true"` **and an explicit height class from the same pure function the chart uses** — the `skeleton` utility supplies no dimensions, so an unsized fallback collapses to ~0 px and costs a CLS hit.
- **`sr-only` does not work on SVG `<text>`.** A category-axis title that cannot ride a `<Label>` goes in an HTML `<span className="sr-only">`.
- **`role="img"` when the chart sits inside a `<figure>`; `role="figure"` only when it is the top-level surface** — *"a named figure around a named img gives the reader two competing accessible names."*
- **The chart resolves NO copy.** Every string arrives pre-resolved. The i18n ESLint gate does not reach recharts' object-shaped props — this is discipline, not enforcement.
- **House prop name is `figureSummary`.** `label`, `description`, `caption`, `title`, `text`, `heading`, `message` and `tooltip` are all on the sixteen-name gated list; a component prop named from that set cannot be called with a literal anywhere.

**Axis generators — pick the right family and do not re-mint one.** `percentTicks` / `percentAxisMax` (`phases-model.ts:289, :329`) for rates; `countTicks` / `countAxisMax` (`goalkeeping-model.ts:711, :741`) for counts; `decimalAxis` (`player-profile-model.ts:410`) **for lines only** — its own docblock rules it out for bars: *"a bar encodes its LENGTH, so truncating its baseline misstates it."* All of them floor the max so `[0, 0]` is impossible.

---

## The Shared-Domain Seam — where each entity type gives you one

This is the single most important reuse detail in the story, and the three types differ.

- **Players — no source change needed at all.** `trendAxis(unit, values)` (`player-profile-model.ts:473`) and `speedZoneAxis(metres)` (`:490`) both take a flat `readonly number[]` and derive the domain from that array's extrema. **A shared domain is `trendAxis(unit, [...aValues, ...bValues])`.** Carry the guards: empty ⇒ `{ticks:[0,1],min:0,max:1}`; flat/single-point ⇒ padded ±1 step, because recharts cannot scale `[n, n]` and 209 zero-appearance players plus 191 one-match players make that the common case, not the edge.
- **Teams — the seam is PRIVATE and the file is 2.16's.** `rowsPeak` (`team-profile-model.ts:148`) and `toRateChart` (`:156`) are unexported, and `identityCharts(profile)` hardcodes one `TeamProfile`. **Do not edit that file.** `phases-model.ts` already exports exactly what you need: `PhaseRow { key, code, labelKey, home, away }` (`:170`) and a **two-series** `rowsPeak(rows)` (`:345`) that maxes over `home` and `away` together. **Build `PhaseRow`-shaped rows, not `CategoryRow`-shaped ones**, and the shared domain falls out. `phases-model.ts` is marked read-only by both 2.15 and 2.16 — consume it, never edit it.
- **Matches — `buildKeyStatRows(keyStatisticsBlock)`** (`tactical-sections.ts:276`) already returns mirrored two-sided rows over `KEY_STAT_FIELDS`, with `KEY_STAT_FORMAT` and `KEY_STAT_UNIT` beside it. `tactical-sections.ts` is do-not-touch; consume it.

**`distributionChartHeightClass` is typed `3 | 4 | 8 | 9` with an exhaustive `never`** — calling it with any other count is a compile error and a runtime throw. Size your category sets accordingly or mint your own literal-class function in your own model module.

---

## Architecture Compliance

| Rule | Obligation |
|---|---|
| **AR-5 / AD-5** | D8's whitelist. Presentation geometry only; never a displayed cross-entity number. |
| **AR-10 / AD-10** | URL is the only comparison state. No state library, **no client cache layer** — a repeat comparison re-fetches. Context only for locale and theme. |
| **AR-11 / AD-11** | Exactly two data paths. Build-time filesystem read for the shell; client `fetch` for everything else. No third path, no inlining. |
| **AR-13 / AD-13** | `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`. No functions, no middleware, no redirects, zero external requests. |
| **AD-3** | The entity id **is** the slug, permanently. `?a=`/`?b=` carry ids. |
| **AD-2** | Types generated from `/contract`. Never a hand-written mirror. `SCHEMA_VERSION = 4`; validate it per artifact and distinguish `invalid` from `error`. |
| **AD-7** | Artifacts carry raw numerics and enum codes. All `Intl` formatting is the App's job; all arithmetic is not. |
| **NFR-4** | Excluded by enumeration — see D3. |
| **UX-DR16** | 320 CSS px reflow; 200% zoom; ≥44×44 px targets; `prefers-reduced-motion`. `review-accessibility.md:53` names *"the comparison stack"* as unverified at 320px **by name** — you are the story that verifies it. |

**Placement rules. Only the last two are LINT-ENFORCED** (`eslint.config.mjs:183-219`, and it applies to `.test.tsx` too — **no test exemption**). The first three are house conventions with no gate:

- *(convention)* New pure model code → `src/viz/**` with a co-located `<module>.test.ts`.
- *(convention)* Anything importing `@/lib/format` goes in `src/lib/`, not `src/viz/`.
- *(convention)* Components → `src/components/`, **never** `src/components/ui/` (vendored). Do not create a new top-level `src/` directory.
- *(ENFORCED)* `src/components/**` and `src/viz/**` may not import `t` from `@/lib/i18n` — use `useT()`.
- *(ENFORCED)* `src/components/**` and `src/viz/**` may not import `@/lib/build-data` **at all**.

**`t()` has NO INTERPOLATION.** Compose into an identifier, never inline in a gated prop.

---

## Reuse Inventory — build none of these

| Need | Use | Never |
|---|---|---|
| tournament index | `loadTournamentIndex()` (`tournament-index.ts:96`) | a second fetch. **The call is spelled verbatim and must stay so** — `static-output.test.ts`'s module-graph regex needs an explicit non-nested generic and an inline string literal |
| any artifact fetch | `fetchArtifact<T>("literal")` (`data.ts:14`) | `fetch` directly; a path built from a variable |
| search corpus + matching | `searchEntities`, `searchResults`, `countResults`, `matchSpan` (`search-model.ts`) | a second matcher. **Type-scoping needs NO model change** — pre-filter `corpus.filter(e => e.kind === scope)` and pass the array in |
| the combobox itself | `HeaderSearch.tsx`'s `SearchField` — **export it, or lift it to its own module** | forking it. 2.14 ruling 2: *"EXPERIENCE.md's Comparison entity picker (2.17) specifies the same primitive — **build so 2.17 can reuse it**"*. `cmdk` is **not installed**; the combobox is hand-rolled on Radix + primitives |
| leader | `resolveLeader` (`match-hero.ts:146`) | a second comparator |
| leader glyph / word | `LEADER_GLYPH` (`StoryStatTiles.tsx:22`), `match.hero.leader` (`es.ts:472`) | minting «líder» again |
| match mirrored rows | `buildKeyStatRows` (`tactical-sections.ts:276`) | re-deriving 19 fields |
| rate axes | `percentTicks` / `percentAxisMax` (`phases-model.ts`) | a new tick generator |
| count axes | `countTicks` / `countAxisMax` (`goalkeeping-model.ts`) | a new tick generator |
| two-series peak | `rowsPeak(rows: PhaseRow[])` (`phases-model.ts:345`) | the private one in `team-profile-model.ts` |
| empty states | `EmptyStatePanel` (`headline` / `explanation`, both pre-resolved) | a new panel. **Not `useEmptyHeadline()`** — it composes *"para este partido"*, false on this route; the Hub and 2.15 both hit this wall and both minted their own pair |
| linked rows | `RowAnchor` (`RowAnchor.tsx:88`) | a third private copy. Two survive at `TournamentHub.tsx:95` and `PlayerMatchesSection.tsx:69` — **do not add a fourth; file it if you cannot repoint them** |
| lazy chart mount | `dynamic(() => import("@/components/Charts").then(m => m.X), { ssr: false, loading: … })` | any other specifier — it mints a fresh ~370 KB vendor chunk |
| breakpoint in JS | `useMediaQuery(MD_MEDIA_QUERY)` (`use-media-query.ts`) | a hardcoded px literal |
| text compare / fold | `compareText`, `foldForSearch` (`format.ts`) | `localeCompare`, `toLowerCase` |
| formatting | `@/lib/format` — it **throws** on non-finite input, so guard at model entry | hand-formatted numbers |

---

## Tasks / Subtasks

### Task 1 — Baseline, coordination, re-verification (BLOCKING; all AC)

- [x] 1.1 Confirm `git rev-parse --short HEAD` is `79bd7aa`. **If it moved, re-verify every measured number in this file before designing anything** — it has moved under a story in this epic already.
- [x] 1.2 Run the full chain (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`) **before your first edit** and record pre-existing failures. Two sessions are writing `app/`. **Do not repair another story's half-landed work.** Chunk the test run; long runs get killed.
- [x] 1.3 `git status --porcelain app/src app/../_bmad-output`. Record which of `team-profile.ts`, `TeamHero.tsx`, `ProfileCharts.tsx`, `PhysicalSection.tsx`, `EXPERIENCE.md` are dirty. **D2's and D6's coordination conditions branch on this.**
- [x] 1.4 Re-run D7's chunk classifier on the **pre-existing** `out/` and record the baseline line(s).
- [x] 1.5 Re-measure the four artifact families in Data Reality against the tree you actually have.
- [x] 1.6 Verify `seriesLabelIndex` is still unfixed at `TacticalCharts.tsx:238-247` and that the `InvolvementChart` hatch **is** centred at `:546,:548`. **Record 2.15's fix; never claim it.**

### Task 2 — The URL layer (AC 1, AC 2, AC 5, AC 6; D1, D2)

- [x] 2.1 `src/lib/use-url-query.ts` — `useUrlQuery()` on `useSyncExternalStore`, per D1. Primitive snapshot, `""` server snapshot, `popstate` + module notifier, guarded listeners.
- [x] 2.2 `src/lib/compare-url.ts` — `CompareType`, `compareHref`, a parser returning `{ type, a, b }`, and a writer. Pure; co-located test.
- [x] 2.3 Repoint `PlayerHero.tsx:195` at `compareHref`. **`players/static-output.test.ts:201,204` must stay green byte-for-byte.**
- [x] 2.4 Repoint `TeamHero.tsx` / delete `compareTeamHref` — **only if D2's coordination condition allows**. Otherwise file it.
- [x] 2.5 Swap-sides: rewrite the URL only. Assert in a test that no component state holds `a`/`b`.
- [x] 2.6 Invalid-param drop via `history.replaceState`, **re-entry-guarded**.
- [x] 2.7 **Measure** `router.replace` vs `history.replaceState` with `performance.getEntriesByType("resource").length` and record both numbers.

### Task 3 — Route shell and the three states (AC 1, AC 5; D3, D11)

- [x] 3.1 `src/app/compare/page.tsx` — server shell, no `generateStaticParams`, **no `metadata`** (D3), client body.
- [x] 3.2 `src/components/CompareRegion.tsx` — `"use client"`, the four-state machine (`loading` / `loaded` / `error` / `invalid`) matching `PlayerProfileRegion.tsx:24-62`. `"invalid"` has **no retry** — a retry cannot change the answer.
- [x] 3.3 Empty state, partial (single-column) state, invalid-slug state. **Valid side preserved, invalid param dropped.**
- [x] 3.4 Exactly one `SortAnnouncerProvider` for the route, in the region.
- [x] 3.5 Wrap everything that can throw in `TacticalErrorBoundary`.

### Task 4 — The picker (AC 1; D12)

- [x] 4.1 Export `SearchField` from `HeaderSearch.tsx` (or lift it to its own module, moving `HeaderSearch.test.tsx:462-475`'s source-path assertion with it). Add an optional `onSelect?: (entity: SearchEntity) => void`; when present, rows render as `<button type="button">` rather than `<Link>`.
- [x] 4.2 Type-scope by pre-filtering the corpus on `kind`. **No `search-model.ts` change.**
- [x] 4.3 Type selector — three segments, `compare.type.*` (D12). ≥44×44px targets.
- [x] 4.4 Two independent selects, each with its own `useId()` triple. **Overlay depth stays 1, page-wide** (UX-DR15) — two open listboxes at once is a violation.
- [x] 4.5 `<md` sheet behaviour reused from 2.14; **CSS `hidden`/`md:hidden`, no `useMediaQuery` in the picker**.
- [x] 4.6 Every row `prefetch={false}` if any `<Link>` survives — 2.13 measured default prefetch taking resource count 48 → 75.

### Task 5 — Pure models (AC 3, AC 4)

- [x] 5.1 `src/viz/compare-model.ts` + co-located test — the mirrored-row model, the shared-domain functions per type (see The Shared-Domain Seam), the height-class `const`s.
- [x] 5.2 `src/lib/compare-format.ts` + test — anything touching `@/lib/format` lives here, not in `src/viz/`.
- [x] 5.3 **Every expectation is a fixture literal.** *"An expectation built by the function under test reproduces that function's bugs and can only prove it was called."*

### Task 6 — Mirrored stat rows (AC 3; D10, D14)

- [x] 6.1 `src/components/CompareRows.tsx` — three-column grid, **DOM order label → A → B**, visual order A → label → B.
- [x] 6.2 2px accent top borders on the entity headers. **No full-tinted columns.**
- [x] 6.3 `resolveLeader` + `▲` (`aria-hidden`) + `sr-only` «líder». Ties get no marks.
- [x] 6.4 `tabular-nums` on every value.
- [x] 6.5 **Write D8's derivation table into the Completion Notes**, row by row.

### Task 7 — Charts (AC 4; D4, D5, D6, D7)

- [x] 7.1 `src/components/CompareCharts.tsx` — `{ colorVar, hatch, … }`. Copy the Recharts Contract exactly.
- [x] 7.2 The D4 hatch for side B's bars; `TEAM_B_DASH_ARRAY` for side B's lines. Per-instance `useId()` pattern ids.
- [x] 7.3 Direct series labels on every chart, always.
- [x] 7.4 Export from `Charts.tsx`. **One line. No logic in the barrel.**
- [x] 7.5 Shared domains across A and B. Assert in the model test that A's `domain` and B's `domain` are `toEqual`.
- [x] 7.6 `ViewDataDisclosure` per viz, `surface="canvas"`.

### Task 8 — The `<md` stack and sticky mini-header (AC 4; D13)

- [x] 8.1 Stack A above B below `md`; two columns at `≥md`.
- [x] 8.2 `IntersectionObserver`, gated on `useMediaQuery(MD_MEDIA_QUERY) === false`.
- [x] 8.3 `sticky top-14 z-30`, `md:hidden`, polite live region, **no focus movement**.
- [x] 8.4 `scroll-padding-top` = header + mini-header.
- [x] 8.5 **Verify `getComputedStyle(el).position === "sticky"` LIVE.** Twenty-two shipped sticky headers silently did not stick.

### Task 9 — `seriesLabelIndex` (D9)

- [x] 9.1 `-1` sentinel in `seriesLabelIndex`. **The only edit to `TacticalCharts.tsx`.**
- [x] 9.2 Co-located test: all-equal series, all-zero series, normal series.
- [x] 9.3 Confirm `SeriesEndLabel`'s existing `index !== labelIndex` guard suppresses both labels.

### Task 10 — Build, tests, sizing (AC 1)

- [x] 10.1 Full chain green (or no worse than Task 1.2's baseline, with the delta stated).
- [x] 10.2 D7's classifier **after**. Pass = exactly one `VENDOR`. Record the size; do not assert it.
- [x] 10.3 Correct `static-output.test.ts:364-375`'s stale two-specifier comment.
- [x] 10.4 Add the `/compare` per-route allow-list entry. **The walk uses set equality** — `tournament.json` legitimately belongs on this route's list, and it is the artifact 2.14 measured as reachable from no route but `/`. Add the paired "guards the guard" test.
- [x] 10.5 Record the measured payload per type against the 500 KB cap.

### Task 11 — Locale, terminology, contrast, reflow

- [x] 11.1 Append a `compare` namespace at the **tail** of `es.ts`, then mirror in `en.ts` at the same position. Pure tail append, **after** `player` (and after `team` if 2.16 has landed).
- [x] 11.2 **No dead keys** — every key has a rendering call site in your diff. This one **is** binding (2.18). The duplicate-value ban is **not** — see D12 before writing any test that looks like one.
- [x] 11.3 Register any key builder in `i18n.test.ts`'s **key-builder resolution sweep**, not in your own `describe`. A builder ending in `as DictionaryKey` is invisible to `tsc` if its address is wrong; only resolving it over its full id domain catches that.
- [x] 11.4 Author `describe("the compare namespace (Story 2.17)")`: distinct render-state copy (a `Set` size assertion over the four/five states), an explicit "reuses X" pin per reused key path (`resolveLeader`'s «líder», the entity-kind labels), and a tuteo/register assertion. **No no-duplicate sweep** (D12).
- [x] 11.5 Copy must clear the forbidden-register regex: no `¡`/`!` anywhere, no `usted`/`vosotros`, no `clasificaci`. Guillemets are legal.
- [x] 11.6 Append `EXPERIENCE.md` policy rows under its own heading — **appended, never renumbered**. Include D12's analysis.
- [x] 11.7 Contrast, **both themes**, method validated first: reproduce `--viz-team-a` **13.56** dark / **4.99** light and `--viz-team-b` **10.30** / **5.36** before trusting any new number. Record as `| element | dark | light | floor |`. Floors: **4.5:1** text, **3:1** non-text.
- [x] 11.8 Reflow at **390** and **320** CSS px, both themes. `review-accessibility.md:53` names the comparison stack as unverified at 320 — close it.

### Task 12 — Ledger and status

- [x] 12.1 Append under `## Filed by Story 2.17 — comparison mode (2026-08-07)`. **APPEND-ONLY, proven programmatically**: the post-edit file's first N bytes byte-identical to the pre-edit file. Binary mode; no CRLF.
  - **Closed by this story:** the Team B non-hue channel (D4); `seriesLabelIndex` (D9).
  - **Recorded, not claimed:** 2.15's `InvolvementChart` hatch centring; 2.15's recharts vendor-chunk collapse. **Both are fixed in code and still open in the ledger because 2.15 filed nothing.** Never edit the original owner line — **append a correction**.
  - **Filed, not fixed:** `/compare` has no AD-4 route-payload set; `/compare` has no Lighthouse target; the `<title>`/OG consequence (D3); the `compareTeamHref` repoint if D2's condition blocked it; the two surviving `RowAnchor` copies if you could not repoint them.
- [x] 12.2 Update `sprint-status.yaml`: `2-17-comparison-mode: review`, plus the coordination note.

---

## Testing Requirements

**Harness facts you inherit.** `vitest.config.ts` is `environment: "node"` with **no setup file and no `globals: true`**. jsdom is **per-file** via `// @vitest-environment jsdom` — exactly one file uses it today (`HeaderSearch.test.tsx:1`). **Do not flip the global environment**; it would change `storage.test.ts`'s `vi.unstubAllGlobals()` restore target.

- **RTL auto-cleanup does NOT run.** Call `cleanup()` in an explicit `afterEach` or you get spurious "found multiple elements".
- **Radix needs jsdom stubs**: `ResizeObserver`, `Element.prototype.hasPointerCapture` / `setPointerCapture` / `releasePointerCapture`, `scrollIntoView`.
- **`vi.mock(` has ZERO occurrences in this repo and you will not introduce it.** The idiom is `vi.stubGlobal` + `vi.unstubAllGlobals()`. This is a reason D1's mechanism matters: `window.location.search` is natively controllable in jsdom, whereas `useSearchParams` would need an App Router context this project has no precedent for faking.
- **jsdom does not navigate.** Assert on the **resolved href**, never on a location change.
- Set a file-scoped `vi.setConfig({ testTimeout: 20_000 })` for any jsdom render file.

**What gets tested:** the pure model layer (`src/viz/compare-model.ts`, `src/lib/compare-url.ts`, `src/lib/compare-format.ts`), each with a co-located test. Components are asserted through the **exported HTML** in `static-output.test.ts`. **Do not assert bytes** — *"The App never measures bytes."* D7's chunk count is a verification step you run and record, not a committed test.

**Count classes with `classAttrCount`** (real `class="…"` attributes only) — the RSC flight payload carries `className` strings that must not be counted.

---

## Project Structure

**NEW**
```
app/src/app/compare/page.tsx
app/src/app/compare/static-output.test.ts
app/src/components/CompareRegion.tsx
app/src/components/ComparePicker.tsx
app/src/components/CompareRows.tsx
app/src/components/CompareCharts.tsx
app/src/lib/compare-url.ts            + .test.ts
app/src/lib/compare-format.ts         + .test.ts
app/src/lib/use-url-query.ts          + .test.ts
app/src/viz/compare-model.ts          + .test.ts
```

**MODIFIED**
```
app/src/components/Charts.tsx          (one export line — D6)
app/src/components/HeaderSearch.tsx    (export SearchField + onSelect — Task 4.1)
app/src/components/PlayerHero.tsx      (repoint at compareHref — D2)
app/src/components/TacticalCharts.tsx  (the -1 sentinel ONLY — D9)
app/src/locales/es.ts, en.ts           (tail append)
app/src/lib/i18n.test.ts               (append; note :1568/:1569/:1576 carry three literals for two counts and 2.16 edits them too)
app/src/app/static-output.test.ts      (allow-list + the stale comment)
_bmad-output/.../EXPERIENCE.md         (append policy rows)
_bmad-output/implementation-artifacts/deferred-work.md, sprint-status.yaml
```

**NEVER TOUCHED**
`pipeline/`, `contract/`, `data/`, `app/src/components/ui/**`, `tactical-sections.ts` (`SectionId` stays eleven), `TacticalSection.tsx`, `table-sort.ts`, `DataTable.tsx`, `phases-model.ts`, `goalkeeping-model.ts`, `ProfileCharts.tsx`, `team-profile-model.ts`, `enums.metric` (SEALED to the 19 `KEY_STAT_FIELDS`), and every file in the 2.15/2.16 ownership map you did not repoint under D2.

---

## Open Questions for Juan

1. **R1 — what does `type=matches` compare?** Proceeding under (A): a side is a whole match rendered as its own two-team block, reusing `buildKeyStatRows`, with side identity carried by the header border and mini-header only. (B) restricts to true match-level scalars and yields a three-row surface; (C) drops `Partidos`, contradicting the AC.
2. **D12 — mint `compare.type.*` or reuse `leaderboards.scope.*`?** The argument for minting is in D12; the counter-pressure is `EXPERIENCE.md:322`'s explicit "deliberately NOT a new row". Overturning this changes three keys and the exemption comment, nothing else.
3. **D3 — is skipping `metadata` on `/compare` acceptable?** It follows from 2.18's still-open Decision 2, which is yours. If you want `/compare` to carry a static Spanish `<title>`, that decision needs taking first — and it would settle `/glossary` at the same time.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

#### Task 1 — baseline, re-measured 2026-08-07

**1.1 — HEAD MOVED, so every measured number in this file was re-verified.**
Baseline recorded in the frontmatter is `79bd7aa`; actual HEAD at first read was
`937f305` ("Story 2.16: pure models, route, hero and sections"). The `baseline_commit`
frontmatter value is preserved unchanged per the workflow's instruction.

**1.2 — pre-existing chain state (before any edit of mine):**

| Link | Result |
|---|---|
| `npm run lint` | clean — but see the transient below |
| `npm run typecheck` | clean |
| `npm test` | 1097 passed, **1 suite failed**: `teams/static-output.test.ts` |
| `npm run build` | green, after one `EBUSY` retry |

- **A TRANSIENT LINT FAILURE THAT WAS NOT REAL.** The first `npm run lint` reported
  `'RowAnchor' is not defined` at `TournamentHub.tsx:165,310`. `RowAnchor` is imported
  at `:9`, and the reported line numbers were off by one from the file on disk — the
  concurrent 2.16 session was mid-write on that file (it later landed as `af0a9ab`,
  which rewrites `TournamentHub.tsx` by 85 lines). A fresh lint of the file alone was
  clean. **Recorded rather than "fixed": it was never my defect and never a defect.**
- **The one real pre-existing failure was a stale `out/`.** `teams/static-output.test.ts`
  threw `ENOENT` on `out/teams/mexico/index.html` — 2.16's route existed in source but
  not in the checked-out export. A rebuild resolved it.
- **`EBUSY: rmdir 'app/out'`** killed the first build at the finalize step; a plain
  retry succeeded. Concurrent-session handle contention, not a code defect.

**1.3 — dirty-file map at first read** (`git status --porcelain`): `PhysicalSection.tsx`,
`build-data.ts`, `locales/en.ts`, `locales/es.ts`, `viz/team-profile-model.test.ts`,
plus four `_bmad-output` artifacts. **`team-profile.ts`, `TeamHero.tsx` and
`ProfileCharts.tsx` were CLEAN**, so D2's coordination condition permitted the full
reconciliation rather than filing it.

**1.4 — D7 chunk classifier, baseline.** Identical on the stale `out/` and on a fresh
rebuild at HEAD:

```
   359.0 KB  VENDOR   1sxly1jl9kd60.js
VENDOR count = 1
```

359.0 KB = 367,636 B, matching the story's recorded figure exactly. **Pass condition
for Task 10.2 is `VENDOR count == 1`, not a byte count.**

**1.5 — artifact families re-measured** (raw max / gzip -9 max):

| Family | count | max raw | max gzip | story said |
|---|---:|---:|---:|---|
| `index/tournament.json` | 1 | 409,524 | 39,137 | 409,524 / 38,625 ✓ |
| `index/player-profiles/*` | 1,248 | 11,741 | 1,498 | 1,248 / 11,741 ✓ |
| `index/team-profiles/*` | 48 | 5,974 | 1,250 | 48 / 5,974 ✓ |
| `matches/*` | 104 | 212,713 | 14,251 | 104 / 212,713 ✓ |

Fixture tree confirms **1 team, 2 players, 4 matches**. Worst-case route payload
(`type=matches`, real data) = 39,137 + 2×14,251 = **67,639 B gzip ≈ 66 KB against the
500 KB cap** — the story estimated ~63 KB; re-measured slightly higher, still far
inside budget.

**1.6 — both ledger claims verified at this baseline.**
- `seriesLabelIndex` **still unfixed**, now at `TacticalCharts.tsx:238-247` (docblock
  `:238`, body `:239-247`). The ledger's `:229-237` citation has drifted by 9 lines.
- `SeriesEndLabel`'s `if (index !== labelIndex) return null` guard is at `:212-214` and
  **is already sentinel-compatible**.
- The `InvolvementChart` hatch **IS** centred at `:546,:548` (`x1={HATCH_TILE_PX / 2}`).
  **That is 2.15's fix. Recorded, never claimed.** The `TacticalCharts` copy at
  `:341-348` is centred too.

#### Task 2 — the URL layer

**THE SLASH QUESTION WAS SETTLED EMPIRICALLY, NOT BY READING THE HELPERS.** Both
inbound links were measured on the built export at baseline:

```
out/players/quinones-julian-mex/index.html → href="/compare/?type=players&amp;a=quinones-julian-mex"
out/teams/mexico/index.html                → href="/compare/?type=teams&amp;a=mexico"
```

`trailingSlash: true` rewrites a slash-less href **at render**, so both pages have
always emitted the slash form regardless of what the helper returned. At my baseline
`compareTeamHref` returned the slash-LESS string while its own docblock claimed it
emitted the slash, and `teams/static-output.test.ts:181` asserted the slash-less form —
a docblock, an implementation and a test disagreeing three ways, which I observed
failing. **The concurrent 2.16 session fixed all three in `af0a9ab` while this story
was in flight**; the finding is recorded because it justifies D2's ruling, not because
it remained mine to repair.

`compareHref` therefore emits what actually ships, and `players/static-output.test.ts:201,204`
stay green byte-for-byte.

#### Concurrent-session coordination log

This story ran alongside an active 2.16 session writing the same working tree, and a
third session writing `pipeline/`. Landed under me mid-run:

- `937f305` — 2.16 pure models, route, hero, sections
- `af0a9ab` — 2.16 team locale namespace, `readTeamProfile`, `TournamentHub` rewrite;
  **also fixed `compareTeamHref`'s slash and rewrote `teams/static-output.test.ts`**

**Consequence for Task 11 (good):** `es.ts`/`en.ts` were dirty at my baseline and are
now committed with `team` as the final namespace (`es.ts:2600`, file 2,779 lines). The
locale collision the story warned about **has cleared** — `compare` tail-appends after
`team` exactly as Task 11.1 specifies.

Per Juan's ruling this session, each completed task group is committed as its own slice
so the other session's sweeping `git add` cannot capture half-finished work.

### Completion Notes List

**STATUS: COMPLETE — READY FOR REVIEW.** The partition below the divider was written
by the FIRST session, which stopped with the route unbuilt and said so. It is kept
verbatim rather than rewritten, because it is the accurate record of what that session
did and did not do. The RESUMED session's record comes first.

---

## RESUMED SESSION — the route (2026-08-07)

**All six acceptance criteria are satisfied and every task is checked.** Chain at the
close: **lint 0, tsc 0, 1,231 tests across 45 files.** Code committed as `be85651`.

### The route, and what discharges each AC

| AC | Discharged by | Verified |
|---|---|---|
| 1 — selector + two search-selects, URL is the state, exactly two artifacts | `ComparePicker` over 2.14's reused `SearchField`; `CompareRegion`'s three literal fetch call sites | per-route allow-list test pins the four reachable artifacts; live: one pick = 2 requests |
| 2 — swap-sides | `swapSides` (pure) + one `replaceUrlQuery` | live: URL's `a`/`b` exchange, 0 extra network from the write itself |
| 3 — mirrored rows, values verbatim, only licensed derivations | `CompareRows` + `compare-model.ts` | the derivation table below; 22 model tests |
| 4 — per-entity vizzes, identical scales, `<md` stack + mini-header | `CompareCharts` / `CompareChartsSection` | live: both charts on one 0–60 domain; sticky offsets at exactly 56 px |
| 5 — empty / partial / invalid states | `CompareRegion` | all four states loaded live, incl. the URL cleanup |
| 6 — a pasted URL reproduces the comparison | `useUrlQuery`'s synchronous snapshot | live: pasted URL rendered the comparison with no input |

**AC 6 IS CLAIMED HONESTLY AND NOT OVERCLAIMED.** There is no server; `out/compare/index.html`
is byte-identical for every query string, and it carries the shell in its picker-first
empty state and not one comparison row — the property `static-output.test.ts:83-96`
states for the Hub, asserted here for this route. What a pasted URL reproduces is the
same comparison, with no user input, **on the first client render after hydration**,
through the same four-state machine the other five routes use. Not "on first paint",
and nothing in the diff says otherwise.

### D8's derivation whitelist — every row marked (Task 6.5)

| Derivation | Displayed? | Verdict | Status in this diff |
|---|---|---|---|
| shared axis `domain` + `ticks` across A and B | axis geometry + tick labels | LICENSED (AD-5) | **IMPLEMENTED** — one `axis` object per comparison in `compare-model.ts`; tests assert it is argument-order-independent |
| `resolveLeader(a, b)` → `home \| away \| tie` | accent + ▲ + «líder» | LICENSED (AD-5) | **IMPLEMENTED** — imported from `match-hero.ts`, never re-minted |
| selecting which metrics to show | — | LICENSED (AD-5 "filter, select") | **IMPLEMENTED** — `TEAM_COMPARE_FIELDS` (10), `MATCH_CHART_FIELDS` (4), in-possession phases only |
| user-initiated re-ordering | — | LICENSED | **ABSENT** — the rows do not sort; `DataTable`'s sort exists only inside the viz alternatives, where it is user-initiated |
| `Intl` number/date formatting | yes | LICENSED (AD-7) | **IMPLEMENTED** — `compare-format.ts`, delegating to the one leaderboard formatter |
| A − B, A ÷ B, "+3 more", "12% better", a difference column, a combined total, a rank between the two | — | **BANNED** | **ABSENT** — no arithmetic operator between the two sides exists anywhere in `compare-model.ts` or `compare-format.ts`. `goalDifference` is read as a CONTRACT FIELD, never computed from `goalsFor − goalsAgainst`, and a test pins that |
| a chart series computed from both sides | — | **BANNED** | **ABSENT** — every series is one entity's own values |
| a sparkline of the gap | — | **BANNED** | **ABSENT** |

`CompareRow` carries exactly `{key, labelKey, unit, a, b, format, leader}` and a test
asserts that key set — so a delta would have nowhere to live without failing.

### Measurements

**D7 chunk classifier — the gate, run before the first edit and after the last:**

```
before:  359.0 KB  VENDOR   1sxly1jl9kd60.js      VENDOR count = 1
after:   362.0 KB  VENDOR   22jorq3ik-47u.js      VENDOR count = 1     ✅ PASS
```

The fourth recharts leaf costs **3.0 KB**, not 359, because the duplication is per
`dynamic()` SPECIFIER and `CompareBarChart` is reached only through the `Charts.tsx`
barrel. Size recorded, not asserted.

**Task 2.7 — `router.replace` vs `history.replaceState`, measured with
`performance.getEntriesByType("resource").length`:**

| Action | Resources added | What they are |
|---|---:|---|
| one swap (`history.replaceState`) | **2** | the two entity artifacts, re-fetched — AD-10's no-cache rule, not the write |
| the write itself | **0** | `replaceState` is same-document and costs no request |
| type change | **0** | both sides clear, so nothing is fetched |
| what `router.replace` would add | **+1** | `out/compare/index.txt` exists (8,590 B) and is a real request; the app never makes it |

`history.replaceState` wins on the measurement and is harmless here precisely because
D1 does not use `useSearchParams` — nothing on this route reads the URL through Next,
so there is nothing for the App Router to keep in sync.

**Task 10.5 — payload per type against the 500 KB cap** (real-data sizes, gzip -9):

| type | artifacts | worst case |
|---|---|---:|
| `players` | index + 2 profiles | 39,137 + 2×1,498 = **42,133 B ≈ 41 KB** |
| `teams` | index + 2 profiles | 39,137 + 2×1,250 = **41,637 B ≈ 41 KB** |
| `matches` | index + 2 bundles | 39,137 + 2×14,251 = **67,639 B ≈ 66 KB** |

Comfortable. **The index is fetched once per page load, not twice** — `loadTournamentIndex()`'s
module-scope promise is shared with the header search, so a reader who has also used
search pays for it once. AC 1's "exactly the two entities' bundles/index slices" is about
the ENTITY artifacts; the index is the picker's corpus and the slug manifest.

**Task 11.7 — contrast, both themes, method validated FIRST.** The method reproduced the
recorded pairs exactly before any new number was trusted: `--viz-team-a` **13.56 / 4.99**,
`--viz-team-b` **10.30 / 5.36**, team-a vs team-b **1.32 / 1.07**, hatch stripe **1.53 / 3.30**.

| element | dark | light | floor | verdict |
|---|---:|---:|---:|---|
| leading value, side A (text) | 13.56 | 4.99 | 4.5 | PASS |
| leading value, side B (text) | 10.30 | 5.36 | 4.5 | PASS |
| non-leading / tied value (text) | 15.81 | 17.67 | 4.5 | PASS |
| mirrored row label (text) | 7.87 | 7.61 | 4.5 | PASS |
| header accent border A (non-text) | 14.83 | 4.65 | 3 | PASS |
| header accent border B (non-text) | 11.27 | 4.99 | 3 | PASS |
| swap-sides icon (non-text) | 8.61 | 7.08 | 3 | PASS |
| hatch stripe on its own solid ground | 1.53 | 3.30 | n/a | governed by the SOLID figures — decision 10(b) |

**One figure recorded rather than passed:** the swap button's `border-hairline` computes
**1.44:1** in dark. It is a decorative divider, not the control's identifying feature —
the icon at 8.61 / 7.08 is what 1.4.11 governs — and every hairline on the site sits at
that ratio. Recorded so a reviewer sees it was measured, not missed.

**Task 11.8 — reflow at 390 and 320 CSS px, both themes, all three types.** Zero
horizontal page scroll, zero element wider than the viewport, zero target under 44×44 px,
in every one of the eight combinations run. Row counts confirm the layouts are real:
players 18 rows, teams 10, matches 39 (two 19-row blocks).

### Verified live, and the one gap

Verified in the browser against the built export: the four AC 5 states and the URL
cleanup (bad slug and bad `type` both dropped, valid side preserved, no loop); D10's DOM
order (`label, A, B` painted into grid columns 2, 1, 3); D4/D5's accents (2 charts, 1
hatch for `players`; 2 charts, 2 hatches and the real team codes `mex/rsa`, `ger/par` for
`matches`); the shared domain (both match charts on one 0–60 axis); and the sticky
mini-header's **actual offset** — `getBoundingClientRect().top === 56` at every scrolled
probe in a real 386 px viewport, with zero clipping ancestors. That closes, for this
header, the defect class where twenty-two sticky headers shipped green and did not stick.

**THE GAP, FILED NOT HIDDEN: the mini-header's `IntersectionObserver` switching is
unverified.** The browser automation reported a successful window resize while the window
stayed at 1920 — the same environmental blocker 2.16 recorded — so the only narrow
viewport available was a same-origin iframe, and `IntersectionObserver` delivers **zero
callbacks** for content inside that iframe in this environment (an in-realm observer over
the same nodes fired nothing either, so the harness failed, not necessarily the page).
**One real defect was found and fixed during the attempt:** the callback decided from the
`entries` argument alone, which is only what CHANGED, so a scroll delivering one entry
could never compare the two figures. It now decides over a persistent visibility map.
`data-compare-showing` and `data-compare-side` were added to make the next pass cheap.

### Rulings taken in this session, for the reviewer

- **R1 ships under (A).** A `matches` side is a whole match rendered as its own two-team
  block: `matchCompareRows` maps the shipped `buildKeyStatRows` into the same row grammar,
  and the chart is the shipped `DistributionChart` — which is what finally closes D9's
  ownership condition. Cross-side comparability is the shared axis alone. **Juan to confirm
  or overturn.** Overturning changes only `matchCompareRows`, `MATCH_CHART_FIELDS` and
  `MatchFigures`; the shell, picker, URL layer and the other two types are untouched by it.
- **`MATCH_CHART_FIELDS` is a selection and needs stating.** Four count-family key stats
  (`shots`, `shotsOnTarget`, `crosses`, `defensiveLineBreaks`). One unit family is
  mandatory for a shared domain to be honest — `KEY_STAT_FORMAT` puts two fields in the
  percent family and seventeen in the count family — and four is what
  `distributionChartHeightClass`'s closed `3 | 4 | 8 | 9` parameter admits.
- **Teams plot in-possession phases only**, not all seventeen rates. AD-5 licenses the
  selection; the full set stays one click away on each team's own route.
- **Player series carry their TEAM's code**, because `PlayerProfile` has no code of its
  own — only a shirt number, which reads as a value beside a numeric axis. Two players
  from one squad therefore share a code; they sit in separate charts told apart by accent
  and hatch, so the label names the series' subject rather than distinguishing it.
- **No `<md` sheet in the picker** — a scoped departure from Task 4.5, argued in place:
  2.14 built one because `SiteHeader` is a fixed `h-14` bar with no room for an input.
  This picker owns a full-width page region, the listbox already carries the
  `max-w-[calc(100vw-2rem)]` clamp that makes 320 px pass, and two modal sheets would take
  the page's single depth-1 overlay slot to present a field that already fits.
- **`CompareLineChart` was not built** — every mark on this route is a bar. Filed.
- **No glossary marking on `/compare`** — UX-DR20 is a per-term table and names no row for
  this route. Filed, with a policy row appended to `EXPERIENCE.md` recording the decision.
- **The React Compiler lint shaped two designs**, and both are documented at their sites:
  `react-hooks/set-state-in-effect` and `react-hooks/refs` between them ruled out the two
  obvious ways to carry the rejected slug across its own URL cleanup, so the notice uses
  React's documented "adjust state when an input changes" pattern; and the fetch result is
  TAGGED with the request it answers, so staleness is derived rather than cleared.

### Coordination — what was left unstaged, and why

`be85651` carries this story's own files plus `Charts.tsx`, `HeaderSearch.tsx` and
`app/src/app/static-output.test.ts`, all verified to contain no other story's work. **Four
files carry this story's edits MIXED with 2.16's still-uncommitted work and were
deliberately left unstaged:** `i18n.test.ts`, `teams/static-output.test.ts`, `TeamHero.tsx`
and `team-profile.ts`. Committing them would capture another story's half-landed changes in
this one's commit — the exact failure `79bd7aa` is recorded here as an example of. This
story's contributions to all four are complete and green; they will land with 2.16's sweep.

**D2 FINALLY DISCHARGED IN FULL.** The first session could not do Task 2.4 because
`TeamHero.tsx` was dirty. 2.16 has since committed it, so the coordination condition
permitted the reconciliation: `compareTeamHref` is deleted from `team-profile.ts`,
`TeamHero` builds through `compareHref("teams", …)`, and the emitted href is **byte-identical**
— which is why `teams/static-output.test.ts` needed only its stale "unbuilt /compare route"
title corrected, not its assertion.

---

## FIRST SESSION'S RECORD (kept verbatim)

**STATUS AT THE TIME: IN PROGRESS — NOT READY FOR REVIEW.** Three task groups complete and
committed; the route itself not built.

#### Complete and committed

| Commit | Scope |
|---|---|
| `74993a5` | Task 2.1–2.3 — the URL layer (D1, D2) |
| `6c90d80` | Task 9.1–9.3 — `seriesLabelIndex` `-1` sentinel (D9) |
| `7caeebe` | Task 11.1, 11.5 — the `compare` locale namespace (D11, D12) |

Each was verified green before committing. Chain at the last commit: **lint clean,
typecheck clean, 41 test files / 1152 tests passing.**

- **D1 discharged.** `useUrlQuery()` reads `window.location.search` through
  `useSyncExternalStore` with a primitive snapshot, `""` server snapshot, and a
  `popstate` subscription **plus** a module notifier set — `history.replaceState` fires
  no `popstate`, so without that set the picker would update the URL and the comparison
  would not move. 11 jsdom tests.
- **D2 discharged in full, not filed.** The story's coordination condition branched on
  `team-profile.ts`/`TeamHero.tsx` being dirty; they were clean, so the full
  reconciliation was available. `compareHref` is the single home for the URL shape and
  `PlayerHero` is repointed at it. 22 tests.
- **D9 discharged with one deliberate departure from the ruling's literal wording** —
  see the Debug Log and the docblock: `-1` is returned for a FLAT series, not for
  "no value beats the first", because the literal form also suppresses `[10, 3, 2]`,
  an ordinary series whose peak sits at index 0.
- **D12 argued in the diff.** `compare.type.*` minted as a coherent triple, with the
  four-bullet argument against each existing home written into `es.ts` where the next
  reader will find it. **No `compare.*` no-duplicate sweep was authored** — the story is
  explicit that no such gate exists and that manufacturing one would push toward
  awkward near-synonyms.

#### NOT done — the route is not built

Tasks **3, 4, 5, 6, 7, 8, 10, 12** are untouched, and Task 2.4–2.7 and Task 11.2–11.4,
11.6–11.8 remain. Concretely absent: `src/app/compare/page.tsx`, `CompareRegion`,
`ComparePicker`, `CompareRows`, `CompareCharts`, `compare-model.ts`,
`compare-format.ts`, the `SearchField` extraction, the sticky mini-header, the
`Charts.tsx` barrel line, the D7 after-measurement, the `/compare` allow-list entry,
the contrast and reflow passes, the `EXPERIENCE.md` policy rows, and the ledger entries.

**No acceptance criterion is satisfied yet.** AC 1–6 all require the route to exist.
The committed work is the substrate three of them stand on, nothing more.

#### Carried forward for whoever resumes

- **`compare.*` keys are currently dead** — committed deliberately as an intermediate
  state so the locale landed while `es.ts`/`en.ts` were briefly clean between the 2.16
  session's writes. Task 11.2's no-dead-keys gate is a story-completion gate; it is
  **not yet satisfied** and every key needs its rendering call site before this story
  can go to review.
- **D2's remaining half (Task 2.4).** `compareTeamHref` still exists at
  `team-profile.ts:184` and `TeamHero.tsx:185` still calls it. It now emits the correct
  slash (2.16 fixed it in `af0a9ab` mid-run), so this is a pure de-duplication with no
  behaviour change — but it touches a file whose story is still `in-progress` in another
  session. **Re-check `git status --porcelain` immediately before doing it.**
- **`teams/static-output.test.ts:180`'s title says "the unbuilt /compare route"** and
  goes stale the moment the route builds. One-line correction, owned here.
- **The concurrent session is still active** on `ProfileCharts.tsx`,
  `PhysicalSection.tsx`, `TeamIdentitySection.tsx`, `team-profile-model.ts` and
  **`Charts.tsx`** — the last of which Task 7.4 must add one export line to. A third
  session is writing `pipeline/`.

### File List

**Added — first session (committed `74993a5`, `6c90d80`, `7caeebe`)**
```
app/src/lib/compare-url.ts
app/src/lib/compare-url.test.ts
app/src/lib/use-url-query.ts
app/src/lib/use-url-query.test.ts
app/src/components/TacticalCharts.test.ts
```

**Added — resumed session (committed `be85651`)**
```
app/src/app/compare/page.tsx                    (the server shell — D3)
app/src/app/compare/static-output.test.ts       (exported shell + the AR-10 source gate)
app/src/components/CompareRegion.tsx            (the four-state machine — D1, AR-10)
app/src/components/ComparePicker.tsx            (type selector + two reused SearchFields — D12)
app/src/components/CompareRows.tsx              (the mirrored grid — D10, D14)
app/src/components/CompareCharts.tsx            (the fourth recharts leaf — D4, D5, D6)
app/src/components/CompareChartsSection.tsx     (viz section + sticky mini-header — D13)
app/src/lib/compare-format.ts                   (formatting, composition, key builders — D11)
app/src/lib/compare-format.test.ts
app/src/viz/compare-model.ts                    (the pure decision layer — D8's whitelist)
app/src/viz/compare-model.test.ts
```

**Modified — first session**
```
app/src/components/PlayerHero.tsx        (repointed at compareHref — D2)
app/src/components/TacticalCharts.tsx    (the -1 sentinel + its export — D9)
app/src/locales/es.ts                    (compare namespace, tail append)
app/src/locales/en.ts                    (compare namespace, same position)
```

**Modified — resumed session, COMMITTED in `be85651`**
```
app/src/components/Charts.tsx            (one export line — D6; no logic in the barrel)
app/src/components/HeaderSearch.tsx      (export SearchField + onSelect/fieldLabel — Task 4.1)
app/src/app/static-output.test.ts        (the /compare allow-list + the stale two-specifier comment)
```

**Modified — resumed session, LEFT UNSTAGED because they carry 2.16's uncommitted work too**
```
app/src/lib/i18n.test.ts                 (compare describe, builder sweep, caption inventory +6)
app/src/app/teams/static-output.test.ts  (the stale "unbuilt /compare route" title)
app/src/components/TeamHero.tsx          (repointed at compareHref — D2's second half)
app/src/lib/team-profile.ts              (compareTeamHref DELETED — D2)
```

**Modified — artifacts**
```
_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md  (5 policy rows, appended)
_bmad-output/implementation-artifacts/deferred-work.md                            (appended; append-only proven)
_bmad-output/implementation-artifacts/2-17-comparison-mode.md
_bmad-output/implementation-artifacts/sprint-status.yaml
```

## Change Log

| Date | Change |
|---|---|
| 2026-08-07 | First session: the URL layer (Task 2.1–2.3, D1/D2), `seriesLabelIndex`'s `-1` sentinel (Task 9, D9), the `compare` locale namespace (Task 11.1/11.5, D11/D12). Route not built; recorded as NOT READY FOR REVIEW. |
| 2026-08-07 | Resumed session: built the route — shell, region, picker, rows, charts and the two pure modules (Tasks 3–8). Closed Task 2.4–2.7, 10, 11.2–11.4, 11.6–11.8 and 12. |
| 2026-08-07 | D2 discharged in full: `compareTeamHref` deleted, both inbound links now build through one `compareHref`. The emitted href is byte-identical. |
| 2026-08-07 | Ledger appended (append-only proven byte-for-byte): the Team B non-hue channel and `seriesLabelIndex` CLOSED; 2.15's hatch centring and vendor-chunk collapse RECORDED not claimed; six items filed. |
| 2026-08-07 | Verification: lint 0, tsc 0, 1,231 tests / 45 files, vendor chunk count 1 → 1 (359.0 → 362.0 KB). Contrast, reflow and the sticky offset verified live in both themes; the mini-header's observer switching filed as unverified. |
| 2026-08-07 | Status → review. |

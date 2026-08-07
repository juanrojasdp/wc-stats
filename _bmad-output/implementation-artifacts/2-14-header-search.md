---
baseline_commit: 29e90fb
---

# Story 2.14: Header Search

Status: done

<!-- Baseline 29e90fb, verified HEAD at create-story, 2026-08-06, with `app/` CLEAN.
     THIS STORY IS app/ + locales ONLY. Nothing in pipeline/, contract/ or data/ is touched.
     Thirteen rulings shape this story; each names the evidence it rests on. THREE premises in the
     create-story brief were WRONG and are corrected in the Baseline note, ruling 2 and ruling 5.
     Read the Reuse Map and the AC->task table before the rulings; read a ruling when a task cites it. -->

## Story

As Mariana or Diego,
I want to find any player, team, or match from the header,
So that navigation never requires knowing a URL (UX-DR5).

> **Depends on 2.2** (the header and its reserved slot), **2.18** (the terminology gate + the
> one-press-Esc blueprint), **2.12** (`hub.results.*`, `decidedByCaption`) and **2.13**
> (`includesText`, `foldForSearch`, `leaderboards.filter*`). All four are in the tree at the baseline.
>
> ### 🔴 THE BASELINE IS NOT WHAT THE BRIEF ASSUMED — 2.13's CODE IS ALREADY COMMITTED
>
> The brief says 2-13 "is minting leaderboard vocabulary right now" and that `en.ts`/`es.ts` will
> "move under you". **Measured: `git status --short app/` is EMPTY.** 2.13's entire implementation —
> `includesText`, `foldForSearch`, `LeaderboardsSection.tsx`, `LeaderboardsRegion.tsx`, the whole
> `leaderboards` namespace — landed **inside commit `29e90fb`**, titled *"Story 2.12 code review"*.
> That commit says so in its own message: *"plus Story 2.13's leaderboards work, which shares the same
> `app/` files and cannot be separated from it … Ruled at review: do not split."*
>
> **What this changes:** `includesText` and `foldForSearch` are **committed dependencies you may build
> on today**. What remains live is that 2.13's *code review* may still patch `format.ts`, the locale
> files and `i18n.test.ts`. Append-only discipline and the rebase expectation stand — for a different
> reason than the brief gave.
>
> **1-17 and 1-18 are in `pipeline/` + `data/`** — a different lane, with one real overlap: 1-18 has
> `data/fixtures/index/tournament.json` dirty. **Your input fixture is moving** (Task 1.3).
>
> Every shared-file edit is APPEND-ONLY. **Never `git add -A`** — commit your slice by explicit path.
> Cite shared artifacts by quoted anchor phrase, not line number.

## Acceptance Criteria (from `epics.md:899`)

**Given** the header search input
**When** the user types
**Then** a client-side typeahead over `tournament.json` entities (players, teams, matches) shows results with matched-substring highlight and entity-type labels, with accent/case-insensitive matching via `Intl.Collator('es', {sensitivity:'base'})` — no network beyond the already-loaded index.

**Given** combobox semantics
**When** the user navigates results
**Then** `role="combobox"` + listbox applies: arrow keys move the active option, Enter navigates to the entity route, Esc closes and returns focus; empty results show "Sin resultados para «{query}»." with a link to `/`.

**Given** a `<md` viewport
**When** search is invoked
**Then** the input collapses to an icon button opening a full-width sheet with identical semantics (UX-DR4).

### AC → task traceability

| # | Criterion | Discharged by | Ruling |
|---|---|---|---|
| **AC 1** | Typeahead covers all three `entities.*` lists, driven off `.length` | 2.4, 2.5, 2.9 | 11, 12 |
| **AC 2** | Matching is accent- **and** case-insensitive on both sides | 2.7, 3.1, 3.2, 2.9 | 5 |
| **AC 3** | Matched-substring highlight + entity-type label per row | 2.7, 5.3, 7.4, 9.2 | 6, 9 |
| **AC 4** | Combobox roles, arrow keys, Enter, **one-press** Esc — real key events | 7.1–7.3, 10.2, 10.3, 11.3 | 2, 3, 10 |
| **AC 5** | `"Sin resultados para «{query}»."` + link to `/` | 5.4, 7.6, 10.2 | 7, 9 |
| **AC 6** | `<md` icon button → full-width sheet, identical semantics | 6.1, 8.1–8.5, 11.4 | 4 |
| **AC 7** | "No network beyond the already-loaded index" — measured, departure declared | 4.1–4.5, 10.5, 11.2 | 1 |
| **AC 8** | Result rows are real links with `prefetch={false}` | 2.6, 7.5 | 8 |

---

## Reuse Map — BUILD NONE OF THESE

The single highest-value section of this story. Every row is shipped, exported and tested today.

| Need | Use this — **do not rebuild** | Where |
|---|---|---|
| Accent+case-insensitive **match test** | `includesText(haystack, needle)` | `@/lib/format` (exported) |
| Accent+case fold for **indices** | `foldForSearch` — **currently module-private; Task 3 exports it** | `@/lib/format` |
| Text **ordering** | `compareText` / `compareTextNullLast` | `@/lib/format`, `@/lib/table-sort` |
| Half-open span type | `TermSpan { start; end }` | `@/lib/glossary` (exported) |
| Span **slicing in JSX** | the three-`slice` pattern | `glossary-marking.tsx` |
| Score string | `scoreline(score, separator)` | `@/lib/hub-model` |
| Score separator | `match.hero.scoreSeparator` (`"–"`) | `es.ts` |
| Stage label key | `stageLabelKey(stage)` — **exists in BOTH `hub-model.ts` and `match-hero.ts`; import from `hub-model` with the href helpers and use one module** | `@/lib/hub-model` |
| Decider caption | `decidedByCaption(knockoutScore)` — 2.12: *"do not write a second switch"* | `@/lib/match-hero` |
| Match / team hrefs | `matchHref`, `teamHref` | `@/lib/hub-model` |
| Player href | **does not exist** — add `playerHref` beside the other two |  |
| The **search input itself** | `<input type="search">` + visible `<label htmlFor>` + `t()`-to-`const` placeholder + `min-h-11 w-full rounded-md border border-hairline bg-surface-raised px-3 type-body` | `LeaderboardsRegion.tsx` — the app's only text-filter UI |
| Announcement **debounce** | `ANNOUNCE_SETTLE_MS = 400` | `LeaderboardsRegion.tsx` |
| Status machine | `type Status = "loading" \| "loaded" \| "error" \| "invalid"` + `attempt` retry counter | `TournamentHubRegion.tsx` |
| Empty-state shell | `EmptyStatePanel`, `useEmptyHeadline()` | `components/EmptyStatePanel.tsx` |
| 44 px floor constant | `MIN_HIT_PX = 44` — import, never re-declare | `@/viz/marker-layout` |
| Arrow/Home/End/Esc switch | shipped keyboard precedents | `PitchPanel.tsx`, `MomentumChart.tsx` |
| One-press-Esc blueprint | `suppressFocusOpen` + `DISMISS_FOCUS_SUPPRESSION_MS = 150` | `use-glossary-popover.ts` |
| Page-wide single-open registry | `openPopoverClosers` — **module-private; Task 7.7 exports a registration API** | `use-glossary-popover.ts` |
| Overlay panel classes | `dropdown-menu.tsx`'s content class string (copy the classes, **not** the roles) | `components/ui/dropdown-menu.tsx` |

---

## Tasks / Subtasks

### Task 1 — Baseline and orientation

- [x] **1.1** From `app/`: `npm test`, record the count; then `npm run build && npm test`, record the
      higher count. Static-output suites are `describe.skipIf`-skipped without `out/`, so a bare
      `npm test` under-reports. **Re-measure; do not inherit a number.** There are **28** test files
      today. **Every command runs from `app/`** — `build-data.ts` resolves `DATA_ROOT` from
      `process.cwd()` and throws a named error from the repo root.
- [x] **1.2** `git log --oneline -1` must read `29e90fb` and `git status --short app/` must be empty.
- [x] **1.3** Re-measure the input fixture. 1-18 has `data/fixtures/index/tournament.json` dirty and
      is in `review`, so **it may be regenerated before you start**. Record `schemaVersion`, and the
      three `entities.*` counts. **Never pin a count you did not measure.** For orientation only, at
      create-story it held 2 players / 1 team / 4 matches / 2 knockoutResults at `schemaVersion` 4.
- [x] **1.4** Read before writing: `SiteHeader.tsx`, `format.ts`, `use-glossary-popover.ts`,
      `glossary-marking.tsx`, `TournamentHubRegion.tsx`, `LeaderboardsRegion.tsx` (the filter-input
      and announcement-debounce precedents), `eslint.config.mjs`, and **both**
      `src/app/static-output.test.ts` and `src/app/matches/static-output.test.ts`.

### Task 2 — The pure model (AC 1, AC 2, AC 3, AC 8)

New `app/src/lib/search-model.ts` + co-located `search-model.test.ts`.

- [x] **2.1** **`src/lib/`, not `src/viz/`** — anything importing `@/lib/format` lives in `src/lib/`
      *"so the pure models stay locale-free"* (why `table-sort.ts` lives there). Yours imports
      `includesText`.
- [x] **2.2** Types beside the functions (house convention). **Never edit `contract-types.d.ts`** —
      generated and lint-exempt. Type-only import `Tournament` from `@/lib/contract/contract-types`.
      ```ts
      export type SearchEntityKind = "player" | "team" | "match";
      export interface SearchEntity {
        kind: SearchEntityKind; id: string; name: string; folded: string;
        href: string; detail: string | null;
      }
      export interface SearchResult { entity: SearchEntity; span: TermSpan | null }
      export function searchEntities(tournament: Tournament): SearchEntity[];
      export function matchSpan(name: string, query: string): TermSpan | null;
      export function searchResults(entities: readonly SearchEntity[], query: string, limit: number): SearchResult[];
      export function entityKindLabelKey(kind: SearchEntityKind): DictionaryKey;
      ```
      **Import `TermSpan` from `@/lib/glossary`; do not declare a twin.** This codebase punishes a
      second home for one concept, and the shape and semantics (half-open `[start, end)`) are identical.
- [x] **2.3** **Locale-free.** Return `DictionaryKey`s for entity-type labels (the `matchResultWordKey`
      pattern); take resolved strings via an `input: {…}` object for anything composed.
- [x] **2.4** `searchEntities` builds one flat corpus from all three lists, driven off
      `entities.*.length`. **Concatenate in a PINNED order — `teams → players → matches`** — and pin
      it in a test; the 10-row cap makes tie-break order observable, and an unpinned order is
      nondeterministic. **Fold each name ONCE here** onto `SearchEntity.folded`; never fold inside the
      filter (ruling 12).
- [x] **2.5** `detail` per kind, so duplicate names disambiguate (the contract prescribes these):
      **player → `team.name`** (*"name plus team"*); **team → `group`**; **match → stage label +
      scoreline + decider**.
- [x] **2.6** 🔴 **The decider field is NESTED. `decidedBy` is NOT on the `knockoutResults` row.**
      Measured — the path is **`knockoutResults[].knockoutScore.decidedBy`**, alongside
      `scoreAfter90`, `scoreAfterET`, `shootoutScore` and `winnerTeamId`. A join that reads
      `row.decidedBy` returns `undefined` on all 32 rows and silently ships the bug ruling 11 exists
      to prevent. Join by `matchId`, then read `knockoutScore`, then pass it to **`decidedByCaption`**
      (`@/lib/match-hero`) — 2.12 ruled *"do not write a second switch"*, and this would be the third.
- [x] **2.7** Hrefs: `/players/{playerId}/`, `/teams/{teamId}/`, `/matches/{matchId}/`, **all with the
      trailing slash** (`trailingSlash: true`). Import `matchHref`/`teamHref` from `hub-model.ts`;
      **there is no `playerHref`** — add one there beside them.
- [x] **2.8** `matchSpan`: fold the haystack, `indexOf` the folded needle, return **original-string**
      indices; **return `null` when `foldForSearch(name).length !== name.length`** (ruling 6).
- [x] **2.9** `searchResults`: trim the query at this boundary (ruling 5); empty query → empty array;
      prefix-matches before substring-matches, then corpus order; cap at `limit`.
- [x] **2.10** Tests (node env, no jsdom). For full-scale coverage read the real index the way every
      other suite reads a fixture — **`JSON.parse(readFileSync(path.join(process.cwd(), "..", "data",
      "index", "tournament.json"), "utf8")) as Tournament`. Do NOT use a `resolveJsonModule` import**:
      a direct import is not assignable to `Tournament` (`schemaVersion: number` vs the literal `4`,
      `stage: string` vs the closed enum) and puts a 400 KB literal type into every `npm run typecheck`,
      which is link 2 of the CI gate. Assert: corpus counts off the artifact; the **1:1 fold invariant
      across every `name` in the corpus**; the three real accented team names (`Türkiye`,
      `Côte d'Ivoire`, `Curaçao`) highlighting the correct **original** slice; constructed accent cases
      (`Núñez`/`nunez`, `Quiñones`/`Quinones`) — **the fixture has no accents at all**; a `^`/`´`
      needle returning `null` without throwing; ñ→n folding; the shootout join on `m074` through the
      nested path; **`Emiliano MARTINEZ` × 2 producing distinct `id`, `href` and `detail`** (React keys
      are the `href`, never the name, never the index); slug-regex conformance; cap behaviour.

### Task 3 — Export `foldForSearch` (AC 2, AC 3)

- [x] **3.1** Add `export` to `foldForSearch` in `format.ts`. Purely additive — `format.test.ts`
      imports only named functions. Extend its docblock naming 2.14 as the second consumer and why
      (indices, which `includesText` discards).
- [x] **3.2** Pin in `format.test.ts` that folding is length-preserving for the corpus's accent set and
      **not** for `^`/`´`/`¨` — the property ruling 6 depends on.

### Task 4 — The shared index loader (AC 7)

- [x] **4.1** New `app/src/lib/tournament-index.ts`: `loadTournamentIndex(): Promise<Tournament>` with
      a **module-scope promise cache**. 🔴 **Write the fetch call verbatim as
      `fetchArtifact<Tournament>("/index/tournament.json")`** — explicit type argument, inline string
      literal, **no extracted constant**. `static-output.test.ts`'s `FETCH_ARTIFACT_PATH` regex
      requires exactly that shape; any other spelling drops the artifact from `reachable` and reds
      three assertions in the one describe in that file which is **not** `skipIf`-gated (it runs on a
      bare `npm test`). Never import `@/lib/build-data` — barred from `src/components/**` and
      build-time only.
- [x] **4.2** Docblock it with ruling 1's reasoning, so the next reader knows why the header does not
      fetch on load.
- [x] **4.3** 🔴 **Cache the FULFILLED promise only.** On rejection, clear the module-scope slot so the
      next engagement retries. A permanently cached rejection kills search for the page lifetime after
      one blip, with no retry path. Every consumer `.catch`es — an unhandled rejection also violates
      Task 11.7's zero-console requirement.
- [x] **4.4** Swap `TournamentHubRegion.tsx`'s bare `fetchArtifact` for `loadTournamentIndex()`, so a
      Hub visitor who searches pays once, not twice. Leave the `schemaVersion` check and the whole
      status machine where they are. ⚠️ **The tripwire "revert if a 2.12 test goes red" does NOT cover
      the real risk**: no 2.12 test exercises a network failure, so a header-first failure would hand
      the Hub a pre-rejected promise it did not cause. 4.3's clear-on-reject is what makes this safe —
      **do 4.3 first**, and if you skip 4.3, skip 4.4 too.

### Task 5 — Locale keys (AC 3, AC 5) — **BEFORE the component, and this order is load-bearing**

`DictionaryKey` is a typed dot-path union over `es`, so `t("search.…")` is a **TypeScript error**
until the namespace exists. Task 8.4's "no dead keys" pushes the other way, so: **write the key and
its call site in the same pass, then run `tsc`.**

- [x] **5.1** `es.ts` **first**: a new top-level `search` namespace at the tail (after `leaderboards`,
      before `export type Dictionary`), with a docblock stating what it reuses, what it mints and why.
- [x] **5.2** Mirror into `en.ts` at the same position. Either file alone is a `tsc` error **and** a
      test failure: `i18n.test.ts` runs `expect(keyShape(en).sort()).toEqual(keyShape(es).sort())`
      plus a leaf sweep that **throws** on any non-string leaf — so no numbers, no arrays.
- [x] **5.3** **Reuse, do not re-mint** (ruling 9). Name each reuse in the docblock.
- [x] **5.4** Mint **only** keys with a rendering call site in this diff (2.18's BINDING prohibition).
      Every branch Task 7.8 enumerates needs its own copy, or it must not ship.
- [x] **5.5** Tuteo. The swept regex bans `usted`, `clasificaci`, `portero`, `parada`, `puerta`,
      `chute`, `córner`, `vosotros`, `fuera de juego` and **`[¡!]`**. Use `Escribe`, `Busca`, `Borra`.
- [x] **5.6** ⚠️ **`es.app` and `es.a11y` key sets are pinned EXACTLY** —
      `expect(Object.keys(es.app)).toEqual(["siteName"])` and `…(es.a11y)).toEqual(["localeAnnouncement"])`.
      A live-region string named `a11y.searchAnnouncement` goes instantly red. It belongs under
      `search.*`. Do not touch `glossary.*` either — pinned exactly, with no allowance.
- [x] **5.7** Extend `i18n.test.ts` with a `search` describe. Register any key builder in the
      **key-builder resolution sweep**.
- [x] **5.8** Append a **"Rows appended by Story 2.14"** section to EXPERIENCE.md's per-term policy
      table. Amend cells; never renumber. Flag authored copy
      `PROPOSED — Juan to confirm or overturn at review`.

### Task 6 — Vendor the sheet primitive (AC 6)

- [x] **6.1** **RULED: vendor `app/src/components/ui/dialog.tsx`** on `dropdown-menu.tsx`'s
      convention — `"use client"`, `import { Dialog as DialogPrimitive } from "radix-ui"`, `data-slot`
      attributes, `cn()`, **no `outline-none`**, `border-hairline bg-surface-overlay shadow-overlay`.
      Every Radix primitive in this tree is vendored this way; an inline import inside `HeaderSearch`
      would be the first departure and is not worth taking. `radix-ui@1.6.5` already bundles
      `@radix-ui/react-dialog`, so **no new runtime dependency** (ruling 2).
- [x] **6.2** Portalling: `dropdown-menu.tsx` portals and states why (*"it keeps the panel out of any
      `overflow-x-auto` … that would otherwise clip it"*); `popover.tsx` deliberately does not. The
      sheet **portals** — it is a full-width overlay escaping an `h-14 sticky z-40` bar. State the
      z-value you choose; **no z-scale is ruled** (2.2 open item 3), and the only values in the tree
      are header `z-40`, skip link `z-50`, overlays `z-10`.

### Task 7 — The combobox component (AC 3, AC 4, AC 8)

New `app/src/components/HeaderSearch.tsx` (`"use client"`), in `src/components/`, **never** `ui/`.

- [x] **7.1** Roles: input `role="combobox"` + `aria-expanded` + `aria-autocomplete="list"` +
      `aria-controls={open ? listboxId : undefined}` (the conditional form, used by four of the seven
      `aria-controls` sites in the tree); panel `role="listbox"`; rows `role="option"` +
      `aria-selected`. Ids from `useId()`.
      🔴 **Emit NO `<section>` element.** `matches/static-output.test.ts`'s `heroSection()` helper
      slices the **whole document** at its first `<section>`, and the header renders before `<main>` —
      a `<section>` here silently re-targets 19 Hero assertions onto search markup. Green tests
      asserting the wrong DOM is the exact "lying about completion" failure this story must not cause.
- [x] **7.2** **Focus stays in the input.** Active option via `aria-activedescendant`, never roving
      `tabIndex` — a deliberate, citable divergence from `PitchPanel`, and the correct one for a
      combobox (ruling 2).
- [x] **7.3** Keyboard: ArrowDown/ArrowUp move the active option (ArrowDown also opens from closed),
      Home/End jump, Enter navigates, **Escape closes in ONE press** (ruling 3). **Never open on focus.**
      🔴 **Rule the Enter mechanism explicitly**: click the active option's anchor ref
      (`anchorRef.current?.click()`), so the `<Link>` stays load-bearing and `prefetch={false}` applies.
      Note for Task 10.2: **jsdom does not navigate** — it logs `Not implemented: navigation to …`,
      which is expected, not a defect; assert on the resolved `href`, not on a location change.
- [x] **7.4** Rows render the three-slice highlight on `glossary-marking.tsx`'s pattern —
      **expression containers only, never literal JSX text**. Entity-type label in
      `type-label-caps text-ink-secondary`; highlight in `accent-cyan` (measure it, Task 11.5).
- [x] **7.5** Every row is a `<Link … prefetch={false}>` (ruling 8), with the sr-only link-prefix on
      `hub.*.rowLink`'s idiom so a screen-reader link list does not read bare names.
- [x] **7.6** Empty state: the composed `const` string (ruling 7) plus a `<Link href="/">` using
      `notFound.homeLink`.
- [x] **7.7** 🔴 **Join the page-wide single-open registry, or ruling 3 enforces UX-DR15 everywhere
      except where it breaks.** `use-glossary-popover.ts` holds `openPopoverClosers`, a module-scope
      `Set` whose comment reads *"PAGE-WIDE SINGLE OPEN (UX-DR15 bans an overlay stack deeper than
      one) … Opening runs every OTHER registered closer first."* It is **module-private**. Glossary
      popovers ship on `/glossary`, on match routes and on the Hub — so open one, then type in the
      header, and you have the 2-deep stack ruling 3 claims to prevent. **Export a registration API
      (`registerOverlayCloser` / `closeOtherOverlays`) from that module; do not create a second
      registry.** Both presentations register. Test it.
- [x] **7.8** 🔴 **Enumerate every render state.** The AC names one; there are six:
      idle-no-query · corpus-loading · results · no-results · **error** · **invalid**. Hold a
      `Status` mirroring `TournamentHubRegion.tsx`'s and gate on `SCHEMA_VERSION` — the header
      searches on four routes where no region validates the artifact for it. **Error and invalid render
      their own keyed message, never the AC's empty state**: "no corpus" and "zero matches" are
      different facts, and the AC's copy asserts the second. `fetchArtifact` also throws typed errors
      on `!ok` and on a 200-with-HTML.
- [x] **7.9** 🔴 **The live region is rendered UNCONDITIONALLY at the top of the component**, never
      inside the open branch — *"a live region that mounts already-populated does not announce
      reliably"* is stated verbatim in four files. **Filtering is undebounced** (ruling 12); the
      **announcement is debounced at `ANNOUNCE_SETTLE_MS = 400`**, copied from `LeaderboardsRegion.tsx`,
      whose recorded rationale is that *"typing an eight-letter name queued eight utterances"* — a
      typeahead is the worst case for this. Announce the **total** match count so the 10-row cap is
      never a silent truncation. *(Note: 2.11a decision 9 rules **one `SortAnnouncer` provider mounted
      in `MatchBundleRegion`, and that it CANNOT live inside the table** — it is a table-scoped
      provider, not a global announcer, so it is a pattern to copy, not a region to reuse. The header
      is outside `MatchBundleRegion` entirely.)*
- [x] **7.10** Draw the search and close glyphs inline as `<svg aria-hidden="true">`, matching
      `SunIcon`/`MoonIcon` in `SiteHeader.tsx` — **no icon package is installed**.

### Task 8 — The `<md` sheet (AC 6)

- [x] **8.1** Icon button `md:hidden`; inline input wrapper `hidden md:flex` (ruling 4).
      **No `useMediaQuery` anywhere in this story.**
- [x] **8.2** The sheet uses Task 6's vendored `Dialog`. Radix owns the focus trap, Escape, and
      focus-return-to-trigger. **One Escape closes the whole sheet**, listbox included (ruling 3).
- [x] **8.3** **Identical semantics.** Extract the listbox into a shared child rendered by both
      presentations so they cannot drift — this is the part most likely to diverge.
- [x] **8.4** Touch targets **≥44×44 px** (`min-h-11 min-w-11`). The bar is a fixed `h-14` (56 px) —
      verify it does not grow. Import `MIN_HIT_PX` from `@/viz/marker-layout` if any JS threshold is
      needed; never re-declare 44.
- [x] **8.5** Reconcile in the Completion Notes: EXPERIENCE.md says **"full-width"** in the Site header
      row and **"full-screen"** in the Header search row. Pick one, ship it, say which.

### Task 9 — Mount into the reserved slot (AC 6)

- [x] **9.1** Replace `<div data-slot="header-search-slot" className="min-w-0 flex-1" />` in
      `SiteHeader.tsx` with `<HeaderSearch />`. **Keep `data-slot` and `min-w-0 flex-1`** — `min-w-0`
      is what lets the input shrink inside the flex row.
- [x] **9.2** **Do not reintroduce `aria-hidden`.** 2.2's review removed it *for this story*:
      *"2.14 mounting search inside it would create focusable-content-inside-aria-hidden"*.
- [x] **9.3** Preserve AC-1 element order: wordmark → **search** → `ES|EN` → theme. Change nothing else.

### Task 10 — Tests

- [x] **10.1** Add **devDependencies only**: `jsdom`, `@testing-library/react`,
      `@testing-library/user-event`, `@testing-library/jest-dom` (without it there is no
      `toBeInTheDocument`/`toHaveFocus`). **`@vitejs/plugin-react` is probably unnecessary** — Vite's
      esbuild already compiles `.tsx` from tsconfig's `jsx: "react-jsx"`, and plugin-react exists for
      Fast Refresh. Try without it first; add it only if JSX fails to transform, and say why.
      **Do NOT change the global `environment`** — a flip changes `storage.test.ts`'s
      `vi.unstubAllGlobals()` restore target. Per-file `// @vitest-environment jsdom` is the current
      documented vitest 3.2.7 API and is what this story uses.
- [x] **10.2** `HeaderSearch.test.tsx` — the repo's first `.test.tsx`. Setup the harness needs and the
      story owes you:
      - **Render inside `LocaleProvider` + `ThemeProvider`** — `useT()` throws outside them.
      - **RTL auto-cleanup will NOT run**: `vitest.config.ts` has no `globals: true`, and
        `@testing-library/react` registers `afterEach(cleanup)` only if a global `afterEach` exists.
        Add `import { cleanup } from "@testing-library/react"; afterEach(cleanup);` explicitly, or the
        DOM leaks forward and the symptom reads as "found multiple elements" — a component bug that
        isn't one.
      - **Radix `Dialog` in jsdom** needs `ResizeObserver`, `Element.prototype.hasPointerCapture` and
        `scrollIntoView` stubs.
      - ⚠️ **This file is linted like any other `src/**/*.tsx`** — there is no test exemption in
        `eslint.config.mjs`, and `--max-warnings 0` is link 1 of the build. No bare JSX text in the
        harness. It also sits inside the `src/components/**` seam: `t` from `@/lib/i18n` and
        `@/lib/build-data` are both barred. **Import `es`/`en` from `@/locales/*`** for expected strings.

      Drive **real key events** with `user-event`: ArrowDown/ArrowUp move `aria-activedescendant`;
      Enter resolves the right `href`; **ONE Escape closes**; focus never leaves the input on desktop;
      the empty state renders the composed string and the `/` link; opening search closes an open
      glossary popover (Task 7.7).
- [x] **10.3** Sheet tests: open from the icon button, focus is trapped, **one** Escape closes, focus
      returns to the icon button. **Test both presentations.**
- [x] **10.4** Extend `src/app/static-output.test.ts`: assert the combobox input and the `<md` icon
      button appear in **every** exported route's HTML (enumerate `out/**/index.html`, or drive off
      the entity list as the existing test does). Use `class="…"`-scoped matching — the RSC flight
      payload has faked a pass twice before. **The open listbox and the sheet contents are not
      assertable here** (they mount on open).
- [x] **10.5** 🔴 **Close the allow-list blind spot (ruling 1).** Extend the module-graph walk to start
      at `src/app/layout.tsx` and `src/app/matches/[slug]/page.tsx` with **per-route allow-lists**, so
      the header's fetch is measured rather than invisible. *(Related, and it stays green because of
      ruling 1's lazy design: `static-output.test.ts` asserts `not.toContain("knockoutResults")` on
      `out/index.html`. Task 2.6 joins `knockoutResults` at runtime, never at build time — do not
      "optimize" by prerendering the corpus.)*
- [x] **10.6** Full chain: `npm run build` **then** `npm test`. Report the total against Task 1.1.

### Task 11 — Browser verification

- [x] **11.1** Build clean, then serve the export:
      `python -m http.server <PRIVATE-PORT> --directory app/out` from the repo root. **`next dev`
      cannot serve `/data/fixtures`** — only `copy-data` populates it into `out/`. **Pick your own high
      port**; concurrent sessions have collided on 8765. Hard-reload (Ctrl+Shift+R) before every
      check — Turbopack reuses chunk filenames. `app/out/` is gitignored and rebuilt in place, so a
      concurrent build can overwrite the export mid-verification; note when you built.
- [x] **11.2** 🔴 **Prove ruling 1 by measurement.** With `performance.getEntriesByType("resource")`:
      load `/matches/m001-mexico-south-africa/`, record the count, confirm **no `tournament.json`
      entry**; focus the input; confirm **exactly one** new entry; keep typing; confirm **no further**
      requests. Repeat on `/` and confirm the Hub fetches it **once, not twice** (Task 4.4).
      *"An assertion in prose does not discharge this AC."*
- [x] **11.3** Keyboard, live, in both presentations: arrows, Enter, **one** Escape, focus position
      after each. If a real Tab resists the harness — a `keydown` capture listener has recorded *"zero
      events across five Tab presses"* here before — fall back to the **document-order focusable walk**
      and say so.
- [x] **11.4** **Both themes, both locales, at 1280 / 390 / 320 px.** `<md` widths need a
      **same-origin iframe** — Chrome will not resize below ~500 px. Confirm `MD_MEDIA_QUERY` is
      genuinely false inside it.
- [x] **11.5** 🔴 **Contrast: reproduce a published figure before trusting a new one** (the method
      2.6 established and 2.9/2.10/2.13 name). Report a dark/light/floor table. **`accent-cyan` on
      `surface-overlay` is unpublished in both themes and is this story's to establish** — DESIGN.md
      publishes 11.3 dark / 5.0 light against `surface-base` only. Verify no `text-ink-muted`
      (**3.30:1 on overlay**) and no `*-on-pitch` token reaches the panel.
- [x] **11.6** Reflow: `document.body.scrollWidth` vs `clientWidth` at 390 **and** 320, **in both
      locales** (EN runs wider than ES, and that asymmetry hid a shipped 1.4.10 failure from 2.11b's
      ES-only review). Exclude elements inside an `overflow-x` ancestor. The **195 px 200%-zoom
      overflow is already attributed to the header** and filed for 2.19 — measure and disclose; do not
      attempt the fix.
- [x] **11.7** **Zero console messages** on a full load of each route.

### Task 12 — Ledger and status

- [x] **12.1** **FILE:** the AC 7 departure with its measurement; the render-test seam and what it now
      makes testable; the `accent-cyan`-on-`surface-overlay` figure; the "full-width" vs "full-screen"
      reconciliation; the fixture's **zero non-ASCII** coverage gap for AC 2; and the **UX-doc
      departure** that in the sheet Esc returns focus to the **icon button**, where EXPERIENCE.md says
      *"returns focus to the input"* (the input is unmounted; Radix returns to the trigger).
- [x] **12.2** **DO NOT FILE — duplicating is the failure mode the list exists to prevent:** the
      dead-link departure (**2.12's D2**, which files it for both surfaces); the `2.11-2.14` vocabulary
      routing (**narrowed by 2.12** to `fouls / duels`, which this story does not render); the 195 px
      zoom overflow (**2.19**).
      ⚠️ **And do not re-file the Hub prefetch item — it is ALREADY FIXED.** `TournamentHub.tsx` ships
      `prefetch={false}` as of **`29e90fb`, this story's own baseline**. `deferred-work.md` still says
      *"STILL OPEN, AND IT IS 2.12's"*; **the ledger is stale**. Correct it in place per the ledger's
      own append-a-correction convention rather than editing the original entry.
- [x] **12.3** Set `sprint-status.yaml` `2-14-header-search: review`, update `last_updated`. Stage by
      explicit path. **Never `git add -A`.**

---

## Dev Notes

### 🔴 RULING 1 — THE INDEX IS **NOT** LOADED ON ANY ROUTE BUT `/`. AC 1's "NO NETWORK" CLAUSE IS FALSE OFF THE HUB, AND THIS STORY DECLARES IT.

**Established by measurement on the built export, per the brief's instruction. The answer is
"not everywhere", which is a real finding rather than something to paper over.**

`grep -rl "index/tournament.json" out/_next/` matches **exactly one chunk** (46,292 B raw /
12,924 gzip), whose content is the minified `TournamentHubRegion`. That chunk is referenced by
`out/index.html` and by **no other route's HTML** — `out/matches/m001-…/`, `out/about/`,
`out/glossary/`, `out/404.html` all reference it **zero** times, and five payload greps for
index-only strings in the match HTML all return **0**. So off the Hub there is **no already-loaded
index**, and the module that fetches it is not even shipped there.

Story 2.6 is why this needed measuring rather than assuming — and note its **code-review
correction**: its eager-chunk disclosure was caused by *"a value import"* creating a static
module-graph edge. **That is exactly what a global header importing the hub region would recreate on
all five routes.**

The rule this collides with is live: `MatchBundleRegion.tsx` says *"FR-34: no tournament.json at
runtime"*, and 2.12 scoped it — *"that rule is **scoped to the match route**"*. **Search on the match
route puts this story inside that scope.** Scale: the real index is **409,524 B raw / 39,137 B gzip**,
not the 7 KB fixture.

**RULED — lazy on first engagement, with a module-scope promise cache** (Task 4). Nothing is fetched
until the user focuses the input or opens the sheet; the artifact is fetched at most once per page
load and shared with the Hub. Module-scope state of this shape is sanctioned — `use-glossary-popover.ts`
cites *"`@/lib/i18n.ts`'s `reportedMissing` is the shipped precedent for module-scope state of exactly
this shape"* — and AD-10 bars a *store*, not a memo.

**Rejected, with costs, so review can overturn cheaply:**
- **Hoist into `layout.tsx`.** Satisfies AC 1's letter everywhere; costs **+39 KB gzip on four routes
  that today pay zero** and contradicts FR-34 outright.
- **A separate `search.json`.** The architecture forecloses it — *"Search-index composition: derived
  client-side from `tournament.json` entities."* It also barely pays: the `entities` slice alone is
  **29,758 B gzip** against the whole index's 39,137 B, for a new schema, an emitter and a change-set
  this story does not own.

**Write AC 7 up honestly**: *zero network beyond the already-loaded index on `/`; on every other route,
exactly one on-demand fetch of that same index, once per page load, triggered by user engagement and
never by page load.*

### RULING 2 — THERE IS NO `cmdk`, AND THERE MUST NOT BE. HAND-ROLL THE COMBOBOX.

UX-DR5 and DESIGN.md both say *"shadcn Command"*. **shadcn's `Command` wraps the `cmdk` package, and
`cmdk` is not installed** (verified: absent from `package.json` and from `node_modules`). 2.2's
boundary is unambiguous: *"Add no new runtime dependencies."*

**RULED: hand-roll it on primitives already present.** `radix-ui@1.6.5` is the umbrella package and
already bundles `@radix-ui/react-dialog`, so the sheet costs nothing new — the same argument
`popover.tsx` and `dropdown-menu.tsx` already make.

**Do not press the existing primitives into the listbox role:** `dropdown-menu` is `role="menu"` and
Radix moves DOM focus into it, which an `aria-activedescendant` combobox must never do;
`popover.tsx` is *"DELIBERATELY BEHAVIOUR-FREE"* and enforces the **absence of a portal**. Copy
`dropdown-menu.tsx`'s **class string**, not its roles.

**This codebase has never shipped `role="combobox"`, `role="listbox"`, `role="option"` or
`aria-activedescendant` — all four are zero-occurrence in `app/src`, as is `<mark>`.** You are
establishing the pattern. EXPERIENCE.md's Comparison entity picker (2.17) specifies the same
primitive — **build so 2.17 can reuse it**; do not build for 2.17.

### 🔴 RULING 3 — ESC IS **ONE** PRESS, AND THE ONLY WAY THERE IS TO NEVER OPEN ON FOCUS.

2.8 shipped a multi-press Escape as a disclosed deviation. **The bug class was later solved in this
codebase, and the fix is copyable.**

**2.8's two compounding mechanisms**, both still live in `PitchPanel.tsx`: (1) `onFocus` opens a
layer, so the `if (isOpenHere)` guard is permanently true and the inner handler always claims press
#1; (2) dismissal restores focus and **focus restoration re-triggers the opener** — its review
corrected the count upward: *"from the **dialog** path it is **three** … the dialog is the primary
path at every shipped width"*.

**2.18 hit mechanism #2 and fixed it**, in `use-glossary-popover.ts`: *"returning focus to the trigger
fires the trigger's `focus` handler, which opens the popover — so Esc closed and instantly re-opened
it, and a keyboard user could never dismiss the panel at all."*

**RULED:**
1. **NEVER open on focus.** The listbox opens on input and on ArrowDown. This alone defeats both
   mechanisms — there is nothing for a restored focus to re-open. **Needing a suppression flag is a
   signal clause 1 was violated**; if you do need one, copy 2.18's rather than inventing one.
2. **The overlay stack is DEPTH 1, always** — UX-DR15 bans *"modal stacks >1 deep"*. Inside the sheet
   the listbox is **not** independently dismissible: one Escape closes everything. This is a
   deliberate divergence from ARIA APG's two-stage combobox Escape, taken because UX-DR15 and the 2.8
   evidence point the same way. **Depth 1 is page-wide, not component-wide** — hence Task 7.7's
   registry work, without which an open glossary popover plus an open listbox is exactly the 2-deep
   stack this ruling forbids.
3. **"Returns focus" resolves per presentation, both trivial by construction.** Desktop: focus never
   leaves the input, so Esc satisfies it in one press with no focus call. Sheet: Radix returns focus
   to the icon button natively (a UX-doc departure — Task 12.1 files it).

### 🔴 RULING 4 — THE `<md` COLLAPSE IS **CSS**, NOT A JS BREAKPOINT BRANCH.

`useMediaQuery`'s `getServerSnapshot` **returns `false`**, and its docblock justifies that with a
condition the header does not meet: *"The Tactical Layer mounts only after the client fetch resolves,
so its first render is a client render and there is no server markup to mismatch."* **Every current
consumer is post-client-fetch. `SiteHeader` is prerendered into all five HTML files.** A JS branch
there emits narrow markup on the server and hydrates wide on desktop — a mismatch on every page.

**RULED:** desktop wrapper `hidden md:flex`, icon button `md:hidden`. Tailwind's `hidden` is
`display:none`, which removes the element from the accessibility tree, so **exactly one combobox is
exposed at any width** — no duplicate roles. The sheet's listbox mounts only while open, with its own
`useId()` namespace. `md` = 768 px; `MD_MEDIA_QUERY` is declared in `rem` deliberately —
*"Hardcoding them in `px` desynchronises the JS branch from the CSS one."*

**Testing consequence:** the prerendered HTML contains **both** branches, so `static-output.test.ts`
can assert both are present but can prove nothing about which is *visible*, and nothing about the
sheet's contents. That is browser work.

### RULING 5 — THE AC's `Intl.Collator` INSTRUCTION IS UNDER-SPECIFIED. REUSE THE SHIPPED FOLD.

**Correction to the brief, which said the collator came from 2.11a and should be imported.** The only
collator construction site in `app/src` is a two-entry `collators` object in `app/src/lib/format.ts`.
It is **module-private**, and it predates 2.11a — it landed in **Story 2.1**. 2.11a only *consumes* it
via `compareText`; `table-sort.ts` *"constructs no second collator"* and says so.

`format.ts` forecloses the collator route for matching in its own words: *"the collators above give
whole-string equality, and **`Intl` has no substring operation of any kind**."* And it says where the
logic must live: *"a second normalization home is precisely the drift that declaration exists to
prevent."*

**RULED:** matching uses **`includesText`**; the highlight needs indices, so Task 3 **exports
`foldForSearch`** — that is the genuine "make it public" change, not the collator. Ordering goes
through `compareText` at its `'es'` default. **Construct no collator; do not export `collators`.**
Trim the query at the model boundary, not inside `includesText` — *"it is the FILTER that should
ignore surrounding space"* (`LeaderboardsRegion.tsx`).

Record this as a **reconciliation of an under-specified UX-DR, not a departure**: the AC asks for
accent/case-insensitive matching and names a mechanism that cannot do substrings. The fold delivers
the behaviour; the collator stays the sort path it always was.

**Two surprising behaviours to state:** `foldForSearch` collapses **ñ → n** (NFD strips U+0303) —
correct for a needle, and the *opposite* of the `'es'` collator's sort, which `table-sort.test.ts`
pins (*"ñ is its OWN LETTER after n"*). And the documented known gap — `ø`, `ł`, `đ`, `ı` fold to
themselves — is **not this story's to close**.

### RULING 6 — THE SPAN IS COMPUTED IN THE MODEL AND SLICED IN THE COMPONENT. IT IS 1:1 ON THE CORPUS; ASSERT THAT.

The brief is right that a folded index does not generally map back. **Measured across all 3,008 `name`
fields in the real index: `foldForSearch` changes the length of exactly zero of them.** The corpus's
entire non-ASCII inventory is three characters — `ü`, `ô`, `ç` — in `Türkiye`, `Côte d'Ivoire`,
`Curaçao`. So on the haystack the fold **is** 1:1.

**It is not 1:1 in general, and the counterexamples arrive through the INPUT.** `foldForSearch`'s
docblock names why: `\p{Diacritic}` *"also covers SPACING characters that are not marks — `^` U+005E,
backtick U+0060, `¨`, `¯`, `´`"*. Measured: `"a^b"` (3) folds to `"ab"` (2). Both `^` and `´` are
dead-key-adjacent on a Spanish keyboard.

**RULED:** do the arithmetic **on the haystack only**; find the span in the folded haystack with the
folded needle's length, slice the **original**. **Guard it**: when
`foldForSearch(name).length !== name.length`, return `null` — the row still matches and still renders,
only the highlight drops. **This is a deliberate departure from the house fail-loud idiom**
(`assertFinite`, `groupScorers`' throw): a highlight is decoration, and throwing would take down the
header on every route. Comment it.

**Reuse `TermSpan` from `@/lib/glossary`** (exported, `{start, end}`, half-open) — but **not
`findTermSpan`**: it case-folds only, with no NFD and no accent handling, and its docblock lists three
properties, accent-insensitivity not among them. Copy `glossary-marking.tsx`'s three-slice render,
whose header states the rule that makes it mandatory: *"MARKING NEVER WRITES COPY INTO JSX."*

### RULING 7 — `"Sin resultados para «{query}»."` IS COMPOSED AT THE CALL SITE.

`t()` has no interpolation — stated seven times in `es.ts` alone, e.g. *"t() HAS NO INTERPOLATION, so
the result-count sentence is composed at the call site."* The shipped idiom is `…Before`/`…After`
fragments joined into a `const`.

**The guillemets cannot be JSX.** `react/jsx-no-literals` with `noStrings: true` bans any bare JSX
text child, and 2.18 ruled the general case: *"a JSX `{t(a)} ({t(b)})` emits ` (` and `)` as literals
and fails the gate."* Compose in a `const` and pass it through an expression container. `«»` is not on
the forbidden-register list (which bans `[¡!]`), so guillemets are legal in a locale value.

### RULING 8 — RESULT ROWS ARE REAL LINKS, WITH `prefetch={false}`. CITE THE LEDGER; FILE NOTHING.

Settled three times and **not reopened**:
- `LineupsDisclosure` and `MatchHero` ship `/players/{slug}/` and `/teams/{slug}/` to unbuilt routes
  **today**, pinned **executably** by `matches/static-output.test.ts`:
  `expect(html).toContain('href="/teams/mexico/"')` and
  `expect(html).toContain('href="/players/quinones-julian-mex/"')`.
- **2.12's D2**: *"Standings rows **do** link to `/teams/{id}/`. This departs from 2.8/2.11c."*
- **2.13's ruling 3**, quoting the sentence that names **your** surface: the IA table lists the Player
  Profile as *"Reached from: Leaderboards, lineups, **header search**"*. The Team Profile row reads
  *"Standings, match header, **header search**"*, the Match Dashboard row *"…shared links, **header
  search**"*. **All three of your entity types are named as reached-from-search.**

The 2.8/2.11c plain-text ruling scoped itself — *"UX-DR22's mandatory cross-link is scoped to lineup
player names"* — so it governs pass-network nodes and Expert cells, not navigation surfaces.

**Slug safety, corrected from the brief.** `^[a-z0-9]+(-[a-z0-9]+)*$` is real but is **not in AD-3**,
which states the rule only in prose (*"lowercase ASCII kebab (accent-stripped)"*). It lives in
**`contract/common.schema.json`**, which carries **three** patterns — `matchId` is
`^m[0-9]{3}-[a-z0-9]+(-[a-z0-9]+)*$` and `playerId` is `^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{3}$`. Cite the
schema, not AD-3. Verified **0 violations** across all 1,400 real ids and all fixture ids; direct
interpolation is safe, no `encodeURIComponent`.

**`prefetch={false}` IS MANDATORY.** 2.13 measured Next's default prefetch taking
`performance.getEntriesByType("resource").length` from **48 → 75** across one sort pass, *"every
`<Link>` entering the viewport fired a route fetch"*. **A typeahead re-renders its whole link list on
every keystroke** — the worst shape for this defect.

**File nothing.** 2.12's entry *"files the departure for both surfaces"*, and 2.13 mirrored it and
filed nothing. **Disclose:** `app/src/app/` has no `players/` or `teams/` directory, so with
`output: 'export'` every player and team result **hard-404s until 2.15/2.16**. Match results resolve
today.

### RULING 9 — VOCABULARY: REUSE FIRST, MINT ONLY WHAT SHIPS, APPEND THE POLICY ROW.

2.18's **BINDING** prohibition: *"A row whose surface does not exist cannot be 'implemented' in a
locale file without minting a dead key."* **Every key you mint must have a rendering call site in your
diff.** `leaderboards`' docblock is the binding reuse precedent: *"**NO COLUMN LABEL FOR THE ENTITY OR
THE TEAM.** Those two heads resolve `viz.table.player` / `viz.table.team` … a second pair here would
be two sources for one term."*

**REUSE:** `viz.table.player` / `viz.table.team` / `hub.results.column.match` (entity-type labels);
`leaderboards.filterResults` / `filterResultsOne` (count); `notFound.homeLink` (the link to `/`);
`hub.results.extraTimeShort` / `shootoutFull` (decider); `hub.separator` (`" · "`, never a hardcoded `·`).

**MINT** a new top-level **`search`** namespace at the tail — the one append point that does not
collide with a story extending an existing namespace. Only the input's label and placeholder (naming
all three entity types, so `leaderboards.filterLabel`'s leaderboard-scoped copy would be false), the
`«{query}»` fragments, the sheet's open/close labels, the listbox's accessible name, and Task 7.8's
error/invalid copy.

**⚠️ THE ESLint GATE IS ON STRING LITERAL VALUES, NOT ON PROP NAMES.** The selectors are
`JSXAttribute[name.name=/…/] > Literal` and the matching `JSXExpressionContainer` form — so
**`<Row label={t("search.x")} />` is LEGAL**; `t("x")`'s literal is a child of a `CallExpression`, not
a direct child of the container. The config says so itself: *"t()/variable/function values stay
legal."* **Do not contort the component API to avoid these names.** What *is* illegal is a bare
literal or template on one of the **sixteen** gated attributes: `aria-label`, `aria-description`,
`aria-placeholder`, `aria-roledescription`, `aria-braillelabel`, `aria-valuetext`, `title`, `alt`,
`placeholder`, `label`, `message`, `text`, `description`, `caption`, `heading`, `tooltip` — note
`aria-label` and `placeholder`, which a hand-rolled combobox certainly writes. `href` is **not**
gated. `value` is exempt from the name regex (the config names `SiteHeader`'s own toggle tokens as
the reason) but *is* gated element-scoped on `<Label>`/`<LabelList>`.

**Register (mechanically swept in `i18n.test.ts`):** tuteo; `usted`, `clasificaci`, `portero`,
`parada`, `puerta`, `chute`, `córner`, `vosotros`, `fuera de juego` and `[¡!]` all fail the build.

**No glossary marking on entity-type labels.** There is no `GlossaryTermId` for player/team/match
among the 42; 2.5's ruled decision 8 — *"A dotted cyan underline is an affordance; with no tooltip
behind it, it is a broken promise"* — and a `GlossaryTerm` is a `<button>`, which must never nest
inside an `option`.

**Append the EXPERIENCE.md policy row.** `es.ts` records the failure mode: *"Minting terminology
without the row is how the table stops being the record."*

**File nothing for vocabulary.** The `2.11-2.14` routing was **narrowed by 2.12** — *"2.12 discharges
the first two only"* — to `fouls / duels`, which this story does not render.

### RULING 10 — THIS STORY INTRODUCES THE RENDER-TEST SEAM. THE LEDGER NAMED ITS OWNER.

**No React component has ever been rendered in a test here.** No jsdom, no `@testing-library/*`, no
`user-event`, no jest-axe, no Playwright. `vitest.config.ts` is 14 lines, `environment: "node"`, no
setup file; all 28 test files are pure-model or static-output; `axe-core` is present but
**transitive only**, via `eslint-plugin-jsx-a11y`.

AC 4 is irreducibly interactive. The ledger says this class is currently unverifiable —
*"untestable in a node-only harness"* — and names the owner: **"whichever story introduces jsdom or a
render-test seam."** The brief's *"verify with real key events rather than by reading the handler"* is
only satisfiable by taking that on.

**RULED: introduce it, scoped and per-file** (Task 10.1). **devDependencies only** — 2.2's prohibition
is on **runtime** dependencies; `dependencies` is untouched and nothing ships to the browser.
**Do not flip the global `environment`.** Say this loudly in the Completion Notes: it is a harness
change, not a story detail, and prior stories were explicitly forbidden from making it.

**Limits to carry, not paper over:** a real Tab key has never been delivered in this project's browser
automation; there is **no live screen reader** (carry the standing boilerplate — *"the structural pass
read roles, labels and strings back from the live DOM in both locales, which is not the same thing"*);
and **no axe** — 2.19 owns it.

### RULING 11 — MATCH ROWS JOIN THE **NESTED** DECIDER, OR FOUR REAL MATCHES LIE.

`entities.matches[].score` is the **full-time** score and the entity carries no knockout detail.
Measured on the real corpus: of 32 knockout rows, **23 regulation / 5 extra-time / 4 shootout**. And
`m074-germany-paraguay` carries `score {home:1, away:1}` while its knockout row records
`shootoutScore {home:3, away:4}` and `winnerTeamId: "paraguay"` — a bare `1–1` presents a match
Germany lost as a draw.

**RULED:** the header holds the whole `tournament.json`, so `knockoutResults` is in hand at zero cost.
Join by `matchId` and render the decider through **`decidedByCaption`**. 🔴 **The field is nested:
`knockoutResults[].knockoutScore.decidedBy`, not `knockoutResults[].decidedBy`** (Task 2.6) — the
row's own keys are `awayTeam, date, group, homeTeam, kickoff, knockoutScore, matchId, matchNumber,
matchdayRound, score, stage, venue`. This reads artifact values verbatim; no derivation, AD-5 clean.

Names need no join — `homeTeam`/`awayTeam` are `EntityRef {id, name}` on the entity itself. `date`,
`kickoff`, `venue` and `matchNumber` exist **only** on the knockout/group rows and the search row does
not need them. The schema states the intent: *"The IA specifies match search results as **teams plus
score plus stage**."*

### RULING 12 — WHAT THE FIXTURE CAN AND CANNOT PROVE. THE ACCENT AC IS **NOT** FIXTURE-VERIFIABLE.

| | fixture | real (`data/index/`, tracked, clean) |
|---|---|---|
| players / teams / matches | 2 / 1 / 4 | **1,248 / 48 / 104** |
| searchable rows | **7** | **1,400** |
| raw / gzip-9 | 7,391 B / 1,196 B | **409,524 B / 39,137 B** |

**The single most important gap: the fixture contains ZERO non-ASCII characters.** Every accent
assertion against it would be a case-insensitivity assertion wearing an accent-insensitivity label.
The real corpus has three, **all team names**. **All 1,248 real player names are ASCII** — the source
prints diacritics already stripped (`Julian QUINONES`, `Antonio RUEDIGER`, `Darwin NUNEZ`).

**That inverts the use case and strengthens the AC:** the user types the *correct* spelling —
`Quiñones`, `Rüdiger` — and the data does not have it. **Folding both sides is what makes that work**;
a naive `String.includes` fails it. This is the actual justification for AC 2 — say so.

**Verifiable on the fixture now:** corpus assembly; entity-type labels; combobox roles and keyboard
model; case-insensitive highlight; the empty state in both locales; the sheet; match-row composition;
href construction and slug conformance; `/matches/{matchId}/` route existence.

**Not fixture-verifiable — cover with the real index in node tests (Task 2.10) and say so:**
accent-insensitive matching; result capping (7 rows never overflow, 1,400 always do — `"a"` matches
most of the corpus); **duplicate-name disambiguation**, which *is* testable today against the real
index; any payload or perf claim (the fixture understates by 55×).

**Fixture-internal inconsistency to design around, not fix:** `entities.matches` references **8
distinct team ids** while `entities.teams` carries **one**. So a fixture search for "Belgium" matches a
*match* and never a *team*. The bijection test asserts only `on_disk <= listed`, so this is legal and
will persist. **Drive everything off `entities.*.length`.**

**Performance:** a pre-folded linear scan over 1,400 rows is comfortably inside a frame budget;
re-folding inside the filter costs roughly 36× more. Both fit, so this is a cleanliness rule, not a
rescue — **fold once when the artifact lands** (Task 2.4). No trie needed. **This does NOT mean "no
debounce"** — filtering is undebounced, but the *announcement* is debounced (Task 7.9).

### RULING 13 — THE INPUT FIXTURE IS DIRTY. RE-MEASURE, DO NOT INHERIT.

`data/fixtures/index/tournament.json` is modified and uncommitted by the in-flight Story 1-18, which
is in `review` — a review pass could still regenerate it. Its change is already complete in the tree
(+60 lines): `entities.matches` +1 (`m082-belgium-senegal`), `entities.players` +1
(`acevedo-carlos-mex`, the deliberate zero-appearance-player fixture), `knockoutResults` +1.
`entities.teams` and `schemaVersion` unchanged; **no new top-level keys**.

1-18's *"Unchanged by design"* list names **`app/**` and `contract/**`** — so the
`EntityIndex`/`PlayerEntity`/`TeamEntity`/`MatchEntity` shapes and the generated types are **frozen**
through 1-18. **Your corpus shape is stable; only counts move.** Note `PlayerEntity` carries
`team: {id, name}` — there is **no `teamId`** field on a player.

### Theme and contrast — the light theme is where this breaks

**Every first-consumer story so far found a light-theme failure from this position** (2.6, 2.7, 2.8,
2.9, 2.10). The recurring root cause is borrowing ink from a **theme-invariant** context (the pitch)
onto a **theme-aware** surface, where light resolves near-white and the borrowed near-white ink
collapses to ~1.1:1.

**Your surface is `surface-overlay`** — DESIGN.md maps `--popover` → `{colors.surface-overlay}`,
scoped *"popovers, tooltips, sheets"*. Radius `rounded-sm`; shadow only because it is a true overlay.

- **`text-ink-muted` may NEVER carry copy here** — **3.30:1 on `--surface-overlay`**, below the 4.5:1
  floor. `GlossaryTerm.tsx` carries the comment verbatim. Use `text-ink-primary` /
  `text-ink-secondary` / `border-hairline`.
- **Never any `*-on-pitch` token** — the exact 2.6/2.9/2.10 failure.
- 🔴 **`accent-cyan` on `surface-overlay` is UNPUBLISHED in both themes.** DESIGN.md specifies the
  highlight in `{colors.accent-cyan}` and publishes 11.3 dark / 5.0 light — **against `surface-base`**.
  This is the first surface putting cyan text on an overlay. **Measure it and record the figure**
  (Task 11.5), by the established method: reproduce a published figure before trusting a new one.
  Floors: **4.5:1 text**, **3:1 non-text**. There is no committed contrast script.

### Known inherited behaviours — do not "fix" them here

- `LineupsDisclosure` and `MatchHero` ship their entity links **without** `prefetch={false}`. Not yours.
- The single polite live region in `LocaleProvider` serves only the language announcement.
- The **195 px 200%-zoom reflow overflow is already attributed to the header** + Hero + key-stats,
  filed for 2.19. You are adding to the header — measure, disclose, do not fix.
- A pre-existing document overflow at 320 px is attributed to a Key Statistics stat tile under
  everything-expanded conditions. Exclude elements inside an `overflow-x` ancestor from any offender
  sweep, or it flags five untouched sections.
- *(The Hub's prefetching standings links are **already fixed** at this baseline — see Task 12.2.)*

### Scope boundary — do NOT build here

- **`/players/{slug}` and `/teams/{slug}` themselves.** 2.15 / 2.16 — this story only links.
- **A `search.json` artifact, an emitter, a schema or a `schemaVersion` bump.** Ruling 1.
- **`cmdk`, or any new `dependencies` entry.** Ruling 2. devDependencies for the harness only.
- **`PitchPanel.tsx`'s Escape layering.** 2.8's deviation is recorded and owned there.
- **`table-sort.ts`, `DataTable.tsx`, `match-hero.ts`, `TournamentHub.tsx`, `LeaderboardsSection.tsx`.**
  Import from them; change nothing. The sanctioned exceptions are Task 4.4's one-line
  `TournamentHubRegion` swap, Task 7.7's registry export in `use-glossary-popover.ts`, and Task 2.7's
  `playerHref` addition in `hub-model.ts`.
- **`enums.metric` (sealed), `glossary.*`, `es.app`, `es.a11y` (all pinned exactly), the CS-1 tripwires.**
- **A `metadata` export decision.** `/about` and `/glossary` deliberately export none.
- **`/contract`, `pipeline/`, `data/`.** Nothing outside `app/` and the shared BMad artifacts.
- Comparison mode (2.17), Lighthouse/axe/real-data swap (2.19).

---

## Project Structure Notes

**New**
- `app/src/lib/search-model.ts` + `search-model.test.ts`
- `app/src/lib/tournament-index.ts`
- `app/src/components/HeaderSearch.tsx` + `HeaderSearch.test.tsx` *(the repo's first `.test.tsx`)*
- `app/src/components/ui/dialog.tsx` *(vendored, ruling 2 / Task 6)*

**Modified**
- `app/src/components/SiteHeader.tsx` — the slot only
- `app/src/lib/format.ts` + `format.test.ts` — export `foldForSearch`
- `app/src/lib/hub-model.ts` — add `playerHref`
- `app/src/lib/use-glossary-popover.ts` — export the overlay-closer registration API
- `app/src/components/TournamentHubRegion.tsx` — one-line loader swap
- `app/src/locales/es.ts` / `en.ts` — one new `search` namespace, append-only
- `app/src/lib/i18n.test.ts` — new describe
- `app/src/app/static-output.test.ts` — route sweep + the `layout.tsx` allow-list walk
- `app/vitest.config.ts`, `app/package.json` — the render-test seam (devDependencies only)
- `_bmad-output/planning-artifacts/ux-designs/…/EXPERIENCE.md` — appended policy rows
- `_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`

**Read but NOT modified — and it constrains you:** `app/src/app/matches/static-output.test.ts`.
Its `heroSection()` slices the whole document at the first `<section>`. See Task 7.1.

**Placement rules.** Pure model code importing `@/lib/format` goes in `src/lib/`, not `src/viz/`.
Components go in `src/components/`, **never** `src/components/ui/` unless vendoring a Radix primitive.
Tests are co-located `<module>.test.ts(x)`. **Do not create a new top-level `src/` directory** — one
absent from the ESLint seam's `files` list escapes the bar entirely while looking covered.

**Client-import seam.** `src/components/**` and `src/viz/**` may not import `t` from `@/lib/i18n`
(use `useT()`) and may not import `@/lib/build-data` **at all**. Type-only imports of
`DictionaryKey`/`Locale` stay legal. **This applies to `.test.tsx` too** — there is no test exemption.
If you touch `eslint.config.mjs`, add **both** fixtures to `eslint-gate.test.ts` — a positive and its
negative counterpart; every prior selector shipped that pair.

**Concurrent-session hazard.** `app/` is clean at the baseline, but 1-18 has `data/fixtures/` and
`pipeline/` dirty, and 2.13's code review is still pending against `format.ts`, the locale files and
`i18n.test.ts`. **2.13's implementation was already swept into another story's commit once** — that is
how `foldForSearch` reached `29e90fb` under a "Story 2.12 code review" title. **Re-read every file you
extend immediately before editing it; commit your slice early and by explicit path; never
`git add -A`.** `deferred-work.md` line numbers drift — **grep the quoted phrase**, and note the
ledger is stale on the Hub prefetch item (Task 12.2).

**Toolchain, pinned.** next `16.2.11`, react `19.2.8`, radix-ui `^1.6.5`, typescript `~6.0.3`,
vitest `^3.2.7`, tailwindcss `~4.3.3`, node `>=24`. `npm run build` =
`lint → typecheck → assert:schema-version → next build → copy-data`, and **that is the CI gate** —
`netlify.toml` runs exactly `npm run build`. `next build` never lints in Next 16. `npm test` is
`vitest run` and is **not** part of the build.

---

## References

*Provenance is exact below — several phrases commonly attributed to a story file actually live in
source. Grep the file named here, not the story that popularised the phrase.*

- `epics.md:899` (the ACs, reproduced verbatim above); **UX-DR4**, **UX-DR5**, **UX-DR15**
  (*"modal stacks >1"*), **UX-DR16**, **UX-DR22**; **FR-34**, **NFR-1**, **NFR-2**. Stories
  **2.2** (`:638`), **2.15** (`:919`), **2.16** (`:941`), **2.17** (`:959`).
- `EXPERIENCE.md` — the **IA route table** (all three entity rows name *"header search"*), the
  **Header search** Component Patterns row (*"shadcn Command combobox semantics"*, *"Sin resultados
  para «{query}»."*, *"full-screen sheet"*), the **Site header** row (*"full-width sheet"* — the
  conflict is real), **Interaction Primitives** (*"Esc closes the topmost popover/tooltip/sheet"*),
  the **Banned** list, the **Accessibility Floor**, the per-term policy table and its extension
  procedure.
- `DESIGN.md` — `components.header-search`, the **Overlay** bullet (*"popovers, tooltips, sheets"*),
  `--popover` → `{colors.surface-overlay}`, `#1F252B`/`#EDF0F2`, both shadow values, and cyan at
  **11.3 dark / 5.0 light against the base surface** — with **nothing published for cyan on overlay**.
- `ARCHITECTURE-SPINE.md` — **AD-3** (id = slug, *in prose only*), **AD-4** (route manifest + combined
  Hub budget), **AD-5**, **AD-10**, **AD-11**, **AD-12**, **AD-14** (*"search/typeahead"* field
  sufficiency). **Deferred:** *"Search-index composition: derived client-side from `tournament.json`
  entities."*
- `reviews/review-adversary.md` **L1** — *"accent-insensitive matching needs the display name; player
  results need team context; match entries need both team names + stage"*.
- `review-accessibility.md` — `ink-muted` *"3.30 on overlay"*; `ink-primary` on overlay 14.13.
- **Source files carrying quotes this story leans on:** `app/src/lib/format.ts` (*"`Intl` has no
  substring operation of any kind"*, *"a second normalization home is precisely the drift…"*, the
  `\p{Diacritic}` spacing-character comment, the `ø ł đ ı` gap); `use-glossary-popover.ts` (the
  Esc-reopen defect, `DISMISS_FOCUS_SUPPRESSION_MS`, `openPopoverClosers`, the `reportedMissing`
  precedent); `glossary-marking.tsx` (*"MARKING NEVER WRITES COPY INTO JSX."*);
  `LeaderboardsRegion.tsx` (the filter input, the trim ruling, `ANNOUNCE_SETTLE_MS`, *"a round trip
  for a route that does not exist"*); `MatchBundleRegion.tsx` (*"FR-34: no tournament.json at
  runtime"*); `SortAnnouncer.tsx` (*"a live region that mounts already-populated does not announce
  reliably"*); `es.ts` (*"t() HAS NO INTERPOLATION"*, *"NO COLUMN LABEL FOR THE ENTITY OR THE TEAM"*,
  *"Minting terminology without the row is how the table stops being the record"*);
  `use-media-query.ts` (the `getServerSnapshot` rationale); `table-sort.test.ts` (*"ñ is its OWN
  LETTER after n"*).
- Stories **2.2** (Task 5.3's slot ruling, the `aria-hidden` removal, "no new runtime dependencies"),
  **2.4**, **2.6** (the contrast method in practice; the eager-chunk disclosure **and its value-import
  correction**), **2.8** (the plain-text ruling; the *"from the dialog path it is three"* correction),
  **2.11a** (decision 9 — one `SortAnnouncer` provider, **which cannot live inside the table**),
  **2.11c** (ruling 8), **2.12** (**D2**, `hub.*`, *"do not write a second switch"*, the budget
  scoping), **2.13** (**ruling 3**, the 48→75 prefetch measurement), **2.18** (the BINDING dead-key
  prohibition, the policy-table procedure, the JSX-literal gate).
- `deferred-work.md` — grep *"`/teams/{teamId}/` links now ship from THREE surfaces"* (**cite, do not
  re-file**), *"NARROWING, not a closure"*, *"whichever story introduces jsdom or a render-test seam"*,
  *"has never been verified with a real Tab key"*. ⚠️ Its `<Link prefetch>` entry is **stale** — the
  Hub half was fixed in `29e90fb`.
- `contract/common.schema.json` (three slug patterns), `contract/tournament.schema.json`
  (`EntityIndex` — *"the entire header-search corpus"*; `MatchEntity` — *"teams plus score plus
  stage"*; `PlayerEntity` — *"name plus team"*).

---

## Open Questions (filed, not answered)

1. **Should results be grouped by entity type, or interleaved?** Nothing rules it. This story
   interleaves (prefix-first, then the pinned corpus order), because grouping at a 10-row cap would
   frequently show one group and starve another. Any grouping heading would need
   `/clasificaci/`-safe vocabulary. Revisit at 2.19.
2. **Is 10 the right cap, and should the count line link to a results page?** There is no `/search`
   route in the IA table and this story does not add one. At 1,400 entities a one-character query
   matches most of the corpus, so a cap is unavoidable; 10 is a judgement, not a ruling.
3. **Does the header want a `/` or `Ctrl+K` hotkey?** Named nowhere in any planning artifact. Not
   built. A global key handler on a surface with this Escape-layering history is something to rule
   deliberately rather than add casually.
4. **For 2.19:** is 39 KB gzip the right thing to pull on a match route at all, or does the `entities`
   slice (29,758 B) or a projected corpus earn a contract change once real query behaviour is known?
   Ruling 1 settles the *mechanism*; the *payload* is genuinely open.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via the `bmad-dev-story` workflow.

### Debug Log References

**Task 1.1 — baseline, re-measured rather than inherited.** `out/` was already present at
session start (gitignored, left by a prior build), so both measurements agree: bare `npm test`
and `npm run build && npm test` each report **28 test files / 868 tests**. The bare run's one
failure was a 5 s timeout in `assert-schema-version.test.ts`, which passes in **1.67 s** run
alone — a pre-existing timing flake, present before this story touched a file, and addressed at
Task 10.6 below.

**Task 1.2** — `git log --oneline -1` = `29e90fb`; `git status --short app/` empty. Confirmed.

**Task 1.3 — input fixture re-measured** (it is dirty from in-flight Story 1-18):
`schemaVersion 4`, **1 team / 2 players / 4 matches / 2 knockoutResults**. 1-18's additions
(`m082-belgium-senegal`, `acevedo-carlos-mex`) are already in the tree. Real index
(`data/index/`): `schemaVersion 4`, **48 / 1,248 / 104**, 32 knockoutResults. The nested decider
path was confirmed by inspection: `knockoutResults[].knockoutScore.decidedBy`.

**Three findings the tests produced, each of which would have shipped silently.**

1. 🔴 **`hub.separator` (" · ") is not fold-safe.** U+00B7 MIDDLE DOT is in `\p{Diacritic}`, so
   `foldForSearch` DELETES it: `" · "` (3) folds to `"  "` (2). Composed into a match name it
   broke the 1:1 fold invariant on **all 104 match rows** and dropped every match highlight —
   silently, because quiet degradation is exactly what `matchSpan`'s guard is for. Caught by the
   corpus-wide fold test, not by reading. The joiner is now `match.hero.scoreSeparator`
   (U+2013 EN DASH, which folds to itself), and the property is pinned in both
   `search-model.test.ts` and `format.test.ts`.
2. 🔴 **The overlay registry fix was half-done, and only the browser caught it.** Task 7.7 was
   implemented for the SHEET only, so the mechanism looked complete while the presentation
   visible at desktop width stayed outside it. Measured live: listbox open with 2 options →
   hover a glossary term → **overlay depth 2**, the exact stack UX-DR15 forbids. The inline
   listbox now registers its own closer and claims the slot on open; the sheet's field
   deliberately does neither, because its listbox is PART of a dialog that already holds the
   slot — a field that closed "every other overlay" would close the dialog being typed into.
   Re-measured non-vacuously: listbox open (2 options) → hover → popover open, listbox closed,
   **depth 1**, query preserved. Three regression tests added.
3. **Task 2.10's literal expectation contradicts ruling 6's mechanism.** Task 2.10 asks for "a
   `^`/`´` needle returning `null`"; ruling 6 says the arithmetic is done "on the haystack
   only", sized by the FOLDED needle. Under that mechanism a `^` in the NEEDLE cannot shift
   anything — `"me^x"` folds to `"mex"`, `"Mexico"` is 1:1, and `[0,3)` yields the correct
   `"Mex"`. **The mechanism governs.** A needle that folds away ENTIRELY (a bare `"´"`) still
   returns `null`, and neither case throws. Both are asserted, with the reconciliation recorded
   at the test.

**Harness limits met and named, not worked around.** (a) `trailingSlash: true` lives in
`next.config.ts`, which vitest never loads, so `<Link>` renders the slash-less href in jsdom
and the slashed one in the real export — the slash is asserted in `search-model.test.ts` and in
the static-output suites instead. (b) jsdom does not navigate; the Enter test asserts on the
resolved href and the `Not implemented: navigation` line is expected. (c) Under a modal Radix
dialog, RTL sees exactly ONE combobox — a second, independent mechanism for the same guarantee
CSS gives at real widths.

### Completion Notes List

**Every AC is discharged, and AC 7 is discharged as a DECLARED DEPARTURE with its measurement.**

- **AC 1 / AC 2 / AC 3 / AC 8** — `search-model.ts` (36 tests) against the **real** 1,400-row
  index, driven off `entities.*.length`. Corpus order is pinned `teams → players → matches`.
- **AC 4** — verified with real key events in the repo's first render test (30 tests) and again
  live in the browser: ArrowDown/ArrowUp/Home/End move `aria-activedescendant`, focus never
  leaves the input, Enter activates the active option's own anchor, and **Escape closes in ONE
  press** in both presentations.
- **AC 5** — the composed `"Sin resultados para «{query}»."` plus the `/` link, seen live.
- **AC 6** — the `<md` sheet, measured at 386 px in a 386 px viewport, top-anchored.
- **AC 7** — see the departure below.

🔴 **AC 7's "no network beyond the already-loaded index" is FALSE off the Hub, and this story
says so.** Measured on the built export *before* writing code: the chunk that fetches
`index/tournament.json` is referenced by `out/index.html` and by **no other route's HTML**.
RULED: lazy on first engagement with a module-scope promise cache. **Re-measured in the browser
on `/matches/m001-…/`: 33 resources on a settled load with ZERO `tournament.json` entries →
focus the input → EXACTLY ONE new entry → six more keystrokes → NO further requests.** On `/`
the artifact is fetched **once, not twice** (Task 4.4's shared loader). Filed in full.

**The render-test seam is a HARNESS CHANGE, and prior stories were explicitly forbidden from
making it.** Four **devDependencies** only (`jsdom`, `@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom`); `dependencies` is untouched and
nothing ships to a browser. **`@vitejs/plugin-react` proved unnecessary** — esbuild already
compiles `.tsx` from tsconfig's `jsx: "react-jsx"`, and the plugin exists for Fast Refresh; it
was tried without and never needed. **The global `environment` stays `"node"`**; the seam is a
per-file `// @vitest-environment jsdom` pragma. `axe` is still absent (2.19 owns it), there is
still no live screen reader, and a real Tab key still could not be delivered — the element-order
check fell back to the document-order focusable walk and says so.

**Contrast (Task 11.5), by the established reproduce-first method.** The same script measured
**cyan on `surface-base` at 11.27 dark / 4.99 light**, reproducing DESIGN.md's published
11.3 / 5.0, before recording the new figure. **`accent-cyan` on `surface-overlay`: 9.20:1 dark /
4.68:1 light** — both clear the 4.5:1 text floor, light being the tighter. A live class audit of
the open panel found only `text-ink-primary`, `text-ink-secondary`, `text-accent-cyan` and
`bg-transparent`: **no `ink-muted`** (3.30 on overlay, below the floor) and **no `*-on-pitch`
token**. The `<mark>` cue is not colour alone — `font-weight: 600` carries it too.

**Reflow (Task 11.6).** `<md` widths measured in a same-origin iframe with `MD_MEDIA_QUERY`
confirmed genuinely `false` inside. At **320 and 390, both locales, both themes**: icon button
exactly **44×44**, header still exactly **56 px** (it did not grow), and **0 px** document
overflow on `/`, `/glossary` and the match route at 390. The match route at 320 shows **7 px**,
and it is **not the header's**: `header.scrollWidth === header.clientWidth`, and the search
slot's right edge sits at 118 px. That is the pre-existing content overflow already attributed
to 2.19 — measured and disclosed, not fixed.

**Zero console messages** on a full load *and* an engagement of all five routes, captured by
hooking each route's console before boot rather than by reading afterwards.

**Task 8.5 — "full-width" vs "full-screen" reconciled: FULL-WIDTH ships.** EXPERIENCE.md says
both in different rows. Measured: **386 px wide in a 386 px viewport, anchored at `top: 0`**,
`max-h-dvh` + `overflow-y-auto`, so height is content-driven. Chosen so the reader's typing hand
and eye stay where the control they pressed lives. The doc conflict is filed.

**Two deliberate deviations from the story's own letter, both recorded at their call sites.**
(1) `searchEntities` takes a second `SearchLabels` argument, which the story's literal signature
block omits — but Task 2.3 requires the module to be locale-free and Task 2.5 requires a match
detail of "stage label + scoreline + decider", which is three locale-bound strings. Passing them
in is what keeps `t()` out of the model. (2) The match detail uses the Hub's **visible short**
decider forms (`hub.results.extraTimeShort`, and the pens scoreline with `match.meta.penShort`)
rather than `hub.results.shootoutFull`, which ruling 9's reuse list names. `shootoutFull` is the
Hub row's **sr-only companion to a visible short form**; a search row renders one plain `detail`
string with no such split, so using it would either duplicate the fact or bury the number that
makes m074 honest.

**Ruling 8 disclosed, not filed:** `app/src/app/` still has no `players/` or `teams/` directory,
so with `output: 'export'` every player and team result **hard-404s until 2.15 / 2.16**. Match
results resolve today. 2.12's D2 already files this for both surfaces.

**Observed, worth a reviewer's eye, not filed:** Radix's Dialog does not set `aria-modal` on the
sheet; it marks the rest of the document `aria-hidden` instead (verified live). That is the more
robust of the two mechanisms and no axe rule requires the attribute, so it was left as Radix
ships it rather than overridden.

**Locale copy is PROPOSED, not ruled.** Every string minted in the new `search` namespace is
flagged `PROPOSED — Juan to confirm or overturn at review` in EXPERIENCE.md's appended policy
rows, except `"Sin resultados para «{query}»."`, which this file already quotes verbatim and
which was therefore implemented rather than authored.

### Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story 2.14 started; baseline `29e90fb`, `app/` clean, 28 files / 868 tests |
| 2026-08-06 | Task 3: `foldForSearch` exported with the 1:1-vs-spacing-diacritic property pinned |
| 2026-08-06 | Task 2: `search-model.ts` + 36 tests against the real 1,400-row index; found and fixed the `hub.separator` fold defect |
| 2026-08-06 | Task 4: shared lazy `tournament-index.ts` (clear-on-reject) + Hub swap; verified one fetch, not two |
| 2026-08-06 | Task 5: new `search` locale namespace, es + en, with the i18n describe |
| 2026-08-06 | Tasks 6–9: vendored `dialog.tsx`, `HeaderSearch.tsx`, mounted into the reserved slot |
| 2026-08-06 | Task 10: render-test seam introduced (devDependencies only); static-output route sweep + per-route allow-lists |
| 2026-08-07 | Task 11: browser verification found and fixed the half-done overlay registry (depth 2 → depth 1) |
| 2026-08-07 | Task 12: AC 7 departure, contrast figures, sheet-focus departure and fixture accent gap filed; stale Hub-prefetch entry corrected in place |
| 2026-08-07 | Fixed the inherited `assert-schema-version` timing flake rather than deferring it; 4 consecutive full-suite runs at 964/964 |

### File List

**New**
- `app/src/lib/search-model.ts`
- `app/src/lib/search-model.test.ts`
- `app/src/lib/tournament-index.ts`
- `app/src/lib/tournament-index.test.ts`
- `app/src/components/HeaderSearch.tsx`
- `app/src/components/HeaderSearch.test.tsx` *(the repo's first `.test.tsx`)*
- `app/src/components/ui/dialog.tsx`

**Modified**
- `app/src/lib/format.ts` — export `foldForSearch`
- `app/src/lib/format.test.ts` — the fold-property describe
- `app/src/lib/hub-model.ts` — add `playerHref`
- `app/src/lib/use-glossary-popover.ts` — export `registerOverlayCloser` / `closeOtherOverlays`
- `app/src/lib/i18n.test.ts` — the `search` namespace describe
- `app/src/lib/assert-schema-version.test.ts` — explicit spawn timeout (inherited flake)
- `app/src/components/SiteHeader.tsx` — mount `<HeaderSearch />` in the reserved slot
- `app/src/components/TournamentHubRegion.tsx` — shared-loader swap
- `app/src/locales/es.ts` / `app/src/locales/en.ts` — new `search` namespace, append-only
- `app/src/app/static-output.test.ts` — route sweep, per-route allow-lists, template-literal fetch detection
- `app/package.json` / `app/package-lock.json` — four devDependencies
- `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md` — appended policy rows
- `_bmad-output/implementation-artifacts/deferred-work.md` — filings + the stale-entry correction
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status
- `_bmad-output/implementation-artifacts/2-14-header-search.md` — this file

### Review Findings

Code review 2026-08-07. Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) ran in parallel against the uncommitted working tree vs `119b707`. `app/` is byte-identical between the story's baseline `29e90fb` and `119b707`, so the diff is exactly this story's slice. Every finding below was re-read against the source before rating; subagent severities were discarded.

#### Decisions ruled at review (2026-08-07, Juan) — each becomes a patch below

**R1 — The `sr-only` row prefixes STAY; the justification is what was wrong.** ARIA 1.2 gives `option` *Children Presentational: True*, so the nested `<Link>` in `SearchOption` loses its link semantics in the accessibility tree and these anchors never appear in a screen-reader link list. The rationale written verbatim into `es.ts`, `EXPERIENCE.md` and `search-model.ts:130-137` — *"so a screen reader's link list reads 'Ver el jugador Julian QUINONES' and not a bare name"* — therefore describes an outcome that cannot occur. What does occur is that the prefix folds into the option's name-from-content: *"Ver el jugador Julian QUINONES, Jugador — México"*. **RULED: keep the prefixes — they still disambiguate a bare proper noun as an option name, and removing them would strand `search.playerRowLink` as a dead key against ruling 9. Rewrite the rationale in all four places to state what actually happens: an option reads as an entity to open rather than a bare proper noun.** Do not restructure the row; do not move `role="option"` onto the anchor.

**R2 — Mint a "showing 10 of N" form.** `announceFor` announces the uncapped `countResults` total while only `RESULT_LIMIT` rows render, and `RESULT_LIMIT`'s docblock claims *"the cap is never silent"* when the cap's existence is stated nowhere. **RULED: append the new keys to the `search` namespace (es canonical, then en, append-only after the existing keys), and announce both numbers. Keep `countResults` — the total is still the honest figure; it is the cap that needs disclosing.** Add the i18n.test.ts coverage alongside the existing `search` describe.

**R3 — Task 2.9 governs; the shipped ordering is correct.** Ruling 5's *"Ordering goes through `compareText` at its `'es'` default"* and Task 2.9's *"prefix-matches before substring-matches, then corpus order"* contradict each other; the code implements Task 2.9 and never imports `compareText`. **RULED: Task 2.9 wins and the code stands. A prefix match must outrank a mid-string one regardless of alphabet, and re-sorting alphabetically would fight the deliberately pinned teams→players→matches corpus order that AD-5 protects and that a test already pins.** No code change to the partition — the patch is to record the reconciliation in a `searchResults` comment and a Completion Note, on the same footing as the Task 2.10-vs-ruling-6 entry the dev already wrote.

#### Task 11.6 — the 200 %-zoom measurement, taken at review (2026-08-07)

The subtask was checked `[x]` with no zoom figure recorded; only 320 and 390 px were reported. Measured now against the exported build, served locally, with the viewport constrained to the zoom-equivalent CSS width (browser zoom divides the CSS-px viewport, so a fixed-width viewport is a faithful emulation). `docOverflow` = `documentElement.scrollWidth − clientWidth`.

| Condition | CSS px | Doc overflow | Header overflow | Inline input |
|---|---|---|---|---|
| 1920 @ 200 % | 945 | **0** | **0** | visible, 642 × **44** px |
| md floor | 753 | **0** | **0** | visible |
| 1280 @ 200 % | 625 | **0** | **0** | collapsed (icon button) |
| 1024 @ 200 % | 497 | **0** | **0** | collapsed |
| 1280 @ 400 % | 305 | **0** | **0** | collapsed |
| **390 @ 200 %** | **180** | **93** (hub) / **98** (match) | **57** | collapsed |

**The 195 px condition still fails, and this story contributes nothing to it.** At 180 CSS px four header descendants overflow and the worst is `button[data-slot="toggle"]` at **57 px** — the `shrink-0` language/theme toggles, Story 2.2's element, already filed with owner 2.19. `HeaderSearch` overflows by **0 px** at every width measured: the slot is `min-w-0 flex-1` so it absorbs the compression, and below `md` it collapses to a 44 × 44 icon button that fits inside a 180 px viewport. Everything that overflows at 320 px and above sits inside an `overflow-x-auto` scrollport, which UX-DR15 permits.

**Measured and disclosed, not fixed** — which is what Task 11.6 asked for. No new ledger entry: the condition and its owner are already recorded (grep the ledger for *"reflows cleanly to 320 CSS px but not to 195 CSS px"*), and this measurement confirms that entry's attribution rather than adding to it.

#### Patches — all applied at review (2026-08-07)

- [x] [Review][Patch] R1 — correct the row-prefix rationale in all four places; the prefixes themselves stay [`app/src/lib/search-model.ts`, `app/src/locales/es.ts`, `app/src/locales/en.ts`]
- [x] [Review][Patch] R2 — mint the "showing 10 of N" announcement form and disclose the cap [`app/src/components/HeaderSearch.tsx`, `app/src/locales/es.ts`, `app/src/locales/en.ts`, `app/src/lib/i18n.test.ts`]
- [x] [Review][Patch] R3 — record the ruling-5-vs-Task-2.9 reconciliation; no change to the partition [`app/src/lib/search-model.ts`]

- [x] [Review][Patch] The `error` and `invalid` states are terminal — one transient fetch failure kills header search for the whole page lifetime, on every route. **Fixed:** `engaged: boolean` → `attempt: number`; `engage()` retries from `error` only, never from `invalid` [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] The live region sits inside the subtree Radix marks `aria-hidden`, so the `<md` sheet announces nothing at all to assistive tech. **Fixed:** the desktop region unmounts while the sheet is open and the sheet carries its own region inside the portal; the announcement resets on both edges so neither mounts already-populated [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] The filter re-folds every corpus name on every keystroke, twice — ruling 12 violated, and three docblocks assert the opposite. **Fixed:** one `matchesFolded(entity, foldedNeedle)` predicate reading the pre-folded field, needle folded once outside both loops; all three docblocks corrected [`app/src/lib/search-model.ts`]
- [x] [Review][Patch] A reader who types before the corpus lands is told "loading" and never told the count. **Fixed:** an effect keyed on `status` re-announces when the transition is real and a query is present [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] `aria-controls` points at a non-existent id in four of the panel's six states — the exact axe failure its own comment claims to prevent. **Fixed:** new `listboxRendered` guard (`isOpen && loaded && results.length > 0`) [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] The listbox has no dismissal path but Escape and an emptied box — it survives outside clicks, blur, and its own navigation. **Fixed:** a document `pointerdown` listener while open (inline only — Radix owns the sheet), plus `onActivate` closing on both the mouse and Enter paths [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] The active option is never scrolled into view inside a `max-h-[60vh] overflow-y-auto` panel. **Fixed:** effect on `activeIndex` calling `scrollIntoView({ block: "nearest" })` on the option [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] `DialogContent` is portalled, so `md:hidden` cannot hide it — crossing to `≥md` with the sheet open leaves a modal over the desktop layout. **Fixed:** a `matchMedia("(min-width: 48rem)")` listener closes the sheet; documented as a dismissal, not the render-time breakpoint branch ruling 4 bars [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] `searchEntities` guards arrays with `listOf` but leaves every scalar unguarded, and a throw there unmounts the global header on all five routes — there is no `error.tsx` anywhere in `src/app`. **Fixed:** `textOf`/`joinDetail` guards on every scalar, absent `score` guarded before `scoreline`, `decidedByCaption`'s throw degraded to no suffix, out-of-enum `stage` no longer renders the literal "undefined" [`app/src/lib/search-model.ts`]
- [x] [Review][Patch] The `search()` test helper's wait is a no-op, so every keyboard test rides on `user.type`'s incidental yields. **Fixed:** the helper now waits for the loading copy to leave the panel, which only happens once `status` has moved [`app/src/components/HeaderSearch.test.tsx`]
- [x] [Review][Patch] Task 11.6's 200%-zoom measurement was never taken, though the task is checked off. **Fixed:** measured across six zoom-equivalent widths and recorded above; `HeaderSearch` contributes 0 px, the 57 px offender is 2.2's `shrink-0` toggle, already owned by 2.19
- [x] [Review][Patch] Task 10.4's prescribed `class="…"`-scoped matching was not used for the label assertion. **Fixed:** matches a real `<label>` element and asserts `for` and `sr-only` separately, so React's attribute order cannot break it [`app/src/app/static-output.test.ts`]
- [x] [Review][Patch] Four test-quality defects: `prefetch={false}` asserted nowhere despite the test title, two titles overstating their bodies, a tautological `includesText` test, and `CORPUS_ACCENTS`' misdescribed array. **Fixed:** test retitled + a comment-stripping source assertion for `prefetch`; a third-kind test and a per-row prefix test added; the tautology replaced with literal-valued assertions; the constant split into `CORPUS_ACCENTS` / `READER_ACCENTS` [`app/src/components/HeaderSearch.test.tsx`, `app/src/lib/format.test.ts`]
- [x] [Review][Patch] The 2.14 key builders were registered in a story-local describe instead of the existing key-builder resolution sweep. **Fixed:** moved into the sweep; the `search` describe keeps only its story-local reuse assertions [`app/src/lib/i18n.test.ts`]
- [x] [Review][Patch] `EmptyStatePanel` / `useEmptyHeadline` were hand-rolled rather than imported, and the departure is undeclared. **Fixed:** departure declared at the call site with its reason (a `min-h-32` dashed block does not fit a dropdown under a 56 px bar) [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] Escape calls `preventDefault()` even when the listbox is already closed, swallowing the native `type="search"` clear. **Fixed:** returns early when `!isOpen` [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] Enter navigates via `.click()`, which drops modifier keys — Ctrl/Cmd+Enter opens in the same tab. **Fixed:** dispatches a `MouseEvent` carrying all four modifier flags; covered by a new Ctrl+Enter test [`app/src/components/HeaderSearch.tsx`]
- [x] [Review][Patch] `DialogContent` has neither a `Description` nor `aria-describedby={undefined}`, so Radix logs a dev warning on every sheet open. **Fixed:** explicit `aria-describedby={undefined}` [`app/src/components/HeaderSearch.tsx`]

#### Verification state at close

Every suite 2.14 owns was green **before** a concurrent session's changes landed:

| Suite | Result |
|---|---|
| `format.test.ts` + `search-model.test.ts` + `tournament-index.test.ts` | **72/72** |
| `i18n.test.ts` | **133/133** |
| `HeaderSearch.test.tsx` | **34/34** (30 before review, +4 added) |
| `static-output.test.ts` | **39/39** |
| `tsc --noEmit`, `eslint --max-warnings 0` on all 8 touched files | clean |

🔴 **A later full run shows 4 failures, and none of them are this story's.** While this review was in progress, the session implementing **Story 2.15** flipped both `DATA_ROOT` cutover points to the real data tree — `src/lib/data.ts` to `"/data"` and `src/lib/build-data.ts` to `../data` — and rebuilt `out/` at 11:31. That is 2.15's Task 9.4 verbatim: *"Point both at the real tree … build, and record … **Revert both.** This is a measurement for 2.19, not a change to ship."* The four failures follow directly from it:

- `tournament-index.test.ts` — asserts the fetch URL is `/data/fixtures/index/tournament.json`; the flip makes it `/data/…`.
- `static-output.test.ts` ×3 — all inside `describe("exported / — the leaderboards section (Story 2.13)")`, comparing fixture literals (`35,2 km/h`, `href="/players/son-heungmin-kor/"`) against an export built from real data.

None sits in a file this review touched. Both assertions this review DID change in `static-output.test.ts` still pass in isolation (`-t "combobox"`, `-t "LAZY"`). **Expect all four to go green when 2.15 reverts the flip; do not "fix" them.**

#### Deferred

- [x] [Review][Defer] `playerHref` is added but the three inline `/players/` call sites are not converted [`app/src/components/LineupsDisclosure.tsx:34`, `app/src/components/LeaderboardsSection.tsx:200`, `app/src/components/LeaderboardsRegion.tsx:424`] — deferred, owned elsewhere: Story 2.15's frozen spec (D10) explicitly claims all three, *"Switch all three to `playerHref()`"*, because they only become live links when `/players/{slug}` ships.
- [x] [Review][Defer] `FETCH_ARTIFACT_PATH`'s mandatory generic and `ALIAS_IMPORT`'s alias-only walk make the module-graph set-equality assertion weaker than it reads [`app/src/app/static-output.test.ts:414`, `app/src/app/static-output.test.ts:425`] — deferred, pre-existing: the mandatory `<[^>]*>` segment predates this story (2.14 only added the template-literal branch), and `tournament-index.ts:81-88` documents the resulting call-site constraint in place.
- [x] [Review][Defer] `assert-schema-version.test.ts` was edited without a task authorising it [`app/src/lib/assert-schema-version.test.ts`] — deferred, pre-existing: the flake predates this story, the edit is a disclosed spawn-timeout increase recorded in the File List and Change Log, and the ledger already carries the 1.17/1.18/1.19 ownership contest.

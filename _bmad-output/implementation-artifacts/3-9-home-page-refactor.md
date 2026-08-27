---
baseline_commit: 24906d4
---

# Story 3.9: Home Page Refactor

Status: ready-for-dev

Epic: 3 — Post-Launch Reach — Discoverability, Landing & Navigation
Definition: `_bmad-output/planning-artifacts/epics.md:1350-1380`
Contract: **UX-DR24** (`epics.md:143`), delivered by story 3.7 at `fd5f130` + `87a9a39`
Baseline: `main` @ `24906d4` — **1,512 tests / 60 files / 0 skipped / 1,406 routes** (measured at story creation, `npm test` with `out/` present)
Commit directly to `main` (solo repo; no feature branch, no PR).

**This is the last story of Epic 3 and of the project's current roadmap.** Nine of ten are done.
It is therefore also the **epic close**, which carries two obligations story 3.10 could not
discharge — see D15.

---

## Story

As a first-time visitor arriving at the site,
I want a home page that orients me before it buries me in tables,
so that I can tell what this is and reach what I want (FR-39, NFR-11).

---

## ⚠️ READ THIS FIRST — FIVE THINGS THAT WILL BITE, IN ORDER

**1. THE CONTRACT IS RULED. IMPLEMENT IT, DO NOT RE-RULE IT.** UX-DR24 (EXPERIENCE.md →
Information Architecture / The Landing Page / The Player and Team Indexes / Navigation /
Deep-Link Fragment Grammar; DESIGN.md → Components, Layout & Spacing) settles the zone order,
the badge set and its order, the browse grammar for `/players`, the flat shape of `/teams`, and
the route slugs. Where the contract and an older acceptance criterion disagree, **the contract
wins** — `87a9a39` already reconciled three of them, including this story's own "route count
stays 1,406", which is superseded by **1,410**. Do not re-open "Tops" vs "Líderes". Do not put a
table on `/`.

**2. IT IS FIVE BOOLEANS, NOT FOUR — AND EVERY ARTIFACT IN THIS REPO SAYS FOUR.** Story 3.10's
file, its completion notes, `sprint-status.yaml:3723` and `:3767`, the `d073575` commit message,
and `nav-destinations.ts`'s own header comment all say *"3.9 flips four booleans"*. **They are
off by one.** `nav-destinations.ts` carries **five** `available: false` entries — `tournament`,
`matches`, `tops`, `players`, `teams` — because `matches` and `tournament` share the route
`/tournament/` and differ only by the `#results` fragment. Verified first-hand at
`nav-destinations.ts:147, 154, 161, 175, 183`. Flip four and the gate stays red on `matches`
with a message naming a file you think you already handled. `es.ts:86` got it right ("FIVE OF
THE NINE DO NOT RENDER YET"); the nav module did not. See **D6**.

**3. THE ROUTE FILES MUST BE PLAIN `src/app/<name>/page.tsx`.** No route group, no `page.jsx`.
`deferred-work.md:4826-4829` names **story 3.9 as the owner** of this blind spot: direction 2 of
the availability gate resolves a declared route to `src/app{route}/page.tsx` *literally*, so a
route inside `src/app/(landing)/tournament/` or written as `page.jsx` **does not turn the gate
red**, the booleans are never flipped, and the nav ships four entries wide beside four live,
unreachable pages — green. `sitemap.ts:91-98` also **throws** on a parenthesised segment. See **D7**.

**4. THE NFR-11 BASELINE OF 68 IS STALE, AND THE GUARD AS WRITTEN CANNOT GO RED.** The 68 and the
6,025 DOM nodes are Story 2.19's **start-of-story** figures. 2.19 Task 5.7 then rebuilt the Hub
behind SM-C2 disclosures: **6,025 → 2,780 nodes, 33 → 3 tables, 2,442 → 1,050 cells**
(`2-19-...md:1367-1373`), and the Hub's median moved **68 → 86** local, 92 on the live host
(`2-19-...md:1697`, `:2048`). So a `/tournament` measuring 70 would clear the stated ≥68 while
being a 16-point regression on what actually shipped — the exact "gate that cannot go red" that
A1/NFR-12 exists to prevent, and the exact reasoning UX-DR24 used to refuse holding `/` to ≥68.
**This story does not re-rule the number. It measures the pre-refactor median first, records
both, and stops for a ruling if post lands between them.** See **D10**.

**5. THERE IS NO COMMITTED D4 HARNESS. YOU MUST BUILD AND VALIDATE ONE.** `git log --all -S
"serve.mjs"` finds only the prose that mentions it; the file was never committed and
`app/scripts/` has no server. Every recorded Lighthouse number in this project came from a
scratchpad server that no longer exists. **A number without its validated harness is not
reported** — so validating the harness comes before measuring anything, and the pre- and
post-medians must come from the *same* rebuilt harness or the comparison is meaningless. This
project has already invalidated two full rounds of numbers to harness bugs. See **D11**.

---

## A3 File-Ownership Probe — RUN AT STORY CREATION, 2026-08-27

Re-run at Task 1. Recorded here so the dev agent inherits the finding rather than rediscovering it.

### Working tree

```
$ git status --porcelain
?? 17

$ git rev-parse --short HEAD
24906d4
```

**The tree is clean.** The single untracked entry is a **0-byte file named `17` in the repo
root**. It belongs to nobody. **Do not stage it** (A4). Do not delete it either — it is not this
story's to remove.

### Both known Epic 3 collision files

```
$ git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx
(no output — both clean)
```

**`app/src/app/page.tsx` is unheld.** The SEO track finished with it: story 3.2 landed at
`db2924e` (review `18e9022`), story 3.3 at `a944c9d` (review `77d4d53`), and 3.3 was marked
`done` at `24906d4`, which is HEAD. `sprint-status.yaml:3476` names this file as the 3-2/3-3
vs 3-9 collision; **the collision is resolved by sequence — 3.9 lands second, as its own AC
anticipates.** The abort condition in AC 3 is therefore NOT met. Proceed.

### Who else is live

**Nobody.** All ten Epic 3 stories except this one read `done` in `sprint-status.yaml`
(`:3489`–`:3788`); `epic-3` reads `in-progress` (`:3488`); `epic-3-retrospective` reads
`required` (`:3791`). No session holds any file. You have all of `app/` to yourself.

**PATHS THIS STORY OWNS** (and stages — A4, **never** `git add -A`, never the stray `17`):

```
app/src/app/page.tsx                          (MODIFY — becomes the Landing surface)
app/src/app/tournament/page.tsx               (NEW)
app/src/app/tops/page.tsx                     (NEW)
app/src/app/players/page.tsx                  (NEW — index, beside the existing [slug]/)
app/src/app/teams/page.tsx                    (NEW — index, beside the existing [slug]/)
app/src/components/LandingContent.tsx         (NEW — the lede + badge grid)
app/src/components/FeatureBadge.tsx           (NEW — the badge component + emphasised variant)
app/src/components/PlayersIndexRegion.tsx     (NEW — client fetch + 48 disclosures + filter, D5b)
app/src/components/TeamsIndexRegion.tsx       (NEW — client fetch + flat 48, D5b)
app/src/components/LandingContent.test.tsx    (NEW)
app/src/components/PlayersIndexRegion.test.tsx (NEW)
app/src/lib/players-index.ts                  (NEW — pure grouping/sort/filter model)
app/src/lib/players-index.test.ts             (NEW)
app/src/lib/teams-index.ts                    (NEW — pure model, if the 48 rows need one)
app/src/lib/teams-index.test.ts               (NEW)
app/src/lib/nav-destinations.ts               (MODIFY — five flags + stale prose)
app/src/lib/nav-destinations.test.ts          (MODIFY — the "renders FOUR today" pin)
app/src/app/static-output.test.ts             (MODIFY — re-point the moved assertions)
app/src/components/LeaderboardsSection.tsx    (MODIFY — stale 4.5rem comment only, if moved)
app/src/components/TournamentHub.tsx          (MODIFY — stale 4.5rem comment only, if touched)
app/src/lib/i18n.test.ts                      (MODIFY — caption inventory, if new tables)
app/src/locales/es.ts                         (MODIFY — landing.* / players.* / teams.* / page meta)
app/src/locales/en.ts                         (MODIFY — the type-mirrored twin)
app/src/app/globals.css                       (MODIFY — ONLY if the header re-measurement moves the token)
app/src/lib/reflow-guards.test.ts             (MODIFY — ONLY if a pinned class string moves)
_bmad-output/implementation-artifacts/deferred-work.md    (APPEND ONLY)
_bmad-output/implementation-artifacts/sprint-status.yaml  (APPEND ONLY + one-line status flip)
_bmad-output/implementation-artifacts/3-9-home-page-refactor.md (this file)
```

**Explicitly NOT this story's:** `app/src/components/SiteNav.tsx`, `SiteNav.test.tsx`,
`SiteHeader.tsx`, `HeaderSearch.tsx`, `ui/dialog.tsx` (3.10's — the nav completes itself, D6),
`app/src/lib/tactical-sections.ts` (D13), `app/src/app/sitemap.ts`, `robots.ts`,
`canonical-output.test.ts` (all auto-adapt, D8), `app/src/app/layout.tsx`, `og-card.ts`,
`site-origin.ts`, the stray `17`.

---

## Acceptance Criteria (from `epics.md:1350-1380`)

**AC 1 — the contract's IA, within SM-C2, with the leaderboards anchor preserved or re-sited.**
Given the UX contract from story 3.7, when the home page is rebuilt, then it implements that
contract's IA within the SM-C2 disclosure grammar, and Story 2.13's `LeaderboardsSection` mount
and its `LEADERBOARDS_SECTION_ID` anchor are **either preserved or deliberately re-sited — never
duplicated**, which would be a duplicate-id defect.

**AC 2 — NFR-11 is a guard, not a goal, and the guard follows the CONTENT.**
Lighthouse mobile **≥ 68 on `/tournament`**. `/`, `/tops` and `/players` are new surfaces: each
records its own first median as its own floor. Holding the near-empty `/` to ≥68 would be a gate
that cannot go red (A1/NFR-12). Free to reshape, not free to regress. SM-5 stays closed (D19);
this story does not design toward 90.
**And** measurement is per **D4**: **median of 3 runs**, mobile preset, against a **gzip +
keep-alive host-realistic server**. Never `python -m http.server`. Never a single run. A number
without its validated harness is not reported.
**And** the **pre- and post-refactor medians are both recorded**, not just the post.

**AC 3 — A3 and the `page.tsx` collision.**
The file-ownership probe runs; if the SEO track holds that file mid-change, this story aborts at
Task 1. **Probed at story creation: it does not.** Whichever lands second preserves the other's
work — the canonical/`og:image` metadata and the refactored body **must coexist**.

**AC 4 — ledger L1423.**
When this story's change-set touches `tactical-sections.ts`, the trigger has fired and
`PendingSectionPanel` is deleted with its locale keys and the three assertions resolved.
**And if the refactor does not touch that file, L1423 stays deferred and the story says so
explicitly rather than leaving it ambiguous.** → **See D13. It does not fire, and D13 is that
explicit statement.**

**AC 5 — the chain and the suite.**
The route count is **1,410** — UX-DR24 mints `/tournament`, `/tops`, `/players` and `/teams`,
deliberately superseding this AC's original "stays 1,406" — the build is green, and **no test is
newly skipped**.

**Standing criteria A1–A6** (`epics.md:1072-1106`) apply in addition. A1 is live in several
places here: every gate this story flips or adds must be **driven RED once**, with the command
and its failing output recorded.

---

## Ruled Decisions

### D1 — What `/` becomes: four zones, eight badges, zero tables

Normative source: EXPERIENCE.md → **The Landing Page** (`:97-154`), mock
`mockups/key-landing-mobile.html`, DESIGN.md → Components → **Feature badge** (`:410`) and its
token block (`DESIGN.md:258-267`).

Zone order at 390 px, top to bottom:

| Zone | Contains | Rules |
|---|---|---|
| 1 — Identity | `<h1>` (tournament name) + one 2–4 sentence lede: what this is, where the data comes from, that it is free and independent | **Prose, not tiles.** OQ-3 framing at hero altitude. Does **not** replace `/about` or the footer, both of which stay |
| 2 — **Comparar**, emphasised | One full-width badge for `/compare` | Its own row and visual weight. Emphasis is **size, position and surface — never colour alone** (1.4.1). Carries no "featured" meaning a screen reader would miss |
| 3 — Feature badge grid | The remaining **seven** badges | One column `<sm`, two `≥sm`, four `≥lg`. DOM order equals visual order at every width |
| 4 — Attribution footer | The shipped `AttributionFooter`, unchanged | Already global via `layout.tsx:232` — nothing to add |

**The ruled badge set, in this order** (labels are locale keys, never literals):

| # | es | en | href | key source |
|---|---|---|---|---|
| 1 | Comparar | Compare | `/compare/` | **reuse** `compare.*` — nothing minted |
| 2 | Torneo | Tournament | `/tournament/` | `nav.destinations.tournament` (ships) |
| 3 | Partidos | Matches | `/tournament/#results` | **reuse** `compare.type.matches` |
| 4 | **Líderes** | Leaders | `/tops/` | **reuse** — `nav.destinations.tops` ships "Líderes" |
| 5 | Jugadores | Players | `/players/` | **reuse** `compare.type.players` |
| 6 | Equipos | Teams | `/teams/` | **reuse** `compare.type.teams` |
| 7 | Glosario | Glossary | `/glossary/` | **reuse** (footer link labels) |
| 8 | Acerca de | About | `/about/` | **reuse** (footer link labels) |

- **The label is "Líderes", not "Tops".** Overturned by Juan at 3.7 (`.memlog.md`): `es.ts:2321`
  ships `leaderboards.title: "Líderes del torneo"` as the `<h1>` of the page the badge opens, so
  "Tops" would be a second Spanish name for one surface. **The route slug stays `/tops`** —
  slugs are language-neutral English and are not UI strings.
- **Badge 3 is contained by badge 2, and that is ruled, not accidental.** *Torneo* addresses the
  page; *Partidos* addresses the results half of it. The flat alternative (*Partidos* +
  *Posiciones*, no *Torneo*) was considered and rejected. Standings has no badge and is reached
  through *Torneo*. Do not "fix" this.
- **Badges are links, not buttons** — real `<a href>`, working middle-click and open-in-new-tab.
  No badge is a JavaScript-only affordance. Whole card is the link target: **one tab stop, one
  accessible name, and that name is the visible label** (2.5.3). No `aria-label` narrows or
  extends it.
- **Trailing slashes are mandatory on every href.** `next.config.ts` sets `trailingSlash: true`;
  a slash-less href is a 301 hop on the static export. `/tournament/#results` — slash *before*
  the `#`.
- **Eight badge supporting lines are minted** (`landing.badge.*.support`). Numbers carry the
  drama, per Voice and Tone: *"Los 104 del torneo"*, not *"¡Todos los partidos!"*. The mock's
  strings are the reference wording.
- **No loading state and no empty state on `/`** (EXPERIENCE.md → State Patterns). `/` reads no
  bundle; lede, badges and footer are all pre-rendered static content.

**Acceptance from UJ-0** (`EXPERIENCE.md:549`): at 390 px, **both locales**, zones 1–3 render
with **zero horizontal scrolling** and **no disclosure to open**.

### D2 — `/tournament` is an ADDRESS CHANGE, not a redesign

EXPERIENCE.md:60-66: *"The move is an address change, not a redesign."* The nine results sections
and twelve standings sections keep their `ViewDataDisclosure` treatment, their outside-the-control
counts, their artifact order, their `rank`-as-a-column rendering, their sort behaviour, **and
their anchors**. SM-C2 binds exactly as before.

Concretely, the current `page.tsx:185-196` body moves whole:

```tsx
<SortAnnouncerProvider>
  <TournamentHubHeading />     {/* the route <h1>, TournamentHub.tsx:821 */}
  <TournamentHubRegion />      {/* results + standings, runtime fetch */}
</SortAnnouncerProvider>
```

- **`composeHubTitle` moves with it.** `/tournament`'s `generateMetadata` is `/`'s current one,
  relocated verbatim (`hub-model.ts:470-476`, `page.tsx:67-73`). `/` then needs its own title —
  see D8.
- **`#standings` and `#results` move with it, unchanged.** `STANDINGS_SURFACE_ID` and
  `RESULTS_SURFACE_ID` are defined in `hub-model.ts:130-131` and consumed by
  `TournamentHub.tsx:541`/`:712` and the loading skeleton at `TournamentHubRegion.tsx:205`.
  **`nav-destinations.ts`'s `matches` entry points at `/tournament/#results` — if that heading
  does not arrive on `/tournament`, the nav ships a valid page with a dead fragment and no gate
  catches it.** Verify it in the export.
- **`#results` is a SURFACE fragment: it scrolls and opens nothing.** So is `#standings`. The
  per-group anchors (`#standings-group-a`, `#results-r32`) are **leaf** fragments and open.
  Declared, never inferred (EXPERIENCE.md → Deep-Link Fragment Grammar). This is shipped
  behaviour; carry it, do not re-derive it.
- **Known behavioural detail worth preserving deliberately:** `#standings` is in the *static*
  HTML (the loading skeleton emits it), while `#results` and every per-group anchor arrive only
  **after hydration and the runtime fetch**. Verified in the shipped `out/index.html` id
  inventory. Do not "improve" this — it is AD-11's build-time/runtime split.
- The container is `mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop`.
  Note `py-`, not `pb-`: dropping the top half left the `<h1>` flush against the sticky header
  (`page.tsx:161-164`). `/tournament` inherits this; `/tops`, `/players`, `/teams` should follow
  the more common `pb-layer-gap` form used by `/compare` and the profile routes **unless** they
  also lead with an `<h1>` — in which case use `py-`.

### D3 — `/tops`: the leaderboards mount is RE-SITED, and its anchor moves with it

AC 1 offers "preserved or deliberately re-sited". **UX-DR24 chooses re-sited**
(`EXPERIENCE.md:66`): *"Story 2.13's leaderboards mount moves to `/tops` with its `#leaders`
anchor — re-sited, never duplicated, since two elements carrying that id would be a duplicate-id
defect."*

- `LEADERBOARDS_SECTION_ID = "leaders"` is defined **once**, at
  `LeaderboardsSection.tsx:73`, and rendered **once**, at `:81`. `HEADING_ID = "leaders-title"`
  (`:74`) is not exported. **Move the mount; do not touch the constant, and do not add a second
  `<div id="leaders">` anywhere.** `page.tsx:38` and `hub-model.ts:115-127` both record a
  previous attempt at a second id being removed at review — read both before you write.
- The build-time projection moves too: `leaderboardTeasers(readLeaderboards().boards)`
  (`page.tsx:154`). **Projected, not passed whole** — the prop is serialised into the RSC flight
  payload and the artifact is ~409 KB. Keep `leaderboardTeasers`.
- `/tops` needs **its own `SortAnnouncerProvider`** — see D9.
- **36 boards, confirmed from the shipped artifact**, not taken on faith:
  `data/index/leaderboards.json` parses to 36 (18 team + 18 player scopes). `INITIALLY_OPEN_BOARDS
  = 0` (`LeaderboardsRegion.tsx:305`), so no board's table mounts on arrival — that is the SM-C2
  grammar `/tops` inherits unchanged.

**Five assertions read `out/index.html` and must be RE-POINTED at `out/tops/index.html`, never
deleted** (A1's second clause: *"deleting an assertion is never how a gate is satisfied"*):

| `static-output.test.ts` | asserts |
|---|---|
| `:390` | `toContain('id="leaders"')` |
| `:392` | `not.toContain('id="lideres"')` (the 2.19 rename guard) |
| `:549` | `id="leaders"` occurs **exactly once** |
| `:550` | `aria-labelledby="leaders-title"` occurs **exactly once** |
| `:551` | `id="leaders-title"` occurs **exactly once** |

The whole `describe` at `:377-583` ("exported / — the leaderboards section") re-points with them —
seven cases, including the 36-board loop at `:397-449` and the AD-11 anti-inlining probes at
`:477-503`.

### D4 — `/players`: 48 disclosures, and the grammar is ruled

Normative source: EXPERIENCE.md → **The Player and Team Indexes** (`:155-211`), mock
`mockups/key-players-index-mobile.html`.

**What the data allows, and nothing more.** `entities.players[]` carries exactly four fields:
`name`, `playerId`, `position` (`gk`/`df`/`mf`/`fw`), `team {id, name}`. No shirt number, no
club, no minutes. **No index surface may imply data the artifact does not carry.**

- **Grouped by team**: 48 disclosures, ~26 players each, **teams in artifact order**, counts
  rendered **outside** each disclosure. This is the Hub's shipped SM-C2 idiom (D15) applied
  unchanged — nothing deleted, everything one click away.
- **Rows are position + name.** The team is the group heading; repeating it per row is noise.
  Two columns is what 390 px holds with no name truncated.
- **Position renders as `ARQ` / `DEF` / `MED` / `DEL`** (es) and `GK` / `DF` / `MF` / `FW` (en).
  **Not `POR`** — that abbreviates *portero*, a word this spine rejected; `es.ts:1549` ships
  `enums.position.gk: "Arquero"`, so `POR` would have no full term to expand to.
- **The expansion attaches to the CELL VALUE, not only the column head.** `ARQ` → "Arquero" via
  `<abbr title>` or an equivalent accessible name. Otherwise Spanish TTS reads `DEL` and `DEF` as
  the function words *del* and *def*.
- **Each of the 48 tables carries its own accessible name** naming its team, and **each of the 48
  disclosure triggers likewise** ("Ver los jugadores de Argentina"). Forty-eight controls sharing
  one name is a screen-reader control list with no information in it.
- **Order within a team: position order (gk → df → mf → fw), then name.**
- **A name filter above the groups.** It reuses the shipped `leaderboards.filter*` **pattern** —
  control shape, live count, zero-result copy — but **mints its own `players.filter*` keys**.
  Story 2.14 declined the reverse reuse because `leaderboards.filterLabel` is board-scoped;
  borrowing board vocabulary onto a squad index repeats that objection in the other direction.
  It filters **the whole set, not only what is open**, and reports its count **through a polite
  live region**. Accent- and case-insensitive via `Intl.Collator('es', {sensitivity:'base'})`.
- **Zero-result state** (EXPERIENCE.md → State Patterns): *"Ningún nombre coincide con el filtro.
  Borra letras para ver más jugadores."* / EN variant. **The 48 group headings and their counts
  stay rendered** — the filter narrows what is inside them, it never collapses the page's
  structure.
- Every row links to that Player Profile (`playerHref`, `hub-model.ts:180`).

**Rejected groupings, recorded so they are not re-litigated:** *by position* is 4 buckets of ~312,
which groups without informing; *A–Z* is 26 buckets, but names arrive as "Brenden AARONSON", so a
naive sort orders by given name and fixing it needs a surname key the index does not carry.

**Put the grouping, ordering and filtering in a pure module** (`src/lib/players-index.ts`) with
its own test, following `hub-model.ts`'s precedent — no React, no DOM, no `t()`. That is what
makes it testable in the `node` environment vitest defaults to.

### D5 — `/teams`: a flat list of 48, and its redundancy is recorded, not disguised

Name, group, and record (played–won–drawn–lost), every row linking to its Team Profile.
**No disclosure — 48 rows is not dense.**

**This surface is knowingly redundant** with `/tournament#standings`, which carries the same 48
with more competitive context. It exists so the badge grid has no member resolving to a fragment
while its neighbours resolve to pages. **Recorded as a cost, not dressed up as a benefit** —
say so in the file's docblock.

`/teams` is **not** a dense surface and carries no performance expectation beyond not regressing.

### D5b — The data path for the four new routes: AD-11's two paths, and no third

**AD-11 allows exactly two data paths and this story must not invent one.** At **build time**, a
route reads artifacts from the filesystem (`readTournament()` / `readLeaderboards()` from
`@/lib/build-data`) for `generateStaticParams`, `<title>`/OG meta, and pre-rendered
Hero-critical content only. At **runtime**, the client fetches the same artifacts over HTTP for
everything below the Hero. **No inlining a bundle into HTML.**

| route | build-time read | runtime fetch | reachable artifacts |
|---|---|---|---|
| `/` | **none** | **none** | `[]` — the lede and badges are static content |
| `/tournament` | `readTournament()` for the title only (as `/` does today) | `/index/tournament.json` via `TournamentHubRegion` | `["/index/tournament.json"]` |
| `/tops` | `readLeaderboards().boards` → `leaderboardTeasers(...)` **projected, ≤3 rows/board** | `/index/leaderboards.json` via `LeaderboardsRegion` | `["/index/leaderboards.json"]` |
| `/players` | title only | **`/index/tournament.json`** | `["/index/tournament.json"]` |
| `/teams` | title only | **`/index/tournament.json`** | `["/index/tournament.json"]` |

🔴 **Do NOT build-time-read the 1,248 players and render them into the export.** `tournament.json`
is **409,512 B raw** (Story 1.17's measurement, cited at `page.tsx:44-49`), which is exactly the
inlining AD-11 bans — and it would put the weight straight onto `/players`'s own first Lighthouse
median, i.e. onto the floor this story is about to record. `/players` and `/teams` follow **the
shipped Hub pattern they inherit**, which EXPERIENCE.md → State Patterns names for them by route:

> **Cold route load — `/tournament`, `/tops`, `/players`, `/teams`.** Identical to the shipped Hub
> pattern: pre-rendered shell, Skeletons shaped like the target, `aria-busy` on loading regions, a
> polite "Datos cargados." on arrival. **Section headings and their counts render with the shell**
> so the surface's shape is readable before any data lands.
> **Bundle fetch failure.** The shipped inline retry panel. The nav, the header and the badges stay
> usable, so a reader can always leave a broken surface.

So each of `/players` and `/teams` is a **server page shell + a client Region component** in
`src/components/`, following `TournamentHubRegion.tsx`'s four-state machine
(`loading`/`loaded`/`error`/`invalid`, `:40`) and its `loadTournamentIndex()` call (`:13`).
**Reuse that shape; do not write a fifth fetch-and-retry implementation.**

**Reuse `ViewDataDisclosure` for `/players`' 48 disclosures** — it is the shipped SM-C2 control
the Hub's twelve groups and nine rounds already use, it already carries `openNonce`, and minting a
second disclosure component would be the reinvention this contract's "applied unchanged" language
exists to prevent.

**UX-DR15 applies to every new control**: ≥44×44 px targets, reading-order tab, `Enter`/`Space`
activate, `Esc` closes the topmost layer, focus visible throughout, and
`prefers-reduced-motion` honoured — the last is **already handled globally**, so do not
re-implement it (3.10 D13).

### D6 — FIVE booleans, and the nav completes itself with no component change

`app/src/lib/nav-destinations.ts` — flip `available: false` → `true` at **five** sites:

| line | key | route |
|---|---|---|
| `:147` | `tournament` | `/tournament/` |
| `:154` | **`matches`** | `/tournament/` ← **the one everybody forgets** |
| `:161` | `tops` | `/tops/` |
| `:175` | `players` | `/players/` |
| `:183` | `teams` | `/teams/` |

Nine destinations, **eight distinct routes**, **four new `page.tsx` files**, **five booleans**.
Three different correct numbers, routinely quoted as if interchangeable.

**Also required in the same change:**
- `nav-destinations.test.ts:101-105` — `it("renders FOUR today — the pre-3.9 truth, stated rather
  than implied")` asserts `["home","compare","glossary","about"]` **as a hardcoded literal**. It
  goes red on the flip regardless of the filesystem. Rewrite it to the post-3.9 truth (all nine,
  in ruled order) **and rename the case** — it is the pre-3.9 truth and 3.9 is what ends it.
- **Prose that now describes a world that ended:** `nav-destinations.ts:11-40` (the "four of the
  nine routes do not exist yet" block), `:201` (`/** …Four today; nine once story 3.9 lands. */`),
  `:164-170` and `:178` (the `/players` / `/teams` index-does-not-exist warnings — keep the
  dynamic-segment ruling, correct the existence claim), `nav-destinations.test.ts:10-43`, and
  `es.ts:86-92` ("⚠️ FIVE OF THE NINE DO NOT RENDER YET").

**Do NOT touch 3.10's components.** `SiteNav.tsx:252` maps `availableDestinations()`; both
presentations consume the same function; nothing there is aware of a count. `SiteNav.test.tsx`
derives `AVAILABLE`/`UNAVAILABLE` from `NAV_DESTINATIONS` at `:300-301`, so every case stays
green — **its titles go stale at `:304`, `:316`, `:333`; retitle only, do not re-shape the
assertions.**

**⚠️ VACUOUS-GREEN WARNING (A1/A2).** After the flip, `NAV_DESTINATIONS.filter(d => !d.available)`
is **empty**, so direction 2's loop body never executes and three cases pass over zero items —
`nav-destinations.test.ts:205-217`, `SiteNav.test.tsx:333-351`, and the unavailable half of
`static-output.test.ts:905-928`. This repo has a named lesson for exactly this (the
`scanned === 0` rule at `canonical-output.test.ts:116-121`). **Either add an explicit
non-vacuity assertion, or state in the comment that direction 2 survives as a standing guard
against a route being deleted.** Do not let three cases silently become no-ops without saying so.

### D7 — The four route files must be plain `src/app/<name>/page.tsx`

Ledger `deferred-work.md:4826-4829`, **owner: story 3.9**:

> Direction 2 resolves a declared `route` to `src/app{route}/page.tsx` literally. If story 3.9
> mints `/tournament` inside a route group (`src/app/(marketing)/tournament/page.tsx`) or as
> `page.jsx`, the gate does NOT go red, the booleans are never flipped, and the nav stays four
> entries wide beside a shipped, unlinked route — the precise failure direction 2 exists to catch.

Two independent reasons this is non-negotiable:
1. `nav-destinations.test.ts:67-70` `pageFor()` builds one literal path. A route group defeats it
   **silently**.
2. `sitemap.ts:91-98` `assertPlainSegment` **throws** on a segment starting with `(` or `@` —
   `next build` fails during "Collecting page data".

Two further shapes to avoid: a static route nested **beneath** a dynamic one (bracketed dirs are
skipped before recursing — `deferred-work.md:4876`), and a `_private` folder name (skipped).

**This story may optionally close the ledger entry** by globbing for `page.{tsx,jsx}` under
parenthesised segments. If it does not, say so — the entry names 3.9 and leaving it silently is
worse than leaving it deliberately.

### D8 — Metadata: all four new routes carry the full house pattern, and the `<title>` question is already RULED

**No new route file needs `generateStaticParams`** — all four are static with no dynamic segment
(`page.tsx:23-25` records the same for `/`).

**The `<title>`-stays-Spanish question is CLOSED, not open.** `/about:9-12` and `/glossary:9-19`
both refuse a metadata export on the grounds that the decision "is open and needs a human
ruling". **Those docblocks are stale.** `deferred-work.md:4163` records:

> **L147, L2697, L3227** — `<title>`/OG stay Spanish after an EN toggle — **RULED by Juan
> 2026-08-25 (D17): ACCEPT ES CANONICAL.** Closed as ACCEPTED on all 104 + 1,248 + 48 + Hub
> routes — not re-deferred, not WONTFIX-without-reason.

So the four new routes take **no** new position by carrying a title. Use the house pattern.
(Correcting `/about`'s and `/glossary`'s stale docblocks is **out of scope** — note it, do not
take it.)

**Two things are inherited for free and must not be broken:**
- **The canonical.** `layout.tsx:124` declares `alternates: { canonical: "./" }` **once**, and
  Next resolves the relative value against each leaf's own pathname, trailing slash supplied by
  `trailingSlash: true`. **A child route inherits it — unless it declares an `alternates` key
  for ANY reason, even `{}`, which replaces the object wholesale and ships NO canonical at all.**
  `layout.tsx:52-60` calls this trap "sharper" than the `openGraph` one. **Do not declare
  `alternates` on any new route.**
- **`twitter: { card: "summary_large_image" }`** is declared once at `layout.tsx:202` and
  inherited. `twitter:image`/`:alt` are **derived** by Next from each route's `openGraph.images`.
  **Do not declare a `twitter` key on a child** — it is wholesale-replaced too, and a partial
  child object drops the card back toward `summary`.

**`openGraph`, by contrast, is REPLACED WHOLESALE.** If a route declares it at all it must carry
all seven keys. The copy-template, verbatim house style — reproduce the comment, do not summarise
it (the five shipped sites each carry the D20 paragraph and 3.3's review patched `layout.tsx`
specifically because it was the one site that omitted it):

```tsx
import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";

/*
 * `og:image` IS A SAME-ORIGIN CARD, AND THE ORIGIN GATE DOES NOT HOLD THIS LINE
 * (D20, Story 3.3). AR-11's "zero external requests" scopes to THIRD-PARTY
 * ORIGINS: a URL in a `<meta>` tag is not a request this page makes at all.
 * `FETCHING_POSITIONS` in `scripts/assert-no-external-origins.mjs` is the
 * operative definition of "a request" and `<meta content>` is deliberately not
 * in it — so that script REPORTS an off-origin card and PASSES. What holds this
 * line is `canonical-output.test.ts` over the whole export, and nothing else.
 *
 * `url: "./"` IS LOAD-BEARING (Story 3.2, AC2). The canonical comes from the
 * root layout and is inherited here because this file declares NO `alternates`;
 * `openGraph` is REPLACED WHOLESALE by the key a child declares, so the layout's
 * `url` never reaches this route. Drop the line and this page ships a canonical
 * with no matching `og:url` — silently.
 *
 * `locale: "es_ES"` rides the same trap. Drop it and this Spanish page
 * advertises the Open Graph default, `en_US`, to every unfurler. One locale per
 * route is a constant (D17/D20). `type`, `siteName` and `images` ride it too
 * (Story 3.3, AC2).
 *
 * THE OBJECT IS NOT LIFTED INTO A SHARED HELPER — that would move `alt:` out of
 * the eslint metadata selector's reach and silently disable the rule that makes
 * a bare Spanish literal a build error. THE URL ALONE IS LIFTED, to
 * `@/lib/og-card`: the whole-export gate asserts the URL's exact VALUE only
 * because all sites import that one constant. An inline literal here re-opens
 * the drift hole that shipped 1,405 documents pointing at a 404, green.
 *
 * NO `alternates` KEY, for any reason — `mergeMetadata` branches on key
 * PRESENCE. NO `twitter` KEY — declared once on the layout and inherited.
 */
export function generateMetadata(): Metadata {
  const title = composeTopsTitle({ /* pure helper — see below */ });
  const description = t("topsPage.meta.description");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "./",
      locale: "es_ES",
      type: "website",
      siteName: t("app.siteName"),
      images: [
        { url: OG_CARD_PATH, width: 1200, height: 630, alt: t("meta.ogImageAlt") },
      ],
    },
  };
}
```

**`title:` and `description:` must be a `t()` call or a PURE HELPER call — never a template
literal or a concatenation.** `eslint.config.mjs:207-221` gates
`title|description|default|template|absolute|alt|siteName` inside `metadata` /
`generateMetadata`, and `--max-warnings 0` makes it a build error. That is why `composeHubTitle`,
`composeMatchTitle`, `composePlayerTitle`, `composeTeamTitle` exist. New titles need the same
treatment.

**Nothing in `app/` asserts a route COUNT.** Verified by grep: every `1406`/`1,406` occurrence is
a comment, an `it()` title, or a failure message — **zero are assertion values**. The whole-export
gates derive their floors from `readTournament()` (`canonical-output.test.ts:154-161`) and from
`urls.length` (`sitemap.test.ts:372`, `:401-403`). **There is no number to bump for the suite to
pass.** Refresh the prose counts as a courtesy; the list is in Dev Notes.

**Optional hardening, recommended:** `canonical-output.test.ts:121-127`'s `REQUIRED_DOCUMENTS` is
a partial-export spine and does **not** list the four new routes; and `sitemap.test.ts:288`'s
named-route loop does not either. Adding them gives the four routes a **build-free** guard. Not
required by any AC — a judgment call, but say which way you went.

### D9 — `SortAnnouncerProvider`: exactly one per route, and the split creates a second need

2.11a ruled decision 9 allows exactly **one** polite live region for sort announcements per page.
Today `page.tsx:185` mounts one provider wrapping **both** the Hub region and the leaderboards
section — and Story 2.13's own nested provider was removed in that same change, with a comment
recording that getting this wrong **fails silently**.

Splitting the route splits the need: **`/tournament` and `/tops` each need their own single
provider.** `/`, `/players` and `/teams` need one only if they render a sortable `DataTable` —
`/` renders none by construction (D1), and `/players`/`/teams` should not unless the contract
calls for sorting, which it does not.

Mount it **outside every fetch/status gate** (`page.tsx:167-184`): a live region that mounts
already-populated does not announce reliably, and mounting it with the data unmounts it on the
error-path retry.

### D10 — 🔴 NFR-11: the stated floor and the real floor disagree. MEASURE FIRST, THEN ASK.

**The contract's number is ≥ 68 on `/tournament` and this story does not change it.** But the
record does not support reading it as the regression guard:

| | figure | source |
|---|---|---|
| NFR-11's `/` baseline | **68** (67–71), median of 3 | `2-19-...md:1306` — **start of story 2.19** |
| The Hub 2.19 actually shipped | **86** (84–94), median of 5 | `2-19-...md:1697` — end of story |
| Same build, live host | **92** (46–94), median of 5 | `2-19-...md:2048` |
| DOM nodes "the 68 was measured over" | **6,025** → **2,780** after Task 5.7 | `2-19-...md:1370` |
| tables / cells | 33 → **3** / 2,442 → **1,050** | same |

UX-DR24 says the 68 follows the 6,025 nodes to `/tournament`. **Those 6,025 nodes no longer
exist** — 2.19 Task 5.7 moved twelve standings groups and nine results rounds behind
`ViewDataDisclosure` inside the same story that produced the 68. What moves to `/tournament` is
2,780 nodes measuring 86.

**Consequence:** `/tournament` could measure 70, clear the stated ≥68, and be a 16-point
regression on shipped behaviour. That is precisely the "gate that has never been red is not a
gate" failure A1/NFR-12 names, and precisely the argument UX-DR24 used to **refuse** holding `/`
to ≥68.

**RULED FOR THIS STORY, so the dev is never blocked:**
1. **Take the PRE-refactor `/` median first**, on the rebuilt-and-validated harness (D11), before
   any code changes. That number — not 68 — is the honest inherited floor for `/tournament`.
2. **Assert both.** `/tournament` must clear **≥ 68** (the contract's stated floor, unchanged)
   **and** must not fall materially below its own recorded pre-median. Record the spread; D19
   notes the measurement spread on this machine can exceed the gap, so a 2–3 point drift inside
   the printed min–max is not a regression.
3. **If post-`/tournament` lands between 68 and the pre-median, STOP and put it to Juan** rather
   than shipping under a gate that cannot go red, and rather than re-ruling NFR-11 unilaterally.
   Record the numbers and the question in the Dev Agent Record.
4. `/`, `/tops`, `/players` each record their **own first median as their own floor**. `/teams`
   is not dense and is expected to be unremarkable.
5. **SM-5 stays CLOSED (D19). This story does not design toward 90.**

**This discrepancy is surfaced, not resolved, at story creation. It is a decision for Juan.**

### D11 — 🔴 The D4 harness does not exist. Build it, then PROVE it, then measure.

**What D4 actually says** (`2-19-...md:561-564`) is only *"Measure, then claim. Every number goes
in a table with its method."* The protocol everyone calls "D4" lives in **NFR-11**
(`epics.md:91`): median of 3, mobile preset, gzip + keep-alive host-realistic server; never
`python -m http.server`; never a single run.

**D5** (`2-19-...md:566-569`) fixes the tool: **`npx -y lighthouse@13.4.1`**, and
**do NOT add it to `app/package.json`** — Netlify runs `npm install` in `app/` on every build and
a headless-Chrome toolchain in `devDependencies` makes every deploy pay for a dev-machine gate.

**The server was never committed.** `git log --all --diff-filter=A -- "*serve.mjs"` is empty;
`git ls-files | grep -i "serve\|lighthouse"` is empty; `app/scripts/` holds only the four
assert/copy/generate scripts. It was a scratchpad file. **Rebuild it** — Node 24 ships `zlib` and
`http`, so it needs **zero dependencies**.

Required properties, all learned by failure:
1. **gzip (or brotli) with a real `content-length`**, keep-alive, Netlify's own cache-control.
2. **Clean URLs** (`/x` → `x/index.html`), a real `404.html`, correct `Content-Type`.
3. **Map Next's RSC prefetch dot-paths to directories** — the browser requests
   `/about/__next.about.__PAGE__.txt`; the export writes `about/__next.about/__PAGE__.txt`.
   Unmapped, every `<Link>` prefetch 404s.
4. **ASSERT the response headers before trusting a single score.** 2.19's rewritten server wrote
   literal backspace bytes (0x08) into its two content-negotiation regexes, matched nothing,
   served everything uncompressed while printing "gzip/brotli" on startup, and invalidated two
   full rounds of numbers (`2-19-...md:1660-1672`). The same build read **76/65 uncompressed vs
   90/85 compressed**.

```bash
cd app && npm run build                      # -> app/out/

node <scratchpad>/serve.mjs app/out 8788     # YOU WRITE THIS FILE

curl -sI -H 'Accept-Encoding: gzip, br' http://127.0.0.1:8788/tournament/ \
  | grep -i 'content-encoding\|content-length\|connection\|cache-control'
# content-encoding MUST be gzip or br; content-length MUST be the COMPRESSED size;
# connection MUST be keep-alive; _next/static/* MUST carry max-age=31536000, immutable.
# PASTE THIS OUTPUT INTO THE DEV AGENT RECORD. It is the harness validation.

for i in 1 2 3; do \
  npx -y lighthouse@13.4.1 "http://127.0.0.1:8788/tournament/" \
    --output=json --output-path="<scratch>/lh-tournament-$i.json" \
    --chrome-flags="--headless=new --disable-gpu"; done
# Lighthouse's DEFAULT is the mobile preset. Do NOT pass --preset=desktop.
```

Median: sort the three `categories.performance.score × 100` and take the middle. **Print
`benchmarkIndex` beside every median** — it swings 1,074–2,510 on this machine and is part of the
reading, not diagnostics (D19).

**Windows gotchas, all recorded:**
- **Lighthouse exits 1 on Windows even on a fully successful run** — `chrome-launcher`'s
  `destroyTmp` fails with `EPERM` removing its own temp profile. **Read the report, do not trust
  the exit status.** A loop using `&&` or `$?` will falsely abort.
- **Two processes can bind the same port on Windows without error.** Use a private port and
  confirm exactly one listener with `netstat -ano | grep :8788`.
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`. Node v24.15.0.
- Serving two different builds from one origin triggers Turbopack chunk-filename reuse →
  `ChunkLoadError` until hard reload. Not a defect in the change.

**Routes to measure, pre and post:** `/` (pre = today's Hub; post = the Landing), `/tournament`
(post only, compared against `/`'s pre), `/tops` (post only, own floor), `/players` (post only,
own floor). `/teams` optional.

### D12 — The header token: re-verify, do not re-derive

`nav-destinations.ts:31-40` (added by 3.10's code review) is the caveat to "no component changes":

> `DESIGN.md` rules that ANY change to the header's composition changes `--header-h`, and
> flipping these flags adds five inline links to the `≥xl` row… The bijection gate binds the flag
> to the filesystem; NOTHING binds it to a re-measurement of the token. Story 3.9 must re-run the
> R2/D8 matrix and re-derive `--spacing-header-h-*` after flipping these.

**Mostly pre-discharged.** 3.10 Task 9.5 already measured the post-3.9 state with all nine links
**forced on** (`3-10-...md:1225-1230`):

| locale | links | nav width | search input width | doc |
|---|---|---|---|---|
| es | 4 (today) | 275 px | 511 px | 1280 |
| es | **9 (forced, = post-3.9)** | 628 px | **158 px** | 1280 |
| en | 9 (forced) | 610 px | 181 px | 1280 |

The row does not overflow and the search does not silently collapse. **Re-verify, do not
re-derive from scratch** — and **measure `getBoundingClientRect().width` on the search input,
never a screenshot**: silent collapse behind `min-w-0 flex-1` is the failure mode that rejected
`lg`, and a defect that never appears in a screenshot is a class this project has already paid
for.

Current values: `globals.css:354-356` (`--spacing-header-h-oneline: 3.875rem` / 62 px;
`--spacing-header-h-wrapped: 7.375rem` / 118 px; `--spacing-scroll-clearance: 1rem`) with the
breakpoint at `:562-566` (`min-width: 13.4375rem` = 215 px). **There is no `header-h-zoom`** —
3.10 deleted it deliberately. Below `xl` the header row is unchanged (wordmark + one trigger), so
the token should hold at 62/118 — **but that is a prediction, and D12 exists because predictions
about this token have been wrong twice.**

Only edit `globals.css` and `reflow-guards.test.ts` **if the measurement moves the numbers.**
`reflow-guards.test.ts`'s three needles (`SiteHeader.tsx:69`/`:91`, `SiteNav.tsx:106`) are `<xl`
facts — **do not touch them.**

### D13 — Ledger L1423 does NOT fire, and this is the explicit statement AC 4 requires

**`app/src/lib/tactical-sections.ts` is not touched by this change-set, so L1423 stays deferred.**

The trigger (`deferred-work.md:4181`) is *"Any change-set that touches `tactical-sections.ts`"*.
That module is the **pure spine of the Match Dashboard's Tactical Layer** — `SectionId` and the
11-member render order, `sectionDataState`, `KEY_STAT_FIELDS`, `buildSectionPlans`. Every symbol
is match-bundle scoped. Nothing in it knows about `/`, the Hub, the leaderboards, or route
structure.

The only path from `/` into that module is a **type-only import, two hops away**:
`page.tsx` → `LeaderboardsSection` → `glossary-marking.tsx:16` → `import type { SectionId }`.
Nothing on `/`, `/tournament`, `/tops`, `/players` or `/teams` reads a `SectionId`, a key-stat
registry, or `sectionDataState`. Story 3.8 set the precedent for exactly this language
(`3-8-...md:279`: *"ledger L1423 does not fire"*).

**Tripwire for the dev agent:** if you find yourself editing `app/src/lib/tactical-sections.ts`
for any reason, **the trigger has fired** and you owe the full deletion —
`PendingSectionPanel` (`EmptyStatePanel.tsx:71-76`, currently **zero importers**, verified by
grep), its four lines of locale copy (`es.ts:990-993`, `en.ts:584-587`, plus the 6-line ruled-
decision-9 comment at `es.ts:984-989`), and **three** assertions in `tactical-sections.test.ts`.

⚠️ **The `108-125` citation in L1423 and in `epics.md:1373` is stale.** The file has shifted. The
three assertions now live at **`tactical-sections.test.ts:124`, `:125`, and `:141`** — and `:141`
is **outside** the cited window, so an agent following the citation literally will miss it:

```
124|       expect(t("tactical.pending.headline", locale)).not.toBe("");
125|       expect(t("tactical.pending.explanation", locale)).not.toBe("");
…
141|     expect(t("tactical.pending.explanation", "es")).not.toBe(t("tactical.empty.explanation", "es"));
```

### D14 — L1553 / L1886 / L1465 are ALREADY CLOSED. L525 / L4071 do NOT fire.

Nothing is owed here. Verify and move on; do not re-file.

| entry | state | where |
|---|---|---|
| **L1553** | **CLOSED by story 3.8** | `deferred-work.md:4545`, `:4551` |
| **L1886** | **CLOSED by story 3.8** | `deferred-work.md:4566` |
| **L1465** | **CLOSED by story 3.10's code review** | `deferred-work.md:4841-4865` |
| **L525** | stays deferred, unchanged | `deferred-work.md:4516-4519` — needs a reopened `/contract`; D20 takes neither |
| **L4071** | stays deferred, unchanged | same; needs a truncated emission |

Note that 2.19's Partition C rows at `deferred-work.md:4179-4180` still show the *old* successor
text for L1553/L1886/L1465. **That is deliberate append-only bookkeeping, not an open item.**

**Five OTHER open entries this change-set does plausibly fire.** Take them or decline them, but
say which:

| ledger | what | fires because |
|---|---|---|
| `:4826` | `nav-destinations.test.ts` route-group blind spot — **owner: story 3.9** | you mint the four routes (D7) |
| `:4794` | `LeaderboardsRegion` 195 px skeleton overflow (`w-48`, `:191`/`:193`), 4 of 96 R2/D8 cells | the component moves to `/tops` and the overflow travels with it |
| `:4799` | **36 dangling `aria-controls` IDREFs**, all on `/` today, one-line conditional at each site | they migrate to `/tops` unnoticed if you do not take them |
| `:4789` | four files whose prose still cites the deleted `scroll-padding-top: 4.5rem` | **`LeaderboardsSection.tsx:85` and `TournamentHub.tsx:847`** are both in your blast radius |
| `:4821` | `epics.md:143`'s UX-DR24 token list still names the deleted `header-h-zoom` | only if you edit `epics.md` |

### D15 — This story is the TRUE epic close. A6 fires here, not on 3.10.

`epics.md:1416-1418` hangs the Epic 3 retrospective on story **3.10**'s AC 7. **Story 3.10
correctly declined it** and recorded why twice (`sprint-status.yaml:3779-3783`,
`deferred-work.md:4861-4865`): *"AC 7's premise is false — at `d073575`, 3-2/3-3/3-9 were
`backlog` and 3-4 was `in-progress`, so the epic does not close with this story."*

**That premise is now true for 3.9.** 3-2, 3-3 and 3-4 are all `done`; 3-9 is the last `backlog`
key; `epic-3` is the last non-`done` epic. So this story carries two obligations 3.10 could not
discharge:

1. **Flip `epic-3: in-progress` → `done`** at `sprint-status.yaml:3488`.
2. **A6 — the Epic 3 retrospective is run and is not left optional.**
   `sprint-status.yaml:3791` reads `epic-3-retrospective: required`, and `:31-35` records exactly
   why it is `required` rather than `optional`: Epic 1's sat at `optional`, was skipped, and its
   concurrent-session lesson had to be re-learned inside Epic 2 at real cost.

**The retrospective is a separate workflow** (`bmad-retrospective`), not something to improvise
inside this story. Task 13 flips the statuses and states plainly that the retro is now due, so
the trigger is recorded rather than quietly skipped. **Do not write a retrospective by hand.**

### D16 — Locale keys: four new namespaces, and most labels are already minted

`es.ts` is canonical (3,113 lines, 19 top-level namespaces); `en.ts` is the type-mirrored twin
(`export const en: Dictionary`, `en.ts:7`). **Adding a key to `es.ts` is a compile error until
its twin lands in `en.ts`**, and `i18n.test.ts:2981` re-asserts the key shape at runtime.

**Already shipped — reuse, mint nothing:** all nine `nav.destinations.*` labels
(`es.ts:94-127`, incl. `tournament: "Torneo"`, `tops: "Líderes"`, `players: "Jugadores"`,
`teams: "Equipos"`), the whole `hub.*` namespace (`:684-843`) and `leaderboards.*` (`:2320-2464`)
— both move with their surfaces, unchanged. `compare.type.{matches,players,teams}` supply three
badge labels. `meta.ogImageAlt` (`:555`) and `app.siteName` supply the card.

**To mint** — route-scoped namespaces, the house style:

| namespace | contents |
|---|---|
| `landing.*` | `title`, `lede`, `badge.<key>.support` × 8, plus a meta title/description pair |
| `players.*` | `title`, count phrase, `position.short.{gk,df,mf,fw}` (ARQ/DEF/MED/DEL), `filter*` (**minted, not reused** from `leaderboards.filter*` — D4), zero-result copy, per-team trigger/table name composers |
| `teams.*` | `title`, count phrase, column heads for name/group/record |
| page meta | `tournamentPage.meta.*`, `topsPage.meta.*` (or fold into `hub.*`/`leaderboards.*` — your call, state it) |

**`hub.title` is `"El torneo"` and its docblock (`es.ts:685-692`) says the title "must cover the
whole route — leaderboards (2.13) as well as standings and results".** After the split it covers
only `/tournament`. **Correct that comment**, and decide whether the string still holds (it does;
"El torneo" is right for `/tournament`).

**Do NOT park anything under `app`** — `i18n.test.ts` pins `Object.keys(es.app)` to exactly
`["siteName"]`.

**There is no global duplicate-value ban.** `i18n.test.ts:2996-3014` states this in red: the only
sweep is 2.14's, scoped to `dictionary.search`. **The real distinctness gate is the composed
caption inventory** at `i18n.test.ts:1727-2117`, whose final assertion (`:2109`) is
`29 + hub.length + 4 + 6 + 8`. **If `/players` or `/tops` renders a `DataTable` under a new
composition, its captions must be added to that inventory** or they are invisible to the
distinctness property.

### D17 — What this story does NOT do

- **Does not touch `SiteNav.tsx`, `SiteNav.test.tsx`, `SiteHeader.tsx`, `HeaderSearch.tsx` or
  `ui/dialog.tsx`.** The nav completes itself from the flags (D6).
- **Does not edit `sitemap.ts` or `robots.ts`.** `discoverStaticRoutes()` (`:126-165`) walks
  `src/app` for `page.tsx` and picks the four routes up with zero edits — verified empirically
  against a simulated post-3.9 tree, which yielded all eight static routes. `robots.ts` already
  says `allow: "/"`. **Do not add `lastModified`/`changeFrequency`/`priority`** — `sitemap.ts:177`
  emits `{ url }` only, and `sitemap.test.ts:253-259` turns red on any decorated entry.
- **Does not touch `canonical-output.test.ts`** except for the optional `REQUIRED_DOCUMENTS`
  hardening (D8). Its enumeration is 100% auto-discovery (`walkHtml()` at `:225-235`).
- **Does not re-open `lg` as the inline-nav breakpoint**, the sheet's modality, "Tops" vs
  "Líderes", the badge containment of *Partidos* inside *Torneo*, or SM-5.
- **Does not design toward 90.**
- **Does not delete an assertion to satisfy a gate** (A1). Moved assertions are **re-pointed**.
- **Does not correct `/about`'s and `/glossary`'s stale "decision is open" docblocks** — noted in
  D8, out of scope.
- **Does not write the Epic 3 retrospective by hand** (D15).
- **Does not stage the stray `17`** (A4).

---

## Tasks / Subtasks

### Task 1 — A3 ownership probe and baseline (BLOCKING; AC 3)

1.1 `git status --porcelain` and `git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx`. **If either collision file is modified on disk by another session, ABORT here and say so.** Recorded clean at story creation (`24906d4`).
1.2 Confirm the stray `17` is still the only untracked entry and record that it is not yours.
1.3 **Re-measure the baseline yourself — do not inherit a number.** `cd app && npm run build && npm test`. Record tests / files / skipped and the exported route count (`find out -name index.html | wc -l`, plus `404.html`). Story creation measured **1,512 / 60 / 0** and **1,406 routes** (1,407 documents).
1.4 Confirm `npx -y lighthouse@13.4.1` resolves from the registry (D5 pins the version).

### Task 2 — The D4 harness, built and PROVEN (AC 2; D11)

2.1 Write `serve.mjs` in the scratchpad: gzip/brotli with a real `content-length`, keep-alive, Netlify cache-control, clean URLs, real `404.html`, correct `Content-Type`, **and the RSC dot-path → directory mapping**.
2.2 Start it on a private port; `netstat -ano | grep :<port>` to confirm exactly one listener.
2.3 **`curl -sI` the header assertion and paste the output into the Dev Agent Record.** No score is measured before this passes. Compare a compressed `content-length` against the raw file size to prove compression is real, not announced.

### Task 3 — PRE-refactor medians (AC 2; D10) — before any code changes

3.1 Lighthouse mobile × 3 on **`/`** (today's Hub). Record min / median / max and `benchmarkIndex`.
3.2 Optionally × 3 on `/compare` as an untouched control, so a machine-wide drift is distinguishable from a change-caused one.
3.3 Record the medians in the table in Dev Notes. **These are the honest inherited floors** (D10).

### Task 4 — `/tournament`: move the Hub (AC 1, AC 5; D2, D8, D9)

4.1 Create `app/src/app/tournament/page.tsx` — **plain path, `.tsx`, no route group** (D7).
4.2 Move `generateMetadata` from `page.tsx` verbatim, including `composeHubTitle` and every load-bearing `openGraph` key and its comment (D8).
4.3 Move the body: one `SortAnnouncerProvider` wrapping `TournamentHubHeading` + `TournamentHubRegion`, in the `max-w-6xl … py-layer-gap` container.
4.4 **Verify `#results` and `#standings` arrive on `/tournament`** — `nav-destinations.ts`'s `matches` entry depends on `/tournament/#results` and no gate catches a dead fragment (D2).
4.5 Correct `TournamentHub.tsx:847`'s stale `4.5rem` comment if you touch the file (`deferred-work.md:4789`).

### Task 5 — `/tops`: re-site the leaderboards (AC 1, AC 5; D3, D9)

5.1 Create `app/src/app/tops/page.tsx`; move `leaderboardTeasers(readLeaderboards().boards)` and the `<LeaderboardsSection teasers={…} />` mount, inside its **own** `SortAnnouncerProvider`.
5.2 **Do not touch `LEADERBOARDS_SECTION_ID` and do not mint a second `id="leaders"`.**
5.3 Metadata per D8.
5.4 Correct `LeaderboardsSection.tsx:85`'s stale `4.5rem` comment.
5.5 Decide on the 36 dangling `aria-controls` IDREFs and the `w-48` skeleton overflow (`deferred-work.md:4799`, `:4794`) — take or decline, and say which (D14).

### Task 6 — `/` becomes the Landing surface (AC 1; D1)

6.1 Rewrite `page.tsx`'s body: zones 1–3 (zone 4 is the global footer). Keep a `generateMetadata` — `/` already has one, so no new position is taken — with a landing title composed by a **pure helper**, not a template (D8).
6.2 `FeatureBadge.tsx` — one component, an `emphasised` variant differing by **size, position and a 2px top border**, never fill or hue. Whole card is one `<a href>`, one tab stop, accessible name = visible label.
6.3 `LandingContent.tsx` — the lede and the grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. **Every `grid` className must carry a `grid-cols-*`** — `reflow-guards.test.ts:209-270` sweeps the repo for implicit grids.
6.4 No table, no disclosure, no loading state, no empty state on `/`.

### Task 7 — `/players` and `/teams` (AC 1, AC 5; D4, D5, D5b)

7.1 `src/lib/players-index.ts` — pure grouping (by team, artifact order), ordering (gk→df→mf→fw, then name), and filtering (`Intl.Collator('es', {sensitivity:'base'})`). Its own `node`-environment test.
7.2 `PlayersIndexRegion.tsx` — **client fetch of `/index/tournament.json` following `TournamentHubRegion`'s four-state machine (D5b), never a build-time read of the 1,248**. Then: 48 `ViewDataDisclosure`s, counts **outside** each control, per-team accessible names on **both** the trigger and the table, position abbreviations expanded **at the cell**, the filter with its polite live-region count and its zero-result copy that keeps the 48 headings rendered. Skeletons + `aria-busy` + "Datos cargados." + the shipped inline retry panel.
7.3 `TeamsIndexRegion.tsx` — same fetch shape; flat 48: name, group, record, each row linking to its Team Profile. **No disclosure** — 48 rows is not dense. Docblock records the deliberate redundancy with `/tournament#standings` (D5).
7.4 Route files at `src/app/players/page.tsx` and `src/app/teams/page.tsx` — plain paths beside the existing `[slug]/` (no collision, verified), metadata per D8.

### Task 8 — Flip FIVE booleans and complete the nav (AC 5; D6)

8.1 `nav-destinations.ts:147, 154, 161, 175, 183` → `available: true`. **Five, including `matches`.**
8.2 Rewrite `nav-destinations.test.ts:101-105` to the post-3.9 truth and rename the case.
8.3 Update the stale prose at `nav-destinations.ts:11-40`, `:164-170`, `:178`, `:201`; `nav-destinations.test.ts:10-43`; `es.ts:86-92`.
8.4 **Address the vacuous-green hole** (D6) — add a non-vacuity assertion or state in the comment what direction 2 still guards.
8.5 Retitle the stale case names in `SiteNav.test.tsx:304, :316, :333`. **Do not re-shape those assertions.**

### Task 9 — Re-point the moved gates (AC 1, AC 5; A1's no-deletion clause)

9.1 `static-output.test.ts:377-583` (the seven leaderboards cases, including the five id assertions at `:390`, `:392`, `:549-551`) → `out/tops/index.html`.
9.2 `static-output.test.ts:233-285` (the five Hub cases) → `out/tournament/index.html`. The `<title>` case at `:267-276` needs the Hub title's new home.
9.3 `static-output.test.ts:671-695` — the `/ artifact fetches` trio asserts `toEqual(["/index/leaderboards.json", "/index/tournament.json"])` by **set equality** (a *missing* fetch is a defect too), and that `page.tsx` reaches exactly 2 artifacts. **Split it per route, per D5b's table**: `/tournament` → `["/index/tournament.json"]`, `/tops` → `["/index/leaderboards.json"]`, `/players` and `/teams` → `["/index/tournament.json"]`, `/` → `[]`. Follow the existing per-route pattern at `:1060`, `:1096`, `:1126`, `:1182`. **The `/` → `[]` assertion is the one that catches a build-time read of the index sneaking onto the landing page.**
9.4 `static-output.test.ts:735-740` — add the four new index documents to `everyRouteHtml()`'s literal, or replace it with a `readdirSync` walk. Without this, seven cases titled *"on EVERY exported route"* silently stop covering the newest routes — the exact regression the comment at `:747-754` says was already paid for once. **`/compare` is already missing; add it too.**
9.5 `static-output.test.ts:79-85` — the authorship-caption `DOCUMENTS` array hardcodes four documents; add the new routes.
9.6 `i18n.test.ts:1727-2117` — add any new route's table captions to the composed inventory (D16).

### Task 10 — POST-refactor medians (AC 2; D10, D11)

10.1 Rebuild, restart the **same** harness, re-assert its headers.
10.2 Lighthouse mobile × 3 on `/`, `/tournament`, `/tops`, `/players`. Record min / median / max + `benchmarkIndex` for each.
10.3 **`/tournament` must clear ≥ 68.** Compare it against `/`'s pre-median too. **If it lands between 68 and the pre-median, STOP and put the question to Juan** (D10) — record the numbers, do not re-rule NFR-11.
10.4 Record `/`, `/tops`, `/players` as their own first floors.
10.5 Re-verify the `≥xl` header measurement per D12 — `getBoundingClientRect().width` on the search input, both locales, at 1280 px. Only touch `globals.css` if the numbers moved.

### Task 11 — A1: drive every gate RED once (AC 5; A1/NFR-12)

Record the command and the verbatim failing output for each, then revert and **re-verify green
before proceeding**. `npx vitest run src/lib/nav-destinations.test.ts` needs no build; the
export-reading gates do.

| # | gate | deliberately broken input |
|---|---|---|
| 11.1 | availability, direction 2 | after the flip, set `tops.available` back to `false` → *"tops is marked available:false but app/tops/page.tsx EXISTS."* |
| 11.2 | availability, direction 1 | `git mv src/app/tops/page.tsx src/app/tops/page.tsx.bak` → *"tops is marked available:true but app/tops/page.tsx does not exist…"* |
| 11.3 | **the `matches` trap** | flip only four flags, leaving `matches: false` → *"matches is marked available:false but app/tournament/page.tsx EXISTS."* Recording this converts the off-by-one folklore into evidence |
| 11.4 | the re-pointed `#leaders` assertions | remove `id={LEADERBOARDS_SECTION_ID}` from `LeaderboardsSection.tsx:81`, rebuild, run `static-output.test.ts` |
| 11.5 | sitemap bijection, export→sitemap | after a build, `.filter(r => r !== "/tops/")` on `discoverStaticRoutes`'s return; re-run **without** rebuilding → *"emitted by the build but missing from the sitemap: /tops/"* |
| 11.6 | sitemap bijection, sitemap→export | after a build, `routes.push("/nope/")`; re-run without rebuilding → *"listed in the sitemap but 404 on the host: /nope/"* |
| 11.7 | the whole-export card gate on a NEW route | drop `url: "./"` from one new route's `openGraph`, rebuild, run `canonical-output.test.ts` |
| 11.8 | any new gate this story authors | (e.g. the players-index model tests) |

**A1 is not satisfied by asserting that a gate could fail** (`3-10-...md:725`). Paste command +
output.

### Task 12 — Gates, and the full chain (AC 5)

12.1 `cd app && npm run build` — the six-step chain: `lint` → `typecheck` → `assert:schema-version` → `next build` → `copy-data.mjs` → `assert:no-external-origins`.
12.2 `npm test`. **`npm run build` MUST precede `npm test`** or `describe.skipIf(!anyBuilt)` silently skips ~20 export-reading assertions across four suites and the run reports green having asserted nothing. AC 5 says **no test is newly skipped** — verify the skipped count is still 0 and the file/test counts moved only upward.
12.3 Confirm the export: **1,410 routes / 1,411 documents**, sitemap **1,408** `<loc>` entries.
12.4 Refresh the stale prose route counts (list in Dev Notes) — cosmetic, but the numbers are now wrong in ~25 places.

### Task 13 — Ledger, sprint status, and the epic close (D13, D14, D15; A4, A6)

13.1 **`deferred-work.md` — APPEND ONLY.** Record: L1423 **stays deferred** with D13's reasoning and the corrected `:124/:125/:141` line numbers; the disposition of the five entries in D14; and whether `:4826` (owned by 3.9) was closed.
13.2 **`sprint-status.yaml` — surgical, append-only.**
  - Flip **line 3714** `3-9-home-page-refactor: backlog` → `ready-for-dev` → … → `done` (a one-token replacement; the last four commits touching this file each did exactly this).
  - **Insert this story's annotation block immediately AFTER line 3714** — that slot is currently empty. **Do NOT insert above it** (that is 3-8's post-key region) and **do not append to the block at 3715+**, which belongs to 3-10. Two-space `  # ` indent.
  - Flip **line 3488** `epic-3: in-progress` → `done` (D15).
  - Bump `last_updated` at **line 81**.
  - **Append the journal entry at the END of the file, after line 4776** — that is the live chronological region. Do not prepend into the region at line 82.
13.3 **A6 — record that the Epic 3 retrospective is now due**, `epic-3-retrospective` still `required` at `:3791`. It is a separate `bmad-retrospective` run; do not improvise one (D15).
13.4 **Commit by pathspec** (`git commit -- <paths>`), staging only the paths in the A3 probe list. **Never `git add -A`. Never the stray `17`.** Commit slices early.

---

## Dev Notes

### Files being modified — current state, what changes, what must survive

**`app/src/app/page.tsx` (199 lines)** — imports at `:1-11` are the map of what moves:
`LeaderboardsSection`, `SortAnnouncerProvider`, `TournamentHubHeading`, `TournamentHubRegion`,
`readLeaderboards`/`readTournament`, `composeHubTitle`, `t`, `OG_CARD_PATH`, `leaderboardTeasers`.
`generateMetadata` at `:67-143` (goes to `/tournament`, D2/D8). Body at `:145-199`.
**It emits zero ids of its own** — every anchor on `/` comes from children. **What must survive:
the four load-bearing `openGraph` keys and their comments, and the one-provider rule.**

**`app/src/lib/nav-destinations.ts` (219 lines)** — pure data, no React/DOM/`next/*`, so the gate
reads it in the `node` environment. Five flags (D6) plus prose.

**`app/src/components/LeaderboardsSection.tsx`** — `LEADERBOARDS_SECTION_ID = "leaders"` at `:73`,
rendered at `:81`. **`reflow-guards.test.ts:150-165` pins two class strings in this file by
path** — `"grid grid-cols-1 gap-tile-gap sm:grid-cols-2 lg:grid-cols-3"` (owner 5, the worst cell
in the R2/D8 matrix) and `"mt-2 grid grid-cols-1 gap-1"`. Moving or renaming the file, or
reflowing those strings, turns that suite red.

**`app/src/components/TournamentHub.tsx` (873 lines) / `TournamentHubRegion.tsx` (282 lines)** —
already wired to story 3.8's `useHashScroll()` (`:850`) and `useAnchorNonce()` (`:523`, `:686`).
Route-agnostic; they move with the route, unedited except the stale comment.

**Pure modules that survive the move unchanged, with their tests:** `hub-model.ts` (+ 11
describes in `hub-model.test.ts`), `leaderboard-format.ts`, `leaderboard-model.ts`,
`TournamentHub.test.tsx` (jsdom, renders from the fixture).

### The metadata contract, stated once

Three constants, one line each, and nothing per-route:
`site-origin.ts:32` (`SITE_ORIGIN`), `layout.tsx:121` (`metadataBase`), `layout.tsx:124`
(`alternates: { canonical: "./" }`). Next threads the leaf pathname through every `mergeMetadata`
call, so the relative `"./"` written once resolves per route; `trailingSlash: true` adds the slash.

**`alternates` is INHERITED. `openGraph` and `twitter` are REPLACED WHOLESALE.** That asymmetry is
the entire trap (`layout.tsx:44-60`).

Every exported document must carry, byte-identical:
```
<link rel="canonical" href="https://mundial-stats.juancr.dev/<route>/"/>
<meta property="og:url" content="https://mundial-stats.juancr.dev/<route>/"/>
```

**The origin gate does not hold the card.** `assert-no-external-origins.mjs:348-402`'s
`FETCHING_POSITIONS` deliberately excludes `<meta content>`; the script reports an off-origin
`og:image` and **exits 0**. What holds it is `canonical-output.test.ts:463-546` — the assertions
3.3's review **replaced**, which now assert the exact resolved value, that the asset exists in
`out/` and is non-empty, that `og:image:alt` is present and non-empty, and the full twitter trio.
**Writing a literal `"/og-card-7ac312ef.png"` at any new site re-opens the drift hole that shipped
1,405 documents pointing at a 404, green.** Import `OG_CARD_PATH`.

### Testing standards

- **`vitest.config.ts` sets `environment: "node"` globally.** jsdom is opted in per file with
  `// @vitest-environment jsdom`. This is why so much verification reads **exported HTML** rather
  than rendered components — prefer a pure module + a node test wherever the logic allows it.
- **`npm run build` before `npm test`, always.** `out/` is gitignored; `npm test` never builds;
  `netlify.toml` runs `npm run build` alone. A **stale** `out/` is worse than none — it scores
  green while asserting the previous build.
- **A2**: pin new tests by relative path, never by an id a fixture and the real corpus could
  share, and show the test failing when the guarded thing is reverted.
- `userEvent.setup()` needs `{ delay: null }` under full-suite load (project memory).
- The ESLint i18n gate is a **build error**, not a warning (`--max-warnings 0`). Under
  `src/components/**` and `src/viz/**`: use `useT()` from `@/lib/i18n-provider`, never
  `import { t } from "@/lib/i18n"`, and never `@/lib/build-data`. Gated prop names include
  `label`, `message`, `text`, `description`, `caption`, `heading`, `tooltip`, `title`, `alt` —
  which is why `EmptyStatePanel` uses `headline`/`explanation` and `TacticalErrorBoundary` uses
  `logLabel`. **Do not rename those props.**

### Route-count arithmetic

| | today | after 3.9 |
|---|---|---|
| routes | 1,406 | **1,410** |
| exported documents (`*.html`) | 1,407 | **1,411** |
| sitemap `<loc>` | 1,404 | **1,408** |

1,400 entity routes (104 matches + 1,248 players + 48 teams) + `/`, `/about`, `/compare`,
`/glossary`, `/404`, `/_not-found` = 1,406. The document count is one higher because Next emits
both `404.html` and `404/index.html` for one route. The sitemap excludes `404/` and `_not-found/`.

**Stale prose to refresh (no functional effect):** `nav-destinations.ts:14,16`; `layout.tsx:29,86`;
`static-output.test.ts:139,721,770,867,891`; `SiteNav.tsx:61,68,260,512,545`;
`SiteNav.test.tsx:32,52,214,341,353,359,629`; `nav-destinations.test.ts:17,21,199`;
`site-origin.ts:8`; `assert-no-external-origins.test.ts:190,215`; `sitemap.ts:148`;
`sitemap.test.ts:27,92,143,153`; `canonical-output.test.ts:20,50,164,327,447`.

### Lighthouse record — the table this story must fill

| route | pre median (min–max) | post median (min–max) | benchmarkIndex | floor |
|---|---|---|---|---|
| `/` (Hub → Landing) | *Task 3* | *Task 10* | | new surface: own first median |
| `/tournament` | inherits `/`'s pre | *Task 10* | | **≥ 68** (contract) **and** vs `/`'s pre (D10) |
| `/tops` | — | *Task 10* | | new surface: own first median |
| `/players` | — | *Task 10* | | new surface: own first median |
| `/compare` (control) | *Task 3, optional* | *Task 10, optional* | | untouched |

Harness: `npx -y lighthouse@13.4.1`, mobile preset (the default — do **not** pass
`--preset=desktop`), median of 3, against the rebuilt gzip + keep-alive server whose header
assertion is pasted in the Dev Agent Record.

### Previous-story intelligence

- **3.10 (nav)** — shipped the nav against routes that do not exist, using the declared
  `available` flag and a filesystem bijection gate. Its handoff to this story is D6. Its Task 9.5
  already measured the post-3.9 `≥xl` header state (D12). Its AC 7 (the retrospective) was
  correctly declined and lands here instead (D15). **Its "four booleans" claim is wrong** (D6).
- **3.8 (deep links)** — established the fragment grammar and the `useAnchorNonce` /
  `useHashScroll` mechanism the Hub already uses. Set the precedent for D13's explicit
  "L1423 does not fire" language. Its completion notes are the model for the A1 red-driving
  table this story owes.
- **3.3 (og card)** — its review replaced weak same-origin assertions with exact-value ones; those
  replacements are the **only** thing holding the card line, because the origin script exits 0 on
  a bad `og:image`. It wrote a brief **for this story** at `sprint-status.yaml:4767-4776`.
- **3.2 (canonicals)** — `metadataBase` + relative `"./"` + the `alternates`-presence trap.
- **2.19 (perf hardening)** — the source of the 68, the 6,025 nodes, D4/D5/D19, and both harness
  failures. Read `:1302-1323`, `:1367-1373`, `:1660-1701` before measuring anything.
- **2.13 (leaderboards)** — wrote the `#leaders` mount and asked for the provider lift that
  `page.tsx:167-184` performed. Its instruction *"do NOT add a second one"* still binds.

### Git intelligence (last 5 commits)

```
24906d4 Story 3.3 -> done: both unfurlers draw the card, and the ledger note that outlived its own facts
17da438 Story 3.3 AC8: WhatsApp renders the card, and Slack is not inferred from it
aeeacf6 Story 3.3: deploy re-verified after the review, and the old card URL is now a 404
77d4d53 Story 3.3 code review: 15 patches, and the gate that checked the origin but never the value
1c19b25 Story 3.3: deploy verified, and the one AC a dev agent cannot close
```

The SEO track closed cleanly on `page.tsx`; nothing is mid-flight. Commit-message house style is
a subject naming the deliverable and, after a comma, the one thing that was learned.

### Stack

Next 16.2.11 (`output: "export"`, `images: { unoptimized: true }`, `trailingSlash: true`),
React 19.2.8, TypeScript ~6.0.3, Tailwind ~4.3.3, Vitest ^3.2.7, Node ≥24 (v24.15.0 installed).
`npx -y lighthouse@13.4.1` for measurement, **never a dependency** (D5).

### Project Structure Notes

The house pattern for a route, stated at `compare/page.tsx:4-8` and `players/[slug]/page.tsx:14-22`:
a **server component page shell** over a **client body**, with the client body in
`src/components/` — **not colocated under `src/app/`**, because colocating escapes the ESLint
client-import seam (`glossary/page.tsx:5-8`). Pure models go in `src/lib/` (or `src/viz/` if they
are visualization-shaped). Container:
`mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop` — `py-` only where the
route leads with an `<h1>` under the sticky header.

Adding `src/app/players/page.tsx` beside `src/app/players/[slug]/page.tsx` **collides with
nothing**; Next resolves the index and the dynamic segment independently, and `out/players/`
today holds 1,248 slug directories and no `index.html`.

### References

- Story definition: `_bmad-output/planning-artifacts/epics.md:1350-1380`
- Standing acceptance criteria A1–A6: `epics.md:1072-1106`
- UX-DR24: `epics.md:143`; NFR-11: `epics.md:91`; NFR-12: `epics.md:92`
- Contract — IA + route table: `ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md:30-96`
- Contract — The Landing Page: `EXPERIENCE.md:97-154`
- Contract — The Player and Team Indexes: `EXPERIENCE.md:155-211`
- Contract — Navigation: `EXPERIENCE.md:212-294`
- Contract — Deep-Link Fragment Grammar: `EXPERIENCE.md:295-357`
- Contract — Component Patterns / State Patterns: `EXPERIENCE.md:374-425`
- Contract — Responsive & Platform: `EXPERIENCE.md:449-472`
- Contract — UJ-0 (Tomás, the first arrival): `EXPERIENCE.md:521-551`
- Contract — i18n rows appended by 3.7: `EXPERIENCE.md:770-791`
- Design — Layout & Spacing (header-height token): `DESIGN.md:365-379`
- Design — Components (feature badge, nav menu, site header): `DESIGN.md:393-414`
- Design — token blocks: `DESIGN.md:185-191` (spacing), `:250-267` (nav-menu, feature-badge)
- Mocks: `mockups/key-landing-mobile.html`, `mockups/key-players-index-mobile.html`,
  `mockups/key-navigation.html`
- D4 / D5 / D19 and both harness failures: `_bmad-output/implementation-artifacts/2-19-performance-accessibility-hardening-real-data-swap-launch.md:561-569`, `:639-676`, `:1302-1323`, `:1367-1373`, `:1660-1701`, `:2046-2052`
- D17 (`<title>` stays Spanish, RULED): `deferred-work.md:4163`
- L1423: `deferred-work.md:1423-1430`, `:4181`
- L1553 / L1886 / L1465 closures: `deferred-work.md:4545`, `:4566`, `:4841-4865`
- L525 / L4071 do not fire: `deferred-work.md:4516-4519`
- Route-group blind spot, **owner 3.9**: `deferred-work.md:4826-4829`
- Open entries in the blast radius: `deferred-work.md:4789`, `:4794`, `:4799`, `:4821`
- Sprint plan: `sprint-status.yaml:3488` (epic), `:3714` (this story), `:3791` (retro),
  `:3473-3482` (the A3 collision table), `:4767-4776` (3.3's brief written for this story)
- Epic 2 retrospective: `epic-2-retro-2026-08-26.md:213-218` (§6.4, the home-refactor guard)

---

## Validation Pass (A5) — recorded 2026-08-27, at story creation

Fresh-context validation of every mechanism, file and line this story asserts. Six parallel
research passes plus first-hand verification of every contested claim.

**Verified as described:**

| claim | evidence |
|---|---|
| Tree clean, both collision files unheld | `git status --porcelain` → only `?? 17` |
| Baseline 1,512 tests / 60 files / 0 skipped | `npm test` at `24906d4`, exit 0, no "skipped" in output |
| 1,406 routes / 1,407 documents | `find out -name "*.html" \| wc -l` = 1407; 1,400 entity + 7 non-entity, `404.html` and `404/index.html` being one route |
| 36 leaderboard boards | parsed from the shipped `data/index/leaderboards.json` — 36, 18 team + 18 player |
| `LEADERBOARDS_SECTION_ID` defined once, rendered once | `LeaderboardsSection.tsx:73`, `:81`; the only other references are comments at `page.tsx:38`, `hub-model.ts:118` |
| `PendingSectionPanel` has zero importers | grep over `src/` → 4 hits, all in `EmptyStatePanel.tsx` (definition) and `TacticalLayer.tsx` (comments) |
| No `page.tsx` at `players/` or `teams/` level | `find src/app -name page.tsx` → 7 files, none at those levels |
| `sitemap.ts` is genuinely tree-walking | `discoverStaticRoutes()` replicated against a simulated post-3.9 tree → all 8 static routes, no edit |
| Zero route-count assertions in `app/` | grep `1406\|1,406\|1410` → every hit is a comment, test title, or failure message |
| UX contract commits | `fd5f130` "Story 3.7: UX contract…", `87a9a39` "Epic 3: record UX-DR24…" |
| Header tokens, no `header-h-zoom` | `globals.css:354-356`, breakpoint `:562-566` |

**Corrections made at validation — three artifacts in this repo are wrong, and the story
implements the corrected version:**

1. **"3.9 flips FOUR booleans" is off by one.** Asserted by `3-10-...md:260/:552/:1371`,
   `sprint-status.yaml:3723/:3767`, `nav-destinations.ts:14`, and `d073575`'s commit message.
   **`nav-destinations.ts` has FIVE `available: false` entries** (`:147, :154, :161, :175, :183`),
   verified by direct read. `es.ts:86` states it correctly. → **D6**, and Task 11.3 drives the
   resulting failure red on purpose so the folklore becomes evidence.
2. **L1423's `tactical-sections.test.ts:108-125` citation is stale** — repeated verbatim in
   `epics.md:1373`. The three assertions are now at **`:124`, `:125`, `:141`**, and `:141` is
   outside the cited window. → **D13**.
3. **The `<title>`-stays-Spanish decision is RULED, not open.** `/about:9-12` and
   `/glossary:9-19` both say it "is open and needs a human ruling"; `deferred-work.md:4163`
   records D17 closing it as ACCEPT ES CANONICAL on 2026-08-25. Those two docblocks are stale.
   → **D8** (the new routes take no new position; correcting the two docblocks is out of scope).

**Raised, not resolved — a decision for Juan:**

4. **NFR-11's 68 predates the Hub it is meant to guard.** The 68 and the 6,025 DOM nodes are
   Story 2.19's *start-of-story* figures; Task 5.7 of that same story took the Hub to 2,780 nodes
   and 86. `/tournament` inherits the 2,780-node Hub, so ≥68 is a gate that cannot go red — which
   is the argument UX-DR24 itself used to refuse holding `/` to ≥68. **The story does not re-rule
   the number.** It measures the pre-refactor median first, asserts both, and stops for a ruling
   if the post lands between them. → **D10**, Tasks 3 and 10.

**Recorded as under-specified and re-established by this story rather than inherited:**

5. **The D4 measurement server was never committed** and cannot be recovered from git. Its
   required properties survive in the record; its code does not. → **D11**, Task 2, including the
   mandatory header assertion before any score is trusted.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

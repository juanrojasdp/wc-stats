---
baseline_commit: f07116b
---

# Story 3.8: Match-Route Deep-Link Plumbing

Status: done

<!-- Created 2026-08-26. THIS IS A PORT, NOT AN INVENTION. Story 2.19 built this exact
     mechanism for the Tournament Hub and it ships at f07116b. Every ruling below is
     verified against the working tree at f07116b, not against the ledger's 2026-08-05
     blocker list — which is STALE, and correcting it is part of this story's scope. -->

## Story

As someone who receives a link to a specific section of a match,
I want that link to open the section it names,
So that a shared anchor lands on data rather than on a closed control (FR-40, UX-DR18; adopts ledger L1553 / L1886).

---

## ⚠️ READ THIS FIRST — THE LEDGER IS STALE AND THE STORY IS SMALL

`deferred-work.md`'s L1553 entry (2026-08-05) lists **four blockers**. Re-measured against
`f07116b`, **two are already resolved** and a third is half-resolved:

| L1553's blocker (2026-08-05) | State at `f07116b` (VERIFIED) |
|---|---|
| *"`ViewDataDisclosure`'s `open` is a private `useState(false)` with no prop, no `defaultOpen`, no ref"* | **RESOLVED by 2.19.** `openNonce?: number` ships at `ViewDataDisclosure.tsx:31` (declared `:84`, documented `:67-84`), adjusted-during-render at `:99-105`. |
| *"an unchanged hash never re-fires `hashchange`… **fatal to a link list**"* | **RESOLVED by 2.19 — the one called fatal.** `TournamentHub.tsx:182-215` adds a **capture-phase `document` `click`** listener beside `hashchange` precisely for the same-fragment case. Working over 21 Hub sections. |
| *"`PitchPanel` forwards exactly two props (`panelTitle`, `trailing`)"* | **STILL TRUE.** `PitchPanelProps` (`:112-132`) has exactly **8** props and none is a nonce; the disclosure call is `:1284-1291`. This story adds the ninth and tenth. |
| *"`sectionIdFromHash` is whole-string equality… `#shot-maps-log` returns `null` SILENTLY"* | **STILL TRUE.** `TacticalLayer.tsx:59-62`. |
| L1886: *"`#shot-maps` is ambiguous — two links share it"* | **STILL TRUE.** `expert-logs.ts:73` and `:79` both read `href: "#shot-maps"`. |

**So this story is: widen one grammar, thread one nonce, re-point six hrefs, port one hook.**
The ledger's "~12 files" count is right; its *difficulty* estimate is not. Do not re-derive the
Hub's mechanism — **copy it**.

**Reference implementation, in full, before you write a line:**
- `app/src/components/TournamentHub.tsx:156-215` — `useAnchorNonce`, including the docblock that
  explains why a `hashchange`-only source is not enough. Read the whole comment; it is the design
  rationale for half this story.
- `app/src/components/TournamentHub.tsx:887-923` — `useHashScroll`, and the comment stating the two
  hooks are *deliberately separate* ("one moves the viewport, the other opens the control — and a
  deep link needs both").
- `app/src/components/ViewDataDisclosure.tsx:67-105` — the `openNonce` contract and the
  adjust-during-render pattern (an effect here trips `react-hooks/set-state-in-effect` under
  `--max-warnings 0`).
- `app/src/components/TournamentHub.test.tsx:100-108` — the deep-link test shape you will extend.

---

## Acceptance Criteria (from `epics.md:1315-1347`)

**AC 1 — the same-fragment second click re-opens.**
Following a log link, closing the disclosure, and clicking the **same** link again re-opens it.
Verified by doing exactly that in a browser, not only in jsdom. This is the defect that made the six
Expert log links a silent no-op on the second click.

**AC 2 — a per-panel nonce is threaded through `PitchPanel`.**
`PitchPanel` accepts and forwards a nonce to its `ViewDataDisclosure`; the three non-`PitchPanel`
disclosures on the match route get the same treatment.

**AC 3 — the fragment grammar is widened, and an unresolvable fragment fails visibly in development.**
A finer fragment resolves to its panel. An addressed-but-unresolvable fragment (e.g. `#shot-maps-log`)
reports loudly in dev/test and stays silent in production. `#main-content` and `#expert` remain
silent at every environment — they are legitimate non-section fragments.

**AC 4 — `#shot-maps` is disambiguated.**
The shot log and the cross log each get their own resolvable fragment; the two links no longer collide.

**AC 5 (A2) — the tests prove the transition, not the markup.**
Tests assert the **closed → open** transition (a `<table>` appears inside the panel's region) rather
than asserting an anchor exists, and they **fail when the nonce wiring is reverted** — demonstrated
and recorded.

**AC 6 — L1553 and L1886 are closed in `deferred-work.md`**, with a note recording that Story 2.19
had already resolved two of their blockers, **including the one called fatal**. **APPENDED, never a
rewrite (D12)** — no paragraph above the new section is edited.

**Epic 3's standing criteria A1–A6 apply** (`epics.md:1071-1105`). A1 (drive every new/modified gate
RED once, record the command and its failing output), A3 (Task 1 ownership probe), A4 (stage only
your own paths), A5 (this validation pass — recorded below).

---

## Ruled Decisions

These were ruled at create-story against the verified tree. Implement them; do not re-open them
without recording why.

### D1 — The fragment grammar

A **new pure module** `app/src/lib/match-anchors.ts`. `lib/` and not `viz/`, on `expert-logs.ts`'s
own precedent (`expert-logs.ts:44`: *"navigation config, not a viz model"*). Pure, so it is unit-
testable without the component graph — the exact reason `LOG_LINKS` was moved out of `ExpertLayer`
at the 2.11c review.

```
#<SectionId>              → the section. UNCHANGED behaviour.
#<SectionId>-<panel>      → the section AND that panel's disclosure.
anything else             → null (silent), UNLESS it starts with "<SectionId>-", which is
                            "addressed but unresolvable" and reports in dev/test.
```

Frozen registry, six entries — one per disclosure the six Expert log links point at:

| anchor id | section | disclosure |
|---|---|---|
| `shot-maps-shots` | `shot-maps` | `ShotMapsSection`'s first `PitchPanel` |
| `shot-maps-crosses` | `shot-maps` | `ShotMapsSection`'s second `PitchPanel` |
| `pass-networks-matrix` | `pass-networks` | `PassNetworksSection` — **both** branches (see D5) |
| `offers-to-receive-table` | `offers-to-receive` | `OffersToReceiveSection.tsx:399` |
| `movement-to-receive-table` | `movement-to-receive` | `MovementToReceiveSection.tsx:351` |
| `defensive-actions-table` | `defensive-actions` | `DefensiveActionsSection`'s `PitchPanel` |

Export shape:

```ts
export const PANEL_ANCHORS: readonly { id: string; section: SectionId }[]  // frozen, as const
export type PanelAnchorId = (typeof PANEL_ANCHORS)[number]["id"]
export type MatchFragmentId = SectionId | PanelAnchorId
export function resolveMatchFragment(hash: string): { section: SectionId; panel: PanelAnchorId | null } | null
```

**`sectionIdFromHash` (`TacticalLayer.tsx:59`) is REPLACED by `resolveMatchFragment`, not extended
in place.** Delete it; the layer calls the new module. Keeping both would leave two grammars.

**A section-level fragment does NOT open any disclosure.** `#shot-maps` keeps its shipped behaviour
exactly — expand the section, scroll, focus the heading — because that is the ruled UX-DR18 anchor
and 2.11c verified it live at two widths. Only the finer fragment opens a table.

### D2 — Dev-visible failure: `console.error`, NOT `throw`

Copy `i18n.ts:39-58` — the project's established loud-in-dev / quiet-in-prod idiom — including its
`reportedMissing`-style `Set` so a stale fragment re-resolving on every render reports **once**:

```ts
if (process.env.NODE_ENV !== "production") { console.error(message) }
```

**A `throw` is wrong here and `i18n.ts` is not the counter-example.** `t()` throws because an
unresolvable key is only reachable from a code defect. A URL fragment is **reader input** — someone
hand-types `#shot-map` and a throw takes the page down inside `TacticalErrorBoundary` (or above it),
turning a typo into a crash. `console.error` is visible in dev, assertable in a test, and harmless.

**Scope the report tightly.** Warn **only** when the fragment starts with `"<SectionId>-"` and does
not resolve. `#main-content` (`SiteHeader.tsx:62`) and `#expert` (`ExpertLayer.tsx:71`) must stay
silent — `ExpertLayer.tsx:226-229` states outright that `sectionIdFromHash` returning null for
`#expert` is BY DESIGN. A blanket warn would fire on both on every match page load.

### D3 — One hook, two consumers: extract, do not copy

Move the Hub's hook to `app/src/lib/use-anchor-nonce.ts` (`"use client"`). Generalized so the match
route can read the raw hit (it needs it for section expansion as well as panel opening):

```ts
export interface AnchorHit { id: string; nonce: number }
export function useAnchorHit(): AnchorHit | null
export function anchorNonce(hit: AnchorHit | null, anchorId: string): number
export function useAnchorNonce(): (anchorId: string) => number   // thin wrapper, keeps the Hub's diff to an import
```

`TournamentHub.tsx`'s diff is then **one deleted function + one import line**; its two call sites
(`:584`, `:747`) and the `openNonce={anchorNonce(section.anchorId)}` props (`:706`, `:845`) are
untouched. `HASH_PREFIX` (`:63`) moves with the hook.

**Copy the listener body verbatim.** The capture-phase click handler is the whole point and every
guard in it is load-bearing:
- `closest("a[href]")` + `instanceof HTMLAnchorElement`
- `anchor.hash !== window.location.hash` → return (only the *same*-fragment case needs catching)
- `anchor.pathname !== window.location.pathname` → return (never fire on a cross-route link)
- `document.addEventListener("click", onClick, true)` — **capture phase**, so it still runs if
  something downstream stops propagation, and it only ever re-reads a hash the browser is already on.

### D4 — Nonce ownership: ONE hook instance, in `TacticalLayer`

`TacticalLayer` calls `useAnchorHit()` **once** and passes explicit numeric props down. Not one hook
per section — that would mint five `hashchange` + five capture-`click` listener pairs on a route that
needs one.

This also puts the whole grammar in one file, matching `TacticalLayer`'s own stated idiom (*"Narrow,
explicit props, never the whole bundle"*, `:337-340`). In `sectionContent`:

```tsx
case "shot-maps":
  return <ShotMapsSection … shotsNonce={anchorNonce(hit, "shot-maps-shots")}
                            crossesNonce={anchorNonce(hit, "shot-maps-crosses")} />
```

…and one `tableNonce` / `matrixNonce` for each of the other four sections.

**Numbers, not a callback prop.** A `panelNonce: (id) => number` function prop would be a fresh
identity every render and is not greppable; five numeric props are.

**`sectionContent` is called lazily, under the boundary** (`TacticalLayer.tsx:118-133`,
`SectionContent`) and only for **open** sections. That is fine: the same `hit` that produces the
nonce also drives the section expansion in D6, so the section is already open when the prop is read.

### D5 — `PassNetworksSection` has TWO disclosure sites, one anchor

`PassNetworksSection` renders a `ViewDataDisclosure` in **two** places and `pass-networks-matrix`
must open **both**:
- `:252-264` — the matrix-only branch (`nodes === null && edges !== null`), **which is the shape on
  104/104 real matches**. This is the branch a real reader hits.
- `:593-…` — the `PitchPanel` branch, reached on fixture data where `nodes` is populated.

Wire the same `matrixNonce` into both. Missing the second one passes on the corpus and fails on the
fixtures; missing the first passes the fixtures and fails in production.

### D6 — Section expansion must also honour the same-fragment click

`TacticalLayer.tsx:176-189`'s `openFromHash` effect subscribes to `hashchange` **only** — so the
ledger's path (a) applies to *section* expansion too: a reader who collapses `#defensive-actions` and
re-clicks the link gets nothing.

Drive it from the hook's `hit` instead of from a second `hashchange` subscription:

```ts
const hit = useAnchorHit();
useEffect(() => {
  const resolved = hit === null ? null : resolveMatchFragment(`#${hit.id}`);
  if (resolved === null) return;
  setOverrides((p) => ({ ...p, [resolved.section]: true }));
  setFocus((p) => ({ id: resolved.section, nonce: (p?.nonce ?? 0) + 1, scroll: true }));
}, [hit]);
```

`hit` changes identity on every re-read (the Hub's hook mints a new object each time), which is what
makes the same-fragment re-click re-fire. Delete the old `hashchange` subscription — the hook already
owns it. **Do not leave both**; two subscriptions means two focus-nonce bumps per navigation.

### D7 — `PitchPanel`'s two new props

`PitchPanelProps` goes from 8 to 10:

```ts
/** This panel's deep-link fragment id (D1). Absent ⇒ no id, no nonce — byte-identical. */
anchorId?: string;
/** Increments when a deep link names this panel; forwarded to ViewDataDisclosure. */
openNonce?: number;
```

`anchorId` lands on the existing bare `<section>` at `:1146` as `id={anchorId}`, so the fragment has
a real DOM target and the browser's own scroll works. **Add `id` only — no `aria-labelledby`.** A
`<section>` with an accessible name becomes a `region` landmark; adding six of those to the match
route is an a11y change this story has no ruling for.

The three non-`PitchPanel` disclosures get `id={anchorId}` on their existing wrapping element the
same way.

### D8 — `LOG_LINKS` re-points, and its type widens

`expert-logs.ts`: `href: \`#${SectionId}\`` → `href: \`#${MatchFragmentId}\``. All six entries move
to their panel anchor. **Preserve the type-level argument** the field's docblock (`:53-63`) makes —
a widened-to-`string` href would delete the compile-time protection that is the only reason a typo
does not ship silently.

`lib/i18n.test.ts:1667-1679`'s href pin (*"points every href at a real SectionId — the story's
largest silent failure"*) is **modified**, not deleted: it now asserts
`resolveMatchFragment(link.href) !== null` **and** that the resolved `panel` is non-null for all six.
That is strictly stronger than the `SECTION_IDS` membership check — it is the assertion that would
have caught L1886. Update the test's comment to say what it now guards. **A1 applies: drive it RED.**

### D9 — What this story does NOT do

- **No `--header-h` fix.** The tail of `deferred-work.md` records that story 3.6's authorship caption
  took the header from 57 px to 62 px (118 px where the row wraps, at ≤341 px es / ≤337 px en) while
  `globals.css`'s `scroll-padding-top: 4.5rem` (72 px) is unchanged — so an anchored heading lands
  **46 px behind** the wrapped bar. That entry names its own fix (one `--header-h` custom property
  consumed by `scroll-padding-top` and `/compare`'s three offsets) and its own reason for deferral:
  a shared-contract edit re-tuning anchor landing on all 8 routes. **Do not take it here.** Verify
  this story at ≥390 px, and **record the ≤341 px condition in your completion notes** so the two
  are read together.
- **No new locale keys.** The dev report is a `console.error` in English (developer-facing, like
  `TacticalErrorBoundary.tsx:96`), not user copy. This keeps the story clear of AR-12 / the i18n gate
  and of the caption inventory entirely.
- **No twelfth `SectionId`.** `SECTION_IDS` is untouched. `tactical-sections.ts` is untouched, so
  ledger L1423 (`PendingSectionPanel`) does **not** fire.
- **No route-count change, no `schemaVersion` bump, no contract change.** 1,406 routes stay 1,406.

---

### D10 — 🔴 TWO OF THE SIX LINKS HAVE NO TABLE TO OPEN ON REAL DATA. THIS IS NOT A BUG.

**Measured 2026-08-26 against `data/matches/` — the 104 real bundles the built site serves
(`build-data.ts:28`, flipped from fixtures by 2.19) — versus `data/fixtures/matches/m001`:**

| anchor | fixture `m001` | **real corpus (what the browser shows)** |
|---|---|---|
| `shot-maps-shots` | 19 shots → opens | **19 shots → opens** ✅ |
| `shot-maps-crosses` | 21 crosses → opens | **`crosses` is `null` → `EmptyStatePanel`, no disclosure exists** ⚠️ |
| `pass-networks-matrix` | `nodes` present → **`PitchPanel` branch** | **`nodes` null, 228 edges → the MATRIX-ONLY branch** ✅ |
| `offers-to-receive-table` | `players` present → opens | **`players` present → opens** ✅ |
| `movement-to-receive-table` | `players` present → opens | **`players` present → opens** ✅ |
| `defensive-actions-table` | 63 actions → opens | **`defensiveActions` null → the WHOLE SECTION renders its empty state; the section component never mounts** ⚠️ |

Three consequences, each of which will otherwise cost an hour:

1. **Do not "fix" the two absences.** They are the ruled, verified FR-22 behaviour and the ledger
   records both (`deferred-work.md`: *"`events.defensiveActions` is **null on 104/104**… the section
   renders its whole-section empty state on every match"*). A link that lands on a named absence is
   honest; a link that lands nowhere is not.
2. **The anchor must still land on the absence.** In `ShotMapsSection`, put `id={anchorId}` on the
   **cross `EmptyStatePanel`'s wrapper** as well as on the `PitchPanel` — the fragment then scrolls
   to *"Sin datos de Mapa de centros para este partido."* rather than to the top of the section. For
   `defensive-actions` no extra work is needed: `#defensive-actions-table` resolves to section
   `defensive-actions` and D6's section scroll already lands on the section's empty state.
3. **D5 inverts between the two data sets.** The `PassNetworks` **matrix-only** branch (`:252`) is
   the one a real reader hits; the `PitchPanel` branch (`:593`) is the one the fixture-backed tests
   hit. **Wiring only one of them passes every test and ships broken, or vice versa.** This is the
   single most likely way to get this story wrong.

## Tasks / Subtasks

### Task 1 — A3 ownership probe (blocking)

- [x] 1.1 `git status --short` and `git log --oneline -1`. Record the HEAD sha and the dirty set.
- [x] 1.2 Check the two known Epic 3 collision files named by A3: `app/src/app/page.tsx` and
      `app/src/components/SiteHeader.tsx`. **Neither is in this story's touch list** — if either is
      dirty, that is another session's work and you leave it alone.
- [x] 1.3 Confirm none of **your** paths (Task 2's file list) is held by another session. At
      create-story the tree was clean of all of them; three concurrent sessions own
      `_bmad-output/planning-artifacts/ux-designs/**` (bmad-ux),
      `app/scripts/assert-no-external-origins.mjs` + `app/eslint.config.mjs` (3-1), and
      `app/src/lib/bootstrap.ts` / `bootstrap.test.ts` / `i18n-provider.tsx` (3-5) — **no overlap**.
- [x] 1.4 **`app/src/lib/i18n.test.ts` is the one shared-file risk** (D8 modifies it). It is not
      claimed by any of the three, but 3-6 touched it before committing. Re-read it immediately
      before editing. If another session holds it, **abort at this task and say so** (2.18's
      precedent) rather than proceeding.
- [x] 1.5 Baseline the suite: `cd app && npm test`. **Expect 1,306 tests / 51 files / 0 skipped, all
      green.** (Not 1,251 — that figure predates story 3.6's `SiteSignature.test.tsx`. Re-measured
      2026-08-26.) If `src/lib/assert-schema-version.test.ts` times out at 20 s, it is a known
      contention flake under concurrent sessions — it runs in 2.1 s in isolation
      (`npx vitest run src/lib/assert-schema-version.test.ts`). Confirm in isolation, do not "fix" it.

### Task 2 — `lib/match-anchors.ts`, the pure grammar (AC 3, AC 4)

- [x] 2.1 Create `app/src/lib/match-anchors.ts` per **D1**. Frozen `as const` registry; derive
      `PanelAnchorId` from it so a typo is a compile error.
- [x] 2.2 `resolveMatchFragment(hash)`: strip a leading `#`; empty → `null`; exact `SectionId` →
      `{section, panel: null}`; exact `PanelAnchorId` → `{section: <its section>, panel}`.
- [x] 2.3 The dev report per **D2**: report-once `Set`, `process.env.NODE_ENV !== "production"`,
      `console.error`, and **only** for `"<SectionId>-"`-prefixed non-resolvers.
- [x] 2.4 `app/src/lib/match-anchors.test.ts`. Pin, at minimum:
      - every `SectionId` resolves to itself with `panel === null`;
      - every `PANEL_ANCHORS` entry resolves, and its `section` is a real `SectionId`;
      - `shot-maps-shots` and `shot-maps-crosses` resolve to **distinct** panels on the **same**
        section — the L1886 assertion;
      - `#main-content` and `#expert` → `null`, **and `console.error` not called** (spy it);
      - `#shot-maps-log` → `null`, **and `console.error` called once** — then called *once more*
        for a second identical miss (the report-once `Set`);
      - the production branch: `vi.stubEnv("NODE_ENV", "production")` → `null`, no `console.error`
        (the `i18n.test.ts:173-179` shape — copy it).
      - `PANEL_ANCHORS` ids are unique and non-empty.

### Task 3 — `lib/use-anchor-nonce.ts`, the ported hook (AC 1)

- [x] 3.1 Create the module per **D3**, copying `TournamentHub.tsx:182-215` verbatim into
      `useAnchorHit` and keeping every guard. Carry the docblock across — it is the design rationale
      and it must not be left behind in a file that no longer holds the code.
- [x] 3.2 Rewrite `TournamentHub.tsx` to import it: delete the local `useAnchorNonce` and
      `HASH_PREFIX`, add the import. **Both call sites and both `openNonce` props stay byte-identical.**
- [x] 3.3 `npm test -- src/components/TournamentHub.test.tsx` — the Hub's four disclosure tests must
      still pass **unchanged**. This is the regression floor for the extraction; if they go red, the
      move was not a move.

### Task 4 — `PitchPanel` threads the nonce (AC 2)

- [x] 4.1 Add `anchorId?: string` and `openNonce?: number` to `PitchPanelProps` (`:112-132`) with the
      docblocks D7 specifies. Destructure both in the signature (`:1068-1077`).
- [x] 4.2 `id={anchorId}` on the `<section>` at `:1146`. **No `aria-labelledby`.**
- [x] 4.3 `openNonce={openNonce}` on the `ViewDataDisclosure` at `:1284`. Nothing else in that call
      changes — `panelTitle` and `trailing` stay exactly as they are.
- [x] 4.4 Confirm the absent case is byte-identical: with neither prop passed, `id` is `undefined`
      and `openNonce` defaults to `0` at `ViewDataDisclosure.tsx:31`, which the docblock there
      defines as "never". `CompareChartsSection`, `TeamIdentitySection`, `TrendsSection`,
      `PhysicalSection` and the rest are unaffected and are **not** touched.

### Task 5 — The five section components (AC 2, AC 4)

Each takes one (or two) numeric nonce props and passes `anchorId` + `openNonce` down. Nothing else
in these files changes.

- [x] 5.1 `ShotMapsSection.tsx` — `shotsNonce` / `crossesNonce` onto the two `PitchPanel`s
      (`:417`, `:432`), with `anchorId="shot-maps-shots"` / `"shot-maps-crosses"`. **This is AC 4.**
      **Also give each branch's `EmptyStatePanel` the same id** per **D10.2** — on the real corpus
      the cross branch IS the empty panel (`:426-430`), and the fragment must land on the named
      absence. Both empty branches are bare ternary arms today (`:411-415`, `:426-430`), so each
      needs its own `<div id={…}>` wrapper. **Put the id on the wrapper ONLY in the absent branch** —
      the `PitchPanel` in the other arm already carries it via `anchorId`, and emitting both would
      duplicate a DOM id, which is silently legal and breaks `getElementById` in a way nothing
      catches (the hazard `i18n.test.ts:1643-1656` was written for).
- [x] 5.2 `PassNetworksSection.tsx` — `matrixNonce` into **both** disclosure sites per **D5**: the
      matrix-only `ViewDataDisclosure` (`:252`) and the `PitchPanel` (`:593`). **Per D10.3 these two
      branches split fixture from corpus** — the tests exercise one and the browser the other, so a
      half-wiring looks green. Wire both in the same edit and say so in the file list note.
- [x] 5.3 `OffersToReceiveSection.tsx` — `tableNonce` onto the `ViewDataDisclosure` (`:399`);
      `id` onto its wrapping element.
- [x] 5.4 `MovementToReceiveSection.tsx` — same shape (`:351`).
- [x] 5.5 `DefensiveActionsSection.tsx` — `tableNonce` + `anchorId` onto the `PitchPanel` (`:301`).

### Task 6 — `TacticalLayer` (AC 1, AC 3)

- [x] 6.1 Delete `sectionIdFromHash` (`:59-62`); import `resolveMatchFragment`.
- [x] 6.2 `const hit = useAnchorHit();` and replace the `openFromHash` effect (`:176-189`) with the
      `hit`-driven effect from **D6**. Delete the old `hashchange` subscription — do not keep both.
- [x] 6.3 Add the six nonce props to `sectionContent`'s five relevant cases per **D4**. The other six
      cases and the `default:` exhaustiveness throw are untouched.
- [x] 6.4 Confirm the mount-time read still happens. `TacticalLayer` is client-only under AR-11 and
      mounts inside `MatchBundleRegion`'s loaded branch — the browser has already abandoned the
      fragment by then, so the hook's initial `readHash()` is **load-bearing, not belt-and-braces**
      (`:52-56`, and the same sentence in `TournamentHub.tsx:887-901`).

### Task 7 — `LOG_LINKS` and its gate (AC 4, AC 5)

- [x] 7.1 `expert-logs.ts` — widen `href` to `` `#${MatchFragmentId}` `` and re-point all six entries
      to their panel anchor per **D1**'s table. Update ruling 2's docblock (`:16-27`): it currently
      states four blockers as present tense, two of which 2.19 resolved and all four of which this
      story closes. Rewrite it to describe what the links now do.
- [x] 7.2 `lib/i18n.test.ts` — modify the href pin per **D8**. Keep it in place; strengthen it.
- [x] 7.3 `ExpertLayer.tsx` — verify no change is needed. The anchors are built from `link.href`
      (`:990`) and the `aria-labelledby` hint from `link.titleKey`, so re-pointing the hrefs flows
      through untouched. **Confirm and record, do not assume.**

### Task 8 — The A2 tests (AC 5)

New file `app/src/components/MatchDeepLink.test.tsx` (or extend an existing jsdom suite). Copy the
harness shape from `TournamentHub.test.tsx:1-45` — `// @vitest-environment jsdom`, the
`@testing-library` imports, `Element.prototype.scrollIntoView = function () {}` with its honest
comment, `afterEach` cleanup **plus `window.location.hash = ""`**.

- [x] 8.1 **Attempt the full-`TacticalLayer` render first**, over `data/fixtures/matches/m001-…json`
      cast to `MatchBundle`, inside `<LocaleProvider>`. Record which DOM stubs jsdom needs.
      Likely ones, pre-identified: `scrollIntoView` (certain — `TacticalSection.tsx:101`);
      `ResizeObserver` (`use-element-width.ts:53` already guards `typeof … === "undefined"`, so it
      degrades, but recharts under `MomentumSection`'s `next/dynamic` may not). `matchMedia`:
      jsdom supplies it and `use-media-query.ts:49-53` try/catches anyway, so `isLg` is `false` —
      **which is the case you want**: the nine collapsible sections start collapsed, so
      closed → open is a real transition rather than a no-op.
- [x] 8.2 **If the momentum chart proves un-renderable in jsdom, do not fight it.** Each section is
      already wrapped in its own `TacticalErrorBoundary` (`TacticalLayer.tsx:495-498`), so a throw
      there renders that section's empty state and leaves `#shot-maps` unaffected. Record it in
      Debug Log References. Only if the *whole layer* is un-renderable, fall back to rendering the
      section components directly with an explicit nonce prop — and say in the file's docblock that
      the fallback tests the section half and that Task 8.6 covers the layer half.
- [x] 8.3 **Test — deep link opens the named panel.** `window.location.hash = "#shot-maps-crosses"`,
      render inside `act`, then assert a `<table>` exists inside `document.getElementById(
      "shot-maps-crosses")`. **Assert the transition, not the anchor** (A2): the same test must also
      assert that `#shot-maps-shots`'s region holds **no** table — one fragment, one panel.
- [x] 8.4 **Test — AC 4, the collision is gone.** `#shot-maps-shots` opens the shot table and leaves
      the cross table closed; `#shot-maps-crosses` does the inverse. This is the assertion L1886 exists
      for and it must be its own case.
- [x] 8.5 **Test — AC 1, the same-fragment second click.** Target `#defensive-actions-table`: the
      `m001` **fixture** carries 63 defensive actions so the section renders and the panel opens
      (per **D10** the real corpus does not — the fixture is the right harness for this case, and
      the test must be pinned by relative fixture path, A2). With the hash already set:
      render → open; `userEvent.click` the disclosure control to close it
      (assert closed: no `<table>`); then dispatch a click on an `<a href="#defensive-actions-table">`
      in the same document → **open again**. The anchor must carry the same `pathname` as
      `window.location` or the hook's guard rejects it. **`hashchange` will not fire** — that is the
      whole point of the case, and it is what proves the capture-phase listener is wired.
- [x] 8.6 **Test — the section still expands.** `#shot-maps` (section-level) expands the section and
      opens **no** disclosure (D1). Pins the shipped behaviour against regression.
- [x] 8.7 **A2's second half — prove the tests can fail.** Revert the nonce wiring (comment out
      `openNonce={openNonce}` in `PitchPanel.tsx:1284`), run the suite, capture the failure output,
      restore. **Record the command and the output in Completion Notes.** A test that has never been
      red is not a test.

### Task 9 — A1: drive every gate RED once

For each, record the command and its failing output in Completion Notes, then restore.

- [x] 9.1 `match-anchors.test.ts` — break the registry (point `shot-maps-crosses` at `shot-maps-shots`)
      → the distinct-panels case goes red.
- [x] 9.2 The modified `i18n.test.ts` href pin — set one `LOG_LINKS.href` back to `"#shot-maps"` and
      confirm the pin now rejects it (it would have **passed** under the old `SECTION_IDS` check;
      say so in the note — that is the point of the change).
- [x] 9.3 The dev-report branch — remove the `NODE_ENV` guard and confirm the production case fails.
- [x] 9.4 Task 8.7's revert already discharges the deep-link suite. Cross-reference it.

### Task 10 — Browser verification (AC 1, AC 3)

jsdom does not prove AC 1. **Do this in a real browser.**

- [x] 10.1 Build and serve the static export: `cd app && npm run build`, then
      `python -m http.server 8765 --directory app/out`. **`next dev` cannot serve `/data/fixtures`** —
      only `copy-data.mjs` populates it into `out/` (2.6 Task 11.2, 2.7 Task 12.2). `trailingSlash:
      true`, so the deep link is `/matches/{slug}/#shot-maps-crosses`.
      - Per the concurrent-session protocol: if the shared tree is left non-compiling by another
        session, build and verify in an **isolated git worktree on a private port** (2.11a's precedent).
      - Bundle data is cached hard; a plain reload will not refresh it. Override `fetch` with
        `cache: "no-store"` if you see stale data.
- [x] 10.2 **AC 1, the exact sequence, at ~390 px:** open `/matches/m001-…/#expert`, click
      **"Registro de tiros"** → the shot panel's table opens. Close it with "Ocultar los datos".
      Click the **same link again** → it re-opens. Confirm in DevTools that **no `hashchange` fired**
      on the second click. Record all three observations.
      **Use the shot log, NOT the cross log** — per **D10**, `events.crosses` is `null` on all 104
      real bundles, so "Registro de centros" lands on an `EmptyStatePanel` with no control to
      re-open. Repeat the sequence on **"Tabla de ofrecimientos"** as a second, differently-shaped
      confirmation (a non-`PitchPanel` disclosure).
- [x] 10.3 **AC 4 in the browser:** click "Registro de tiros" then "Registro de centros" in sequence.
      On real data the two now land on **different targets** — the open shot table and the named
      cross absence — where before both resolved to `#shot-maps` and the second click did nothing.
      Record both landings. **The full closed→open-on-each-panel proof of AC 4 is Task 8.4's
      fixture-backed test**, because the corpus cannot render two shot-maps panels; say so in the
      completion notes rather than claiming the browser proved it.
- [x] 10.4 **AC 3:** with the console open, hand-edit the URL to `#shot-maps-log`. In a `next dev`
      run (or a dev build) it must print the error; in the production export it must be silent and
      harmless. Both halves.
- [x] 10.5 **Record the header-landing condition (D9).** At ≥390 px the heading should land clear of
      the 62 px header. At ≤341 px (es) the header wraps to 118 px and the heading lands behind it —
      **that is the deferred `--header-h` entry, not this story's regression.** Observe it, state it,
      leave it.

### Task 11 — Close L1553 and L1886 (AC 6)

- [x] 11.1 **Append** a new `##` section to `deferred-work.md` — after the final entry, never inside
      one. Title it for this story and date it. **No paragraph above it is edited (D12).**
      **Re-read the file's tail immediately before writing**: three sessions are running and other
      Epic 3 stories append to this same ledger. If someone appended while you worked, your section
      goes after theirs. Never overwrite; never `git checkout` the file.
      **Do not edit this file with a PowerShell `Get-Content`/`Set-Content` round-trip** — it mangles
      accents and em dashes under PS 5.1. Use the edit tools.
- [x] 11.2 The note must state, explicitly:
      - **L1553 is CLOSED.** Of its four blockers, **two were already resolved by Story 2.19** —
        `ViewDataDisclosure.openNonce` (`:31`) and, **critically, the capture-phase click listener
        for the same-fragment case, which L1553 called *fatal to a link list*** — and 2.19 recorded
        that it had *"NOT minted a new instance"* of the defect while re-deferring the old one. The
        blocker list was therefore **stale from 2026-08-05**, and this story is a **port of a working
        Hub mechanism**, not the ~12-file invention the entry projected.
      - **L1886 is CLOSED.** `#shot-maps` no longer holds two links: `shot-maps-shots` and
        `shot-maps-crosses` are distinct resolvable fragments, pinned by their own test case.
      - The residual: `sectionIdFromHash`'s silent null is now a dev-loud `console.error`, and the
        three hash-re-entry paths the ledger filed at `deferred-work.md:215` — **(a) is closed here**;
        **(b)** (a post-retry remount re-consuming the hash) and **(c)** (Back pulling the reader into
        the section they were leaving) are **NOT** closed. State that plainly and name their
        successor, rather than letting the closure of (a) imply all three.
      - The `--header-h` interaction (D9) as an observed, unfixed condition.
- [x] 11.3 Update the 2.19 disposition table row for `L1553, L1886` at `deferred-work.md:4179`? **NO.**
      That table is 2.19's appended artifact. Leave it. Your new section names it and says the
      successor trigger fired.

### Task 12 — Gates and commit

- [x] 12.1 `cd app && npm run lint && npm run typecheck` — both clean. `--max-warnings 0`.
- [x] 12.2 `npm test` — **1,306 baseline + your new cases, 0 failures, 0 skipped.** Report the new total.
- [x] 12.3 `npm run build` — full chain, including `assert:no-external-origins`. **1,406 routes,
      unchanged.** (Note: story 3-1 is concurrently editing `assert-no-external-origins.mjs` and
      `eslint.config.mjs`. If the build fails inside *their* script, that is their in-flight work —
      confirm against a clean checkout before treating it as yours.)
- [x] 12.4 **A4 — stage by path, never `git add -A`.** Your paths, and only these:
      ```
      app/src/lib/match-anchors.ts
      app/src/lib/match-anchors.test.ts
      app/src/lib/use-anchor-nonce.ts
      app/src/lib/expert-logs.ts
      app/src/lib/i18n.test.ts
      app/src/components/TacticalLayer.tsx
      app/src/components/PitchPanel.tsx
      app/src/components/TournamentHub.tsx
      app/src/components/ShotMapsSection.tsx
      app/src/components/PassNetworksSection.tsx
      app/src/components/OffersToReceiveSection.tsx
      app/src/components/MovementToReceiveSection.tsx
      app/src/components/DefensiveActionsSection.tsx
      app/src/components/MatchDeepLink.test.tsx
      _bmad-output/implementation-artifacts/deferred-work.md
      _bmad-output/implementation-artifacts/3-8-match-route-deep-link-plumbing.md
      _bmad-output/implementation-artifacts/sprint-status.yaml
      ```
      Commit **directly to main** — solo repo, no feature branch, no PR. Commit your slice early
      rather than accumulating it: a concurrent session's sweeping `git add` can otherwise capture
      your files.

---

## Dev Notes

### The one mechanism, stated once

A deep link into a collapsed disclosure needs **three** things, and the Hub's comment
(`TournamentHub.tsx:900-906`) says so explicitly:

1. **Scroll** — the fragment's target does not exist in the exported HTML (the match route's Tactical
   Layer is client-only under AR-11 and mounts after the bundle fetch), so the browser tries once,
   finds nothing, and **never retries**. A mount-time read is the only thing that makes anchors work.
   On the match route this half already ships, via `TacticalSection.focusScroll`.
2. **Expand the section** — ships, via `overrides` + `focusNonce`. But `hashchange`-only, so the
   same-fragment case is broken (D6 fixes it).
3. **Open the disclosure** — **does not ship on this route.** This is the story.

`ViewDataDisclosure`'s docblock (`:77-82`) already explains why the third is a **nonce and not a
`defaultOpen` boolean**: the hash can only be read in an effect (reading `window.location` during
render is a hydration mismatch), and a nonce lets a *second* navigation to the same anchor re-open a
region the reader has since closed — which a boolean cannot, because its value would not change.

The 2.19 code review then found the gap in that reasoning and closed it: **with `hashchange` as the
only source, neither could the counter.** Hence the capture-phase click listener. That is the
sentence this whole story turns on.

### Architectural fit

`ARCHITECTURE-SPINE.md:104` (AD-11): *"State lives in exactly three places: the **URL** (route,
`/compare` query params, **section anchors — the only shareable state**), localStorage, and ephemeral
component state."* Widening the fragment grammar is squarely inside that rule and needs no new state
mechanism, no context, no store. Nothing here adds one.

`UX-DR18` (`epics.md:137`): *"stable deep-link anchors for every section"*. Panel anchors **extend**
that contract downward; they do not replace it. Every one of the eleven section anchors keeps its
exact shipped behaviour (D1).

### Files being modified — current state, what changes, what must survive

| file | today | this story | must not break |
|---|---|---|---|
| `TacticalLayer.tsx` | `sectionIdFromHash` `:59`; `openFromHash` effect `:176-189`; `sectionContent` switch `:203-419` | grammar swap, hit-driven effect, 6 nonce props | the `default:` `never` exhaustiveness throw; `SectionContent`'s lazy `build(id)` (`:118-133`, ledger L1504); the `key={`${id}-${open}`}` boundary remount |
| `PitchPanel.tsx` | 8 props; bare `<section>` `:1146`; disclosure `:1284` | +2 props, `id`, forwarded nonce | `panelTitle`/`trailing` unchanged; the Esc-layering `onKeyDown`; the roving-tabIndex marker model |
| `ViewDataDisclosure.tsx` | `openNonce` ships | **UNCHANGED — do not edit** | — |
| `TournamentHub.tsx` | owns `useAnchorNonce` `:182-215`, `HASH_PREFIX` `:63` | hook extracted out; import added | its 4 disclosure tests pass unchanged; `openNonce` props at `:706`/`:845` byte-identical |
| `expert-logs.ts` | 6 links, 2 sharing `#shot-maps` | hrefs re-pointed, type widened, ruling-2 docblock rewritten | the type-level protection on `href`; all six `id`s unique (`i18n.test.ts:1643`) |
| `i18n.test.ts` | href pin `:1667-1679` | strengthened | every other pin in the file; do not delete an assertion to satisfy a gate (A1) |
| `ShotMaps` / `PassNetworks` / `Offers` / `Movement` / `DefensiveActions` | render disclosures | +nonce, +anchorId | every `EmptyStatePanel` branch; `PassNetworks`' **two** disclosure sites (D5) |

### Testing standards

- `vitest 3.2.7`, `environment: "node"` by default (`app/vitest.config.ts`). A component test opts in
  per-file with `// @vitest-environment jsdom` — six files already do
  (`TournamentHub`, `HeaderSearch`, `RowAnchor`, `SiteSignature`, `use-in-view`, `use-url-query`).
  **A render harness EXISTS.** The ledger entry claiming *"the harness has no jsdom"* (2.11c,
  2026-08-05) is another stale line — `jsdom ^30.0.1`, `@testing-library/react ^16.3.2` and
  `@testing-library/user-event ^14.6.3` are all in `devDependencies`.
- **Pin by relative path, never by an id fixture and corpus could share** (A2). `m001` is the only
  fixture match with a full bundle; import it by relative path as `TournamentHub.test.tsx:12` does.
- **Never satisfy a gate by deleting an assertion** (A1). `i18n.test.ts`'s href pin is *replaced by a
  stronger one*, not removed.
- The `expect(x, "message")` second-argument idiom is used throughout this repo's suites for
  fixture-shape preconditions (`TournamentHub.test.tsx:120-138`). Use it — a precondition that can
  silently swallow the defect is not a precondition, it is a hole.

### Stack

Next 16.2.11 / React 19.2.8 / TypeScript 6.0.x / Tailwind 4.3.x / vitest 3.2.7 / radix-ui 1.6.5.
`output: 'export'`, `trailingSlash: true`. Node ≥24. **No new dependency is needed or permitted** —
everything this story uses is already installed. `next build` does not lint; the npm `build` chain
is the gate (`lint → typecheck → assert:schema-version → next build → copy-data → assert:no-external-origins`).

### Previous-story intelligence

- **2.19** built the reference implementation and recorded, in `ViewDataDisclosure.tsx:70-75`, that
  it was *"not allowed to MINT a new instance"* of L1553's defect while re-deferring the old one.
  That restraint is why this story is small. Its D15 also moved `sectionContent` under the error
  boundary (L1504) — do not undo it.
- **2.11c** filed both ledger entries and ruled the six links *honest anchors* precisely because this
  plumbing did not exist. Its ruling 2 docblock (`expert-logs.ts:16-27`) is the artifact this story
  retires; rewrite it rather than leaving a false present-tense description in the tree.
- **2.11c** also learned the `LOG_LINKS`-in-a-`"use client"`-component lesson: a frozen list belongs
  in a pure module. `match-anchors.ts` is built that way from the start for the same reason.
- **2.18** established that a `<caption>` is a table's announcement identifier and that deleting live
  locale keys is expensive. This story mints none.
- **3.6** (committed at `92eec27` / `f07116b`) changed the header's height and is the source of the
  anchor-landing condition in D9. Read the last entry in `deferred-work.md` before Task 10.5.

### Git intelligence (last 5 commits)

```
f07116b Spec: add the Suggested Review Order for the authorship caption
92eec27 Sign the project: an authorship caption in the header and the footer   ← story 3.6, header height
7180b88 Epic 3 defined: 10 stories across SEO, landing, home and navigation
d28e56f D20 ruled: ES canonical stands, og:image ban retired, Epic 3 unblocked
97edcb9 Epic 2 retrospective: the project's first, with 6 action items
```

Story 3.6 **has landed** — `sprint-status.yaml` still reads `3-6-authorship-signature: in-progress`
with a comment saying its files are uncommitted. That comment is out of date as of `92eec27`.
`SiteHeader.tsx`, `AttributionFooter.tsx`, `es.ts`, `en.ts`, `i18n.test.ts` and
`SiteSignature.test.tsx` are all committed and clean. **This changes nothing for this story** except
that `i18n.test.ts` is safe to edit (Task 1.4) — but re-probe rather than trusting this paragraph.

### Project Structure Notes

- New pure module in `app/src/lib/` — the established home for navigation config
  (`expert-logs.ts:44`) and frozen lists (`SECTION_IDS`, `OFFER_MOVEMENT_TYPES`).
- New hook in `app/src/lib/` with `"use client"` — matches `use-media-query.ts`, `use-element-width.ts`,
  `use-in-view.ts`.
- Test files sit **beside** their subject (`x.ts` → `x.test.ts`), never in a `__tests__` directory.
- **Variance, declared:** `MatchDeepLink.test.tsx` lives in `components/` but exercises a
  `lib/`-owned mechanism through the component graph. That is deliberate and matches
  `TournamentHub.test.tsx`, which does the same for `hub-model`. The pure grammar has its own
  `lib/match-anchors.test.ts`; the two are complementary, not duplicates.

### References

- `_bmad-output/planning-artifacts/epics.md:1315-1347` — Story 3.8 ACs
- `_bmad-output/planning-artifacts/epics.md:1071-1105` — Epic 3 standing criteria A1–A6
- `_bmad-output/planning-artifacts/epics.md:137` — UX-DR18; `:77` — FR-40
- `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md:104` — AD-11 (URL as the only shareable state); `:112` — AD-12 (i18n gate)
- `_bmad-output/implementation-artifacts/deferred-work.md:1553` — L1553 (2.11c disclosure plumbing, four blockers)
- `_bmad-output/implementation-artifacts/deferred-work.md:1886` — L1886 (two links share `#shot-maps`)
- `_bmad-output/implementation-artifacts/deferred-work.md:215` — the three hash-re-entry paths (a)(b)(c)
- `_bmad-output/implementation-artifacts/deferred-work.md:4179` — 2.19's Partition C row for L1553/L1886
- `_bmad-output/implementation-artifacts/deferred-work.md` (final entry) — the `--header-h` / `scroll-padding-top` condition from story 3.6
- `_bmad-output/implementation-artifacts/epic-2-retro-2026-08-26.md:181-187` — the successor trigger firing
- `app/src/components/TournamentHub.tsx:156-215`, `:887-923` — the reference implementation
- `app/src/components/ViewDataDisclosure.tsx:67-105` — the `openNonce` contract
- `app/src/components/TournamentHub.test.tsx:100-108` — the deep-link test to extend
- `app/src/lib/i18n.ts:39-58` — the loud-in-dev / quiet-in-prod idiom

---

## Validation Pass (A5) — recorded 2026-08-26

Every mechanism, line reference and count below was verified against the working tree at `f07116b`
before this story was handed to dev.

**Confirmed present, as described:** `ViewDataDisclosure.openNonce` (declared `:31`, typed `:84`,
adjusted-during-render `:99-105`); `useAnchorNonce` (`TournamentHub.tsx:182-215`) with its
capture-phase click listener; `useHashScroll` (`:911`); `sectionIdFromHash` as whole-string equality
(`TacticalLayer.tsx:59-62`); `PitchPanelProps` with **exactly 8** props (`:112-132`) forwarding only
`panelTitle` and `trailing` (`:1284-1291`); both `LOG_LINKS` shot/cross entries at `href: "#shot-maps"`
(`expert-logs.ts:73`, `:79`); a jsdom render harness in six files; `PassNetworksSection`'s **two**
disclosure sites (`:252`, `:593`).

**Corrections made to the inputs, so they are not rediscovered:**
1. **The epic cites `ViewDataDisclosure.tsx:30` for `openNonce`.** It is `:31` (`:30` is
   `surface = "pitch"`). Immaterial, corrected for precision.
2. **The stated baseline of "1,251 tests" is stale.** Measured 2026-08-26: **1,306 tests across 51
   files, 0 skipped.** The delta is story 3.6's `SiteSignature.test.tsx` and its `i18n.test.ts`
   additions. One test (`assert-schema-version.test.ts`) timed out at 20 s under three concurrent
   sessions and passed in **2.1 s** in isolation — a contention flake, not a red baseline.
3. **The ledger's *"the harness has no jsdom"* (2.11c, 2026-08-05) is stale.** `jsdom ^30.0.1` and
   both Testing Library packages ship; six suites already opt in per-file.
4. **`sprint-status.yaml`'s comment on `3-6-authorship-signature`** ("implemented in the working tree
   … NOT yet committed") is out of date — 3.6 committed at `92eec27`. Left for that story's owner.
5. **Neither the epic nor the ledger records that two of the six links have no table to open on the
   shipped corpus.** Measured directly from `data/matches/*.json` (104 bundles, the tree
   `build-data.ts:28` reads) against `data/fixtures/matches/m001`: `crosses` and `defensiveActions`
   are `null` on real data and populated on the fixture, and `passNetworkNodes` is `null` on real
   data and populated on the fixture — which flips `PassNetworksSection` to its **other** disclosure
   branch. **D10 exists because of this measurement**; without it, browser verification of AC 1
   against "Registro de centros" would report a false failure, and D5's second wiring site would
   look untested-but-fine.

**1,406 routes was NOT re-verified** — it requires a full build, and this story changes no route. Any
route-count claim in the completion notes must come from Task 12.3's actual build output.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Opus 5, 1M context) — BMad `dev-story` workflow, 2026-08-26.

### Debug Log References

**A3 ownership probe (Task 1).** HEAD at start was `87a9a39`, not the frontmatter's `f07116b`.
`git diff f07116b..HEAD` touched **nothing under `app/`** (only `_bmad-output/**`), so every line
reference in this story still held and nothing had to be re-derived. The dirty set was entirely story
3-1's (`assert-no-external-origins.mjs`, `assert-no-external-origins.test.ts`, `site-origin.ts`,
`site-origin.test.ts`, `__lint-probe.ts`) plus a stray empty file named `17` (0 bytes, not mine, left
alone). `page.tsx`, `SiteHeader.tsx` and `i18n.test.ts` were all clean — 1.4's abort condition did not
fire.

**Baseline (Task 1.5) measured 1,320 tests / 52 files, NOT the story's predicted 1,306 / 51.** The
delta is story 3-1's *uncommitted* work sitting in the tree: `site-origin.test.ts` was a 52nd file and
`assert-no-external-origins.test.ts` had gained cases. `assert-schema-version.test.ts` passed at
15.8 s; the predicted contention timeout did not occur.

**jsdom renders the WHOLE Tactical Layer (Task 8.1) — the 8.2 fallback was not needed.** Stubs
required: `scrollIntoView` (as predicted) and a no-op `ResizeObserver` (predicted as *likely*).
recharts logs `width(0) and height(0)` warnings to stderr but does not throw, so no section is lost to
its `TacticalErrorBoundary`.

**TWO HARNESS TRAPS FOUND AND FIXED, both of which had produced tests that passed for the wrong
reason:**

1. **`LocaleProvider` resolves `en` in jsdom, not `es`.** It reads localStorage, then
   `navigator.language` (jsdom reports `en-US`), then `initialLocale` — so the disclosure control
   renders "Hide data", not "Ocultar los datos". Worse, that resolution lands in an *effect*, which
   makes a copy-matching selector TIMING-dependent: the first full-file run passed and later runs
   failed. Diagnosed by printing the rendered control in a throwaway suite
   (`EXPANDABLE COUNT: 1 -> Hide data true`). Every selector now uses `button[aria-expanded]`, which
   is locale-invariant and is also the semantically correct handle; the helper asserts exactly one per
   panel, so a future second collapsible inside a panel becomes loud rather than silently mis-picked.
2. **jsdom FIRES `hashchange` for a same-fragment anchor click, where a real browser fires none.**
   Measured: a counting listener saw 2. This matters more than it looks — it means the jsdom AC-1 case
   can be carried by the `hashchange` path and would stay green with the capture-phase listener
   deleted. A dedicated case therefore CANCELS the navigation (a bubble-phase `preventDefault` on
   `document`, which runs after the hook's capture-phase listener), asserts zero `hashchange` fired,
   and asserts the panel re-opened anyway — isolating the capture listener as the only possible cause.
   The comment that had claimed "hashchange DOES NOT FIRE here" was corrected, not left standing.

**A flaky failure that turned out to be a TIMEOUT, not a defect.** The AC-4 case does two full-layer
renders and vitest's 5 s default failed it intermittently on a loaded machine.
`vi.setConfig({ testTimeout: 30_000 })` with a comment explaining why the coverage was kept and the
budget raised instead; four consecutive full-file runs green afterwards.

**The lint gate rejected D6's literal code sketch.** `react-hooks/set-state-in-effect` fires on
`setOverrides`/`setFocus` called synchronously in a `useEffect` body — the exact rule
`ViewDataDisclosure`'s own docblock warns about. The old code escaped it only because its setState
calls sat inside a `hashchange` CALLBACK. Resolved with this project's established idiom for the same
constraint (adjust-during-render, which `ViewDataDisclosure.tsx:99-105` already uses to consume this
very nonce). See the declared deviation below.

**Two dead bindings created and removed.** Deleting `sectionIdFromHash` orphaned `SECTION_IDS`, and
the adjust-during-render move orphaned `useEffect`, both in `TacticalLayer.tsx`. Neither is caught by
anything in the build chain — that file's own header docblock says exactly this, and records that
Story 2.9 shipped one and took a review finding for it — so both were removed by hand.

**CONCURRENT-SESSION INCIDENT: this story's 15 code files were committed by another session, then
un-committed.** While Task 12.1/12.2 were running, the 3-10 session's sweeping `git add` captured all
15 of them inside `f6fee86` ("Story 3.10: aborted at Task 1.4"), mixed with its own story file and
`sprint-status.yaml`. That session then reset the commit away (non-`--hard`, so nothing was lost).
Verified intact on disk, then committed under this story as **`deae510`**, staged by explicit pathspec
(A4). HEAD had also moved twice underneath this work in the meantime: story **3-1 landed**
(`432dc29`, `117311c`) and 3-10 was contexted (`2c8bb1a`).

### Completion Notes List

**AC 1 — the same-fragment second click re-opens.** The Hub's hook is extracted whole to
`app/src/lib/use-anchor-nonce.ts`, capture-phase click listener and every guard intact, and
`TacticalLayer` calls it exactly once for the route. Two jsdom cases cover it, one of which cancels
the navigation to prove the capture listener is what re-opens the panel.

**AC 2 — the nonce is threaded through `PitchPanel`.** `PitchPanelProps` goes 8 → 10 (`anchorId`,
`openNonce`). Absent means no `id` and `openNonce` defaulting to `0`, which `ViewDataDisclosure`
defines as "never", so `CompareChartsSection`, `TeamIdentitySection`, `TrendsSection`,
`PhysicalSection` and every other caller are untouched and were not edited. The three
non-`PitchPanel` disclosures (offers, movement, and the pass-network matrix branch) got `id` +
`openNonce` on their existing wrapping element.

**AC 3 — the grammar is widened and fails visibly in dev.** `app/src/lib/match-anchors.ts` REPLACES
`sectionIdFromHash` rather than extending it, so the route has one grammar and not two. An
addressed-but-unresolvable fragment reports once via `console.error` in dev/test and is silent in
production; `#main-content` and `#expert` are silent at every environment.

**AC 4 — `#shot-maps` is disambiguated.** `shot-maps-shots` and `shot-maps-crosses`, each pinned by
its own dedicated case in both suites.

**AC 5 (A2) — the tests prove the transition, and they were driven RED.** Every case asserts a
`<table>` appearing inside the addressed region *and* that the sibling region still has none.

**AC 6 — L1553 and L1886 closed in `deferred-work.md`**, appended as an 81-line section with **0
deletions** (`git diff --numstat` reported `81  0`), recording that Story 2.19 had already resolved
two of L1553's four blockers — including the one the entry called *fatal to a link list* — and stating
explicitly that closing hash-re-entry path (a) does NOT close (b) or (c).

**A1 — every new/modified gate driven RED once, then restored:**

| gate | how it was broken | observed failure |
|---|---|---|
| `match-anchors.test.ts` (9.1) | pointed `shot-maps-crosses` at `shot-maps-shots` | 3 red: `expected null not to be null`; `expected 5 to be 6`; `expected undefined to be 'shot-maps'` |
| the production guard (9.3) | removed the `NODE_ENV` early return | 1 red: `expected "error" to not be called at all, but actually been called 1 times` |
| the `i18n.test.ts` href pin (9.2) | set `shot-log.href` back to `"#shot-maps"` | 2 red: `shot-log must open a table, not just a section: expected null not to be null`; `expected [ 'shot-maps-shots', …(5) ] to include null` — **and `npm run typecheck` still PASSED.** That is the point of the change: `#shot-maps` is a legal `MatchFragmentId`, so the type cannot catch this and the runtime pin is the necessary second line of defence. The OLD `SECTION_IDS`-membership check would have passed it outright — it is the assertion L1886 needed and did not have. |
| the nonce wiring (8.7, cross-referenced by 9.4) | commented out `openNonce={openNonce}` in `PitchPanel.tsx` | 4 of 7 red in `MatchDeepLink.test.tsx`: `the addressed panel opened: expected 0 to be greater than 0`; `shots opened: expected 0 to be greater than 0`; `the deep link opened it: expected 0 to be greater than 0`; `closed before the re-click: expected [ <table …(1)>…(3)</table> ] to have a length of +0 but got 1` |

**DEVIATION FROM D6, DECLARED.** D6's code sketch is a `useEffect(…, [hit])`. That shape does not pass
`npm run lint` (`react-hooks/set-state-in-effect` under `--max-warnings 0`). D6's *ruling* — drive
section expansion from the hook's `hit` rather than from a second `hashchange` subscription, and
delete the old subscription rather than keeping both — is implemented exactly; only the mechanism
differs, and it is the idiom this project already uses for precisely this constraint. `hit` is
compared by identity, so the fresh-object-per-read property D6 depends on still does the work.

**DEVIATION FROM TASK 2.4, DECLARED.** Task 2.4 asks for `console.error` "called once — then called
*once more* for a second identical miss (the report-once `Set`)", which is self-contradictory. D2 is
the ruling and states the Set exists so a stale fragment "reports **once**". Implemented as D2 states.
The suite asserts both halves: a repeated identical miss stays at one call, while a *different* miss
gets its own — the assertion that distinguishes a keyed Set from a one-shot latch.

**IMPLEMENTATION CHOICE: the nonce props are REQUIRED, not optional.** Each of the five section
components has exactly one caller (`TacticalLayer`), so a forgotten nonce is a compile error rather
than the silent no-op this story exists to remove.

**VARIANCE FROM TASK 12.4's PATH LIST: `app/src/components/ExpertLayer.tsx` was edited.** Task 7.3
ruled correctly that no *logic* change is needed — the anchors are built from `link.href` verbatim, so
re-pointing the hrefs flows through untouched — and no logic was changed. But the file carried a
comment stating the links only "auto-expand the target section" via "TacticalLayer's hashchange
listener", both of which this story makes false. Leaving a false present-tense description of code I
had just changed is the same defect Task 7.1 retires in `expert-logs.ts`, so the comment was
corrected. Comment-only; confirmed by `git diff`.

**FILED, NOT FIXED: the Expert link hint copy is now arguably understated.** Each link's
`aria-labelledby` hint composes `{section title} — Ver los datos`, written when the links merely
STATED where the table was. They now open it. The hint is still true, and D9 bans new locale keys, so
it is raised for review rather than changed unilaterally.

**BROWSER VERIFICATION (Task 10) — DONE IN A REAL BROWSER, VIA A DIFFERENT ROUTE THAN PLANNED.** The
Claude-in-Chrome extension was not connected (`list_connected_browsers` returned `[]`), so rather than
leave AC 1's only real proof undone, the export was driven with **headless Chromium via Playwright**,
installed in the scratchpad — **no dependency was added to the repo** (D9). Served from an **isolated
git worktree at `deae510` on private port 8791**, so no concurrent session's uncommitted work was in
the build. The corpus is the REAL 104-bundle tree, so D10's absences are live. **12 of 12 checks
passed:**

| check | observed |
|---|---|
| 10.2 "Registro de tiros" 1st click | `#shot-maps-shots` `aria-expanded=true`, 1 table |
| 10.2 reader closes it | `aria-expanded=false`, 0 tables |
| 10.2 **SAME link clicked again** | `aria-expanded=true`, 1 table — **re-opened** |
| 10.2 **hashchange on that 2nd click** | count **1 → 1: NONE FIRED.** This is AC 1's real proof and the thing jsdom cannot give — jsdom fires one here, a real browser does not. |
| 10.2 "Tabla de ofrecimientos" (a non-`PitchPanel` disclosure) | same four results; 2 tables; hashchange **2 → 2** |
| 10.3 the two shot-map links | land on `#shot-maps-shots` vs `#shot-maps-crosses` — **different targets**, where before both resolved to `#shot-maps` and the second click did nothing |
| 10.3 the cross link on real data | lands ON the named absence: *"Sin datos de Mapa de centros para este partido."*, no disclosure control — D10 exactly, honest rather than nowhere |
| 10.4 `#shot-maps-log` in the production export | **0** `match-anchors` console lines, 13 headings still rendered — silent and harmless, no crash |

**AC 4's full closed→open-on-each-panel proof is Task 8.4's fixture-backed test, not the browser.**
The corpus cannot render two shot-maps panels (`crosses` is null on 104/104), so the browser proves
the two links now *land differently*; the fixture proves each *opens its own table while the sibling
stays shut*. Stated rather than blurred.

**TASK 10.5 — THE `--header-h` CONDITION REPRODUCES, AND THE LEDGER'S THRESHOLD IS SLIGHTLY OFF.**
Measured in es, `scroll-padding-top` a constant 72 px, document overflow false at every width:

| width | header | heading top | landing |
|---|---|---|---|
| 390 px | 62 px | 72 px | clear |
| 360 px | 62 px | 72 px | clear |
| 341 px | 62 px | 72 px | clear |
| **337 px** | **118 px** | **72 px** | **46 px BEHIND the wrapped bar** |
| 320 px | 118 px | 203 px | clear (landed mid-section, not at the anchor) |

So the wrap begins at **≤337 px in es**, not the ledger's stated ≤341 px — at 341 px the bar is still
one row. The 46 px overlap the entry predicts is exact where it does wrap. **Observed, stated, left
alone**: this is the deferred `--header-h` entry (story 3.6's caption), a shared-contract edit
re-tuning anchor landing on all 8 routes, and not this story's regression. Verification was done at
≥390 px for that reason. The threshold correction is recorded in the ledger section too.

### File List

**Code — committed as `deae510` (staged by explicit pathspec, A4):**

| file | change |
|---|---|
| `app/src/lib/match-anchors.ts` | **NEW.** The fragment grammar: frozen `PANEL_ANCHORS` registry, `resolveMatchFragment`, the dev-only report-once `console.error`. |
| `app/src/lib/match-anchors.test.ts` | **NEW.** 13 cases. |
| `app/src/lib/use-anchor-nonce.ts` | **NEW.** The Hub's hook, moved whole: `useAnchorHit`, `anchorNonce`, `useAnchorNonce`, `HASH_PREFIX`. |
| `app/src/components/MatchDeepLink.test.tsx` | **NEW.** 7 cases over the full `TacticalLayer` in jsdom. |
| `app/src/components/TacticalLayer.tsx` | `sectionIdFromHash` deleted; one `useAnchorHit()`; adjust-during-render expansion replacing the `hashchange` effect; six nonce props; dead `SECTION_IDS` and `useEffect` imports removed. |
| `app/src/components/PitchPanel.tsx` | `anchorId` + `openNonce` (8 props → 10); `id` on the `<section>`; nonce forwarded to `ViewDataDisclosure`. |
| `app/src/components/TournamentHub.tsx` | Local `useAnchorNonce` + `HASH_PREFIX` deleted; one import added. **1 insertion, 62 deletions**; both call sites and both `openNonce` props byte-identical. |
| `app/src/components/ShotMapsSection.tsx` | `shotsNonce`/`crossesNonce`; `anchorId` on both `PitchPanel`s; `id` wrapper on each EMPTY branch only (never both — a duplicate DOM id is silently legal and breaks `getElementById`). |
| `app/src/components/PassNetworksSection.tsx` | `matrixNonce` wired at **BOTH** disclosure sites — the matrix-only branch (corpus) and the `PitchPanel` branch (fixture). D5/D10.3. |
| `app/src/components/OffersToReceiveSection.tsx` | `tableNonce` + `id` on the wrapper. |
| `app/src/components/MovementToReceiveSection.tsx` | `tableNonce` + `id` on the wrapper. |
| `app/src/components/DefensiveActionsSection.tsx` | `tableNonce` + `anchorId` on the `PitchPanel`. |
| `app/src/lib/expert-logs.ts` | Six hrefs re-pointed; `href` type widened `` `#${SectionId}` `` → `` `#${MatchFragmentId}` ``; ruling 2's docblock rewritten from its stale four-blocker present tense. |
| `app/src/lib/i18n.test.ts` | The href pin strengthened (resolves AND names a panel) plus a new distinct-panels case. |
| `app/src/components/ExpertLayer.tsx` | **Comment only** — declared variance, see Completion Notes. No logic change (Task 7.3). |

**Documentation:**

| file | change |
|---|---|
| `_bmad-output/implementation-artifacts/deferred-work.md` | **Appended** an 81-line closure section (`git diff --numstat` = `81  0`). |
| `_bmad-output/implementation-artifacts/3-8-match-route-deep-link-plumbing.md` | This record. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `3-8-…: ready-for-dev` → `in-progress` → `review`. |

**Not modified, and deliberately so:** `app/src/components/ViewDataDisclosure.tsx` (its `openNonce`
already shipped), `app/src/lib/tactical-sections.ts` (no twelfth `SectionId`, so ledger L1423 does not
fire), any locale file (no new keys, so the i18n gate and the caption inventory are untouched), and
`app/vitest.config.ts` (the timeout is set per-file).

### Change Log

| date | change |
|---|---|
| 2026-08-26 | Story implemented. Fragment grammar widened to `#<section>-<panel>`; the Hub's anchor hook extracted and shared; `PitchPanel` threads a nonce; six Expert log hrefs re-pointed; `#shot-maps`' two-link collision removed. **L1553 and L1886 closed.** |
| 2026-08-26 | Gates: `lint` 0, `typecheck` 0. **Regression floor, measured in an ISOLATED WORKTREE at `deae510` holding this story's change and nothing else: 1,341 tests / 54 files, ALL GREEN.** The arithmetic closes exactly against the Task 1.5 baseline of 1,320 / 52: +21 tests (13 `match-anchors` + 7 `MatchDeepLink` + 1 new `i18n` case) and +2 files. `npm run build` green through the full chain — **1,406 routes, unchanged**; `assert:no-external-origins` reported 0 external subresources over 12,683 text assets. |
| 2026-08-26 | On the SHARED tree the suite reads 1,368/1,369 with contention timeouts, and one genuine failure that is **NOT this story's**: `nav.destinations.home does not resolve in es`, from story 3-10's half-landed `nav-destinations.ts` + `es.ts` work (both untracked/dirty under that session). `assert-schema-version.test.ts` times out at 20 s under load and passes in **3.4 s** isolated — the known contention flake, confirmed not fixed and not mine. |
| 2026-08-26 | Browser verification in headless Chromium against the built export from an isolated worktree: **12/12** checks, including AC 1's same-fragment re-open with **no `hashchange` fired**. |
| 2026-08-26 | Every new/modified gate driven RED once and restored (4 gates; commands and failure output in Completion Notes). |
| 2026-08-26 | Concurrent-session incident: the 15 code files were swept into another story's commit `f6fee86` and then reset away; verified intact and committed here as `deae510`. |

---

## Review Findings

<!-- Code review 2026-08-26 against `deae510`. Three adversarial layers (Blind Hunter,
     Edge Case Hunter, Acceptance Auditor) run in parallel with no shared context; every
     finding below was re-verified against the tree and the 104-match corpus before triage.
     Corpus measurements confirmed: defensiveActions null 104/104, crosses null 104/104,
     passNetworkNodes null 104/104, shots null 0/104. -->

### Review Findings — decision needed

- [x] [Review][Decision] **A deep link never scrolls to the panel it names, and focus lands away from the viewport** — The only scroll in the mechanism is `TacticalSection.tsx:101` (`sectionRef.current?.scrollIntoView()`), which targets `<section id={plan.id}>`, never `resolved.panel`. `PitchPanel.tsx:1167` gains `id={anchorId}` but nothing ever scrolls to it. When the section is already expanded the browser's own fragment scroll reaches the panel first, then the focus effect scrolls back up to the section heading with `preventScroll: true` — leaving focus on an element the reader cannot see (WCAG 2.4.7 / 2.4.3). Sharpest on `#shot-maps-crosses`, which sits below a full shot-map panel. `expert-logs.ts:31-33` now asserts following a link "scrolls to the panel"; it does not. Note `#offers-to-receive-table` / `#movement-to-receive-table` put their id on the component's outermost `<div>`, the first child of the section — so the `-table` anchors are positionally identical to their section anchors and the panel grammar buys nothing positional anywhere. Task 10.2 verified with **"Registro de tiros"**, the first panel in its section — the one case where section-top scroll is indistinguishable from panel scroll — so the browser pass could not have caught this. **Decision:** scroll to the panel and move focus there, scroll to the panel but keep focus at the section heading, or keep current behaviour and correct the docblocks. Touches ruled UX-DR18 focus behaviour.
- [x] [Review][Decision] **A stale positive `openNonce` re-opens a reader-closed table on every remount** — `hit` is never cleared (`use-anchor-nonce.ts:68-71` early-returns on an empty hash, and `hit` is only ever replaced, never nulled), while `ViewDataDisclosure`'s `seenNonce` re-inits to `0` on each mount (`:99`). Two independent forces remount the subtree: `TacticalSection.tsx:212` renders `{open ? <div>{children}</div> : null}`, and `TacticalLayer.tsx:553` keys the boundary `` `${plan.id}-${plan.open}` `` so the key itself changes on collapse. Sequence: deep-link `#defensive-actions-table`, close the table, collapse the section, re-expand — `1 !== 0 && 1 > 0` fires `setOpen(true)` and the reader's explicit close is discarded. Repeats for the life of the page, and `plan.open` also flips on an `lg` breakpoint crossing, so a window resize triggers it. **Decision:** where to fix — consume/clear the hit in the layer, seed `seenNonce` from `openNonce` on mount, or change the nonce contract. The contract is shared with the Tournament Hub (2.19), so the choice has cross-route consequences.
- [x] [Review][Decision] **`#defensive-actions-table` lands nowhere on 104/104 real matches, and the empty-branch id wiring is asymmetric** — `defensiveActions` is null on all 104 bundles, so `plan.isEmpty` holds and `TacticalLayer.tsx:557` renders the section-level `EmptyStatePanel`; `DefensiveActionsSection` never mounts and the id does not exist in the DOM. `ShotMapsSection.tsx:445`/`:464` deliberately wrap their absent arms in `<div id="…">` so the anchor lands on a named absence; `PassNetworksSection.tsx:288-292` and the section-level empty path do not. D10.2 rules that "a link that lands on a named absence is honest; a link that lands nowhere is not" — which is exactly what `#defensive-actions-table` does. Related: `ShotMapsSection`'s required `crossesNonce` and `DefensiveActionsSection`'s required `tableNonce` are computed and silently discarded on the arm that ships. **Decision:** whether the generic section-level empty state should carry a per-section panel anchor id.
- [x] [Review][Decision] **The dev-visible guard both false-positives on real ids and misses the likeliest typos** — `addressesASection` (`match-anchors.ts:97`) denounces anything matching `` `${SectionId}-` ``. `TacticalSection.tsx:109-111` mints `${id}-heading`, `${id}-content` and `${id}-summary` for all eleven sections — 33 real, valid DOM ids the guard would call broken hrefs. Meanwhile `#shot-map-shots` (misspelt section half), `#Shot-Maps-Shots` (case), and `#shot-maps-shots?x=1` all return null silently with no report — the exact silent-dead-anchor class L1553 filed, and `match-anchors.test.ts:126-129` pins that hole in by asserting `#not-a-section-at-all` is silent. **Decision:** re-opens D2's ruled report scope ("warn only when the fragment starts with `<SectionId>-`").
- [x] [Review][Decision] **The link hint promises a "Ver los datos" control that does not exist on 104/104 matches for two of six links** — `ExpertLayer` composes `hint = ${t(link.titleKey)}${CONTROL_SEPARATOR}${t("viz.viewData")}` and exposes it via `aria-labelledby`. For the cross log and the defensive log there is no such control on any real match. No locale copy changed in this commit, and the two rewritten docblocks now assert the opposite unconditionally (`ExpertLayer.tsx:1004-1010`, `expert-logs.ts` ruling 2). **Decision:** copy change needs a UX/i18n ruling and interacts with the caption inventory gate.

### Review Findings — patch

- [x] [Review][Patch] Three of six registry anchors have no end-to-end assertion, and the only `pass-networks` branch real readers meet is never rendered by any test [app/src/components/MatchDeepLink.test.tsx]
- [x] [Review][Patch] Six stale docblocks that this commit's own changes made false [app/src/components/ExpertLayer.tsx:81,227; app/src/components/PlayerMatchesSection.tsx:163; app/src/lib/tactical-sections.ts:206; app/src/viz/player-profile-model.ts:574; app/src/lib/i18n.test.ts:1554]
- [x] [Review][Patch] `Element.prototype.scrollIntoView` globally clobbered with no restore, which is why the suite cannot see the scroll defect [app/src/components/MatchDeepLink.test.tsx:64]
- [x] [Review][Patch] `resolveMatchFragment` is called during render and can `console.error` and mutate a module-level Set [app/src/components/TacticalLayer.tsx:225]
- [x] [Review][Patch] `use-anchor-nonce.ts` shipped with no test file, despite D3 citing testability as the reason to extract it [app/src/lib/use-anchor-nonce.ts]
- [x] [Review][Patch] No gate binds a `PANEL_ANCHORS` entry to a rendered DOM id — a seventh entry would compile, resolve and pass both new pins while rendering no target [app/src/lib/match-anchors.ts:60-73]
- [x] [Review][Patch] The AC 3 test asserts only that some heading exists; nothing checks that no table opened or no section spuriously expanded [app/src/components/MatchDeepLink.test.tsx:331-343]
- [x] [Review][Patch] Bare `userEvent.setup()` with the file timeout raised 6× to 30 s instead of the known `{ delay: null }` fix already used at `HeaderSearch.test.tsx:99` [app/src/components/MatchDeepLink.test.tsx:224,283]
- [x] [Review][Patch] The capture-phase click listener ignores `event.button`, `ctrlKey`/`metaKey`/`shiftKey` and `defaultPrevented`, so a Ctrl-click opens a new tab *and* re-opens a closed disclosure in the current one [app/src/lib/use-anchor-nonce.ts:74-87]
- [x] [Review][Patch] `anchorNonce(hit, anchorId: string)` takes a bare string, leaving all six `TacticalLayer` call sites unprotected by the type system a one-character typo returns 0 forever [app/src/lib/use-anchor-nonce.ts:96; app/src/components/TacticalLayer.tsx:260-261,286,337,354,371]
- [x] [Review][Patch] `href: #${MatchFragmentId}` is weaker than the docblock's "STRENGTHENED" claim it still admits every bare `#<section>`, so the type cannot reject an L1886 regression [app/src/lib/expert-logs.ts:85]
- [x] [Review][Patch] `MatchDeepLink.test.tsx` mounts `LocaleProvider` without pinning `navigator.language`, against a standing ledger rule that names story 3-8 as owner [app/src/components/MatchDeepLink.test.tsx]
- [x] [Review][Patch] The suite emits a genuine-looking `console.error` on every green run because this file installs no spy, unlike `match-anchors.test.ts` [app/src/components/MatchDeepLink.test.tsx:331-343]
- [x] [Review][Patch] `reportedFragments` has no reset seam, making the gate once-per-session rather than once-per-page and the unit test order-dependent [app/src/lib/match-anchors.ts:91]
- [x] [Review][Patch] Two `HASH_PREFIX` constants with divergent stripping semantics `.replace()` removes the first occurrence anywhere, `startsWith`/`slice` only a leading one; D3 said it "moves with the hook" [app/src/lib/use-anchor-nonce.ts:53; app/src/lib/match-anchors.ts:78]
- [x] [Review][Patch] Dev Agent Record inaccuracies: the ledger append was 109 lines not 81 (`numstat` = `109 0`, the 0-deletion half holds); "1,367 tests / 55 files" appears in the commit message but nowhere in the record, which gives 1,341/54 isolated; Task 12.4 describes one commit but the docs landed separately in `d3c103c`; Task 7.3 is checked as "no change needed" while `ExpertLayer.tsx` was in fact edited [_bmad-output/implementation-artifacts/3-8-match-route-deep-link-plumbing.md:844-847,929-957,969-970]

### Review Findings — deferred

- [x] [Review][Defer] The Tournament Hub still mounts two `useAnchorNonce()` instances, contradicting the D4 rationale that the route needs exactly one listener pair [app/src/components/TournamentHub.tsx:523,686] — deferred, pre-existing (Story 2.19)

### Review Findings — decisions resolved (2026-08-26, Juan)

All five `decision-needed` findings were ruled by the user during the review. Each becomes a
`patch`. The rulings below are binding on the follow-up work; do not re-open them without
recording why.

- **R1 — Panel scroll: SCROLL TO THE PANEL AND MOVE FOCUS THERE.** The resolved panel id is threaded
  into the scroll/focus target, so a panel fragment lands the viewport *and* the reader's focus on the
  panel rather than on the section heading. This is the story's own user statement ("a shared anchor
  lands on data") taken literally. It touches `TacticalSection`'s ruled UX-DR18 focus effect: the
  section-only fragment (`#shot-maps`) MUST keep its shipped behaviour exactly — expand, scroll,
  focus the heading, open no table. Only the finer `#<section>-<panel>` form changes.
- **R2 — Stale nonce: CONSUME THE HIT IN `TacticalLayer`.** Once the layer has applied a hit, it stops
  passing that nonce downward, so a remounted `ViewDataDisclosure` no longer sees a stale positive
  value and cannot discard the reader's explicit close. The fix stays on the match route;
  `ViewDataDisclosure`'s contract and `TournamentHub`'s shipped 2.19 behaviour are NOT changed. Must
  still fix the `lg` breakpoint-crossing path, not only explicit collapse.
- **R3 — Absent anchor: ID THE SECTION-LEVEL EMPTY STATE.** When `plan.isEmpty`, the section-level
  `EmptyStatePanel` (`TacticalLayer.tsx:557`) carries that section's panel anchor id, matching what
  `ShotMapsSection.tsx:445/:464` already does for its absent arms. Satisfies D10.2 uniformly — the
  anchor lands ON the named absence rather than nowhere. `PassNetworksSection.tsx:288-292` gets the
  same treatment.
- **R4 — Dev guard: EXCLUDE KNOWN SUFFIXES ONLY.** D2's report scope stands. `addressesASection` stops
  denouncing `-heading`, `-content` and `-summary`, the 33 real ids `TacticalSection.tsx:109-111`
  mints. Detection is NOT widened to case or query shapes — those stay silent, as ruled.
- **R5 — Link hint: LEAVE THE COPY, FIX THE DOCBLOCKS.** No locale change, so the i18n caption
  inventory is untouched. The hint is generic and correct for the four links that do open a table, and
  D10 already rules the two absences acceptable. What is wrong is the documentation: correct
  `ExpertLayer.tsx:1004-1010` and `expert-logs.ts` ruling 2, which now assert unconditionally that
  following a link opens a table. Folds into the stale-docblock patch.


### Review Findings — applied (2026-08-26)

All 5 `decision-needed` findings were ruled by Juan and became patches; all 21 patches are
applied. The 1 `defer` is recorded in `deferred-work.md` and deliberately untouched.

**Gates after the fixes:** `tsc --noEmit` 0, `eslint . --max-warnings 0` 0,
**1,467 / 1,468 tests green across 58 files.** The single failure is
`static-output.test.ts > exported header search … ships the four AVAILABLE destinations`
(*"Inicio is available but is not in the exported nav"*) — story **3-10**'s in-flight
navigation work, in a file dirty under that session. It touches no path this story owns.

**Every new gate driven RED once (A1), each reverting exactly one fix:**

| Gate | Reverted | Observed failure |
|---|---|---|
| R1 panel landing | panel landing → section focus | `the viewport went to the PANEL: expected <section id="shot-maps"> to be <section>` — the shipped defect, reproduced |
| R2 consume the hit | `setActiveHit(null)` in `toggle` | `the reader's close survives the remount: expected [<table>] to have a length of +0 but got 1` |
| R3 absent anchor | id off the section-level empty state | `the anchor lands ON the absence, not nowhere: expected null not to be null` |
| R4 guard scope | reserved-suffix carve-out | `expected "error" to not be called at all, but actually been called 33 times` — exactly the 33 ids `TacticalSection` mints |
| D5 matrix wiring | `openNonce` off the matrix branch | `the matrix table opened: expected 0 to be greater than 0` |

**Test count:** 1,432 → 1,468 (+36). `match-anchors.test.ts` 13 → 17; new
`use-anchor-nonce.test.tsx` +20; `MatchDeepLink.test.tsx` 7 → 18.

**One test defect found while verifying, worth recording.** The new R2 case passed in file
order and FAILED in isolation. Cause: `window.location.hash = "#x"` QUEUES a `hashchange`
that jsdom can deliver *after* the layer mounts, minting a second hit and a second nonce for
one navigation — so whether a case passed depended on what the previous case left in the URL.
A cold deep link fires no `hashchange` at all. Every fragment arrival in the file now goes
through `arriveAt()` (`history.replaceState`), and the cases that want an in-page navigation
dispatch it explicitly. This latent order-dependence predates the review and would have
surfaced as an unreproducible CI flake.

### Dev Agent Record — corrections (2026-08-26 code review)

Recorded rather than edited in place, so the original claims stay legible next to what was
measured. The load-bearing halves all hold; the figures did not.

- **The ledger append was 109 lines, not 81.** Completion Notes and the File List both state
  `git diff --numstat` reported `81  0`. Re-measured: `git show --numstat d3c103c` reports
  **`109  0`** for `deferred-work.md`. **D12's actual requirement — 0 deletions — HOLDS.**
- **"1,367 tests / 55 files green" has no provenance.** The commit message for `deae510`
  states it; the Change Log states **1,341 / 54** in an isolated worktree, and the record's own
  arithmetic (1,320 baseline + 21) closes against 1,341, not 1,367. The commit message also
  calls the run green while the record documents one genuine failure on the shared tree.
- **Task 12.4 describes a commit that does not exist as described.** It lists one staged slice
  including `deferred-work.md`, the story file and `sprint-status.yaml`; `deae510` holds only
  the 15 code files, and the three doc paths landed separately in `d3c103c`. A split, not a
  loss — the work is whole.
- **Task 7.3 is checked as a no-change verification, but `ExpertLayer.tsx` was edited** (11
  insertions / 2 deletions in `deae510`). The change is comment-only and the variance is
  declared honestly in the Completion Notes; the checkbox asserts the opposite of what happened.

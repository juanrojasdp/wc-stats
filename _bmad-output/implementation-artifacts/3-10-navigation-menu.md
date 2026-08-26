# Story 3.10: Navigation Menu

Status: ready-for-dev

Epic: 3 — Post-Launch Reach — Discoverability, Landing & Navigation
Definition: `_bmad-output/planning-artifacts/epics.md:1382-1418`
Contract: **UX-DR24** (`epics.md:143`), delivered by story 3.7 at `fd5f130` + `87a9a39`
Baseline: `main` @ `2af1e0a` — **1,251 tests / 1,406 routes / 0 skipped**
Commit directly to `main` (solo repo; no feature branch, no PR).

---

## Story

As any visitor on any route,
I want a persistent way to reach the app's features,
so that I do not have to return to the home page or edit the URL to get anywhere (FR-40).

---

## ⚠️ READ THIS FIRST — WHAT THIS STORY IS, AND THE ONE THING THAT CAN STOP IT

**This story implements a contract that is already ruled. It does not re-rule it.** UX-DR24
(EXPERIENCE.md → Navigation, Deep-Link Fragment Grammar, Responsive; DESIGN.md → Components,
Layout & Spacing) settles the shape, the breakpoint, the modality, the keyboard model and the
accessible-name source. Where the contract and an older acceptance criterion disagree, **the
contract wins** — `87a9a39` already reconciled three of them. Do not reopen `lg`. Do not
re-derive the sheet's modality. Do not invent a second deep-link mechanism.

**The one thing that can stop this story is D0's blocking dependency, and it is real.** The
contract moves the header search *inside* the nav sheet. That means editing `HeaderSearch.tsx`
**and** `HeaderSearch.test.tsx` — and `HeaderSearch.test.tsx` is declared in story **3-5**'s file
list (`3-5-first-visit-locale-detection.md:321`, Task 7.2, "18 failures. Same pin inside the
existing…"). Under **A3** a story does not modify a file another session holds. **Task 1 checks
whether 3-5 has landed. If it has not, this story aborts at Task 1 and says so.** See D0.

**Three sessions, not two, are live in this tree.** The probe below found story 3-5 working
alongside 3-1 and 3-8 — `bootstrap.ts` and `bootstrap.test.ts` are modified on disk. The task
brief named only 3-1 and 3-8. The probe is the authority, not the brief.

**The sprint-status "stale lock" warning in the task brief is itself stale.** It was already
corrected on `main` at `2af1e0a` ("Sprint status: reconcile 3-6 and 3-7 against the repo"):
`3-6-authorship-signature` now reads `review` with its file lock explicitly released, and
`3-7-ux-contract-home-ia-navigation-menu` reads `done`. Verified below. **Nothing here is left
to re-litigate.**

---

## A3 File-Ownership Probe — RUN AT STORY CREATION, 2026-08-26

Re-run at Task 1; recorded here so the dev agent inherits the finding rather than rediscovering it.

### The 3-6 question, closed

```
$ git show --stat 92eec27
92eec27 Sign the project: an authorship caption in the header and the footer
$ git grep -c "chrome.signature" HEAD -- app/src/components/SiteHeader.tsx
HEAD:app/src/components/SiteHeader.tsx:2
$ git grep -l "chrome.signature" -- app/src
app/src/app/static-output.test.ts
app/src/components/AttributionFooter.tsx
app/src/components/SiteHeader.tsx
app/src/components/SiteSignature.test.tsx
app/src/lib/i18n.test.ts
```

**Story 3-6 shipped.** `SiteHeader.tsx` is committed, clean, and unheld. Its sprint-status entry
already says so (`sprint-status.yaml:3402-3409`: *"SHIPPED at 92eec27 … ITS FILE LOCK IS
RELEASED"*), and 3-7's already reads `done` (`:3410-3418`). **Both entries are current as of
`2af1e0a`. A future session should not re-open this.**

### Both known Epic 3 collision files

```
$ git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx
(no output — both clean)
```

### Every path this story will touch

```
$ git status --porcelain -- app/src/components/HeaderSearch.tsx \
    app/src/components/HeaderSearch.test.tsx app/src/app/globals.css \
    app/src/locales/es.ts app/src/locales/en.ts app/src/lib/reflow-guards.test.ts \
    app/src/components/CompareChartsSection.tsx app/src/app/static-output.test.ts
(no output — all clean)
```

### Who else is live

| Session | Holds (modified on disk) |
|---|---|
| **3-1** | `app/eslint.config.mjs`, `app/scripts/assert-no-external-origins.mjs`, `app/src/lib/assert-no-external-origins.test.ts`, `app/src/lib/site-origin.ts` (new), `site-origin.test.ts` (new) |
| **3-8** | `app/src/lib/match-anchors.ts` (new), `use-anchor-nonce.ts` (new), `MatchDeepLink.test.tsx` (new), `TacticalLayer.tsx`, `PitchPanel.tsx`, `TournamentHub.tsx`, the five section components, `expert-logs.ts`, `i18n.test.ts`, `ExpertLayer.tsx` |
| **3-5** ⚠️ | `app/src/lib/bootstrap.ts`, `app/src/lib/bootstrap.test.ts` — **not named in the task brief; found by the probe.** Its *declared* file list also claims `HeaderSearch.test.tsx`, `TournamentHub.test.tsx`, `SiteSignature.test.tsx` |

**Zero overlap with 3-1 and 3-8.** The overlap is with **3-5**, at `HeaderSearch.test.tsx` and
`SiteSignature.test.tsx` — both of which this story must modify. See D0.

**PATHS THIS STORY OWNS** (and stages — A4, never `git add -A`):

```
app/src/components/SiteNav.tsx                (NEW — trigger + sheet + inline links)
app/src/components/SiteNav.test.tsx           (NEW — the behavioural suite)
app/src/lib/nav-destinations.ts               (NEW — the ruled table)
app/src/lib/nav-destinations.test.ts          (NEW — the availability gate)
app/src/components/SiteHeader.tsx             (MODIFY)
app/src/components/HeaderSearch.tsx           (MODIFY)
app/src/components/HeaderSearch.test.tsx      (MODIFY — gated on D0)
app/src/components/SiteSignature.test.tsx     (MODIFY — gated on D0)
app/src/components/CompareChartsSection.tsx   (MODIFY — the token's other consumer)
app/src/app/globals.css                       (MODIFY — the header-height token)
app/src/locales/es.ts                         (MODIFY — the nav namespace)
app/src/locales/en.ts                         (MODIFY — the nav namespace)
app/src/lib/reflow-guards.test.ts             (MODIFY — re-pin the header guard)
app/src/app/static-output.test.ts             (MODIFY — exported-markup assertions)
_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md  (MODIFY — token values, only if measurement moves them)
_bmad-output/implementation-artifacts/deferred-work.md                      (MODIFY — close the header-height entry)
_bmad-output/implementation-artifacts/sprint-status.yaml                    (APPEND ONLY)
```

**Explicitly NOT this story's:** `app/src/app/page.tsx` (3-9's), any new route file, `bootstrap.ts`,
`i18n.test.ts`, `TournamentHub.tsx`, `match-anchors.ts`, `eslint.config.mjs`.

---

## Acceptance Criteria (from `epics.md:1388-1418`)

**AC 1 — the contract, implemented.**
**Given** the UX contract from story 3.7, including its explicit re-ruling of UX-DR4
**When** the nav is built
**Then** it matches that contract, and every feature named there is reachable from every route.
*Scoped by D1: "every feature named there" means every feature that has a route on `main`. The
four routes UX-DR24 mints are story 3.9's and are not created here.*

**AC 2 — one deep-link mechanism, not two.**
**Given** story 3.8's deep-link plumbing
**When** a nav entry points into a match-route section
**Then** it lands on the section **and opens it**, using the shipped nonce path rather than a
second mechanism.
*Resolved by D2: **no nav entry points into a match route.** The AC is satisfied by construction
and the story asserts that it stays so.*

**AC 3 — reflow, re-measured not inherited.**
**Given** Story 2.19's R2/D8 reflow guard and the 320 px floor
**When** the nav is added to the chrome
**Then** the guarded class string survives or **its change is ruled and re-pinned**, the document
does not scroll horizontally at **320 px** in either locale or theme, and Spanish text expansion
is handled per UX-DR17 rather than by truncation.

**AC 4 — designed against the header that exists, not the one that used to.**
**Given** story 3.6's measured outcome — the header already wraps to two rows below 354 px, going
57 → 118 px at 320 px
**When** the nav is sited
**Then** it is designed against a header that is already wrapping at the narrow end.
**And** hiding, truncating or wrapping the author's name is out of bounds (3.6's `Never` list).
**And** the R2/D8 matrix (320 / 390 / 195 px × dark/light × es/en) is **re-run** after the nav
lands, on the same basis 3.6 re-ran it.

**AC 5 — keyboard and screen reader.**
**Given** UX-DR15 and UX-DR16
**When** the nav is operated by keyboard and screen reader
**Then** targets are ≥44×44 px, Esc closes the topmost layer, focus is visible throughout with no
trap *(no unintended trap — the modal sheet's trap is required; see D4)*, all accessible names
come from locale keys in both dictionaries, and `prefers-reduced-motion` disables any transition.

**AC 6 — the A3 probe and 3.6's signature.**
**Given** A3 and the collision on `SiteHeader.tsx` with story 3.6
**When** this story edits the header
**Then** the ownership probe runs first, and story 3.6's signature is **preserved rather than
overwritten** — specifically, the caption stays a **sibling** of the wordmark link, never its child.

**AC 7 — epic close.**
**Given** the epic closes with this story
**When** it is done
**Then** an Epic 3 retrospective is run (A6), and the deferred-work ledger is walked so that
L1553/L1886 and L1465 are recorded as **adopted and closed**.

Plus **Epic 3 standing criteria A1–A6** (`epics.md:1074-1106`), which are not boilerplate:
- **A1/NFR-12** — every gate this story adds is **driven RED once**, with the command and failing
  output recorded in the Completion Notes.
- **A2** — tests pin by **relative path**, and are shown to fail when the wiring is reverted.
- **A3** — the probe above; abort rather than proceed over a held file.
- **A4** — stage only this story's paths.
- **A5** — the validation pass at the end of this file.
- **A6** — the retrospective.

---

## Ruled Decisions

### D0 — 🔴 BLOCKING: this story cannot start until story 3-5 lands

UX-DR24 puts the search **inside the nav sheet** below `xl`. Today `HeaderSearch` owns its own
`<md` trigger and its own Radix `Dialog` (`HeaderSearch.tsx:418-510`). Absorbing it means the
component loses that trigger and that dialog — and **~10 of the 34 tests in
`HeaderSearch.test.tsx` are written against them** (`:644`, `:706`, `:723-830`, all keyed on
`es.search.open`). Those tests must be rewritten, not appended to.

`HeaderSearch.test.tsx` is claimed by story **3-5** (`ready-for-dev`), whose Task 7.2 repairs 18
failures in it. `SiteSignature.test.tsx` is claimed the same way. A3's second clause is exact:

> if another session already holds a file this story must **modify** rather than append to, the
> story **aborts at that task** and says so, rather than proceeding.

**The rule for Task 1:**

```bash
git log --oneline -1 -- app/src/lib/bootstrap.ts        # 3-5 landed?
git status --porcelain -- app/src/components/HeaderSearch.test.tsx \
                          app/src/components/SiteSignature.test.tsx
```

- **3-5 committed AND both files clean** → proceed through the whole story.
- **Otherwise** → **abort at Task 1.** Record the finding in the Dev Agent Record, append a note
  to `sprint-status.yaml`, and stop. This is Story 2.18's precedent and it was the correct call.

**Do not attempt a partial landing that skips the search absorption.** A `<xl` header carrying
*both* a nav trigger and a search trigger is a fifth element in a row DESIGN.md's Don'ts column
forbids by name, and it forfeits the entire reason UX-DR24 chose this shape — that the trigger
**replaces** three controls rather than joining them.

### D1 — The destination table is data, and a destination without a route does not render

Nine destinations, **this order** (EXPERIENCE.md → Navigation, cross-checked against the
mockup's frames A and C and the ruled badge set at EXPERIENCE.md → The Landing Page):

| # | key | es | en | `href` | `route` | On `main` today |
|---|---|---|---|---|---|---|
| 1 | `home` | Inicio | Home | `/` | `/` | ✅ |
| 2 | `compare` | Comparar | Compare | `/compare` | `/compare` | ✅ |
| 3 | `tournament` | Torneo | Tournament | `/tournament` | `/tournament` | ❌ 3.9 |
| 4 | `matches` | Partidos | Matches | `/tournament#results` | `/tournament` | ❌ 3.9 |
| 5 | `tops` | Líderes | Leaders | `/tops` | `/tops` | ❌ 3.9 |
| 6 | `players` | Jugadores | Players | `/players` | `/players` | ❌ 3.9 |
| 7 | `teams` | Equipos | Teams | `/teams` | `/teams` | ❌ 3.9 |
| 8 | `glossary` | Glosario | Glossary | `/glossary` | `/glossary` | ✅ |
| 9 | `about` | Acerca de | About | `/about` | `/about` | ✅ |

**THE SCOPE BOUNDARY, RULED.** `/tournament`, `/tops`, `/players` and `/teams` **do not exist**.
Verified — `app/src/app` holds exactly `layout.tsx`, `not-found.tsx`, `page.tsx`, `about/`,
`compare/`, `glossary/`, `matches/[slug]/`, `players/[slug]/`, `teams/[slug]/`. **`/players` and
`/teams` have only dynamic segments — there is no index route, so both would 404.** That
index-vs-profile conflation is the trap: a directory-level check would report `players/` present
and mark *Jugadores* available. **This story does not create the four routes. They are story
3.9's, and they take the route count 1,406 → 1,410.**

**The ruling: `nav-destinations.ts` declares all nine entries in ruled order, each with an
explicit `available: boolean`. Only `available` entries render, in either presentation.** Today
that renders **four**: Inicio, Comparar, Glosario, Acerca de.

Why a declared flag rather than a filesystem probe at runtime: `SiteHeader` is a client component
pre-rendered into 1,406 HTML files. It has no filesystem. The flag is static data; **the gate
test is what binds it to reality** (D8). When 3.9 mints the four routes, the gate goes **red**
until 3.9 flips four booleans — and the nav completes itself with **no change to this story's
components**. That coupling is the point, and it is why the flag is not a hack.

**Why not simply ship the four links dead until 3.9?** Because a nav that 404s is worse than a
nav that is honest about its size, and because a dead link in the site chrome appears on **every
one of 1,406 routes**. **Why not defer 3.10 behind 3.9?** Because the epic orders them 3.9 then
3.10 only by number; the header work, the token, and the search absorption are all independent of
the landing refactor, and holding them gains nothing.

**Record this in the component's own comment**, in the house style, so the next reader is not
left inferring it.

### D2 — No nav entry points into a match route, and AC 2 is satisfied by construction

Scan the table: the only fragment is `#results`, and it hangs off `/tournament` — the Tournament
Hub, not a match route. Per **Deep-Link Fragment Grammar**, `#results` is a **surface fragment**
(`RESULTS_SURFACE_ID`, the `<h2>` over nine round sections): it **scrolls and opens nothing**,
deliberately, because opening it would expand all nine rounds and rebuild the DOM weight Story
2.19 moved behind disclosure.

**Therefore this story imports nothing from `match-anchors.ts` or `use-anchor-nonce.ts`, and adds
no `hashchange` handling of its own.** That is not an omission — it is AC 2's "one mechanism, not
two" holding. It also removes every file-level collision with story 3-8.

**Pin it.** `nav-destinations.test.ts` asserts no destination `href` matches `^/matches/` — so a
later editor who adds a match deep link to the nav is told, at that moment, that it must route
through 3.8's nonce path rather than through a bare `<Link>`.

### D3 — Which presentation renders is **CSS**, never a JS media query

Both presentations are in the markup on every route; `xl:hidden` hides the trigger at `≥xl`,
`hidden xl:flex` hides the inline links below it.

This is **Ruling 4**, already ship-tested in this tree and stated in place at
`HeaderSearch.tsx:338-341`: a JS breakpoint *choosing which markup to emit* would emit the narrow
form on the server — `SiteHeader` is pre-rendered into every HTML file — and hydrate wide. And
`hidden` is `display:none`, which removes the subtree from the **accessibility tree**, so exactly
one nav is exposed at any width and there are never two competing sets of links.

**Consequence, owned:** the nine names appear twice in each route's DOM. `HeaderSearch` already
does exactly this with `SearchField`. **So: no `id` on any nav link** — duplicated ids would be a
duplicate-id defect on 1,406 routes. `aria-current="page"` duplicating is harmless; an id is not.

### D4 — The sheet is **modal**, and geometry is not modality

Build it on the vendored `ui/dialog.tsx`, the same primitive Story 2.14's search sheet takes. That
gives, from Radix and **not re-derived here**: focus trap, `Esc`-to-close, focus-return-to-trigger,
`aria-modal`, and marking the rest of the document inert (`dialog.tsx:33-37`). The inerting stamps
`aria-hidden` on every body sibling of the portal, `<header>` included (`HeaderSearch.tsx:388`).

`DialogOverlay` supplies the scrim (`fixed inset-0 z-50 bg-surface-base/80`) and
`DialogContent`'s geometry is **already** the ruled one — `fixed inset-x-0 top-0 z-50 … max-h-dvh
overflow-y-auto`, full-width and top-anchored with content-driven height. **`ui/dialog.tsx` needs
no change.** Cap the width with `max-w-[386px]` at the call site (the ruled figure, mockup frame A);
do not edit the primitive for one consumer.

A sheet that leaves the page behind it operable while looking dismissible is a 2.1.2 / 2.4.3
defect; a sheet that inerts without a scrim looks broken. **Both halves come free here. Do not
hand-roll either.**

### D5 — Not a `role="menu"`

These are links to pages, not commands. `role="menu"` would impose arrow-key-only navigation and
break the reading-order tab model UX-DR15 rules. **The sheet is a labelled region containing a
`<nav>` landmark and a `<ul>` of links.** Inline links at `≥xl` are plain tab stops in reading
order — no roving tabindex, no menu semantics.

Radix requires a `DialogTitle` or the panel is an unnamed `role="dialog"` (axe `aria-dialog-name`
+ a console error, which breaches the zero-console bar on its own). Render it `asChild` into an
`sr-only` `<span>` so it stays out of the heading outline — `popover.tsx` and `HeaderSearch.tsx:468`
both record this reason. Set `aria-describedby={undefined}` explicitly: Radix warns on every open
otherwise, and the sheet has no description to give.

### D6 — `aria-controls` is **conditional**, because the sheet is portalled

```tsx
aria-controls={sheetOpen ? sheetId : undefined}
```

The sheet is portalled to `document.body` and **absent from the DOM while closed**, so an
unconditional attribute is a dangling IDREF and an axe `aria-valid-attr-value` failure **on the
site header of every one of 1,406 routes**. This is the shipped house form, used at four of the
seven `aria-controls` sites in `HeaderSearch.tsx` (`:1000`) for exactly this reason.

The trigger is a real `<button>` with `aria-expanded`. **Its accessible name is stable across open
and closed** — `aria-expanded` carries the state, as the shipped theme toggle already does with
`aria-pressed`. Do not swap "Abrir menú" / "Cerrar menú".

### D7 — Close the sheet at `xl`; **CSS cannot do it**

`DialogContent` portals to `document.body`, so it sits outside every ancestor `SiteNav` can style
— including the `xl:hidden` wrapper around the trigger. Drag a window wider with the sheet open
and the result is a modal overlay covering the desktop layout whose trigger is no longer rendered:
unreachable except by `Esc`.

Mirror `HeaderSearch.tsx:344-358` exactly, changing only the query to `(min-width: 80rem)`
(Tailwind `xl`), and keep its comment's distinction: **this is not the `useMediaQuery` branch
Ruling 4 bars.** Nothing here renders anything — it is a one-way dismissal of an already-open
overlay, it runs only in an effect, and its server output is identical either way. Guard
`typeof window.matchMedia !== "function"` as that code does.

### D8 — The availability gate (A1: it must be able to go RED)

`nav-destinations.test.ts` reads the route tree **by relative path** (A2) and asserts a
**bijection in both directions**:

1. Every destination with `available: true` has a matching `page.tsx` under `app/src/app`.
2. Every destination with `available: false` has **no** such file — so a route that appears
   without its flag being flipped fails here rather than sitting unlinked.

Resolution: `href` → `route` (strip the `#…`), `route` → `src/app{route}/page.tsx`, with `/` →
`src/app/page.tsx`. Reject any `route` containing a dynamic segment (`[`) — `/players` the index
and `/players/[slug]` the profile are different things, and a naive glob would conflate them. That
conflation is precisely how "Jugadores" could silently point at a 404.

**This gate is the story's A1 obligation and it is genuinely fallible.** Drive it red twice —
once by flipping `tournament.available` to `true` with no route, once by flipping
`glossary.available` to `false` while `/glossary` exists — and record both outputs.

### D9 — The header-height token, and **the numbers in DESIGN.md are pre-nav**

DESIGN.md ships `header-h-oneline: 62px`, `header-h-wrapped: 118px`, `header-h-zoom: 124px`,
`scroll-clearance: 16px`. **Those are story 3.6's measurements of a header that had four elements
in its row.** This story replaces three of them with one trigger below `xl`, which is the whole
width argument: min-content falls *below* the 237 px R2/D8 figure.

**So the wrap thresholds move, and they move in the project's favour.** Arithmetic, to be
**measured not trusted**: identity block 127 px (es) + `gap-tile-gap` 12 + trigger 44 + two
`px-gutter-mobile` 32 ≈ **215 px** — under 320. **The `<xl` header may stop wrapping at 320
entirely**, which would make `header-h-wrapped` apply only at the 195 px zoom width.

> **Re-measure and re-derive the token values. Do not copy DESIGN.md's numbers forward.** The
> contract says so itself: *"Any change to the header's composition changes this token."* If the
> measurement moves them, **update DESIGN.md's `spacing:` block and the prose at `DESIGN.md:344`
> in this same change-set** — a token file that disagrees with the shipped CSS is the defect this
> ruling exists to end.

**Shape** (Tailwind v4; `globals.css` uses `@theme inline` at `:226`, spacing tokens are
`--spacing-*` at `:302-306`):

- Add `--spacing-header-h-oneline`, `--spacing-header-h-wrapped`, `--spacing-header-h-zoom`,
  `--spacing-scroll-clearance` to `@theme inline`.
- Declare **one** `--header-h` on `html` in `@layer base`, switched by breakpoint media queries.
- `scroll-padding-top: calc(var(--header-h) + var(--spacing-scroll-clearance))` — **replacing the
  `4.5rem` constant at `globals.css:458`**, and replacing its ⚠️ comment block (`:437-457`) with
  the measurements this story takes.

**Locale axis:** the ledger's proposed fix suggests keying on `html.locale-es` / `.locale-en`,
which **do exist** (`bootstrap.ts:64-69`, `localeClass()`; applied by the pre-paint script at
`:127-128` and by `i18n-provider.tsx:54-66`). UX-DR24's ruled token set has **no locale axis**.
**Ship the three ruled values.** Add the locale axis only if measurement shows the two locales
land on different token *values* — not merely different thresholds — and record the decision
either way.

**The token's other consumer, in scope.** `CompareChartsSection.tsx` hardcodes the 56 px bar in
three places: `sticky top-14` (`:221`), `max-md:scroll-mt-28` (`:265`), and
`rootMargin: "-104px …"` (`:371`). The contract is explicit — *"consumed by `scroll-padding-top`
**and** by every sticky offset that mirrors it. Nothing hardcodes the height again."* Convert all
three; read the rootMargin from `getComputedStyle` rather than a literal. The file is clean and
unheld. **This closes the `deferred-work.md` entry at `:4455-4456` (`source_spec:
spec-sign-the-project.md`), which names this exact fix and says it was deliberately deferred
because it "needs its own verification pass". This story is that pass.**

### D10 — The signature survives, and so does the reflow guard's *reason*

`SiteHeader.tsx:162-167` is the identity block: a `<div className="flex min-w-0 flex-col">`
holding the wordmark `<Link>` and, as its **sibling**, `<span>{t("chrome.signature")}</span>`.

**Never move the `<span>` inside the anchor.** It would join the accessible name, so the first
focusable element on 1,406 routes would announce *"WC Stats Por Juan Camilo Rojas, link"*, and
narrowing that back with `aria-label` fails **WCAG 2.5.3 (Label in Name)**. The `<Link>` keeps
`min-h-11`. No `lang` mark on the name (3.1.2 proper-name exemption).

`reflow-guards.test.ts` pins **two** needles in this file (`:70` and `:88`):

- `"flex min-w-0 flex-col"` — the identity block. **Must survive unchanged.**
- `"flex min-h-14 max-w-6xl flex-wrap items-center"` — the header row. **This one changes**
  (`justify-between` or an inserted `xl:` variant is likely). AC 3 allows the change *if it is
  ruled and re-pinned*: update the needle, **rewrite `because:` with this story's own
  measurements**, and keep `flex-wrap` + `min-h-14` — Story 2.19 R2/D8 is not negotiable and every
  target holds 44 px (`MIN_HIT_PX`) through the wrap.

Do not delete either guard case. The file's own failure message says it: *"Do not simply delete
the case."*

### D11 — Trigger styling: `flex`, **not** `grid`

The mockup draws the trigger as `display:grid; place-items:center; width:44px; height:44px`.
**Do not translate that literally.** `reflow-guards.test.ts:186-247` runs a repo-wide scan that
fails any `className` containing `grid` without `grid-cols-*`, exempting only boxes with **both**
a fixed `h-` and a fixed `w-`. `min-h-11 min-w-11` are not fixed sizes, so
`grid min-h-11 min-w-11 place-items-center` is an **offender** and the suite goes red.

Copy the shipped trigger form instead — `HeaderSearch.tsx:445-448`:

```
flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-secondary
```

Quiet chrome: unfilled, matching the theme toggle's weight, **never accent-filled** (DESIGN.md →
Components, nav-menu; and the Don'ts row *"Gradients, glows, or accent-colored chrome competing
with data"*).

### D12 — Current route, and where it comes from

`aria-current="page"` in **both** presentations, marked visually by something other than colour
alone (1.4.1):

- **Sheet:** a `{colors.accent-lime}` leading marker **plus a weight change** (`font-semibold`).
- **Inline:** underlined rather than marked (`underline underline-offset-[5px]`), same type and
  colour.

The route comes from `usePathname()` (`next/navigation`). **There is no `usePathname` anywhere in
this tree today** — this story introduces the first use, so no house pattern is being ignored.
`SiteHeader` is already `"use client"`. Compare against the destination's `route`, not its `href`
(entry 4 carries a fragment). Exact match only — `/players/ramirez-julian-mex` must not mark
*Jugadores* as the current page, and once 3.9 mints `/players` it must not mark it either; a
profile is not its index.

### D13 — `prefers-reduced-motion` is already handled globally; do not re-implement

`globals.css:474-486` kills every animation and transition under
`@media (prefers-reduced-motion: reduce)`, product-wide. Motion here is decorative-only, so the
sheet opens and closes instantly and **nothing is lost** (UX-DR16). **Add no component-level
`motion-reduce:` variants and no JS media query.** Assert the global rule still covers the sheet;
do not duplicate it.

### D14 — Locale keys, both dictionaries

Mint a `nav` namespace in `es.ts` and `en.ts`. Nothing bare-literal — every accessible name is a
locale key (FR-30, UX-DR16), and `DictionaryKey` is a compile-time dot-path over the `es` shape
(`i18n.ts:15-19`), so a missing `en` leaf is a **type error**, not a runtime surprise.

```
nav.trigger        Menú                      / Menu                  (stable across open+closed — D6)
nav.close          Cerrar el menú            / Close the menu
nav.sheetTitle     Navegación del sitio      / Site navigation       (must NOT merely repeat the trigger — es.ts:2422-2426's precedent)
nav.landmark       Principal                 / Main                  (the <nav aria-label>)
nav.destinations.home / .compare / .tournament / .matches / .tops / .players / .teams / .glossary / .about
```

Spanish is the source of truth; English is the variant. `es` values come from the ruled badge set
(EXPERIENCE.md → The Landing Page) and the mockup, verbatim: Inicio, Comparar, Torneo, Partidos,
Líderes, Jugadores, Equipos, Glosario, Acerca de.

Duplicate *values* across the dictionary are allowed — the only inventory enforcement is the
caption inventory. Do not chase a phantom global uniqueness rule.

### D15 — What this story does **NOT** do

- **Does not create** `/tournament`, `/tops`, `/players`, `/teams` (3.9). Route count stays **1,406**.
- **Does not touch** `app/src/app/page.tsx` — the landing refactor is 3.9's.
- **Does not revisit `lg`.** Measured and rejected: 976 px usable against ~1,060–1,080 px needed,
  failing *invisibly* because the header search ships `min-w-0 flex-1`, so the input silently
  collapses rather than the row overflowing. **`xl` clears by ~150 px.** ⚠️ The mockup's frame-C
  note still says *"El umbral en línea está fijado en `lg` (1024 px)"* — **that note is stale;
  the spine supersedes it** ("Mocks illustrate, spines win on conflict"). Use `xl`.
- **Does not implement the overflow-trigger fallback** (mockup: *Glosario* and *Acerca de* drop
  first). That fallback was written against the `lg` threshold. At `xl` the margin is ~150 px and
  four of nine links render today. If the `≥xl` measurement in Task 9 shows it does not fit,
  **stop and file it** rather than improvising.
- **Does not restore language and theme to one tap on phones.** Two taps is **the stated,
  accepted price** of the re-ruling. Do not "fix" it.
- **Does not change** `ui/dialog.tsx` (D4).
- **Does not add a runtime dependency.** `radix-ui@1.6.5` is installed and Dialog is vendored.

---

## Tasks / Subtasks

### Task 1 — A3 ownership probe (BLOCKING — D0)

- [x] 1.1 `git status --porcelain` — record every path held by another session.
- [x] 1.2 `git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx` — both
      Epic 3 collision files. Expect clean.
- [x] 1.3 `git show --stat 92eec27` and `git grep -c "chrome.signature" HEAD -- app/src/components/SiteHeader.tsx`
      (expect `2`). Record that 3-6 shipped and its lock is released.
- [ ] 1.4 **The D0 gate.** `git log --oneline -1 -- app/src/lib/bootstrap.ts`; `git status --porcelain
      -- app/src/components/HeaderSearch.test.tsx app/src/components/SiteSignature.test.tsx`.
      **If 3-5 has not landed, or either file is dirty → ABORT HERE.** Write the finding into the
      Dev Agent Record, append a note to `sprint-status.yaml`, stop.
      🔴 **RAN 2026-08-26 AT `2c8bb1a` — RED ON BOTH CLAUSES. STORY ABORTED HERE.** Left unchecked
      on purpose: the gate did not pass, and the next session must re-run it rather than trust this
      result. See Dev Agent Record → Debug Log References.
- [x] 1.5 Record the owned-paths list (see the probe section) in the Dev Agent Record.

### Task 2 — `lib/nav-destinations.ts`, the ruled table (AC 1, D1)

- [ ] 2.1 Export `NAV_DESTINATIONS`: nine entries in D1's order, each `{ key, labelKey, href,
      route, available }`. `labelKey` typed as `DictionaryKey`.
- [ ] 2.2 Set `available: true` for `home`, `compare`, `glossary`, `about`; `false` for the other
      five. **Four render today.**
- [ ] 2.3 Comment, in house style: why the flag exists, that 3.9 flips four booleans and the nav
      completes itself with no component change, and that the gate in `nav-destinations.test.ts`
      is what binds the flag to reality.
- [ ] 2.4 Pure data + types only. No React, no DOM, no `next/*` import — it must be testable in
      the `node` environment without a jsdom pragma.

### Task 3 — `components/SiteNav.tsx` (AC 1, AC 5, D3–D7, D11, D12)

- [ ] 3.1 `"use client"`. Export `SiteNav`. `useT()`, `useLocale()`, `useTheme()`, `usePathname()`.
- [ ] 3.2 **Inline presentation** — `hidden xl:flex`: a `<nav aria-label={t("nav.landmark")}>`
      over a `<ul>` of available destinations. `aria-current="page"` + underline on the current
      route. `min-h-11` per link, `whitespace-nowrap`. **No `id` on any link** (D3).
- [ ] 3.3 **Trigger** — `xl:hidden`, a real `<button>`, D11's class string, `aria-expanded`,
      `aria-controls={sheetOpen ? sheetId : undefined}` (D6), `aria-label={t("nav.trigger")}`
      stable across states. `const sheetId = useId()`.
- [ ] 3.4 **Sheet** — `Dialog`/`DialogContent` with `max-w-[386px]`, `aria-describedby={undefined}`,
      `DialogTitle asChild` into an `sr-only` span (D5).
- [ ] 3.5 Sheet body, in the mockup's order: the search field at the top beside a `DialogClose`
      (`nav.close`); then the `<nav>` + `<ul>` of destinations, hairline-ruled, lime marker +
      `font-semibold` on the current route; then, **below a `border-t border-hairline`**, the
      `ES|EN` `ToggleGroup` and the theme `Toggle` — moved out of `SiteHeader` verbatim, same
      classes, same `aria-label`s, same `aria-pressed` semantics.
- [ ] 3.6 Register with the overlay registry: `registerOverlayCloser` in an effect,
      `closeOtherOverlays(closeSheet.current)` on open — the pattern at `HeaderSearch.tsx:314-322`
      and `:420-425`. Opening the nav must close any glossary popover, and vice versa.
- [ ] 3.7 **D7's `xl` sync effect**, mirroring `HeaderSearch.tsx:344-358` with
      `(min-width: 80rem)`. Carry its comment across, including "this is not the `useMediaQuery`
      branch Ruling 4 bars".
- [ ] 3.8 Every target ≥44 px: `min-h-11 min-w-11` on the trigger and the close button,
      `min-h-11` on every link and every control in the footer row.

### Task 4 — `HeaderSearch.tsx`: `md` → `xl`, and the sheet is absorbed (D0)

- [ ] 4.1 Inline combobox: `hidden min-w-0 md:flex` → `hidden min-w-0 xl:flex`.
- [ ] 4.2 **Delete** the `<md` `Dialog` block (`:418-510`) — trigger, `DialogContent`, `DialogClose`.
      The nav sheet is now the only `<xl` host.
- [ ] 4.3 Export a `SearchField` host the nav sheet mounts: pass `autoFocus`? — **no.** Focus
      belongs to the sheet's first focusable element per UX-DR15, and the search input is it by
      DOM order, so Radix's own initial focus lands correctly without an `autoFocus` fight. Keep
      `dismissClosesHost` **true** — one `Esc` closes the whole sheet, listbox included (ruling 3).
- [ ] 4.4 **The two live regions.** `HeaderSearch` mounts a desktop `aria-live` region gated on
      `sheetOpen ? null : …` because the sheet inerts the header. That gate now belongs to the
      **nav** sheet's open state. Lift it: the sheet carries its own region inside the portal
      (mounted **empty**, populated later — "a live region that mounts already-populated does not
      announce reliably"), and the header's is suppressed while the sheet is open. **The two must
      never both be live.**
- [ ] 4.5 Keep `data-slot="header-search-slot"` and `min-w-0 flex-1` on the root
      (`static-output.test.ts:845-846` asserts both). Keep the "NO `aria-hidden` HERE" comment.
- [ ] 4.6 Reset `announcement` and clear `announceTimer` on both edges of the nav sheet's open
      state, for the reason `HeaderSearch.tsx:427-440` records.

### Task 5 — `SiteHeader.tsx` (AC 3, AC 6, D10)

- [ ] 5.1 **Do not touch the identity block** (`:162-167`). Caption stays a sibling. Its
      `reflow-guards` needle `"flex min-w-0 flex-col"` must still match byte-for-byte.
- [ ] 5.2 Move the `ToggleGroup` (`:182-209`) and the `Toggle` (`:216-223`) — and `SunIcon` /
      `MoonIcon` — into `SiteNav`, so at `<xl` they live in the sheet and at `≥xl` they render
      inline from `SiteNav`. **One definition, not two.**
- [ ] 5.3 Row becomes: identity block → `<SiteNav />` (which renders inline links + search +
      toggles at `≥xl`, and the trigger at `<xl`) → `<HeaderSearch />` in its `≥xl` slot. Settle
      the composition so DOM order equals visual order equals reading order at both widths, and
      state the order in the comment as the current one does.
- [ ] 5.4 Keep `flex-wrap` + `min-h-14` and `sticky top-0 z-40`. Rewrite the row comment's
      measurement block with **this story's** numbers from Task 9 — the current text describes a
      four-element row and will be false.
- [ ] 5.5 Update the file header comment: "No primary nav" is superseded by UX-DR24. Cite it.

### Task 6 — The header-height token (D9)

- [ ] 6.1 Add the four `--spacing-*` tokens to `@theme inline` (`globals.css:226+`, beside
      `:302-306`).
- [ ] 6.2 Declare `--header-h` once on `html` in `@layer base`, switched by breakpoint.
- [ ] 6.3 Replace `scroll-padding-top: 4.5rem` (`:458`) with
      `calc(var(--header-h) + var(--spacing-scroll-clearance))`. Replace the ⚠️ comment
      (`:437-457`) with the new measurements — it currently says the fix has *not* happened.
- [ ] 6.4 `CompareChartsSection.tsx`: convert `sticky top-14` (`:221`), `max-md:scroll-mt-28`
      (`:265`) and `rootMargin: "-104px …"` (`:371`) to the token; read the rootMargin via
      `getComputedStyle`. Update the ruling comment at `:185-243`, which states 56 px as fact.
- [ ] 6.5 Grep for survivors: `grep -rn "4.5rem\|top-14\|scroll-mt-28\|-104px" app/src`. Several
      are *comments* referencing the old constant (`ExpertLayer.tsx:984`, `HubTable.tsx:43`,
      `LeaderboardsSection.tsx:85`, `TournamentHub.tsx:847`) — **`ExpertLayer.tsx` and
      `TournamentHub.tsx` are held by story 3-8. Leave them. File a one-line ledger note instead;
      they are prose, not behaviour.**
- [ ] 6.6 If measurement moved the values, update `DESIGN.md`'s `spacing:` block (`:158-161`) and
      the prose at `:344` in this change-set.

### Task 7 — Locale keys, both dictionaries (AC 5, D14)

- [ ] 7.1 `nav` namespace in `es.ts` per D14, with a comment recording that the destination set is
      the ruled badge set + Inicio, and that `available` gates rendering.
- [ ] 7.2 The mirrored namespace in `en.ts`. `npm run typecheck` catches any missing leaf.
- [ ] 7.3 Keep `search.open` / `search.close` / `search.sheetTitle` **only if still reached.**
      Task 4.2 deletes the search's own trigger, so `search.open` and `search.sheetTitle` may
      become unreachable — and a dead key is the pattern AC 1's BINDING prohibits. **Verify by
      grep before deleting**, and if deleted, say so in the Completion Notes.

### Task 8 — Tests (AC 1–AC 6; A1, A2)

- [ ] 8.1 `lib/nav-destinations.test.ts` — **D8's bijection, both directions**, pinned by relative
      path from `process.cwd()/src`, rejecting dynamic segments. Plus: nine entries, ruled order,
      no `href` matching `^/matches/` (D2), every `labelKey` resolves in **both** dictionaries.
- [ ] 8.2 `components/SiteNav.test.tsx` — `// @vitest-environment jsdom`, explicit `cleanup()`
      (RTL auto-cleanup does **not** run without `globals: true` — `HeaderSearch.test.tsx:33-40`),
      and the never-settling `fetch` stub from `SiteSignature.test.tsx:47-52`. Cover, in **both**
      locales:
  - trigger has `aria-expanded="false"` and **no** `aria-controls` while closed (D6);
    `aria-controls` appears, and matches the sheet's id, once open;
  - the sheet is `role="dialog"` with an accessible name;
  - `Esc` closes and **returns focus to the trigger**;
  - the sheet contains a `<nav>` landmark and a list of links — **not** `role="menu"` (D5);
  - only `available` destinations render, and they render in ruled order (D1);
  - `aria-current="page"` lands on exactly one link, and a profile route (`/players/x`) marks
    **none** (D12);
  - the language and theme controls are inside the sheet and still work;
  - **every** interactive element carries `min-h-11` / `min-w-11`.
- [ ] 8.3 `HeaderSearch.test.tsx` — rewrite the ~10 sheet-keyed cases (`:644`, `:706`,
      `:723-830`) against the nav sheet as host. **Preserve every behaviour they assert**: one
      `Esc` closes the whole sheet, the listbox does not close the sheet around it, the overlay
      registry fires, the sheet's input is the first combobox, the same highlight model. These are
      shipped guarantees; the host changed, the contract did not.
- [ ] 8.4 `SiteSignature.test.tsx` — the sibling assertions must still pass. Extend for the new
      composition; **do not weaken**.
- [ ] 8.5 `reflow-guards.test.ts` — re-pin the header-row needle with this story's measurements
      (D10). Leave the identity-block needle untouched. Add a needle for the trigger's 44 px if
      the measurement makes it load-bearing.
- [ ] 8.6 `static-output.test.ts` — the exported markup on all five built routes still matches
      `>{siteName}</a><span…>{signature}</span>` (`:128`), still carries
      `data-slot="header-search-slot"` with `min-w-0` (`:845-846`), and still emits **no
      `<section>`** from the header (`:849-868`) — the nav's `<nav>`/`<ul>` must not become one.
      Add: the four available destinations appear in the exported header; the five unavailable
      ones **do not** (D1, and it is the only place the pre-3.9 ruling is visible in shipped HTML).

### Task 9 — Measurement (AC 3, AC 4) — **measured, never inferred**

Per the memory notes: the bundle cache does not refresh on hard reload (override `fetch` with
`no-store`); the browser viewport cannot be resized (use an iframe at true layout widths);
verify in an **isolated worktree on a private port** if the shared tree is left non-compiling by
another session (A3).

- [ ] 9.1 `npm run build` + serve the export host-realistically. Not `python -m http.server`.
- [ ] 9.2 **Re-run the R2/D8 matrix**: 320 / 390 / 195 px × dark/light × es/en × the built routes.
      Record `document.scrollWidth` per cell. **Bar: zero horizontal overflow, every cell.**
- [ ] 9.3 Measure header height at each matrix width, both locales → the three token values.
      **Record whether `<xl` still wraps at 320.** D9 predicts ~215 px min-content; if it no
      longer wraps, say so and re-tune `--header-h`'s breakpoints accordingly.
- [ ] 9.4 1 px sweep per locale for the new wrap threshold. 3.6's 341/337 are pre-nav and will
      move.
- [ ] 9.5 **`≥xl` inline fit**: at 1280 px, both locales, both themes — nine labels' worth of
      inline links (measure with all nine forced on, not just the four that render) + identity +
      search + `ES|EN` + theme. Confirm the search input has **not** silently collapsed:
      `getBoundingClientRect().width` on the input, not a screenshot. **This is the failure mode
      that rejected `lg`, and a screenshot cannot see it.**
- [ ] 9.6 Verify anchored headings clear the sticky bar at every matrix width — the 46 px overlap
      `globals.css:446` records must be **gone**, at one row and wrapped.
- [ ] 9.7 `/compare` mini-header visible at 320 px in both locales (the D9/ledger defect).
- [ ] 9.8 Keyboard walk, `<xl` and `≥xl`: Tab order = DOM order = visual order; trigger opens on
      Enter **and** Space; focus trapped in the sheet; `Esc` returns focus to the trigger; focus
      visible throughout.
- [ ] 9.9 axe on a representative route at both widths, sheet open and closed. **Zero violations,
      zero console output.** Specifically watch `aria-valid-attr-value` (D6) and
      `aria-dialog-name` (D5).
- [ ] 9.10 `prefers-reduced-motion: reduce` — sheet opens and closes instantly (D13).

### Task 10 — A1: drive every gate RED once

- [ ] 10.1 D8 gate, direction 1: flip `tournament.available` → `true` with no route. Record the
      failing output. Revert.
- [ ] 10.2 D8 gate, direction 2: flip `glossary.available` → `false` while `/glossary` exists.
      Record. Revert.
- [ ] 10.3 D2 pin: add a `/matches/x#momentum` destination. Record. Revert.
- [ ] 10.4 Re-pinned reflow guard: remove `flex-wrap` from the header row. Record. Revert.
- [ ] 10.5 A2 proof for `SiteNav.test.tsx`: make `aria-controls` unconditional and confirm the
      test goes red — the assertion must fail when the wiring is reverted, not merely pass today.
- [ ] 10.6 Paste every command and its failing output into the Completion Notes. **A1 is not
      satisfied by asserting that a gate could fail.**

### Task 11 — Ledger and epic close (AC 7)

- [ ] 11.1 `deferred-work.md`: mark the `spec-sign-the-project.md` header-height entry
      (`:4455-4456`) **DONE**, citing this story and the Task 9 measurements.
- [ ] 11.2 Confirm **L1553 / L1886** are recorded closed by story 3-8 (its Task 11). If 3-8 has
      landed and did not, record it here — AC 7 says these are not to be left silently open.
- [ ] 11.3 Confirm **L1465** is recorded adopted by story 3-7's contract (EXPERIENCE.md → *The
      Expert table at 390 px — ledger L1465, ruled*). Mark it closed.
- [ ] 11.4 **L2945** (full-width vs full-screen sheet) is already `DONE` (`:4147`) — verify this
      story's sheet honours it (386 px, `top: 0`, content-driven height, **not** full-screen).
- [ ] 11.5 Append to `sprint-status.yaml` — **append only, never regenerate**. Flip
      `3-10-navigation-menu` to `review`. Record: the D0 dependency and how it resolved, that
      route count stays **1,406**, and that 3.9 flips four `available` flags to complete the nav.
- [ ] 11.6 **A6** — run the Epic 3 retrospective. It is `required`, not `optional`: Epic 1's sat
      at `optional`, was skipped, and Epic 2 paid for it.

### Task 12 — Gates and commit

- [ ] 12.1 `npm run lint` (`--max-warnings 0`), `npm run typecheck`, `npm test`.
- [ ] 12.2 **Test count must rise from 1,251 and skipped must stay 0.** Report the delta.
- [ ] 12.3 `npm run build` — includes `assert:schema-version` and `assert:no-external-origins`.
      ⚠️ Story **3-1** is repairing `assert-no-external-origins.mjs` in the working tree; if the
      build reds *there*, it is 3-1's, not this story's. Say which.
- [ ] 12.4 **Route count is 1,406.** If it is not, a route was created and D15 was broken.
- [ ] 12.5 **A4:** `git add` each owned path **by name**. Never `git add -A`. Three other sessions
      have uncommitted work in this tree.
- [ ] 12.6 Commit to `main` (memory: `gh auth switch -u juanrojasdp` before pushing, or a 403).

---

## Dev Notes

### Files being modified — current state, what changes, what must survive

| File | Current state | This story changes | Must survive |
|---|---|---|---|
| `SiteHeader.tsx` (228 L) | Skip link + sticky `flex-wrap min-h-14` row: identity block → `HeaderSearch` → `ToggleGroup` → `Toggle`. Carries 3.6's full measurement comment. | Toggles move to `SiteNav`; `SiteNav` joins the row; comment re-measured. | The identity block **verbatim** (D10); `flex-wrap` + `min-h-14`; `sticky top-0 z-40`; the skip link as first focusable; **no `aria-hidden`** on the search slot. |
| `HeaderSearch.tsx` (1,338 L) | Inline combobox `≥md`; own `Dialog` sheet `<md`; two live regions; overlay registry; `md` close-sync. | `md` → `xl`; own sheet deleted; live-region gate re-keyed to the nav sheet. | `data-slot="header-search-slot"` + `min-w-0 flex-1`; the single-`Esc` ruling; `dismissClosesHost`; the conditional-`aria-controls` form; the "no `aria-hidden`" comment. |
| `ui/dialog.tsx` (140 L) | Vendored Radix. `DialogOverlay` scrim `z-50`; `DialogContent` `fixed inset-x-0 top-0 max-h-dvh overflow-y-auto`. | **Nothing.** | Everything. Cap width at the call site. |
| `globals.css` | `scroll-padding-top: 4.5rem` (`:458`) + a ⚠️ comment saying it is wrong by 46 px. `@theme inline` at `:226`; `--spacing-*` at `:302-306`; global reduced-motion kill at `:474`. | Four tokens + one `--header-h`; `scroll-padding-top` derived; comment rewritten. | The reduced-motion block; the `@theme inline` shape; `--spacing-*` naming. |
| `CompareChartsSection.tsx` | Three hardcoded 56 px offsets. Comment states 56 px as fact. | All three → the token; rootMargin via `getComputedStyle`. | `md:hidden` visibility-is-CSS ruling; the `useMediaQuery`-permitted-here reasoning; polite announcement, focus never moved. |
| `reflow-guards.test.ts` (249 L) | Six pinned needles + a repo-wide implicit-grid scan. | Header-row needle re-pinned with new `because:`. | The identity-block needle; the grid scan (**and D11 keeps the trigger out of it**); every other owner's case. |

### The width arithmetic, stated once

Story 2.19 measured the header's min-content at **237 CSS px**. Story 3.6's caption widened the
identity block 76 → 127 px, moving the wrap threshold to **354 px** — so the header already wraps
on every phone, 57 → 118 px at 320 px. **A fifth element would push that to ~406 px** and widen
the band over which the `scroll-padding-top` shortfall applies.

Absorbing the chrome inverts it. Below `xl` the row is **wordmark + one 44 px trigger**, whose
min-content is *below* 237. **The 320 px row gets easier, not harder.** That inversion is the
entire reason this shape was chosen, and it is why "just add a hamburger next to the existing
controls" is not a smaller version of this story — it is the opposite of it.

At `≥xl`: nine Spanish destinations alongside identity + search + `ES|EN` + theme ≈ **1,060–1,080
px**. Usable measure is viewport minus two 24 px gutters: **976 px at `lg`**, **1,232 px at `xl`**.
`lg` fails, and fails invisibly. `xl` clears by ~150 px — the margin Spanish expansion needs.

### The price, stated because the re-ruling requires it

On phones, **language and theme move from one tap to two**. That is the cost, paid to hold the
320 px floor and 3.6's signature simultaneously. Search is unaffected in kind — it was already a
trigger below `md`; it now shares a trigger rather than owning one. **Ruled and accepted. Do not
optimise it away.**

### Testing standards

- Vitest. Global environment is `node`; jsdom is **per-file** via `// @vitest-environment jsdom`.
- RTL auto-cleanup does **not** run (no `globals: true`) — call `cleanup()` in `afterEach`.
- `t` from `@/lib/i18n` is **barred inside `src/components/**`** (ESLint client-import seam, Story
  2.2 Task 4). Tests import expected strings from `@/locales/es` / `@/locales/en` directly;
  components use `useT()`.
- `SiteHeader` mounts `HeaderSearch`, which fetches the tournament index on mount. Stub a
  never-settling `fetch` (`SiteSignature.test.tsx:47-52`) — it holds the search in `loading`,
  which is exactly what a test about nav structure wants.
- jsdom implements **no layout**. No test in the suite can measure the reflow. Source-level guards
  (`reflow-guards.test.ts`) make the fix impossible to delete silently; the numbers come from the
  browser harness and live in the Dev Agent Record. **Do not write a jsdom test that pretends to
  measure pixels.**
- `describe.skipIf(!anyBuilt)` gates `static-output.test.ts`. Anything load-bearing needs a
  home outside it too — that is exactly why `SiteSignature.test.tsx` exists.

### Stack

Next.js 16.2.11 (`output: "export"`), React 19.2.8, Tailwind **v4** (`@theme inline`, `@utility`,
`@layer base` — no `tailwind.config.js`), `radix-ui@1.6.5` (Dialog vendored at
`components/ui/dialog.tsx`), Vitest, Testing Library. Node ≥24. **Add no runtime dependency**
(Story 2.2's standing boundary). `cmdk` is absent and stays absent.

Tailwind default breakpoints: `md` 48rem, `lg` 64rem, `xl` **80rem**. **There is no `xl:` variant
anywhere in `app/src` today** — this story introduces the first. Nothing else keys off it, so
there is no existing convention to match or break.

### Previous-story intelligence

- **3.6 (`92eec27`, `review`)** — the caption. Its `Never` list: never hide, truncate or wrap the
  name; never put the `<span>` inside the anchor. Its measurement method — 96-cell matrix, plus a
  separate 1 px sweep per locale, plus spot measurements — is the method Task 9 repeats. It also
  filed the header-height ledger entry this story closes.
- **3.7 (`fd5f130` + `87a9a39`, `done`)** — UX-DR24. Emits a **contract, not code**; the bmad-ux
  session *was* the story, which is why it has no dev leg and why its sprint-status entry looked
  wrong until `2af1e0a`.
- **3.8 (`in-progress`)** — the deep-link port. **Zero file overlap** with this story once D2 is
  taken. Its lesson generalises: L1553's blocker list was found **stale**, which is why 3.8 is a
  port rather than an invention. **Check the claim, then size the work** — the same instinct that
  found the task brief's "stale lock" warning already fixed, and found a third live session.
- **2.14 (search)** — the complete reference implementation for the sheet. Ruling 3 (one `Esc`
  closes everything), Ruling 4 (CSS chooses the presentation, never JS), the conditional
  `aria-controls`, the two-live-regions problem, the portal-vs-breakpoint close-sync. **Read
  `HeaderSearch.tsx` before writing `SiteNav.tsx`. Nearly every hard question this story asks is
  answered there, in place, with its reasoning attached.**

### Git intelligence (last 5 commits)

`2af1e0a` sprint-status reconciled · `3866dd6` 3.5 contexted · `87a9a39` UX-DR24 recorded + three
ACs reconciled · `fd5f130` 3.7's contract · `9f76f40` 3.8 contexted. **The last five commits are
planning artifacts, not code** — the working tree is where the code is, held by three sessions.
That is why Task 1 is blocking rather than ceremonial.

House conventions, visible in every file above: a comment block at the top of each component
stating what it is and which spine section rules it; 🔴 markers on load-bearing invariants; every
number attributed to how it was obtained; alternatives that were measured and rejected recorded
alongside the choice. **Match it.** The reflow guards' `because:` fields are the clearest example
of the standard.

### Project Structure Notes

- Components in `app/src/components/*.tsx`; vendored primitives in `app/src/components/ui/`; pure
  logic and hooks in `app/src/lib/`; dictionaries in `app/src/locales/`.
- Tests sit **beside** their subject (`SiteNav.tsx` → `SiteNav.test.tsx`), except cross-cutting
  guards which live in `lib/` (`reflow-guards.test.ts`) or `app/` (`static-output.test.ts`).
- `nav-destinations.ts` belongs in `lib/`, not `components/`: it is pure data, it must be readable
  from a `node`-environment test, and putting it in `components/` would drag it under the ESLint
  client-import seam for no benefit.
- Path alias `@/` → `app/src/`.

### References

- `_bmad-output/planning-artifacts/epics.md:1382-1418` — Story 3.10 ACs
- `_bmad-output/planning-artifacts/epics.md:1074-1106` — standing criteria A1–A6
- `_bmad-output/planning-artifacts/epics.md:143` — UX-DR24
- `…/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md:212-294` — Navigation (normative)
- `…/EXPERIENCE.md:295-357` — Deep-Link Fragment Grammar
- `…/EXPERIENCE.md:30-96` — Information Architecture, route table, route-count consequences
- `…/EXPERIENCE.md:97-154` — The Landing Page, the ruled badge set
- `…/EXPERIENCE.md:449-472` — Responsive & Platform, Site header composition row
- `…/EXPERIENCE.md:519-551` — UJ-0
- `…/DESIGN.md:335-346` — Layout & Spacing, header height as a token
- `…/DESIGN.md:150-161` — the `spacing:` token block
- `…/DESIGN.md:361-382` — Components: site-header, nav-menu, feature-badge
- `…/DESIGN.md:383-398` — Do's and Don'ts
- `…/mockups/key-navigation.html` — frames A (sheet, 320), B (reflow, 195), C (inline, `≥xl`).
  ⚠️ Frame C's note still names `lg`; the spine supersedes it (D15).
- `app/src/components/SiteHeader.tsx:52-228` — the header being modified
- `app/src/components/HeaderSearch.tsx:314-510` — the sheet reference implementation
- `app/src/components/ui/dialog.tsx:51-113` — scrim, portal, geometry, z-ruling
- `app/src/lib/reflow-guards.test.ts:66-96, 186-247` — the two SiteHeader needles, the grid scan
- `app/src/app/globals.css:437-458` — the `scroll-padding-top` defect and its own honest-fix note
- `app/src/app/globals.css:474-486` — the global reduced-motion kill
- `app/src/components/CompareChartsSection.tsx:185-243, 365-375` — the three hardcoded offsets
- `app/src/lib/bootstrap.ts:64-69` — `localeClass()`, the `html.locale-*` classes
- `app/src/lib/i18n.ts:15-19` — `DictionaryKey`, the compile-time dot-path
- `_bmad-output/implementation-artifacts/deferred-work.md:4455-4456` — the header-height entry
- `_bmad-output/implementation-artifacts/deferred-work.md:4147, 4179-4180` — L2945, L1553/L1886, L1465
- `_bmad-output/implementation-artifacts/sprint-status.yaml:3388-3428` — Epic 3 status block

---

## Validation Pass (A5) — recorded 2026-08-26, at story creation

Every mechanism this story asserts was checked against the repo at `2af1e0a`, not assumed.

**Confirmed present, as described:**

| Claim | Verified |
|---|---|
| 3-6 shipped; `SiteHeader.tsx` free | `git show --stat 92eec27`; `git grep -c "chrome.signature" HEAD` = 2; `git status` clean |
| `ui/dialog.tsx` gives trap, `Esc`, focus-return, inert, scrim, portal | `dialog.tsx:33-37, 69-113` |
| Sheet geometry is already full-width / `top:0` / content-height | `dialog.tsx:98-107` — **no primitive change needed** |
| Conditional `aria-controls` is the house form | `HeaderSearch.tsx:995-1000` |
| Overlay registry exists and is the shipped pattern | `use-glossary-popover.ts:64,79`; `HeaderSearch.tsx:314-322, 420-425` |
| Breakpoint close-sync is required because Content portals | `HeaderSearch.tsx:324-358` |
| CSS-not-JS presentation choice (Ruling 4) | `HeaderSearch.tsx:336-341`; `CompareChartsSection.tsx:189-193` |
| `html.locale-es` / `.locale-en` exist | `bootstrap.ts:64-69`; `i18n-provider.tsx:54-66` |
| Global `prefers-reduced-motion` kill | `globals.css:474-486` |
| `scroll-padding-top: 4.5rem` wrong by 46 px, self-documented | `globals.css:437-458` |
| Tailwind v4 `@theme inline`, `--spacing-*` naming | `globals.css:226, 302-306` |
| Reflow guards pin two SiteHeader needles | `reflow-guards.test.ts:70, 88` |
| `MIN_HIT_PX` exists and is imported, not redefined | `viz/marker-layout`, used at `DataTable.tsx:17` |

**Corrections and findings that changed the story:**

1. 🔴 **The task brief's A3 warning is stale — the correction already landed.** Sprint-status was
   reconciled at `2af1e0a`: 3-6 reads `review` with its lock *explicitly released*, 3-7 reads
   `done`. Nothing to un-stick. Recorded so the next session does not re-litigate it either.
2. 🔴 **A third concurrent session.** Story **3-5** is live (`bootstrap.ts`, `bootstrap.test.ts`
   dirty). The brief named only 3-1 and 3-8.
3. 🔴 **A genuine A3 blocker the brief did not anticipate (D0).** Absorbing the search into the
   nav sheet forces edits to `HeaderSearch.test.tsx` and `SiteSignature.test.tsx`, both declared
   in 3-5's file list. **This story blocks on 3-5.** Without D0 the dev agent would have
   discovered this ~10 tests deep into a rewrite.
4. 🔴 **DESIGN.md's token values are pre-nav** (62/118/124 = 3.6's four-element header). They must
   be re-measured, not copied. D9 predicts `<xl` min-content ≈ 215 px, which may stop the 320 px
   wrap altogether.
5. 🔴 **The mockup's `grid place-items-center` trigger would fail `reflow-guards.test.ts`'s
   repo-wide implicit-grid scan** — `min-h-11`/`min-w-11` do not satisfy its fixed-size exemption.
   D11 routes around it via the shipped `flex` form.
6. 🔴 **The mockup's frame-C note contradicts the spine**, still naming `lg` as the inline
   threshold after the spine measured and rejected it. Spine wins; called out in D15 because the
   mockup is otherwise the clearest artifact in the set.
7. **AC 2 is vacuous, and that is the correct outcome** (D2): no nav destination is a match route,
   and `#results` is a *surface* fragment that opens nothing by design. Asserted rather than
   assumed, so a later editor cannot quietly break it.
8. **Four of nine destinations render today** (D1). `/players` and `/teams` have only `[slug]`
   routes — an index-vs-profile conflation that a naive route check would miss, and the exact
   shape of the 404 the scope boundary warns about.
9. **`usePathname` is new to this tree.** No existing convention to follow or violate.
10. **No `xl:` variant exists anywhere in `app/src`.** This story introduces the first.
11. **The ledger's proposed locale-keyed token is *not* what UX-DR24 ruled.** The contract's token
    set has no locale axis. D9 ships the ruled three and makes adding the axis an evidence-gated
    decision rather than a default.

**Open question for the dev agent, non-blocking:** Task 7.3 — if `search.open` and
`search.sheetTitle` become unreachable once the search's own trigger is deleted, they are dead
keys, which AC 1's BINDING prohibits. Grep before deleting; record the decision either way.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-5[1m]` — bmad-dev-story, run 2026-08-26, tree at `2c8bb1a`.

### Debug Log References

#### 🔴 ABORTED AT TASK 1 — D0's blocking dependency fired, on BOTH clauses

The run reached Task 1.4, the D0 gate, and stopped there. **No source file was modified.** This is
the story's own ruled abort (D0, Task 1.4, A3's second clause), not a failure and not a judgement
call — both halves of the gate are red, and either one alone is sufficient.

**Task 1.1 — every path held by another session** (`git status --porcelain`, HEAD `2c8bb1a`):

```
 M app/src/components/DefensiveActionsSection.tsx      3-8
 M app/src/components/ExpertLayer.tsx                  3-8
 M app/src/components/HeaderSearch.test.tsx            3-5  <-- THIS STORY MUST MODIFY IT
 M app/src/components/MovementToReceiveSection.tsx     3-8
 M app/src/components/OffersToReceiveSection.tsx       3-8
 M app/src/components/PassNetworksSection.tsx          3-8
 M app/src/components/PitchPanel.tsx                   3-8
 M app/src/components/ShotMapsSection.tsx              3-8
 M app/src/components/SiteSignature.test.tsx           3-5  <-- THIS STORY MUST MODIFY IT
 M app/src/components/TacticalLayer.tsx                3-8
 M app/src/components/TournamentHub.test.tsx           3-5
 M app/src/components/TournamentHub.tsx                3-8
 M app/src/lib/bootstrap.test.ts                       3-5
 M app/src/lib/bootstrap.ts                            3-5
 M app/src/lib/expert-logs.ts                          3-8
 M app/src/lib/i18n-provider.tsx                       3-5
 M app/src/lib/i18n.test.ts                            3-8
?? app/src/components/MatchDeepLink.test.tsx           3-8 (new)
?? app/src/lib/i18n-provider.test.tsx                  3-5 (new)
?? app/src/lib/match-anchors.test.ts                   3-8 (new)
?? app/src/lib/match-anchors.ts                        3-8 (new)
?? app/src/lib/use-anchor-nonce.ts                     3-8 (new)
?? 17                                                  (stray untracked file, no owner)
```

**Three live sessions confirmed, exactly as the creation probe predicted** — 3-1 has since
committed (its five paths are no longer dirty; `3-1` reads `review`), and 3-5 and 3-8 are both
still in flight. The creation probe's finding #2 ("a third concurrent session the task brief did
not name") holds and is now the blocking one.

**Task 1.2 — the two Epic 3 collision files.** Clean, as predicted.

```
$ git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx
(no output)
```

**Task 1.3 — 3-6's lock is released.** Confirmed; do not re-litigate.

```
$ git show --stat 92eec27
92eec27 Sign the project: an authorship caption in the header and the footer
$ git grep -c "chrome.signature" HEAD -- app/src/components/SiteHeader.tsx
HEAD:app/src/components/SiteHeader.tsx:2      <-- expected 2 ✅
```

**Task 1.4 — THE D0 GATE. RED on both clauses.**

*Clause 1 — has 3-5 landed? **No.***

```
$ git log --oneline -1 -- app/src/lib/bootstrap.ts
d60827c Story 2.2: site chrome — header, language/theme toggles, footer, 404
```

The most recent commit touching `bootstrap.ts` is **Story 2.2's**, from Epic 2. Story 3-5 has
produced no commit at all — `i18n-provider.tsx`'s history stops at `d60827c` / `0cfc1e6` for the
same reason. Its sprint-status entry still reads `ready-for-dev`. **3-5 is uncommitted work in the
working tree.**

*Clause 2 — are the two gated files clean? **No. Both are dirty, and demonstrably 3-5's.***

```
$ git status --porcelain -- app/src/components/HeaderSearch.test.tsx \
                            app/src/components/SiteSignature.test.tsx
 M app/src/components/HeaderSearch.test.tsx
 M app/src/components/SiteSignature.test.tsx

$ git diff --stat -- (those two)
 app/src/components/HeaderSearch.test.tsx  | 22 ++++++++++++++++++++++
 app/src/components/SiteSignature.test.tsx | 18 ++++++++++++++++++
 2 files changed, 40 insertions(+)
```

The diffs **name themselves**, which removes any doubt about ownership — each added block opens
with a `Story 3.5` attribution:

```diff
+/**
+ * Story 3.5 — `LocaleProvider` now detects the locale from
+ * `navigator.language` when nothing is persisted, and jsdom's default is
+ * "en-US". This file's assertions read SPANISH strings, so it states the
+ * Spanish browser it assumes; the one English test re-pins in its own body.
+ */
+function pinLanguage(tag: string): void {
+  vi.spyOn(window.navigator, "language", "get").mockReturnValue(tag);
+}
```

This is 3-5's Task 7.2 (`3-5-first-visit-locale-detection.md:321`, *"18 failures. Same pin inside
the existing…"*) in progress, in `HeaderSearch.test.tsx`, right now.

**Why this is an abort and not a merge.** A3's second clause is exact: *if another session already
holds a file this story must **modify** rather than append to, the story aborts at that task and
says so.* This story does not append to `HeaderSearch.test.tsx` — D0 requires **rewriting ~10 of
its 34 cases** (`:644`, `:706`, `:723-830`), every one keyed on `es.search.open`, because Task 4.2
deletes the `<md` trigger and `Dialog` those cases exercise. Rewriting a file another session is
concurrently editing, in the same region, destroys one side's work whichever way the tree settles.
Story 2.18's precedent applies and was the correct call.

**Why the "just skip the search absorption" escape hatch is closed.** D0 forbids it by name, with
a reason that is not stylistic: a `<xl` header carrying *both* a nav trigger and a search trigger
is a fifth element in a row DESIGN.md's Don'ts column forbids, it pushes the wrap threshold from
354 px to ~406 px (the opposite of the width inversion that justified this shape), and it forfeits
UX-DR24's whole premise — that the trigger **replaces** three controls rather than joining them.
There is no smaller version of this story. It is blocked, not reducible.

**Task 1.5 — owned-paths list.** Recorded unchanged from the probe section above; re-verified at
`2c8bb1a`. Of the sixteen paths this story owns, **fourteen are clean and free**; the two that are
not are precisely the two D0 named at creation. The creation probe predicted this exactly.

#### What unblocks this story

One thing: **story 3-5 commits.** When `git log -1 -- app/src/lib/bootstrap.ts` names a 3-5 commit
and both `HeaderSearch.test.tsx` and `SiteSignature.test.tsx` are clean, re-run `/bmad-dev-story
3.10` and it proceeds through Task 2 with no further ceremony. Nothing else about the story needs
to change — the contract is ruled, the rulings D1–D15 are unaffected by the wait, and the A3 probe
found every other owned path clean. Note that 3-8 is also live but is **zero-overlap** by D2's
construction, so it does not gate this story in either direction.

**Do not** re-run this story before then hoping the tree has settled by luck, and do not
`git stash` another session's work to clear the gate.

### Completion Notes List

- **Run outcome: ABORTED AT TASK 1.4 (D0). Story remains `ready-for-dev`.** Zero tasks completed,
  zero acceptance criteria satisfied, zero source files touched. Tests were not run and no gate was
  driven RED — A1's obligation belongs to the run that implements the story, not to this one.
- Status was deliberately **left at `ready-for-dev` rather than flipped to `in-progress`**: no
  implementation began, and marking it in-progress would misreport the board to the other two live
  sessions. `baseline_commit` was likewise **not** written into the frontmatter — the real run will
  start from a different commit (3-5's), and a baseline captured here would be wrong by
  construction.
- Task 1's probe subtasks 1.1, 1.2, 1.3 and 1.5 executed and are recorded above. **1.4 is left
  unchecked deliberately**: the gate ran and came back red, so Task 1 is not passed and the next
  session must re-run it rather than trust this result.
- The creation-time A3 probe was **re-verified, not inherited**, and it held on every point. One
  thing changed since creation: **story 3-1 has landed** (`review`), so its five paths are no
  longer dirty. That does not affect this story.
- A stray untracked file named `17` sits at the repo root with no owner. Not this story's, not
  staged, not removed — flagged only so the next session does not mistake it for a deliverable.

### File List

No source, test, style, locale or documentation file was created, modified or deleted by this run.

The two files below carry the abort record required by D0 / Task 1.4, and nothing else:

- `_bmad-output/implementation-artifacts/3-10-navigation-menu.md` (this Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (append-only note on `3-10`)

### Change Log

| Date | Change |
|---|---|
| 2026-08-26 | Dev run attempted at `2c8bb1a`. **Aborted at Task 1.4 per D0** — story 3-5 is uncommitted and holds `HeaderSearch.test.tsx` and `SiteSignature.test.tsx`, both of which this story must rewrite rather than append to (A3). No implementation performed. Status held at `ready-for-dev`. |

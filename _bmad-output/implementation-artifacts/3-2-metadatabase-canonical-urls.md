---
baseline_commit: 8750d85f74584c6fe899527db8463fbd9196993b
---

# Story 3.2: `metadataBase`, Absolute Canonical URLs & `og:url`

Status: done

**Baseline commit sized against:** `8750d85` (`Story 3.4 context: the sitemap is 1,404 entries…`).

**Story 3.1 is `done`, and this story is sized against its CODE REVIEW (`39889bf`), not its first cut
(`432dc29` + `117311c`).** The review changed the gate's semantics in ways that matter here: the
self-origin allowance is now **position-scoped to `<link href>`** rather than global, and three
`linkHref` false negatives were closed. §D10 records what survived and what this story must therefore
re-verify by running rather than by reasoning.

## Story

As someone who shares a link to a match, player or team,
I want every route to declare its own canonical address,
so that crawlers and link unfurlers resolve one unambiguous URL per page (FR-36, NFR-4).

## Acceptance Criteria

**AC1 — `metadataBase` from the one shared constant.**
**Given** story 3.1 has landed `app/src/lib/site-origin.ts` (without it this story red-builds Netlify
on all ~1,406 pages with an error naming AR-11)
**When** `metadataBase: new URL(SITE_ORIGIN)` is set on the root layout, imported from
`@/lib/site-origin`
**Then** relative metadata URLs resolve absolutely **and no second origin literal is introduced
anywhere** — not in `layout.tsx`, not in the four route files, and **not in this story's new test
file**. `site-origin.test.ts` asserts mechanically that the string occurs exactly once under `app/`;
that suite must still be 2/2 green at the end of this story.

**AC2 — every canonical carries the trailing slash, because Netlify serves one.**
**Given** `next.config.ts:9` sets `trailingSlash: true`
**When** `alternates: { canonical: … }` is emitted
**Then** every canonical URL in the export ends with `/`. A canonical that disagrees with the served
URL is worse than none.
**And** `openGraph.url` **agrees with the canonical on every route** — byte-identical, not merely
same-shaped.

**AC3 — exactly one canonical per route, absolute, same-origin, and pointing at ITS OWN route.**
**Given** the four `generateMetadata` sites (`/`, `/matches/[slug]`, `/players/[slug]`,
`/teams/[slug]`) plus the static routes (`/about`, `/glossary`, `/compare`)
**When** the export is inspected
**Then** **every** `.html` file under `app/out/` carries **exactly one** `<link rel="canonical">`,
absolute, same-origin, trailing-slashed.
**And** for every indexable route the canonical URL equals that file's **own** exported path —
`out/players/<slug>/index.html` → `${SITE_ORIGIN}/players/<slug>/`. A canonical that is correctly
shaped but names a different route is the exact failure a layout-level absolute literal produces, and
"exactly one, absolute, same-origin" alone does not catch it.
**And** the three not-found artifacts are the **one ruled exception** (§D3): `out/404.html`,
`out/404/index.html` and `out/_not-found/index.html` are byte-identical copies of the same route and
all three resolve to `${SITE_ORIGIN}/_not-found/`. They are asserted to be same-origin,
trailing-slashed and to carry `<meta name="robots" content="noindex"/>` — not to match their own path.

**AC4 — metadata stays once per route in canonical Spanish.**
**Given** D17, upheld by D20
**When** this story ships
**Then** it introduces **no per-locale URLs, no `alternates.languages`, no `hreflang`, and no
`x-default`**. If that feels wrong while implementing, it is ruled; do not reopen it here. The
sitemap shipped by 3.4 is the instrument that makes the D20-b re-open trigger measurable, and the
clock does not start before 2026-11-24.

**AC5 — the ~1,406 absolute canonicals pass the post-review origin gate, PROVED BY RUNNING IT.**
**Given** `app/scripts/assert-no-external-origins.mjs` as it stands at `39889bf`
**When** `npm run assert:no-external-origins` is run over the export carrying every canonical and
every `og:url`
**Then** it exits 0, reports **0 external subresources**, and **does not report the site's own origin
on the informational `MENTIONED in text` line**.
**And** that exit 0 is **falsified before it is believed**: an off-origin `<link rel="stylesheet">`
injected into one exported file must still drive the same gate to exit 1 on the same tree. A gate that
cannot fail on the export it just passed has proved nothing — this is `scanned === 0`'s own logic
applied to a new export shape.

**AC6 — A3 file ownership, or abort.**
**Given** A3 and the known Epic 3 collision on `app/src/app/page.tsx`
**When** this story edits that file's `generateMetadata`
**Then** the file-ownership probe has run and the story owns that path for the duration, **or it
aborts at Task 1 and says so**. Story 3.10's abort at `9a4e4e8` is the precedent and was the correct
call.

**AC7 — the guard is red-provable in four directions (A1, A2).**
**Given** the new guard `app/src/app/canonical-output.test.ts`
**When** the story is called done
**Then** each of these has been driven RED once with the command and failing output recorded:
(a) `metadataBase` removed from the layout; (b) `url` removed from one route's `openGraph`;
(c) a second `<link rel="canonical">` injected into one exported file; (d) one exported canonical
rewritten to drop its trailing slash **and** one rewritten to name a different route.
**And** the guard **pins by relative path over the whole export and by no entity id at all** — see
§D5. `players/static-output.test.ts:126`'s `QUINONES` constant is the shape A2 forbids; do not copy it.

### Standing Epic 3 acceptance criteria — they apply here in addition to the above

- **A1** — every gate this story adds is driven RED once against a deliberately broken input, command
  and failing output in the completion notes. Given `39889bf`, treat "the gate passes" as a claim to
  be falsified, not a result to report (AC5, AC7).
- **A2** — no coincidence-green tests: pinned by relative path, never by an id a fixture and the real
  corpus could share; shown to fail when the guarded thing is reverted.
- **A3** — file-ownership probe at Task 1; abort if another session holds a file this story must
  **modify**.
- **A4** — stage only this story's own paths. Never `git add -A`. **Do not stage the stray 0-byte file
  named `17` in the repo root — it belongs to nobody.**
- **A5** — this context is the create-light half; a fresh-context validation pass is the hard half.
  Every mechanism cited below was executed at creation time, not recalled — §"Validation pass".
- **A6** — Epic 3 retrospective at epic close.

## Tasks / Subtasks

### Task 1 — Probe, baseline, abort conditions (AC: 6, and all)

- [x] **1.1** Record `git rev-parse HEAD` as this story's baseline in the Dev Agent Record. At
      creation it was `8750d85`.
- [x] **1.2** **A3 file-ownership probe.** Run `git status --porcelain`. Confirm **all five owned
      paths are clean**:
      `app/src/app/layout.tsx`, `app/src/app/page.tsx`, `app/src/app/matches/[slug]/page.tsx`,
      `app/src/app/players/[slug]/page.tsx`, `app/src/app/teams/[slug]/page.tsx`.
      Confirm `app/src/app/canonical-output.test.ts` does not exist (NEW — "no such path" is clean).
      **ABORT the story at this task** if any of the five is dirty. `page.tsx` is the named Epic 3
      collision path (3-2/3-3 metadata vs 3-9 rewrite) and AC6 requires this check explicitly.
      An abort is a **recorded outcome, not a failure**: write which path was held and by which
      story into the Dev Agent Record, note it in `sprint-status.yaml`, commit the story file alone,
      and stop. Story 3.10's abort commit `9a4e4e8` is the shape to follow.
- [x] **1.3** Confirm the concurrent-session file set has not grown into this story's paths. At
      creation, story **3-10 (navigation menu)** held:
      `app/src/app/static-output.test.ts`, `app/src/app/globals.css`,
      `app/src/components/{SiteHeader,HeaderSearch,CompareChartsSection}.tsx`,
      `app/src/components/HeaderSearch.test.tsx`, `app/src/lib/reflow-guards.test.ts`,
      `app/src/locales/{en,es}.ts`, and untracked `SiteNav.tsx(+test)` / `nav-destinations.ts(+test)`.
      `_bmad-output/implementation-artifacts/3-4-sitemap-robots.md` belongs to a third session.
      **None of those is a path this story modifies.** Re-verify rather than assume — the list has
      moved daily this epic.
- [x] **1.4** Confirm `app/src/lib/site-origin.ts` is committed, clean, and its value is
      `https://mundial-stats.juancr.dev`. If it has changed, stop and re-read its docblock — this
      story is its named first consumer and every number below is derived from that value.
- [x] **1.5** **Re-measure the test baseline yourself.** It has moved repeatedly this epic
      (1,251 → 1,306 → 1,320 → 1,334 → 1,367 → …). At creation `npx vitest list` collected
      **1,468 tests across 58 files** — but that count **includes 3-10's two untracked test files**,
      so it is not a clean-HEAD number and must not be inherited. Record
      `<files> / <tests> / <skipped>` from your own run.
- [x] **1.6** **Re-measure the route baseline.** At creation, `app/out/` held **1,406 `index.html`**
      (= 1,404 indexable + `404/` + `_not-found/`) plus `out/404.html`, i.e. **1,407 `.html` files
      totalling 38.2 MB**. Decomposition: 104 matches + 1,248 players + 48 teams + `/` + `/about` +
      `/glossary` + `/compare` = 1,404. Confirm `app/out` is a current build; if absent or stale, run
      `npm run build` first.
- [x] **1.7** **Record the pre-story origin-gate baseline** so AC5's "after" number means something:
      `node scripts/assert-no-external-origins.mjs out`. At creation: **exit 0, 6 external origins
      MENTIONED (bit.ly, github.com, nextjs.org, react.dev, redux-toolkit.js.org, redux.js.org),
      12,684 text assets, 0 external subresources**, ~28 s. The site's own origin is **not** on the
      MENTIONED line today and must not appear on it afterwards.
- [x] **1.8** Decide the verification environment. The shared tree is dirty with another story's
      in-flight work and `app/src/app/static-output.test.ts` currently imports `NAV_DESTINATIONS` from
      an **untracked** file. If the shared tree does not build or does not typecheck, verify in an
      isolated worktree — §D9 has the exact recipe, including the two Windows walls.

### Task 2 — Prove the resolution mechanism on the real export BEFORE wiring all five files (AC: 1, 2, 3)

This task exists so the story's single highest-risk assumption is measured on disk rather than
inferred. §D1 sources it from `next@16.2.11` internals and §"Validation pass" records the resolver
executed directly at creation — but neither is the export.

- [x] **2.1** Edit **only** `app/src/app/layout.tsx`: add `metadataBase: new URL(SITE_ORIGIN)` and
      `alternates: { canonical: "./" }` to the existing `export const metadata`. Import `SITE_ORIGIN`
      from `@/lib/site-origin`. Change nothing else yet.
- [x] **2.2** `npm run build`. Then read, and **record verbatim in the Dev Agent Record**, the
      `<link rel="canonical">` emitted by each of these five files:
      `out/index.html`, `out/about/index.html`, `out/players/<any slug>/index.html`,
      `out/matches/<any slug>/index.html`, `out/404.html`.
      **Expected** (proved against the installed resolver at creation, §"Validation pass"):
      `https://mundial-stats.juancr.dev/`, `…/about/`, `…/players/<slug>/`, `…/matches/<slug>/`,
      `…/_not-found/`.
- [x] **2.3** If any of those five is relative, localhost-based, or missing its trailing slash,
      **stop and re-read §D1 before changing approach** — the fallback is the explicit per-route form
      in §D1's rejected column, and taking it changes which files this story edits.
- [x] **2.4** Confirm the route count Next prints is unchanged from Task 1.6. This story adds no
      route.

### Task 3 — `og:url` on the four `generateMetadata` sites (AC: 2)

**`openGraph` is REPLACED wholesale by the child, never merged** (§D2, verified in
`resolve-metadata.js:182-186`). A page that exports `openGraph: { title, description }` discards the
layout's `openGraph` entirely — so the four routes that matter would ship a canonical with **no
`og:url`** if this task is skipped. This is the single easiest way to implement this story wrong.

- [x] **3.1** `app/src/app/layout.tsx` — add `openGraph: { url: "./" }` to the root `metadata`. This
      is what gives `/about`, `/glossary`, `/compare` and the 404 an `og:url` **without adding a
      metadata export to any of those three files**, whose standing rulings against one still hold
      (§D4).
- [x] **3.2** `app/src/app/page.tsx` — add `url: "./"` to the `openGraph` object returned by
      `generateMetadata`.
- [x] **3.3** `app/src/app/matches/[slug]/page.tsx` — same.
- [x] **3.4** `app/src/app/players/[slug]/page.tsx` — same.
- [x] **3.5** `app/src/app/teams/[slug]/page.tsx` — same.
- [x] **3.6** In each of the four, add one comment line stating that the **canonical comes from the
      root layout** and that **`url` must survive any future rewrite of this `openGraph` object**.
      Story 3.3 is about to edit all four to add `images`, `type`, `locale` and `siteName`; a
      wholesale rewrite that drops `url` is silent, and this comment is what stops it.
- [x] **3.7** Do **not** add `alternates` to any of the four. One definition, on the layout (§D1).

### Task 4 — The guard: `app/src/app/canonical-output.test.ts` (AC: 3, 7, A2)

A NEW file. The natural home — `app/src/app/static-output.test.ts` — is held by story 3-10, and A3
forbids modifying a file another session holds. A3 does **not** force an abort here, because this
story does not need to modify that file: it needs an assertion, and an assertion can live in a file of
its own. Say so in the completion notes.

- [x] **4.1** Walk `app/out/` for every `.html` file, skipping `_next/` and `data/`. Read once in a
      `beforeAll` and share across cases — measured at creation: **1,407 files, 38.2 MB, 3.3 s**.
      Give the suite an explicit timeout on the same precedent and for the same reason as
      `site-origin.test.ts`'s `IO_TIMEOUT_MS = 20_000` (which covers 194 files / 3 MB); **60 s** is the
      proportionate figure here. Under full-suite load an I/O-bound case fails on time rather than on
      substance, and that is a known cost this project has already paid once.
- [x] **4.2** `describe.skipIf` on the export being absent, matching the four shipped
      `static-output.test.ts` files' convention — **but skip only when the export is wholly absent**.
      A partial export must fail loudly, not skip (`src/app/static-output.test.ts:33-40`).
- [x] **4.3** **Case: exactly one canonical, everywhere.** For every one of the 1,407 files, count
      `<link rel="canonical"` occurrences and assert it is exactly 1. Report the failure as the list of
      offending relative paths joined into the assertion message, not as a bare count —
      `site-origin.test.ts:89-95` records why (`"2 !== 1"` sends the reader grepping).
- [x] **4.4** **Case: absolute, same-origin, trailing-slashed, everywhere.** Every canonical
      `startsWith(SITE_ORIGIN)` — **imported, never spelled** (AC1) — parses as a URL whose `origin`
      is `SITE_ORIGIN`, and ends with `/`.
- [x] **4.5** **Case: the canonical names its own route.** For every indexable file, derive the
      expected URL from the file's **own relative path** (`out/players/x/index.html` →
      `${SITE_ORIGIN}/players/x/`; `out/index.html` → `${SITE_ORIGIN}/`) and assert equality. **No
      entity id appears anywhere in this file.** This is the case that catches a right-shaped
      canonical on the wrong route, and it is A2's requirement discharged in the strongest available
      form: the pin is the path, and there is nothing else to pin.
- [x] **4.6** **Case: `og:url` is byte-identical to the canonical**, on every file. Not "present",
      not "same origin" — equal. Extract it with an attribute-order-tolerant pattern; the shipped
      precedents are `players/static-output.test.ts:67` (`<meta[^>]*property="…"[^>]*content="([^"]*)"`)
      and `teams/static-output.test.ts:76`, which also accepts `name=` alongside `property=`. Reuse
      the shape, not the file — both belong to story 3.3.
- [x] **4.7** **Case: the three not-found artifacts (§D3).** `out/404.html`, `out/404/index.html` and
      `out/_not-found/index.html` are excluded from 4.5's path match and asserted instead to be
      same-origin, trailing-slashed, and to carry `<meta name="robots" content="noindex"/>`. Assert
      the exclusion set is **exactly** those three relative paths, so a fourth unexplained exception
      cannot appear silently.
- [x] **4.8** **Case: no `hreflang`, no `alternates.languages` (AC4).** Assert no
      `<link rel="alternate"` carrying an `hreflang` attribute exists anywhere in the export. D17 is a
      ruling; this is what makes it a gate rather than prose.
- [x] **4.9** Document at the top of the file, in the house style, what the guard holds and why it
      lives here rather than in `static-output.test.ts`.

### Task 5 — A1: drive the guard RED, four directions (AC: 7)

None of these is optional, and each records the **command and its failing output**. (c) and (d) need
no rebuild — mutate the exported file, run the guard, restore. Do this in the worktree if the shared
tree's `out/` is another session's.

- [x] **5.1** **(a) Revert the wiring.** Remove `metadataBase` from `layout.tsx`, rebuild, run the
      guard. Expect RED. Verified at creation against the installed resolver: with no `metadataBase`,
      `"./"` resolves to the **relative** `/players/l-messi` — no origin at all — so 4.4 fails first.
      Record which case failed and its message.
- [x] **5.2** **(b) Drop one `og:url`.** Remove `url: "./"` from `players/[slug]/page.tsx`'s
      `openGraph`, rebuild, run the guard. Expect 4.6 RED across 1,248 files. Record the count the
      failure names.
- [x] **5.3** **(c) Two canonicals.** Inject a second `<link rel="canonical" href="…"/>` into one
      exported file. Expect 4.3 RED naming that exact relative path. Restore.
- [x] **5.4** **(d) Two shape breaks.** In one exported file drop the canonical's trailing slash
      (expect 4.4 RED); in another rewrite the canonical to name a different existing route (expect
      4.5 RED, and confirm 4.3 and 4.4 stay GREEN on it — that is the whole point of 4.5). Restore
      both.
- [x] **5.5** Return everything to green and re-run the full guard.

### Task 6 — AC5: the origin gate over the real export, and its falsification (AC: 5)

- [x] **6.1** With all five files wired and built, run `npm run assert:no-external-origins`. Record
      exit code, the text-asset count, the external-subresource count, and the full `MENTIONED` line.
      Expect exit 0, 0 external subresources, and **`mundial-stats.juancr.dev` absent from the
      MENTIONED line**. Compare against Task 1.7's baseline and account for any delta.
- [x] **6.2** **Falsify it.** Inject `<link rel="stylesheet" href="https://cdn.evil.example.com/x.css"/>`
      into one exported `.html` file and re-run the same gate on the same tree. **Expect exit 1 naming
      that file.** Record the output. Restore the file and re-confirm exit 0.
      Rationale: `39889bf` exists because three `linkHref` false negatives shipped with all 23 tests
      green. "The gate passed" is a claim about the gate, not about the export, until the gate is shown
      able to fail on that export.
- [x] **6.3** Confirm `app/src/lib/assert-no-external-origins.test.ts` (27 cases) and
      `app/src/lib/site-origin.test.ts` (2 cases) still pass **unchanged**. This story does not edit
      the gate, its tests, or `site-origin.ts`. If `site-origin.test.ts` goes red, you have introduced
      a second origin literal — find it before doing anything else.

### Task 7 — Full chain and regression sweep (AC: all)

- [x] **7.1** `npm run lint` → exit 0. The i18n metadata selector gates
      `title|description|default|template|absolute|alt|siteName`; `canonical` and `url` are **not** in
      it, so `"./"` is not a gated literal (read at creation, `eslint.config.mjs:208`). Verify rather
      than assume.
- [x] **7.2** `npx tsc --noEmit` → exit 0.
- [x] **7.3** `npm run build` → green end to end (lint, typecheck, schema assert, `next build`,
      `copy-data`, origin gate).
- [x] **7.4** Full `npm test`. Record `<files> / <tests> / <skipped>` and the delta against Task 1.5.
      **0 newly skipped.** Chunk the run by file if it is killed mid-flight — that is a known
      environment behaviour here, not a defect.
- [x] **7.5** Confirm the four shipped `static-output.test.ts` suites still pass, in particular
      `players/static-output.test.ts:126` (`not.toContain("og:image")`) and
      `teams/static-output.test.ts:140` (`metaContent(html, "og:image")` is null). Adding `og:url`
      does not trip either — checked at creation — but check it, do not reason about it.
- [x] **7.6** Confirm the route count is still 1,406 `index.html` and that no route was added or lost.

### Task 8 — Commit and hand off (AC: all, A4)

- [x] **8.1** Stage **only** these paths, by pathspec:
      `app/src/app/layout.tsx`, `app/src/app/page.tsx`, `app/src/app/matches/[slug]/page.tsx`,
      `app/src/app/players/[slug]/page.tsx`, `app/src/app/teams/[slug]/page.tsx`,
      `app/src/app/canonical-output.test.ts`, and this story file.
      **Never `git add -A`.** **Never stage the 0-byte `17` in the repo root.** Prefer
      `git commit -- <paths>`; add-then-commit is not atomic here and a concurrent session's sweeping
      add has captured another story's files before.
- [x] **8.2** Commit directly to `main`. No branch, no PR.
- [x] **8.3** Append to `sprint-status.yaml` — **append only, never regenerate**; it carries the
      project journal and the Epic 2 retro action items, and another session writes it. **Re-read it
      immediately before touching it**, insert by anchor phrase, and verify append-only
      programmatically. Set `3-2-metadatabase-canonical-urls: review`.
- [x] **8.4** Fill the Dev Agent Record: File List with `git diff --numstat` figures **read from the
      command, not transcribed from memory** (3.1's review caught two mis-transcribed insertion counts),
      Completion Notes with every red proof from Tasks 5 and 6, and the measured baselines from Task 1.
- [x] **8.5** Hand off to 3.3 explicitly: it edits all four route files to add `openGraph.images`,
      `type` and `siteName`, and **must not drop `url` or `locale`** (Task 3.6's comment is the
      guard, the Task 4.6 case is the gate).
      **CORRECTED AT CODE REVIEW 2026-08-26 — the original hand-off was briefed on the false §D8.**
      Two changes 3.3 must not be surprised by: (1) `locale` is struck from 3.3's list because this
      story now sets `og:locale: "es_ES"` at all five declaration sites; (2) `/about`, `/glossary`,
      `/compare` and the three not-found artifacts **already carry a full OG and Twitter card** —
      title, description, url, `twitter:card`/`title`/`description` — back-filled by
      `postProcessMetadata` the moment the layout declared `openGraph`. 3.3 was told those routes
      were bare. They are not. `/compare` in particular carries a standing docblock ruling against a
      `metadata` export, and now has a generic Spanish card that arrived from the layout rather than
      through that ruling; 3.3 should read `compare/page.tsx:16` before adding anything there.

### Review Findings

Code review 2026-08-26, three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor)
over `8d064e1..30905dc`. 24 raw findings → 16 unique after dedup → 4 dismissed as noise. **All seven
ACs were independently re-verified and hold** (AC1 origin-literal count 1/1 and `site-origin.test.ts`
2/2; AC2/AC3 by an independent script over all 1,407 exported documents — `noSlash 0`, `notAbs 0`,
`ogMismatch 0`, `multi 0`, `wrongRoute 0`; AC4 `hreflang 0`; AC5 origin gate exit 0 and falsified to
exit 1; AC6 the ownership probe matches `git diff --numstat`; AC7 all four red directions re-driven in
an isolated tree with the guard unmodified). Nothing below overturns an AC.

- [x] [Review][Decision] **RESOLVED 2026-08-26 by Juan — option 1: keep the card, set `og:locale`,
      correct §D8 and re-brief 3.3.** Reverting `openGraph: { url: "./" }` was never on the table: it
      would strip `og:url` from those routes and break AC2 and the byte-identity gate. The card is the
      price of AC2 and is accepted. The not-found card is accepted as shipped (D3's `noindex` reasoning
      stands; opening `not-found.tsx` costs more than the defect). Converted to two patches, below:
      `[Review][Patch] og:locale` and `[Review][Patch] §D8 + Task 8.5 + layout docblock`. Original
      finding retained verbatim for the record:
      **The layout's new `openGraph` key minted a full Spanish OG *and Twitter* card
      on `/about`, `/glossary`, `/compare` and all three not-found artifacts — §D8 ruled the opposite**
      — §D8 states "`openGraph: { url: "./" }` alone on the layout emits `og:url` and nothing else …
      no `og:title` is invented for `/about` etc. … Story 3.3 owns the card." That is false on the real
      export. §D8 cites `resolve-opengraph.js:150`, which is not the last word: `resolve-metadata.js`
      `postProcessMetadata` back-fills `autoFillProps.title`/`description` from the page metadata
      whenever `openGraph` is non-null, then runs `resolveTwitter` over them. Before this story those
      routes resolved `openGraph === null` and emitted **no** og/twitter tag at all; this diff is the
      sole cause of six new meta tags per static route. Verified: `out/compare/index.html` now carries
      `og:title`, `og:description`, `og:url` plus `twitter:card`/`title`/`description`; same on
      `/about`, `/glossary`, `404.html`, `404/index.html`, `_not-found/index.html`. Three consequences
      needing a ruling: (a) `/compare` carries a standing docblock ruling that `export const metadata`
      "IS NOT TAKEN, AND THAT IS A RULING" — no i18n keys were minted so the dead-key reason is not
      breached, but a generic Spanish card now ships there from the side without the ruling being
      cited; (b) the not-found route now unfurls in Slack/Twitter as a legitimate-looking site card
      pointing at `https://mundial-stats.juancr.dev/_not-found/` — the D3 exception justifies that URL
      on `noindex` grounds, but link unfurlers do not read `robots`, and `og:url` there is new in this
      diff; (c) no `og:locale` is set, so every Spanish document defaults to `en_US` for OG consumers,
      and this layout object is the first place it could have been set. Story 3.3 was handed off as
      owning a card that already exists on four routes.

- [x] [Review][Patch] `og:locale: "es_ES"` at all five `openGraph` declaration sites — the layout alone
      reaches only the four static routes, for the same wholesale-replacement reason `og:url` needed
      four copies; without the route files, 1,402 Spanish pages keep advertising the OG default `en_US`
      [app/src/app/layout.tsx:59; page.tsx:84; matches/[slug]/page.tsx:59; players/[slug]/page.tsx:90; teams/[slug]/page.tsx:115]
- [x] [Review][Patch] Correct §D8 to state what the export does, re-brief Task 8.5's hand-off (3.3 no
      longer adds `locale`, and four routes already carry a card), and record the back-fill in the
      layout docblock [spec:422-426, spec:8.5; app/src/app/layout.tsx:44-49]
- [x] [Review][Patch] Task 4.2's "a partial export must fail loudly" is not met — a 10-document export
      passes all 8 cases (reproduced) [app/src/app/canonical-output.test.ts:215-232]
- [x] [Review][Patch] `SKIPPED_DIRECTORIES` is matched by bare name at every depth, so a route segment
      named `data` or `_next` drops out of all 8 cases silently [app/src/app/canonical-output.test.ts:137-146]
- [x] [Review][Patch] The hreflang case asserts only the `hreflang=` attribute while its name and AC4
      claim four clauses — `<link rel="alternate">` is never inspected [app/src/app/canonical-output.test.ts:306-311]
- [x] [Review][Patch] The file's docblock cites AC3/AC4/AC7; its `describe` cites AC 2/AC 3/AC 4 —
      neither is right, and AC7 is not assertable here [app/src/app/canonical-output.test.ts:10 vs :206]
- [x] [Review][Patch] The layout docblock documents the `openGraph` wholesale-replacement trap but not
      the identical `alternates` one: any future route declaring `alternates` for *any* reason (a
      `types` feed, `media`, even `{}`) loses the inherited canonical, because `mergeMetadata`
      branches on key presence, not on `canonical` [app/src/app/layout.tsx:36-58]
- [x] [Review][Patch] Task 5(d)'s red-proof record under-reports: the trailing-slash break turns **4**
      cases red, not the 1 recorded ("`glossary/index.html` → the absolute/same-origin/slashed case
      RED"). The `compare` mutation's record reproduced exactly [spec:661-690]

- [x] [Review][Defer] The guard never runs on any automated path, and a stale `out/` scores the same
      green as a fresh one [app/src/app/canonical-output.test.ts:203-213] — deferred, pre-existing
- [x] [Review][Defer] `servedUrl` builds expected URLs from raw filesystem bytes with no
      percent-encoding [app/src/app/canonical-output.test.ts:186-192] — deferred, pre-existing
- [x] [Review][Defer] 11,235 crawlable `.txt` RSC payloads carry no canonical and the walk cannot see
      them [app/src/app/canonical-output.test.ts:142; app/src/app/robots.ts:41-49] — deferred, pre-existing
- [x] [Review][Defer] A shipped test one directory away asserts `hreflang` is "the other tag 3.2
      emits"; 3.2 emits none [app/src/lib/assert-no-external-origins.test.ts:228-231] — deferred, pre-existing

**Dismissed as noise (4):** the own-route case being mathematically subsumed by the D3 case (redundant
but it carries the better failure message, and both went red independently under AC7 (d)); the four
overlapping not-found constants needing lockstep edits (fails in the loud direction); the absence of a
shared `og({title, description})` helper for future `openGraph` declarations (the four comments plus
the gate are the chosen enforcement; a helper is beyond scope); Task 4.7's `PATH_MISMATCHED_DOCUMENTS`
shape differing from the spec text (verified functionally equivalent — a fourth exception, a dropped
one, and a drifted `_not-found/` canonical are all still caught).

## Dev Notes

### Decisions ruled at story creation — implement these, do not re-derive them

**D1 — the canonical is authored ONCE, on the root layout, as `alternates: { canonical: "./" }`.**

Not four per-route literals and not a layout-level absolute string. `"./"` is resolved **per route**,
against the leaf pathname, by `resolveAbsoluteUrlWithPathname`
(`next/dist/lib/metadata/resolvers/resolve-url.js:99`):

- `resolveRelativeUrl` turns `"./"` into the leaf pathname via `path.posix.resolve(pathname, "./")`;
- `resolveUrl` composes it with `metadataBase`;
- the `trailingSlash` branch (`:114`) appends the `/`, because the URL is same-origin, has no query,
  and is not file-like.

`pathname` is the **route's** pathname at every level of the metadata tree — `accumulateMetadata`
threads one `pathname` through every `mergeMetadata` call (`resolve-metadata.js:745, 792`), so a
`"./"` written on the ROOT layout still resolves to the LEAF route. Executed at creation against the
installed `next@16.2.11`; the eight measured outputs are in §"Validation pass".

Why this and not four literals:

- It covers `/about`, `/glossary` and `/compare`, which have **standing rulings against a metadata
  export** (§D4). The literal approach cannot reach them without breaking those rulings.
- It covers `/tournament`, `/tops`, `/players` and `/teams` **automatically when story 3.9 lands
  them** — the same reasoning story 3.4 ruled for its non-entity routes: a literal list means 3.9 has
  to remember to edit a file it has no reason to open.
- It is the same one-definition discipline `SITE_ORIGIN` itself is built on.

**Rejected, but recorded so nobody re-derives it:** explicit per-route
``alternates: { canonical: `/players/${slug}/` }``. It works — verified at creation, same output —
and it does not depend on the `trailingSlash` branch. It is the fallback **if and only if** Task 2.2
finds `"./"` does not resolve as measured. Its costs are the three unreachable static routes, four
future routes it silently misses, and four more places a path can drift.

**Not a risk here, checked:** the `trailingSlash` branch skips file-like paths
(`FILE_REGEX`, `resolve-url.js:94`), so a slug containing a dot would lose its trailing slash. **Zero
of the 1,400 entity slugs contain a dot** — measured across `out/players`, `out/teams`, `out/matches`
at creation, consistent with `common.schema.json`'s "lowercase ASCII kebab, accent-stripped" (AD-3).

**D2 — `og:url` MUST be authored in all four `generateMetadata` sites AND on the layout.**

Metadata merges **per top-level key**: `mergeMetadata` iterates the child's own keys and a present key
**replaces** the parent's resolved value wholesale (`resolve-metadata.js:170-186`).
`resolveOpenGraph` only ever sees the child's own object (`resolve-opengraph.js:134-154`). So:

- `alternates` is **absent** from all four route files → they **inherit** the layout's canonical. ✔
- `openGraph` is **present** in all four → they **discard** the layout's `openGraph`, `url` included. ✘

Hence Task 3. The asymmetry is the trap; it is not symmetric and it is not intuitive.

**D3 — the three not-found artifacts are a ruled exception, accepted and recorded.**

`out/404.html`, `out/404/index.html` and `out/_not-found/index.html` are **byte-identical** (md5
`bea54d5e…` at creation) and all three carry the canonical `${SITE_ORIGIN}/_not-found/` — a URL that is
not an indexable route. This is **accepted**, on one mechanical ground: Next already emits
`<meta name="robots" content="noindex"/>` on that route, verified in the current export, so the
canonical is inert to every crawler that honours it.

**Do not** add a metadata export to `not-found.tsx` to "fix" this, and do not special-case the route
in the layout. Both cost more than the defect. Task 4.7 pins the exception to exactly those three
paths so a fourth cannot appear silently.

**D4 — `/about`, `/glossary` and `/compare` get their canonical from the layout, and this story adds
no metadata export to any of them.**

All three carry standing docblock rulings refusing `export const metadata` — `/compare`'s is the
strongest (`compare/page.tsx:16-38`: "`export const metadata` IS NOT TAKEN, AND THAT IS A RULING"),
and the reason in every case is that a metadata export **mints i18n keys that are dead by
construction** while the `<title>`/OG-stays-Spanish decision is open (D17 closed the ruling; the key
question was filed once, owner Juan).

A canonical URL is **not a translated string**. `alternates.canonical` and `openGraph.url` mint no
locale keys, are not reachable by the i18n metadata selector, and take no position on the `<title>`
question. So the layout route satisfies AC3 for all three **without** touching those rulings — which
is precisely why D1 is shaped the way it is.

**D5 — the guard asserts over the WHOLE export, and pins by relative path alone.**

1,407 files, 38.2 MB, 3.3 s of I/O — measured, affordable. There is therefore no sampling decision to
make and **no entity id in the test file at all**, which is A2 discharged in its strongest form. The
per-file expected URL is derived from the file's own path, so the guard cannot be satisfied by a
canonical that is correct on one route and copied to 1,405 others.

Contrast with the shape A2 forbids, which is shipped one directory away:
`players/static-output.test.ts:126` pins on a `QUINONES` constant — an id the fixture corpus and the
real corpus both carry. Do not follow that file's pattern here.

**D6 — no second origin literal, and the test file is where it will try to sneak in.**

`site-origin.test.ts` scans `src/**`, `scripts/**` and `app/*.{ts,mjs,json,toml}` and asserts the
string `https://mundial-stats.juancr.dev` occurs **exactly once**, in `src/lib/site-origin.ts`. A test
that hardcodes the expected canonical for readability turns that suite red. Import `SITE_ORIGIN` and
build expectations from it. Same for `layout.tsx`.

**D7 — no `hreflang`, no `alternates.languages`, no `x-default`, no per-locale routes.** D17, upheld
by D20. Task 4.8 turns the ruling into a gate. The re-open trigger is Google Search Console data no
earlier than 2026-11-24, and 3.4's sitemap is the instrument.

**D8 — ~~`openGraph: { url: "./" }` alone on the layout emits `og:url` and nothing else.~~**
**OVERTURNED BY THE CODE REVIEW, 2026-08-26 — measured on the real export, not reasoned.**

The ruling as written: "`resolveOpenGraph` resolves `title` only from `openGraph.title`
(`resolve-opengraph.js:150`), so no `og:title` is invented for `/about` etc. That is correct and
intended: AC2 asks that `og:url` agree with the canonical on every route, not that every route grow
a full card. Story 3.3 owns the card."

**That is false, and `resolve-opengraph.js:150` is not the last word.** `postProcessMetadata`
(`resolve-metadata.js`) back-fills `autoFillProps.title`/`description` from the page metadata
whenever `openGraph` is non-null, then runs `resolveTwitter` over the same props. Declaring the key
AT ALL is what triggers it. Before this story those routes resolved `openGraph === null` and carried
no og/twitter tag whatsoever; measured after it, `/about`, `/glossary`, `/compare`, `404.html`,
`404/index.html` and `_not-found/index.html` each carry SIX new tags:

```
out/compare/index.html
  <meta property="og:title"       content="WC Stats — Analítica del Mundial 2026"
  <meta property="og:description" content="Análisis táctico y estadístico de los 104 partidos…"
  <meta property="og:url"         content="https://mundial-stats.juancr.dev/compare/"
  <meta name="twitter:card">  <meta name="twitter:title">  <meta name="twitter:description">
```

**RULED AT REVIEW (Juan, 2026-08-26): the card stays.** Reverting the key is not available — it
would strip `og:url` from those routes and break AC2 and the byte-identity case. The card is the
price of AC2 and is accepted, including on the not-found artifacts (D3's `noindex` reasoning stands;
opening `not-found.tsx` costs more than the defect). Two consequences follow:

- `og:locale: "es_ES"` is now set at ALL FIVE `openGraph` declaration sites. The layout alone would
  have reached only the four static routes — the same wholesale-replacement asymmetry that made
  `url: "./"` need four copies — leaving 1,402 Spanish documents advertising the Open Graph
  default, `en_US`. One locale per route is a constant, not a variable (D17, upheld by D20).
- **Story 3.3 does NOT own the card on those four routes; it inherits one already there**, and it no
  longer adds `locale`. See the corrected Task 8.5 hand-off.

**D9 — verification environment.** The shared tree is dirty and `app/src/app/static-output.test.ts`
currently imports `NAV_DESTINATIONS` from an **untracked** file, so the shared tree's suite depends on
another story's uncommitted work. If it does not build or typecheck, verify in an isolated worktree at
`baseline_commit` plus your File List:

- Put the worktree at a **short** path (`C:/wt32`), never under the scratchpad — BMad's story
  filenames overflow Windows `MAX_PATH` and `git worktree add` dies mid-checkout.
  `git sparse-checkout set app contract data` skips `_bmad-output` and is much faster.
- **Do not junction `node_modules`.** Turbopack rejects it ("Symlink … points out of the filesystem
  root"); `lint`, `tsc` and vitest tolerate it. Use
  `robocopy <shared>\app\node_modules C:\wt32\app\node_modules /E /MT:16 /NFL /NDL /NJH /NJS /NP`
  (~0.49 GB, ~27 s). Robocopy exit 1 means "files copied" and is success. `npm ci` there dies on
  Windows `ENOTEMPTY`.
- **Build before the suite** or ~97 export-block tests skip and the `0 skipped` number is lost.
- A fresh worktree is HEAD, so it will **not** carry 3-10's untracked files — which is exactly what
  makes it a clean measurement.

**D10 — what `39889bf` changed, and what this story must therefore verify by running.**

Story 3.1's first cut removed one false positive and opened **four false negatives**, each verified as
exit 0 on the shipped gate against exit 1 on `f07116b`. The review closed them. What survives into this
story:

- The self-origin allowance is now **position-scoped**: `SELF_ORIGIN_POSITIONS = new Set(["<link href>"])`
  (`assert-no-external-origins.mjs:205`), plus `allowed(url, true)` on the two informational passes.
  `src`, `srcset`, `fetch()`, `Worker`, XHR and friends are gated on origin exactly as before 3.1. A
  self-origin canonical passes **twice over**: `rel="canonical"` is in `NON_FETCHING_RELS` (`:258`) and
  short-circuits before `allowed()` is reached at all, and the `<link href>` position would allow it
  anyway.
- `og:url` is a `<meta content>` URL, which is **deliberately absent** from `FETCHING_POSITIONS`
  (D3-1-d, D20-b). The gate correctly cannot see it. Nothing to do; do not "improve" this.
- `FETCH_HOST_PREFIX` now prefix-matches the **trimmed** href instead of full-matching it, and both
  attribute readers carry `(?<![-\w:])` so `data-href` / `data-rel` no longer decoy or spoof.

**Probed at creation**, post-review gate, on a fixture carrying `<link rel="canonical">` +
`<meta property="og:url">` + a `data-precedence` stylesheet link: **exit 0, 0 external subresources,
and no self-origin on the MENTIONED line.** Task 6 repeats it on the real 1,406-route export and then
falsifies it, which is what AC5 actually asks for.

### Existing code this story reads — read these before writing anything

| Path | What matters |
|---|---|
| `app/src/lib/site-origin.ts` | The one definition. Its docblock names **this story** as first consumer, and pins the shape: one line, bare origin, no trailing slash, so `new URL(SITE_ORIGIN).origin === SITE_ORIGIN`. |
| `app/src/lib/site-origin.test.ts` | The drift gate. 2 cases. Goes red on a second literal. |
| `app/src/app/layout.tsx` | 58 lines. `export const metadata: Metadata = { title, description }` at `:22`. The **only** layout. Do not touch the pre-paint script, `suppressHydrationWarning`, or `lang="es"`. |
| `app/src/app/page.tsx` | `generateMetadata()` at `:68` returns `{ title, description, openGraph: { title, description } }`. The named Epic 3 collision path. |
| `app/src/app/matches/[slug]/page.tsx` | `generateMetadata` at `:29`, same return shape. |
| `app/src/app/players/[slug]/page.tsx` | `generateMetadata` at `:62`, same return shape. |
| `app/src/app/teams/[slug]/page.tsx` | `generateMetadata` at `:79`, same return shape. |
| `app/next.config.ts` | `output: "export"`, `images.unoptimized`, `trailingSlash: true` at `:9`. Not edited by this story. |
| `app/src/app/static-output.test.ts` | **3-10 holds it — do not modify.** Read it for the `describe.skipIf` / `OUT_DIR` / partial-export conventions the new guard should match. |
| `app/eslint.config.mjs:208` | The i18n metadata selector. `canonical` and `url` are not in its key regex. |
| `app/scripts/assert-no-external-origins.mjs` | The gate. Not edited. `:205` position scoping, `:258` `NON_FETCHING_RELS`, `:297` `FETCH_HOST_PREFIX`. |

### Next 16 API surface — verified against the installed `next@16.2.11`

- `metadataBase` accepts a `URL`. `new URL(SITE_ORIGIN)` with a bare origin gives pathname `/`.
- `alternates.canonical` accepts a string, a `URL`, or `{ url, title }`
  (`resolve-basics.js:103-110`). A relative `"./"` string is what D1 uses.
- The emitted tag is `<link rel="canonical" href="…"/>` (`metadata.js:447-455`).
- `openGraph.url` goes through the **same** resolver as the canonical
  (`resolve-opengraph.js:153`), which is why byte-equality (AC2) is achievable rather than
  approximate.
- With **no** `metadataBase`, `"./"` resolves to a bare relative path — no origin — which is what
  makes Task 5.1's red proof clean and immediate.

### Testing standards

- Vitest, node environment, no jsdom. `vitest.config.ts` includes `src/**/*.test.{ts,tsx}` and aliases
  `@` → `./src`, so `src/app/canonical-output.test.ts` is collected automatically.
- Export-reading suites live beside the routes they check and follow the four shipped
  `static-output.test.ts` files: `OUT_DIR` from `import.meta.url`, `describe.skipIf(!anyBuilt)`, a
  partial export fails rather than skips.
- Failure messages name **files**, not counts (`site-origin.test.ts:89-95`).
- I/O-bound cases carry an explicit timeout; the shipped precedent is 20 s for 194 files / 3 MB.

### Project Structure Notes

- Five files modified, one created. No new directory, no new dependency, no config change.
- `app/public/` still does not exist and this story does not create it — that is 3.3's.
- No contract change, no `schemaVersion` bump, no route-count change, `$0/month` preserved.

### Regression surface — checked at creation, all clear

- No existing test asserts a `<link>` or `<meta>` **count** in the head, so adding a canonical and an
  `og:url` breaks no count assertion (grepped across all five `static-output.test.ts` suites).
- `players/static-output.test.ts:126` asserts `not.toContain("og:image")` — `og:url` does not contain
  `og:image`. `teams/static-output.test.ts:140` reads `og:image` specifically. Both safe.
- The i18n metadata selector does not gate `canonical` or `url`.
- The origin gate does not see `<meta content>` and treats `rel="canonical"` as a navigation hint.
- No `deferred-work.md` entry names story 3-2 as owner; nothing to close in the ledger.

### Previous story intelligence — Epic 3 so far

- **3.1 (`done`, review at `39889bf`)** — the gate stopped failing on four things it used to catch, and
  all 23 tests were green over it. The lesson this story inherits: **a green gate is a claim about the
  gate.** AC5 and Task 6.2 exist because of it. 3.1 also proved the parity discipline that closed it —
  every regression case was RED before the fix, verified as exit 0 on the defect and exit 1 on
  `f07116b`.
- **3.4 (`ready-for-dev`)** — ruled three things at creation rather than at dev time, including that
  the sitemap is **1,404** entries, not the epic's 1,406 (the delta is `404/` and `_not-found/`). Same
  decomposition this story's Task 1.6 uses. 3.4 also ruled that non-entity routes are **discovered,
  not listed**, for the same reason D1 puts the canonical on the layout.
- **3.10** — aborted at Task 1.4 (`9a4e4e8`) because another story held two files it had to rewrite.
  That abort is the A3 precedent AC6 invokes, and it was the correct call.
- **3.5, 3.6, 3.8 (`done`)** — 3.5 verified its full chain in a worktree precisely because the shared
  tree was not its story's; §D9 is that recipe.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2` (`:1138-1162`)] — the four ACs.
- [Source: `_bmad-output/planning-artifacts/epics.md#Standing acceptance criteria` (`:1074-1106`)] — A1–A6.
- [Source: `_bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md#Review Findings`] —
  the four false negatives, the three rulings, and the resolution.
- [Source: `_bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md#Downstream contracts`] —
  names this story's `metadataBase` import explicitly.
- [Source: `_bmad-output/implementation-artifacts/3-4-sitemap-robots.md#Decisions ruled at story creation`] —
  the 1,404/1,406 decomposition and the discovered-not-listed principle.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:4163`] — D17: accept ES canonical.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:4370-4395`] — D20-a re-open trigger
  (no earlier than 2026-11-24) and D20-b.
- [Source: `app/src/lib/site-origin.ts`] — the constant, its shape constraints, and its consumer list.
- [Source: `next@16.2.11` `dist/lib/metadata/resolvers/resolve-url.js:99-135`] — relative-URL and
  trailing-slash resolution.
- [Source: `next@16.2.11` `dist/lib/metadata/resolve-metadata.js:170-186, 745-800`] — per-key merge
  and the single threaded `pathname`.
- [Source: `next@16.2.11` `dist/lib/metadata/resolvers/resolve-opengraph.js:134-154`] — `openGraph`
  replacement and `url` resolution.

### Validation pass (A5) — performed at story-creation time against `8750d85`

Every mechanism below was **executed**, not recalled.

**1. The resolver, called directly with this story's exact inputs** (`metadataBase` =
`new URL("https://mundial-stats.juancr.dev")`, `trailingSlash: true`, url `"./"`):

| route pathname | resolved |
|---|---|
| `/` | `https://mundial-stats.juancr.dev/` |
| `/about` | `https://mundial-stats.juancr.dev/about/` |
| `/compare` | `https://mundial-stats.juancr.dev/compare/` |
| `/glossary` | `https://mundial-stats.juancr.dev/glossary/` |
| `/players/l-messi` | `https://mundial-stats.juancr.dev/players/l-messi/` |
| `/teams/mexico` | `https://mundial-stats.juancr.dev/teams/mexico/` |
| `/matches/m001-mexico-south-africa` | `https://mundial-stats.juancr.dev/matches/m001-mexico-south-africa/` |
| `/_not-found` | `https://mundial-stats.juancr.dev/_not-found/` |

With `metadataBase` omitted: `/players/l-messi` → `/players/l-messi` (relative, no origin) — Task 5.1's
red proof.

**2. The post-review origin gate over a canonical fixture.** A tree carrying
`<link rel="canonical" href="https://mundial-stats.juancr.dev/players/foo/">`,
`<meta property="og:url" content="…">`, a `data-precedence` stylesheet link and an outbound `<a href>`:
`2 text asset(s), 0 external subresources, EXIT=0`, and **no self-origin on the MENTIONED line**.

**3. The gate over the real 1,406-route export at HEAD**: exit 0, 12,684 text assets, 0 external
subresources, 6 MENTIONED origins (none of them the site's), ~28 s.

**4. Export shape.** 1,406 `index.html` + `out/404.html` = 1,407 `.html`, 38.2 MB, 3.3 s to read all.
`out/404.html`, `out/404/index.html` and `out/_not-found/index.html` are byte-identical (md5
`bea54d5ec85f6a8b2de07aff5bf6bc28`) and already carry `<meta name="robots" content="noindex"/>`.
Zero entity slugs contain a dot.

**5. Ownership.** All five owned paths clean at `8750d85`; `canonical-output.test.ts` absent.

**6. Lint surface.** `eslint.config.mjs:208`'s metadata key regex is
`^(title|description|default|template|absolute|alt|siteName)$` — `canonical` and `url` are outside it.

**7. Test collection.** `npx vitest list` → 1,468 tests / 58 files **including 3-10's untracked test
files**; not a clean-HEAD baseline, which is why Task 1.5 re-measures.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via the `bmad-dev-story` workflow.

### Debug Log References

**Verification environment (Task 1.8): an isolated worktree, and the measurement that forced it.**

The shared tree was NOT usable for measurement. `app/out/` there was another session's build — the
origin gate over it reported **7 MENTIONED origins (including `http://www.sitemaps.org`) and 8,518
text assets**, against the 6 / 12,684 recorded at story creation, and `out/robots.txt` was present
while `out/sitemap.xml` was not. `npx vitest list` there collected **1,488 tests / 59 files** because
story 3.4's untracked `sitemap.test.ts` was in the tree. Neither number is this story's.

Worktree per §D9, and both Windows walls were real:

- `git worktree add --no-checkout --detach C:/wt32 HEAD`, then
  `git sparse-checkout init --cone && git sparse-checkout set app contract data && git checkout`.
- `node_modules` by **robocopy, not junction**:
  `robocopy <shared>\app\node_modules C:\wt32\app\node_modules /E /MT:16 /NFL /NDL /NP`
  → **3,073 dirs / 31,753 files / 497.65 MB / 0 errors** in ~22 s. Robocopy **exit 1 means "files
  copied" and is success**; the same command run through the Bash tool returned exit 16 and copied
  nothing, so it was run through PowerShell instead.
- Built before every suite run, or the ~97 export-block cases skip and the `0 skipped` number is lost.

The worktree at `baseline_commit` reproduced the creation-time numbers **exactly** — 6 MENTIONED
origins, 12,684 text assets, 0 external subresources, 1,406 `index.html` / 1,407 `.html` / 38.2 MB,
1,468 tests / 58 files. That agreement is what established the worktree as the honest instrument and
the shared tree as the contaminated one.

**Two concurrent commits landed mid-story**, after every Task 2–7 measurement had been taken at
`fa3be57`: `5754522` (story 3.4 → review) and `0595cb0` (story 3.10 code review). Rather than report a
chain proved green against a superseded tree, the worktree was moved forward to `0595cb0` with this
story's six files re-applied on top, and **the whole of Tasks 6 and 7 was re-run there**. Every number
in the completion notes below is from that second, merge-forward pass unless explicitly labelled a
baseline. `git diff --numstat` against `0595cb0` was identical to the diff against `fa3be57`, so the
two trees differ only in other stories' work.

### Completion Notes List

**Task 2 — §D1 measured on the real export, not inferred.** With ONLY `metadataBase` and
`alternates: { canonical: "./" }` on the root layout and nothing else changed, the build emitted:

| exported file | `<link rel="canonical">` |
|---|---|
| `out/index.html` | `https://mundial-stats.juancr.dev/` |
| `out/about/index.html` | `https://mundial-stats.juancr.dev/about/` |
| `out/glossary/index.html` | `https://mundial-stats.juancr.dev/glossary/` |
| `out/compare/index.html` | `https://mundial-stats.juancr.dev/compare/` |
| `out/players/aaronson-brenden-usa/index.html` | `https://mundial-stats.juancr.dev/players/aaronson-brenden-usa/` |
| `out/matches/m001-mexico-south-africa/index.html` | `https://mundial-stats.juancr.dev/matches/m001-mexico-south-africa/` |
| `out/teams/algeria/index.html` | `https://mundial-stats.juancr.dev/teams/algeria/` |
| `out/404.html`, `out/404/index.html`, `out/_not-found/index.html` | `https://mundial-stats.juancr.dev/_not-found/` |

All ten match the resolver values recorded at creation. **The `"./"` form resolves per route, absolute
and trailing-slashed, from a single line on the root layout** — so §D1's rejected per-route-literal
fallback was not needed and was not taken. Route count `1406/1406`, unchanged (Task 2.4). At this
point `og:url` was absent from all ten, which is exactly §D2's asymmetry: `alternates` is inherited,
`openGraph` is not.

**Task 5 — A1/AC7: the guard driven RED in all four directions.** Command in every case:
`npx vitest run src/app/canonical-output.test.ts`.

- **(a) `metadataBase` removed from `layout.tsx`, rebuilt.** **4 of 8 cases RED.** First failure:
  `AssertionError: expected '404.html -> /_not-found, 404/index.ht…' to be ''` — the
  absolute/same-origin/trailing-slash case. The export emitted `<link rel="canonical" href="/"/>` on
  the home page and `href="/about"` on `/about`: **relative, no origin, no trailing slash**, precisely
  the mechanism §D1 predicted. The own-route case, the D3 exception-set case and the not-found
  inertness case fell with it. `og:url` stayed byte-identical (both went relative together), which is
  itself correct behaviour and is why (b) is a separate proof.
- **(b) `url: "./"` removed from `players/[slug]/page.tsx`'s `openGraph`, rebuilt.** **Exactly 1 of 8
  cases RED** — the byte-identity case, and nothing else. The failure message named
  **1,248 player files and zero files from any other route family**
  (`players/aaronson-brenden-usa/index.html og:url=(none) canonical=…`), matching the story's
  predicted count exactly. This is the proof that the four `generateMetadata` routes really do
  discard the layout's `openGraph`.
- **(c) A second `<link rel="canonical" href="…/glossary/"/>` injected into `out/about/index.html`**
  (no rebuild). **Exactly 1 of 8 cases RED**: `expected 'about/index.html (2)' to be ''` — the
  offending relative path named, not a bare count. All seven other cases stayed green. Restored.
- **(d) Two shape breaks in two different files** (no rebuild): `out/glossary/index.html`'s canonical
  lost its trailing slash, and `out/compare/index.html`'s canonical was rewritten to name `…/about/`
  — an existing, correctly-shaped, same-origin route. Results:
  - `glossary/index.html` → the **absolute/same-origin/slashed** case RED, naming it;
  - **CORRECTED AT CODE REVIEW 2026-08-26 — the attribution above is too narrow.** Re-driving the
    `glossary` trailing-slash break ON ITS OWN turns **four** cases red, not one: absolute/slashed,
    own-route, the D3 exception set, and byte-identity all fail on that single file, because a
    canonical missing its slash no longer equals `servedUrl()` and no longer equals its `og:url`.
    The count in the record (`4 failed | 4 passed`) is right; the per-file attribution split those
    four across the two mutations as though `compare` caused three of them. It did not — and the
    `compare` bullet below is still the load-bearing one, because it is the only mutation that
    leaves the shape cases GREEN. Nothing about the guard changes; only the record does.
  - `compare/index.html` → the **own-route** case RED, naming it and the URL it should have carried;
  - and **the "exactly one canonical" and "absolute/same-origin/slashed" cases stayed GREEN on
    `compare`** — which is the entire justification for the own-route case existing. A canonical that
    is correctly shaped but names another route is invisible to every other assertion in this file.
  - The D3 exception-set case also caught `compare` as an unexplained fourth mismatch, and the
    byte-identity case caught the resulting `og:url` disagreement. Both files restored.
- **(5.5)** Both source files restored from the shared tree, rebuilt: **8/8 green**.

**Task 6 — AC5: the origin gate over the real export, then falsified.**

- **6.1** `npm run assert:no-external-origins` over the export carrying all 1,406 canonicals and all
  1,406 `og:url`s, on `0595cb0` + this story: **EXIT 0**, `7 external origin(s) MENTIONED`
  (`http://www.sitemaps.org`, `https://bit.ly`, `https://github.com`, `https://nextjs.org`,
  `https://react.dev`, `https://redux-toolkit.js.org`, `https://redux.js.org`), **12,686 text
  asset(s), 0 external subresources**. **`mundial-stats.juancr.dev` is absent from the MENTIONED
  line**, as AC5 requires.
  **Delta against the Task 1.7 baseline (6 origins / 12,684 assets), fully accounted for:** `+1`
  origin and `+2` text assets, both from **story 3.4**, which landed `sitemap.ts` and `robots.ts`
  between the baseline and this run. `www.sitemaps.org` is the sitemap's XML namespace declaration;
  the two assets are `out/sitemap.xml` and `out/robots.txt`. **This story contributes zero to the
  delta** — the same gate over the identical export at `fa3be57` + this story reported 6 origins /
  12,684 assets, i.e. the baseline unchanged. §D10's position-scoping analysis holds on the real
  export: 1,406 self-origin canonicals are short-circuited by `NON_FETCHING_RELS`, and 1,406
  self-origin `og:url`s are `<meta content>`, which the gate deliberately does not read.
- **6.2 — the falsification, which is the half that matters.**
  `<link rel="stylesheet" href="https://cdn.evil.example.com/x.css"/>` injected before `</head>` of
  `out/glossary/index.html`, same tree, same command: **EXIT 1**, `1 EXTERNAL SUBRESOURCE(S) in the
  export`, `<link href>  https://cdn.evil.example.com/x.css` at `glossary\index.html`. The gate **can
  fail on the export it just passed**, so its exit 0 is a result and not merely a claim — which is
  the lesson `39889bf` cost. File restored, gate re-run: **EXIT 0**.
- **6.3** `site-origin.test.ts` (2 cases) and `assert-no-external-origins.test.ts` (27 cases):
  **29/29 pass, both files unedited**. AC1's "no second origin literal" holds — the new guard imports
  `SITE_ORIGIN`, and `grep -c "mundial-stats" src/app/canonical-output.test.ts` returns **0**.

**Task 7 — full chain on `0595cb0` + this story.**

- **7.1** `npm run lint` → **exit 0**. Confirms by running, not by reading, that `eslint.config.mjs`'s
  i18n metadata selector does not gate `canonical` or `url`, so the `"./"` literals are not flagged.
- **7.2** `npx tsc --noEmit` → **exit 0**.
- **7.3** `npm run build` → **green end to end** (lint, typecheck, schema assert, `next build`,
  `copy-data`, origin gate).
- **7.4** `npx vitest run` → **60 files / 1,496 tests / 0 skipped / 0 failed**, 22.3 s.
  Baselines and delta: clean worktree at `fa3be57` = **58 / 1,468 / 0**; this story there = **59 /
  1,476 / 0**; `main` at `0595cb0` alone = **59 / 1,488 / 0** (3.4's `sitemap.test.ts` is the extra
  file); with this story = **60 / 1,496 / 0**. **Delta in both trees is exactly +1 file / +8 tests /
  0 newly skipped** — the new guard and nothing else.
- **7.5** The four shipped `static-output.test.ts` suites pass, both in the full sweep and targeted:
  `players/static-output.test.ts:126`'s `not.toContain("og:image")` and
  `teams/static-output.test.ts:140`'s `metaContent(html, "og:image")` both **pass** — `og:url` does
  not contain `og:image`, checked by running rather than by reasoning.
- **7.6** **1,406 `index.html` / 1,407 `.html`**, unchanged from the Task 1.6 baseline. This story
  adds no route and loses none.

**Task 7 re-run a THIRD time, at `4133195`, and that is the commit this story is verified against.**
Story 3.10's 26 review patches landed while the record above was being written, touching
`static-output.test.ts`, `globals.css`, `SiteNav`, `HeaderSearch`, `nav-destinations`,
`CompareChartsSection` and `locales/es.ts` — none of this story's five owned paths, but enough of the
export that reporting a chain green against `0595cb0` would have been reporting a superseded tree. The
worktree was moved forward once more with the same six files on top (`git diff --numstat` again
identical: 35/10/10/10/10) and the chain re-run end to end:

| check | result at `4133195` |
|---|---|
| `npm run build` (lint, typecheck, schema assert, `next build`, `copy-data`, origin gate) | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| origin gate | **exit 0**, 7 MENTIONED origins, **`mundial-stats.juancr.dev` absent**, 12,687 text assets, **0 external subresources** |
| `npx vitest run` | **60 files / 1,504 tests / 0 skipped / 0 failed**, 20.7 s |
| route count | **1,406 `index.html` / 1,407 `.html`** — unchanged |

`main` at `4133195` alone collects 59 files / 1,496 tests, so the delta is **+1 file / +8 tests / 0
newly skipped** here too — the same figure measured in all three trees. The `+1` text asset over the
`0595cb0` run (12,686 → 12,687) is story 3.10's, not this story's.

**Task 4 — why the guard is a new file, per A3.** `app/src/app/static-output.test.ts` was the natural
home, and story 3-10 held it for the whole of this story (it is still dirty in the shared tree). A3
forbids **modifying** a file another session holds — but it does not force an abort here, because
this story needed an *assertion*, not that file, and an assertion can live in a file of its own. The
new guard deliberately reuses that file's `OUT_DIR` / `describe.skipIf` / partial-export-fails-loudly
conventions so the two read as one family.

**A2 discharged in its strongest form.** `canonical-output.test.ts` contains **no entity id at all**.
Every expected URL is derived from the file's own relative path, so there is nothing left to pin and
no id the fixture corpus and the real corpus could share. `players/static-output.test.ts:126`'s
`QUINONES` constant is one directory away and was not copied. The suite also asserts it walked a
**whole** export (structural spine present, all three route families non-empty, exactly one non-index
document) so a partial export fails loudly instead of passing every case vacuously — the
`scanned === 0` lesson applied to a walk.

**AC4 upheld.** No `alternates.languages`, no `hreflang`, no `x-default` and no per-locale URL was
added, and the guard's last case asserts no `hreflang` exists anywhere in the export. D17/D20 stay
ruled.

**Hand-off to story 3.3 (Task 8.5).** 3.3 edits all four route files to add `openGraph.images`,
`type`, `locale` and `siteName`. **It must not drop `url: "./"` from any of them.** A wholesale
rewrite of those `openGraph` objects is silent at build time and would ship 1,406 canonicals with no
matching `og:url`. Two things stand in its way, deliberately: the docblock added above each of the
four returns says so in the file 3.3 will have open, and the byte-identity case in
`canonical-output.test.ts` turns red across every affected route — proved above at 1,248 files for
`/players/[slug]` alone. 3.3 should also note that the layout now carries `openGraph: { url: "./" }`,
which is what gives `/about`, `/glossary`, `/compare` and the 404 an `og:url` without any of them
growing a `metadata` export (§D4's rulings are untouched).

### File List

`git diff --numstat` against `0595cb0`, read from the command:

| File | + | − | Status |
|---|---|---|---|
| `app/src/app/layout.tsx` | 35 | 0 | modified — `metadataBase`, `alternates.canonical`, `openGraph.url`, `SITE_ORIGIN` import, docblock |
| `app/src/app/page.tsx` | 10 | 1 | modified — `openGraph.url` + survival docblock |
| `app/src/app/matches/[slug]/page.tsx` | 10 | 1 | modified — `openGraph.url` + survival docblock |
| `app/src/app/players/[slug]/page.tsx` | 10 | 1 | modified — `openGraph.url` + survival docblock |
| `app/src/app/teams/[slug]/page.tsx` | 10 | 1 | modified — `openGraph.url` + survival docblock |
| `app/src/app/canonical-output.test.ts` | 312 | — | **new** — the 8-case export-wide canonical guard |
| `_bmad-output/implementation-artifacts/3-2-metadatabase-canonical-urls.md` | — | — | modified — this record |

Totals for the five modified source files: **75 insertions, 4 deletions**. No new directory, no new
dependency, no config change, no contract change, no `schemaVersion` bump, no route-count change.
`app/public/` still does not exist. All six source files are LF, verified.

### Ownership Probe (Task 1)

Run at `fa3be57` (`git rev-parse HEAD` at dev time; the frontmatter `baseline_commit` records the
`8750d85` this story was **sized** against and is preserved unchanged).

`git status --porcelain` at probe time:

```
 M _bmad-output/implementation-artifacts/3-4-sitemap-robots.md
?? 17
?? app/src/app/robots.ts
?? app/src/app/sitemap.test.ts
?? app/src/app/sitemap.ts
```

- **All five owned paths CLEAN** — `layout.tsx`, `page.tsx`, `matches/[slug]/page.tsx`,
  `players/[slug]/page.tsx`, `teams/[slug]/page.tsx`. **`page.tsx`, the named Epic 3 collision path,
  was clean.** No abort. AC6 satisfied by probe rather than by assumption.
- `app/src/app/canonical-output.test.ts` did not exist — clean for a NEW path.
- **The concurrent set had MOVED since story creation (Task 1.3), and re-verifying rather than
  assuming was the right call.** 3-10's files were no longer untracked — they had been committed at
  `d073575`, so `static-output.test.ts`, `SiteNav.tsx` and `nav-destinations.ts` were tracked and
  clean, and the §D9 blocker ("the suite imports `NAV_DESTINATIONS` from an untracked file") no
  longer applied. What held the tree instead was **story 3-4**: `robots.ts`, `sitemap.ts`,
  `sitemap.test.ts` untracked plus its story file. **None of those is a path this story modifies.**
- `app/src/lib/site-origin.ts` committed at `432dc29`, clean, value `https://mundial-stats.juancr.dev`
  (Task 1.4).
- **Ownership held for the whole story.** Re-checked at commit time, after two other sessions had
  dirtied eleven further files (`globals.css`, `static-output.test.ts`, `SiteNav.tsx(+test)`,
  `HeaderSearch.tsx(+test)`, `SiteSignature.test.tsx`, `nav-destinations.ts(+test)`, `locales/es.ts`,
  `CompareChartsSection.tsx`) and landed two commits: `git diff` over the five owned paths still
  showed **only this story's 75 insertions / 4 deletions**. No other session touched them.
- **A4** — staged by pathspec, seven paths named explicitly, via `git commit -- <paths>`. Never
  `git add -A`. The stray 0-byte `17` in the repo root was **not** staged and remains untracked.

## Change Log

| Date | Change |
|---|---|
| 2026-08-26 | Implemented. `metadataBase` + `alternates: { canonical: "./" }` + `openGraph: { url: "./" }` on the root layout; `url: "./"` plus a survival docblock in the four `generateMetadata` routes; new 8-case export-wide guard `canonical-output.test.ts`. §D1 measured on the real export (all ten predicted canonicals exact), so the per-route-literal fallback was not taken. Guard driven RED in all four AC7 directions; origin gate run over 1,406 canonicals AND falsified to exit 1 on the same tree. Verified in an isolated worktree, then re-verified merge-forward onto `4133195` after three concurrent commits landed: build/lint/tsc green, 60 files / 1,504 tests / 0 skipped, route count 1,406 unchanged. |
| 2026-08-26 | Story context created against baseline `8750d85`. A3 probe: all five owned paths clean. Ten decisions ruled at creation (§D1–D10), the resolution mechanism executed against the installed `next@16.2.11` rather than inferred, and the post-review origin gate probed on both a canonical fixture and the real 1,406-route export. |

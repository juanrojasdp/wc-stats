---
baseline_commit: 8750d85f74584c6fe899527db8463fbd9196993b
---

# Story 3.4: `sitemap.xml` & `robots.txt`

Status: review

**Baseline commit sized against:** `8f1c4fc` (`Story 3.5 -> done: full chain verified in a worktree…`).
Story 3.1's code is committed at `432dc29` + `117311c`; **3.1 itself is at `review`, not `done`, and a
code-review session is patching `app/scripts/assert-no-external-origins.mjs` and
`app/src/lib/assert-no-external-origins.test.ts` in the shared tree right now.** §D2 records what that
patch does and why it does not move this story. Re-run the Task 1 probe before touching anything.

## Story

As a search engine,
I want an enumerable list of every route the site publishes,
so that all 1,404 indexable pages are discoverable — and so the D20-b re-open trigger becomes
measurable rather than indefinite (FR-36, NFR-4).

## Acceptance Criteria

**AC1 — two static metadata routes, no runtime.**
**Given** `app/src/app/sitemap.ts` and `app/src/app/robots.ts` as Next 16 metadata routes under
`output: 'export'`
**When** `npm run build` runs
**Then** both are emitted as **flat static files at the export root** — `app/out/sitemap.xml` and
`app/out/robots.txt`, *not* `out/sitemap.xml/index.html` — with no function, no middleware, no
`process.env` read and no runtime data fetch (AD-13, NFR-8 preserved, `$0/month` unchanged).
**And** `netlify.toml` is not edited: no redirect, no header, no plugin.

**AC2 — the sitemap is derived, never enumerated.**
**Given** the route manifest `data/index/tournament.json` `entities` — the same source
`generateStaticParams` reads (`build-data.ts` `readTournament()`)
**When** the sitemap is composed
**Then** the match, player and team URLs come from `entities.matches` / `.players` / `.teams` by
`.map`, with **no length literal, no slice, no filter and no hard-coded slug** anywhere in
`sitemap.ts`.
**And** the non-entity routes are **discovered from the app route tree**, not listed: UX-DR24's
`/tournament`, `/tops`, `/players` and `/teams` land in story 3.9, which has **not** shipped, and this
sitemap must pick them up when they appear without an edit here. **Do not hard-code them and do not
wait for them.**

**AC3 — every entry is trailing-slashed and self-origin.**
**Given** `next.config.ts` sets `trailingSlash: true`, so Netlify serves `/players/x/`
**When** the `<loc>` entries are written
**Then** every one is absolute, begins with `SITE_ORIGIN` imported from `@/lib/site-origin`, and ends
with `/`. A sitemap URL that disagrees with what the host serves is worse than none.
**And** `sitemap.ts` and `robots.ts` contain **no origin literal**: `site-origin.test.ts` asserts
mechanically that the string appears exactly once under `app/`, and this story is one of the three
consumers that docblock names.

**AC4 — `/compare` is listed bare.**
**Given** `/compare`'s content is selection-dependent and query-driven
**When** the sitemap is composed
**Then** only `${SITE_ORIGIN}/compare/` is listed. No `?` appears in any `<loc>`; parameterized
variants are excluded as near-duplicate noise.

**AC5 — the bijection assertion, and it ships red-proven in BOTH directions.**
**Given** a sitemap listing a URL that 404s is worse than no sitemap
**When** the guard is written
**Then** it reuses the existing route-bijection pattern
(`src/app/teams/static-output.test.ts:101`) and asserts, in both directions:
  - **manifest ↔ sitemap** — every `entities.*` id has exactly one `<loc>`, and every entity `<loc>`
    has a manifest entry;
  - **export ↔ sitemap** — every `<loc>` in `out/sitemap.xml` resolves to a real
    `out/<path>/index.html`, and every `index.html` the export emits appears in the sitemap, except
    `out/404/` and `out/_not-found/`.
**And per A1 the manifest bijection is driven RED once in EACH direction** — a manifest entry omitted
from the sitemap, and a sitemap entry absent from the manifest — **with both failing commands and
their output recorded in the completion notes.** This project has shipped gates that could not fail
four times; the Epic 2 retrospective logged it as the highest-priority systemic finding. A1 is
explicit in this AC and is not optional.

**AC6 — the origin gate passes over the sitemap, verified rather than assumed.**
**Given** `.xml` is already in the gate's `SCANNED_EXTENSIONS` (added by the 2.19 code review with a
sitemap named as the motivating case) and story 3.1 taught the gate the site's own origin
**When** `npm run assert:no-external-origins` runs over the real export
**Then** it exits 0, the site's own origin does **not** appear in the `EXTERNAL SUBRESOURCE(S)` block
or the `MENTIONED` line, and `scanned` is non-zero (not the vacuous `scanned === 0` pass).
**And** the one new external origin the sitemap introduces — `http://www.sitemaps.org`, the `urlset`
XML namespace — is confirmed **reported on the informational `MENTIONED` line and not treated as a
subresource.** Record the gate's actual stdout.

**AC7 — robots.txt points at the sitemap and blocks nothing that matters.**
**Given** `robots.ts` returns `MetadataRoute.Robots`
**When** it is emitted
**Then** `out/robots.txt` allows all user agents and carries exactly one `Sitemap:` line equal to
`${SITE_ORIGIN}/sitemap.xml`.
**And** it carries **no `Disallow: /data/`** — see D6. A test pins the absence, because "we left it
out" is not a property until something fails on its return.

**AC8 — the D20-b clock, and it is Juan's to start.**
**Given** the sitemap is live
**When** it is submitted to Google Search Console
**Then** the submission is recorded with its date, starting the 90-day D20-b clock (re-open no
earlier than **2026-11-24**).
**The dev agent does NOT attempt this.** It surfaces it to Juan as a manual task and records the date
only once Juan confirms it. Leave the AC open until then and say so.

### Standing Epic 3 acceptance criteria — they apply here in addition to the above

- **A1** — every gate above driven RED once, command and failing output in the completion notes.
- **A2** — no coincidence-green tests: pin by relative path, never by an id fixture and corpus share;
  show each guard fails when the guarded thing is reverted.
- **A3** — file-ownership probe at Task 1; abort if another session holds a file this story must
  **modify**. Story 3.10's abort at `9a4e4e8` is the precedent and was the correct call.
- **A4** — stage only this story's own paths. Never `git add -A`.
- **A5** — this context is the create-light half; a fresh-context validation pass is the hard half.
- **A6** — Epic 3 retrospective at epic close.

## Tasks / Subtasks

### Task 1 — Probe, baseline, abort conditions (AC: A3, all)

- [x] **1.1** Record `git rev-parse HEAD` as this story's baseline commit in the Dev Agent Record.
- [x] **1.2** **A3 file-ownership probe.** Run `git status --porcelain` and confirm each path this
      story OWNS is clean:
      `app/src/app/sitemap.ts`, `app/src/app/robots.ts`, `app/src/app/sitemap.test.ts` (all three are
      NEW — expect "no such path", which is clean).
      Confirm each path this story READS is unchanged in a way that matters:
      `app/src/lib/site-origin.ts`, `app/src/lib/build-data.ts`, `app/next.config.ts`.
      **ABORT** if any owned path is dirty or if `site-origin.ts`'s value has changed.
      **DO NOT abort** on `assert-no-external-origins.mjs` / `.test.ts` being dirty — they were dirty
      at story creation and §D2 rules why. Re-read §D2 and re-confirm its finding against the tree as
      it stands, then proceed.
- [x] **1.3** Confirm the concurrent-session file list has not grown into this story's three paths.
      At creation the tree was held by others at: `src/app/static-output.test.ts`, `globals.css`,
      eleven `src/components/*`, six `src/lib/*`, `src/locales/{en,es}.ts`,
      `src/viz/player-profile-model.ts`, and untracked `SiteNav.tsx(+test)` /
      `nav-destinations.ts(+test)` (story 3.10's). **None of those is a path this story touches.**
- [x] **1.4** **Re-measure the test baseline yourself.** It has moved repeatedly this epic
      (1,251 → 1,306 → 1,320 → 1,334 → 1,367) and inheriting a number is how a delta gets
      misattributed. Run `npm test` and record `<files> / <tests> / <skipped>`. Last recorded figure:
      **55 files / 1,367 tests / 0 skipped** at 3-5's close — but 3-8's and 3-10's files are in the
      tree now and 58 `*.test.ts(x)` files are on disk, so **that number is already stale.**
      If the shared tree does not compile, measure in an isolated worktree per §D9.
- [x] **1.5** **Re-measure the route baseline.**
      `find app/out -name index.html -not -path '*/_next/*' | wc -l`.
      Expected **1,406**, decomposing as 1,404 indexable + `404/` + `_not-found/`. Confirm
      `app/out` is a current build; if absent or stale, run `npm run build` first.
- [x] **1.6** Confirm the manifest counts by reading `data/index/tournament.json` — expected
      `matches 104`, `players 1248`, `teams 48` (measured at creation, `schemaVersion 4`).

### Task 2 — Prove the emission shape before writing the sitemap body (AC: 1)

- [x] **2.1** Write a **minimal** `app/src/app/sitemap.ts` returning two hard-coded entries and a
      minimal `app/src/app/robots.ts`. Run `npm run build`.
- [x] **2.2** **Verify the flat-file claim empirically.** Assert `app/out/sitemap.xml` and
      `app/out/robots.txt` exist **as files**, and that `app/out/sitemap.xml/index.html` does **not**.
      §D1 sources why this holds under `trailingSlash: true`; it is still verified, not assumed —
      this is the single highest-risk assumption in the story.
- [x] **2.3** Record the route count Next prints (expect the previous count plus `/sitemap.xml` and
      `/robots.txt`). Record the number rather than predicting it.
- [x] **2.4** Confirm no `export const dynamic` directive was needed. If the build bails to dynamic,
      add `export const dynamic = "force-static"` and record why — §D5.
- [x] Throw the two-entry bodies away once 2.2 passes. They exist to de-risk, not to ship.

### Task 3 — `sitemap.ts` (AC: 2, 3, 4)

- [x] **3.1** Import `SITE_ORIGIN` from `@/lib/site-origin` and `readTournament` from
      `@/lib/build-data`. **No origin literal, no `data/index/tournament.json` path literal.**
- [x] **3.2** Build the entity URLs by mapping the manifest 1:1, exactly as the three
      `generateStaticParams` do:
      `entities.matches → /matches/${matchId}/`, `entities.players → /players/${playerId}/`,
      `entities.teams → /teams/${teamId}/`. AD-3 makes the id the slug; do not re-derive it.
- [x] **3.3** Discover the non-entity routes from the **app route tree**, per §D4: walk
      `src/app` for directories containing `page.tsx`, skip any segment starting with `[`, map the
      root `page.tsx` to `/`. Today that yields exactly four — `/`, `/about/`, `/compare/`,
      `/glossary/` — and after story 3.9 it yields eight with **no edit to this file**. Assert the
      walk found at least one route so a mis-resolved directory fails loud instead of emitting an
      entity-only sitemap.
- [x] **3.4** Compose each entry as `{ url }` **only**. **Omit `lastModified`, `changeFrequency` and
      `priority`** — §D3.
- [x] **3.5** Type the default export `MetadataRoute.Sitemap`
      (`import type { MetadataRoute } from "next"`).
- [x] **3.6** Docblock it in this repo's register: state that the origin comes from the one
      definition, that the entity list is manifest-derived, that the static list is tree-derived so
      3.9 needs no edit here, why `lastModified` is absent, and that `/compare` is bare by AC4.

### Task 4 — `robots.ts` (AC: 1, 7)

- [x] **4.1** Return `{ rules: { userAgent: "*", allow: "/" }, sitemap: <SITE_ORIGIN>/sitemap.xml }`,
      typed `MetadataRoute.Robots`. No origin literal.
- [x] **4.2** Docblock the **absence** of `Disallow: /data/` with §D6's reason. The next reader will
      otherwise "fix" it.

### Task 5 — The bijection guard, `app/src/app/sitemap.test.ts` (AC: 5, 7, A2)

The filename is verified safe: Next's metadata matcher is
``[\\/]sitemap(?:\.xml|\.(js|jsx|ts|tsx))$`` (`next/dist/lib/metadata/is-metadata-route.js`), which
`sitemap.test.ts` does not match, and `src/app/static-output.test.ts` is the shipped precedent for a
test file living under `src/app`.

- [x] **5.1 — Layer 1, manifest bijection (runs with no build; THIS is the A1 gate).**
      Call the default export directly. Assert, spelled out rather than compared as objects because
      the two sides are different types (the `teams/static-output.test.ts:101` precedent):
      - the set of `/matches/<id>/` URLs equals `entities.matches.map(m => m.matchId)`, sorted;
      - the same for players and teams;
      - each side is non-empty and the counts match.
      Failure messages must **name the offending ids**, not print `1404 !== 1403`.
- [x] **5.2 — Layer 2, shape (runs with no build).** Every URL: starts with `SITE_ORIGIN`, ends with
      `/`, contains no `?` and no `#`, appears exactly once (no duplicates), and
      `new URL(u).origin === SITE_ORIGIN`. `${SITE_ORIGIN}/compare/` is present and no other
      `/compare` variant is (AC4).
- [x] **5.3 — Layer 3, export bijection (`describe.skipIf(!anyBuilt)`).**
      Ground truth is the **emitted tree**, not the manifest and not the same fs walk `sitemap.ts`
      uses — §D8 explains why that independence is required and not merely nice.
      - parse `<loc>` values out of `out/sitemap.xml`;
      - every `<loc>` → strip `SITE_ORIGIN`, assert `out/<path>/index.html` exists;
      - every `index.html` under `out/` (excluding `out/_next/**`, `out/data/**`, `out/404/` and
        `out/_not-found/`) has a `<loc>`;
      - assert the count is `> 1400` so the layer cannot pass vacuously.
      Skip guard keys on `out/` existing, **not** on `out/sitemap.xml` existing — otherwise "the
      sitemap was not emitted at all" reports as a green skip, which is the exact failure
      `teams/static-output.test.ts`'s header docblock says must fail loudly.
- [x] **5.4 — robots (`skipIf`).** `out/robots.txt` exists as a file; contains exactly one `Sitemap:`
      line and it equals `${SITE_ORIGIN}/sitemap.xml`; contains `Disallow:` zero times (AC7).
- [x] **5.5** A2: pin every path relatively (`fileURLToPath(new URL("../../out/", import.meta.url))`,
      the shipped shape) — never by an id fixture and corpus could share.

### Task 6 — A1: drive every gate RED, both directions (AC: 5, A1)

Record for each: the exact edit, the exact command, and the **verbatim failing output**. Revert
after each. A description of a red run is not a red run.

- [x] **6.1 — Direction 1, a manifest entry omitted from the sitemap.** In `sitemap.ts`, `.slice(1)`
      the players map. Run `npx vitest run src/app/sitemap.test.ts`. Layer 1 must fail and **name the
      dropped playerId**. Revert.
- [x] **6.2 — Direction 2, a sitemap entry absent from the manifest.** In `sitemap.ts`, append a
      phantom `${SITE_ORIGIN}/players/phantom-player/`. Same command. Layer 1 must fail and name
      `phantom-player`. Revert.
- [x] **6.3 — Layer 2 red.** Drop the trailing slash from the team URLs; assert the shape layer
      fails. Revert.
- [x] **6.4 — Layer 3 red.** With a build present, delete one emitted route directory from `out/`
      (e.g. `out/teams/algeria/`) and re-run; the export bijection must fail naming it. Restore by
      rebuilding, not by hand.
- [x] **6.5 — AC7 red.** Add `disallow: "/data/"` to `robots.ts`, rebuild, assert 5.4 fails. Revert.
- [x] **6.6** Confirm the whole file is green again and that the pre-existing suite is untouched.

### Task 7 — AC6: the origin gate over the real export (AC: 6)

- [x] **7.1** Full `npm run build` (it chains lint → typecheck → assert:schema-version → next build →
      copy-data → assert:no-external-origins). Record `BUILD_EXIT`.
- [x] **7.2** Record the gate's stdout verbatim: the `scanned` count (must be non-zero; 12,683 was
      3.1's figure and this story adds two assets), the `MENTIONED` line, and the absence of any
      `EXTERNAL SUBRESOURCE(S)` block.
- [x] **7.3** Confirm `https://mundial-stats.juancr.dev` appears **nowhere** in the gate output, and
      that `www.sitemaps.org` **does** appear on the `MENTIONED` line. §D2 predicts both; verify.
- [x] **7.4** If the 3.1 review lands a further gate patch mid-story, re-run 7.1–7.3 against it
      before committing. Do not edit the gate.

### Task 8 — Verify, commit, hand off (AC: all, A4)

- [x] **8.1** Full chain green: `npm run lint` (0 under `--max-warnings 0`), `npm run typecheck` (0),
      `npm test` (record files/tests/skipped and the **delta against Task 1.4**, fully accounted for),
      `npm run build` (exit 0, route count recorded).
- [x] **8.2** If the shared tree is dirty enough to contaminate the figures, verify in an isolated
      worktree per §D9 and say so — 3.1 and 3.5 both did, and both were right to.
- [x] **8.3** **A4 commit.** Stage **only**:
      `app/src/app/sitemap.ts`, `app/src/app/robots.ts`, `app/src/app/sitemap.test.ts`,
      and this story file. Commit by pathspec (`git commit -- <paths>`), never `git add -A`.
      **Do NOT stage the stray 0-byte file named `17` in the repo root — it belongs to nobody.**
      Commit directly to `main`.
- [x] **8.4** Append to `sprint-status.yaml` — **append only, never regenerate.** Flip
      `3-4-sitemap-robots` to `review` and add a journal entry with the measured figures.
- [x] **8.5** Update the ledger entry at `deferred-work.md:4663-4677`, which names **this story** as
      owner. Its motivating case is **moot**: it assumes 3.4 creates `public/robots.txt`; the epic
      rules a `robots.ts` metadata route instead, `app/public/` does not exist, and no second origin
      copy lands. Record that disposition. The entry's **other** gaps — repo-root `netlify.toml`
      outside the scan, bare-host and case-variant copies counting zero, `SKIPPED_DIRECTORIES` dead
      code — are **not** this story's to fix: they live in `site-origin.test.ts`, which is 3.1's file
      and 3.1 is still at `review`. Leave them open, re-owned to "whoever next revisits the drift
      gate", and say why.
- [x] **8.6** **Surface AC8 to Juan as a manual task and stop.** Do not attempt a Search Console
      submission. Report: the sitemap is live at `<SITE_ORIGIN>/sitemap.xml`, submitting it starts
      the 90-day D20-b clock, and the re-open date is no earlier than **2026-11-24**. Record the date
      only once Juan confirms he has submitted it; until then AC8 stays open and the story says so.

## Dev Notes

### Decisions ruled at story creation — implement these, do not re-derive them

**D1 — `trailingSlash: true` does NOT turn `sitemap.xml` into a directory. Sourced, then verify.**
This is the assumption most likely to sink the story, so it was chased to the source rather than
assumed. In `next/dist/export/worker.js`, `getHtmlFilename` is
`subFolders ? p + "/index.html" : p + ".html"`, and `trailingSlash: true` sets `subFolders: true` —
which is why every page route lands at `<route>/index.html`. **App route handlers never reach that
branch.** `next/dist/export/index.js:728-735`:

```js
const handlerSrc = `${orig}.body`;
const handlerDest = path.join(outDir, route);
if (isAppRouteHandler && existsSync(handlerSrc)) { … copyFile(handlerSrc, handlerDest); return; }
```

It `return`s **before** the `subFolders` naming below it. `sitemap.ts` and `robots.ts` compile to app
route handlers (`normalizeMetadataRoute` in `get-metadata-route.js` appends `/route`), so they are
copied verbatim to `out/sitemap.xml` and `out/robots.txt`. `/robots` → `.txt` and `/sitemap` → `.xml`
are added by `normalizeMetadataRoute` / `normalizeMetadataPageToRoute` in the same file.
**Task 2.2 verifies this on disk anyway.** A sourced claim is a hypothesis until the build agrees.

**D2 — the in-flight 3.1 gate patch does not move this story, and here is the proof.**
`assert-no-external-origins.mjs` was **dirty at story creation** — the 3.1 code review is rewriting
it. The change that could have mattered: the self-origin allowance shipped as a third entry in one
global `ALLOWED` list (so self-origin passed at *every* position); the patch narrows it to
`SELF_ORIGIN_POSITIONS = new Set(["<link href>"])`. **Both versions still pass the sitemap**, because
a `<loc>` is not a fetching position at all — it is reached only by the informational `ANY_URL` pass,
which calls `allowed(match[0], true)` explicitly on both versions. Same for `robots.txt`'s `Sitemap:`
line under `.txt`. So the sitemap's 1,404 absolute URLs ride entirely on the `mentions` allowance,
which neither version touches. **Do not edit the gate. Re-confirm this against the tree, then move
on.** 3.1's own suite already ships the case: *"PASSES a sitemap of self-origin `<loc>` entries
without reporting the site as external — story 3.4 depends on this"*
(`src/lib/assert-no-external-origins.test.ts:293`).

**D3 — no `lastModified`, no `changeFrequency`, no `priority`. `<loc>` only.**
Three reasons, in order of weight. (1) **Reproducibility is a shipped property of this project** —
2.19 verified the live chunk set byte-identical to a local build; `new Date()` in the sitemap makes
every build differ for no information gained. (2) There is **no per-entity mtime in the manifest**, so
any value would be invented, and an invented `lastModified` is worse than none: Google demotes
sitemaps whose dates it learns not to trust. (3) Google **ignores** `changeFrequency` and `priority`
outright. Minimal `<loc>`-only entries also keep the origin gate's surface minimal.

**D4 — the static routes are discovered from the route tree, not listed.** The epic is explicit:
*"Do not hard-code them and do not wait for them."* A literal list means story 3.9 must remember to
edit a file it has no reason to open, and UX-DR24's four new routes silently miss the sitemap.
Walking `src/app` for `page.tsx` is a build-time `fs` read, which AD-11 permits and `build-data.ts`
already does throughout. Skip `[`-prefixed segments (the three dynamic routes are covered by the
manifest map) — and note `not-found.tsx` is not a `page.tsx`, so `/404` and `/_not-found` never enter
the walk, which is exactly right: they must not be in a sitemap.
**Measured at creation:** the walk yields exactly four today — `src/app/page.tsx`, `about/`,
`compare/`, `glossary/`. There is no `matches/page.tsx`, `players/page.tsx` or `teams/page.tsx`
(confirmed against both the source tree and the 1,406-file export).

**D5 — no `export const dynamic` directive is expected.** `exportAppRoute` computes
`isPageMetadataRoute` and **skips the static-generation bail for metadata routes**
(`next/dist/export/routes/app-route.js:73-79`), so a metadata route is statically generated without a
directive. Only add one if Task 2 shows the build bailing, and record it if you do.

**D6 — `robots.txt` carries NO `Disallow: /data/`, and this is a correctness ruling not an omission.**
Googlebot renders pages with JavaScript, and every data-bearing route in this app **fetches
`/data/*.json` at runtime** (`src/lib/data.ts`). Blocking `/data/` would stop the renderer from
fetching the artifacts and strip the rendered pages of their content — actively harming exactly the
indexing this story exists to enable. There is no SEO benefit to weigh against that: JSON artifacts
are not indexed as pages. AC7 pins the absence, because an unstated omission is not a property.

**D7 — the entry count is 1,404, not 1,406. The epic's "~1,406" is the ROUTE count.**
Measured: 104 + 1,248 + 48 = 1,400 entities + 4 static = **1,404 `<loc>` entries**. The export emits
**1,406** `index.html` files; the difference is `out/404/` and `out/_not-found/`, which are correctly
absent from a sitemap. Do not "fix" a 1,404 to match a 1,406 you read in prose. After story 3.9 both
numbers rise by 4 and the guard follows without an edit.

**D8 — Layer 3 exists because Layer 1 alone would grade itself on the static routes.**
`sitemap.ts` derives its static routes by walking `src/app` (D4). A test that asserts the sitemap's
static routes by walking `src/app` the same way asserts its own literal against its own literal and
stays green through the exact edit it exists to catch — the trap Story 1.17's precision gate fell
into, where 41 tests stayed green while 553 leaves shipped truncated. Layer 3's ground truth is the
**emitted export**, which is independent of both the manifest and the walk, and which is also the
only thing that can actually prove the AC's claim that no listed URL 404s.

**D9 — verify in an isolated worktree if the shared tree contaminates the figures.**
Three sessions were live at creation. Environment lessons already paid for, recorded so you do not
re-pay them: BMad's long story filenames overflow Windows `MAX_PATH` under the scratchpad prefix
(`git worktree add` dies with "Filename too long") — use a **short path** plus
`git sparse-checkout set app contract data`. A `node_modules` **junction does not work** for
`next build` (Turbopack panics: "Symlink [project]/node_modules is invalid, it points out of the
filesystem root"); `robocopy` the directory, or `npm ci --prefer-offline` in the worktree. **Build
before running the suite** or every `describe.skipIf(!anyBuilt)` block silently skips.

### Existing code this story reads — read these before writing anything

| Path | Why it matters here |
|---|---|
| `app/src/lib/site-origin.ts` | The one origin definition. Its docblock **names this story** as one of three consumers. `SITE_ORIGIN` is a **bare origin** (no trailing slash), so `<SITE_ORIGIN>/about/` composes correctly. |
| `app/src/lib/site-origin.test.ts` | The drift gate: exactly one occurrence of the origin string under `app/`. It scans `src/**` and `scripts/**` — **your two new files are in scope.** One literal and it goes red. |
| `app/src/lib/build-data.ts:85` | `readTournament()` — the manifest reader, artifact-cached per build worker, `DATA_ROOT = cwd/../data` (real data since 2.19). |
| `app/src/app/{matches,players,teams}/[slug]/page.tsx` | The three `generateStaticParams` — the exact `entities.*.map(x => x.<id>)` shape to mirror. `dynamicParams = false`; the manifest is mapped **1:1 with no existence filter** (ruled D5/D10) so a listed-but-missing artifact breaks the build. Your sitemap must have the same coverage, by construction. |
| `app/src/app/teams/static-output.test.ts:101` | The bijection pattern to reuse, including its header docblock on why the skip guard keys on `out/` and not on the route directory. |
| `app/scripts/assert-no-external-origins.mjs` | The gate you must pass. `SCANNED_EXTENSIONS` already includes `.xml` and `.txt`. **Read-only for this story.** |
| `app/src/lib/assert-no-external-origins.test.ts:293` | The already-shipped test that asserts exactly what AC6 needs. Do not duplicate it. |
| `app/next.config.ts` | `output: "export"`, `trailingSlash: true`, `images.unoptimized`. Read-only. |
| `netlify.toml` (repo root) | `base = "app"`, `publish = "out"`, `NETLIFY_NEXT_PLUGIN_SKIP`. **Read-only** — AC1 forbids editing it. |

### Next 16 API surface — verified against the installed `next@16.2.11`

```ts
// node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts
type SitemapFile = Array<{
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never';
  priority?: number;
  alternates?: { languages?: Languages<string> };
  images?: string[];
  videos?: Videos[];
}>;
type RobotsFile = {
  rules: { userAgent?: string|string[]; allow?: string|string[]; disallow?: string|string[]; crawlDelay?: number }
       | Array<{ userAgent: string|string[]; allow?: …; disallow?: …; crawlDelay?: number }>;
  sitemap?: string | string[];
  host?: string;
};
declare namespace MetadataRoute { type Robots = RobotsFile; type Sitemap = SitemapFile; }
```

- Both files default-export a function returning the type above; **synchronous is fine** (the three
  `generateStaticParams` are synchronous for the same reason).
- Next serializes to `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` — that namespace
  is the one new external origin AC6 tracks.
- `generateSitemaps` / index-splitting is **not needed**: the sitemap protocol caps at 50,000 URLs
  and 50 MB; 1,404 `<loc>`-only entries are roughly 100 KB.
- `metadataBase` is story **3.2** and has **not landed** — relative `url` values would not resolve.
  Emit absolute URLs from `SITE_ORIGIN` directly. This is also why 3.2 must not later "simplify" them
  to relative.

### Testing standards

- Vitest, `node` environment for anything reading `out/` (no jsdom — the Story 2.2 decision). All
  three layers here are `node`.
- `npm run build` **must** precede `npm test` or `skipIf(!anyBuilt)` blocks silently skip.
- Assert as a joined, sorted string when the failure needs to name offenders —
  `site-origin.test.ts`'s `occurrences.sort().join(", ")` is the shipped idiom, written precisely so
  a failure does not send the reader grepping.
- Known flake under contention: `assert-schema-version` "passes on the current data tree" can
  spawn-timeout under full-suite load. Re-run it alone; it is documented in that file at `:36-53`.
- If you add a `user-event` interaction anywhere, `userEvent.setup({ delay: null })` — a bare
  `setup()` times out under full-suite load.

### Project Structure Notes

- `app/src/app/sitemap.ts`, `app/src/app/robots.ts`, `app/src/app/sitemap.test.ts` — all **NEW**, all
  owned solely by this story, none held by another session at creation.
- No `app/public/` directory exists and this story does **not** create one.
- No file this story owns collides with 3.2/3.3 (`src/app/page.tsx`, `layout.tsx`) or with 3.9/3.10.
  This is the cleanest file footprint in Epic 3 — keep it that way.
- Zero new dependencies. Zero contract change. Zero `schemaVersion` change. Route count rises only by
  the two metadata routes, which are not pages.

### Regression surface — checked at creation, all clear

- **`vitest.config.ts` needs no change.** `include: ["src/**/*.test.{ts,tsx}"]` already picks up
  `src/app/sitemap.test.ts`, and `environment: "node"` is the default — which is what the `out/`
  layers want.
- **`src/app/static-output.test.ts` does not see the two new files.** Its route collector
  (`:735-760`) is a literal four-entry list plus a walk of `matches`/`players`/`teams` that reads
  only `<slug>/index.html`. Root-level `sitemap.xml` and `robots.txt` are invisible to it, so nothing
  there goes red. **Do not "helpfully" register the new routes in that file** — it is held by another
  session, and A3 forbids modifying it. (Its collector also omits `/compare`; that is a pre-existing
  gap, not yours.)
- **`site-origin.test.ts` DOES see them.** It walks `src/**` recursively, so `sitemap.ts` and
  `robots.ts` are in the drift gate's scan scope. This is the intended coverage: one origin literal
  in either file turns it red. Expect that, do not work around it.
- **The origin gate over `out/robots.txt`.** `.txt` is scanned, and the `Sitemap:` line's host
  `mundial-stats.juancr.dev` has a dotted alphabetic TLD, so it matches `ANY_URL` and reaches the
  `mentions` pass — where the self-origin allowance drops it. That is why AC6 asserts the origin is
  absent from the `MENTIONED` line rather than present on it.
- **No pipeline test is touched.** This story does not enter `pipeline/`, `contract/` or `data/`.

### Previous story intelligence — Epic 3 so far

- **3.1** (`432dc29`, `117311c`, at `review`) — shipped `SITE_ORIGIN` and taught the gate the site's
  own origin. Its record is worth reading for the trap it names: on a self-origin canonical the two
  gate mechanisms **overlap**, so that case discriminates nothing, and the suite isolates each
  deliberately. The same shape of trap is live here — the sitemap case *initially passed pre-fix*
  because `mentions` sorts lexicographically and `http://www.sitemaps.org` sorts before the site's
  origin, so an assertion anchored on the line's prefix could never fire. **If you assert anything
  about the `MENTIONED` line, do not anchor it on the prefix.**
- **3.5** (`8f1c4fc`, `done`) — verified in an isolated worktree because the shared tree was not its
  own. Baseline `53 files / 1,334`, close `55 files / 1,367`, delta fully accounted for line by line.
  Match that standard of accounting.
- **3.6** (`887a378`, `done`) — 11 review patches, and *"every defect was in the guards around it or
  in a number."* Not in the feature. Expect the same distribution here.
- **3.8** (`d3c103c`, at `review`), **3.10** (`ready-for-dev`, aborted once at Task 1.4 on a red A3
  probe and **correctly held at `ready-for-dev` rather than flipped to `in-progress`**). If this
  story aborts, do the same: no status flip, no baseline commit written.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.4` (line 1193)] — the ACs this story implements.
- [Source: `_bmad-output/planning-artifacts/epics.md#Standing acceptance criteria` (lines 1076–1106)] — A1–A6.
- [Source: `_bmad-output/planning-artifacts/epics.md:182`] — FR-36; `:91` NFR-11; `:224–226` the standalone/$0 clauses.
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml`] — Epic 3 block, the D20 ruling, 3.1's completion record (1,320 tests / 12,683 assets), the worktree lessons, the stray `17` file.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:4376–4399`] — D20-b, the 2026-11-24 re-open date, *"the `sitemap.xml` shipped in Epic 3 is that instrument"*.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:4663–4677`] — the drift-gate scope entry owned by this story; disposition ruled in Task 8.5.
- [Source: `app/src/lib/site-origin.ts:1–32`] — the docblock naming this story as a consumer.
- [Source: `app/src/app/teams/static-output.test.ts:85–113`] — the bijection pattern and its skip-guard rationale.
- [Source: `app/src/lib/assert-no-external-origins.test.ts:293–323`] — the shipped sitemap gate case.
- [Source: `node_modules/next/dist/export/index.js:728–735`] — the app-route-handler flat-copy path (D1).
- [Source: `node_modules/next/dist/lib/metadata/get-metadata-route.js:96–125`] — `/sitemap` → `.xml`, `/robots` → `.txt`.
- [Source: `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:547–576`] — `MetadataRoute.Sitemap` / `.Robots`.

## Dev Agent Record

### Agent Model Used

`claude-opus-5[1m]` (Opus 5, 1M context) via the `bmad-dev-story` workflow.

### Debug Log References

| # | What was proven | Command |
|---|---|---|
| T1.4 | Test baseline re-measured, not inherited — **58 files / 1,468 tests / 0 skipped** | `npm test` |
| T1.5 | Route baseline **1,406** `index.html` | `find app/out -name index.html -not -path '*/_next/*' \| wc -l` |
| T2.1 | Build FAILS without `force-static` — D5 falsified | `npm run build` |
| T2.2 | `out/sitemap.xml` / `out/robots.txt` are FILES; no `sitemap.xml/index.html` | `[ -f out/sitemap.xml ]`, `[ -e out/sitemap.xml/index.html ]` |
| T6.1–6.6 | Six RED demonstrations, both bijection directions | `npx vitest run src/app/sitemap.test.ts` |
| T7.2 | Gate `scanned` delta accounted causally: 12,684 → **12,686** | gate re-run with the two assets moved aside |
| T8.1 | Full chain green — **59 files / 1,488 tests / 0 skipped** | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |

### Completion Notes List

<!--
REQUIRED before this story may be called done:
  - Task 1 baseline commit, probe result, measured test baseline, measured route count.
  - Task 2.2 evidence that out/sitemap.xml and out/robots.txt are FILES (D1 verified, not assumed).
  - Task 6: SIX red demonstrations, each with its edit, its command and its VERBATIM failing output.
    Two of them (6.1, 6.2) are named in AC5 and in the epic; they are not optional.
  - Task 7: the origin gate's verbatim stdout, incl. the scanned count and the MENTIONED line.
  - Task 8.1: full chain figures and the test delta, accounted for.
  - AC8 stays OPEN until Juan confirms the Search Console submission. Record the date then.
-->

**Baseline commit: `8750d85`.** Shipped: 1,404 `<loc>` entries, exactly D7's arithmetic
(104 + 1,248 + 48 entities + 4 tree-walked static routes). Seven of eight ACs met; **AC8 is open by
design and is Juan's to close** (see the last note).

#### Task 1 — the probe, and what had moved since story creation

**A3 probe GREEN.** All three owned paths absent, therefore clean. Two things the story warned about
had already resolved themselves and are recorded because inheriting either would have been wrong:

- **`assert-no-external-origins.mjs` was NOT dirty.** The 3.1 code review landed as commit `39889bf`
  between story creation and this session, so §D2's "re-confirm against the tree as it stands"
  resolved to *there is nothing in flight to confirm against*. D2's substantive finding still held
  and was verified at Task 7: the gate passes the sitemap on the `mentions` allowance, untouched by
  either version. **Story 3-1 has also moved `review` → `done`**, which changes the Task 8.5
  reasoning (below).
- **Story 3.10's session committed mid-story.** At Task 1.3 it held eleven `src/components/*` and
  six `src/lib/*`; by Task 8 the tree held only this story's three new files. **No path this story
  touches was ever contended.**

**T1.4 — the inherited number was stale, as the story predicted.** Measured **58 files / 1,468 tests
/ 0 skipped**, not the 1,367 recorded at 3-5's close: 3-8's and 3-10's files had landed since. The
whole point of re-measuring is that the +121 would otherwise have been misattributed to this story.

**T1.5 / T1.6** — export **1,406** `index.html`; manifest `matches 104`, `players 1248`, `teams 48`
at `schemaVersion 4`. All three match the story's expectations exactly.

#### Task 2 — D1 confirmed on disk, D5 falsified by the build

**D1 HOLDS, and it is verified rather than sourced.** With a two-entry probe body:

```
--- is out/sitemap.xml a FILE? ---   FILE: yes    DIR: no
--- is out/robots.txt a FILE? ---    FILE: yes
--- does out/sitemap.xml/index.html exist? ---   absent (correct)
-rw-r--r-- 1 ADMINSTRADOR 197121  78 out/robots.txt
-rw-r--r-- 1 ADMINSTRADOR 197121 232 out/sitemap.xml
```

`trailingSlash: true` does **not** turn either into a directory route. The story's single
highest-risk assumption is now a measurement.

**D5 IS WRONG, AND THE STORY'S OWN TASK 2.4 CAUGHT IT.** D5 predicted no `export const dynamic`
directive would be needed. The first build failed:

```
Error: export const dynamic = "force-static"/export const revalidate not configured on route
"/sitemap.xml" with "output: export".
    at Object.<anonymous> (app\.next\server\app\sitemap.xml\route.js:5:3)
> Build error occurred
Error: Failed to collect page data for /sitemap.xml
BUILD_EXIT=1
```

**Why D5 read the source correctly and still got the answer wrong** — worth recording, because the
same trap is available to anyone who re-derives this. D5 cited
`next/dist/export/routes/app-route.js:73`, where `isPageMetadataRoute` genuinely *does* exempt
metadata routes from the static-generation bail. That code is real and it does what D5 said. **It is
simply never reached**, because `AppRouteRouteModule`'s constructor throws first — at *"Collecting
page data"*, one phase earlier than export — and it has no metadata exemption at all. Its condition,
read out of the compiled runtime, is:

```js
!("force-static"===e.dynamic || "error"===e.dynamic || !1===e.revalidate ||
  (void 0!==e.revalidate && e.revalidate>0) || "function"==typeof e.generateStaticParams)
&& this.userland.GET
```

Both files therefore carry `export const dynamic = "force-static"`, and both docblocks record why so
the next reader does not delete a line that looks redundant. Route count after: **1,408**
(1,406 + `/sitemap.xml` + `/robots.txt`), both listed `○ (Static)`.

#### Tasks 3–5 — what shipped

`sitemap.ts` maps `entities.matches/.players/.teams` 1:1 and discovers the static routes by walking
`src/app` for `page.tsx`, skipping `[`-prefixed segments. **No length literal, no slice, no filter,
no hard-coded slug, no origin literal, no path literal.** Verified at close: the origin string still
occurs **exactly once** under `app/` (`site-origin.ts:32`), so the drift gate — which does scan both
new files — stays green on the intended coverage rather than on a workaround.

One judgement call beyond the letter of D4, made in its spirit and flagged for review: the walk
**throws** on a `(group)`, `@slot` or `_private` directory rather than appending it verbatim. None
exists today. The alternative on the day one appears is silently publishing a `<loc>` that 404s,
which is the exact harm AC5 names, so a build that stops with the directory's name is the better
failure. `discoverStaticRoutes()` also throws if the walk finds zero routes (subtask 3.3).

#### Task 6 — SIX red demonstrations, verbatim

Each was reverted immediately after. **6.1 and 6.2 are the two directions AC5 and the epic name.**

**6.1 — a manifest entry omitted from the sitemap.** `.slice(1)` on the players map:
```
× covers the players exactly
  → players — MISSING from the sitemap: aaronson-brenden-usa: expected [ 'aasgaard-thelo-nor', …(1246) ]
    to deeply equal [ 'aaronson-brenden-usa', …(1247) ]
Tests  2 failed | 18 passed (20)
```

**6.2 — a sitemap entry absent from the manifest.** Appended a phantom `/players/phantom-player/`:
```
× covers the players exactly
  → players — ABSENT from the manifest: phantom-player: expected [ 'aaronson-brenden-usa', …(1248) ]
    to deeply equal [ 'aaronson-brenden-usa', …(1247) ]
Tests  2 failed | 18 passed (20)
```
Both name the offending id rather than printing `1404 !== 1403`, which is what the AC asked for.

**6.3 — Layer 2, trailing slash dropped from the team URLs:**
```
× ends every URL with a slash, because trailingSlash: true is what the host serves
  → no trailing slash — the host would redirect or 404: https://mundial-stats.juancr.dev/teams/algeria,
    …/argentina, …/australia, …/austria, …/belgium: expected [ …(48) ] to deeply equal []
Tests  2 failed | 18 passed (20)
```

**6.4 — Layer 3, `out/teams/algeria/` deleted from the export** (module untouched, so only the
export layer may fire — and only it did):
```
× resolves every <loc> to an index.html the export actually emitted
  → listed in the sitemap but 404 on the host: /teams/algeria/: expected [ '/teams/algeria/' ] to deeply equal []
Tests  1 failed | 19 passed (20)
```

**6.5 — AC7, `disallow: "/data/"` added to `robots.ts` and rebuilt:**
```
× carries no Disallow at all, least of all /data/ (D6)
  → robots.txt blocks something: Disallow: /data/: expected [ 'Disallow: /data/' ] to deeply equal []
Tests  1 failed | 19 passed (20)
```

**6.6 — the skip guard: `out/sitemap.xml` deleted while `out/` remains.** Subtask 5.3 names this as
the state that must fail loudly rather than report a green skip. It does — three loud failures, zero
skips:
```
→ out/sitemap.xml was not emitted by the build: expected false to be true
→ no <loc> parsed out of out/sitemap.xml: expected 0 to be greater than 1400
→ emitted by the build but missing from the sitemap: /, /about/, /compare/, /glossary/,
  /matches/m001-mexico-south-africa/, … : expected [ Array(1404) ] to deeply equal []
Tests  3 failed | 17 passed (20)
```

**An UNPLANNED red, recorded because it is the best evidence in the story that D8 was right.** After
Task 3 the module was correct but `out/` still held the two-entry probe. Layers 1 and 2 went
**18/18 green on a module whose export was wrong**; only Layer 3 caught it. That is precisely D8's
argument for grounding the third layer in the emitted tree rather than in the manifest or in the
same `src/app` walk — observed, not just reasoned about.

#### Task 7 — the origin gate over the real export

`BUILD_EXIT=0`. Verbatim stdout:

```
assert-no-external-origins: 7 external origin(s) MENTIONED in text (vendor error-message URLs and
licences — not fetched): http://www.sitemaps.org, https://bit.ly, https://github.com,
https://nextjs.org, https://react.dev, https://redux-toolkit.js.org, https://redux.js.org
assert-no-external-origins: 12686 text asset(s) in out/, 0 external subresources.
```

- `scanned` = **12,686**, non-zero — not the vacuous `scanned === 0` pass.
- **`mundial-stats.juancr.dev` appears ZERO times in the whole gate output** (`grep -c` = 0), so the
  site's own origin is neither an `EXTERNAL SUBRESOURCE` nor on the `MENTIONED` line. There is no
  `EXTERNAL SUBRESOURCE(S)` block at all (`grep -c` = 0).
- **`http://www.sitemaps.org` IS on the `MENTIONED` line** and is not treated as a subresource.

**T7.2's count was accounted causally rather than asserted.** The story expected roughly 3.1's
12,683 + 2. Rather than hand-wave the arithmetic, the gate was re-run with this story's two assets
temporarily moved out of `out/`:

```
6 external origin(s) MENTIONED …: https://bit.ly, https://github.com, https://nextjs.org,
https://react.dev, https://redux-toolkit.js.org, https://redux.js.org
12684 text asset(s) in out/, 0 external subresources.
```

So **12,684 → 12,686 is exactly this story's two files**, and the MENTIONED list going **6 → 7
proves `www.sitemaps.org` enters the export because of the sitemap and for no other reason** — the
causal claim AC6 makes, demonstrated rather than inferred. (The pre-story floor is 12,684, not
3.1's 12,683; that one asset arrived between 3.1 and now and is not this story's.)

Per the 3.1 warning about the `MENTIONED` line sorting lexicographically, **no assertion in this
story anchors on that line's prefix** — no test here asserts against the gate at all.
`assert-no-external-origins.test.ts:293` already ships the case and was not duplicated. **The gate
was not edited** (T7.4).

#### Task 8.1 — the full chain, and the delta accounted line by line

| Gate | Result |
|---|---|
| `npm run lint` | **exit 0** under `--max-warnings 0` |
| `npm run typecheck` | **exit 0** |
| `npm test` | **59 files / 1,488 tests / 0 skipped** |
| `npm run build` | **exit 0**, route count **1,406** `index.html` + the two flat metadata files |

**Delta: 58 → 59 files (+1), 1,468 → 1,488 tests (+20).** Fully accounted: `src/app/sitemap.test.ts`
is the one new file and contributes exactly 20 tests (4 Layer 1, 7 Layer 2, 4 Layer 3, 5 Layer 4).
**No pre-existing test changed, was skipped, or was removed** — 0 skipped at both ends.

The shared tree did not need §D9's worktree: it compiled and was green at Task 1.4, and by Task 8
the concurrent session had committed and left the tree holding only this story's files (T8.2).

#### Task 8.5 — the ledger entry, disposed

`deferred-work.md`'s drift-gate entry named this story as owner **on a false premise**: that 3.4
creates `public/robots.txt`. It does not and never would — the epic rules a `robots.ts` metadata
route, `app/public/` does not exist, the `Sitemap:` line is composed from the imported constant, and
the origin reaches the reader only in `out/robots.txt`, a build artifact correctly outside a
*source*-drift gate and covered instead by the export gate above. **Recorded as moot in the ledger,
with the verification.** The entry's three other gaps are untouched and were never this story's;
they live in `site-origin.test.ts`. The ledger note also records that **the ownership blocker has
cleared — 3-1 is now `done`, not `review`** — and re-owns them to whoever next revisits the drift
gate.

#### AC8 — OPEN. It is Juan's to close, and the dev agent did not attempt it.

No Search Console submission was attempted. **AC8 remains open and this story does not claim it.**
What Juan needs: the sitemap is live at `https://mundial-stats.juancr.dev/sitemap.xml` once this
deploys; submitting it in Google Search Console starts the 90-day D20-b clock, making the re-open
trigger measurable rather than indefinite. **Re-open no earlier than 2026-11-24.** The date gets
recorded here only once Juan confirms he has submitted it.

### File List

<!-- Expected, and nothing else (A4):
  app/src/app/sitemap.ts        (new)
  app/src/app/robots.ts         (new)
  app/src/app/sitemap.test.ts   (new)
  _bmad-output/implementation-artifacts/3-4-sitemap-robots.md
  _bmad-output/implementation-artifacts/sprint-status.yaml   (append only)
  _bmad-output/implementation-artifacts/deferred-work.md     (Task 8.5 disposition)
-->

Exactly as expected, and nothing else (A4):

| Path | Change |
|---|---|
| `app/src/app/sitemap.ts` | new |
| `app/src/app/robots.ts` | new |
| `app/src/app/sitemap.test.ts` | new |
| `_bmad-output/implementation-artifacts/3-4-sitemap-robots.md` | modified |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modified (append only) |
| `_bmad-output/implementation-artifacts/deferred-work.md` | modified (Task 8.5 disposition) |

`netlify.toml`, `next.config.ts`, `vitest.config.ts`, `assert-no-external-origins.mjs`,
`site-origin.ts` and `src/app/static-output.test.ts` were **read and not written** (AC1, A3). The
stray 0-byte repo-root file `17` was left unstaged. No new dependency, no contract change, no
`schemaVersion` change.

## Change Log

| Date | Note |
|---|---|
| 2026-08-26 | **Implemented.** 1,404 `<loc>` entries (D7's arithmetic, measured). D1 verified on disk — both metadata routes emit as flat files under `trailingSlash: true`. **D5 falsified**: `force-static` IS required, because the route module's constructor bails during "Collecting page data", one phase before the export-path exemption D5 cited; both files record why. Six gates driven RED including both AC5 directions and the skip-guard case, all verbatim. Origin-gate `scanned` delta accounted causally (12,684 → 12,686) by re-running with the two assets removed, which also proves `www.sitemaps.org` enters only via the sitemap. Chain green: lint 0, typecheck 0, **59 files / 1,488 tests / 0 skipped** (+20, all this story's), build exit 0. Ledger entry found moot as written and disposed; its other gaps re-owned. **AC8 left OPEN — Juan's manual Search Console submission.** |
| 2026-08-26 | Story contexted from `epics.md:1193` against baseline `8f1c4fc`. A3 probe run: all three owned paths clean; `assert-no-external-origins.mjs` dirty under the live 3.1 review and ruled non-blocking with proof (D2). Next's flat-file emission for app route handlers under `trailingSlash: true` traced to source (D1). Entry count corrected 1,406 → **1,404** against the measured manifest and the 1,406-file export (D7). The ledger entry naming this story as owner found **moot as written** — it assumes a `public/robots.txt` the epic does not rule (Task 8.5). |

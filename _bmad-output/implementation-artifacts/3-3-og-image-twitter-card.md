---
baseline_commit: b8c2fd919a00cfcdfc026ec7877120ce0b7a521a
---

# Story 3.3: Same-Origin `og:image` Card & Twitter Card

Status: in-progress

**Baseline commit sized against:** `b8c2fd9` (`Story 3.4 -> done: AC8 closed, and the failure message
that was not one`). Tree clean at creation apart from the stray 0-byte `17` in the repo root, which
belongs to nobody and is **not** staged by this story (A4).

**This story is sized against story 3.2's CODE REVIEW (`18e9022`), not against the epic text.** The
review overturned §D8 of 3.2's own ruling by rebuilding and reading the export, and three of the
things this story was briefed to add **already ship**. Every claim below about what the export
carries today was re-measured against `app/out/` at `b8c2fd9`, not read off prose. §D0 is the list of
what changed under this story's feet; read it before Task 2.

---

## Story

As someone pasting a link into WhatsApp, Slack, LinkedIn or X,
I want the preview to render as a card with an image,
so that a shared link looks like a product rather than a bare text row (FR-36, NFR-4).

---

## Acceptance Criteria

**AC1 — one same-origin card asset, created by this story.**
**Given** D20-c retires the `og:image` ban as an **over-read of AR-11** — a `<meta content>` URL is a
hint a crawler may fetch off-page and off-session, and `FETCHING_POSITIONS` in
`app/scripts/assert-no-external-origins.mjs` deliberately excludes it (the ban was self-imposed, not
architectural)
**When** one ~1200×630 PNG card is added at `app/public/og-card.png` — **`app/public/` does not exist
today and is created by this story**
**Then** `next build` copies it verbatim to `out/og-card.png`, **verified on disk**, and the emitted
`og:image` URL is absolute and same-origin.
**And** no second copy of the origin literal is introduced anywhere — not in a page file, not in a
test, not in the generator. `site-origin.test.ts` counts occurrences under `app/` and allows exactly
one (`src/lib/site-origin.ts`); it must still be green at the end of this story.

**AC2 — `images`, `type` and `siteName` at ALL FIVE `openGraph` declaration sites.**
**Given** 3.2's measured asymmetry — `openGraph` is **replaced wholesale** by any child that declares
the key, which is what already forced five copies of `url` and five of `locale`
**When** the card is authored
**Then** `openGraph.images` (with `width`, `height` and `alt`), `openGraph.type` and
`openGraph.siteName` appear at **all five** sites: `src/app/layout.tsx` plus the four
`generateMetadata` routes (`/`, `/matches/[slug]`, `/players/[slug]`, `/teams/[slug]`).
**And** `openGraph.locale` is **NOT touched** — `es_ES` already ships at all five sites, put there by
3.2's code review. Re-adding it is a no-op at best and a drift risk at worst (§D0).

**AC3 — `twitter: { card: "summary_large_image" }`, and it is a FLIP, not an addition.**
**Given** the measured baseline: **all 1,407 exported documents already carry
`<meta name="twitter:card" content="summary">`**, auto-derived by Next's `postProcessMetadata` because
`openGraph` is declared and has no images
**When** the card ships
**Then** every exported document carries `twitter:card = "summary_large_image"`, plus `twitter:image`
and `twitter:image:alt`.
**And** `twitter.images` is **not authored** — `postProcessMetadata` back-fills it from
`openGraph.images`, and a second copy is a second thing that can drift (§D5).

**AC4 — the alt text and `openGraph.siteName` both come through `t()`, inside the gated scope.**
**Given** story 3.1 added `alt` and `siteName` to `eslint.config.mjs`'s metadata selector
**When** the card's alt text and site name are authored
**Then** both are `t()` calls and neither is a bare literal — a bare Spanish literal is an **error**
under `--max-warnings 0`, so this is enforced, not advisory.
**And** both properties are authored **inside** a `metadata` declarator or a `generateMetadata`
function, because that is the only AST scope the 3.1 selector reaches. Lifting the image object into
a shared helper module would move `alt:` out of the selector's reach and **silently disable the
enforcement this AC names** (§D8). The rule is demonstrated red once, on this story's own shape,
before it is trusted.

**AC5 — the two shipped assertions are REPLACED, never merely deleted, and each is proved able to fail.**
**Given** `app/src/app/players/static-output.test.ts:125-126`
(`expect(playerHtml(QUINONES)).not.toContain("og:image")`) and
`app/src/app/teams/static-output.test.ts:139-140` (`expect(metaContent(html, "og:image")).toBeNull()`)
**When** they are updated
**Then** each is **replaced** by an assertion that `og:image` is **present AND starts with
`SITE_ORIGIN`** (imported, never spelled).
**And** per A1 each replacement is driven **RED**: an off-origin `og:image` written into that route's
exported HTML makes it fail, and the command plus its failing output are recorded. Deleting an
assertion is never how a gate is satisfied.
**And** because **this test is the only thing holding the same-origin line** — story 3.1's gate
correctly does not catch `<meta content>`, since that is not a fetching position — the line is *also*
held over the **whole export**, not only over two fixture routes: `canonical-output.test.ts`, which
already parses every meta tag of all 1,407 documents, gains an `og:image` present-and-same-origin
assertion driven red the same way (§D9). Two of 1,407 is a thin line for a property with no other
guard.

**AC6 — the source comments asserting the ban are corrected, so the ban cannot be re-derived from prose.**
**Given** the four comments the ledger names — `matches/[slug]/page.tsx`, `page.tsx`,
`players/[slug]/page.tsx`, `teams/[slug]/page.tsx` (**locate them by content, not by the recorded line
numbers, which predate 3.2's edits to all four files**)
**When** the ban is retired
**Then** each states the **D20 scoping**: AR-11 bars external and third-party requests; a same-origin
`og:image` is not one, and `<meta content>` is deliberately outside `FETCHING_POSITIONS`.
**And** a **fifth** stale claim is corrected in the same pass: `layout.tsx`'s `verification.google`
docblock states *"this repo ships no `app/public/`"*, which this story makes false. A reader who
re-derives the premise from a different paragraph is exactly the failure this AC exists to stop.

**AC7 — A3 file ownership, or abort.**
**Given** A3 and the known Epic 3 collision on `app/src/app/page.tsx` (3.2/3.3 metadata vs 3.9 rewrite)
**When** this story edits that file
**Then** the file-ownership probe has run at Task 1 and this story owns that path for the duration,
**or it aborts at that task and says so**. The tree was clean at creation; another session can start
at any time, so the probe is re-run at dev time rather than inherited.

**AC8 — the deploy, and a human pasting a real link.**
**Given** the deploy
**When** it completes
**Then** a real `mundial-stats.juancr.dev` link pasted into **WhatsApp** and **Slack** renders a card
with an image — **verified by pasting, not by inspecting the tags**.
**And** the URL used is one **never pasted before** (a specific player or match route), because both
services cache unfurls per URL and every route on this site has been pasteable with no card for
months — a cached miss would report failure on a correct implementation, and a cached hit is not
possible here. The URL used and the result on each service are recorded.

**AC9 — the full chain is green and nothing is newly skipped.**
**Given** `npm run build` (lint → typecheck → schema assert → `next build` → `copy-data` → origin gate)
**When** it runs after this story
**Then** it is green end to end, the origin gate exits 0, the route count is unchanged at **1,406**,
and the suite is green with **0 skipped**.

---

## Tasks / Subtasks

- [x] **Task 1 — A3 probe and the measured baseline (AC 7, AC 9)**
  - [x] 1.1 `git status --porcelain` and `git status --porcelain -- app/src/app/page.tsx
        app/src/components/SiteHeader.tsx`. Record the result. If another session holds `page.tsx`,
        **abort here and say so** — the story modifies that file, it does not append to it.
  - [x] 1.2 Record the paths this story owns (§Files). Do not stage the stray root file `17`.
  - [x] 1.3 Re-measure the test baseline yourself: `npx vitest list | grep -c " > "` and
        `npx vitest list --filesOnly | grep -c "\.test\."`. Creation-time figure at `b8c2fd9`:
        **1,508 tests / 60 files**. It has moved repeatedly this epic — do not inherit it, and if it
        differs, find out why before proceeding.
  - [x] 1.4 Re-measure the route baseline: `find out -name "index.html" | wc -l` → **1,406**, and
        `find out -name "*.html" | wc -l` → **1,407** (the extra is `out/404.html`). Note that any
        `out/` in the shared tree may be another session's build; if the figures disagree, rebuild
        before believing them.
  - [x] 1.5 Confirm the pre-change tag baseline on one document per route class, so the diff is read
        against fact rather than against the epic text:
        `grep -o '<meta [^>]*"\(og\|twitter\):[a-z_:]*"[^>]*>' out/index.html`. Expect **og:title,
        og:description, og:url, og:locale, twitter:card=summary, twitter:title, twitter:description**
        — and **no og:type, no og:site_name, no og:image, no twitter:image**.

- [x] **Task 2 — the card asset (AC 1)**
  - [x] 2.1 Author `app/scripts/generate-og-card.py` (§D2). Deterministic, offline, no network. It
        reads the site's own typefaces out of `app/.next/static/media/*.woff2`, converts them with
        `fontTools`, and draws with Pillow. Its docblock must state loudly that it is an **authoring
        tool and NOT part of the build chain** — Netlify runs `npm run build` with `app/`'s Node
        install alone and has no Python (AD-13, NFR-8).
  - [x] 2.2 Identify the faces by name rather than by filename hash — the hashes change on every
        `next build`. Measured at `b8c2fd9`: `fontTools.ttLib.TTFont(f)['name'].getDebugName(4)`
        returns `Archivo SemiBold Regular` for three files and `Inter Regular` for seven. Select by
        that string; fail loudly if neither is found rather than falling back to a system font.
  - [x] 2.3 Draw the card at **1200×630** on the canonical **dark** palette, from `globals.css`'s
        `:root` block: `--surface-base #0e1114`, `--ink-primary #f2f5f7`, `--accent-lime #c3f53c`,
        `--accent-cyan #3ddbe8`. Dark is canonical (`globals.css:12`), so the card matches what a
        no-JS visitor lands on. Content is the wordmark plus canonical-Spanish supporting copy (§D11).
  - [x] 2.4 Write `app/public/og-card.png`. Record its byte size and keep it **well under 300 KB**
        (§D12). Verify the pixel dimensions from the written file, not from the draw call.
  - [x] 2.5 `npm run build`, then verify **on disk** that `out/og-card.png` exists, is a **file** not a
        directory, and is byte-identical to `app/public/og-card.png`. `sitemap.test.ts:343`'s
        `statSync(...).isFile()` is the shipped precedent for why "it is a file" is asserted rather
        than assumed under `trailingSlash: true`.
  - [x] 2.6 Confirm nothing under `app/` newly fails because a Python file now lives in `app/scripts/`:
        `npm run lint` (eslint's globs do not match `.py`) and `npm test -- site-origin`.
        **`site-origin.test.ts` walks `app/src/**` and `app/scripts/**` with NO extension filter and
        reads every file it finds as UTF-8** (`:37-56`), so the generator **is** scanned — it must not
        contain the domain, in code or in a comment. `app/public/` is **not** walked (only `src`,
        `scripts`, and top-level `app/*.{ts,mjs,json,toml}`), so the binary PNG is never read as text;
        confirm that rather than assuming it, since this is the first binary committed under `app/`.

- [x] **Task 3 — the locale key (AC 4)**
  - [x] 3.1 Mint `meta.ogImageAlt` in `src/locales/es.ts` under the existing `meta` namespace. **Not
        under `app.*`**: `i18n.test.ts:2309` pins `Object.keys(es.app)` **exactly** to `["siteName"]`
        and a key parked there goes instantly red.
  - [x] 3.2 Add the `en` counterpart. Parity is enforced by the **type system**, not by a test — `en`
        is typed as `Dictionary`, derived from the `es` shape (`src/lib/i18n.ts:1-8`), so `tsc` fails
        until both carry it. Confirm that by adding the `es` key alone first and seeing typecheck go
        red; that is the cheapest available red proof of the parity mechanism.
  - [x] 3.3 The alt describes the **card image**, not the site. It is the text a screen-reader user
        hears in place of an unfurled preview. The `en` value is authored and correct but is **never
        emitted** (§D11) — that is the existing, shipped behaviour of `meta.title` and
        `meta.description`, not a new defect.

- [x] **Task 4 — the five `openGraph` sites (AC 2, AC 4)**
  - [x] 4.1 `src/app/layout.tsx` — extend the `metadata` export's `openGraph` with `type`, `siteName`
        and `images`. This is the object that reaches `/about`, `/glossary`, `/compare` and the three
        not-found artifacts; none of those three static routes is edited, and their standing docblock
        rulings against a `metadata` export are **not** reopened (§D3).
  - [x] 4.2 The same three keys in `src/app/page.tsx`'s `generateMetadata`.
  - [x] 4.3 The same three keys in `src/app/matches/[slug]/page.tsx`'s `generateMetadata`.
  - [x] 4.4 The same three keys in `src/app/players/[slug]/page.tsx`'s `generateMetadata`.
  - [x] 4.5 The same three keys in `src/app/teams/[slug]/page.tsx`'s `generateMetadata`.
  - [x] 4.6 **Do not touch `locale`.** It already reads `es_ES` at all five sites. **Do not touch
        `url: "./"`.** Both are load-bearing and both carry a docblock saying so; this story's edit
        must leave them byte-identical.
  - [x] 4.7 The image `url` is the **relative** `"/og-card.png"`, resolved absolutely by
        `metadataBase`. An absolute literal would be a second copy of the origin and turns
        `site-origin.test.ts` red.
  - [x] 4.8 Author `alt: t("meta.ogImageAlt")` and `siteName: t("app.siteName")` **inline at each
        site**, not through a shared helper — see §D8. Five copies is the deliberate cost; §D9's
        whole-export gate is what stops them drifting, not DRY.

- [x] **Task 5 — the Twitter card, authored once (AC 3)**
  - [x] 5.1 Add `twitter: { card: "summary_large_image" }` to `src/app/layout.tsx`'s `metadata`
        export, **and nowhere else** (§D4).
  - [x] 5.2 **Verify the inheritance rather than reasoning about it.** After the build, confirm every
        one of the 1,407 documents carries `twitter:card="summary_large_image"` — including a match,
        a player and a team route, which declare `openGraph` but not `twitter`. If **any** document
        still reads `summary`, the inheritance reading is wrong and the key goes to all five sites
        instead. 3.2's §D8 was a correct-sounding reading of Next's source that the export overturned;
        this is the same shape of claim.
  - [x] 5.3 Confirm `twitter:image` and `twitter:image:alt` are present on all 1,407 documents
        **without** authoring `twitter.images` (§D5).

- [x] **Task 6 — the four (five) comment corrections (AC 6)**
  - [x] 6.1 `src/app/matches/[slug]/page.tsx` — the line `// No og:image — zero external/asset
        requests (AR-11).` immediately above the `url: "./"` docblock.
  - [x] 6.2 `src/app/page.tsx` — the identical line, same position.
  - [x] 6.3 `src/app/players/[slug]/page.tsx` — the `generateMetadata` docblock sentence *"NO
        `og:image`: AR-11 permits zero external or asset requests."* Keep its `AC 5` citation honest
        while rewriting around it.
  - [x] 6.4 `src/app/teams/[slug]/page.tsx` — the same sentence, citing `AC 3`.
  - [x] 6.5 `src/app/layout.tsx` — *"this repo ships no `app/public/`"* in the `verification.google`
        docblock. It is now false and it is load-bearing prose: it is the stated reason the meta-tag
        verification method was chosen over a file drop.
  - [x] 6.6 Each replacement states the D20 scoping in its own words rather than pointing at a
        document: AR-11 bars external and third-party requests; `<meta content>` is deliberately
        outside `FETCHING_POSITIONS`; the same-origin property is held by the tests §D9 names, and by
        nothing else.
  - [x] 6.7 **Leave `scripts/assert-no-external-origins.mjs:78` alone.** Its *"while passing
        `og:image`, the one tag that genuinely makes a third party fetch an asset"* is the gate's own
        rationale for an **off-origin** `og:image` and stays true. Confirm rather than assume.

- [x] **Task 7 — the same-origin line, in three places, each driven RED (AC 5, A1)**
  - [x] 7.1 `players/static-output.test.ts` — replace `not.toContain("og:image")` with an assertion
        that `metaContent(html, "property", "og:image")` is a string starting with `SITE_ORIGIN`.
        Note this file's `metaContent` takes **three** arguments (`html, attribute, name`).
  - [x] 7.2 `teams/static-output.test.ts` — replace `toBeNull()` likewise. Note this file's
        `metaContent` takes **two** arguments (`html, property`) and matches `property|name`. The two
        helpers differ; do not copy one call shape into the other file.
  - [x] 7.3 Rename both `it(...)` titles. A test titled *"emits NO og:image"* that asserts the
        opposite is the next reader's trap.
  - [x] 7.4 Extend `src/app/canonical-output.test.ts` with a whole-export assertion (§D9): every
        exported `.html` carries at least one `og:image`, and every `og:image` value starts with
        `SITE_ORIGIN`. That file already walks all 1,407 documents and already extracts meta tags by
        key (`:228`); reuse the existing collector rather than adding a second walk. Its header
        docblock (`:13`, `:32-35`) currently scopes the file to 3.2's AC2/AC3/AC4 — widen it to say
        this story's property lives here too, or the next reader deletes the assertion as
        out-of-scope.
  - [x] 7.5 **RED PROOF ×3 (A1).** Write an off-origin `og:image` into the relevant exported
        document(s) and re-run each of the three assertions. Record the command and the failing
        output for each. Then restore the export (rebuild) and confirm green.
  - [x] 7.6 **RED PROOF for the ESLint rule (AC 4).** Replace one `alt: t("meta.ogImageAlt")` with a
        bare Spanish literal and run `npm run lint`; record the error under `--max-warnings 0`. Then
        do the same for `siteName`. Story 3.1 added both keys to the selector *ahead* of this story;
        this is the demonstration that the hole is actually closed on this story's real shape.
  - [x] 7.7 **Coincidence-green check (A2).** Revert the `images` key at one of the five sites and
        confirm §D9's whole-export assertion goes red naming that route class. If it stays green, the
        gate is measuring something other than what it claims.

- [x] **Task 8 — the full chain and the export audit (AC 9)**
  - [x] 8.1 `npm run build` — green end to end, origin gate exit 0, **0 external subresources**, and
        the site's own origin **absent from the informational `MENTIONED in text` line**. The gate's
        own `assert-no-external-origins.test.ts:272` already pins *"PASSES a self-origin og:image and
        does not even MENTION it — story 3.3 depends on this"*; confirm that holds on the real export,
        not only on its fixture.
  - [x] 8.2 `npm test` — green, **0 skipped**, and the delta against Task 1.3's figure is exactly what
        this story adds. State the number and the delta.
  - [x] 8.3 Route count unchanged: **1,406** `index.html`, **1,407** `.html`.
  - [x] 8.4 Audit the emitted tags across every route class — layout-only (`/about`, `/glossary`,
        `/compare`, `404`) and all four `generateMetadata` classes. Every document must carry
        `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`, `og:type`, `og:site_name`,
        `twitter:card="summary_large_image"`, `twitter:image`, `twitter:image:alt` — **and still**
        `og:url`, `og:locale="es_ES"` and exactly one `<link rel="canonical">`. 3.2's four ACs are
        this story's regression surface; do not assume they survived.
  - [x] 8.5 Confirm **0** `og:locale:alternate` and **0** `hreflang` across the export (3.2 AC4 —
        this story introduces no per-locale anything, D17/D20).

- [ ] **Task 9 — deploy and the paste test (AC 8) — REQUIRES JUAN — OPEN: 9.4/9.5 unreported**
  - [x] 9.1 Commit by pathspec (`git commit -- <paths>`), staging only §Files. Never `git add -A`.
        Add-then-commit is not atomic here and a concurrent session's sweeping add can capture your
        files between the two.
  - [x] 9.2 `gh auth switch -u juanrojasdp` **before** pushing, or the push 403s.
  - [x] 9.3 Push to `main`. Netlify builds from `app/` (`netlify.toml`: base `app`, command
        `npm run build`, publish `out`). Wait for the deploy to go live and confirm
        the card asset returns the PNG with `Content-Type: image/png`. **Re-deployed after the code
        review of 2026-08-27** (`77d4d53`): the card was redrawn (wordmark in Inter 600) and its
        filename now carries a content hash, so the URL verified on the first deploy no longer exists.
        RE-VERIFIED LIVE 80 s after the push — the hashed asset returns `200 image/png`, 39,691 bytes,
        sha256 **byte-identical** to `app/public/`, and the superseded unhashed URL now returns
        **404**, so no stale asset can be served alongside it. The paste-test route itself was read
        over the wire and carries `og:image`, `og:image:alt`, `twitter:card="summary_large_image"`,
        `twitter:image` and `twitter:image:alt`, all naming the hashed card.
  - [ ] 9.4 **HAND OFF TO JUAN — this cannot be done by inspecting tags.** Ask him to paste **one URL
        never pasted before** into **WhatsApp** and into **Slack**, and to report whether a card with
        an **image** renders in each. Give him the exact URL to use. Record both results verbatim,
        including a failure.
  - [ ] 9.5 If either service renders no image, do not close the AC — record what rendered, and check
        the two known culprits first: the file size against WhatsApp's limit (§D12), and an unfurl
        cached from before the deploy (§D13).

- [x] **Task 10 — the record (A4, and the 3.9 hand-off)**
  - [x] 10.1 Fill the Dev Agent Record: every red proof with its command and output, the measured
        baselines and deltas, the PNG's byte size and dimensions, the paste-test results.
  - [x] 10.2 Append to `sprint-status.yaml` — **append only, never regenerate**. It carries the
        project journal and the Epic 2 retro action items.
  - [x] 10.3 Restate for story 3.9, in the completion notes, what it must preserve (§D14). 3.9 is the
        only story left in this epic and it rewrites `app/src/app/page.tsx`.

---

## Dev Notes

### §D0 — WHAT CHANGED UNDER THIS STORY'S FEET, AND WHY THE EPIC TEXT IS STALE

Story 3.2's code review (`18e9022`) rebuilt the export and overturned its own §D8 ruling. The
consequence for this story is recorded in `sprint-status.yaml:103`: *"STORY 3.3 IS RE-BRIEFED (Task
8.5 corrected): it no longer adds `locale`, and four routes it was told were bare already carry a
card."* Three of the four things the epic AC asks for are partly or wholly shipped. **Measured
against `app/out/` at `b8c2fd9`, one document per route class:**

| Tag | Today | This story |
|---|---|---|
| `og:title`, `og:description`, `og:url` | present on all 1,407 | untouched |
| `og:locale` | `es_ES` on all 1,407 | **untouched — do NOT re-add** |
| `og:type` | **absent everywhere** | added at 5 sites |
| `og:site_name` | **absent everywhere** | added at 5 sites |
| `og:image*` | **absent everywhere** | added at 5 sites |
| `twitter:card` | **`summary` on all 1,407** | **flipped** to `summary_large_image` |
| `twitter:title`, `twitter:description` | present on all 1,407 | untouched (auto-derived) |
| `twitter:image*` | absent | arrives **automatically** from `openGraph.images` |

The mechanism behind the last three rows is `postProcessMetadata`
(`node_modules/next/dist/lib/metadata/resolve-metadata.js:619-655`): declaring `openGraph` **at all**
makes Next back-fill a Twitter object from it, and `resolveTwitter`
(`resolve-opengraph.js:175`) computes `card = card || (images?.length ? 'summary_large_image' :
'summary')`. That is why a `summary` card already ships, and it is why `summary_large_image` would
arrive even without AC3's explicit declaration. **Declare it anyway** — the AC asks for it, and an
explicit value stops the card silently reverting to `summary` if a future story drops `images` from
one site.

### §D1 — the asset: one PNG, `app/public/og-card.png`, and `app/public/` is new

`app/public/` genuinely does not exist at `b8c2fd9` (`ls app/public` → no such file). Next copies
`public/` verbatim into the export under `output: "export"`, so the file lands at `out/og-card.png`
and is served same-origin. `app/.gitignore` ignores `.next/` and `out/` only, so the PNG commits
normally. The origin gate's `SCANNED_EXTENSIONS` (`assert-no-external-origins.mjs:58-68`) covers
`.html .js .mjs .css .txt .json .webmanifest .svg .xml` — **`.png` is not scanned**, so the binary
adds nothing to the gate's surface. `robots.ts` emits `Allow: /`, so the asset is crawlable.

**The URL is relative.** `metadataBase: new URL(SITE_ORIGIN)` on the layout resolves `/og-card.png`
absolutely at every site. Writing the origin out instead adds a second literal and turns
`site-origin.test.ts` red — that suite counts the string across `app/src/**`, `app/scripts/**` and the
top-level `app/*.{ts,mjs,json,toml}`, **comments included**, which is the trap the
`verification.google` docblock already records hitting once.

**`next/image` is not involved and must not be reached for.** `next.config.ts` pins
`images: { unoptimized: true }` and AD-11 states *"all imagery is static assets; no runtime image
optimization exists under export"*. A metadata image is a URL string in a `<meta>` tag; nothing
renders it, nothing optimizes it, and no component imports it.

### §D2 — the card is drawn in the site's OWN typefaces, offline, from the repo's own build output

`next/font` ships only `.woff2`, which Pillow cannot read. The toolchain that closes the gap is
already installed on this machine and needs no network — **measured at creation**:

- `fontTools` **4.62.1** with `brotli`, on the system `python`
- `Pillow` **12.2.0**, same interpreter
- `app/.next/static/media/` carries **10** subset `.woff2` files; `TTFont(f)['name'].getDebugName(4)`
  identifies **3 × `Archivo SemiBold Regular`** and **7 × `Inter Regular`**

So: convert woff2 → TTF with `fontTools`, draw with Pillow, write the PNG. The card ends up in
Archivo and Inter — the site's real faces — with no network call and no new dependency in
`package.json`.

**Select by face name, never by filename.** The hashes in `.next/static/media/` change on every
`next build`; a hard-coded filename makes the generator unreproducible one build later. Fail loudly
if neither face is found rather than substituting a system font — a card in Arial is a card that
looks like someone else's site.

The generator lives at `app/scripts/generate-og-card.py`. `app/scripts/` currently holds three `.mjs`
files that are **all** in the `npm run build` chain, so the new file's docblock must say plainly that
it is not: Netlify runs `npm run build` with `app/`'s Node install alone and has no Python interpreter
(AD-13, NFR-8). It is committed because an uncommitted generator means the card can never be
regenerated identically — `download_pmsr_corpus.py` at the repo root is the shipped precedent for a
Python authoring tool that no build step invokes.

### §D3 — five copies of `openGraph`, and the asymmetry that forces them

3.2 established this by measurement and paid for getting it wrong once. Next's `mergeMetadata`
branches on **key presence** per top-level key. `openGraph` is declared at all five sites, so each
child **replaces** the layout's object wholesale — which is why `url: "./"` and `locale: "es_ES"` each
exist five times, with a docblock at every site explaining why. `images`, `type` and `siteName` ride
exactly the same trap: put them only on the layout and they reach `/about`, `/glossary`, `/compare`
and the 404, and **1,402 documents get no card at all**.

The three static routes are **not edited**. Each carries a standing docblock ruling against an
`export const metadata`, and the layout's `openGraph` is what reaches them — the same reasoning that
let 3.2 satisfy its canonical AC without reopening those rulings.

### §D4 — one copy of `twitter`, and it is the mirror image of §D3

`twitter` is declared at **no** site today. A key absent from a child is **inherited**, which is
precisely why 3.2's `alternates: { canonical: "./" }` on the layout alone reaches all 1,406 routes.
So `twitter: { card: "summary_large_image" }` on the layout should reach every document.

**Verify it; do not reason about it (Task 5.2).** 3.2's §D8 was a careful reading of Next's source
that the export flatly contradicted. The same class of claim is being made here, and the cost of
being wrong is 1,402 documents advertising a small card. The measured baseline makes the check easy:
today every document reads `twitter:card = summary`, so a single grep across route classes after the
build settles it.

### §D5 — `twitter.images` is NOT authored

`postProcessMetadata:627` computes `hasTwImages = Boolean(twitter?.hasOwnProperty('images') &&
twitter.images)`, and `:636` back-fills `autoFillProps.images = openGraph.images` when it is false.
The layout's `twitter` object has no `images` key, so the merged metadata picks up **each route's
own** `openGraph.images`. Authoring `twitter.images` would create a second copy of the card URL at
five more sites, each able to drift from its `openGraph` twin, in exchange for nothing. Confirm
`twitter:image` and `twitter:image:alt` land on the export (Task 5.3) rather than trusting this note.

### §D6 — the alt key is `meta.ogImageAlt`

`es.meta` already holds `title` and `description` and is **not** inventory-pinned. `es.app` **is** —
`i18n.test.ts:2309` asserts `Object.keys(es.app)` equals exactly `["siteName"]`, so a key parked
there goes red instantly. That pin is the same one the 2.14 search namespace docblock records
tripping over (`es.ts:2447`).

Locale parity is enforced by the **type system**, not by a test: `en` is typed `Dictionary`, derived
from the canonical `es` shape (`i18n.ts:1-8`), so `tsc --noEmit` fails until both dictionaries carry
the key. Task 3.2 turns that into an actual red demonstration rather than an assertion about a
mechanism.

Duplicate values across the two dictionaries are **allowed** — the only inventory enforcement in this
repo is the composed caption inventory, not a global uniqueness rule.

### §D7 — `siteName` reuses `app.siteName`

`t("app.siteName")` is `"WC Stats"` in both dictionaries and is already the site segment of all four
composed titles. Minting a second key for the same string would be a dead key by 2.18's binding rule.

### §D8 — THE HELPER-MODULE TRAP, AND IT WOULD DISABLE THE AC THAT NAMES IT

The 3.1 selector (`eslint.config.mjs:207` and `:219`) is scoped to
`:matches(VariableDeclarator[id.name="metadata"], FunctionDeclaration[id.name="generateMetadata"],
VariableDeclarator[id.name="generateMetadata"]) Property[key.name=/^(…|alt|siteName)$/]`. It reaches
**only** those two AST scopes.

So a tidy-looking `src/lib/og-card.ts` exporting the image object would put `alt:` **outside the
selector's reach**, and a bare Spanish literal there would ship with the build green — the exact
failure mode AC4 exists to prevent, arrived at by refactoring rather than by carelessness. The
epic's own words are *"Story 3.1's ESLint selector will error on a bare Spanish literal … so this is
enforced, not advisory"*; a helper makes that sentence false.

**Author the image object inline at all five sites.** Five copies is the cost, and it is paid
deliberately. What stops them drifting is §D9's whole-export gate, which measures the emitted
artifact rather than the source — the stronger instrument in every case this project has measured.

The eslint config's own docblock (`:196-206`) records that the `key.value` arm was split off
precisely so `{ "siteName": t("app.siteName") }` is **not** an error while `{ "siteName": "WC Stats" }`
is. Both spellings are safe for the value; only a literal value is gated.

### §D9 — the same-origin line, and why two documents is not a line

The epic and the ledger both say this test is *"the only thing holding the same-origin line"*, because
story 3.1's gate correctly does **not** treat `<meta content>` as a fetching position (D20-b, and
`assert-no-external-origins.test.ts:339` pins that an off-origin `og:image` is **reported and never
failed**). That is right, and it makes the replacement assertions load-bearing in a way ordinary
tests are not.

The two the epic names cover **one player route and one team route** — 2 documents out of 1,407, both
fixture-scale. `canonical-output.test.ts` already walks the entire export and already extracts meta
tags by key (`:228`), for exactly this class of property. Extending it is ~15 lines against the same
collector and raises the line from 2 documents to 1,407, including every route class the two named
tests do not touch: `/`, `/matches/[slug]`, `/about`, `/glossary`, `/compare` and the three not-found
artifacts.

All three are required, and each is driven red independently (Task 7.5). The two named replacements
are **not** superseded by the third — the ledger names them specifically, and a per-route test that
fails names the route.

### §D10 — five comments, not four, and the ruled wording already exists

**Do not invent the replacement prose.** `ARCHITECTURE-SPINE.md:110` (AD-11) was amended on
2026-08-26 and already carries the ruling in its authoritative form:

> The "zero external requests" clause scopes to **THIRD-PARTY ORIGINS, not to assets as such**
> (clarified by D20, 2026-08-26): same-origin static assets under the export are in bounds, and a URL
> in a `<meta>` tag (`og:image`, `twitter:image`) **is not a request the page makes at all** — it is a
> hint a crawler may fetch, off-page and off-session, and it cannot touch LCP, TBT, the payload budget
> or the NFR-9 telemetry surface. The mechanical enforcement is
> `app/scripts/assert-no-external-origins.mjs`, whose `FETCHING_POSITIONS` list is the operative
> definition of "a request"; `<meta content>` is deliberately not in it.

Each of the five corrected comments should compress that to its own site's register and add the one
thing the spine does not say: **what now holds the same-origin property instead** (§D9). The
architecture needs no edit — AR-11 and AD-11 were both amended when D20 was ruled, ahead of this
story.



The ledger names four (`deferred-work.md:4382+`). A fifth is now false and matters as much: the
`verification.google` docblock in `layout.tsx` states the URL-prefix verification method was chosen
*"because this repo ships no `app/public/`"*. After this story it does. Left uncorrected, the next
reader re-derives the ban's premise from a paragraph about Search Console.

The recorded line numbers (`matches/[slug]/page.tsx:49`, `page.tsx:74`, `players/[slug]/page.tsx:53-55`,
`teams/[slug]/page.tsx:64-66`) **predate 3.2's edits to all four files**. Locate them by content. As
of `b8c2fd9`, `page.tsx:74` and `matches/[slug]/page.tsx:49` still happen to be correct; the two
docblock sentences have moved.

### §D11 — the card's baked text is canonical Spanish, and the `en` alt is not dead

A PNG cannot be translated per reader, and this site has one canonical locale per route (D17, upheld
by D20). Every metadata string it emits today is already canonical Spanish regardless of the reader's
toggle — `og:title`, `og:description`, `twitter:title`, `twitter:description` — under the standing
unruled `<title>`-language question (owner: Juan, filed once under 2.12). Spanish copy on the card is
consistent with that, not a new departure, and it should be recorded as such rather than left to look
like an oversight.

The `en` value of `meta.ogImageAlt` is therefore authored, correct, and **never emitted** — exactly
like `en.meta.title` today. It exists because the `Dictionary` type requires it and because the
`<title>`-language question could be ruled the other way later. It is not a dead key.

### §D12 — weight, and which consumer is strictest

WhatsApp is the binding constraint, not X. Keep `og-card.png` **well under 300 KB**; a flat-colour
1200×630 card with a limited palette lands in the tens of KB, so this is a check rather than a
negotiation. `og:image:width`/`height` are emitted because unfurlers that read them skip a fetch to
discover the dimensions. 1200×630 is 1.91:1, which is what `summary_large_image` expects.

There is **no export-size gate** in this repo to trip (checked: nothing asserts over `out/` bytes),
so the number has to be recorded deliberately or it is not recorded at all.

### §D13 — the paste test is the AC, and unfurl caches will lie to you

AC8 says *"verified by pasting, not by inspecting the tags"* because inspecting the tags is what the
other eight ACs already do. It needs a live deploy and a human.

Both WhatsApp and Slack cache unfurls **per URL**. Every route on this site has been pasteable with
no card for months, so a previously-pasted URL can return a cached image-less preview against a
perfectly correct deploy. Use a URL that has never been pasted — one specific player or match route —
and say which one was used. If a card still fails to render, check the file size (§D12) and the
`Content-Type` on the live asset before touching the metadata.

Deploy path: push to `main` → Netlify builds `app/` per `netlify.toml`. `gh auth switch -u
juanrojasdp` first or the push 403s.

### §D14 — WHAT STORY 3.9 MUST PRESERVE

3.9 (Home Page Refactor) is the only story left in Epic 3 and it **rewrites
`app/src/app/page.tsx`** — the one file this story and 3.9 both own. 3.9's own AC rules that whichever
lands second preserves the other's work. **This story lands first.** So, stated plainly for 3.9:

1. **`generateMetadata` in `page.tsx` survives the rewrite intact.** After this story it carries
   `title`, `description`, and an `openGraph` object holding `title`, `description`, `url: "./"`,
   `locale: "es_ES"`, `type`, `siteName` and `images`. The canonical/`og:image` metadata and the
   refactored body must **coexist**; a body rewrite that drops or regenerates the metadata export
   silently breaks 3.2's AC2/AC3 and this story's AC2.
2. **`url: "./"` and `locale: "es_ES"` are not decorative.** Both carry docblocks saying they are
   load-bearing because `openGraph` is replaced wholesale. Dropping either is silent.
3. **The four new UX-DR24 routes — `/tournament`, `/tops`, `/players`, `/teams` — need this story's
   metadata pattern applied to them**, in whichever form 3.9 gives them:
   - if a route declares **no** `openGraph`, it inherits the layout's — card included — and needs
     nothing;
   - if it declares `openGraph` for any reason, it **replaces the layout's wholesale** and must carry
     all seven keys: `title`, `description`, `url: "./"`, `locale: "es_ES"`, `type`, `siteName`,
     `images`;
   - if it declares `alternates` for any reason, it must re-declare `canonical: "./"` alongside
     (3.2's sharper trap, recorded in `layout.tsx`'s docblock).
4. **The whole-export gates pick the four routes up automatically.** `canonical-output.test.ts` and
   §D9's `og:image` assertion walk every `.html` in the export; they do not need editing, and they
   will go red on a new route that ships without a card. `sitemap.ts` picks them up too, by walking
   `src/app` for `page.tsx`. That is by design in all three cases — 3.9 should not have to remember to
   edit a file it has no reason to open.
5. Route count after 3.9 is **1,410**, not 1,406 (3.9's own AC supersedes the earlier "stays 1,406").
   Any count this story records is a pre-3.9 number.

### Files this story owns

**NEW**
- `app/public/og-card.png`
- `app/scripts/generate-og-card.py`

**MODIFIED**
- `app/src/app/layout.tsx` (openGraph +3 keys; `twitter`; the `app/public/` comment correction)
- `app/src/app/page.tsx` **← the A3 collision file (3.9)**
- `app/src/app/matches/[slug]/page.tsx`
- `app/src/app/players/[slug]/page.tsx`
- `app/src/app/teams/[slug]/page.tsx`
- `app/src/locales/es.ts`
- `app/src/locales/en.ts`
- `app/src/app/players/static-output.test.ts`
- `app/src/app/teams/static-output.test.ts`
- `app/src/app/canonical-output.test.ts`
- `_bmad-output/implementation-artifacts/3-3-og-image-twitter-card.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (append only)
- `_bmad-output/implementation-artifacts/deferred-work.md` (close the D20-b entry at `:4382+`)

**NOT owned, do not stage:** the stray 0-byte `17` in the repo root (A4); anything under
`app/src/components/`; `app/scripts/assert-no-external-origins.mjs` (§Task 6.7);
`app/eslint.config.mjs` (3.1's, and already correct).

### Measured baseline at `b8c2fd9`

| Thing | Figure | How |
|---|---|---|
| Tests | **1,508** / **60** files | `npx vitest list` |
| Routes | **1,406** `index.html`, **1,407** `.html` | `find out -name …` |
| `app/public/` | **does not exist** | `ls app/public` |
| Origin literal | **1** occurrence under `app/` | `site-origin.test.ts` |
| `og:image` in export | **0** documents | grep across route classes |
| `twitter:card` in export | **`summary`**, all 1,407 | grep across route classes |
| Next | `16.2.11` | `package.json` |
| Pillow / fontTools | `12.2.0` / `4.62.1` + brotli | system `python` |
| Archivo / Inter woff2 | 3 / 7 files | `.next/static/media/`, by face name |

**Known load-induced flake, pre-existing and not this story's:** `static-output.test.ts`'s
TEMPLATE-literal case times out at 5000 ms under full-suite load (60 files, 1,508 tests) and passes
50/50 standalone in 2.6 s. Recorded in the 3.2 review as a verification note, not a finding. If it
fires, re-run that file alone before investigating.

### Standing Epic 3 criteria in force

- **A1** — every gate driven red once, command and output recorded (Tasks 7.5, 7.6, 7.7). An assertion
  that is retired is **replaced**, never deleted.
- **A2** — no coincidence-green: Task 7.7 reverts one of the five `images` keys and requires the
  whole-export gate to go red naming that route class.
- **A3** — file-ownership probe at Task 1; abort on a held `page.tsx`.
- **A4** — stage only §Files, by pathspec. Never `git add -A`.
- **A5** — this story is the create-light half; every mechanism it names above was checked against the
  installed `next@16.2.11`, the shipped export at `b8c2fd9`, or the running toolchain, and the source
  of each figure is stated.
- **A6** — the Epic 3 retrospective triggers at **epic close**, not here. `epic-3` is `in-progress`
  and story 3.9 remains.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` § Epic 3, Story 3.3 — the eight-clause AC set]
- [Source: `_bmad-output/planning-artifacts/epics.md` § Epic 3 — standing criteria A1–A6]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:4382-4396` — D20-b, the ban retired,
  and "the two pinning assertions must be REPLACED, never merely deleted"]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml:103-108` — story 3.3 re-briefed by
  the 3.2 code review: no `locale`, four routes already carry a card]
- [Source: commit `18e9022` — Story 3.2 code review, the ruling the export overturned]
- [Source: commit `39889bf` — Story 3.1 code review; `<meta content>` stays out of `FETCHING_POSITIONS`]
- [Source: `app/src/app/layout.tsx` — the wholesale-replacement docblock, and the `app/public/` claim
  this story falsifies]
- [Source: `node_modules/next/dist/lib/metadata/resolve-metadata.js:619-655` — `postProcessMetadata`]
- [Source: `node_modules/next/dist/lib/metadata/resolvers/resolve-opengraph.js:163-176` —
  `resolveTwitter`, and the `summary` / `summary_large_image` derivation]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md:106-110`
  — AD-11, amended 2026-08-26: the ruled wording for the five comment corrections, and
  `images: { unoptimized: true }`]
- [Source: `app/eslint.config.mjs:196-221` — the metadata selector's two arms and its scope]
- [Source: `app/src/lib/site-origin.test.ts:37-56` — the drift gate's scanned scope: `src/**`,
  `scripts/**`, top-level `*.{ts,mjs,json,toml}`; `public/` is not walked]
- [Source: `app/src/lib/assert-no-external-origins.test.ts:272-283, 339-351` — the two cases story 3.1
  wrote *for* this story]
- [Source: `app/src/app/canonical-output.test.ts` — the whole-export collector §D9 extends]
- [Source: `netlify.toml` — base `app`, command `npm run build`, publish `out`]

---

## Dev Agent Record

### Agent Model Used

`claude-opus-5[1m]` (Claude Opus 5, 1M context), via the `bmad-dev-story` workflow, 2026-08-27.

### Debug Log References

#### Task 1 — the A3 probe and the measured baselines (AC7, AC9)

`git status --porcelain` returned only `?? 17`, the stray 0-byte root file that belongs to nobody and
is not staged here. `git status --porcelain -- app/src/app/page.tsx app/src/components/SiteHeader.tsx`
returned **empty**: both Epic 3 collision files clean, so **this story owns `page.tsx`** and does not
abort. HEAD at start was `fc1de35` (the story-context commit); the code baseline is `b8c2fd9`.

Every figure below was re-measured, not inherited. All five matched the creation-time figures:

| Thing | Measured 2026-08-27 | Creation-time figure |
|---|---|---|
| Tests / files | 1,508 / 60 | 1,508 / 60 |
| Routes | 1,406 `index.html`, 1,407 `.html` | same |
| `app/public/` | does not exist | same |
| `og:image` / `og:type` in export | 0 / 0 documents | same |
| `twitter:card` | `summary` on all 1,407 | same |

Pre-change tag baseline confirmed on **eight** documents (one per route class, not only `/`):
`og:title`, `og:description`, `og:url`, `og:locale`, `twitter:card=summary`, `twitter:title`,
`twitter:description` — and no `og:type`, no `og:site_name`, no `og:image`, no `twitter:image`.

#### Task 2 — the card asset (AC1)

Toolchain re-measured on the system `python`: fontTools **4.62.1** with brotli, Pillow **12.2.0**.
`.next/static/media/` held **10** subset `.woff2`; `TTFont(f)['name'].getDebugName(4)` returned
**3 x `Archivo SemiBold Regular`** and **7 x `Inter Regular`**, exactly as §D2 recorded.

**Face selection is by name AND by measured coverage, which mattered more than the story anticipated.**
Of the 10 subsets, only **one Archivo and one Inter** actually cover the characters this card draws —
the other eight are missing the digits or the accented vowels (the widest Inter subset, 733
codepoints, has no `0`, `1`, `2`, `4`, `6`, `C`, `D`, `I`, `L`, `M` or `N`). Selecting "the file whose
name ID 4 matches" would therefore have picked a usable face only by luck. The generator narrows the
name-matched candidates to those whose cmap covers the required text, takes the widest, and raises
`SystemExit` naming every candidate if none does. Both faces are variable (`fvar`/`wght`) and are
drawn at their default instance — Archivo's default is **600**, which is why the name says SemiBold;
Inter's is 400. That is what the browser renders too.

Written file: `app/public/og-card.png`, **1200x630**, **38,976 bytes** (~38 KB), sha256 `54c6e3c8...`.
Dimensions read back **from the written file**, not from the draw call. Well under the 300 KB WhatsApp
constraint (§D12); the generator exits non-zero above 300 KB or off 1200x630.

Task 2.5, verified **on disk** after `npm run build`:

```
public/og-card.png  isfile=True isdir=False 38976 bytes sha256=54c6e3c8...
out/og-card.png     isfile=True isdir=False 38976 bytes sha256=54c6e3c8...
$ cmp public/og-card.png out/og-card.png  ->  BYTE-IDENTICAL
```

`isFile()` is asserted rather than assumed, per `sitemap.test.ts:343`'s precedent under
`trailingSlash: true`. It is a file, not a directory.

Task 2.6, **confirmed rather than assumed** by reproducing the gate's own walk in the same shape:
209 files scanned; `scripts/generate-og-card.py` **is** in the scanned set (the walk has no extension
filter); **no** `public/` path is scanned. So the Python generator is read as UTF-8 and must not carry
the domain — it does not — and the first binary ever committed under `app/` is never read as text.
`npm run lint` and `npm test -- site-origin` both green with the `.py` present.

#### Task 3 — the locale key (AC4) — **RED PROOF 1 of 5**

`meta.ogImageAlt` minted under `es.meta` (not `es.app`, whose key list is pinned exactly to
`["siteName"]` by `i18n.test.ts:2309`). Added to `es` **alone** first, to make the parity mechanism
fail rather than assert that it would:

```
$ npx tsc --noEmit
src/locales/en.ts(358,3): error TS2741: Property 'ogImageAlt' is missing in type
  '{ title: string; description: string; }' but required in type
  '{ title: string; description: string; ogImageAlt: string; }'.
EXIT: 2
```

Green after the `en` counterpart. Parity here is enforced by the **type system**, not by a test — `en`
is typed `Dictionary`, derived from the `es` shape.

#### Tasks 4-6 — five `openGraph` sites, one `twitter`, five comments

`type`, `siteName` and `images` authored **inline at all five sites**, never through a helper (§D8 — a
`src/lib/og-card.ts` would move `alt:` outside the eslint selector's AST scope and silently disable
the rule AC4 names). `url: "./"` and `locale: "es_ES"` left **byte-identical** at all five; the new
keys were inserted after them, and `locale` was not re-added anywhere.

`twitter: { card: "summary_large_image" }` authored **once**, on the layout. No `twitter.images` key.

Five comments corrected, all located **by content** (their recorded line numbers predate 3.2's edits):
the two one-liners in `matches/[slug]/page.tsx` and `page.tsx`, the two docblock sentences in
`players/` and `teams/[slug]/page.tsx` (each keeping its own `AC 5` / `AC 3` citation honest), and
`layout.tsx`'s `verification.google` claim that *"this repo ships no `app/public/`"* — now false, and
corrected in place rather than deleted, with the added note that the Search Console method **stays**
as it is because the token is already verified and Search Console silently un-verifies a property
whose token disappears.

Task 6.7, **confirmed rather than assumed**: `<meta content>` appears in **none** of the 13
`FETCHING_POSITIONS` entries (`src`, `srcset`, `poster`, `<link href>`, `<image>/<use> href`, CSS
`url()`, CSS `@import`, `fetch()`, `import()`, `importScripts()`, `new Worker()`, ...). The gate's own
`:78` rationale describes an **off-origin** `og:image` and stays true; the file was not edited.

#### Task 7 — the same-origin line, three places, each driven RED (AC5, A1)

**A bonus red, before the deliberate ones.** The export in `out/` still predated the metadata edits
when the three assertions were first written, so all three failed against a genuinely card-less
export — proof they are not vacuous, before a single deliberate mutation:

```
$ npx vitest run canonical-output players/static-output teams/static-output -t "og:image"
  x emits a SAME-ORIGIN og:image ...  -> expected null to deeply equal Any<String>   (players)
  x emits a SAME-ORIGIN og:image ...  -> expected null to deeply equal Any<String>   (teams)
  x emits ONE same-origin og:image ... -> expected '404.html -> (none), 404/index.html ->...' to be ''
  Tests  3 failed | 38 skipped (41)
```

**RED PROOFS 2, 3 and 4 of 5.** An off-origin `og:image` (`https://evil-cdn.example.com/og-card.png`)
written into three exported documents, each assertion re-run **independently**:

```
$ npx vitest run src/app/players/static-output.test.ts -t "SAME-ORIGIN og:image"
  x emits a SAME-ORIGIN og:image — the card, not a third-party asset
    -> expected false to be true      [out/players/quinones-julian-mex/index.html]

$ npx vitest run src/app/teams/static-output.test.ts -t "SAME-ORIGIN og:image"
  x emits a SAME-ORIGIN og:image — the card, not a third-party asset
    -> expected false to be true      [out/teams/mexico/index.html]

$ npx vitest run src/app/canonical-output.test.ts -t "same-origin og:image"
  x emits ONE same-origin og:image on every exported document (3.3 AC 5)
    -> expected 'about/index.html -> https://evil-cdn....' to be ''
```

The whole-export failure **names the file and the offending value**, per this repo's "failures name
files, not counts" convention. All three documents restored to byte-identical content (sha256
`a9bc7f9c...`, `9f68cbbd...`, `0df1e7e6...` before and after) and re-run green: 3 files, 41 tests
passed.

**RED PROOF 5 of 5 — the ESLint rule, on this story's own shape (AC4).** Story 3.1 added `alt` and
`siteName` to the selector *ahead* of this story; this is the demonstration that the hole is actually
closed, not merely declared closed:

```
$ # alt: t("meta.ogImageAlt")  ->  alt: "Tarjeta de WC Stats"
$ npm run lint
  src/app/players/[slug]/page.tsx
    132:63  error  Metadata strings must come from the locale layer  no-restricted-syntax
  x 1 problem (1 error, 0 warnings)                                        LINT EXIT: 1

$ # siteName: t("app.siteName")  ->  siteName: "WC Stats"   (the openGraph one)
$ npm run lint
  src/app/players/[slug]/page.tsx
    130:17  error  Metadata strings must come from the locale layer  no-restricted-syntax
  x 1 problem (1 error, 0 warnings)                                        LINT EXIT: 1
```

Both are **errors** under `--max-warnings 0`, i.e. build-breaking: enforced, not advisory. File
restored and lint back to exit 0. *(Note for a future reader: `players/[slug]/page.tsx` holds **two**
`siteName: t("app.siteName")` — the composed-title helper call and the new `openGraph` one. The
mutation has to be anchored on its neighbours to hit the right one.)*

**Task 7.7 — coincidence-green check (A2).** The `images` key removed from **one** of the five sites
(`teams/[slug]`), the export rebuilt, and the whole-export gate re-run:

```
x emits ONE same-origin og:image on every exported document (3.3 AC 5)
  -> expected 'teams/algeria/index.html -> (none), t...' to be ''
```

It goes red and it **names that route class** — it is measuring what it claims. The per-route teams
assertion went red in the same state (`expected null to deeply equal Any<String>`).

**A measured bonus from that same mutation, worth recording because it settles §D0's stated risk.**
With `images` dropped from the teams route, `twitter:card` on `out/teams/mexico/index.html` stayed
`summary_large_image` — it did **not** revert to `summary`. That is exactly the behaviour §D0 gives as
the reason to declare `twitter.card` explicitly rather than let `resolveTwitter` derive it, and it is
now demonstrated on the real export rather than asserted. Site restored and rebuilt.

#### Task 8 — the full chain and the export audit (AC9)

```
$ npm run build                                                       BUILD EXIT: 0
  assert-no-external-origins: 6 external origin(s) MENTIONED in text (vendor error-message
    URLs and licences — not fetched): bit.ly, github.com, nextjs.org, react.dev,
    redux-toolkit.js.org, redux.js.org
  assert-no-external-origins: 12687 text asset(s) in out/, 0 external subresources.
```

Origin gate exit 0, **0 external subresources**, and the site's own origin is **absent** from the
informational MENTIONED line — grepped for explicitly, not inferred from the count. The gate's own
case `assert-no-external-origins.test.ts:272` (*"PASSES a self-origin og:image and does not even
MENTION it — story 3.3 depends on this"*) was re-run and passes **against the real export**, not only
against its fixture.

```
$ npx vitest run
  Test Files  60 passed (60)
  Tests       1509 passed (1509)          # 0 skipped
```

**Delta: +1, and it is exactly what this story adds.** 1,508 -> 1,509: the two per-route assertions
were *replaced* (net 0) and `canonical-output.test.ts` gained one new whole-export case (+1). No test
was newly skipped. The known load-induced `static-output.test.ts` TEMPLATE flake did not fire.

**Route count unchanged: 1,406 `index.html` / 1,407 `.html`.**

Export audit (Tasks 8.4/8.5), counted across the whole export rather than sampled — every present-tag
figure is **1,407 of 1,407**:

| Tag | Documents | Must be zero | Documents |
|---|---|---|---|
| `og:image` | 1,407 | `twitter:card="summary"` | **0** |
| `og:image:width` / `:height` / `:alt` | 1,407 | off-origin `og:image` | **0** |
| `og:type` | 1,407 | `og:locale:alternate` | **0** |
| `og:site_name` | 1,407 | `hreflang` | **0** |
| `twitter:card="summary_large_image"` | 1,407 | | |
| `twitter:image` / `twitter:image:alt` | 1,407 | | |
| `og:url` (3.2 regression surface) | 1,407 | | |
| `og:locale="es_ES"` (3.2 regression surface) | 1,407 | | |
| `<link rel="canonical">` (3.2 regression surface) | 1,407 | | |

3.2's four ACs were re-checked rather than assumed to have survived: `og:url`, `og:locale="es_ES"` and
exactly one canonical are all still on all 1,407 (the one-canonical-per-document property is asserted
by `canonical-output.test.ts`, which is green).

**§D4's inheritance claim is VERIFIED, not reasoned about (Task 5.2).** The four `generateMetadata`
routes declare no `twitter` key at all and every one of their documents carries
`summary_large_image`, so the layout's single `twitter` object does reach all 1,407. Had any document
still read `summary`, the key would have gone to all five sites instead. **§D5 confirmed too (Task
5.3):** `twitter:image` and `twitter:image:alt` land on all 1,407 with no `twitter.images` authored —
and `twitter:image:width`/`:height` arrive as well, which §D5 did not predict.

Sample of the emitted card, on `/`:

```
og:image       = <SITE_ORIGIN>/og-card.png
og:image:width = 1200      og:image:height = 630
og:image:alt   = Tarjeta de WC Stats: analitica del Mundial 2026 sobre un campo de futbol.
og:type        = website   og:site_name    = WC Stats
twitter:card   = summary_large_image
```

#### Task 9 — deploy (AC8)

Commit staged **by pathspec** (`git commit -- <paths>`), never `git add -A`: a concurrent session's
sweeping add can capture files between an add and a commit, which are not atomic here. The stray root
`17` was not staged. `gh auth switch -u juanrojasdp` before pushing, or the push 403s.

Commit `a944c9d`, 15 files, pushed to `main` (`b8c2fd9..a944c9d`). Netlify built from `app/` per
`netlify.toml` and went live on the fifth poll (~80 s). The live asset:

```
$ curl -sI https://mundial-stats.juancr.dev/og-card.png
HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: 38976
```

Downloaded and hashed rather than trusted on its `Content-Length`: sha256 `54c6e3c852de8af5...`,
**byte-identical** to `app/public/og-card.png`. The live HTML was checked too — a real player route
served from the CDN carries `og:image`, `og:type`, `og:site_name`,
`twitter:card="summary_large_image"` and `twitter:image`.

**AC8 IS NOT CLOSED BY ANY OF THAT, and deliberately so.** The AC says *"verified by pasting, not by
inspecting the tags"*, because inspecting the tags is exactly what the other eight ACs do. It needs
Juan. See the hand-off in the Completion Notes.

### Completion Notes List

- **AC1 — met.** One 1200x630 PNG at `app/public/og-card.png` (38,976 B), in a directory this story
  creates. `next build` copies it to `out/og-card.png` **byte-identically**, verified on disk with
  `isFile()` asserted rather than assumed. The emitted `og:image` is absolute and same-origin because
  the authored URL is the **relative** `/og-card.png` resolved by `metadataBase`. No second copy of
  the origin literal exists anywhere — `site-origin.test.ts` is green, still allowing exactly one.
- **AC2 — met.** `images` (with `width`, `height`, `alt`), `type` and `siteName` at all five
  `openGraph` sites. `locale` untouched at all five; `url: "./"` untouched at all five.
- **AC3 — met, and it was a flip.** All 1,407 documents read `summary_large_image`; **0** read
  `summary`. `twitter:image` and `twitter:image:alt` present on all 1,407 with `twitter.images`
  deliberately unauthored.
- **AC4 — met and demonstrated.** Both `alt` and `siteName` are `t()` calls at all five sites,
  authored inline inside the gated AST scope. Each was proved to error under `--max-warnings 0` by
  mutation.
- **AC5 — met.** Both shipped assertions **replaced** (never deleted), their `it` titles moved with
  them, and a third assertion added over the whole export. Each of the three driven red
  independently, plus an A2 coincidence-green check that names the route class.
- **AC6 — met, five comments not four.** All located by content. The fifth is `layout.tsx`'s
  `app/public/` claim, which this story falsified.
- **AC7 — met.** A3 probe run at Task 1: both collision files clean, `page.tsx` owned, no abort.
- **AC8 — DEPLOYED, NOT CLOSED.** The deploy is live and the asset is byte-identical over the wire
  (`200`, `image/png`, sha256 match). The AC itself is the paste test and it needs a human.

  **HAND-OFF TO JUAN — paste this URL, which has never been pasted anywhere:**

  ```
  https://mundial-stats.juancr.dev/players/aaronson-brenden-usa/
  ```

  Paste it into **WhatsApp** and into **Slack**, and report for each whether a card with an **image**
  renders. A URL used before would measure a cached unfurl, not this deploy: both services cache per
  URL, and every route here has been pasteable with no card for months, so a cached miss would report
  failure against a correct implementation. Record both results verbatim, a failure included. If
  either renders no image, do **not** close the AC — check the two known culprits first: the file
  size against WhatsApp's limit (38 KB here, against a ~300 KB ceiling, so unlikely) and an unfurl
  cached from before the deploy (§D13).
- **AC9 — met.** Build green end to end, origin gate exit 0, route count unchanged at 1,406, suite
  green at 1,509 with **0 skipped**.

**Three things came out differently from the story's expectations, recorded rather than smoothed
over:**

1. **Font selection by name alone would not have been enough.** Only 1 of 3 Archivo subsets and 1 of 7
   Inter subsets actually covers this card's characters; the rest are missing digits or accented
   vowels. §D2 said "select by face name" — necessary, but not sufficient. The generator narrows by
   measured cmap coverage and fails loudly naming every candidate if none covers the text.
2. **`twitter:image:width` and `twitter:image:height` also arrive automatically**, which §D5 did not
   predict. Same `postProcessMetadata` back-fill; no action needed, but a future reader grepping for
   "why are there two more tags than the AC lists" should find the answer here.
3. **The explicit `twitter.card` earned its keep, measurably.** The A2 mutation (dropping `images`
   from one site) left `twitter:card` at `summary_large_image` rather than reverting to `summary` —
   the exact scenario §D0 offers as the reason to declare it. Now demonstrated, not asserted.

**FOR STORY 3.9 (§D14) — the only story left in this epic, and it rewrites `app/src/app/page.tsx`.
This story landed first; 3.9 preserves the following or breaks 3.2's AC2/AC3 and this story's AC2,
silently:**

1. **`generateMetadata` in `page.tsx` survives the rewrite intact.** It now carries `title`,
   `description`, and an `openGraph` object holding `title`, `description`, `url: "./"`,
   `locale: "es_ES"`, `type`, `siteName` and `images`. The metadata export and the refactored body
   must **coexist**. A body rewrite that regenerates the metadata export is the failure mode.
2. **`url: "./"` and `locale: "es_ES"` are not decorative**, and neither is `images`. All three exist
   because `openGraph` is replaced **wholesale** by any child that declares the key. Dropping any of
   them is silent at the source and visible only in the export.
3. **The four new UX-DR24 routes (`/tournament`, `/tops`, `/players`, `/teams`) need this pattern**:
   declare **no** `openGraph` and they inherit the layout's card and need nothing; declare it for any
   reason and they must carry all **seven** keys (`title`, `description`, `url`, `locale`, `type`,
   `siteName`, `images`); declare `alternates` for any reason and they must re-declare
   `canonical: "./"` alongside.
4. **The whole-export gates pick the four routes up automatically** and will go **red** on a new route
   shipping without a card. `canonical-output.test.ts` (canonical, `og:url`, and now `og:image`) walks
   every `.html`; `sitemap.ts` discovers routes by walking `src/app` for `page.tsx`. None of the three
   needs editing — by design, so 3.9 need not remember to open a file it has no reason to.
5. **Route count after 3.9 is 1,410, not 1,406.** The 1,406/1,407 figures recorded here are pre-3.9.
6. **Do not lift the five `images` objects into a shared helper while tidying.** It is the single
   likeliest way to undo this story: it would move `alt:` outside the eslint selector's reach and let
   a bare Spanish literal ship with the build green.

### Review Findings (Code Review 2026-08-27)

Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), all three run to
completion and cross-verified against the live repo and the emitted `out/` tree. 31 raw findings → 19
unique after dedup → **2 decision-needed, 13 patch, 2 defer, 3 dismissed.** Both decision-needed items
were resolved by Juan on 2026-08-27 (options 1b and 2b) and became patches, so the working total is
**15 patches**.

**Every AC the dev agent claimed closed does hold, and the reviewer re-measured them independently
rather than reading the record.** Over all 1,407 exported documents: `og:image` 1,407/1,407 absolute
and same-origin; `og:image:width=1200`, `:height`, `:alt` 1,407/1,407; `og:type=website` and
`og:site_name` 1,407/1,407; `twitter:card="summary_large_image"` 1,407/1,407 with **0** bare
`summary`; `twitter:image` and `twitter:image:alt` 1,407/1,407. `out/og-card.png` is byte-identical to
`app/public/og-card.png` (sha256 `54c6e3c8…aedfd0`, 38,976 B, 1200×630, rendered and read). The origin
literal still occurs exactly once under `app/` (`src/lib/site-origin.ts:32`). The four touched test
files run **43 passed / 0 skipped**. AC8 is correctly recorded as open and Juan's. **Nothing below
overturns an AC.**

**The headline: this story built three layers of gating for `og:image`'s ORIGIN and none at all for
the two things a reader actually sees — that the file ships, and that the five copies of its URL still
agree.** Five source comments state that `canonical-output.test.ts` "is what stops the five copies
drifting". It does not: it asserts count and origin, never value. Rename `/og-card.png` to
`/og-card-v2.png` in one of the five files, or delete `app/public/og-card.png` outright, and the build
is green, all three new assertions are green, and up to 1,407 documents advertise a 404. Both holes
close with one exact-equality assertion.

#### Decision needed — BOTH RESOLVED 2026-08-27 BY JUAN

**Decision 1 → option (b): switch the card wordmark to Inter 600, matching the header literally.**
Feasibility verified before the call was recorded, not after: exactly one Inter subset in
`.next/static/media/` covers `"WC Stats"` (`83afe278b6a6bb3c-s.p.2bn3s6zvc0dyp.woff2`, cmap 230) and it
carries an `fvar` `wght` axis of 100–900 with default **400** — so drawing it at the header's weight is
not a face swap but a variable-font instantiation, `instantiateVariableFont(font, {"wght": 600})`,
before the woff2→TTF conversion. The current `sized()` helper draws every face at its default instance,
which is why Archivo (default 600) looked right and Inter would not. `python` on this machine has
Pillow 12.2.0, fontTools 4.62.1 and brotli 1.2.0, so the card can actually be regenerated. **This
changes the card's bytes, so it must land BEFORE decision 2's hash is computed.** Re-verify the
wordmark's drawn width against the pitch motif at x=700 after the swap — Inter and Archivo do not set
`"WC Stats"` to the same width at 132 px.

**Decision 2 → option (b): move to a content-hashed card filename.** Chosen over "accept it", so the
card becomes redesignable without stranding every link already unfurled. The filename becomes
`og-card-<sha256[:8]>.png`. **The hash must not become a sixth hand-copied literal**: it goes in one
new module, `src/lib/og-card.ts`, exporting the path, and the five `openGraph` sites import it. This is
safe against the §D8 helper-module trap and was checked against the actual rule rather than the prose —
`eslint.config.mjs:207/219` keys on `title|description|default|template|absolute|alt|siteName`, and
**`url` is not among them**, so only the URL moves out of the metadata objects while `alt:
t("meta.ogImageAlt")` stays inline at all five sites, inside the selector's reach exactly as AC4
requires. It also subsumes the two highest-severity patches below: with one exported constant there is
no five-copy drift left to gate, and the asset-existence assertion can name the file the code actually
references instead of a literal of its own.

- [x] [Review][Decision] **RESOLVED — option (b).** The card's wordmark is set in Archivo; the site's
      own wordmark renders in Inter. `scripts/generate-og-card.py:238,256` draws `"WC Stats"` in `Archivo SemiBold`. The
      shipped wordmark is `SiteHeader.tsx:159` under `type-title`, and `globals.css:415-419` defines
      `type-title` as `font-family: var(--font-sans)` → `--font-inter` (`:227`) at weight 600. Archivo
      is `--font-display` (`:228`), the face used for every large heading in the ramp
      (`type-display-score`, `type-headline`, `type-stat-value`). So both readings are defensible — at
      132 px the card's wordmark is a display element and Archivo is the display face — but the
      script's docblock premise ("the card has to be in the site's own typefaces") is stated as if the
      question does not exist. **Not a defect; a design call only Juan can make.** Options: (a) keep
      Archivo and say why in the docblock, (b) switch to Inter 600 to match the header literally.

- [x] [Review][Decision] **RESOLVED — option (b).** `/og-card.png` is an unhashed URL, and unfurlers
      cache OG images by URL effectively forever. `netlify.toml`'s immutable block is scoped to `/_next/static/*` only
      (verified), so the card itself ships `must-revalidate` — correct for browsers, irrelevant to
      WhatsApp/Slack/Facebook/X, which cache the fetched image per URL for long, non-controllable
      periods. AC8 depends on this fact in the other direction (it demands a never-pasted URL). The
      consequence is one-way: once the card is redesigned, every already-unfurled link keeps the old
      image, and the only remedies are each platform's own debugger. Options: (a) accept it — the card
      is generic and unlikely to be redesigned, (b) move to a content-hashed or versioned filename
      (`/og-card-<hash>.png`) so a redesign is a new URL, (c) accept now and file it for the redesign.

#### Patch — ALL 15 APPLIED 2026-08-27

**Verified after applying, not asserted.** `npm run build` green end to end with the origin gate at
exit 0; route count unchanged at **1,406** `index.html` / 1,407 `.html`; full suite **1,512 tests, 0
skipped** (1,509 before — the `og:image` case became four). The card `out/og-card-7ac312ef.png` is
byte-identical to `public/` (sha256 `7ac312ef…eed0`, and the filename's hash is its own first 8 bytes),
the superseded `og-card.png` is swept from both trees, and **0** exported documents still reference the
unhashed name. Over all 1,407 documents: `og:image` and `twitter:image` both exactly
`<origin>/og-card-7ac312ef.png`, `og:image:alt`, `twitter:image:alt` and
`twitter:card="summary_large_image"` all 1,407/1,407.

**All four new gates driven RED independently, and the mutations are ORTHOGONAL** — each fails exactly
one case and leaves the other three green, so none of them passes by coincidence:

| Mutation | Fails | Others |
|---|---|---|
| `mv out/og-card-7ac312ef.png` away | AC1 asset case | 3 green |
| one doc's `og:image` → `og-card-v2.png` | AC5 exact-value case | 3 green |
| one doc's `og:image:alt` deleted | AC4 alt case | 3 green |
| one doc's `twitter:card` → `summary` | AC3 twitter case | 3 green |

The second is the exact failure this review was filed on: under the previous count-and-origin gate that
mutation **passed**.

One unrelated flake surfaced and was chased to ground rather than absorbed:
`assert-schema-version.test.ts > passes on the current data tree` timed out at 20,000 ms in the full
run and passes in **1.98 s** in isolation. It walks the whole data tree and is load-dependent; it is
not touched by any file in this review. Not filed against this story.

**Ordering is load-bearing for the first three.** D1 changes the card's pixels; D2 derives a filename
from those pixels; the asset-existence and exact-value gates then assert the name D2 produced. Applied
out of order they either hash a stale card or gate a filename that no longer exists.

- [x] [Review][Patch] **(from Decision 1) Draw the wordmark in Inter 600, not Archivo.** Instantiate
      the variable face at `wght=600` before the woff2→TTF conversion rather than drawing at the
      default 400, and re-measure the drawn width against the pitch motif's left edge at x=700 before
      accepting the output. The docblock's typeface rationale (`:32-44`) is rewritten to say which face
      carries which role and why, so the next reader does not re-open a settled question.
      [`app/scripts/generate-og-card.py:238`]

- [x] [Review][Patch] **(from Decision 2) Content-hash the card filename and give it one source of
      truth.** `app/public/og-card-<sha256[:8]>.png`, a new `src/lib/og-card.ts` exporting the path,
      and the five `openGraph` sites importing it — `alt: t("meta.ogImageAlt")` stays inline at all
      five so AC4's eslint gate keeps its reach. The generator computes the hash, writes the hashed
      file, removes the previous card, and rewrites the constant. Delete the old `og-card.png` from
      `app/public/` in the same pass so a stale asset cannot ship alongside the live one.
      [`app/scripts/generate-og-card.py:100`, `app/src/lib/og-card.ts`]

- [x] [Review][Patch] **Nothing asserts the card asset actually ships** — no test checks that
      `out/og-card.png` exists, is a file, or is non-empty. The story's own AC1 "verified on disk" was
      a one-time human step and left no successor; `sitemap.test.ts:343`'s `statSync(...).isFile()` is
      the shipped precedent the story itself cites. Confirmed: `grep -rn "og-card" src/ --include=*.test.ts`
      returns only `assert-no-external-origins.test.ts:283`, a synthetic fixture string proving the
      origin gate *passes* an og:image — not an existence check. [`app/src/app/canonical-output.test.ts`]

- [x] [Review][Patch] **The whole-export gate checks the card's origin, never its value, so the five
      copies can drift freely** — `canonical-output.test.ts:418-435` filters only on
      `ogImages.length !== 1`, `startsWith(SITE_ORIGIN)` and `new URL(...).origin`. Two *different*
      same-origin URLs across route classes both pass. Fix with exact equality against
      `` `${SITE_ORIGIN}/og-card.png` ``, which also closes the "same-origin URL that is not an image"
      hole (`images: [{ url: "./" }]` resolves to the route directory and passes today).
      [`app/src/app/canonical-output.test.ts:418`]

- [x] [Review][Patch] **`og:image:alt` — the one accessibility-facing string in the story, and the
      AC4 deliverable — has no presence assertion anywhere.** `canonical-output.test.ts:240` collects
      the key `og:image` exactly and its comment at `:332-336` records that it deliberately excludes
      `:alt`/`:width`/`:height`; the two per-route cases read only `og:image`. The eslint selector
      (`eslint.config.mjs:207-208`) forbids `alt` being a *bare literal*, and cannot detect `alt` being
      *absent*. Drop `alt: t("meta.ogImageAlt")` from all five sites and it ships green.
      [`app/src/app/canonical-output.test.ts:240`]

- [x] [Review][Patch] **The two per-route assertions use bare `startsWith` — the exact weakness their
      own twin file argues against, in writing.** `canonical-output.test.ts:413-414` reasons
      "`startsWith` alone would accept an origin that merely shares a prefix" and pairs both checks at
      `:423-428`; `players/static-output.test.ts:150` and `teams/static-output.test.ts:160` do not.
      `https://mundial-stats.juancr.dev.evil.example/og-card.png` passes both. The recorded red proof
      used `https://evil-cdn.example.com/...`, which never exercises the prefix case. Same fix folds in
      the self-contradictory `expect(ogImage).toEqual(expect.any(String))` + `ogImage?.startsWith(...)`
      pair (if line 1 excludes `null`, the `?.` is dead; if it does not, the failure message reads
      `expected undefined to be true` instead of naming the missing tag — and `expect.any(String)`
      passes on `""`). A single `expect(ogImage).toBe(\`${SITE_ORIGIN}/og-card.png\`)` is shorter,
      strictly stronger, and self-explaining. [`app/src/app/players/static-output.test.ts:149`,
      `app/src/app/teams/static-output.test.ts:159`]

- [x] [Review][Patch] **AC3's entire deliverable — `twitter:card` / `twitter:image` /
      `twitter:image:alt` — has zero regression guard.** Confirmed:
      `grep -rln "twitter" src/ --include=*.test.ts` returns nothing, and `layout.tsx:177` is the only
      occurrence of `twitter` in all of `app/src/`. The tags are real in the export (re-measured
      1,407/1,407) but nothing re-checks them, and they are *derived* by Next's `postProcessMetadata`
      — so a Next upgrade can silently change them with no source diff at all. The layout comment at
      `:162` says "Verified on the export, not reasoned about"; that verification was a one-time manual
      read. `og:image` got three layers; the property the same diff calls a silent-revert risk got
      none. [`app/src/app/canonical-output.test.ts`]

- [x] [Review][Patch] **The generator hard-codes copies of `es.meta.description`, `app.siteName` and
      six palette hexes, and its docblock asserts the equality as standing fact.**
      `generate-og-card.py:87-99` — `DESCRIPTION` is a byte copy of `src/locales/es.ts:540`, `WORDMARK`
      of `es.ts:21`, and the six colours of `globals.css:27-40`. All match today (verified). Nothing
      detects it when they stop: `site-origin.test.ts` counts only the origin literal, and eslint's
      globs do not match `.py`. This is the one drift surface the story left undefended while paying
      five copies of a 15-line comment to defend another. Fix: have the generator read
      `src/locales/es.ts` and `src/app/globals.css` and fail loudly when its literals are no longer
      found there — it already reads the build output for fonts, so reading the repo is in character.
      Correct in the same pass the docblock's byte-identical-reproducibility overclaim (`:20-22`):
      `optimize=True` output varies with the Pillow/zlib version and the input faces change with
      Next/next-font, so it delivers reproducible *design*, not reproducible *bytes*.
      [`app/scripts/generate-og-card.py:87`]

- [x] [Review][Patch] **The generator's three Python dependencies are recorded nowhere.** It imports
      `fontTools.ttLib` and `PIL` (`:76-77`) and needs `brotli` for woff2 (`:35`). Verified: no
      `requirements.txt`, `pyproject.toml` or `setup.cfg` under `app/` or the repo root, and
      `pipeline/requirements.txt` names none of the three. The file's whole justification is that the
      card can be regenerated; unpinned, unrecorded deps fail on the first fresh machine, and the
      docblock's "nothing is added to `package.json`" reads as "no new dependencies" when three were
      added outside any manifest. **Record them in the docblock, or in a file Netlify will not
      auto-detect — do NOT add `app/requirements.txt`:** `netlify.toml:7` sets `base = "app"`, and a
      `requirements.txt` in the base directory can trigger Netlify's Python dependency install on a
      deploy that must stay Node-only (AD-13, NFR-8). [`app/scripts/generate-og-card.py:76`]

- [x] [Review][Patch] **The "stable across builds" font-selection claim is false on ties.**
      `generate-og-card.py:136` uses strict `>` (`len(cmap) > best[0]`), so two covering subsets with
      equal cmap size resolve to whichever sorts first in `sorted(FONT_DIR.glob("*.woff2"))` — i.e. by
      the content hash in the filename, which changes every build. That is precisely the dependency the
      docblock at `:39-42` says the scheme exists to avoid, and the function's own docstring at
      `:112-115` claims the opposite. Fix: tie-break on something stable (e.g. `sorted(cmap)`), not on
      directory order. [`app/scripts/generate-og-card.py:136`]

- [x] [Review][Patch] **The card is written to disk before it is validated, so a rejected run destroys
      the previous good artifact.** `:255` saves to `OUTPUT`; the dimension check (`:260-261`) and the
      300 KB check (`:262-263`) run afterward and only `raise SystemExit`. There is no
      temp-file-then-rename and no restore path, and `public/og-card.png` is the file the five metadata
      sites point at and the file git will commit. [`app/scripts/generate-og-card.py:255`]

- [x] [Review][Patch] **No overflow guard on the drawn composition — it can silently render off-canvas
      and still exit 0.** `wrap()` (`:170-186`) never breaks a word wider than `max_width` (the split is
      gated on `if current and …`, so an over-long token is appended unconditionally with no
      character-level fallback), and `main()` (`:249-252`) draws an unbounded line count at 46 px steps
      from `y = 404` against `HEIGHT = 630` — line 5 starts at y=588 and clips, line 6 falls off
      entirely. Measured headroom today: 4 lines, widest 546 px against `max_width=560` — 14 px. The
      only post-write assertions check dimensions and byte size, two values that stay correct no matter
      what the copy does. Fix: assert measured max line width ≤ `max_width` and final `y` ≤ `HEIGHT`.
      [`app/scripts/generate-og-card.py:170`]

- [x] [Review][Patch] **`TTFont(path)` is unguarded in the scan loop, so the designed loud failure
      never fires.** `:118` sits inside `for path in sorted(FONT_DIR.glob("*.woff2"))` with no `try`,
      and `brotli` availability is never checked up front. A missing `brotli` or one truncated
      `.woff2` left by an interrupted build aborts the whole run with a raw traceback at the first
      offending file, never reaching the other nine valid subsets or the carefully written
      "no covering subset" message at `:129-134`. [`app/scripts/generate-og-card.py:118`]

- [x] [Review][Patch] **Task 9 is checked `[x]` while its subtasks 9.4/9.5 are `[ ]` and AC8 is
      explicitly open.** The Completion Notes (`:955`) and Change Log (`:1041`) are honest — "AC8 —
      DEPLOYED, NOT CLOSED", "remains open and is Juan's" — but the parent checkbox contradicts them,
      and Status is `review` with a hand-off that has no recorded answer. The checkbox should read
      `[ ]` until the paste test reports. [`_bmad-output/implementation-artifacts/3-3-og-image-twitter-card.md:285`]

- [x] [Review][Patch] **The fifth corrected comment does not state the D20 scoping Task 6.6 requires.**
      `layout.tsx:97-108` corrects the falsified `app/public/` claim (which is all AC6 itself demands,
      so this is a task-level deviation and not an AC failure), but neither it nor the card docblock at
      `:128-152` says anything about AR-11, `FETCHING_POSITIONS`, or what actually holds the same-origin
      line. `layout.tsx` is therefore the only one of the five `openGraph` sites whose reader gets no
      D20 statement. [`app/src/app/layout.tsx:97`]

#### Deferred

- [x] [Review][Defer] **All three card guards sit inside `describe.skipIf(!anyBuilt)` and report green
      when they run over nothing** [`app/src/app/canonical-output.test.ts:295`,
      `app/src/app/players/static-output.test.ts:86`, `app/src/app/teams/static-output.test.ts:116`] —
      deferred, pre-existing. **This is already an OPEN ledger entry filed by 3.2's code review**
      naming `canonical-output.test.ts` by path; this story adds a fourth assertion behind the same
      skip rather than introducing the hole. The new AC5 case inherits it: on a fresh clone, a cleaned
      worktree, or any `npm test` that precedes `npm run build`, the entire same-origin card guard
      passes having asserted nothing — while three source comments call it "the only thing holding the
      same-origin line" without noting it is conditionally inert. The ledger entry is extended rather
      than duplicated.

- [x] [Review][Defer] **The two per-route `metaContent` helpers are not equivalent, and now carry
      byte-identical `it` titles** [`app/src/app/players/static-output.test.ts:67`,
      `app/src/app/teams/static-output.test.ts:75`] — deferred, pre-existing. `players` takes three
      arguments and matches `property` case-sensitively; `teams` takes two, matches
      `(?:property|name)`, and carries the `i` flag. The divergence predates this story; what is new is
      that both files now name their case "emits a SAME-ORIGIN og:image — the card, not a third-party
      asset" while asserting measurably different things. The story documents the divergence in two
      cross-referencing comments (`players:704-706`, `teams:154-155`) rather than removing it, which
      creates a coupling that rots the first time either helper is touched. Not patched here because
      unifying the helpers touches assertions this story does not own.

#### Dismissed (3)

- "Same-origin check accepts a URL that is not an image" — real, but wholly subsumed by the
  exact-equality patch above; not a separate item.
- "`sys.exit(main())` where `main()` returns `None`; mixed quote styles; `TTFont` handles never
  closed" — cosmetic. `sys.exit(None)` exits 0, which is correct.
- "267 lines of ungated Python entered a Node project" — by design and argued explicitly in the
  docblock and §D2 (AD-13: Netlify has no Python interpreter, so the script must stay out of the build
  chain). Its only mechanical contact with CI — `site-origin.test.ts` reading it as UTF-8 — is
  deliberate and was verified.

### File List

**NEW**
- `app/public/og-card.png`
- `app/scripts/generate-og-card.py`

**MODIFIED**
- `app/src/app/layout.tsx`
- `app/src/app/page.tsx`
- `app/src/app/matches/[slug]/page.tsx`
- `app/src/app/players/[slug]/page.tsx`
- `app/src/app/teams/[slug]/page.tsx`
- `app/src/locales/es.ts`
- `app/src/locales/en.ts`
- `app/src/app/players/static-output.test.ts`
- `app/src/app/teams/static-output.test.ts`
- `app/src/app/canonical-output.test.ts`
- `_bmad-output/implementation-artifacts/3-3-og-image-twitter-card.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

**NOT staged** (A4): the stray 0-byte `17` in the repo root; anything under `app/src/components/`;
`app/scripts/assert-no-external-origins.mjs`; `app/eslint.config.mjs`.

### Change Log

| Date | Change |
|---|---|
| 2026-08-27 | Story 3.3 implemented. One same-origin 1200x630 card at `app/public/og-card.png` (a new directory), drawn offline in the site's own Archivo/Inter faces by a committed, non-build-chain Python generator. `images`/`type`/`siteName` at all five `openGraph` sites; `twitter: { card: "summary_large_image" }` once on the layout. `meta.ogImageAlt` minted in both dictionaries. The two shipped `og:image` ban assertions **replaced** and a third added over all 1,407 documents; five red proofs and one A2 coincidence-green check recorded. Five source comments corrected. Ledger entry D20-b closed. Suite 1,508 -> 1,509, 0 skipped; routes unchanged at 1,406. **AC8 (the paste test) remains open and is Juan's.** |

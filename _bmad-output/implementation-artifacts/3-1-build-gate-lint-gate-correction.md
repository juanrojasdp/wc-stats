---
baseline_commit: f07116b18a2ae811c5611500a3e08d3c0c38ebb0
---

# Story 3.1: Build-Gate & Lint-Gate Correction

Status: in-progress

Epic: 3 — Post-Launch Reach (Discoverability, Landing & Navigation)
Baseline: `main` @ `f07116b` — 1,251 tests / 1,406 routes / 0 skipped, live at `mundial-stats.juancr.dev`
Definition: `_bmad-output/planning-artifacts/epics.md` § "Story 3.1" (L1105–1138)

---

## Story

As the builder,
I want the origin gate to stop failing on the site's own URLs and the i18n gate to stop ignoring metadata `alt`/`siteName`,
so that every later discoverability story can build at all, and none of them can ship an untranslated string silently (FR-36, NFR-12).

---

## Why this story is sequenced FIRST, in one paragraph

`app/scripts/assert-no-external-origins.mjs` treats `<link href>` as a fetching position and matches it against `FETCH_HOST`, which has **no concept of the site's own origin** — `ALLOWED` (`:81`) holds exactly `w3.org` and `schema.org`, both XML namespaces. Reproduced against a fixture on 2026-08-26, **exit 1**:

```
assert-no-external-origins: 2 EXTERNAL SUBRESOURCE(S) in the export
  — AR-11 requires zero external requests and NFR-9 bans telemetry:
  <link href>  https://mundial-stats.juancr.dev/players/quinones/
      index.html
  <link href>  https://mundial-stats.juancr.dev/en/players/quinones/
      index.html
EXIT=1
```

`og:image` and `twitter:card` in the same fixture **passed**. The gate has it backwards: it red-builds on a navigation hint that fetches nothing, and waves through the one tag that genuinely causes a third party to fetch an asset. Stories 3.2, 3.3 and 3.4 all emit absolute self-referencing URLs; the first of them to land without this fix red-builds Netlify on all ~1,406 pages with an error naming AR-11 and NFR-9.

**Second, smaller hole, closed here on purpose:** `app/eslint.config.mjs:160`'s metadata selector gates `title|description|default|template|absolute` and **not** `alt` or `siteName`. Story 3.3 authors an `og:image` `alt` and an `openGraph.siteName`; both would ship as bare Spanish literals **with the build green**. Closing the hole before the story that would fall into it is cheaper than after.

---

## Acceptance Criteria

**AC1 — the site's own origin is not an external origin.**
Given `ALLOWED` holds only `w3.org` and `schema.org` (`:81`), when a `SITE_ORIGIN` allowance is added, then an export carrying ~1,406 absolute self-referencing `<link rel="canonical">` URLs passes the gate.
And `SITE_ORIGIN` has **exactly one definition** in the repository, shared with the app's `metadataBase` — two copies drift, and the drift is silent in exactly the direction that matters.

**AC2 — navigation hints are not fetches.**
Given `<link href>` is currently matched against `FETCH_HOST` regardless of `rel`, when the non-fetching `rel` values are excluded, then `rel="canonical"` and `rel="alternate"` are treated as **navigation hints**, on the file's own established precedent for `<a href>` (`:113` — *"a link is a navigation the reader chooses, not a fetch the page performs"*), while `stylesheet`, `preload`, `prefetch`, `icon`, `manifest`, `preconnect`, `dns-prefetch` and `modulepreload` remain fetching positions.

**AC3 — the corrected gate still fails (A1 / NFR-12).**
Given this file's own `scanned === 0` guard (`:266`) which exists for precisely this reason, when the corrected gate is run against a fixture carrying an **off-origin `<link rel="stylesheet">`** and an **off-origin `og:image`**, then it still **exits 1** and names both, and that failing run is recorded in the completion notes. A gate that stopped failing has proved nothing.

> ⚠️ **READ AC3 EXACTLY.** "Names both" does **not** mean the gate fails *on* the `og:image`. `<meta content>` is deliberately **not** a fetching position (D20-b; AR-11 as amended; AD-11 as amended) and this story does **not** add it. The required output shape is:
> - the off-origin **stylesheet** appears in the `EXTERNAL SUBRESOURCE(S)` block → **exit 1**;
> - the off-origin **`og:image` origin** appears in the informational `external origin(s) MENTIONED in text` line.
>
> Making the gate fail on `og:image` would contradict D20-b and **break story 3.3 before it starts**. See Decision D3-1-e.

**AC4 — the i18n metadata selector gates `alt` and `siteName`.**
Given `app/eslint.config.mjs:160` gates `title|description|default|template|absolute` but not `alt` or `siteName`, when both keys are added to that selector, then a bare Spanish literal as an `openGraph.images.alt` or `openGraph.siteName` value is an ESLint error under `--max-warnings 0`, demonstrated red once before the rule is accepted.
And the hole is closed **before** story 3.3 opens it, not after.

**AC5 — the full chain is green and nothing is newly skipped.**
Given `npm run build` (lint → typecheck → schema assert → `next build` → `copy-data` → origin gate), when it runs after this story, then it is green end to end, the route count is still **1,406**, and no test is newly skipped.

### Standing acceptance criteria — Epic 3 A1–A6 (apply in addition)

| | Applies here as |
|---|---|
| **A1** — a gate that has never been red is not a gate | This story is *entirely* gates. **Seven** distinct red demonstrations are required (Task 8). Retiring an assertion is never how a gate is satisfied. |
| **A2** — no coincidence-green tests | The new *positive* test (canonical links pass) must be shown to **fail against the pre-fix script**. Fixtures are built from the imported `SITE_ORIGIN`, never from a hardcoded domain literal — a hardcoded copy would be both a coincidence-green risk and a violation of AC1's one-definition rule. |
| **A3** — concurrent-session protocol | Task 1 is the file-ownership probe. Abort at Task 1 if either collision file is held. |
| **A4** — commit own paths only | Task 9. Never `git add -A`. The four `spec-sign-the-project.md` files belong to 3.6. |
| **A5** — create-light / validate-hard | The fresh-context validation pass is **recorded below** (§ "Validation pass"). Every mechanism, file and line cited in this story was read at `f07116b`. |
| **A6** — Epic 3 retrospective | Epic-level; `epic-3-retrospective: required` already set. Nothing for this story. |

---

## Ownership — read before touching anything (A3)

**This story OWNS, and modifies:**

| Path | Mode |
|---|---|
| `app/src/lib/site-origin.ts` | **NEW** |
| `app/src/lib/site-origin.test.ts` | **NEW** |
| `app/scripts/assert-no-external-origins.mjs` | MODIFY |
| `app/src/lib/assert-no-external-origins.test.ts` | MODIFY (extend — never shrink) |
| `app/eslint.config.mjs` | MODIFY |

**This story does NOT touch — each is another story's or another session's:**

| Path | Owner |
|---|---|
| `app/src/app/page.tsx` | 3.2 / 3.3 (metadata), 3.9 (rewrite) — **known collision file** |
| `app/src/components/SiteHeader.tsx` | 3.6 (in flight, uncommitted), 3.10 — **known collision file** |
| `app/src/components/AttributionFooter.tsx`, `app/src/locales/es.ts`, `app/src/locales/en.ts` | 3.6, uncommitted in the working tree |
| `app/src/app/layout.tsx` | 3.2 — `metadataBase` is **3.2's** edit, not this story's |
| `app/src/app/players/static-output.test.ts`, `.../teams/static-output.test.ts` | 3.3 — the two `og:image` pinning assertions |
| The four og:image ban comments (`matches/[slug]/page.tsx:49`, `page.tsx:74`, `players/[slug]/page.tsx:53-55`, `teams/[slug]/page.tsx:64-66`) | 3.3 |
| `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/**` | **bmad-ux session, running concurrently.** Do not read as settled, do not write, do not stage. |

**Probe result at story-creation time** (`f07116b`, 2026-08-26): `app/` is **clean**. Both collision files are unmodified. The only dirty paths in the repo are the six `ux-designs/…` files held by the concurrent bmad-ux session. **Re-run the probe at Task 1 — this snapshot is not a substitute for it.**

---

## Tasks / Subtasks

### Task 1 — File-ownership probe (A3). Do this first; it can abort the story.

- [x] 1.1 `git status --porcelain` — record the full output in the Dev Agent Record.
- [x] 1.2 `git status --porcelain app/src/app/page.tsx app/src/components/SiteHeader.tsx` — record it. Empty output is the expected and required result.
- [x] 1.3 If either collision file is dirty: this story does not modify them and can proceed, **but record that fact** so a later reader does not read silence as a clean tree.
- [x] 1.4 If any path in the OWNS table above is already dirty (another session holds it), **abort at this task and say so** — Story 2.18's precedent, which was the correct call. Do not proceed and do not "merge around it".
- [x] 1.5 Record the owned-path list from the table above into the Dev Agent Record as this story's declared ownership.

### Task 2 — `SITE_ORIGIN`: exactly one definition (AC1)

- [x] 2.1 Create `app/src/lib/site-origin.ts`. Exactly one exported constant, in exactly this line shape (the gate parses it — see 3.1):

  ```ts
  export const SITE_ORIGIN = "https://mundial-stats.juancr.dev";
  ```

  With a docblock stating: this is the ONE definition; `metadataBase` (story 3.2), the sitemap (3.4) and `app/scripts/assert-no-external-origins.mjs` all derive from it; a second copy drifts silently in the direction that matters.
- [x] 2.2 **No trailing slash, no path.** The value must satisfy `new URL(SITE_ORIGIN).origin === SITE_ORIGIN`. Enforced mechanically at 3.2 and 2.4.
- [x] 2.3 Create `app/src/lib/site-origin.test.ts` with two assertions:
  - **origin shape:** `expect(new URL(SITE_ORIGIN).origin).toBe(SITE_ORIGIN)` and `expect(SITE_ORIGIN.startsWith("https://")).toBe(true)`.
  - **the drift gate (AC1's "exactly one definition"):** scan `app/src/**`, `app/scripts/**` and `app/*.{ts,mjs,json,toml}` for the literal origin string; assert **exactly one** occurrence, and that it is in `src/lib/site-origin.ts`. Exclude `node_modules/`, `.next/`, `out/`. Fail with a message naming every offending file.
    - Pin by **relative path**, not by an id a fixture could share (A2).
    - This is the mechanical form of "two copies drift". Without it, AC1's second clause is prose.

### Task 3 — Teach the origin gate the site's own origin (AC1, AC3)

File: `app/scripts/assert-no-external-origins.mjs`. **Node built-ins only, no dependencies** — this runs on Netlify with `app/`'s install alone. Do not add an import of anything outside `node:*`.

- [x] 3.1 Read `SITE_ORIGIN` from `src/lib/site-origin.ts` by regex, **mirroring `assert-schema-version.mjs`'s `readGeneratedVersion()` (`:28-37`) exactly** — the shipped, dependency-free, in-directory precedent for "one definition, two readers":

  ```js
  const SITE_ORIGIN_FILE = path.join(APP_DIR, "src", "lib", "site-origin.ts");

  async function readSiteOrigin() {
    const source = await readFile(SITE_ORIGIN_FILE, "utf8");
    const match = /^export const SITE_ORIGIN = ["'`]([^"'`]+)["'`];$/m.exec(source);
    if (match === null) {
      throw new Error(
        `could not find \`export const SITE_ORIGIN = "<origin>";\` in ${SITE_ORIGIN_FILE}`
      );
    }
    return match[1];
  }
  ```

- [x] 3.2 Resolve it at module top level, and **exit 2 loudly on any failure** — never fall back to a default. Exit 2, not 1, follows the file's own recorded rule at `:254-265`: *nothing was found to be wrong with the export, the check could not be performed*.

  ```js
  let SITE_ORIGIN;
  try {
    SITE_ORIGIN = await readSiteOrigin();
    if (new URL(SITE_ORIGIN).origin !== SITE_ORIGIN) {
      throw new Error(`SITE_ORIGIN must be a bare origin (no trailing slash, no path): ${SITE_ORIGIN}`);
    }
  } catch (error) {
    console.error(`assert-no-external-origins: ${error instanceof Error ? error.message : error}`);
    process.exit(2);
  }
  ```

  Top-level `await` is already in use in this module (`for await`, `:222`); ESM allows it.
- [x] 3.3 Add the allowance to `ALLOWED`, with the dots **escaped** and an explicit **origin boundary**:

  ```js
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const ALLOWED = [
    /^https?:\/\/(www\.)?w3\.org\//i,
    /^https?:\/\/(www\.)?schema\.org\//i,
    new RegExp(`^${escapeRegExp(SITE_ORIGIN)}(?:[/?#]|$)`, "i"),
  ];
  ```

  Two details that are the whole point of the line, each with a red proof in Task 8:
  - **Escaping is not cosmetic.** Unescaped, `mundial-stats.juancr.dev` matches `mundial-statsXjuancrYdev`.
  - **The boundary `(?:[/?#]|$)` is the security-relevant half.** Without it, `https://mundial-stats.juancr.dev.evil.com/track.js` is allow-listed. `[/?#]` rather than the change proposal's `(/|$)` so that a bare-origin query or fragment form is not falsely reported as external.
  - **Scheme-exact by design:** an `http://` self-URL is NOT allow-listed. A canonical emitted over `http` is a real defect and should surface. State this in the comment so it is not "fixed" later.
- [x] 3.4 Comment it in this file's voice, saying what it is for: the site's own origin is not an external origin; absolute self-referencing URLs are what `metadataBase` exists to emit; the gate used to fail the build on all ~1,406 of them while passing `og:image`.

### Task 4 — Non-fetching `rel` exclusion, deny-by-default (AC2)

- [x] 4.1 Extend the `FETCHING_POSITIONS` tuple with an **optional fourth element**, an `extract(match)` callback returning the URL or `null`. All existing entries pass `undefined` and keep group-1 behaviour. One code path, no special-casing in the loop:

  ```js
  for (const [position, pattern, onlyExtensions, extract] of FETCHING_POSITIONS) {
    if (onlyExtensions !== undefined && !onlyExtensions.has(extension)) continue;
    for (const match of text.matchAll(pattern)) {
      const url = extract === undefined ? match[1] : extract(match);
      if (url === null || allowed(url)) continue;
      // …unchanged…
    }
  }
  ```

- [x] 4.2 Replace the `<link href>` entry (`:121`) with a whole-tag match plus an extractor:

  ```js
  ["<link href>", new RegExp(String.raw`<link\b[^>]*>`, "gi"), undefined, linkHref],
  ```

- [x] 4.3 Implement `linkHref(match)`:
  - Read `href` from the tag; if it does not match `^${FETCH_HOST}$` (i.e. it is relative, or not a host-bearing URL), return `null`.
  - Read the `rel` attribute, **accepting the unquoted form too**: `\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`. If `rel` is only matched when quoted, an unquoted `rel=canonical` falls through to deny-by-default and **red-builds on a correct canonical** — a build-breaking false positive.
  - Split `rel` on whitespace, lowercase the tokens.
  - Return `null` **only if there is at least one token and every token is in `NON_FETCHING_RELS`**. Otherwise return the href.
- [x] 4.4 Define the set, and only these two:

  ```js
  const NON_FETCHING_RELS = new Set(["canonical", "alternate"]);
  ```

- [x] 4.5 **Deny by default, and say so in the comment.** Three consequences, each pinned by a test in Task 5:
  - A `<link>` with **no `rel` at all** is a fetching position.
  - A `<link>` with an **unknown `rel`** is a fetching position. A future `rel` value must be added deliberately; it must not arrive allow-listed.
  - `rel="alternate stylesheet"` is a **fetching position**. This is a real HTML idiom, and an "is `alternate` present?" substring test would blow a hole straight through AR-11.
- [x] 4.6 Comment it on the file's own precedent: `<a href>` is excluded at `:113` because *"a link is a navigation the reader chooses, not a fetch the page performs"*. `rel="canonical"` and `rel="alternate"` are the same class of thing. `stylesheet`, `preload`, `prefetch`, `icon`, `manifest`, `preconnect`, `dns-prefetch`, `modulepreload` are not, and stay gated.

### Task 5 — Gate tests (AC1, AC2, AC3, A1, A2)

File: `app/src/lib/assert-no-external-origins.test.ts`. **Extend the existing 9 cases; delete none.** The existing `tree()` / `run()` helpers do everything needed.

- [x] 5.1 `import { SITE_ORIGIN } from "@/lib/site-origin";` and build every fixture URL from it. **No hardcoded domain literal anywhere in this file** — it would be a second copy (AC1) and would make the drift gate in Task 2.3 go red.
- [x] 5.2 **PASSES:** a self-origin `<link rel="canonical" href="${SITE_ORIGIN}/players/quinones/">` → exit 0, output contains `0 external subresources`.
- [x] 5.3 **PASSES:** a self-origin `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en/…">` → exit 0.
- [x] 5.3b **PASSES — and this one is discriminating (AC2):** an **off-origin** `<link rel="alternate" hreflang="en" href="https://example.org/en/">` → exit 0, with `example.org` in the `MENTIONED in text` line. A navigation hint is not a fetch **regardless of origin** — the `<a href>` precedent at `:113`, exactly. This is the only case that Task 4 alone covers, so it is what Task 8.3 drives red.
- [x] 5.4 **PASSES — and this one is discriminating too:** a self-origin `<link rel="preload" as="font" href="${SITE_ORIGIN}/_next/static/media/x.woff2">` → exit 0. A **fetching** `rel`, allowed on origin rather than on `rel` — the only case Task 3 alone covers, and what Task 8.2 drives red.

  > **Why 5.3b and 5.4 exist as separate cases:** on a self-origin `rel="canonical"` (5.2) the two mechanisms **overlap** — either one alone lets it pass. Reverting one and re-running 5.2 would stay green and prove nothing. 5.3b isolates Task 4; 5.4 and 5.6 isolate Task 3.
- [x] 5.5 **PASSES, informational only:** a self-origin `<meta property="og:image" content="${SITE_ORIGIN}/og-card.png">` → exit 0, and the origin does **not** appear in the `MENTIONED` line (it is allow-listed). Story 3.3 depends on this.
- [x] 5.6 **PASSES:** an `.xml` fixture with self-origin `<loc>` entries → exit 0, and the site's own origin is **not** reported as an external origin MENTIONED in text. Story 3.4 depends on this.
- [x] 5.7 **REJECTS (AC3, the required negative):** one fixture carrying **both** an off-origin `<link rel="stylesheet" href="https://fonts.googleapis.com/…">` **and** an off-origin `<meta property="og:image" content="https://cdn.evil.example.com/card.png">`.
  Assert **all four** properties:
  - `status === 1`;
  - output contains `fonts.googleapis.com` under `<link href>` (the failure);
  - output contains `cdn.evil.example.com` in the `MENTIONED in text` line (the report);
  - the `og:image` URL is **not** in the `EXTERNAL SUBRESOURCE(S)` block. *This last assertion is what stops a future "hardening" from re-banning `og:image` and breaking 3.3.*
- [x] 5.8 **REJECTS:** `<link rel="alternate stylesheet" href="https://cdn.example.com/alt.css">` → exit 1. (Task 4.5.)
- [x] 5.9 **REJECTS:** `<link href="https://cdn.example.com/x.css">` with **no `rel`** → exit 1. (Deny-by-default.)
- [x] 5.10 **REJECTS:** `<link rel="stylesheet" href="https://cdn.example.com/x.css">` where a *canonical* to the same off-origin host also exists in the same document → exit 1, naming the stylesheet. *Proves the exclusion is per-tag, not per-host.*
- [x] 5.11 **REJECTS (the boundary):** `<script src="https://mundial-stats.juancr.dev.evil.com/track.js">` → exit 1. Build this fixture as `` `${SITE_ORIGIN}.evil.com` `` so it stays correct if the origin ever changes.
- [x] 5.12 **REJECTS (the escape):** a host built by replacing the dots of `SITE_ORIGIN`'s hostname with another character (e.g. `mundial-statsXjuancrYdev`) in a `src` → exit 1.
- [x] 5.13 Keep all 9 existing cases passing unchanged. If any now fails, **stop** — it means Task 3 or 4 widened something it should not have.
- [x] 5.14 Run: `npm run test -- src/lib/assert-no-external-origins.test.ts src/lib/site-origin.test.ts`. Chunk the suite; do not run the full 1,251 in one shot until Task 7.

### Task 6 — i18n metadata selector: `alt` and `siteName` (AC4)

File: `app/eslint.config.mjs`, the metadata selector at `:155-162`.

- [x] 6.1 Add `alt` and `siteName` to the key regex.
- [x] 6.2 **Also reach the quoted-key spelling.** The selector keys on `key.name` only, so `{ "alt": "Texto" }` — a Property whose key is a Literal with no `key.name` — passes silently. This is the identical hole the 2.18 code review closed for the object-prop family (see the comment at `:75-84`); the metadata selector never got the same treatment, and 3.3 authors nested object literals where the quoted spelling is entirely plausible. Result:

  ```
  :matches(VariableDeclarator[id.name="metadata"], FunctionDeclaration[id.name="generateMetadata"], VariableDeclarator[id.name="generateMetadata"]) Property:matches([key.name=/^(title|description|default|template|absolute|alt|siteName)$/], [key.value=/^(title|description|default|template|absolute|alt|siteName)$/]) > :matches(Literal, TemplateLiteral, BinaryExpression, LogicalExpression, ConditionalExpression)
  ```

- [x] 6.3 Extend the existing comment to record: `alt` already appears in the JSX-attribute regexes at `:40` — this is a **different AST path** (a metadata object property, not a JSX attribute), not a duplicate; and the `key.value` arm exists because a quoted key is a different AST shape, per the file's own 2.18 lesson.
- [x] 6.4 Confirm no existing code newly breaks. **Expected: none.** The four shipped `siteName:` properties inside `generateMetadata` (`page.tsx:70`, `matches/[slug]/page.tsx:43`, `players/[slug]/page.tsx:73`, `teams/[slug]/page.tsx:93`) all hold `t("app.siteName")` — a `CallExpression`, which the value matcher does not include. No `alt:` exists in any metadata object today. Verify with `npm run lint`, do not assume.
- [x] 6.5 Note the selector's deliberate breadth in the comment: it is a **descendant** selector, so a `siteName:` inside a helper-call argument object within `generateMetadata` (which is exactly the shape all four sites use) is gated too. That is correct — it is a user-facing string either way.

### Task 7 — Full chain (AC5)

- [x] 7.1 `npm run lint` — clean under `--max-warnings 0`.
- [x] 7.2 `npm run typecheck` — clean.
- [x] 7.3 `npm run test` — record the total. Expect **1,251 + the count added in Tasks 2.3 and 5**, **0 skipped**. Run it in chunks or in the background; long runs get killed in this environment.
- [x] 7.4 `npm run build` — green end to end, including the origin gate's final line. Long-running (1,406 routes): run in the background rather than in a foreground call that will be killed.
- [x] 7.5 Record the gate's own final output line and the route count from `next build`. **Route count must still be 1,406.**
- [x] 7.6 Confirm the gate's `scanned` count is non-zero and it did not silently take the `scanned === 0` path.

### Task 8 — The seven red demonstrations (A1 / NFR-12). None is optional.

For each: record **the exact command** and **its failing output** in the Completion Notes, then return to green. A gate that has never been red is not a gate.

- [x] 8.1 **The negative gate still fires.** `npm run test -- src/lib/assert-no-external-origins.test.ts` — cases 5.7–5.12 assert exit 1 against deliberately broken fixtures. Record the gate's own stderr from case 5.7 (run the script directly against a temp fixture to capture it verbatim).
- [x] 8.2 **The `SITE_ORIGIN` allowance is load-bearing, and its tests are not coincidence-green (A2).** Temporarily revert **only** the `SITE_ORIGIN` entry in `ALLOWED` (Task 3.3) and re-run cases **5.4 and 5.6**. Both must go **RED**. Record the failures. Restore.
  *Do not use case 5.2 for this — a self-origin canonical is covered by Task 4 as well and would stay green, proving nothing. That overlap is the trap this sub-task exists to avoid.*
- [x] 8.3 **The `rel` exclusion is load-bearing.** Temporarily restore the old `<link href>` tuple (`:121`) and re-run case **5.3b** (the off-origin `rel="alternate"`). It must go **RED**. Record. Restore.
  *Again not 5.2 — the `SITE_ORIGIN` allowance would still carry it.*
- [x] 8.4 **The origin boundary is load-bearing.** Temporarily change the allowance regex to drop `(?:[/?#]|$)` and re-run case 5.11. It must go **RED**. Record. Restore.
- [x] 8.5 **The regex-read fails loudly, not silently.** Temporarily reformat `site-origin.ts` so the Task 3.1 regex misses it (e.g. split the declaration across two lines). Run `node scripts/assert-no-external-origins.mjs out` — it must print the named error and **exit 2**, never exit 0 and never fall back to a default. Record. Restore.
- [x] 8.6 **The drift gate fires.** Temporarily add the origin literal a second time in a throwaway file under `app/src/lib/`, run `npm run test -- src/lib/site-origin.test.ts`. It must go **RED** and name the offending file. Record. Delete the throwaway file — **do not leave it in the tree and do not stage it**.
- [x] 8.7 **The lint rule fires, both spellings.** Create a throwaway `app/src/lib/__lint-probe.ts`:

  ```ts
  export const metadata = {
    openGraph: {
      siteName: "WC Stats",
      images: [{ url: "/og-card.png", alt: "Mapa de tiros del partido" }],
    },
  };
  ```

  …plus a second variant with **quoted keys** (`"alt": …`, `"siteName": …`) to prove Task 6.2. Run `npx eslint src/lib/__lint-probe.ts` from `app/`. Both must error with *"Metadata strings must come from the locale layer."* Record the output. **Delete the probe file** — it would fail `npm run lint` if left, and it must never be committed.

### Task 9 — Commit (A4)

- [ ] 9.1 `git status --porcelain` — confirm the only dirty paths are this story's five owned files plus this story file and `sprint-status.yaml`.
- [ ] 9.2 Stage **by explicit path only**. Never `git add -A`, never `git add app/`, never a directory add.

  ```
  git add app/src/lib/site-origin.ts app/src/lib/site-origin.test.ts \
          app/scripts/assert-no-external-origins.mjs \
          app/src/lib/assert-no-external-origins.test.ts \
          app/eslint.config.mjs \
          _bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md \
          _bmad-output/implementation-artifacts/sprint-status.yaml
  ```

- [ ] 9.3 Verify no `ux-designs/**` path and no `spec-sign-the-project.md` path (`SiteHeader.tsx`, `AttributionFooter.tsx`, `es.ts`, `en.ts`) is staged: `git diff --cached --name-only`.
- [ ] 9.4 Commit directly to `main`. No branch, no PR.
- [ ] 9.5 Push. If it 403s: `gh auth switch -u juanrojasdp` first.
- [ ] 9.6 Append a one-paragraph journal entry to `sprint-status.yaml` (append only — that file carries the project journal and the Epic 2 retro action items; **never rewrite it**) and set `3-1-build-gate-lint-gate-correction: done` when code review closes, not before.

---

## Ruled decisions — do not relitigate

**D3-1-a — `SITE_ORIGIN` lives in `app/src/lib/site-origin.ts` (TypeScript), and the `.mjs` gate reads it by regex.**
Two candidates were considered and one was validated empirically at story-creation time:

- **Chosen:** a TS module. The app imports it normally (story 3.2's `metadataBase`, 3.4's sitemap) with zero bundler risk; the gate reads it with the *shipped, in-directory, dependency-free* precedent — `assert-schema-version.mjs:28-37` does exactly this for `SCHEMA_VERSION`, including the loud throw when the regex misses. Every link in the chain is already in production.
- **Rejected, but validated so nobody re-derives it:** a plain `app/src/lib/site-origin.mjs` imported by both. Probed at `f07116b` — `node -e "import('./src/lib/site-origin.mjs')"` resolves ✔ and `npx tsc --noEmit` accepts `import { SITE_ORIGIN } from "@/lib/site-origin.mjs"` under `strict` ✔ (`allowJs: true`, `moduleResolution: "bundler"`). The **third** link — Turbopack resolving that specifier during `next build` — was **not** proved, and story 3.1 does not exercise the app-side import at all, so the failure would surface inside 3.2 rather than here. Rejected on that gap alone, not on preference. If Task 3.1's regex ever becomes untenable, this is the pre-validated fallback.
- **Rejected outright:** an env var or `argv` for the origin. AD-13 bans runtime env dependencies, and it would reintroduce two sources of truth.

**D3-1-b — deny-by-default on `<link rel>`.** Only `canonical` and `alternate` are excluded, and only when *every* `rel` token is non-fetching. A new or unknown `rel` arrives **gated**, and must be excluded deliberately. The opposite design (a deny-list of fetching rels) means every `rel` HTML gains in future is silently allow-listed.

**D3-1-c — the two mechanisms are independent and both are required.** They are not redundant:
- The `rel` exclusion makes `canonical`/`alternate` non-fetching **regardless of origin**.
- The `SITE_ORIGIN` allowance makes the site's own origin non-external **in every position** — including `<link rel="preload">`, and including the informational `MENTIONED in text` line, which would otherwise report the site's own origin as external over 3.4's sitemap. Wrong signal on a green build is how a gate gets switched off; this file's header says so twice.

**D3-1-d — `og:image` and `<meta content>` stay out of `FETCHING_POSITIONS`.** D20-b, AR-11 (amended `epics.md:108`) and AD-11 (amended `ARCHITECTURE-SPINE.md:110`). A `<meta content>` URL is a hint a crawler may fetch, off-page and off-session; it cannot touch LCP, TBT, the payload budget or the NFR-9 telemetry surface. **The gate correctly cannot catch an off-origin `og:image` — story 3.3's replaced test assertions are the only thing holding that line.** Do not "improve" this.

**D3-1-e — AC3's "names both" is a two-channel assertion, not two failures.** See the callout under AC3 and Task 5.7. This is the single most likely way to implement this story wrong.

**D3-1-f — the `key.value` arm of the metadata selector is in scope.** It is the same hole, on the same line, and 3.3 is the story that would fall into it. It carries its own red proof (Task 8.7) rather than riding on the `alt`/`siteName` one.

---

## Dev Notes

### The two files, as they stand today (read before editing)

**`app/scripts/assert-no-external-origins.mjs`** (298 lines, Story 2.19 Task 6.14 + the 2.19 code review). Its header states its own design rule and the story must stay inside it:

- *"matches FETCHING POSITIONS only: the attributes and call sites that actually cause a request. Everything else external is COUNTED AND PRINTED but does not fail the build."*
- *"A gate that cries wolf on a green tree gets switched off."* — the reason a false positive on 1,406 canonicals is not a cosmetic problem.
- Node built-ins only. No dependencies, ever: Netlify installs `app/` alone.
- `SCANNED_EXTENSIONS` already includes `.xml` — added by the 2.19 code review **with a sitemap named as the motivating case**. Story 3.4 needs nothing added here.
- `SKIPPED_DIRECTORIES = ["data"]`.
- `originOf()` (`:207`) is guarded on purpose: *"A REPORTING-ONLY CODE PATH MUST NOT BE ABLE TO FAIL THE BUILD."* Keep that property.
- Exit codes are meaningful: **1** = the export is wrong; **2** = the check could not be performed (`:251`, `:271`). Task 3.2 uses 2.
- `FETCH_HOST` (`:108`) admits IPv4 literals, bracketed IPv6 and single-label hosts, because the shipped gate once passed `<script src="https://93.184.216.34/track.js">`. Do not narrow it.
- `HOST` (`:107`) requires a dotted alphabetic TLD and is used **only** by the informational passes. Do not merge the two.

**`app/eslint.config.mjs`** (230 lines). The i18n gate (AD-12, AR-12). Runs as `eslint . --max-warnings 0`, the **first** link of the build chain — `next build` never lints in Next 16. The metadata selector is the last entry in `no-restricted-syntax` (`:155-162`). The file already carries three recorded lessons about selectors that looked complete and were not (`:53-84`, `:90-103`, `:129-144`); Task 6.2 is the fourth of the same family.

### What must not break

- The **9 existing gate tests** (`app/src/lib/assert-no-external-origins.test.ts`) all keep passing, unchanged. They encode: analytics `src`, font-CDN `<link rel="stylesheet">`, CSS `@import`, remote background `url()`, runtime `fetch()`, and three must-not-fire cases (SVG namespace, vendor error-message URL, `out/data` skip).
- The `<a href>` reporting path (`:240`) and the `MENTIONED` path (`:243`) stay reporting-only.
- The `scanned === 0` guard (`:266`) stays exactly as it is.
- 1,406 routes. 0 newly skipped tests. `$0/month`. No contract change, no `schemaVersion` bump.

### Environment notes (learned the hard way on this project)

- **Never round-trip these files through PowerShell `Get-Content`/`Set-Content`.** PS 5.1 mangles accents and em dashes, and both files are dense with both. Use the edit tools.
- **`npm run build` and the full `vitest` run get killed** if run in a blocking foreground call. Run them in the background, or chunk the test run by file.
- **A concurrent session is live.** It holds `_bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/**` and is producing story 3.7. Commit this story's own slices early rather than accumulating them; commit attribution leaked three times across Epics 1–2 (2.11a, 2.14→2.15, 1.14→2.6) and D13 exists because of it.
- If the shared tree is left non-compiling by another session, verify in an **isolated git worktree on a private port** (Story 2.11a's precedent).

### Downstream contracts this story is creating

| Consumer | What it will import / rely on |
|---|---|
| 3.2 | `import { SITE_ORIGIN } from "@/lib/site-origin"` → `metadataBase: new URL(SITE_ORIGIN)` on the root layout. No second origin literal. |
| 3.3 | The gate passing a same-origin `og:image` (Task 5.5), and the lint rule gating `alt` / `siteName` so the card's alt text must come through `t()`. |
| 3.4 | The gate passing self-origin `<loc>` entries in `.xml` without reporting the site's own origin as external (Task 5.6). |

### Validation pass (A5) — performed at story-creation time against `f07116b`

Every mechanism, path and line number cited above was read, not recalled. Confirmed present as described:

- `assert-no-external-origins.mjs`: `ALLOWED` at `:81` (two entries), `<a href>` precedent comment at `:113`, `<link href>` tuple at `:121`, `FETCHING_POSITIONS` loop at `:229`, `scanned === 0` guard at `:266`, `.xml` in `SCANNED_EXTENSIONS` at `:67`.
- `eslint.config.mjs`: metadata selector at `:155-162`, key regex at `:160`, the quoted-key lesson at `:75-84`.
- `assert-schema-version.mjs`: `readGeneratedVersion()` regex-read + loud throw at `:28-37`. The precedent Task 3.1 mirrors is real and shipped.
- `app/src/lib/assert-no-external-origins.test.ts`: 9 cases, `tree()`/`run()` helpers, `SPAWN_TIMEOUT_MS = 20_000`.
- `vitest.config.ts`: `include: ["src/**/*.test.{ts,tsx}"]`, `@` → `./src`. A new `src/lib/site-origin.test.ts` is picked up automatically.
- `tsconfig.json`: `strict`, `allowJs: true`, `moduleResolution: "bundler"`, `paths: { "@/*": ["./src/*"] }`.
- `package.json` build chain: `lint → typecheck → assert:schema-version → next build → copy-data → assert:no-external-origins`.
- **No `SITE_ORIGIN`, no `metadataBase`, and no occurrence of the domain literal exists anywhere under `app/` today.** This story creates the first one.
- The four `generateMetadata` sites and their `siteName: t("app.siteName")` shape — verified, so Task 6.4's "expected: none" is measured, not assumed.
- The `.mjs`-module alternative in D3-1-a was probed empirically (node import ✔, `tsc --noEmit` ✔, bundler unproven) and the probe files were removed; `app/` was left clean.

---

## References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 3` — L1067–1105 standing AC A1–A6; L1105–1138 Story 3.1]
- [Source: `_bmad-output/planning-artifacts/epics.md#NFR-12` — L92, gates must be provably fallible]
- [Source: `_bmad-output/planning-artifacts/epics.md#AR-11` — L108, as clarified by D20]
- [Source: `_bmad-output/planning-artifacts/epics.md#FR-36`, `#NFR-4` — L73, L84]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26.md#F2` — L95–125, the empirical reproduction]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26.md#4.3` — L351–410, prescribed remediation and its two conditions]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26.md#4.4` — L410–430, the `alt`/`siteName` hole]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-11` — L106–110]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-12` — L112–116, i18n enforcement]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-13` — L118–122, one build chain, no env dependencies]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — L4364+, entries filed by the SEO/locale ruling; the two owned by story 3-1]
- [Source: `_bmad-output/implementation-artifacts/epic-2-retro-2026-08-26.md` — action items A1–A6]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — L3358–3410, Epic 3 sequencing and the two file collisions]
- [Source: `app/scripts/assert-no-external-origins.mjs` — the file under change]
- [Source: `app/scripts/assert-schema-version.mjs:28-37` — the regex-read precedent]
- [Source: `app/eslint.config.mjs:155-162` — the selector under change]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5[1m]`), via the `bmad-dev-story` workflow, 2026-08-26.

### Debug Log References

Verification artifacts, all produced in the isolated worktree `C:\Users\ADMINSTRADOR\wt31` (detached at `f07116b`, sparse `app contract data`):

| Log | What it holds |
|---|---|
| `wt31/build.log` | The full `npm run build` chain, `BUILD_EXIT=0`, 1,406/1,406 routes, the gate's final line |
| `wt31/test-mine.log` | Full suite with story 3.1 — 1,320 passed / 0 skipped / 52 files |
| `wt31/test-baseline.log` | Full suite at pristine `f07116b` — 1,306 passed / 0 skipped / 51 files |
| `wt31/npmci.log` | `npm ci --prefer-offline`, 592 packages (the junction workaround that Turbopack rejected) |
| `wt31/test-run.log` | The first, pre-build suite run — the 97 `skipIf(!anyBuilt)` skips and the drift-gate timeout that led to `IO_TIMEOUT_MS` |

The worktree is scratch and is removed at the end of the story; every figure quoted in the notes above comes from a run that finished.

### Ownership Probe (Task 1)

**1.1 — `git status --porcelain` at start of implementation (HEAD = `f07116b`):**

```
 M _bmad-output/implementation-artifacts/sprint-status.yaml
 M _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/.memlog.md
 M _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md
 M _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md
?? _bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md
?? _bmad-output/implementation-artifacts/3-8-match-route-deep-link-plumbing.md
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/.working/key-landing-mobile.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/.working/key-navigation.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/.working/key-players-index-mobile.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/mockups/key-landing-mobile.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/mockups/key-navigation.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/mockups/key-players-index-mobile.html
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/review-accessibility-2026-08-26.md
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/review-i18n-2026-08-26.md
?? _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/review-rubric-2026-08-26.md
```

All of `app/` was clean. The `sprint-status.yaml` modification is this story's own create-story pass (`backlog → ready-for-dev` plus its journal entry), uncommitted. `3-8-…md` is a story file created by the concurrent session.

**1.2 — collision files:** `git status --porcelain app/src/app/page.tsx app/src/components/SiteHeader.tsx` → **empty output.** Both unmodified, as required. Note that story 3.6, which `sprint-status.yaml` still records as `in-progress`/uncommitted, has in fact LANDED on `main` (commits `92eec27`, `f07116b`) — hence the clean `SiteHeader.tsx`. The sprint-status note is stale, not wrong about ownership.

**1.3 — the tree did NOT stay clean.** Mid-implementation (between Task 8.6 and Task 7) the concurrent session began writing story 3.8 into `app/`:

```
 M app/src/components/TournamentHub.tsx
?? app/src/lib/match-anchors.ts
?? app/src/lib/match-anchors.test.ts
?? app/src/lib/use-anchor-nonce.ts
```

**None of these is an owned path of this story**, so Task 1.4's abort condition did not trigger. Two consequences were handled rather than ignored:
- Verified those four files contain **no occurrence of the origin literal** (`grep -c` → 0 each), so they cannot perturb the Task 2.3 drift gate.
- The Task 7 chain was therefore run in an **isolated sparse git worktree at `f07116b`** carrying only this story's five owned files (Story 2.11a's precedent), so that no chain result — test total, route count, lint status — is contaminated by another session's in-flight work.

**1.4 — no owned path was dirty at any point.** `git status --porcelain` over the five owned paths was empty at Task 1 and every subsequent check. Story proceeds.

**1.5 — declared ownership (the only paths this story writes):**

| Path | Mode |
|---|---|
| `app/src/lib/site-origin.ts` | NEW |
| `app/src/lib/site-origin.test.ts` | NEW |
| `app/scripts/assert-no-external-origins.mjs` | MODIFY |
| `app/src/lib/assert-no-external-origins.test.ts` | MODIFY (extended, never shrunk) |
| `app/eslint.config.mjs` | MODIFY |

Plus this story file and `sprint-status.yaml`. Nothing else is staged (Task 9.3).

### Completion Notes List

**Red demonstrations (A1 / NFR-12) — command + failing output required for each.**

Eight were run, not seven: Task 3.3 claims a red proof for *both* halves of the allowance line (the escaping and the boundary), and only the boundary had one in the task list. **8.4b** closes that gap. After every revert the file was restored and `diff` against a pre-demonstration copy confirmed it byte-identical.

**Pre-implementation red (A2) — the six positive cases against the UNMODIFIED script.**
Before any change to `assert-no-external-origins.mjs`, the twelve new cases were run against the shipped gate:

```
npx vitest run src/lib/assert-no-external-origins.test.ts
  Tests  6 failed | 15 passed (21)
```

The six failures were exactly the six positives (5.2, 5.3, 5.3b, 5.4, 5.5, 5.6); all six REJECTS cases and all **9 pre-existing cases passed unchanged**. This is A2 discharged directly: the positives are not coincidence-green.

> **One weak assertion was caught here and fixed rather than kept.** Case 5.6 initially passed *pre-fix*, which would have made Task 8.2's second revert non-discriminating. Cause: `mentions` is sorted lexicographically and `http://www.sitemaps.org` sorts BEFORE the site's origin (`:` < `s`), so an assertion anchored on the MENTIONED line's *prefix* could never fire. Replaced with an unanchored `not.toContain(SITE_ORIGIN)` plus a positive `toContain("www.sitemaps.org")` proving the mention channel is not over-widened. 5.6 then failed pre-fix as intended.

- **8.1 — the negative gate still fires.** `npx vitest run src/lib/assert-no-external-origins.test.ts -t "REJECTS"` → **10 passed**. The gate's own output on case 5.7's fixture, verbatim, is exactly D3-1-e's two-channel shape:

  ```
  assert-no-external-origins: 2 external origin(s) MENTIONED in text (vendor error-message URLs and licences — not fetched): https://cdn.evil.example.com, https://fonts.googleapis.com
  assert-no-external-origins: 1 EXTERNAL SUBRESOURCE(S) in the export — AR-11 requires zero external requests and NFR-9 bans telemetry:
    <link href>  https://fonts.googleapis.com/css2?family=Inter
        index.html
  EXIT=1
  ```

  The stylesheet **fails**; the `og:image` is **reported only** and appears nowhere in the `EXTERNAL SUBRESOURCE(S)` block. Story 3.3's premise holds.

- **8.2 — the `SITE_ORIGIN` allowance is load-bearing.** Deleted only that entry from `ALLOWED`:

  ```
  -t "preload"            × PASSES a self-origin <link rel="preload">…   expected 1 to be +0
  -t "sitemap of self-origin"  × PASSES a sitemap of self-origin <loc>…  expected '…2 externa…' not to contain 'https://mundial-stats.juancr.dev'
  ```

  Both RED. Restored.

- **8.3 — the `rel` exclusion is load-bearing.** Restored the original `<link href>` tuple:

  ```
  -t "OFF-ORIGIN"   × PASSES an OFF-ORIGIN <link rel="alternate">…   expected 1 to be +0
  ```

  RED. **Control run confirming the trap the story warned about:** under this same revert, case 5.2 (the self-origin canonical) stayed **GREEN** — `1 passed`. Reverting one mechanism and re-running 5.2 would have proved nothing, exactly as Task 8.3 predicted. Restored.

- **8.4 — the origin boundary is load-bearing.** Changed the allowance to `^${escapeRegExp(SITE_ORIGIN)}` (no `(?:[/?#]|$)`):

  ```
  -t "PREFIXES"   × REJECTS a look-alike host…   expected +0 to be 1
  ```

  and the gate directly on that fixture:

  ```
  assert-no-external-origins: 1 text asset(s) in out/, 0 external subresources.
  EXIT=0
  ```

  A remote tracking script at `https://mundial-stats.juancr.dev.evil.com/track.js` reported as **zero external subresources**. Restored.

- **8.4b — the escaping is load-bearing (added; Task 3.3 claims a proof for it).** Changed the allowance to `^${SITE_ORIGIN}(?:[/?#]|$)` (unescaped):

  ```
  -t "dots are not dots"   × REJECTS a host whose dots are not dots…   expected +0 to be 1
  assert-no-external-origins: 1 text asset(s) in out/, 0 external subresources.
  EXIT=0
  ```

  `https://mundial-statsXjuancrXdev/track.js` allow-listed, because unescaped `.` is "any character". Restored.

- **8.5 — the regex-read fails loudly, never silently.** Split the declaration across two lines, then `node scripts/assert-no-external-origins.mjs out`:

  ```
  assert-no-external-origins: could not find `export const SITE_ORIGIN = "<origin>";` in C:\...\app\src\lib\site-origin.ts
  EXIT=2
  ```

  Exit **2** (the check could not be performed), not 0, and no fallback origin. Restored.

- **8.6 — the drift gate fires.** Added a second literal in a throwaway `src/lib/__drift-probe.ts`:

  ```
  × SITE_ORIGIN > has EXACTLY ONE occurrence under app/…
    Expected: "src/lib/site-origin.ts (1)"
    Received: "src/lib/__drift-probe.ts (1), src/lib/site-origin.ts (1)"
  ```

  The failure **names the offending file by relative path**, as AC1 requires. Probe deleted; suite back to 2 passed. Not staged, not committed.

- **8.7 — the lint rule fires, both spellings.** A throwaway `src/lib/__lint-probe.ts` carrying `siteName:` / `alt:` (identifier keys) and `"siteName":` / `"alt":` (quoted keys). **Run against the PRE-fix config first: `EXIT=0`, zero errors — the hole, demonstrated open.** After the fix:

  ```
  src/lib/__lint-probe.ts
     3:15  error  Metadata strings must come from the locale layer  no-restricted-syntax
     4:42  error  Metadata strings must come from the locale layer  no-restricted-syntax
    10:5   error  Metadata strings must come from the locale layer  no-restricted-syntax
    10:17  error  Metadata strings must come from the locale layer  no-restricted-syntax
    11:37  error  Metadata strings must come from the locale layer  no-restricted-syntax
    11:44  error  Metadata strings must come from the locale layer  no-restricted-syntax
  ✖ 6 problems (6 errors, 0 warnings)
  ```

  Lines 3–4 are the identifier spelling; 10–11 the quoted spelling (D3-1-f). Probe deleted; `npm run lint` clean afterwards.

**Measured behaviour of the `key.value` arm, recorded for review rather than "fixed".**
A quoted key is itself a `Literal` child of the `Property`, so `{ "siteName": t("app.siteName") }` reports **at the key** (`5:5`) even though its value is a `CallExpression`. Net effect: the quoted spelling is not writable in a metadata object; the identifier spelling — which all four shipped `generateMetadata` sites already use — is. **This is not new behaviour introduced here:** the shipped 2.18 object-prop family behaves identically, verified with a probe (`{ "value": t("x") }` → error at the key, `3:29`). The prescribed selector was kept so the two families stay the same shape rather than becoming two subtly different ones, and the behaviour is now recorded in the config's own comment.

**Chain results (Task 7) — run in an ISOLATED SPARSE WORKTREE, and why.**

Mid-implementation the concurrent session began writing story 3.8 across `app/`: by the time Task 7 was reached it held `TournamentHub.tsx`, `ExpertLayer.tsx`, `TacticalLayer.tsx`, `PitchPanel.tsx`, five `*Section.tsx` files, `expert-logs.ts`, `i18n.test.ts` and three new `src/lib` modules. Running the chain in the shared tree would have measured **their** in-flight work as much as this story's — a test total, a route count or a lint failure attributable to neither session cleanly.

So the chain was run at `git worktree add --detach` on `f07116b`, sparse-checked-out to `app contract data`, carrying **only this story's five owned files** (`git status --porcelain` in the worktree showed exactly those five, nothing else). Story 2.11a's precedent. The five files were confirmed **byte-identical** (`diff`) between the worktree and the main tree afterwards, so what was verified is what is committed.

Two environment notes worth carrying forward:
- The BMad story filenames overflow Windows `MAX_PATH` under the scratchpad prefix — `git worktree add` died with *"Filename too long"* mid-checkout. A short worktree path (`C:\Users\ADMINSTRADOR\wt31`) plus `git sparse-checkout set app contract data` fixes it and is much faster.
- **A `node_modules` junction does not work for `next build`.** Turbopack panics: *"Symlink [project]/node_modules is invalid, it points out of the filesystem root"*. `npm ci --prefer-offline` in the worktree (592 packages, 2m) is the working route.

- **`npm run lint`** — clean, exit 0, under `eslint . --max-warnings 0`. Task 6.4's "expected: none" confirmed by measurement: no existing code newly breaks.
- **`npm run typecheck`** — `tsc --noEmit` clean, exit 0.
- **`npm run test`** — **1,320 passed / 0 failed / 0 skipped** across 52 files, exit 0.
- **`npm run build`** — **green end to end**, `BUILD_EXIT=0`, through all six links:

  ```
  assert-schema-version: 1411 artifact(s) at schemaVersion 4 (generated constant matches contract/version.json)
  ✓ Generating static pages using 10 workers (1406/1406) in 31.0s
  copy-data: copied ...\data -> ...\app\out\data
  assert-no-external-origins: 6 external origin(s) MENTIONED in text (vendor error-message URLs and licences — not fetched): https://bit.ly, https://github.com, https://nextjs.org, https://react.dev, https://redux-toolkit.js.org, https://redux.js.org
  assert-no-external-origins: 12683 text asset(s) in out/, 0 external subresources.
  BUILD_EXIT=0
  ```

- **Route count: 1,406/1,406** — unchanged (AC5). No contract change, no `schemaVersion` bump.
- **Task 7.6 — `scanned` is non-zero: 12,683 text assets.** The gate did not take the `scanned === 0` path; this is a real pass, not a vacuous one. The six MENTIONED origins are the expected vendor diagnostic strings, and **the site's own origin is not among them** — which is the allowance working in the informational channel too (D3-1-c).

**THE STORY'S STATED TEST BASELINE OF 1,251 IS STALE. The measured baseline at `f07116b` is 1,306.**
Rather than assert the story's figure, it was measured: the same worktree, the same `out/`, with this story's five files stashed (`git stash push -u`) and the suite re-run against pristine `f07116b`:

| | Test files | Tests | Skipped |
|---|---|---|---|
| Pristine `f07116b` (measured) | 51 | **1,306** | 0 |
| With story 3.1 | 52 | **1,320** | 0 |
| Delta | +1 | **+14** | 0 |

+14 is exactly what this story adds: **2** in `site-origin.test.ts` and **12** in `assert-no-external-origins.test.ts` (9 existing → 21). AC5 is satisfied on its substance — nothing newly skipped, no regression, route count unchanged — and Task 7.3's "1,251 + added" arithmetic simply started from a figure that predates tests already on `main` (story 3.6's caption assertions among them). **Epic 3's later stories should carry 1,320, not 1,251, as their baseline.**

**One test-quality fix made during Task 7, not papered over.**
The drift gate timed out at vitest's 5 s default in the *full-suite* run while passing in ~0.3 s standalone: it reads ~194 files / ~3 MB, and under ~50 parallel test files (several spawning node processes) that exceeded the default. Given the explicit `IO_TIMEOUT_MS = 20_000` the sibling gate suite already uses for `SPAWN_TIMEOUT_MS`, for the same reason, with the measurement recorded in the comment. The scope of the scan was **not** narrowed to make it fast — narrowing it is what would have weakened AC1.

### File List

Paths relative to repo root. **These five, and nothing else under `app/`.**

| Path | Mode | Change |
|---|---|---|
| `app/src/lib/site-origin.ts` | NEW (32 lines) | The one definition of `SITE_ORIGIN`, with the shape constraints the gate's regex-read depends on |
| `app/src/lib/site-origin.test.ts` | NEW (97 lines) | Origin-shape assertion + the drift gate (exactly one occurrence under `app/`, named by relative path) |
| `app/scripts/assert-no-external-origins.mjs` | MODIFY (+148/−9) | `readSiteOrigin()` regex-read with a loud exit 2; escaped, boundary-anchored `SITE_ORIGIN` entry in `ALLOWED`; `NON_FETCHING_RELS` + `linkHref()` extractor; the `FETCHING_POSITIONS` loop's optional fourth tuple element |
| `app/src/lib/assert-no-external-origins.test.ts` | MODIFY (+244/−0) | 12 cases added (9 → 21). **No existing case deleted or weakened**; all 9 still pass unchanged |
| `app/eslint.config.mjs` | MODIFY (+50/−4) | `alt` and `siteName` added to the metadata key regex, plus the `key.value` arm for the quoted-key spelling, and the recorded rationale |

Non-code files updated by this story:

| Path | Change |
|---|---|
| `_bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md` | `baseline_commit` frontmatter, task checkboxes, Dev Agent Record, File List, Change Log, Status |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | `3-1` → `in-progress` → `review`, plus the journal entry |

**Created and deleted within the story, never committed** (Task 8's throwaways): `app/src/lib/__lint-probe.ts`, `app/src/lib/__lint-probe2.ts`, `app/src/lib/__lint-probe3.tsx`, `app/src/lib/__drift-probe.ts`. Confirmed absent from the tree and from the staged set.

**Explicitly NOT touched**, though the concurrent session made them dirty in the shared tree while this story ran: `TournamentHub.tsx`, `ExpertLayer.tsx`, `TacticalLayer.tsx`, `PitchPanel.tsx`, `ShotMapsSection.tsx`, `PassNetworksSection.tsx`, `OffersToReceiveSection.tsx`, `MovementToReceiveSection.tsx`, `DefensiveActionsSection.tsx`, `HeaderSearch.test.tsx`, `SiteSignature.test.tsx`, `TournamentHub.test.tsx`, `bootstrap.ts`, `bootstrap.test.ts`, `expert-logs.ts`, `i18n-provider.tsx`, `i18n.test.ts`, `match-anchors.ts`, `match-anchors.test.ts`, `use-anchor-nonce.ts`. None is staged (Task 9.3).

---

## Change Log

| Date | Change |
|---|---|
| 2026-08-26 | Story implemented. `SITE_ORIGIN` created as the single definition (AC1) with a mechanical drift gate; the origin gate taught the site's own origin (escaped, boundary-anchored, scheme-exact) and taught that `rel="canonical"`/`rel="alternate"` are navigation hints under a deny-by-default `rel` policy (AC2); `og:image` deliberately left out of `FETCHING_POSITIONS` per D20-b, with a test pinning that it stays out (AC3); `alt` and `siteName` added to the i18n metadata selector along with the quoted-key arm (AC4). 12 gate cases added (9 → 21), 2 drift cases added; **eight** red demonstrations recorded, one more than the seven required. Full chain green in an isolated worktree: lint, typecheck, 1,320 tests / 0 skipped, build `BUILD_EXIT=0`, 1,406/1,406 routes, gate scanned 12,683 assets (AC5). Measured and corrected a stale baseline: `f07116b` carries **1,306** tests, not 1,251. |

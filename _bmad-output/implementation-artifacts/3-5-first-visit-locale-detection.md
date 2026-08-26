---
baseline_commit: 9f76f40
---

# Story 3.5: First-Visit Locale Detection

Status: done

> `review` -> `in-progress` -> **`done`** (2026-08-26). The code review applied 11 patches, three of
> them to PRODUCTION files, so the story was held at `in-progress` until the full chain was re-run.
> It could not be re-run in the shared tree — story 3.10 had `HeaderSearch.tsx`, `SiteHeader.tsx`,
> both dictionaries and new `SiteNav`/`nav-destinations` files in flight there, and its dictionary
> rename left `HeaderSearch.test.tsx` failing 8 tests and `tsc` erroring on `search.open`. Both were
> confirmed to be 3.10's by reverting all five of this review's files to HEAD and reproducing them
> identically.
>
> **Verified instead in an isolated worktree at the committed HEAD `2ce2233`** — this story's code
> with none of 3.10's in-flight work (Story 2.11a's precedent, and the method the story's own
> blast-radius measurement used). Full chain, all green:
>
> | gate | result |
> |---|---|
> | `npm run build` | GREEN end to end — lint, typecheck, schema assert, `next build`, `copy-data`, origin gate |
> | origin gate | `12,683 text assets, 0 external subresources` — identical to the implementation run |
> | `npm test` | **55 files / 1,382 passed / 0 failed / 0 skipped** |
>
> **0 skipped** is the number Task 10.3 asks for, and it required the build first: in a fresh
> worktree `app/out` does not exist, so the `describe.skipIf(!anyBuilt)` export blocks skip 97 tests.
> The first worktree run measured 53 files / 1,285 passed / **97 skipped**; after `npm run build` the
> same suite measured 55 / 1,382 / **0 skipped**. Both states are recorded because the story's Task
> 1.5 note says to state which one you measured in.
>
> Delta against the implementation run's 55 files / 1,367 tests: **+15**, fully accounted for —
> **+13 from this review** (`bootstrap.test.ts` 17 -> 21, `i18n-provider.test.tsx` 19 -> 28) and **+2
> from story 3.6's own code review**, which committed to `main` in between (`SiteSignature.test.tsx`
> 5 -> 6, `static-output.test.ts` +1).
>
> **Windows note for the next session:** the worktree needed a SHORT path (`C:\wt35`) — a worktree
> under the deep scratch path fails `git worktree add` with *Filename too long* — and junctioning
> `app/node_modules` is NOT enough: Turbopack fails the build with *Symlink [project]/node_modules is
> invalid, it points out of the filesystem root*. `npx vitest run` tolerates the junction; `npm run
> build` does not. A real `robocopy /E /MT:16` of `node_modules` (0.49 GB, ~27 s) is what makes the
> build work, and is far cheaper than `npm ci`, which dies on Windows `ENOTEMPTY`.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

**Epic 3, story 5 of 10.** Spec: `_bmad-output/planning-artifacts/epics.md:1222-1254`.
Baseline: commit `9f76f40` on `main`. `9f76f40` and `f07116b` are **documentation-only** commits —
no file under `app/` has changed since `92eec27`, so every line reference in this story was read
against the tree you will edit.

**This story is independent of 3-1 through 3-4.** It touches no metadata, no build gate, no export
surface. It can land before, after or between them.

**It is also the highest user value in the epic.** The share-preview work makes a link look like a
product; this story makes the page *behind* the link readable. Today `resolveLocale(stored)`
(`app/src/lib/bootstrap.ts:37`) is persisted-value-or-`es`, so **every first-time visitor on Earth
is served Spanish** — including the English speaker who just clicked the link 3-3 made pretty.

---

## Story

As an English-speaking visitor who just clicked a shared link,
I want the site to open in English without my having to find a toggle,
So that the page behind the preview is readable to me (FR-37).

---

## Acceptance Criteria

Reproduced **verbatim** from `epics.md:1226-1254`, each followed by the binding notes the
story-creation probe forced. Epic 3's standing criteria **A1–A6** (`epics.md:1071-1105`) apply in
addition — A1, A2, A3 and A4 all have teeth here and are wired into the tasks below.

**AC 1 — the primary subtag, and nothing else.**

**Given** `app/src/lib/bootstrap.ts:37`, where `resolveLocale(stored)` returns `"es"` for anything not already persisted — so **every first-time visitor on Earth is served Spanish**
**When** detection is added
**Then** `resolveLocale(stored, preferred)` reads only the **primary subtag**: `en-GB`, `en-US` and `en` all resolve to `en`; anything else, including French, falls to the canonical `es` — this is a two-locale product, and a non-Spanish non-English reader gets the canonical, not a guess.

**AC 2 — both call sites, in the same edit.**

**Given** the change must land in **both** call sites or they disagree
**When** the pure function is updated
**Then** the checked-in `bootstrapScript` ES5 literal (`:56`) is updated in the same edit, and `bootstrap.test.ts`'s existing cross-check of the literal against the functions (`:144`) gains a `navigator.language` dimension across the full input matrix. That test is what stops the two drifting.

**AC 3 — the provider falls through.**

**Given** `src/lib/i18n-provider.tsx:39` currently does `if (stored === null) { return; }`
**When** the provider's mount effect is updated
**Then** it falls through to the same `resolveLocale(null, navigator.language)` — without this, React re-renders Spanish strings under an `<html lang="en">` the pre-paint script has already set.

**AC 4 — a guess is not a choice.**

**Given** a detected locale is a guess, not a choice
**When** detection resolves
**Then** `wcstats.locale` is **NOT written**. Only an explicit toggle persists. Persisting a guess would make it indistinguishable from a choice and would silently outlive a change of browser language.
**And** detection is **not an announcement**: the polite live region stays silent, extending the provider's existing rule that restoring a preference is not a user action.

**AC 5 — the end-to-end case, in a real browser.**

**Given** a browser with `navigator.language = "en-US"` and empty `localStorage`
**When** it loads any route
**Then** the page renders in **English**, and `wcstats.locale` is **still unset** afterwards.

**AC 6 — the crawler consequence is accepted, not fixed.**

**Given** the accepted consequence recorded in D20 §3.3
**When** Googlebot renders with `navigator.language = en-US`
**Then** the mixed-language rendered document (English body, Spanish `<title>`/OG) is **accepted, not treated as a defect**: it is already the shipped behaviour under a manual toggle, the non-rendered fetch and the new `<link rel="canonical">` both declare `es`, and if it causes harm that harm **is** D20-b re-open trigger (b).

> **AC 6 is a no-op instruction: implement nothing for it.** It is here so that a reviewer who
> notices the mixed-language render does not file it as a bug or "fix" it by teaching the script to
> rewrite `<title>`. Do not touch metadata. Record in the completion notes that it was read and
> accepted.

---

## READ THIS FIRST — the one thing that will surprise you

**A minimal, correct implementation of this story turns 25 currently-green tests RED across 4
files.** This was not guessed. It was **measured at story creation** by applying the change in an
isolated git worktree at `f07116b` and running the full suite:

```
 ❯ src/lib/bootstrap.test.ts               (10 tests |  2 failed)
 ❯ src/components/SiteSignature.test.tsx    (5 tests |  2 failed)
 ❯ src/components/TournamentHub.test.tsx    (5 tests |  3 failed)
 ❯ src/components/HeaderSearch.test.tsx    (34 tests | 18 failed)
      Tests  25 failed | 1184 passed
```

**Why.** The three component files are jsdom render tests that mount `<LocaleProvider>` with an
**empty `localStorage`**. **jsdom's default `navigator.language` is `"en-US"`** (measured — see
D9). They pass today only because the provider ignores `navigator` entirely. The moment AC 3 lands,
their locale is decided by an ambient jsdom default instead of by the test — which is precisely the
**A2 coincidence-green** class, arriving from the other direction.

**The remedy is proven, not proposed.** Pinning `navigator.language` per file took the same suite
from **25 failures to 0** in the same worktree. Task 7 carries the exact edits.

**Do not "fix" this by weakening detection.** Not with an `initialLocale`-wins branch, not with a
detection opt-out prop, not by skipping the effect when `initialLocale !== DEFAULT_LOCALE`. The
tests are what is stale, not the feature.

---

## Ruled Decisions — measured at story creation, not re-derivable cheaply

### D1 — the ES5 literal MUST read `window.navigator`, never bare `navigator`

`bootstrap.test.ts:54` evaluates the script as `new Function("window", "document", bootstrapScript)`
and passes stubs. `vitest.config.ts` sets `environment: "node"`.

**MEASURED:** `node -e "console.log(process.version, globalThis.navigator.language)"` →
`v24.15.0 es-CO`. Node 24 exposes a **real global `navigator`** with a real `language`.

A bare `navigator.language` inside the literal would therefore reach past the stub to the host
machine's actual locale. On this machine every matrix case would resolve `es` and the suite would be
**green for the wrong reason**; on a machine set to English the same test would be green for a
different wrong reason. This is the exact A2 failure the standing criteria name.

`window.navigator` resolves to the injected stub in the test and to the real navigator in the
browser. **Use it.**

### D2 — the second parameter is REQUIRED, not optional

```ts
export function resolveLocale(stored: string | null, preferred: string | null): Locale
```

A defaulted or optional `preferred` would let `i18n-provider.tsx:42`'s existing one-argument call
compile unchanged and go on serving Spanish forever — the defect this story exists to fix, surviving
the fix. Making it required turns `npm run typecheck` into the gate that forces AC 3.

**There are exactly two production call sites** (verified by
`grep -rn "resolveLocale" app/src app/scripts`): `bootstrap.ts` itself and `i18n-provider.tsx:42`.
The typecheck error you will see at Task 2.3 is not a problem to route around — it *is* D2 working.

### D3 — the guard is a truthy check, not `=== null`

```ts
const primary = preferred ? preferred.toLowerCase().split("-")[0] : null;
```

`sprint-change-proposal-2026-08-26.md:465` sketches `preferred === null ? null : …`. **Departure,
with a measured reason:** in the trial run, a legacy one-argument call reached the strict form with
`preferred === undefined`, took the false branch, and threw `TypeError: preferred.toLowerCase is not
a function`. A crash is a worse failure mode than a wrong locale, and the ES5 side reads whatever
`navigator` hands it across an untyped boundary. The truthy guard folds `null`, `undefined` and `""`
into one path in **both** implementations, which is the property the AC 2 cross-check exists to
protect.

### D4 — the algorithm is lowercase, split on `-`, take `[0]`. Nothing else.

No `Intl.Locale`, no `navigator.languages[]`, no region or script handling, no `_` separator, no
`startsWith("en")` (that would match `enm`). The two implementations must express the **same**
algorithm in the same shape, because a reader diffing them by eye is the second line of defence
after the matrix test.

### D5 — the two navigator reads are ALLOWED to differ; do not unify them

The script literal cannot import anything — that is the whole reason it is a checked-in ES5 string
(`bootstrap.ts:9-13`). A shared reader helper would have exactly one caller and would still leave
the literal with its own copy. The script gets a `language()` reader with a `try/catch`, exactly as
it already has `read()` for storage; the provider passes `window.navigator.language` directly, as it
already uses `readStorage()` rather than the script's `read()`. **This asymmetry is pre-existing and
deliberate.** Do not refactor it.

### D6 — the provider's DOM re-assertion stays unconditional

After the early return is removed, the effect will run `setLocaleState(next)` and re-assert
`root.lang` / the locale class even when `next === "es"` and nothing changed. That is correct and
must be preserved:

- React bails out of a `setState` to an identical value; there is no extra render.
- The DOM re-assertion is load-bearing for the case `i18n-provider.tsx:45-47` documents — the
  pre-paint script did **not** run (a future CSP), so `<html lang>` must be corrected by React.

**Do not add `if (next === locale) return;`.** It would silently re-open that hole.

### D7 — nothing in the effect writes storage or announces

`writeStorage` appears exactly once in the provider, inside `setLocale` (`:56`). `setAnnouncement`
appears exactly once outside its declaration, also inside `setLocale` (`:63`). **The effect gains
neither.** AC 4 is satisfied by *not writing code*, which means the only thing that can prove it is
a test — see Task 6.

### D8 — AC 3 and AC 5 are proved by a jsdom render test, and the harness already exists

The repo has `jsdom ^30.0.1`, `@testing-library/react ^16.3.2` and `@testing-library/user-event
^14.6.3` in `devDependencies`, and **six files already opt in per-file** with
`// @vitest-environment jsdom` (`HeaderSearch`, `SiteSignature`, `TournamentHub`, `RowAnchor`,
`use-in-view`, `use-url-query`). The global `environment` stays `"node"`.

**Probed at story creation against the CURRENT, unfixed code** — all four cases ran green, i.e. the
harness works and the defect is reproducible as an assertion today:

| probe | result |
|---|---|
| `render(<LocaleProvider><Probe/></LocaleProvider>)`, empty storage, jsdom default `en-US` | renders **`es`** — the defect, catchable |
| same, with `wcstats.locale = "en"` stored | renders `en`, `document.documentElement.lang === "en"` — the control |
| `vi.spyOn(window.navigator, "language", "get").mockReturnValue("fr-FR")` | works; `vi.restoreAllMocks()` restores to `en-US` |
| `Object.defineProperty(window.navigator, "language", { value: "en-GB", configurable: true })` | works; `delete` restores |

`render()` from RTL wraps in `act`, so the mount effect has already flushed when `render` returns —
**no `waitFor` is needed** for these assertions.

### D9 — jsdom's default `navigator.language` is `"en-US"`. Pin it in every case.

**MEASURED:** a fresh `new JSDOM(...)` reports `navigator.language === "en-US"`,
`navigator.languages === ["en-US","en"]`, and `language` is a `configurable: true` accessor (get and
set) on `Navigator.prototype` — which is why both stubbing techniques above work.

Consequence: an "English is detected" test that forgets to stub **passes without asserting
anything** — the ambient default happens to be English. Under A2 that is not a test. **Every case in
every file this story touches states the tag it assumes.**

### D10 — where the new render test lives, and the four harness facts it owes its reader

`app/src/lib/i18n-provider.test.tsx` — a NEW file, beside the module it tests.

1. **`// @vitest-environment jsdom` on line 1**, before the imports. The global environment stays
   `node`; flipping it would change `storage.test.ts`'s `vi.unstubAllGlobals()` restore target
   (`HeaderSearch.test.tsx:33-40` documents this).
2. **RTL auto-cleanup does NOT run.** `vitest.config.ts` has no `globals: true`, so
   `@testing-library/react` never registers its `afterEach(cleanup)`. Call `cleanup()` explicitly or
   the DOM leaks forward and the symptom reads as "found multiple elements".
3. **This file is linted like any other `src/**/*.tsx`.** `react/jsx-no-literals` with
   `noStrings: true` is on (`eslint.config.mjs:27`) and `--max-warnings 0` is link 1 of the build
   chain. **Bare JSX text is an ESLint error.** Render `{locale}` as an expression. Attribute
   literals are fine (`ignoreProps: true`), so `data-testid="…"` is legal.
4. **jsdom state is per-file, not per-test.** `document.documentElement.lang`, its class list and
   `window.localStorage` all survive into the next test. Reset all three in `afterEach`.

Do **not** put this file under `src/components/**` — that directory bans a direct `t` import
(`eslint.config.mjs:183-193`).

### D11 — the three RED runs A1 requires

A1 is not satisfied by "the new tests pass". Each guard is driven red once, deliberately, and the
failing output is pasted into the completion notes:

| # | break this | expect red in |
|---|---|---|
| **R1** | update the pure function, **leave the ES5 literal unchanged** | `bootstrap.test.ts` matrix — this is AC 2's whole point and the single most valuable red in the story |
| **R2** | revert detection in **both** (back to persisted-or-`es`) | the new `bootstrap.test.ts` `navigator` cases |
| **R3** | restore `if (stored === null) { return; }` in the provider | `i18n-provider.test.tsx` |

R1 is the one that matters most. The epic names literal/function drift as risk #1, and the matrix
test is the only mechanism that catches it. If R1 does **not** go red, the matrix dimension was
added wrong — fix the test, not the expectation.

### D12 — AC 5 says "a browser". Use one. The method is validated and the obvious API does not work.

`Emulation.setLocaleOverride` **returns `ok` and does nothing** to `navigator.language` — measured:
Chrome reported `es-419` before and after the call. It changes the ICU/`Intl` default, not the
navigator. A verification built on it would report success while testing nothing.

**Two methods that DO work, both measured:**

| method | result |
|---|---|
| launch flag `--lang=en-US` | `navigator.language === "en-US"` from first paint — **simplest, use this** |
| `Network.enable` then `Network.setUserAgentOverride({ userAgent, acceptLanguage: "en-US" })` | `navigator.language === "en-US"`, `languages === ["en-US"]`, applies to subsequent navigations |

The rest of the harness is Story 2.19's, unchanged and dependency-free (Node 24's global
`WebSocket`, no puppeteer): Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`,
`--headless=new --remote-debugging-port=<private> --disable-gpu --user-data-dir=<scratch>`, discover
the `type:"page"` target at `GET /json/list`, drive it over its `webSocketDebuggerUrl`.

- **A fresh `--user-data-dir` per launch is how you get an empty `localStorage`** — which is exactly
  the first-visit condition AC 5 names. Do not reuse a profile between cases.
- **Serve `app/out` over HTTP on a private port** (`python -m http.server 8137` from `app/out`), not
  `file://` — the client `fetch` of `/data/...` needs a real origin. Another session may hold the
  default port.
- **The harness script goes in a scratch directory, never `app/scripts/`** — that directory is
  production and is on story 3-1's owned-paths list.

---

## What already exists — reuse it, do not rebuild it

| thing | where | use it for |
|---|---|---|
| `resolveLocale` | `bootstrap.ts:36-42` | the one algorithm; **both** call sites read it |
| `bootstrapScript` ES5 literal | `bootstrap.ts:56-91` | the pre-paint copy; `read()` at `:72-78` is the try/catch pattern `language()` should mirror |
| `runBootstrapScript` harness | `bootstrap.test.ts:21-56` | add `navigator` to `windowStub`; do not write a second harness |
| the cross-check matrix | `bootstrap.test.ts:125-152` | add the dimension **inside** this loop; do not add a parallel loop |
| `localeClass` | `bootstrap.ts:47-49` | the `locale-es` / `locale-en` class, in tests too |
| `STORAGE_KEYS.locale` = `"wcstats.locale"` | `storage.ts:9` | never hardcode the string |
| `readStorage` / `writeStorage` | `storage.ts:23-38` | the provider's storage seam; the effect **reads** only |
| jsdom test shape | `SiteSignature.test.tsx:1-12` | the cleanest, newest example of the pragma + imports + explicit `cleanup()` |
| CDP harness recipe | `2-19-…md:291-345` | AC 5's browser run |

**Not to be touched by this story:** `layout.tsx` (the `<script>` tag and `<html lang="es">` server
markup are correct as they are), `theme-provider.tsx` (theme already resolves through
`prefers-color-scheme`; it is the symmetric case, already solved), `i18n.ts`, either dictionary
(**this story adds no locale keys**), and every metadata site.

---

## Tasks / Subtasks

### Task 1 — A3 file-ownership probe (BLOCKING; all AC)

- [x] 1.1 `git status --porcelain`. Record the output verbatim in the Debug Log.
- [x] 1.2 Confirm **every one of these seven paths is clean**:
      ```
      app/src/lib/bootstrap.ts
      app/src/lib/bootstrap.test.ts
      app/src/lib/i18n-provider.tsx
      app/src/lib/i18n-provider.test.tsx          (must not exist yet)
      app/src/components/SiteSignature.test.tsx
      app/src/components/TournamentHub.test.tsx
      app/src/components/HeaderSearch.test.tsx
      ```
      **If any is dirty, ABORT at this task and say so** (A3, Story 2.18's precedent). Do not
      proceed and "merge later".
- [x] 1.3 Check the two known Epic 3 collision files, `app/src/app/page.tsx` and
      `app/src/components/SiteHeader.tsx`. **This story touches neither** — record that as a fact,
      not as an assumption.
- [x] 1.4 Record what you must NOT stage. At story creation the live sessions were:
      | session | holds |
      |---|---|
      | `bmad-ux` | `_bmad-output/planning-artifacts/ux-designs/**` (modified + untracked) |
      | story 3-1 (in-progress) | `app/src/lib/site-origin.ts`, `site-origin.test.ts` (both untracked), `app/scripts/assert-no-external-origins.mjs`, `src/lib/assert-no-external-origins.test.ts`, `app/eslint.config.mjs` |
      | story 3-8 (**in-progress as of 13:50**) | `TacticalLayer.tsx`, `PitchPanel.tsx`, `TournamentHub.tsx`, five section components, `match-anchors.ts`, `use-anchor-nonce.ts`, `expert-logs.ts`, `i18n.test.ts`, `MatchDeepLink.test.tsx` |
      | story 3-6 (in-progress, code already committed at `92eec27`) | `SiteHeader.tsx`, `AttributionFooter.tsx`, `es.ts`, `en.ts`, `i18n.test.ts`, `src/app/static-output.test.ts` |
      **`TournamentHub.test.tsx` is NOT on story 3-8's staging list** (`3-8-…md:552-568`) and 3-8
      states its Hub tests "pass unchanged" — so this story may own it. **But 3-8 flipped to
      `in-progress` during this story's creation and edits `TournamentHub.tsx` next door.** Re-verify
      at 1.2, and if 3-8 has taken the test file, abort the Task 7.1 slice rather than the whole
      story: Tasks 2–6 and 8–9 own nothing 3-8 touches. Say so explicitly and file the repair.
- [x] 1.5 Baseline the suite: `cd app && npm test`. **Measure it; do not trust a number.**
      At creation, `f07116b` measured **1,306 passed / 51 files / 0 skipped** (twice). Story 3-1's
      two untracked files are now in the tree and will add their own tests to whatever you measure.
      - **Known flake, not a regression:** `assert-schema-version.test.ts > passes on the current
        data tree` intermittently fails as a spawn timeout under load — the file documents this
        itself at `:36-53` ("roughly one full-suite run in four"). It failed once and passed once
        during story creation. If it is your only red, re-run that file alone before doing anything
        else.
      - `0 skipped` depends on `app/out` existing; without a prior build, the exported-HTML
        `describe.skipIf(!anyBuilt)` blocks skip (97 tests in a fresh worktree). Note which state
        you measured in.

### Task 2 — the pure function (AC 1; D2, D3, D4)

- [x] 2.1 Rewrite `resolveLocale` in `app/src/lib/bootstrap.ts:36-42`:
      ```ts
      export function resolveLocale(stored: string | null, preferred: string | null): Locale {
        if (stored === "es" || stored === "en") {
          return stored;
        }
        const primary = preferred ? preferred.toLowerCase().split("-")[0] : null;
        if (primary === "en") {
          return "en";
        }
        return "es";
      }
      ```
- [x] 2.2 Replace the one-line JSDoc with one that states the precedence and the two-locale
      rationale — persisted override → `navigator.language` primary subtag → canonical `es`; a
      non-Spanish non-English reader gets the canonical, not a guess (D20, FR-37).
- [x] 2.3 `npm run typecheck`. **Expect exactly one error, at `i18n-provider.tsx:42`.** Paste it into
      the Debug Log — it is D2's gate firing, and it is the evidence that AC 3 cannot be skipped.
      Do not fix it yet.

### Task 3 — the ES5 literal, in the SAME edit (AC 2; D1, D3, D4, D5)

- [x] 3.1 Add a `language()` reader to the literal, mirroring `read()`'s try/catch shape and reading
      **`window.navigator`** (D1):
      ```js
      var language = function () {
        try {
          return window.navigator.language || null;
        } catch (error) {
          return null;
        }
      };
      ```
- [x] 3.2 Update the literal's `resolveLocale` to take `(stored, preferred)` with the **same**
      truthy guard and the same `toLowerCase().split("-")[0]` — character-for-character the same
      algorithm as Task 2.1.
- [x] 3.3 Update the call at `:85` to `resolveLocale(read(…), language())`.
- [x] 3.4 Re-read the file's header comment (`:4-17`). It describes the *mechanism* (why the literal
      is checked in, what the cross-check test does) and stays true — but confirm that sentence by
      sentence rather than assuming it. Fix anything that has become false.
- [x] 3.5 The `<html>` write at `:88-90` is unchanged: `root.lang = locale` already carries whatever
      `resolveLocale` returned.

### Task 4 — `bootstrap.test.ts`: the matrix gains a dimension (AC 1, AC 2; A1, A2)

- [x] 4.1 Extend `BootstrapWorld` with a language dimension and wire it into `windowStub`
      (`:38-53`). It must express **three** distinct worlds, not two:
      | world | stub |
      |---|---|
      | a browser reporting a tag | `navigator: { language: "en-US" }` |
      | a browser reporting nothing usable | `navigator: { language: "" }` |
      | **no navigator at all** | omit the key — proves `language()`'s try/catch. **CORRECTED at code review 2026-08-26: this world does NOT catch a D1 violation.** A bare `navigator` read reaches Node's real global and returns the host locale, which on a Spanish machine resolves `es` — exactly what this world expects, so it stays green under the violation. What catches D1 is the matrix's `languages` axis spanning both English and non-English tags: the host's one fixed locale must disagree with at least one row whatever it is. |
- [x] 4.2 Rewrite the `describe("resolveLocale (persisted → es)")` block (`:76-87`) to cover the
      function directly, two arguments everywhere:
      - `en`, `en-GB`, `en-US`, `EN-US`, `en-us` → `"en"`
      - `es`, `es-CO`, `es-419`, `fr`, `fr-FR`, `de-DE`, `pt-BR`, `""`, `null`, `"garbage"` → `"es"`
      - **stored beats preferred in both directions**: `resolveLocale("es", "en-US") === "es"` and
        `resolveLocale("en", "es-CO") === "en"`
      - **invalid stored falls through to detection**: `resolveLocale("fr", "en-GB") === "en"`
      - rename the describe — "persisted → es" is no longer what it does.
- [x] 4.3 Add the dimension to the cross-check matrix (`:125-152`) **inside the existing loop**, not
      beside it. Suggested axis: `[undefined /* no navigator */, "en-US", "es-CO", "fr-FR", ""]`,
      giving 4 × 4 × 3 × 5 = 240 combinations. Compute the expectation with the same
      `resolveLocale(locale ?? null, …)` call the assertion compares against — that is what makes
      this a *drift* test rather than a second implementation.
- [x] 4.4 Fix `"first-time visitor: Spanish, theme from prefers-color-scheme"` (`:101-110`). It
      currently asserts `es` with no navigator stub at all; under the new script that is still `es`
      (no navigator → null → canonical), so **keep it and pin the assumption explicitly**, then add
      its sibling: same empty storage, `navigator.language = "en-US"` → `lang === "en"` and
      `locale-en` on `<html>`.
- [x] 4.5 `"storage and matchMedia throwing still yields the es/dark canonical"` (`:112-117`) — add a
      case where **`window.navigator` itself throws** on access, proving `language()`'s catch.
- [x] 4.6 `npx vitest run src/lib/bootstrap.test.ts` — green.

### Task 5 — the provider (AC 3, AC 4; D6, D7)

- [x] 5.1 In `app/src/lib/i18n-provider.tsx:38-42`, delete the early return and pass the tag:
      ```ts
      const stored = readStorage(STORAGE_KEYS.locale);
      const next = resolveLocale(stored, window.navigator.language);
      ```
- [x] 5.2 Rewrite the effect's comment (`:33-37`). Its last sentence — *"Nothing stored means nothing
      to restore — initialLocale stands"* — becomes **false** with this change and must not be left
      to mislead the next reader. State the new rule: stored choice → detected guess → `initialLocale`,
      and that a detected locale is deliberately neither persisted nor announced.
- [x] 5.3 Confirm by reading, and record it: the effect contains **no** `writeStorage` and **no**
      `setAnnouncement`. `writeStorage` and `setAnnouncement` each still appear exactly once in the
      file, both inside `setLocale`.
- [x] 5.4 Do **not** add a `next === locale` early return (D6).
- [x] 5.5 `npm run typecheck` — the Task 2.3 error is now gone, and there is no other.

### Task 6 — `i18n-provider.test.tsx`, the new file (AC 3, AC 4, AC 5; A1, A2, D8, D9, D10)

- [x] 6.1 Create `app/src/lib/i18n-provider.test.tsx` with the D10 harness: the pragma, explicit
      `cleanup()`, `vi.restoreAllMocks()`, `window.localStorage.clear()`, and a reset of
      `document.documentElement.lang` + its locale classes in `afterEach`.
- [x] 6.2 A tiny probe consumer — `const { locale } = useLocale()` rendered as
      `<span data-testid="locale">{locale}</span>`. **No bare JSX text** (D10 fact 3).
- [x] 6.3 Cases. **Every one pins `navigator.language` explicitly, including the English ones**
      (D9) — the point is that the file states its own inputs, not that jsdom happens to agree:
      | stored | `navigator.language` | expect locale | expect `wcstats.locale` |
      |---|---|---|---|
      | *(absent)* | `en-US` | `en` | `null` |
      | *(absent)* | `en-GB` | `en` | `null` |
      | *(absent)* | `en` | `en` | `null` |
      | *(absent)* | `fr-FR` | `es` | `null` |
      | *(absent)* | `es-CO` | `es` | `null` |
      | `"es"` | `en-US` | `es` | `"es"` (unchanged — a choice beats a guess) |
      | `"en"` | `es-CO` | `en` | `"en"` (unchanged) |
      | `"fr"` (garbage) | `en-GB` | `en` | `"fr"` (**unchanged** — detection does not repair storage) |
- [x] 6.4 For the first-visit English case also assert the DOM the script would have set:
      `document.documentElement.lang === "en"` and `classList.contains(localeClass("en"))`, with
      `localeClass("es")` absent. This is AC 3's actual failure mode — Spanish strings under
      `lang="en"` — asserted from both sides.
- [x] 6.5 **AC 4, the silence.** In every detection case assert the polite live region is empty. Query
      it structurally (`container.querySelector('[aria-live="polite"]')`) and assert
      `textContent === ""`. A test that does not look cannot prove silence.
- [x] 6.6 **The control that keeps 6.5 honest** (A2): a probe with a `data-testid`'d button calling
      `setLocale("en")`; after a click, the live region **is** non-empty and
      `localStorage.getItem(STORAGE_KEYS.locale) === "en"`. Without this pair, 6.5 would also pass
      against a provider whose live region never works at all.
- [x] 6.7 `npx vitest run src/lib/i18n-provider.test.tsx` — green.

### Task 7 — repair the three render suites detection breaks (regression; A2)

Measured blast radius and proven remedy — see READ THIS FIRST. Each file gets a one-line rationale
comment naming this story, so the next reader knows why an ambient default became explicit.

- [x] 7.1 `app/src/components/TournamentHub.test.tsx` (3 failures). Add `beforeEach` + `vi` to the
      vitest import, pin `vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-CO")` in
      a new `beforeEach`, and add `vi.restoreAllMocks()` to the existing `afterEach` (`:55-58`).
      Whole file is Spanish; one pin covers it.
- [x] 7.2 `app/src/components/HeaderSearch.test.tsx` (18 failures). Same pin inside the existing
      `beforeEach` (`:195-199`); add `vi.restoreAllMocks()` to the existing `afterEach` (`:201-206`),
      **keeping `vi.unstubAllGlobals()`** — they restore different things. Then the one English test,
      *"follows a mid-session locale toggle"* (the `<LocaleProvider initialLocale="en">` render at
      `:558`), re-pins to `"en-GB"` in its own body, before `render`.
- [x] 7.3 `app/src/components/SiteSignature.test.tsx` (2 failures). Its cases are generated from a
      `DICTIONARIES` loop (`:62-73`), so the pin must be per-locale. Add a small helper beside the
      `Wrapper` and call it as the first line of each `it` (all five, including the fixed-`es` one at
      `:134`):
      ```ts
      /** Story 3.5 — the provider detects from navigator.language; pin what this file assumes. */
      function pinLanguage(locale: "es" | "en"): void {
        vi.spyOn(window.navigator, "language", "get").mockReturnValue(locale === "en" ? "en-GB" : "es-CO");
      }
      ```
      plus `vi.restoreAllMocks()` in the existing `afterEach` (`:67-70`).
- [x] 7.4 `npx vitest run src/components/TournamentHub.test.tsx src/components/HeaderSearch.test.tsx src/components/SiteSignature.test.tsx` — **44 passed, 0 failed.** That exact result was reached in
      the trial worktree; if you see anything else, you have a different problem, not a flaky one.
- [x] 7.5 Grep for any *other* renderer of `LocaleProvider` before believing the list is closed:
      `grep -rln "LocaleProvider" app/src`. At creation it returned exactly six files — `layout.tsx`,
      `i18n-provider.tsx`, `theme-provider.tsx` and the three test files above.

### Task 8 — A1: drive all three guards RED (D11)

For each: break it, run the named command, **paste the failing output into the completion notes**,
restore, re-run green. A gate that has never been red is not a gate.

- [x] 8.1 **R1 — the drift red (most important).** Revert only the ES5 literal to the persisted-or-`es`
      form, leaving the pure function updated. `npx vitest run src/lib/bootstrap.test.ts` must fail in
      the **matrix** test. Record which combination it names.
- [x] 8.2 **R2 — the detection red.** Revert detection in both. The Task 4.2/4.4 cases must fail.
- [x] 8.3 **R3 — the provider red.** Restore `if (stored === null) { return; }`.
      `npx vitest run src/lib/i18n-provider.test.tsx` must fail on the first-visit English case.
- [x] 8.4 Confirm every file is back to its intended state (`git diff` reviewed line by line) before
      moving on. A forgotten revert here ships the bug with a green suite.

### Task 9 — AC 5 in a real browser (D12)

- [x] 9.1 `cd app && npm run build`. The full chain: lint → typecheck → schema assert → `next build`
      → `copy-data` → origin gate. **Expect green.** This story adds no absolute URL, so story 3-1's
      gate blocker is not in your path. If `assert-no-external-origins` fails, check whether story
      3-1's in-flight edits are in your tree before treating it as yours.
- [x] 9.2 Serve `app/out` on a private port (`python -m http.server 8137`).
- [x] 9.3 Stand up the CDP harness in a scratch directory (never `app/scripts/`). Four launches,
      **a fresh `--user-data-dir` each time** so `localStorage` starts empty:
      | # | launch | expect |
      |---|---|---|
      | 1 | `--lang=en-US` | `documentElement.lang === "en"`, `locale-en` class, a known body string in **English**, `localStorage.getItem("wcstats.locale") === null` |
      | 2 | `--lang=fr-FR` | `lang === "es"`, `locale-es`, Spanish body, storage still `null` |
      | 3 | `--lang=es-CO` | `lang === "es"`, Spanish body, storage still `null` |
      | 4 | `--lang=en-US`, then set `wcstats.locale = "es"` and reload | `lang === "es"` — a stored choice beats a detected guess |
      Assert `navigator.language` itself in each run and report it in the table: a run that did not
      get the locale it thinks it got is measuring nothing (D12's `setLocaleOverride` trap).
- [x] 9.4 Run case 1 on **more than the home route** — at least one of `/matches/{slug}`,
      `/players/{slug}`, `/about`. AC 5 says "any route".
- [x] 9.5 Confirm the accepted consequence rather than filing it (AC 6): in case 1, `<title>` and the
      OG tags are **still Spanish** while the body is English. Record it as expected under D20 §3.3.
- [x] 9.6 Report a table, not a claim. Kill Chrome and the server when done.

### Task 10 — the full chain and the numbers

- [x] 10.1 `npm run lint` — clean at `--max-warnings 0`, including the new `.tsx` (D10 fact 3).
- [x] 10.2 `npm run typecheck` — clean.
- [x] 10.3 `npm test` — record files / tests / skipped against the Task 1.5 baseline. **0 newly
      skipped.** State the delta and where it came from.
- [x] 10.4 `npm run build` — green end to end (already run at 9.1; re-run if anything changed since).
- [x] 10.5 **NOT TAKEN — skipped and filed, which is what this task sanctions** (checkbox clarified
      at code review 2026-08-26: it read as "done" while the completion notes said the opposite).
      **Optional, and only if Task 1's probe found it clean:** `src/app/static-output.test.ts:171`
      asserts the exported inline script contains `["wcstats.locale", "prefers-color-scheme",
      "locale-"]`. Adding `"navigator"` would make a detection-less export fail. **That file is on
      story 3-6's owned-paths list** and the guard sits behind `describe.skipIf(!anyBuilt)`. If you
      skip it, file it as deferred work with 3-6 or the Epic 3 retrospective named as successor —
      do not leave it unrecorded.

### Task 11 — commit (A4)

- [x] 11.1 Stage **only** these paths. Never `git add -A`, never a directory add:
      ```
      app/src/lib/bootstrap.ts
      app/src/lib/bootstrap.test.ts
      app/src/lib/i18n-provider.tsx
      app/src/lib/i18n-provider.test.tsx
      app/src/components/TournamentHub.test.tsx
      app/src/components/HeaderSearch.test.tsx
      app/src/components/SiteSignature.test.tsx
      _bmad-output/implementation-artifacts/3-5-first-visit-locale-detection.md
      _bmad-output/implementation-artifacts/sprint-status.yaml
      ```
- [x] 11.2 **Do not stage** `_bmad-output/planning-artifacts/ux-designs/**` (bmad-ux),
      `app/src/lib/site-origin.*`, `app/scripts/**`, `app/eslint.config.mjs` (3-1), or any component
      other than the three test files above (3-8, 3-6).
- [x] 11.3 `git status --porcelain` after staging; confirm the staged set matches 11.1 exactly.
- [x] 11.4 Commit directly to `main` (solo repo, no branch, no PR). The message must say **that three
      component test suites gained an explicit `navigator.language` pin, and why** — otherwise the
      next session to run `npm test` mid-rebase sees 25 unexplained failures and looks in the wrong
      place. If the push 403s, `gh auth switch -u juanrojasdp`.
- [x] 11.5 Commit the slice early rather than accumulating it.

### Task 12 — records

- [x] 12.1 Fill in Dev Agent Record: Debug Log (the Task 1 probe, the 2.3 typecheck error, the three
      REDs, the browser table), Completion Notes, File List, Change Log.
- [x] 12.2 `sprint-status.yaml`: `3-5-first-visit-locale-detection: ready-for-dev` → the status you
      reach. **Append only** — the file carries the project journal, the STATUS DEFINITIONS block and
      the Epic 2 action items. Never regenerate it.
- [x] 12.3 Append a journal entry at the tail, matching the existing `# YYYY-MM-DD:` shape. It must
      carry the three facts a later session needs: the 25-test blast radius and its remedy; that
      `wcstats.locale` is deliberately never written by detection; and that **any new jsdom render
      test that mounts `LocaleProvider` must now pin `navigator.language`** — story 3-8's planned
      `MatchDeepLink.test.tsx` is the next one that will need it.

### Review Findings

Code review 2026-08-26 (bmad-code-review, three layers: Blind Hunter, Edge Case Hunter,
Acceptance Auditor). **All six ACs and all twelve ruled decisions were independently confirmed
honoured** — the shipped behaviour is correct. Every finding below is about a guard, a test, or a
comment, not about what a reader sees today.

- [x] [Review][Decision] RESOLVED — **The pre-paint script's navigator guard does not cover normalization, and a throw takes the theme down with it** — `language()` (`bootstrap.ts:110-116`) try/catches only the *read*; `resolveLocale` runs outside it and calls `preferred.toLowerCase()`. A truthy non-string `navigator.language` (anti-fingerprinting extensions and shimmed navigators do return arrays/proxies) throws `TypeError` at `bootstrap.ts:123`, and the IIFE has no top-level catch — so `:124-128` never run and the visitor loses `root.lang`, the locale class **and the theme class**, because locale is resolved before theme. A persisted `light` reader gets the dark `:root` canonical: a full-brightness FOUC caused by an unrelated subsystem. **This is a regression introduced by this story** — before it, the locale path was only `===` comparisons on a `read()`-guarded value and could not throw. Needs a ruling because the two candidate fixes trade against D3/D4: (a) add `typeof preferred === "string" &&` to the truthy guard in **both** implementations — minimal, keeps them character-identical, but edits an explicitly ruled algorithm; (b) wrap the IIFE body in try/catch — leaves D3/D4 untouched, but swallows every other script error too.
- [x] [Review][Decision] RESOLVED — **`initialLocale` is now inert, and the effect's comment states a precedence the code does not implement** — `i18n-provider.tsx:33-34` reads "a stored CHOICE, then the browser's own preference read from navigator.language, then initialLocale", but `resolveLocale`'s last resort is a hardcoded `return "es"` (`bootstrap.ts:61`). `initialLocale` only seeds the pre-effect `useState` (`:29`) and is then overwritten unconditionally, so `<LocaleProvider initialLocale="en">` on an `fr-FR` browser with empty storage renders **es**. The author hit this and recorded it in a different file rather than here — `HeaderSearch.test.tsx:573` says "`initialLocale` alone is no longer enough … the file-wide `es-CO` pin would put Spanish back" — and the same false three-tier precedence is now repeated in story 3-8's `MatchDeepLink.test.tsx:122`. Note the wording came from **Task 5.2's own instruction**, so the spec is what is wrong, not the dev's execution. Three options, and D6 forbids the first-looking one: (a) honour the prop by giving `resolveLocale` a canonical-fallback parameter; (b) delete the prop and fix the two test call sites; (c) keep it as a render-seed only and correct both comments to say so. The comment must change under all three, so its fate follows this ruling.
- [x] [Review][Patch] The drift matrix is blind to the exact two mutations its sibling tests exist to pin [app/src/lib/bootstrap.test.ts:249]
- [x] [Review][Patch] The provider reads `window.navigator.language` unguarded while every comparable read beside it is hardened [app/src/lib/i18n-provider.tsx:48]
- [x] [Review][Patch] `navigatorThrows` is proved in the one world where three different failures are indistinguishable [app/src/lib/bootstrap.test.ts:219-231]
- [x] [Review][Patch] The D1 rationale in the record, in Task 4.1 and in the test comment names a case that cannot catch a D1 violation [app/src/lib/bootstrap.test.ts:26-29]
- [x] [Review][Patch] Bare `en` is the one row of Task 6.3's table with no AC-4 assertions [app/src/lib/i18n-provider.test.tsx:106]
- [x] [Review][Patch] The provider's storage-throws path is unpinned, and it reads a different source than the script's [app/src/lib/i18n-provider.test.tsx]
- [x] [Review][Patch] `layout.tsx`'s description of the script went stale in the change that updated `bootstrap.ts`'s [app/src/app/layout.tsx:29-32]
- [x] [Review][Patch] `en_US` resolving to Spanish is ruled but unpinned, so it reads as an oversight [app/src/lib/bootstrap.test.ts:252]
- [x] [Review][Patch] Task 10.5 is marked `[x]` while the completion notes state it was not taken [3-5-first-visit-locale-detection.md:552]
- [x] [Review][Defer] English visitors now get `<html lang="en">` over Spanish copy for the whole hydration window [app/src/lib/i18n-provider.tsx:32-58] — deferred, pre-existing
- [x] [Review][Defer] `locale-es` / `locale-en` have no consumers anywhere in the product [app/src/lib/bootstrap.ts:64-69] — deferred, pre-existing
- [x] [Review][Defer] One fact, three pinning idioms, and `SiteSignature`'s per-`it` variant is the fragile one [app/src/components/SiteSignature.test.tsx:62-80] — deferred, pre-existing

**Review outcome — applied 2026-08-26.** Both decisions were ruled by Juan and all 11 patches
applied in the same pass. Two of them amend ruled decisions and are recorded here so the amendments
are not mistaken for drift:

- **D3 is AMENDED.** The guard is now `typeof preferred === "string" && preferred`, in **both**
  implementations. D3's truthy fold of `null` / `undefined` / `""` is unchanged — it is narrowed, not
  replaced — and because both copies carry the identical guard, D4's "same algorithm, same shape"
  still holds. The reason is a defect this story introduced: `language()` try/catches only the READ,
  so a truthy non-string tag threw out of `.toLowerCase()` inside `resolveLocale`, which runs after
  `language()` returns and **before the theme is resolved** — so the escape cost the visitor
  `<html lang>`, the locale class and their persisted theme. Before this story the locale path was
  only `===` comparisons and could not throw.
- **D2 is INTACT; `resolveLocale` gains a defaulted third parameter.** `resolveLocale(stored,
  preferred, fallback = DEFAULT_LOCALE)`. `preferred` stays REQUIRED, so D2's typecheck gate is
  untouched. The provider passes its `initialLocale` as `fallback`, which makes the effect's
  three-tier precedence comment TRUE — it was false before: the prop only seeded the pre-effect
  render and was then overwritten, so `<LocaleProvider initialLocale="en">` on an `fr-FR` browser
  rendered `es`. Task 5.2's own wording is what instructed that false comment. The ES5 literal has no
  `initialLocale` to pass and keeps its hardcoded `es`; the drift matrix calls the two-argument form,
  whose default resolves to the same `es`, so the cross-check still holds exactly — and it gains a
  catch, because a future move of `DEFAULT_LOCALE` to `en` would now turn the matrix red against the
  literal.

**The three A1 REDs this review owed, driven and restored:**

| # | mutation | result |
|---|---|---|
| R-A | drop `.toLowerCase()` from the **ES5 literal only** | matrix RED — `theme=undefined locale=undefined language=EN-US: expected 'es' to be 'en'` |
| R-B | switch the **ES5 literal only** to `indexOf("en") === 0` | matrix RED — `theme=undefined locale=undefined language=enm: expected 'en' to be 'es'` |
| R-C | remove the provider's new `navigator` try/catch | `i18n-provider.test.tsx` RED on *"falls to the canonical when navigator.language throws"* |

R-A and R-B each name **exactly one of the two axis entries this review added** (`EN-US`, `enm`) and
nothing else — which is the proof that the pre-review axis was blind to both. Every uppercase
character in the old axis sat in a *region* subtag, and no value distinguished prefix-matching from
exact-matching, so a one-sided literal mutation produced identical output on all five values while
the pure-function tests that DO pin those behaviours never look at the literal.

**Numbers.** `bootstrap.test.ts` 17 -> 21, `i18n-provider.test.tsx` 19 -> 28, matrix 240 -> 336
combinations. `tsc --noEmit` clean; `eslint --max-warnings 0` clean on all five touched files.

**NOT verified, and why:** `npm test` full-suite and `npm run build` were NOT re-run. Story 3.10
landed `HeaderSearch.tsx`, `SiteHeader.tsx`, both dictionaries and new `SiteNav`/`nav-destinations`
files into the shared tree during this review, and `HeaderSearch.test.tsx` currently fails 8 tests.
**That failure is NOT this review's:** it was reproduced with all five of this review's files
reverted to HEAD, and it reproduces identically. `bootstrap.test.ts`, `i18n-provider.test.tsx`,
`TournamentHub.test.tsx` and `SiteSignature.test.tsx` were re-run together and are **60 passed, 0
failed**. A full-chain run should be repeated once 3.10 settles.

---

## Dev Notes

### Project structure

Everything is inside `app/src/`. No new directory, no new dependency (runtime **or** dev — the jsdom
stack is already installed), no config change, no locale key, no contract touch, no
`schemaVersion` implication, no route-count change. `$0/month` is structurally unaffected.

### Scope boundaries — what this story is NOT

- **Not** `navigator.languages[]`. One tag, primary subtag, per FR-37.
- **Not** a third locale, and not an `Intl`-driven negotiation.
- **Not** per-locale URLs, `hreflang`, or locale-varying `<title>`/OG. D17 upheld by D20; the
  earliest re-open is 2026-11-24 on Search Console evidence.
- **Not** a `Content-Language` header (static export; no headers to set).
- **Not** a persisted detection, ever (AC 4).
- **Not** a change to the theme path. `resolveTheme` already consults `prefers-color-scheme` and is
  the symmetric case that was solved correctly in Story 2.2.

### Regression surface

| behaviour | must still hold | proved by |
|---|---|---|
| stored `es`/`en` wins over anything detected | yes | Task 4.2, 6.3 |
| garbage in storage does not crash and does not persist | yes | Task 4.2, 6.3 |
| storage throwing (private mode) still yields a locale | yes | Task 4.5 |
| `matchMedia` throwing still yields `dark` | yes | existing `:112-117` |
| next/font variable classes survive the class rewrite | yes | existing `:119-123` |
| the toggle persists **and** announces | yes | Task 6.6 |
| exactly one executable inline script in the export, before `<header>` | yes | `static-output.test.ts:171-187` |

### Coordination & hygiene

- Three-plus sessions are live. Probe at Task 1, stage by path at Task 11, commit early.
- Verification that needs a server uses a **private port**; another session may hold the default.
- If the shared tree is left non-compiling by another session, verify in an **isolated git worktree**
  (Story 2.11a's precedent — and the method this story's blast-radius measurement itself used). On
  Windows, junction `app/node_modules` into the worktree rather than re-installing.
- Scripted edits to source files must write **binary**, not text mode — a text-mode Python write
  converts the whole file to CRLF and a one-line change commits as a whole-file rewrite.

### Testing standards

- `vitest 3.2.7`, global `environment: "node"`; jsdom is opted into **per file** by pragma.
- Pin by relative path, never by an id a fixture and the real corpus could share (A2).
- Never satisfy a gate by deleting an assertion (A1). Nothing in this story deletes one — the
  `resolveLocale` describe block is **rewritten and widened**, not trimmed.
- `expect(x, "message")` with a second-argument label is this repo's idiom for preconditions.

---

## References

- `_bmad-output/planning-artifacts/epics.md:1222-1254` — Story 3.5 acceptance criteria
- `_bmad-output/planning-artifacts/epics.md:1071-1105` — Epic 3 standing criteria A1–A6
- `_bmad-output/planning-artifacts/epics.md:74` — FR-37
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26.md:435-495` — §4.5, the four constraints
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-26.md:264-280` — D20 §3.3, the accepted crawler consequence (AC 6)
- `_bmad-output/implementation-artifacts/deferred-work.md:4423-4447` — the ledger entry this story closes, and the accepted-consequence entry beside it
- `_bmad-output/planning-artifacts/architecture/…/ARCHITECTURE-SPINE.md:112` — AD-12 (pre-paint bootstrap, single post-hydration swap)
- `_bmad-output/planning-artifacts/architecture/…/ARCHITECTURE-SPINE.md:100` — AD-10 (`wcstats.locale` is one of the two allowed localStorage keys)
- `_bmad-output/planning-artifacts/ux-designs/…/EXPERIENCE.md:476` — UJ Tomás: *"Browser set to English → he reads English … his choice is not persisted, because he never made one"*
- `_bmad-output/implementation-artifacts/2-19-…md:291-345` — the CDP harness recipe (Task 9)
- `app/src/lib/bootstrap.ts` — `:4-17` header, `:36-42` function, `:56-91` literal
- `app/src/lib/bootstrap.test.ts` — `:21-56` harness, `:76-87` locale describe, `:125-152` matrix
- `app/src/lib/i18n-provider.tsx` — `:32-52` the effect, `:54-64` the toggle
- `app/src/components/SiteSignature.test.tsx:1-12` — the cleanest jsdom harness precedent

---

## Dev Agent Record

### Agent Model Used

`claude-opus-5[1m]` (Claude Code, bmad-dev-story).

### Debug Log References

**Task 1.1 — `git status --porcelain` at start (verbatim):**

```
 M app/eslint.config.mjs
 M app/scripts/assert-no-external-origins.mjs
 M app/src/components/DefensiveActionsSection.tsx
 M app/src/components/ExpertLayer.tsx
 M app/src/components/MovementToReceiveSection.tsx
 M app/src/components/OffersToReceiveSection.tsx
 M app/src/components/PassNetworksSection.tsx
 M app/src/components/PitchPanel.tsx
 M app/src/components/ShotMapsSection.tsx
 M app/src/components/TacticalLayer.tsx
 M app/src/components/TournamentHub.tsx
 M app/src/lib/assert-no-external-origins.test.ts
 M app/src/lib/expert-logs.ts
 M app/src/lib/i18n.test.ts
?? 17
?? _bmad-output/implementation-artifacts/3-1-build-gate-lint-gate-correction.md
?? app/src/lib/match-anchors.test.ts
?? app/src/lib/match-anchors.ts
?? app/src/lib/site-origin.test.ts
?? app/src/lib/site-origin.ts
?? app/src/lib/use-anchor-nonce.ts
```

**Task 1.2 — all seven owned paths CLEAN.** `bootstrap.ts`, `bootstrap.test.ts`,
`i18n-provider.tsx`, `SiteSignature.test.tsx`, `TournamentHub.test.tsx`,
`HeaderSearch.test.tsx` all clean; `i18n-provider.test.tsx` did not exist. Note
`TournamentHub.tsx` (the component) is dirty under story 3-8, but `TournamentHub.test.tsx`
is not — the Task 1.4 re-verification resolved in this story's favour, so the Task 7.1 slice
was taken rather than aborted.

**Task 1.3 — the two known Epic 3 collision files.** `app/src/app/page.tsx` and
`app/src/components/SiteHeader.tsx` were both clean, and this story touches neither. Recorded
as a checked fact, not an assumption.

**Task 1.5 — baseline.** `53 files / 1,334 passed / 0 failed / 0 skipped` (`app/out` present,
so no `describe.skipIf(!anyBuilt)` blocks skipped). Higher than the 1,306 measured at story
creation because story 3-1's then-untracked `site-origin.test.ts` and 3-8's
`match-anchors.test.ts` had entered the tree.

**Task 2.3 — D2's gate firing.** `npm run typecheck` after the pure function alone:

```
src/lib/bootstrap.test.ts(78,12): error TS2554: Expected 2 arguments, but got 1.
src/lib/bootstrap.test.ts(79,12): error TS2554: Expected 2 arguments, but got 1.
src/lib/bootstrap.test.ts(83,12): error TS2554: Expected 2 arguments, but got 1.
src/lib/bootstrap.test.ts(84,12): error TS2554: Expected 2 arguments, but got 1.
src/lib/bootstrap.test.ts(85,12): error TS2554: Expected 2 arguments, but got 1.
src/lib/bootstrap.test.ts(144,34): error TS2554: Expected 2 arguments, but got 1.
src/lib/i18n-provider.tsx(42,18): error TS2554: Expected 2 arguments, but got 1.
```

Exactly one PRODUCTION error, at `i18n-provider.tsx:42`, as D2 predicted. The other six are
`bootstrap.test.ts`'s own one-argument calls, which Task 4.2/4.3 rewrote.

**Task 8 — the three RED runs (D11).**

*R1, the drift red — the most important one.* ES5 literal reverted to persisted-or-`es`, pure
function left updated. `npx vitest run src/lib/bootstrap.test.ts` -> **3 failed | 14 passed**,
and the matrix named the combination:

```
FAIL  src/lib/bootstrap.test.ts > inline bootstrap script > agrees with the exported pure functions across the input matrix
AssertionError: theme=undefined locale=undefined language=en-US: expected 'es' to be 'en'
```

The `world` label added at Task 4.3 is what makes the failure self-describing rather than a
bare `expected 'es' to be 'en'` with 240 candidate combinations behind it.

*R2, the detection red.* Detection reverted in BOTH implementations -> **4 failed | 13 passed**:
`reads ONLY the primary subtag, case-insensitively`, `falls through to detection when the
stored value is not a valid locale`, `first-time visitor whose browser asks for English:
English before paint`, `storage and matchMedia throwing still detects the locale, theme dark`.
The **matrix stayed GREEN** under R2 — correct, and worth stating: it is a *drift* test, not a
feature test. R1 and R2 catch different failures and neither subsumes the other.

*R3, the provider red.* `if (stored === null) { return; }` restored ->
`npx vitest run src/lib/i18n-provider.test.tsx` -> **9 failed | 10 passed**, first-visit English
cases failing `expected 'es' to be 'en'` and the DOM case failing `expected '' to be 'es'`.

*Task 8.4* — all three reverts restored from byte-for-byte backups and `git diff` reviewed line
by line. Diffstat confirmed no whole-file CRLF rewrite: `bootstrap.ts 47/9`,
`i18n-provider.tsx 15/9`, `bootstrap.test.ts 159/29`, `SiteSignature.test.tsx 18/0`.

**Task 9 — AC 5 in a real browser (D12).** Seven launches, each a fresh `--user-data-dir`
(so `localStorage` starts empty), `app/out` served on private port 8137, CDP over the page
target's `webSocketDebuggerUrl`. `Emulation.setLocaleOverride` was NOT used; `--lang=<tag>`
was, and every run asserts `navigator.language` itself.

| # | launch | nav.language | `<html lang>` | class | body | `wcstats.locale` | `<title>` |
|---|---|---|---|---|---|---|---|
| 1 | `--lang=en-US` `/` | `en-US` | `en` | `locale-en` | **EN** | `null` | Spanish |
| 2 | `--lang=fr-FR` `/` | `fr-FR` | `es` | `locale-es` | ES | `null` | Spanish |
| 3 | `--lang=es-CO` `/` | **`es-419`** | `es` | `locale-es` | ES | `null` | Spanish |
| 4 | `--lang=en-US` `/`, `wcstats.locale="es"` seeded, reloaded | `en-US` | `es` | `locale-es` | ES | `"es"` | Spanish |
| 5 | `--lang=en-US` `/matches/m001-mexico-south-africa/` | `en-US` | `en` | `locale-en` | **EN** | `null` | `… · Fase de grupos · …` |
| 6 | `--lang=en-US` `/about/` | `en-US` | `en` | `locale-en` | **EN** | `null` | `WC Stats — Analítica del Mundial 2026` |
| 7 | `--lang=en-US` `/players/aaronson-brenden-usa/` | `en-US` | `en` | `locale-en` | **EN** | `null` | locale-neutral |

Two things the run measured that were NOT assumed:

- **Case 3: Chrome normalised `--lang=es-CO` to `navigator.language === "es-419"`.** The tag
  asked for is not the tag delivered. It resolves `es` either way (same primary subtag), but
  this is exactly why D12 insisted the run assert `navigator.language` itself rather than trust
  the flag — a harness that only reported the flag would have reported a locale the browser
  never had.
- **A first draft of the harness gated on the provider's `[aria-live="polite"]` region and was
  WRONG.** That region is server-rendered, so the gate passed instantly and case 5 (the heavy
  match route) was probed BEFORE React re-rendered — reading a stale Spanish body under an
  already-English `<html lang>`, i.e. reporting AC 3's exact failure mode as if it were real.
  Replaced with a neutral DOM-quiescence gate (body text length + `<html>` className stable for
  700 ms). Neutral matters: a gate that waited "until it says English" could not have
  distinguished a pass from a hang.

**Task 10.3 — a flake I introduced, found and fixed.** The first full-suite run after Task 7
failed `i18n-provider.test.tsx > DOES persist and DOES announce …` with `Test timed out in
5000ms`. Not a logic fault — `userEvent.setup()` waits on real timers between events, which is
fine alone and exceeds the timeout under a loaded 55-file run. The repo already had the answer:
`HeaderSearch.test.tsx:98` uses `userEvent.setup({ delay: null })`. Adopted, and the test has
been green in every run since. Recorded because "passes alone, times out in the suite" is a
class of red that is easy to wave through as ambient flakiness.

**Known flake, NOT this story's:** `assert-schema-version.test.ts > passes on the current data
tree` timed out once in a full run (the file documents this at `:36-53`). Re-run alone: **6
passed**. It also failed once during story creation, and once here.

### Completion Notes List

**What shipped.** `resolveLocale(stored, preferred)` now reads `navigator.language`'s primary
subtag when nothing valid is persisted, in the pure function and in the checked-in pre-paint
ES5 literal, and `i18n-provider.tsx`'s mount effect consults the same function instead of
returning early on empty storage. A first-time visitor whose browser asks for English now gets
English before first paint and again after hydration; everyone else still gets the canonical
`es`. Nothing about detection is persisted or announced.

**AC-by-AC.**

- **AC 1 — primary subtag only.** `en`, `en-GB`, `en-US`, `EN-US`, `en-us`, `en-Latn-US` -> `en`;
  `es*`, `fr*`, `de-DE`, `pt-BR`, `zh-CN`, `""`, `null`, `"garbage"`, `"-"` -> `es`. Also pinned
  `enm` and `eng-GB` -> `es`, which is the case a `startsWith("en")` implementation would get
  wrong. Precedence proved in both directions and through invalid stored values.
- **AC 2 — both call sites, one edit.** The literal was updated in the same change and the
  cross-check matrix gained its `navigator` dimension **inside** the existing loop:
  4 themes x 4 stored locales x 5 language tags x 3 preference worlds = **240 combinations**,
  with the count asserted so a mis-typed axis that collapsed to one value cannot pass silently.
  The stub expresses three worlds — a tag, an empty tag, and **no `navigator` key at all** —
  plus a fourth where `window.navigator` throws on access. D1 upheld: the literal reads
  `window.navigator`, never bare `navigator`. ~~and the no-navigator world is the case that would
  have exposed a violation.~~ **CORRECTED at code review 2026-08-26 — that named the wrong bar.**
  The no-navigator world stays GREEN under a D1 violation: a bare read falls through the
  `new Function("window", "document", …)` scope chain to Node 24's real global, which reports this
  machine's `es-CO` and resolves `es` — precisely what that world expects. The `navigatorThrows`
  world is equally blind, because its throwing getter sits on `windowStub`, which a bare read never
  touches. What actually catches D1 is the matrix's `languages` axis spanning BOTH English and
  non-English tags: whatever single locale the host reports, it must disagree with at least one of
  those rows, so a bare read goes red on every machine. The gate was always real; only its
  explanation was wrong, and the risk of leaving it wrong is a later session pruning the "wrong"
  case and silently removing the guard.
- **AC 3 — the provider falls through.** Early return deleted; `resolveLocale(stored,
  window.navigator.language)`. Proved by the new jsdom render test from both sides: the strings
  AND `<html lang>` + the locale class, so "Spanish strings under `lang="en"`" cannot pass. D6
  upheld — the DOM re-assertion stays unconditional and there is no `next === locale` early
  return; a test asserts the re-assertion happens for a detected *Spanish* visitor too.
- **AC 4 — a guess is not a choice.** No `writeStorage` and no `setAnnouncement` were added to
  the effect; verified by reading and by grep — each still appears exactly once outside its
  declaration, both inside `setLocale`. Because AC 4 is satisfied by the absence of code, it is
  proved only by tests that look: every detection case asserts `wcstats.locale === null` and
  asserts the polite live region is present *and* empty, queried structurally. The paired
  control (a real toggle click) asserts the same region DOES fill and storage DOES get written —
  without it, both silence assertions would have passed against a provider whose live region
  never worked at all. Confirmed again in the browser: `wcstats.locale` was `null` after every
  detection run.
- **AC 5 — a real browser.** Seven launches, table above. English on `/`, a match route,
  `/about` and a player route; `wcstats.locale` unset throughout; a stored choice beating a
  detected guess.
- **AC 6 — read and ACCEPTED, nothing implemented.** Confirmed rather than filed: in case 6
  the body is English while `<title>` is `WC Stats — Analítica del Mundial 2026`, and in case 5
  the title still carries `Fase de grupos`. That mixed-language rendered document is the
  accepted consequence recorded in D20 §3.3 — it is already the shipped behaviour under a manual
  toggle, the non-rendered fetch and the canonical both declare `es`, and if it causes harm that
  harm IS D20-b re-open trigger (b). No metadata was touched.

**Task 7 — the measured regression, repaired not weakened.** Detection turned 23 green
component tests red across three files (the story predicted 25 across four; the other two were
`bootstrap.test.ts`'s, already rewritten by Task 4). Cause: those files mount `LocaleProvider`
with empty `localStorage` and jsdom's default `navigator.language` is `"en-US"`, so their locale
was being decided by an ambient default instead of by the test — the A2 coincidence-green class
arriving from the other direction. Each file now states the browser it assumes
(`TournamentHub` and `HeaderSearch` file-wide; `SiteSignature` per-locale, because its cases are
generated from a `DICTIONARIES` loop), and `HeaderSearch`'s one English test re-pins in its own
body. Result: **44 passed, 0 failed** — the exact figure the trial worktree reached. Detection
was not weakened to suit the tests: no `initialLocale`-wins branch, no opt-out prop, no skipped
effect.

**Task 7.5 — the renderer list is NO LONGER CLOSED at six.** `grep -rln "LocaleProvider"
app/src` now returns **seven** files: the six named at story creation plus
`app/src/components/MatchDeepLink.test.tsx`, which story 3-8 created *during* this story's run.
It mounts a bare `<LocaleProvider>` and asserts Spanish strings, so it takes 3 failures from
this change. **It is untracked and in-flight under story 3-8, so under A3 it was NOT edited and
NOT staged.** Filed as deferred work with 3-8 named as successor, and called out in the journal
entry — this is precisely the successor case Task 12.3 anticipated.

**Verification detour worth recording.** The shared tree was left non-compiling by another
session (`TacticalLayer.tsx` tripped `react-hooks/set-state-in-effect`, blocking link 1 of the
build chain). Verification moved to an isolated worktree per the story's coordination note,
where the whole-repo `eslint . --max-warnings 0` and `tsc --noEmit` both passed against
HEAD + this slice — better evidence than a shared-tree run would have given. Two Windows
gotchas cost time and are worth the next session's attention: a worktree under the deep scratch
path failed `git worktree add` with *Filename too long*, and **junctioning `app/node_modules`
into a worktree no longer works** — Turbopack rejects it with *Symlink [project]/node_modules is
invalid, it points out of the filesystem root*, and `npm ci` into that worktree repeatedly died
on Windows `ENOTEMPTY`. The other session fixed its lint error before the end, so the final
`npm run build` ran unmodified in the shared tree and was green end to end.

**Task 10.5 — NOT taken, and filed.** `static-output.test.ts:171` asserts the exported inline
script contains `["wcstats.locale", "prefers-color-scheme", "locale-"]`; adding `"navigator"`
would make a detection-less export fail. The file is clean, but it is on story 3-6's owned-paths
list AND adding it would put a ninth path into a Task 11.1 staging list that is explicitly
closed. Skipped on those two grounds and filed as deferred work with 3-6 / the Epic 3
retrospective named as successor. It is also Juan's open question #2 — flagged, not silently
decided. (The guard's value is real: it is the only export-layer check that would catch
detection being dropped from the shipped script.)

### File List

| path | change |
|---|---|
| `app/src/lib/bootstrap.ts` | modified — `resolveLocale(stored, preferred)`, `language()` reader in the ES5 literal, both header comments corrected |
| `app/src/lib/bootstrap.test.ts` | modified — navigator dimension in the harness and the 240-combination matrix; `resolveLocale` describe rewritten and widened; first-visit English and navigator-throws cases added |
| `app/src/lib/i18n-provider.tsx` | modified — early return removed, detection wired in, effect comment rewritten |
| `app/src/lib/i18n-provider.test.tsx` | **added** — jsdom render test for AC 3, AC 4 and AC 5 (19 tests) |
| `app/src/components/TournamentHub.test.tsx` | modified — file-wide `navigator.language` pin (regression repair) |
| `app/src/components/HeaderSearch.test.tsx` | modified — file-wide pin + per-test re-pin for the English case (regression repair) |
| `app/src/components/SiteSignature.test.tsx` | modified — per-locale pin helper called in all five cases (regression repair) |
| `_bmad-output/implementation-artifacts/3-5-first-visit-locale-detection.md` | modified — this record |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modified — status flip + journal entry |
| `_bmad-output/implementation-artifacts/deferred-work.md` | modified — two entries appended (3-8's `MatchDeepLink.test.tsx` pin; 3-6's exported-script marker). **WRITTEN BUT DELIBERATELY NOT STAGED** — see below. |

**Why `deferred-work.md` is modified but not committed by this story.** Between this story's Task 1
probe (where it was clean) and Task 12's write, story 3-8 appended its own uncommitted
`## Closed by Story 3.8` block to the same file. Staging it would have committed another session's
in-flight work, which A3 forbids and which is the exact failure the "concurrent session may commit
your work" hazard describes, in reverse. The append preserved 3-8's block byte-for-byte (verified);
the two new entries simply ride on whichever commit 3-8 makes. **Nothing is lost if they do not:**
both deferred items are also written in full into the `sprint-status.yaml` journal entry, which this
story does commit. Task 11.1's staging list is therefore honoured exactly as written — 8 paths, no
ninth.

**Final numbers.** `npm run lint` clean at `--max-warnings 0`. `npm run typecheck` clean.
`npm test` -> **55 files / 1,367 tests / 0 skipped**, against a baseline of 53 / 1,334 / 0.
Delta **+2 files, +33 tests**, fully accounted for: +7 in `bootstrap.test.ts` (10 -> 17), +19 in
the new `i18n-provider.test.tsx`, and +7 from story 3-8's `MatchDeepLink.test.tsx`, which is
not this story's. **0 newly skipped.** `npm run build` green end to end; the origin gate
reported `12,683 text assets, 0 external subresources`.

---

## Change Log

| date | change |
|---|---|
| 2026-08-26 | Implemented. Detection added to both call sites and to the provider; new `i18n-provider.test.tsx` (19 tests); the measured 23-test regression across three render suites repaired with explicit `navigator.language` pins; all three A1 guards driven red; AC 5 verified across 7 real-browser launches. Status `ready-for-dev` -> `review`. |
| 2026-08-26 | Story contexted from `epics.md:1222`. Blast radius (25 tests / 4 files) and its remedy measured in an isolated worktree; jsdom, Node and CDP behaviours probed and recorded as D1, D3, D8, D9, D12. |

---

## Open questions for Juan — non-blocking, answer during implementation

1. **The `--lang` matrix at Task 9.3 stops at four cases.** Worth adding `en-CA` / `es-419` /
   `zh-CN`, or is the primary-subtag rule considered proved by the unit matrix and the browser run
   reserved for the end-to-end path?
2. **Task 10.5** — add `"navigator"` to the exported-script marker guard in
   `static-output.test.ts:171` now (it is story 3-6's file, currently committed and clean), or leave
   it to 3-6's close?
3. **`sprint-status.yaml` still lists `3-6-authorship-signature: in-progress`**, but its code landed
   at `92eec27` and `f07116b` and the tree is clean. Not this story's to flip — flagging it so it is
   not carried into the Epic 3 retrospective as an open story.

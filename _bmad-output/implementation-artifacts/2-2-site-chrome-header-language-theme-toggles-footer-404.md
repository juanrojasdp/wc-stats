---
baseline_commit: d85e67d1c0c1d06279733a7de8f2c83851288fd1
---

# Story 2.2: Site Chrome — Header, Language & Theme Toggles, Footer & 404

Status: done

## Story

As Mariana or Diego,
I want a persistent header with language and theme controls, an attribution footer, and a helpful 404,
So that I can use the site in my language and theme from the very first page (FR-31).

## Acceptance Criteria

1. **Given** any route
   **When** the page renders
   **Then** the slim sticky site header shows wordmark → `/`, the header-search slot, the `ES | EN` segmented language toggle, and the theme toggle, in that order; the attribution footer renders the ruled es/en wording with the `/about` link, not dismissible (UX site-header + attribution-footer specs).

2. **Given** a first-time visitor with no stored preference
   **When** any page loads
   **Then** first render is Spanish and the theme follows `prefers-color-scheme` (dark canonical)
   **And** one inline head script sets `<html lang>` + locale class + theme class before first paint; the string swap runs once, post-hydration, with no hydration mismatch (AD-12).

3. **Given** a visitor who toggles language or theme
   **When** they reload or revisit
   **Then** the choice persists via `wcstats.locale` / `wcstats.theme` behind try/catch with in-memory fallback (private-mode still works per session), the language toggle announces via a polite live region, and `<html lang>` updates (FR-31, AD-10).

4. **Given** an unknown URL
   **When** it is requested
   **Then** the static 404 renders "Esta página no existe. ¿Buscabas un partido?" with links home (UX 404 state pattern).

> ID note: the epics cite `AR-10`/`AR-12`; the architecture spine numbers these `AD-10` (state rules) and `AD-13` (build chain), with the first-paint/inline-script rule living inside `AD-12`. The UX docs have **no numbered UX-DR registry** — "UX-DR3/4/14/21" in the epic are shorthand for the DESIGN.md component specs and EXPERIENCE.md pattern rows cited in Dev Notes below. Cite real sections, do not invent DR ids.

## Tasks / Subtasks

- [x] Task 1: Pre-paint bootstrap script in root layout (AC: 2)
  - [x] Write the resolution logic as pure, testable functions in `src/lib/bootstrap.ts` (or similar): `resolveTheme(stored, prefersDark)` → persisted override → `prefers-color-scheme` → `dark` (canonical default); `resolveLocale(stored)` → persisted → `es`. Export the inline-script source string from the same module so the script and the tested logic cannot drift.
  - [x] Render **exactly one** inline `<script dangerouslySetInnerHTML>` inside `<html>` (before `<body>` content paints) in `src/app/layout.tsx`. The script must be dependency-free, wrap all storage reads in try/catch, and set: `document.documentElement.lang`, the locale class, and the theme class (`dark` or `light`) — using `classList` add/remove so the `next/font` variable classes are preserved.
  - [x] Remove the hardcoded `"dark"` from `htmlClassName` (2.1's stopgap, reserved for this story); keep `lang="es"` and the font variable classes as the server-rendered canonical markup. Add `suppressHydrationWarning` to `<html>` — the script legitimately mutates `lang`/`className` before hydration.
  - [x] Verify: no hydration warning in dev console; server HTML in `out/` is Spanish + dark canonical; a `wcstats.theme=light` visitor gets light with no dark flash.
- [x] Task 2: Theme context + persistence (AC: 2, 3)
  - [x] Add a `ThemeProvider` client context (AD-10 sanctions Context for locale and theme ONLY). Initial state must match server markup; on mount, sync from `document.documentElement`'s class (the pre-paint script's verdict), not by re-reading storage with different logic.
  - [x] Toggling: flips `dark`/`light` class on `<html>`, persists via `writeStorage(STORAGE_KEYS.theme, …)`. Reverting to system preference is not required by ACs — a plain two-state toggle persisting the explicit choice is the ruled minimum.
  - [x] `color-scheme` is already set per theme class in `globals.css` — do not duplicate.
- [x] Task 3: Locale switching wired end-to-end (AC: 2, 3)
  - [x] Extend `LocaleProvider` (`src/lib/i18n-provider.tsx`): on mount (post-hydration), read `readStorage(STORAGE_KEYS.locale)`; if a valid stored locale differs from `es`, call `setLocale` **once** — this is the single post-hydration string swap.
  - [x] `setLocale` additionally: persists via `writeStorage`, updates `document.documentElement.lang` + locale class, and pushes the announcement into a polite live region.
  - [x] Live region: a visually-hidden `aria-live="polite"` element rendered persistently (inside the provider or header), announcing in the **target** language: es `"Idioma: Español"` / en `"Language: English"` (ruled strings, EXPERIENCE.md language-toggle row; WCAG 4.1.3). Strings via locale files.
- [x] Task 4: Resolve the deferred `t()` boundary policy (AC: 3) — **explicit decision assigned to this story** (deferred-work.md, from 1-6 and 2.1 reviews)
  - [x] Throw-vs-fallback: once persistence ships, `t()`'s throw on an unresolvable key becomes an uncaught page crash. Recommended: in production resolve missing keys by falling back to the `es` value with a `console.error`; keep the throw in tests/dev so regressions stay loud. Record the decision in the story's Dev Agent Record.
  - [x] Client-import seam: nothing stops a client component importing server-safe `t()` directly (compiles, renders Spanish, silently ignores toggles). Recommended mechanism: an ESLint `no-restricted-imports` override barring `@/lib/i18n` imports from `src/components/**` (client components must use `useT()`/`useLocale()`); server components and `src/app/**` metadata keep direct `t()`. Add a lint-fixture regression test in the `eslint-gate.test.ts` style. If a clean mechanical scope proves impossible, document the convention prominently in both i18n modules and note it — do not silently drop the item.
- [x] Task 5: Site header component (AC: 1)
  - [x] `src/components/SiteHeader.tsx` (PascalCase, client component). Slim sticky top bar on `--color-surface-base` with a hairline bottom rule (`border-hairline` — the only divider weight). Order: wordmark → header-search slot → `ES | EN` language toggle → theme toggle. No primary nav, no accent-colored chrome.
  - [x] Wordmark: site name from `t("app.siteName")`, `type-title` typography, links to `/`.
  - [x] Header-search **slot only** — story 2.14 owns all search behavior. Render a positioned placeholder container that reserves the slot (including where the `<md` icon-button affordance will sit). Do NOT render a fake/disabled input or any interactive element; no typeahead, no sheet.
  - [x] Language toggle: segmented pill (`rounded-full` track), active segment `--color-accent-lime` fill with `--color-ink-on-lime` ink, inactive `--color-ink-secondary`, `type-label-caps` typography. Use vendored shadcn/radix primitives (radix-ui already installed; vendor `toggle-group` into `src/components/ui/` if used — reconcile to tokens like 2.1 did with button/card: hairline borders, global `--ring` focus, no `outline-none`, no new package deps). Radio-group semantics vs `aria-pressed` is unruled — pick ToggleGroup's accessible default and note it.
  - [x] Theme toggle: shadcn Toggle used as-is with mapped CSS variables, no visual delta beyond tokens. `aria-label` via `t()` (gated attribute — literal will fail the build).
  - [x] All controls ≥44×44px CSS touch targets. Sticky is `[ASSUMPTION: sticky]` in EXPERIENCE.md — implement sticky; no z-index scale is ruled, keep it minimal and note the value chosen.
- [x] Task 6: Skip link + shell assembly (AC: 1)
  - [x] Skip-link to main content is required chrome (EXPERIENCE.md Accessibility Floor). First focusable element; visible on focus; string via locales (no ruled copy — author es/en, e.g. es "Saltar al contenido", and flag in Dev Agent Record).
  - [x] Mount `SiteHeader` + `AttributionFooter` in `layout.tsx` around `{children}`, inside `LocaleProvider`/`ThemeProvider`, with a `<main id>` target for the skip link. Every route (including 404) inherits the shell.
- [x] Task 7: Attribution footer + minimal `/about` stub (AC: 1)
  - [x] `src/components/AttributionFooter.tsx`: one `type-caption` line in `--color-ink-secondary` on `--color-surface-base`, hairline top rule, `/about` link in accent-cyan. Present on every route, **not dismissible** — no close affordance of any kind.
  - [x] Ruled copy, verbatim (EXPERIENCE.md → i18n & Terminology → Attribution (OQ-3)):
    - es: `Datos: informes oficiales post-partido de la FIFA — Copa Mundial 2026. Sitio independiente, sin afiliación con la FIFA.`
    - en: `Data: official FIFA Post-Match Summary Reports — 2026 World Cup. Independent site, not affiliated with FIFA.`
  - [x] `/about` does not exist yet and 2.18 owns its full content — but a dead footer link would 404. Create a **minimal** `src/app/about/page.tsx` stub rendering the ruled attribution statement (same locale keys) + the independence framing; 2.18 replaces/expands it. Keep it to attribution only — no methodology, glossary, or credits content (2.18 scope).
- [x] Task 8: Static 404 (AC: 4)
  - [x] `src/app/not-found.tsx` — Next static export emits `out/404.html` from it; Netlify serves it for unknown URLs (no redirects, no functions). It renders inside the root layout, so it inherits the chrome shell.
  - [x] **Page-body copy must actually swap with the toggle**: a server component calling `t()` directly emits static Spanish and never re-renders on locale change — only `useT()` consumers swap. Render the 404 body copy (and the `/about` stub body, Task 7) through a small client component using `useT()`, so the authored `en` strings are reachable. Server-side `t()` remains correct only for `metadata` and build-time-static text.
  - [x] es copy, verbatim (ruled): `Esta página no existe. ¿Buscabas un partido?` + link to `/` (the hub carries the match list — there is no separate `/matches` index route in the architecture seed).
  - [x] **The English 404 string is not ruled anywhere** — author it as the en locale entry (e.g. `This page does not exist. Were you looking for a match?`) and flag it in the Dev Agent Record for review. Do not "fix" `página` to `sección` — review-i18n.md confirmed `página` is correct here (it's the web page, not a report section).
  - [x] Verify `out/404.html` exists after build and contains the Spanish copy.
- [x] Task 9: Strings + gates (all ACs)
  - [x] Every new string (wordmark aria, toggle labels/aria, announcements, footer, about stub, 404, skip link) goes into `src/locales/es.ts` first (canonical), then `src/locales/en.ts` (type-mirror — missing key = compile error). Spanish register: tuteo, neutral LatAm, no exclamation marks; Spanish runs 20–30% longer — let labels wrap before truncating.
  - [x] The hardened ESLint gate WILL catch: literal JSX text, template/concat/ternary strings, gated props (`aria-label`, `title`, `alt`, `placeholder`, `label`, `message`, `text`, `description`, `caption`, `heading`, `tooltip`, extended aria set), and metadata object strings. Do not fight it; route everything through `t()`/`useT()`.
  - [x] Full chain green: `npm run build` (eslint --max-warnings 0 → tsc --noEmit → assert-schema-version → next build → copy-data) and `npm test`.
- [x] Task 10: Tests (co-located vitest, `src/**/*.test.{ts,tsx}`)
  - [x] `bootstrap` pure functions: theme resolution order (stored `light`/`dark` wins; else `prefers-color-scheme`; else dark), locale resolution (stored valid → it; garbage/absent → `es`), and a test that evaluates the exported inline-script string (e.g. `new Function`) against stubbed `document`/`localStorage`/`matchMedia` to prove script and logic agree.
  - [x] Storage round-trip through existing helpers: toggle persists, `readStorage` returning `null` after `removeStorage` does NOT resurrect (semantics hardened in 2.1 review — memory fallback only when localStorage throws).
  - [x] `t()` policy tests per Task 4 decision (fallback path + console.error, or documented throw).
  - [x] Lint-fixture regression for the client-import seam rule (if adopted) in the `eslint-gate.test.ts` pattern.
  - [x] Component render tests are constrained: vitest runs `environment: "node"` — either add `@vitest-environment jsdom` per-file (needs `jsdom` devDependency) or keep component logic in testable pure functions and assert markup via the built `out/` HTML for the 404. Prefer the lightest option that actually verifies AC behavior; note the choice.

### Review Findings

- [x] [Review][Decision] Theme toggle ARIA is self-contradictory — `pressed={!isDark}` combined with an `aria-label` that flips between "switch to light/dark" changes the toggle's accessible name in sync with its state (discouraged ARIA pattern: a screen reader in light mode hears "Switch to dark theme … pressed"), and the pressed=light polarity keeps the button visually highlighted (`data-[state=on]:bg-accent`) for light-theme users. [app/src/components/SiteHeader.tsx:104-111] — **RESOLVED (2026-07-23): stable name + pressed.** `aria-label` is now the constant `chrome.themeToggle.label` (es "Tema claro" / en "Light theme"), `aria-pressed` alone carries whether light is active, and the on-state accent fill is muted (`data-[state=on]:bg-transparent`). The `toLight`/`toDark` keys were removed from both dictionaries.
- [x] [Review][Decision] `bootstrapScript` is generated via `Function.prototype.toString()` — any build transform that touches `resolveTheme`/`resolveLocale` (coverage instrumentation, refresh wrappers, a future TS downlevel helper) ships into the pre-paint script sight-unseen. [app/src/lib/bootstrap.ts:51-73] — **RESOLVED (2026-07-23): checked-in ES5 literal.** The script now hand-writes the two resolver functions; `bootstrap.test.ts`'s matrix test (script evaluated against stubbed document/localStorage/matchMedia, cross-checked against the exported pure functions) remains the drift guard and passes unchanged.
- [x] [Review][Patch] Mount sync leaves `<html lang>`/locale class stale when the pre-paint script did not run (e.g. blocked by a future CSP): UI swaps to English while `lang` stays `es` [app/src/lib/i18n-provider.tsx:40] — fixed: the mount effect re-asserts `lang` + locale class (a no-op when the script ran)
- [x] [Review][Patch] `initialLocale` prop is unconditionally overwritten to `es` by the mount sync whenever storage is empty [app/src/lib/i18n-provider.tsx:29-41] — fixed: effect returns early when nothing is stored
- [x] [Review][Patch] static-output tests: the all-or-nothing `built` flag silently skips every assertion on a partial export, and the 404 home-link check (`href="/"`) is satisfied by the header wordmark on every page [app/src/app/static-output.test.ts:19-25] — fixed: skip only when NEITHER artifact exists (partial export fails loudly); home-link assertion pinned to `notFound.homeLink`
- [x] [Review][Patch] Comment drift: bootstrap.ts says "ONE inline head script" while the script is deliberately body-first [app/src/lib/bootstrap.ts:5-6] — fixed alongside the literal-script rewrite; the comment now points at layout.tsx's placement rationale
- [x] [Review][Patch] `t()` production fallback: the double-miss branch (key absent in both locales → returns the raw key) was untested, and `console.error` fired on every call for the same key [app/src/lib/i18n.ts:47-53] — fixed: per-(locale,key) logged-once guard + a test covering double-miss and log suppression
- [x] [Review][Patch] Remove `aria-hidden="true"` from the empty header-search slot — an empty div needs no ARIA, and 2.14 mounting search inside it would create focusable-content-inside-aria-hidden [app/src/components/SiteHeader.tsx:75] — fixed: attribute removed

All decision + patch findings applied 2026-07-23; full chain re-verified green (`npm run build` + `npm test`, 68/68).
- [x] [Review][Defer] Home page body ignores the language toggle — `page.tsx` keeps server-side `t()`/`formatDecimal(…, DEFAULT_LOCALE)`, so toggling EN leaves the hub body Spanish while chrome/about/404 swap; the page is the disposable 2.1 scaffold and route content is Story 2.3/2.4 scope [app/src/app/page.tsx] — deferred, owned by the hub story
- [x] [Review][Defer] Client-import seam residual gaps — colocated client components under `src/app/**`, future client files under `src/lib/**`, and dynamic `import()` all escape the `no-restricted-imports` rule (acknowledged in the Dev Agent Record; both story-owned client bodies live in `src/components/` as mitigation) [app/eslint.config.mjs:74] — deferred, gap accepted by spec
- [x] [Review][Defer] Storage memory-fallback misses the asymmetric failure mode — when `setItem` throws but `getItem` works (e.g. quota exceeded), `writeStorage` stashes to memory yet `readStorage` returns authoritative `null` and ignores the copy, so the fallback provides no session continuity in the most common real-world storage failure [app/src/lib/storage.ts] — deferred, pre-existing (2.1 design, unchanged in this diff)

## Dev Notes

### Architecture constraints (binding)

- **AD-10 — state rules** [ARCHITECTURE-SPINE.md → Invariants & Rules]: "no global state library, no client cache layer. State lives in exactly three places: the URL …, localStorage (`wcstats.locale`, `wcstats.theme`, always behind try/catch with in-memory fallback), and ephemeral component state. React Context is allowed only for locale and theme." This story's two providers are the *only* sanctioned Contexts. No cookies (static site, no cookies per AD-13), no other storage keys.
- **AD-12 — i18n enforcement + first-paint** [spine, `[ASSUMPTION: mechanism]`]: strings only in typed dictionaries (`es.ts` canonical, `en.ts` type-mirrored), accessed only through `t()`; ESLint gate runs in the AD-13 chain because **`next build` does not lint in Next 16**. Bootstrap, verbatim: "pre-rendered Spanish HTML, one inline head script sets both `<html lang>`/locale class and the theme class (persisted override → `prefers-color-scheme` → dark canonical) before first paint; the string swap runs once, post-hydration."
- **AD-13 — build chain** [spine, `[ADOPTED]`]: `npm run build` = ESLint (`--max-warnings 0`) → typecheck → schema-version assert → `next build`, Node 24, publish `app/out`. No server functions, middleware, runtime env, analytics, or telemetry. Netlify serves the **static 404**.
- **Budgets**: no inline-script byte budget is pinned — only "one inline head script" under the Lighthouse ≥90 envelope (NFR-1). Keep it tiny and dependency-free anyway.
- **Privacy (NFR-9)**: locale/theme preference is client-side only; adding any tracking to chrome is a violation.

### UX contract (exact tokens & copy)

- **Site header** [DESIGN.md → Components → Site header; EXPERIENCE.md → Component Patterns → Site header]: "Slim bar on {colors.surface-base} with a hairline bottom rule: wordmark/home link in {typography.title}, header search, language toggle, theme toggle — in that order. No accent-colored chrome; no primary nav beyond the wordmark." Sticky on scroll `[ASSUMPTION: sticky]`. On `<md` (768px) the search collapses to an icon button — **slot placement only in this story**.
- **Language toggle** [DESIGN.md → Components → Language toggle; EXPERIENCE.md row]: "Segmented pill `ES | EN`, active segment {colors.accent-lime} fill with {colors.accent-lime-ink} text, inactive {colors.ink-secondary}", `{typography.label-caps}`, track `{rounded.full}`. Announces via polite live region: `"Idioma: Español"` / `"Language: English"`. Token-name reconciliation: design-token `accent-lime-ink` = built CSS var `--color-ink-on-lime` in `globals.css` (there is no `--color-accent-lime-ink`).
- **Theme toggle** [DESIGN.md → Components; EXPERIENCE.md → Theme toggle row]: "System-aware default, manual override persisted (`wcstats.theme`; same try/catch storage fallback as the locale). Dark is canonical. Pitch panels do not change with theme." Plain shadcn Toggle "used as-is with the mapped CSS variables; no visual delta beyond tokens."
- **Attribution footer** [DESIGN.md → Components → Attribution footer; EXPERIENCE.md → Attribution footer row + i18n & Terminology → Attribution (OQ-3)]: "one {typography.caption} line in {colors.ink-secondary} on {colors.surface-base}, hairline top rule, link to the about page in {colors.accent-cyan}. Present on every route." "Static line + link to `/about`. Not dismissible." Copy verbatim in Task 7.
- **404** [EXPERIENCE.md → State Patterns → Unknown route; IA route table]: "Static 404: 'Esta página no existe. ¿Buscabas un partido?' + link to `/` and the match list. [ASSUMPTION: static Netlify 404 page; no redirects.]" Only the es string is ruled; en must be authored.
- **Chrome-wide rules**: focus = global 2px `--ring` (accent-cyan) `:focus-visible`, never `outline: none` without replacement; Tab order = reading order, Enter/Space activate, Esc closes topmost overlay; touch targets ≥44×44px; `prefers-reduced-motion` kill-switch already global in `globals.css`; depth is tonal (no shadows except true overlays); gutters 16px `<md` / 24px `≥md`, content `max-w-6xl`; "Quiet chrome: charcoal, hairlines, muted labels" — no gradients/glows/accent chrome.

### Existing scaffold APIs (build on, do not restructure)

- **`src/lib/i18n.ts`** (server-safe, no `"use client"`): `t(key: DictionaryKey, locale: Locale = "es"): string` — typed dot-paths, currently **throws** on unresolvable key (Task 4 decision). `src/lib/i18n-provider.tsx` (client): `LocaleProvider({children, initialLocale?})`, `useLocale(): {locale, setLocale}`, `useT(): (key) => string`. `setLocale` exists; persistence/`<html lang>`/announcement wiring is this story's work.
- **`src/lib/storage.ts`**: `STORAGE_KEYS = { locale: "wcstats.locale", theme: "wcstats.theme" }`, `readStorage(key): string | null` (localStorage authoritative incl. null; memory fallback ONLY when localStorage throws), `writeStorage(key, value)`, `removeStorage(key)` (added in 2.1 review *for this story*). Do not reimplement storage in components; the inline head script is the one place that legitimately reads localStorage directly (it runs before modules load) — mirror the same key names and try/catch there.
- **Theme CSS** (`src/app/globals.css`, complete — do not touch tokens): dark canonical on `:root, .dark`, light on `.light`, `@custom-variant dark (&:where(.dark, .dark *))`, `color-scheme` per theme, `type-*` utilities, reduced-motion kill-switch, focus-visible outline. Switching theme = swapping the class on `<html>`, nothing more.
- **`src/app/layout.tsx`** current: `<html lang="es" className={["dark", archivo.variable, inter.variable].join(" ")}>` → `<body><LocaleProvider>{children}</LocaleProvider></body>`. No head scripts, no chrome. The hardcoded `"dark"` is the 2.1 stopgap this story replaces.
- **ESLint gate** (`eslint.config.mjs`): `react/jsx-no-literals` (`noStrings`, `ignoreProps: true`) + 4 `no-restricted-syntax` selectors covering gated props (regex incl. `label`, `message`, `caption`, `heading`, `tooltip`, extended `aria-*`) as literals/templates/binary/logical/conditional, and metadata objects. `src/locales/**` + `src/lib/contract/**` exempt. 13 lint-fixture tests in `src/lib/eslint-gate.test.ts` drive the real ESLint API.
- **Vendored shadcn pattern** (`src/components/ui/button.tsx`, `card.tsx`): reconciled to tokens (hairline borders, global ring focus), **no `shadcn` package dep** — core Tailwind variants only (`aria-*`, `data-[...]`, `has-data-[...]`). Follow this pattern when vendoring Toggle/ToggleGroup.
- **Versions (pinned)**: next `16.2.11`, react `19.2.8`, typescript `~6.0.3`, eslint `^9.39.5` (NOT 10.x — typescript-eslint incompat), tailwind `~4.3.3`, vitest `^3.2.7`, radix-ui `^1.6.5`. Node 24 (`.nvmrc`). Add no new runtime dependencies.

### Next 16 static-export specifics

- Inline pre-paint script: render a raw `<script dangerouslySetInnerHTML={{__html: …}}>` directly in the root layout's `<html>` (Next hoists/keeps it ahead of paint in the exported HTML; this is the standard theme-flash pattern). Do NOT use `next/script` `afterInteractive`/`lazyOnload` — too late.
- `suppressHydrationWarning` on `<html>` is required: the script mutates `lang`/`className` before React hydrates; React 19 would otherwise warn (and must not clobber the script's classes — suppression scopes to the element's attributes only).
- `not-found.tsx` at `src/app/` root → `out/404.html` under `output: 'export'`; `trailingSlash: true` is already set; Netlify picks up `404.html` automatically.
- The post-hydration swap: `LocaleProvider` must initialize state to `es` (matching server markup) and correct from storage in a mount effect — never read storage during render (SSG/hydration mismatch).

### Previous-story intelligence (2.1)

- i18n deliberately split server-safe (`i18n.ts`) vs client (`i18n-provider.tsx`) so metadata/server components don't drag the client bundle — preserve the split; the toggle UI consumes `useT()`/`useLocale()` only.
- 2.1 review hardened: storage never resurrects deleted keys; format helpers fail loudly (irrelevant here but don't "soften" them); `--ink-on-cyan` light = `#FFFFFF` ratified in DESIGN.md; `focus-ring-on-pitch` `#EAFBFD` both themes (pitch is out of chrome scope — do not touch).
- Known failure mode called out in the epic (twice): i18n/theme foundations are never retrofitted. This story is the retrofit-prevention payoff — wire the runtime, don't rebuild the foundation.
- Coordination: stories 1.5/1.6 are in flight in other sessions touching `pipeline/` — **this story touches `app/` (and its story/status files) only**.

### Boundaries — what NOT to build

- **2.14 Header Search**: everything interactive about search (typeahead, Command panel, collator, `<md` sheet). 2.2 = slot + placement only.
- **2.18 Glossary & About**: full `/about` statement, methodology, credits, `/glossary`, tooltips, terminology completion. 2.2 = footer line + minimal `/about` attribution stub only.
- **2.4+ pages**: route content, per-route `<title>`/OG, skeleton/`aria-busy`/"Datos cargados." loading pattern. 2.2 owns only the shell.

### Project Structure Notes

- New files: `src/components/SiteHeader.tsx`, `src/components/AttributionFooter.tsx`, `src/components/ui/toggle*.tsx` (vendored, if used), `src/lib/bootstrap.ts` (+ `.test.ts`), `src/lib/theme-provider.tsx` (or co-locate with i18n-provider pattern), `src/app/not-found.tsx`, `src/app/about/page.tsx`, tests co-located.
- Modified: `src/app/layout.tsx` (script, providers, shell, suppressHydrationWarning), `src/lib/i18n-provider.tsx` (persistence + lang + live region), `src/lib/i18n.ts` (only if Task 4 changes the throw policy), `src/locales/es.ts` + `en.ts`, `eslint.config.mjs` (only if Task 4 adds the import rule).
- Component files PascalCase; routes stay within the architecture seed list (`/`, `/matches/[slug]`, `/players/[slug]`, `/teams/[slug]`, `/compare`, `/glossary`, `/about`).

### Testing standards

- vitest 3.2.7, `npm test` (`vitest run`), co-located `src/**/*.test.{ts,tsx}`, `@` → `src`. Suite is 41 green pre-story; it must stay green plus new coverage. `environment: "node"` — see Task 10 for the component-testing constraint. Lint-fixture tests use the real `ESLint` API (30s timeout pattern in `eslint-gate.test.ts`).

### Open items to record in Dev Agent Record (do not silently resolve)

1. Authored (unruled) copy: en 404 string, skip-link es/en, any toggle aria-labels — flag for UX review.
2. ARIA pattern chosen for the ES|EN segmented control (unruled; radio-group vs toggle-group default).
3. Sticky header z-index value (no ruled scale).
4. Task 4 decisions: throw-vs-fallback policy + client-import seam mechanism.
5. `/about` stub scope note (2.18 replaces).

### References

- Story spec: [_bmad-output/planning-artifacts/epics.md → Story 2.2, lines ~638-661; Epic 2 intro]
- Requirements: [prds/prd-wc-stats-2026-07-21/prd.md → FR-30, FR-31, FR-33, NFR-1, NFR-2, NFR-9, NFR-10, OQ-3]
- Architecture: [architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md → AD-10, AD-11, AD-12, AD-13, Structural Seed, Consistency Conventions, Stack]
- UX: [ux-designs/ux-wc-stats-2026-07-21/DESIGN.md → Components (Site header, Language toggle, Theme toggle, Attribution footer), frontmatter tokens, Elevation, Layout & Spacing, Do/Don't] and [EXPERIENCE.md → Component Patterns (Site header, Language toggle, Theme toggle, Attribution footer), State Patterns (Unknown route, Focus), Accessibility Floor, Interaction Primitives, i18n & Terminology (Attribution OQ-3, Locale bootstrap)]
- A11y rulings: [ux-designs/…/review-accessibility.md → §4 language-switch announcement (folded into EXPERIENCE.md), §3 skip-link verified]
- Previous story: [_bmad-output/implementation-artifacts/2-1-static-app-scaffold-with-design-tokens-i18n-structure-build-gates.md → Dev Agent Record, Review Findings]
- Deferred decisions assigned here: [_bmad-output/implementation-artifacts/deferred-work.md → t() boundary hardening (from 1-6 + 2.1 reviews)]

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Code)

### Debug Log References

- Red-green cycle per task: bootstrap tests failed on missing module → implemented; t() production-fallback tests failed against the throw-always guard → implemented; seam lint-fixtures failed before the `no-restricted-imports` override existed → added.
- The i18n lint gate (selector 3) flagged two of my own first attempts — a key ternary *inside* `t()` (`t(cond ? "k1" : "k2")`) and a `theme === "dark"` comparison literal inside a gated `aria-label`. Fixed by the tested-legal shape (`cond ? t("k1") : t("k2")`) with the comparison hoisted to a local. The gate works as designed; not fought.
- `eslint-config-next` 16 ships react-hooks v6's `set-state-in-effect`, which flags the deliberate post-hydration setState sync in both providers. Scoped `eslint-disable-next-line` with rationale on exactly those two lines: initializing state from storage/DOM during render is precisely the SSG hydration mismatch AD-12 forbids, and the one-render swap is the AD-12-mandated behavior (same pattern as next-themes).
- Exported-HTML test first compared the script text verbatim and failed: the production bundle embeds the *minified* `Function.prototype.toString` source. Test now identifies the executable script structurally (and excludes the escaped RSC flight-payload copy).
- One EBUSY build failure was environmental: the local static server used for browser verification held `out/` open. Not a code issue; re-ran clean.

### Completion Notes List

- **Task 1 — pre-paint bootstrap**: `src/lib/bootstrap.ts` exports `resolveTheme(stored, prefersDark)` (persisted override → `prefers-color-scheme` → dark canonical; `prefersDark: null` = matchMedia unavailable), `resolveLocale(stored)` (persisted valid → it, else `es`), `localeClass()`, and `bootstrapScript`. The script string embeds the pure functions' own source via `toString()` at module-eval time and interpolates `STORAGE_KEYS`, so script and tested logic **cannot** drift; a test evaluates the script string against stubbed `document`/`localStorage`/`matchMedia` and cross-checks the full input matrix against the pure functions. All storage/matchMedia reads in the script are try/catch; `classList` add/remove preserves the `next/font` variable classes.
- **Script placement**: rendered as the FIRST element inside `<body>` (not a direct child of `<html>`): React would reparent an html-level child anyway and the browser parser moves such content into body start; a synchronous inline script ahead of all body content executes before first paint (verified: no dark flash for a `wcstats.theme=light` visitor; position asserted in `static-output.test.ts`). `suppressHydrationWarning` on `<html>`, hardcoded `"dark"` removed — canonical server markup is `lang="es"` + font classes only, dark via `:root`.
- **Task 2 — ThemeProvider** (`src/lib/theme-provider.tsx`): initial state `dark` matches server markup; mount effect syncs from the `<html>` class (the script's verdict — storage is never re-read with second-guessed logic). Two-state toggle persisting the explicit choice (revert-to-system not required by ACs). `color-scheme` untouched (already per theme class in globals.css).
- **Task 3 — locale wiring**: `LocaleProvider` mount effect performs the single post-hydration swap from `readStorage`. Deliberate deviation from the subtask letter: the mount sync sets React state directly instead of calling `setLocale` — the pre-paint script already set `<html lang>`/class from identical logic, and restoring a persisted preference is not a user action, so it must not announce or re-persist. User-invoked `setLocale` persists, updates `<html lang>` + locale class, and announces in the **target** language ("Idioma: Español"/"Language: English") via a persistent visually-hidden `aria-live="polite"` region rendered by the provider.
- **Task 4 decisions (recorded per story instruction)**: (a) **throw-vs-fallback**: production resolves a missing key to the canonical `es` value, else the key itself, with `console.error`; dev/test keep the throw (`process.env.NODE_ENV` gate — statically replaced in Next bundles). The es-value branch is compile-time-unreachable today (en is type-mirrored) and covered by a test that breaks the leaf at runtime. (b) **client-import seam**: ESLint `no-restricted-imports` override on `src/components/**` barring the `t` binding from `@/lib/i18n` (alias path + `**/lib/i18n` relative pattern); type-only `DictionaryKey`/`Locale` imports and provider imports stay legal; `src/app/**` and server components keep direct `t()`. 5 lint-fixture regression tests added in `eslint-gate.test.ts`. Residual gap (noted, accepted): a client component colocated under `src/app/` would escape the mechanical rule — both story-owned client bodies (`AboutContent`, `NotFoundContent`) therefore live in `src/components/`.
- **Task 5 — header**: `SiteHeader` sticky slim bar (h-14 accommodates ≥44px targets), hairline bottom rule, order wordmark → search slot → ES|EN → theme toggle. Search slot is a non-interactive placeholder div (`data-slot="header-search-slot"`, `aria-hidden`) reserving the flexible middle region incl. where 2.14's `<md` icon button will sit. Toggle/ToggleGroup vendored from shadcn into `src/components/ui/` reconciled to tokens (no `outline-none`, global `--ring` focus, `border-hairline`, core Tailwind variants only, no new deps). **ARIA pattern (open item 2)**: Radix ToggleGroup `type="single"` accessible default kept — `role="radiogroup"`/`role="radio"` + `aria-checked` (verified in-browser); segments additionally carry full-name `aria-label`s ("Español"/"English"). Theme toggle is the vendored shadcn Toggle as-is with `aria-label` via `t()` and inline hand-drawn sun/moon SVGs (`aria-hidden`; no icon package installed). **z-index (open item 3)**: header `z-40`, focused skip link `z-50`; no other z values introduced.
- **Task 6 — skip link + shell**: skip link is the first focusable element (rendered by `SiteHeader` ahead of `<header>`), `sr-only` until `:focus`, targets `<main id="main-content" tabIndex={-1}>` now owned by the root layout (`flex min-h-screen flex-col` body, `flex-1` main, footer pinned). `page.tsx`'s placeholder `<main>` became a `<div>` (the layout owns `<main>` now — nested `<main>` is invalid); this file was not in the story's modified-files list but the change is forced by shell assembly and is confined to the disposable scaffold page.
- **Task 7 — footer + /about stub**: `AttributionFooter` renders the ruled es/en copy verbatim, `type-caption`/`ink-secondary`, hairline top rule, accent-cyan `/about` link, no dismiss affordance, on every route via the layout. `/about` stub renders title + the same attribution locale key only (**open item 5**: 2.18 replaces/expands it).
- **Task 8 — 404**: `src/app/not-found.tsx` → `out/404.html` (verified present, ruled Spanish copy, chrome inherited, link to `/`). Body renders through `NotFoundContent` (`useT()`), so the authored en string is reachable — verified in-browser with a stored `en` preference.
- **Task 9 — strings**: all new copy in `es.ts` first, `en.ts` type-mirror; register tuteo/no exclamations. Full chain green: `npm run build` (eslint --max-warnings 0 → tsc → assert-schema-version → next build → copy-data) and `npm test`.
- **Task 10 — tests**: 26 new tests (suite 41 → 67, all green). Component-testing choice: **no jsdom devDependency** — the lightest honest option per the story; behavior lives in pure functions (bootstrap matrix incl. script-string evaluation), storage round-trip (incl. no-resurrection and stale-memory-vs-recovered-storage), t() policy, 5 seam lint-fixtures, and exported-HTML assertions (`static-output.test.ts`, skipIf `out/` absent — build precedes test in the verification chain). Interactive behavior was additionally verified end-to-end in a real browser (console clean = no hydration warnings; toggle → persist → reload → 404/about swap).
- **Open item 1 — authored (unruled) copy flagged for UX review**: en 404 string ("This page does not exist. Were you looking for a match?"), 404 home-link label (es "Volver al inicio"/en "Back to home"), skip link (es "Saltar al contenido"/en "Skip to content"), theme-toggle aria labels (es "Cambiar a tema claro/oscuro"), language-toggle group label (es "Idioma"/en "Language") and per-segment full names, footer about-link text (es "Acerca del sitio"/en "About this site"), about-page title (same). All ruled copy (attribution, 404 es message, announcements) is verbatim.

### File List

New:
- app/src/lib/bootstrap.ts
- app/src/lib/bootstrap.test.ts
- app/src/lib/theme-provider.tsx
- app/src/lib/storage.test.ts
- app/src/components/SiteHeader.tsx
- app/src/components/AttributionFooter.tsx
- app/src/components/AboutContent.tsx
- app/src/components/NotFoundContent.tsx
- app/src/components/ui/toggle.tsx
- app/src/components/ui/toggle-group.tsx
- app/src/app/not-found.tsx
- app/src/app/about/page.tsx
- app/src/app/static-output.test.ts

Modified:
- app/src/app/layout.tsx
- app/src/app/page.tsx
- app/src/lib/i18n.ts
- app/src/lib/i18n-provider.tsx
- app/src/lib/i18n.test.ts
- app/src/lib/eslint-gate.test.ts
- app/src/locales/es.ts
- app/src/locales/en.ts
- app/eslint.config.mjs
- _bmad-output/implementation-artifacts/2-2-site-chrome-header-language-theme-toggles-footer-404.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-23: Story 2.2 implemented — pre-paint locale/theme bootstrap (script generated from tested pure functions), Theme/Locale providers with persistence + polite live-region announcement, t() production-fallback policy + client-import ESLint seam (deferred Task 4 decisions resolved), site header (wordmark, search slot, ES|EN radiogroup toggle, theme toggle), skip link + shell assembly, attribution footer + minimal /about stub, static 404. Build chain green; tests 41 → 67. Status → review.
- 2026-07-23: Code review — 2 decisions resolved (theme toggle → stable name + aria-pressed; bootstrap script → checked-in ES5 literal), 6 patches applied (mount-sync lang re-assertion, initialLocale guard, static-output gate hardening, comment drift, t() logged-once + double-miss test, search-slot aria-hidden removed), 3 items deferred to deferred-work.md, 9 findings dismissed. Tests 67 → 68, chain green. Status → done.

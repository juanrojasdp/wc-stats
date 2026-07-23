---
baseline_commit: 41f28e0a0ec6929603fa78713c67c8961c30cd51
---

# Story 2.1: Static App Scaffold with Design Tokens, i18n Structure & Build Gates

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created (2026-07-23). -->

## Story

As the builder,
I want a deployable Next.js static-export scaffold with the full token/theme system, typed locale dictionaries, generated contract types, and the complete build-gate chain,
So that every subsequent story inherits i18n, theming, and contract safety mechanically instead of retrofitting them (FR-30, FR-33 foundation).

## Acceptance Criteria

1. **Given** the `app/` workspace
   **When** the scaffold is created
   **Then** Next.js 16.2.x is configured with `output: 'export'` and `images: { unoptimized: true }`, Tailwind 4.3.x + vendored shadcn components, and Archivo + Inter self-hosted via `next/font` with zero external requests (AR-11, AR-15)
   **And** the full DESIGN.md token set is implemented: shadcn CSS-variable mapping (dark canonical `:root`/`.dark`, light variants), data-viz palette tokens, typography ramp with mandatory `tabular-nums` utilities, spacing/radii tokens, tonal elevation (UX-DR1, UX-DR2).

2. **Given** the i18n structure (AD-12)
   **When** the locale layer is created
   **Then** `locales/es.ts` (canonical) and `locales/en.ts` (type-mirrored — a missing key is a compile error) exist with the `t()` accessor, and `Intl`-based number/date formatting helpers (`es-CO`/`en`) are the only formatting path (FR-30, UX-DR19)
   **And** the ESLint gate (`react/jsx-no-literals` with `noStrings` + attribute coverage for aria/title, plus `no-restricted-syntax` for metadata strings) fails the build on any hardcoded user-facing string.

3. **Given** the contract (AD-2)
   **When** the build chain runs
   **Then** TypeScript types + the `SCHEMA_VERSION` constant are generated from `/contract` (never hand-written mirrors), and `npm run build` = ESLint (`--max-warnings 0`) → typecheck → schema-version assert against every artifact read → `next build` on Node 24 (AR-13)
   **And** the build copies `/data` (fixtures for now) into the export output and the site deploys to Netlify free tier as-is — no functions, middleware, env vars, or analytics (FR-33, NFR-8, NFR-9).

## Tasks / Subtasks

- [x] Task 1: Create the `app/` workspace (AC: #1, #3)
  - [x] 1.1 `app/` is a self-contained npm package (no root package.json, no npm workspaces — mirrors the existing `contract/` precedent). `"type": "module"`, `"private": true`, `engines.node: ">=24"`. Commit `package-lock.json` (AR-15).
  - [x] 1.2 Pin `.nvmrc` (or `.node-version`) with `24` at `app/` (Netlify honors it; Node 24 is Netlify's default since 2026-07-07 — pin anyway).
  - [x] 1.3 Install exact stack (versions verified current 2026-07-23; see Dev Notes → Verified stack): `next@16.2.11`, `react@19.2.x`, `typescript@6.0.x`, `tailwindcss@~4.3.3` + `@tailwindcss/postcss`.
  - [x] 1.4 `next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true` (folder-style URLs map cleanly to Netlify static hosting). NOTE: Next 16 removed the `eslint` key from next.config and `next build` never lints — the gate lives in the npm script chain (Task 6).
  - [x] 1.5 `tsconfig.json` strict; alias `@/*` → `src/*`. App source lives under `app/src/` per the architecture Structural Seed.
  - [x] 1.6 Minimal `src/app/layout.tsx` + `src/app/page.tsx` placeholder route proving the stack end-to-end: `<html lang="es" class="dark">`, fonts applied, one token-styled element, all copy via `t()`. Keep it disposable — Story 2.2 builds the real chrome.

- [x] Task 2: Fonts — Archivo + Inter self-hosted via `next/font` (AC: #1)
  - [x] 2.1 `next/font/google`: `Archivo({ subsets: ['latin'], variable: '--font-archivo' })`, `Inter({ subsets: ['latin'], variable: '--font-inter' })` — omit `weight` (both are variable fonts). Fonts download at build time and ship from `/_next/static/media/` — zero runtime requests to Google. Attach both `.variable` classes on `<html>`.
  - [x] 2.2 Verify post-export: `out/` contains the woff2 files and no HTML/CSS references `fonts.googleapis.com` / `fonts.gstatic.com` or any external origin (Task 8.4).

- [x] Task 3: Design-token layer — full DESIGN.md token set (AC: #1)
  - [x] 3.1 `src/app/globals.css`: `@import "tailwindcss";` then define ALL tokens from Dev Notes → Design tokens as CSS variables: dark canonical on `:root` (and `.dark`), light variants on `.light` (theme class set on `<html>`; class-based dark via `@custom-variant dark (&:where(.dark, .dark *));`). Scaffold default: `class="dark"` hardcoded in layout — the pre-paint theme script is Story 2.2.
  - [x] 3.2 Map shadcn variables per the DESIGN.md mapping table (Dev Notes → shadcn CSS-variable mapping): `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--border`, `--input`, `--ring`, `--destructive`. Unlisted shadcn vars keep shadcn defaults.
  - [x] 3.3 Data-viz palette tokens (theme-invariant where noted): pitch surface/stripe/line, viz-team-a/b (+light), viz-neutral (+light), viz-single (alias of viz-team-a), all five shot outcomes (+light variants), `focus-ring-on-pitch: #EAFBFD`, edge-weight-1..5, heat-1..5, result chips (+light, + chip-ink pair).
  - [x] 3.4 Register token namespaces in `@theme inline` so utilities generate (`--font-*` from the next/font variables, `--color-*`, `--radius-*`, named `--spacing-*`: gutter-mobile 16px, gutter-desktop 24px, tile-gap 12px, section-gap 48px, layer-gap 64px). Radii: sm 4px / md 8px / lg 12px / full 9999px.
  - [x] 3.5 Typography ramp utilities (see Dev Notes → Typography ramp): display-score, display-stat, headline (Archivo); title, body, table-numeric, stat-label, label-caps, caption (Inter). Sizes px-specified but implemented in rem. Provide a `tabular-nums` utility (`font-variant-numeric: tabular-nums`) and apply it in every numeric ramp entry (stat-value, table-numeric, display-score, display-stat). No type below 11px.
  - [x] 3.6 Tonal elevation: no shadows except true overlays — dark `0 8px 24px rgba(0,0,0,0.35)`, light `0 4px 16px rgba(21,25,29,0.12)` as tokens. Global baseline CSS: `prefers-reduced-motion` kills all animation/transition/smooth-scroll; focus-visible ring via `--ring` everywhere (never `outline: none` without replacement).

- [x] Task 4: Vendored shadcn (AC: #1)
  - [x] 4.1 `npx shadcn@latest init` (Tailwind v4 registry, CSS-first) then vendor a starter set only (e.g. `button`, `card`) into `src/components/ui/` — components are copied source, committed, no registry runtime dep. Expected deps: unified `radix-ui` package (since 2026-02), `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`. Skip `lucide-react` unless a placeholder needs it.
  - [x] 4.2 Reconcile the init-generated CSS with Task 3 so DESIGN.md values win — one token source of truth in `globals.css`.

- [x] Task 5: Typed locale layer + Intl helpers (AC: #2)
  - [x] 5.1 `src/locales/es.ts` — canonical dictionary, `as const`-style source of truth exporting its type (e.g. `export type Dictionary = typeof es` shape with string leaves). Seed the key structure per Dev Notes → Locale key seeding (app.*, a11y.*, meta.*, placeholder content for the scaffold page). Spanish register: tuteo, neutral LatAm, no exclamation marks.
  - [x] 5.2 `src/locales/en.ts` — typed `const en: Dictionary = {...}`: a missing or extra key is a **compile error** (this is the AD-12 mirror mechanism; prove it in Task 8).
  - [x] 5.3 `t()` accessor in `src/lib/i18n.ts` — the only read path into dictionaries; typed key access (nested-object access or dot-path — dev's call, but keys must stay statically typed end-to-end). Locale state via React Context (AD-10 allows Context only for locale + theme); scaffold default `es`. Toggle UI/persistence/head-script are Story 2.2 — do NOT build them here; the provider just needs a settable locale value.
  - [x] 5.4 `src/lib/format.ts` — the ONLY formatting path (AD-7, UX-DR19): `Intl.NumberFormat('es-CO'|'en')` (es-CO: comma decimals — xG `1,24`, `10,4 km`; `62%` with NO space before % — deliberate logged choice vs RAE), `Intl.DateTimeFormat` (es: `21 de julio de 2026`, lowercase months; en: `July 21, 2026`), kickoff = venue-local time using the artifact's ISO 8601 + UTC offset, and `Intl.Collator('es', { sensitivity: 'base' })` for ALL text sort/match (never default string compare).
  - [x] 5.5 Locale-neutral inputs only: artifacts carry raw numerics / ISO dates / enum codes (AD-7); enum→label maps and unit labels are locale-layer metadata keyed by code — seed the structure (empty maps fine), content lands per-surface in later stories.

- [x] Task 6: ESLint gate + build chain (AC: #2, #3)
  - [x] 6.1 Flat config `eslint.config.mjs` with `eslint-config-next` (flat-native in v16). Use ESLint 10.x if `eslint-config-next@16.2`'s peer range allows (ESLint 9.x hits EOL 2026-08-06); else pin latest 9.x and log it.
  - [x] 6.2 Hardcoded-string gate as **error**: `react/jsx-no-literals` with `{ noStrings: true, ignoreProps: false, noAttributeStrings: true }` + `no-restricted-syntax` selectors covering JSXAttribute literals for `aria-*`/`title`/`alt`/`placeholder` (incl. expression-container literals) and `metadata` object `title`/`description` properties (see Dev Notes → ESLint selectors). Scope to `src/**`; exempt `src/locales/**` and `src/lib/contract/**` (generated files already carry `/* eslint-disable */`).
  - [x] 6.3 `npm run build` = `eslint --max-warnings 0` → `tsc --noEmit` → `node scripts/assert-schema-version.mjs` → `next build` (AR-13 order, exactly). `next build` runs Turbopack by default in v16 — fine for export.
  - [x] 6.4 `scripts/assert-schema-version.mjs`: read `SCHEMA_VERSION` from the generated `src/lib/contract/schema-version.ts` output, read `../contract/version.json`, walk **every** `*.json` artifact under the data tree being shipped (fixtures now) and assert each `schemaVersion === SCHEMA_VERSION` === `version.json` — mismatch exits non-zero with file + values (FR-20). Pure Node built-ins, no deps, so it runs on Netlify without touching `contract/node_modules`.

- [x] Task 7: Contract types + data copy + Netlify (AC: #3)
  - [x] 7.1 Generate types by **re-pointing the existing generator** — `node ../contract/scripts/generate-types.mjs src/lib/contract` (output dir is already a parameter; instruction is written into the script header and contract/README). NEVER write a second generator or hand-typed mirrors. Commit the generated `contract-types.d.ts` + `schema-version.ts`; add app npm scripts `generate:types` and `check:types` (drift guard `--check`) that delegate to the contract script. `check:types` runs dev-machine (needs `contract/node_modules`, like pytest per AD-13); the Netlify chain relies on committed output + 6.4's dependency-free assert.
  - [x] 7.2 Data copy: build copies the repo `/data` tree verbatim into `out/data/` (post-`next build` step in the build script; or `public/`-based copy — dev's call, but the export must contain `data/`). Define ONE build-time constant `DATA_ROOT = '/data/fixtures'` in `src/lib/data.ts` (single flip point → `'/data'` at Story 2.19 real-data swap; runtime env vars are banned). Same-origin `fetch` helpers keyed off it (AD-10) — full fetch usage lands in later stories; scaffold ships the helper + constant.
  - [x] 7.3 `netlify.toml` at repo root: `[build] base = "app"`, `command = "npm run build"`, `publish = "out"` (→ `app/out`, AD-13). Set `NETLIFY_NEXT_PLUGIN_SKIP = "true"` in build env so Netlify's auto-detected Next runtime plugin does NOT hijack the deploy — pure static publish only. No `[[plugins]]`, no functions, no redirects, no env-dependent behavior, no analytics (NFR-8, NFR-9).

- [x] Task 8: Prove the gates + tests (AC: #1–#3)
  - [x] 8.1 Minimal vitest setup (harness choice is the epic's call per AR-16 — vitest 3.x, node environment; Playwright/Lighthouse deferred to 2.19). Unit tests: format helpers (es-CO `1,24` / `62%` / lowercase month; en `1.24`; collator treats `Á` = `a`), `t()` returns es/en per active locale, assert-schema-version passes on current fixtures and fails on a tampered copy.
  - [x] 8.2 Negative gate proofs, recorded in Completion Notes (temporary edits, then reverted): (a) hardcoded JSX string → `eslint` fails; (b) hardcoded `aria-label="x"` → fails; (c) delete a key from `en.ts` → `tsc` fails; (d) bump a fixture's `schemaVersion` → assert step fails.
  - [x] 8.3 Full `npm run build` green on Node 24; `out/` contains every route pre-rendered, `out/data/fixtures/**` present, `out/404.html` emitted (Next default export behavior; real 404 content is Story 2.2).
  - [x] 8.4 Zero-external-request audit: grep `out/**` HTML/CSS/JS for `https?://` third-party origins — none allowed (fonts self-contained per Task 2.2).
  - [x] 8.5 Deploy-readiness check: `npx serve out` (or equivalent) — placeholder route renders dark-canonical with tokens + fonts. Actual Netlify account hookup is optional for this story; the AC is "deployable as-is", proven by config + local static serve.

## Dev Notes

### Hard boundaries (violating any of these fails review)

- **AD-1:** the app consumes ONLY `/contract` and `/data`. No imports from `pipeline/`, no pipeline knowledge, nothing presentational expected from artifacts.
- **AD-2:** types are GENERATED from `/contract` — never hand-written mirrors, never a second generator. `SCHEMA_VERSION` comes from the generated constant, never hardcoded `1`.
- **AD-7:** artifacts are raw + locale-neutral (camelCase keys, ISO 8601, enum codes). ALL formatting through `src/lib/format.ts` `Intl` helpers; ALL strings through `t()`.
- **AD-10:** state = URL + localStorage (`wcstats.locale`, `wcstats.theme`, try/catch + in-memory fallback) + ephemeral only. React Context ONLY for locale and theme. No state library, no client cache.
- **AD-12:** `es.ts` canonical, `en.ts` type-mirrored (missing key = compile error), `t()` the only accessor, ESLint gate in the build chain (Next 16's `next build` does not lint — the chain must).
- **AD-13:** build chain order is fixed: ESLint `--max-warnings 0` → typecheck → schema-version assert → `next build`, on Node 24. `/data` copied into export. Netlify publishes `app/out` statics only — no functions/middleware/env/analytics.
- **NFR-7:** code, comments, docs in English; user-facing copy only via locales.

### Repo ground truth (verified 2026-07-23)

- **No `app/` exists.** No root package.json, no workspaces. The only JS tooling is `contract/` (own package.json, `"type": "module"`, json-schema-to-typescript 15.0.4 installed). Root `.gitignore` already ignores `node_modules/` globally.
- **Contract (Story 1.1, DONE):** 6 schemas in `contract/` (`common`, `match-bundle`, `tournament`, `leaderboards`, `team-profile`, `player-profile`) + `contract/version.json` = `{ "schemaVersion": 1 }`. Draft 2020-12 `$schema` but authored in the draft-07-compatible subset; `title` on every def (drives TS names); `additionalProperties: false` everywhere; cross-file `$ref` like `"common.schema.json#/$defs/TeamId"`; nullable via `anyOf [..., {"type":"null"}]`.
- **Generator (REUSE):** `contract/scripts/generate-types.mjs`, invocation `node scripts/generate-types.mjs [outDir]` (default `contract/generated/`), `--check` mode for drift. Uses namespace import (`import * as jst` — package is CJS without exports map), options `{ cwd: CONTRACT_DIR, additionalProperties: false, bannerComment: "", declareExternallyReferenced: true, enableConstEnums: false, unreachableDefinitions: true }`, dedupes re-emitted shared types, refuses output containing index signatures or collision-suffixed names (`Foo1`). Emits `contract-types.d.ts` (~237 declarations) + `schema-version.ts` (`export const SCHEMA_VERSION = 1;`). Output canonical UTF-8/LF.
- **Fixtures (`data/fixtures/`, committed, never regenerated by the app):** `matches/m001-mexico-south-africa.json` (group, momentum series), `matches/m002-korea-republic-czechia.json` (momentum `null` → empty-state case), `matches/m074-germany-paraguay.json` (knockout ET+shootout, own goal, ShootoutAttempt rows; 197 KiB largest), `index/tournament.json`, `index/leaderboards.json`, `index/team-profiles/mexico.json`, `index/player-profiles/quinones-julian-mex.json`. All stamped `schemaVersion: 1`.
- **Contract semantics the app must respect (from 1.1):** nullable sections mean "not in report", `[]` means "zero events" — different renderings later; phase %/defensive-block shares are NOT distributions (never stacked-bar); per-shot xG may be `null`; `momentum` is required (series or `null`, never omitted/`[]`).
- **Known gaps (do not solve here):** no fixture for ET-only knockout (`decidedBy: "extra-time"`) or zero-appearance player — deferred to 1.18/2.3 per `deferred-work.md`. `tournament.schema.json` has no top-level `stages` collection (per-match `Stage` enum instead) — any Hub need surfaces at Story 2.3 sign-off.

### Verified stack (web-verified 2026-07-23; pin these)

| Package | Pin | Gotchas |
|---|---|---|
| next | 16.2.11 | Turbopack default for dev+build; `next lint` REMOVED, `eslint` key removed from next.config; async `params`/`searchParams` (Promise) enforced; `generateStaticParams` required per dynamic route (none in this story); `trailingSlash: true` recommended for static hosts |
| react / react-dom | 19.2.x | AR-15 pin |
| typescript | 6.0.x | bridge release (AR-15); keep deprecation warnings clean for the 7.0 move |
| tailwindcss | ~4.3.3 | CSS-first: `@import "tailwindcss"` + `@theme`; NO tailwind.config file; PostCSS plugin = `@tailwindcss/postcss`; class dark via `@custom-variant dark (&:where(.dark, .dark *));`; `@theme inline` for tokens referencing other vars (next/font) |
| eslint | 10.x preferred | 9.x EOL 2026-08-06; `eslint-config-next` is flat-config-native; check peer range, log the choice |
| eslint-plugin-react | ~7.37.x | for `react/jsx-no-literals` (ships via eslint-config-next; verify version) |
| json-schema-to-typescript | 15.0.4 | already installed in `contract/` — app does NOT install it; no real 2020-12 support (why the contract sticks to the draft-07-compatible subset) |
| shadcn CLI | latest (`npx shadcn@latest`) | Tailwind v4 + React 19 native; unified `radix-ui` package (2026-02); `tw-animate-css` not `tailwindcss-animate` |
| vitest | 3.x | minimal; harness call logged per AR-16; Playwright/Lighthouse CI → Story 2.19 |
| Node | 24 (LTS "Krypton", maint. to 2028-04) | Netlify default since 2026-07-07; pin via `.nvmrc` anyway |

### Design tokens — the full DESIGN.md set (values are normative; DESIGN.md wins on conflict)

**Canvas & ink** (dark canonical / light variant): surface-base `#0E1114`/`#F5F7F8` · surface-raised `#171B1F`/`#FFFFFF` · surface-overlay `#1F252B`/`#EDF0F2` · ink-primary `#F2F5F7`/`#15191D` · ink-secondary `#A7B0B8`/`#4B555E` · ink-muted `#6B757F`/`#5F6970` (**restricted: disabled states + ≥3:1 non-text glyphs only — fails 4.5:1 for text on dark**) · border-hairline `#2A3138`/`#DCE1E5` (the ONLY divider weight).

**Brand accents:** accent-lime `#C3F53C` (light `#3F6212`; ink-on-lime `#131A02`) → shadcn `--primary` · accent-cyan `#3DDBE8` (light `#0E7490`; ink-on-cyan `#062226`) → shadcn `--ring`, links, active sort, glossary underline · destructive `#F0708A`/`#C22D50` (errors only, never "losing team").

**shadcn CSS-variable mapping** (dark canonical / light; unlisted vars keep shadcn defaults):

| var | dark | light |
|---|---|---|
| `--background` / `--foreground` | `#0E1114` / `#F2F5F7` | `#F5F7F8` / `#15191D` |
| `--card`, `--muted` | `#171B1F` | `#FFFFFF` |
| `--muted-foreground` | `#A7B0B8` | `#4B555E` |
| `--popover` | `#1F252B` | `#EDF0F2` |
| `--primary` / `--primary-foreground` | `#C3F53C` / `#131A02` | `#3F6212` / `#FFFFFF` |
| `--secondary`, `--accent` | `#1F252B` | `#EDF0F2` |
| `--border`, `--input` | `#2A3138` | `#DCE1E5` |
| `--ring` | `#3DDBE8` | `#0E7490` |
| `--destructive` | `#F0708A` | `#C22D50` |

**Data-viz palette** (theme-invariant unless a `-light` variant exists; pitch + ramps render only on the pitch and carry a single value): pitch-surface `#0B3D2E` · pitch-stripe `#0E4634` · pitch-line `#4C9B72` · viz-team-a `#C3F53C` (light-canvas `#4D7C0F`) · viz-team-b `#3DDBE8` (light `#0E7490`) · viz-neutral `#8C979F` (light `#5F6970`) · viz-single = alias of viz-team-a (deliberate, single-series only) · shot-goal `#3FDD85` (light `#177245`) · shot-on-target `#63C8F5` (light `#155E8F`) · shot-off-target `#F5B63C` (light `#7A5200`) · shot-blocked `#C9A1F5` (light `#6D28D9`) · shot-incomplete `#7C9BF7` (light `#3346C2`) · **focus-ring-on-pitch `#EAFBFD`** (near-white, BOTH themes — the light `--ring` cyan fails 3:1 on the pitch; note: final DESIGN.md supersedes review-accessibility.md's interim `#3DDBE8` suggestion) · edge-weight-1..5 `#5A9E78 #7DB56E #A3CC60 #C9E455 #EEFB4E` · heat-1..5 `#4E9E52 #6FB44F #93C44B #C4DE4F #EEF9A3` · result-win `#65D98A` (light `#1E7A43`) · result-draw `#8C979F` (light `#5F6970`) · result-loss `#F0708A` (light `#C22D50`) · result-chip-ink `#0E1114` (on-light `#FFFFFF`).

Pitch panels are theme-invariant (deep green in both themes) and carry a border-hairline border in dark theme only (light canvas is its own edge). One color = one meaning per viz — the token names are the enforcement surface.

**Typography ramp** (px-specified, implement in rem; `tabular-nums` in every aligned-numeric entry):

| token | family | size/weight/lh | extras |
|---|---|---|---|
| display-score | Archivo | 44px / 800 / 1.0 | ls −0.01em; once per Match Dashboard |
| display-stat | Archivo | 30px / 700 / 1.05 | |
| headline | Archivo | 22px / 700 / 1.2 | section headings |
| stat-value | Archivo | 26px / 700 / 1.1 | tabular |
| title | Inter | 17px / 600 / 1.35 | |
| body | Inter | 15px / 400 / 1.55 | |
| table-numeric | Inter | 14px / 500 / 1.4 | tabular |
| stat-label | Inter | 11px / 600 / 1.3 | ls 0.08em, uppercase |
| label-caps | Inter | 11px / 600 / 1.3 | ls 0.08em |
| caption | Inter | 12px / 400 / 1.4 | |

No type below 11px. Ramp must survive 200% zoom without horizontal scroll (Hero); layout floor 320px reflow (data tables get an internal-scroll exception). Spanish runs ~20–30% longer than English — labels wrap to two lines before truncating; ellipsis never first resort.

**Spacing/radii/elevation:** Tailwind 4-scale inherited + named tokens gutter-mobile 16px / gutter-desktop 24px / tile-gap 12px / section-gap 48px / layer-gap 64px; radii sm 4 / md 8 / lg 12 / full 9999; content max-width `max-w-6xl`; depth is tonal (base→raised→overlay), shadows only on true overlays (values in Task 3.6).

### i18n layer contract (AD-12, UX-DR19, FR-30/31/32)

- `es` is canonical — English strings are variants, never source of truth. Language is NOT in the URL (single-tree i18n; no `hreflang`; pre-rendered HTML is Spanish).
- Scaffold scope: dictionaries + `t()` + Context provider + Intl helpers + lint gate. Story 2.2 owns: toggles, persistence wiring, pre-paint head script (`<html lang>` + locale class + theme class), post-hydration string swap, live-region announcements, 404 copy. Do not build 2.2's parts — but the provider API must not preclude them (settable locale, `wcstats.locale`/`wcstats.theme` key names reserved in a storage helper with try/catch + in-memory fallback, safe to include as a `src/lib/storage.ts` primitive now).
- Locale key seeding (structure now, content later): `app.*` (site name, placeholder page copy), `a11y.*` (aria strings are locale keys — never hardcoded), `meta.*` (title/description composition), reserved empty namespaces for enum→label maps (stage codes, positions `gk|df|mf|fw`, shot outcomes, metric codes + unit labels) so per-surface stories extend rather than restructure. Per-term tactical policy table (FR-32) is implemented term-by-term in later stories — the structure must support translate/jargon/tooltip decisions without fallthrough to raw keys.
- Formatting is exclusively `Intl` with `es-CO`/`en`: comma decimals (`1,24`), `62%` no space (deliberate vs RAE, logged), lowercase Spanish months, venue-local kickoff times, `Intl.Collator('es', {sensitivity:'base'})` for all text sorting/matching. Proper names (teams/players/venues) pass through untranslated.

### ESLint selectors (starting point — tune while proving Task 8.2)

```js
'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: false, noAttributeStrings: true }],
'no-restricted-syntax': ['error',
  { selector: 'JSXAttribute[name.name=/^(aria-label|aria-description|aria-valuetext|title|alt|placeholder)$/] > Literal',
    message: 'User-facing strings must come from the locale layer (t()).' },
  { selector: 'JSXAttribute[name.name=/^(aria-label|aria-description|aria-valuetext|title|alt|placeholder)$/] JSXExpressionContainer > Literal',
    message: 'User-facing strings must come from the locale layer (t()).' },
  { selector: 'VariableDeclarator[id.name="metadata"] Property[key.name=/^(title|description)$/] > Literal',
    message: 'Metadata strings must come from the locale layer.' },
],
```

Generated files (`src/lib/contract/**`) ship `/* eslint-disable */`; `src/locales/**` is exempt by definition (it IS the string store). Numeric/enum literals and non-UI strings (keys, URLs, CSS) must stay legal — that's why the gate is jsx-no-literals + targeted selectors, not a blanket no-strings rule.

### Accessibility & motion baseline baked into the scaffold

WCAG 2.1 AA intent (NFR-2): focus-visible ring from `--ring` globally, `focus-ring-on-pitch` token defined for later pitch stories; `prefers-reduced-motion` disables ALL animation (motion is decorative-only product-wide); ≥44×44px touch-target convention; `<html lang="es">` from the scaffold on; skip-link and live regions land with the chrome in 2.2. Evergreen browsers only (latest two majors) — no polyfills (NFR-5).

### Build chain & deploy specifics

- Chain (AR-13, exact order): `eslint . --max-warnings 0` → `tsc --noEmit` → `node scripts/assert-schema-version.mjs` → `next build` (+ post-step data copy if not using `public/`). All wired as `npm run build` so Netlify runs the whole gate.
- Schema assert is dependency-free Node (Task 6.4) because Netlify installs only `app/` deps (`base = "app"`); `contract/node_modules` exists only on the dev machine. Committed generated types + `check:types` drift guard (dev machine) close the loop.
- `DATA_ROOT = '/data/fixtures'` build-time constant — the single flip point for the Story 2.19 real-data swap; env vars are structurally banned (FR-33).
- Netlify: `base = "app"`, `publish = "out"`, `NETLIFY_NEXT_PLUGIN_SKIP=true` (prevents the auto-detected Next runtime plugin from overriding the static publish). Optional `public/_headers` for cache/security headers — nice-to-have, not required by AC.
- Budgets to keep in sight (enforced later, designed-for now): Lighthouse mobile ≥90 (2.19), per-route JSON ≤500 KB gzip measured by the Pipeline (never re-measured by the app).

### Out of scope (resist the creep)

Site chrome/header/toggles/footer/404 content → 2.2. Contract per-surface sign-off checklist → 2.3. Any real route (`/matches/[slug]` etc.), fetch-rendering of fixtures, viz, search → 2.4+. Lighthouse/Playwright harness → 2.19. The placeholder page exists only to prove tokens/fonts/i18n/build end-to-end.

### Project Structure Notes

```text
wc-stats/
  netlify.toml                  # NEW (repo root): base=app, publish=out, plugin skip
  app/                          # NEW — this story creates everything below
    .nvmrc                      # 24
    package.json / package-lock.json   # self-contained; no root workspace
    next.config.ts              # output:'export', images.unoptimized, trailingSlash
    tsconfig.json               # strict, @/* -> src/*
    eslint.config.mjs           # flat; next config + i18n gate rules
    postcss.config.mjs          # @tailwindcss/postcss
    scripts/assert-schema-version.mjs  # dependency-free FR-20 gate
    src/
      app/                      # layout.tsx, page.tsx (placeholder), globals.css (tokens)
      components/ui/            # vendored shadcn (button, card)
      locales/                  # es.ts (canonical), en.ts (type-mirrored)
      lib/
        contract/               # GENERATED: contract-types.d.ts, schema-version.ts (committed)
        i18n.ts                 # t() + locale context
        format.ts               # Intl helpers (the only formatting path)
        storage.ts              # wcstats.* localStorage wrapper (try/catch + memory fallback)
        data.ts                 # DATA_ROOT + same-origin fetch helpers
```

Matches the architecture Structural Seed (`app/src/app`, `src/components`, `src/locales`, `src/lib`; `src/viz/` arrives with the first viz story). Variances: `netlify.toml` at repo root (Netlify convention for `base`), `scripts/` for the assert gate (mirrors `contract/scripts/` precedent).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — story + ACs; Epic 2 preamble (fixtures until 1.19)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md#AD-1,AD-2,AD-7,AD-10..AD-15] — boundaries, i18n mechanism, build chain, stack pins; #Structural Seed; #Consistency Conventions
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/DESIGN.md] — normative token values (frontmatter), shadcn mapping table, typography, elevation, shapes (status: final — wins over review docs)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md#Voice and Tone, #i18n & Terminology, #Accessibility Floor, #Responsive] — formatting rules, locale bootstrap contract, a11y baseline, breakpoints
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-wc-stats-2026-07-21/review-i18n.md; review-accessibility.md] — binding corrections absorbed into DESIGN/EXPERIENCE finals
- [Source: _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md#FR-20,FR-30..FR-34,§5,§6] — gate requirements, budgets, privacy posture
- [Source: _bmad-output/implementation-artifacts/1-1-contract-v1-schemas-fixtures-type-generation-spike.md#Dev Agent Record] — generator reuse contract, codegen options/gotchas, fixture inventory
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — ET-only fixture gap, stages-collection question (→ 2.3)
- [Source: contract/README.md; contract/scripts/generate-types.mjs] — invocation, `--check`, output-dir parameter

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Debug Log References

- `npm audit` on the pinned stack reports 3 advisories (moderate postcss XSS, high sharp/libvips CVEs) — ALL transitive inside `next@16.2.11` itself; the "fix" is a downgrade to next 9.x, i.e. not applicable under the AR-15 pin. sharp is never invoked (`images.unoptimized`); postcss runs build-time only. No action within this story.
- ESLint 10.7.0 crashed at runtime (`scopeManager.addGlobals is not a function`): `typescript-eslint@8.65.0` (latest, bundled by `eslint-config-next`) declares `eslint ^10.0.0` peer support but its scope-manager does not yet implement the `addGlobals` API ESLint 10.7 calls. Applied the story's sanctioned fallback: pinned `eslint@^9` (9.39.5 installed). Follow-up: retry ESLint 10 when typescript-eslint catches up (9.x EOL 2026-08-06).
- shadcn CLI is now v4.14.0 with a changed flag surface: `-b` selects the primitive library (`radix`|`base`|`aria`, story's unified `radix-ui` ⇒ `radix`) and `-p nova` picks the preset non-interactively. Init injected Geist font, an oklch default palette, sidebar/chart tokens and derived radii — all removed in the Task 4.2 reconciliation; DESIGN.md values are the single token source in `globals.css`.

### Completion Notes List

- **Task 1:** `app/` is a self-contained npm package (`"type": "module"`, `engines.node >=24`, `.nvmrc` = 24, lockfile committed). Pins: next 16.2.11 / react 19.2.8 / typescript 6.0.3 / tailwindcss 4.3.3. `next.config.ts` = `output: 'export'`, `images.unoptimized`, `trailingSlash`. Placeholder route proves tokens + fonts + `t()` end-to-end and is disposable.
- **Task 2:** Archivo + Inter via `next/font/google`, no `weight` (variable fonts), `.variable` classes on `<html>`. Export audit: woff2 under `out/_next/static/media/`, zero `fonts.googleapis.com`/`gstatic` references anywhere in `out/`.
- **Task 3:** Full DESIGN.md token set in `globals.css`: dark canonical on `:root`/`.dark`, light on `.light`, theme-invariant pitch/ramp/focus-ring-on-pitch tokens, shadcn mapping table verbatim, `@theme inline` registrations (colors, radii sm/md/lg/full, named spacing, `--shadow-overlay`), `type-*` ramp utilities with `tabular-nums` on every numeric entry, reduced-motion kill-switch and global `:focus-visible` ring.
- **Task 4:** `button` + `card` vendored as copied source into `src/components/ui/`. Deps landed as predicted (unified `radix-ui`, cva, clsx, tailwind-merge, tw-animate-css) plus the `shadcn` package, kept for its build-time `shadcn/tailwind.css` (data-state variants/utilities vendored components compile against — not a registry runtime). `lucide-react` removed (nothing uses it). `--font-heading` mapped to Archivo so the vendored card follows DESIGN.md.
- **Task 5:** `es.ts` canonical with `Dictionary = typeof es` (string leaves, not `as const`, so mirrors may differ in value but never shape); `en.ts` typed against it. `t()` in `i18n.ts` uses template-literal dot-path keys (`DictionaryKey`) — statically typed end-to-end; client locale state in `i18n-provider.tsx` (Context, settable, default `es`; split from `i18n.ts` so server components/metadata can call `t()` without pulling in a client module). `format.ts`: es-CO/en `Intl` helpers (comma decimals, joined `%` — deliberate vs RAE, venue-local kickoff read from the artifact's own wall-clock+offset, UTC-pinned date formatting, base-sensitivity collators). `storage.ts` reserves `wcstats.locale`/`wcstats.theme` with try/catch + in-memory fallback. `data.ts` ships `DATA_ROOT = '/data/fixtures'` (single 2.19 flip point) + same-origin `fetchArtifact`.
- **Task 6:** Flat `eslint.config.mjs` on `eslint-config-next` (flat-native array). **Gate tuning (story anticipated this):** `jsx-no-literals` with `ignoreProps: false, noAttributeStrings: true` flagged `className`/`data-slot` — non-UI strings the story requires stay legal — so props moved off jsx-no-literals (`ignoreProps: true`) onto the targeted `no-restricted-syntax` selectors for aria/title/alt/placeholder + metadata; JSX text/expression literals still hard-error. `src/lib/contract/**` ignored (generated; its `eslint-disable` banner trips `--max-warnings 0` as unused). Build chain wired exactly per AR-13: `eslint --max-warnings 0` → `tsc --noEmit` → `assert-schema-version` → `next build` → data copy. `assert-schema-version.mjs` is Node-builtins-only; optional data-dir arg exists solely for the failure-path test.
- **Task 7:** Types generated by re-pointing `contract/scripts/generate-types.mjs` (237 declarations + `SCHEMA_VERSION = 1`), committed; `generate:types`/`check:types` delegate to it (drift check green). `copy-data.mjs` copies repo `/data` verbatim → `out/data/`. `netlify.toml` at repo root: `base = "app"`, `publish = "out"`, `NETLIFY_NEXT_PLUGIN_SKIP = "true"`, nothing else.
- **Task 8 — proofs:** vitest 3.2.7, node env, 24 tests green (format es-CO `1,24`/`62%`/`21 de julio de 2026` lowercase/en `1.24`; venue-local kickoff at +02:00 stays 21:00 wall-clock; collator `Á`≡`a` and base-letter sort; `t()` es/en + runtime mirror sweep; assert script pass + tampered-copy fail naming file/value + empty-tree fail). **Negative gate proofs (temporary edits, all reverted, gates re-verified green):** (a) hardcoded JSX text → `react/jsx-no-literals` error; (b) `aria-label="hardcoded attribute"` → `no-restricted-syntax` error; (c) deleting `en.ts` `statLabel` → `tsc` TS2741; (d) bumping `data/fixtures/index/leaderboards.json` to `schemaVersion: 2` → assert exits 1 naming file + value. Full `npm run build` green on Node 24.15.0; `out/` contains `/` + `/_not-found` pre-rendered, `404.html`, `out/data/fixtures/**` (7 artifacts). Zero-external-request audit: HTML/CSS have no external origins; JS contains only inert doc-URL strings (nextjs.org/react.dev error messages) and the SVG XML namespace. Local static serve: `/` 200 Spanish dark-canonical placeholder, fixture JSON 200, missing route 404.
- **Scope note:** file-layout variance from the story seed: locale Context lives in `src/lib/i18n-provider.tsx` (client) next to `src/lib/i18n.ts` (server-safe `t()`), because a single file would force the whole i18n layer client-side. Everything else matches the Structural Seed.

### File List

- `netlify.toml` (new)
- `app/.gitignore` (new)
- `app/.nvmrc` (new)
- `app/package.json` (new)
- `app/package-lock.json` (new)
- `app/next.config.ts` (new)
- `app/tsconfig.json` (new; `next build` normalized `jsx`/`include`)
- `app/next-env.d.ts` (new, Next-generated, committed)
- `app/postcss.config.mjs` (new)
- `app/eslint.config.mjs` (new)
- `app/vitest.config.ts` (new)
- `app/components.json` (new, shadcn CLI config)
- `app/scripts/assert-schema-version.mjs` (new)
- `app/scripts/copy-data.mjs` (new)
- `app/src/app/globals.css` (new)
- `app/src/app/layout.tsx` (new)
- `app/src/app/page.tsx` (new)
- `app/src/components/ui/button.tsx` (new, vendored shadcn)
- `app/src/components/ui/card.tsx` (new, vendored shadcn)
- `app/src/lib/utils.ts` (new, shadcn `cn`)
- `app/src/lib/i18n.ts` (new)
- `app/src/lib/i18n-provider.tsx` (new)
- `app/src/lib/format.ts` (new)
- `app/src/lib/storage.ts` (new)
- `app/src/lib/data.ts` (new)
- `app/src/lib/contract/contract-types.d.ts` (new, generated, committed)
- `app/src/lib/contract/schema-version.ts` (new, generated, committed)
- `app/src/locales/es.ts` (new)
- `app/src/locales/en.ts` (new)
- `app/src/lib/format.test.ts` (new)
- `app/src/lib/i18n.test.ts` (new)
- `app/src/lib/assert-schema-version.test.ts` (new)

## Change Log

- 2026-07-23: Story 2.1 implemented — Next 16.2.11 static-export scaffold with full DESIGN.md token set, typed es/en locale layer + Intl helpers, vendored shadcn (button/card), generated contract types, AR-13 build-gate chain (ESLint i18n gate → typecheck → schema-version assert → next build → data copy), netlify.toml static publish. 24 unit tests + 4 negative gate proofs. Notable calls: ESLint 9.39.5 fallback (typescript-eslint not yet ESLint-10-runtime-compatible), jsx-no-literals prop coverage delegated to targeted selectors, `shadcn` pkg kept for build-time CSS, i18n split into server-safe `t()` + client provider.

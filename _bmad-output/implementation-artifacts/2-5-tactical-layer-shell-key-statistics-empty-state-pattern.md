---
baseline_commit: 6652fc33f0f5016760f08615c58e9466c52df37f
---

# Story 2.5: Tactical Layer Shell, Key Statistics & Empty-State Pattern

Status: done

## Story

As Diego,
I want the Tactical Layer's section scaffolding with the head-to-head Key Statistics block and a ruled empty-state pattern,
So that every tactical section has its place, its anchor, and an honest absence state (FR-22 foundation).

## Acceptance Criteria

1. **Given** the Match Dashboard
   **When** the Tactical Layer renders
   **Then** layer section shells exist for the full normative order (key-stats → momentum → shot-maps → pass-networks → offers-to-receive → movement-to-receive → defensive-actions → phases → pressing → set-plays → goalkeeping) each with its stable anchor; `≥lg` renders Tactical sections expanded, `<lg` renders header + one-line summary expanding in place with Accordion semantics (`aria-expanded`, focus to revealed heading); anchor navigation auto-expands; expansion lazy-mounts content (UX-DR6, UX-DR18)
   **And** the layer-gap/section-gap rhythm from DESIGN.md separates layers and sections.

2. **Given** the Key Statistics section (`#key-stats`)
   **When** it renders from Domain B data
   **Then** head-to-head stat tiles show both teams' full Key Statistics block; the leading side carries the team accent **plus** the ▲ glyph and «líder»/"leader" in the accessible name — never color-only (UX-DR7, UX-DR11)
   **And** at `<md` tiles render as a single column of paired tiles, compact enough that UJ-1's single scroll still reaches the momentum slot.

3. **Given** a section whose data is missing from the bundle
   **When** it renders
   **Then** the empty-state panel occupies the section's slot with the ruled copy ("Sin datos de {sección} para este partido…"), never silent absence or layout collapse (FR-22, UX-DR13).

## Tasks / Subtasks

- [x] **Task 1: Section registry — the pure spine of the layer (AC: 1, 3)**
  - [x] 1.1 Create `app/src/lib/tactical-sections.ts` (pure, no React, no DOM). Export `type SectionId` as the string-literal union in **exact normative order**: `"key-stats" | "momentum" | "shot-maps" | "pass-networks" | "offers-to-receive" | "movement-to-receive" | "defensive-actions" | "phases" | "pressing" | "set-plays" | "goalkeeping"` and `export const SECTION_IDS: readonly SectionId[]` in that same order. The array order **is** the render order — never sort, never derive it from the dictionary. Also export `ALWAYS_EXPANDED_SECTION_IDS` = `["key-stats", "momentum"]` and `type CollapsibleSectionId` / `COLLAPSIBLE_SECTION_IDS` = the other nine — ruled decision 3 encoded in the type system rather than in a component conditional.
  - [x] 1.2 `sectionTitleKey(id: SectionId)` and `sectionSummaryKey(id: CollapsibleSectionId)` returning typed `DictionaryKey`s via template-literal types (mirror `stageLabelKey` in `match-hero.ts`). Summaries exist for the nine collapsible sections **only** — the two always-expanded ones never show a summary line, and unused locale keys are a review finding (2.4 shipped two dead keys). Build keys in these helpers, never inline inside JSX — `{t(cond ? "a" : "b")}` and literal key strings inside a JSXExpressionContainer trip `react/jsx-no-literals`.
  - [x] 1.3 `sectionDataState(bundle, id): "ready" | "empty"` — the FR-22 predicate. Map exactly:
    - `key-stats` → `bundle.keyStatistics` (required by contract → always `ready`)
    - `momentum` → `bundle.momentum !== null`
    - `shot-maps` → `bundle.events.shots !== null`
    - `pass-networks` → `bundle.events.passNetworkNodes !== null && bundle.events.passNetworkEdges !== null`
    - `offers-to-receive`, `movement-to-receive` → `bundle.events.receiving !== null`
    - `defensive-actions` → `bundle.events.defensiveActions !== null`
    - `phases`, `pressing` → `bundle.tacticalIdentity` (required → always `ready`)
    - `set-plays` → `bundle.setPlays` (required → always `ready`)
    - `goalkeeping` → `bundle.goalkeeping !== null`
    **`null` and `[]` are DIFFERENT states in this contract** (schema `$comment`s say so verbatim): `null` = the report does not carry that page → empty state. `[]` = the page was present and listed zero events → `ready`; the owning story renders its own zero-content view. Never use `.length === 0` as the empty-state trigger.
  - [x] 1.4 Key-stat row model: `export const KEY_STAT_FIELDS: readonly (keyof TeamKeyStatistics)[]` in the contract's own `required[]` order — `possession, goals, expectedGoals, shots, shotsOnTarget, passes, passesCompleted, passCompletion, completedLineBreaks, defensiveLineBreaks, receptionsInFinalThird, crosses, ballProgressions, defensivePressures, directPressures, forcedTurnovers, secondBalls, distanceCovered, sprintDistance` (19, source-page row order). Plus `COMPACT_KEY_STAT_FIELDS` = the six ruled for `<md` (ruled decision 4): `possession, expectedGoals, shots, shotsOnTarget, passesCompleted, passCompletion`. Plus `KEY_STAT_FORMAT: Record<field, "percent" | "integer" | "decimal1" | "decimal2">` and `KEY_STAT_UNIT: Partial<Record<field, "km">>` (only `distanceCovered` and `sprintDistance`). Export `buildKeyStatRows(keyStatistics)` returning `{ field, home, away, leader }[]` using `resolveLeader` imported from `@/lib/match-hero` (do NOT re-implement it, do NOT move it).
  - [x] 1.5 No formatting in this module — it returns raw numerics + a format tag; `@/lib/format` stays the only formatting path and it needs the locale, which only the component has.

- [x] **Task 2: Shared empty-state panel — the reusable pattern 2.6–2.10 depend on (AC: 3)**
  - [x] 2.1 Create `app/src/components/EmptyStatePanel.tsx` (`"use client"`, `useT()`). Visual spec `{components.empty-state-panel}` verbatim: `surface-raised` background, **dashed** `border-hairline` border, `rounded-md`, centered `type-title` headline + `type-body` `ink-secondary` explanation, generous padding so it occupies the section's slot (min-height ≈ the content it replaces; do not let the layout collapse).
  - [x] 2.2 Props: `{ headline, explanation }` — both **already-resolved strings passed in by the caller**, because `headline`/`explanation` are not gated prop names but `message`/`caption`/`heading`/`text`/`description`/`label` ARE (see `eslint.config.mjs` selectors); resolve via `t()` in the caller and pass identifiers. Default copy comes from `tactical.empty.*` (Task 7).
  - [x] 2.3 Second variant `PendingSectionPanel` in the same file (same visual shell, copy `tactical.pending.*`): rendered when a section's data is `ready` but its content component has not shipped yet (sections 2–11 during 2.5→2.10). It must NOT reuse the empty-state copy — "El informe oficial no incluye esta sección" would be a lie about a section whose data is present, and Diego's trust (UJ-2 failure path) is exactly what FR-22 protects. Each of stories 2.6–2.10 deletes its own section's placeholder when it lands.
  - [x] 2.4 No icon asset. DESIGN's "muted glyph" is optional; if used it must be `aria-hidden` text/inline SVG in `ink-muted` (that token is ≥3:1 non-text ONLY — never put copy in it).

- [x] **Task 3: `TacticalSection` shell — disclosure semantics (AC: 1)**
  - [x] 3.1 Create `app/src/components/TacticalSection.tsx` (`"use client"`). Markup contract (ruled decision 6):
    ```
    <section id={id} aria-labelledby={`${id}-heading`}>
      collapsible:
        <h2 id={`${id}-heading`} class="type-headline">
          <button type="button" aria-expanded={open} aria-controls={`${id}-content`}
                  aria-describedby={`${id}-summary`} class="flex min-h-11 w-full items-center justify-between text-left">
            {title}<span aria-hidden="true">{CHEVRON}</span>
          </button>
        </h2>
        <p id={`${id}-summary`} class="type-body text-ink-secondary">{summary}</p>
      non-collapsible:
        <h2 id={`${id}-heading`} class="type-headline">{title}</h2>
      {open ? <div id={`${id}-content`} role="region" aria-labelledby={`${id}-heading`} tabIndex={-1}>{children}</div> : null}
    </section>
    ```
    `CHEVRON` is a module const, not a JSX literal (the gate flags bare glyph text). The summary `<p>` renders in the **collapsible** presentation at every width — _corrected by the 2.5 review (decision D1): the original "only in the `<lg` presentation" clause contradicted Task 4.3.3 and was written from the desktop mockup, which draws plain `<h2>`s; the ruling kept Task 4.3's literal reading, so a collapsible section is a real disclosure at `≥lg` too and carries its summary there._ The content wrapper is rendered whenever the section is open, **including** for always-expanded sections, so anchor navigation always has a target. Per review decision D4 it is a **plain `<div>`** — no `role="region"`, no `aria-labelledby`, no `tabIndex` — because the `<section>` above is already a named region landmark and duplicating it produced 22 landmarks for 11 sections. No `scroll-mt-*` on the section: Task 8's `scroll-padding-top` on the scrollport covers both fragment navigation and `scrollIntoView()`.
    Heading hierarchy on the page: sr-only `<h1>` (Hero, 2.4) → one `<h2>` per Tactical section. Do not introduce an `<h2>` for the layer itself — neither mockup has one.
  - [x] 3.2 **Lazy mount, not `hidden`.** UX-DR6 says expansion lazy-mounts the content: render `children` only when open. This is the deliberate opposite of `LineupsDisclosure` (2.4), which ships its content in the DOM under `hidden` for crawlable player links — do not copy that pattern here; the pitch panels 2.7–2.9 will mount d3 and must not pay for 9 hidden vizzes.
  - [x] 3.3 On open, move focus to the revealed **heading** (`<h2 tabIndex={-1}>`). _Corrected by the 2.5 review (decision D2): ruled decision 7 sent focus to the content region instead, which contradicts AC 1's and UX-DR6's own words ("focus to revealed heading") and gave the page two focus contracts, since `LineupsDisclosure` focuses its heading. The AC's wording won._ Do this only on a *user* toggle and on anchor auto-expand — never on an initial render or a viewport change.
  - [x] 3.4 No animation (motion is decorative-only and `prefers-reduced-motion` kills all of it globally — do not add a transition that only exists for non-reduced-motion users). Touch target ≥44×44 px on the trigger itself (`min-h-11 w-full`), not on a wrapper — the 2.4 review patched exactly this mistake.
  - [x] 3.5 Focus ring: rely on the global `:focus-visible` `--ring` rule. **Never** `outline-none` (globals.css:363-364 states the rule; the 2.4 review's first patch was this exact regression).

- [x] **Task 4: `TacticalLayer` — order, rhythm, breakpoints, anchors (AC: 1)**
  - [x] 4.1 Create `app/src/components/TacticalLayer.tsx` (`"use client"`). Props: `{ bundle: MatchBundle }`. Renders `SECTION_IDS.map(...)` — the registry order, no local ordering.
  - [x] 4.2 Viewport state via `useSyncExternalStore` over `window.matchMedia` (not an effect + `useState`): `getSnapshot` reads `.matches` synchronously so the first client render is already correct — an effect-based hook flashes 11 collapsed shells on desktop. `getServerSnapshot` returns `false` (mobile-first). Subscribe with `addEventListener("change", …)`; guard `matchMedia` existence in a try/catch like `bootstrap.ts:81`. Two queries: `(min-width: 1024px)` = `lg` (disclosure) and `(min-width: 768px)` = `md` (key-stats layout, Task 5). Put the hook in `src/lib/use-media-query.ts` (`"use client"`) so both consumers share one implementation.
  - [x] 4.3 Disclosure policy, in precedence order:
    1. `sectionDataState === "empty"` → **never collapsible**, at any width: heading + empty-state panel, always visible (ruled decision 10 — "never a silent absence" must not require a tap to discover, and a summary line for data that is not there would be nonsense).
    2. `key-stats` and `momentum` → never collapsible (both mockups render them expanded at 390 px; UJ-1's ~15-second story is *reading* them — ruled decision 3).
    3. everything else → collapsible **at every width**, defaulting to open at `≥lg` and collapsed at `<lg`; an explicit user or anchor override beats the breakpoint default and survives a trip across it. _Confirmed literal by the 2.5 review (decision D1): a desktop reader keeps a real trigger, `aria-expanded` and a summary line, and can collapse a section. Task 3.1's conflicting "summary only at `<lg`" clause was corrected to match._ Implemented as the pure, unit-tested `buildSectionPlans` in `tactical-sections.ts`, not as a loop inside the component.
  - [x] 4.4 Rhythm (from the mockups + DESIGN spacing): each section carries a `border-t border-hairline` + `pt-5`; expanded sections are separated by `section-gap` (48 px, `mt-section-gap` on section+section); the run of collapsed shells stacks directly on its hairlines (no 48 px between them) with `mt-section-gap` before the first one. The Hero→Tactical boundary keeps the existing `layer-gap` (64 px) — `MatchBundleRegion` already applies `mt-layer-gap`; do not add a second gap.
  - [x] 4.5 Anchor handling: the Tactical Layer only exists after the client fetch resolves, so the browser has already given up on a `#momentum` deep link by the time the target mounts. On mount read `window.location.hash`; if it names a `SectionId`: expand that section (if collapsible and collapsed), then `scrollIntoView()` and focus its content region. Also subscribe to `hashchange` for in-page anchor navigation. Ignore unknown hashes silently (`#main-content`, `#expert`).
  - [x] 4.6 Content dispatch: `key-stats` → `<KeyStatisticsSection keyStatistics={bundle.keyStatistics} homeCode={bundle.metadata.homeTeam.teamCode} awayCode={bundle.metadata.awayTeam.teamCode}/>`; every other `ready` section → `<PendingSectionPanel/>`; every `empty` section → `<EmptyStatePanel/>` with the ruled copy. Keep the dispatch a single explicit switch/record in this file so 2.6–2.10 each replace exactly one line, and give it a `default` that **throws** with the offending id rather than rendering nothing (2.4 review lesson: silent fall-through branches get flagged).

- [x] **Task 5: Key Statistics section content (AC: 2)**
  - [x] 5.1 Create `app/src/components/KeyStatisticsSection.tsx` (`"use client"`, `useT()` + `useLocale()`). Props: `{ keyStatistics, homeCode, awayCode }` — pass the block plus the two team codes; do NOT pass the whole bundle down.
  - [x] 5.2 Paired-tile row (`StatPairTile`, local to this file): `surface-raised`, `rounded-md`, `min-h-11`, grid `auto 1fr auto` (`<md`: `76px 1fr 76px`; `≥md`: `120px 1fr 120px` per the mockups) — home value left, centered `type-stat-label` uppercase label, away value right. Values in `type-stat-value` tabular; team code beneath each value in `type-label-caps` `ink-secondary`.
  - [x] 5.3 Leader treatment (UX-DR7/UX-DR11) — identical rules to the Hero tiles: higher value leads (uniformly, all 19 — ruled decision 5), leading value takes `text-viz-team-a` (home) / `text-viz-team-b` (away) **plus** an `aria-hidden` `▲` glyph before it **plus** an `sr-only` `t("match.hero.leader")` after it; ties get no marks. Never color-only. Keep the glyph on a ramp size (`type-caption`) — no `text-[13px]`; the 2.4 review rejected exactly that arbitrary size.
  - [x] 5.4 Layout: `<md` single column of paired tiles; `≥md` two-column grid of the same tiles (`grid-cols-1 md:grid-cols-2`, `gap-tile-gap`) per DESIGN's Responsive table and the desktop mockup's `.kgrid`.
  - [x] 5.5 `<md` compactness (AC 2's second clause): render `COMPACT_KEY_STAT_FIELDS` (6 rows) plus an in-place disclosure — a `<button aria-expanded aria-controls>` labelled `t("tactical.keyStats.showAll")` ("Ver todas las estadísticas") revealing the remaining 13. At `≥md` all 19 render and the button is not rendered at all. Nothing is deleted — the full block is one tap away (SM-C2, same "declutter without deleting" grammar EXPERIENCE rules for pass networks). Ruled decision 4.
  - [x] 5.6 `contestedPossession` is a **match-level** value (schema: home / contested / away are a three-way split and the middle one cannot be derived), so it cannot be a paired tile. Render it as one `type-caption` `ink-secondary` line beneath the possession row: `{t("tactical.keyStats.contested")} {formatPercent(v, locale, 0)}`. Do not render any "sums to 100" claim — at 0 decimals m074 rounds to 66/11/24.
  - [x] 5.7 Formatting through `@/lib/format` only, digits pinned by `KEY_STAT_FORMAT`: `percent` → `formatPercent(v, locale, 0)` (possession, passCompletion — integer percents, matching the Hero and both mockups); `integer` → `formatInteger`; `decimal2` → `expectedGoals`; `decimal1` → `distanceCovered`, `sprintDistance`. Unit-bearing labels compose as `{t(enums.metric.X)} ({t(enums.unit.km)})` — units are locale-layer metadata keyed by metric code (AD-7), not baked into the label string. The helpers throw on non-finite input; that is correct fail-loud behaviour — never pre-sanitize, never `toFixed`.
  - [x] 5.8 No glossary underlines anywhere in this section (ruled decision 8) — a dotted-underline affordance with no tooltip behind it is worse than none. Story 2.18 marks terms across the whole Tactical Layer at once.

- [x] **Task 6: Wire into the existing route (AC: 1, 2, 3)**
  - [x] 6.1 `app/src/components/MatchBundleRegion.tsx`: keep the fetch **exactly as it is** (one artifact, `fetchArtifact`, ephemeral state, AR-11/FR-34/AD-10 unchanged) but stop discarding the payload — hold it in state and render `<TacticalLayer bundle={bundle}/>` in the loaded branch, replacing the empty container. Do not restructure the skeleton / announcement / retry lifecycle; do not move the fetch; do not add a cache or Context.
  - [x] 6.2 While holding the payload, validate it before declaring success: `bundle.matchId === matchId` and `bundle.schemaVersion === SCHEMA_VERSION` (from `@/lib/contract/schema-version`); a mismatch takes the existing `"error"` branch (stale CDN copy, redirected 200). This closes deferred decision D4 from the 2.4 review — say so in the completion notes.
  - [x] 6.3 `app/src/app/matches/[slug]/page.tsx`: widen the route container `max-w-2xl` → `max-w-6xl` (DESIGN: `max-w-6xl` is the dashboard width; the ≥md two-column key-stats grid and 2.7's side-by-side pitch panels do not fit 672 px) and keep the Hero's measure by wrapping `<MatchHero>` in `mx-auto w-full max-w-2xl`. This is the only edit to 2.4's route file. Re-run the 2.4 static-output suite — it must stay green.
  - [x] 6.4 Nothing else in 2.4's Hero components changes. Do not refactor `StoryStatTiles`; do not touch `LineupsDisclosure` (its empty-`starters` gap is a filed deferred item, not this story's).

- [x] **Task 7: Locale entries (AC: all)**
  - [x] 7.1 `es.ts` (canonical) first, then `en.ts` (typed mirror — a missing key is a compile error). New `tactical.*` namespace:
    - `tactical.sections.{id}.title` × 11, verbatim from the i18n term table + mockups — es: "Estadísticas clave" / "Línea de momentum" / "Mapa de tiros y xG" / "Red de pases" / "Ofrecimientos para recibir" / "Desmarques" / "Acciones defensivas" / "Fases del juego" / "Presión y bloques defensivos" / "Balón parado" / "Arqueros"; en: "Key statistics" / "Momentum timeline" / "Shot map & xG" / "Pass networks" / "Offers to receive" / "Movement to receive" / "Defensive actions" / "Phases of play" / "Pressing & defensive blocks" / "Set plays" / "Goalkeeping".
    - `tactical.sections.{id}.summary` × **9** (collapsible sections only — `key-stats` and `momentum` never collapse, so a summary key for them would be dead copy) — one flat descriptive line each (ruled decision 2: static copy in 2.5; 2.6–2.10 may replace their own with artifact-sourced values when they own the data). Register: tuteo, neutral LatAm, no exclamation marks, numbers carry the drama.
    - `tactical.empty.headline` = "Sin datos de esta sección para este partido." / "No data for this section in this match."; `tactical.empty.explanation` = "El informe oficial no incluye esta sección." / "The official report does not include this section." (ruled decision 1 — `{sección}` in EXPERIENCE is a template slot, and `t()` carries no interpolation by design; the section is named by the `<h2>` directly above the panel.)
    - `tactical.pending.headline` / `.explanation` — es "Esta sección aún no está disponible en el sitio." / "Estamos construyendo esta vista; los datos ya están en el informe." ; en mirrors.
    - `tactical.keyStats.showAll` ("Ver todas las estadísticas" / "View all statistics"), `tactical.keyStats.showLess`, `tactical.keyStats.contested` ("Posesión disputada:" / "Contested possession:").
  - [x] 7.2 Fill the reserved `enums.metric` namespace with one label per `TeamKeyStatistics` field (19 keys, keyed by the field name — which is string-identical to `MetricCode` for 18 of them by contract design, so Story 2.13 inherits them; `directPressures` is the one field that is not a `MetricCode`). es per the per-term policy table: Posesión / Goles / xG / Tiros / Tiros al arco / Pases / Pases completados / Precisión de pases / Rupturas de líneas completadas / Rupturas de líneas defensivas / Recepciones en el último tercio / Centros / Progresiones de balón / Presiones defensivas / Presiones directas / Recuperaciones forzadas / Segundas jugadas / Distancia / Distancia en sprint. en: Possession / Goals / xG / Shots / Shots on target / Passes / Completed passes / Pass accuracy / Completed line breaks / Defensive line breaks / Receptions in final third / Crosses / Ball progressions / Defensive pressures / Direct pressures / Forced turnovers / Second balls / Distance / Sprint distance. Fill `enums.unit.km` ("km" both locales — kept as a locale entry because AD-7 says units are locale metadata, not artifact strings).
  - [x] 7.3 Every user-facing string (including aria) through `t()`/`useT()`. Gate reality (2.1/2.2/2.4 reviews): `{t(cond ? "k1" : "k2")}` fails — build the key in a helper; `·`, `▲`, `▸` and any separator glyph must be a module const or a locale entry, never a bare JSX literal; the gated prop names are `aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip` on **any** element including your own components.

- [x] **Task 8: Anchor scroll offset (AC: 1)**
  - [x] 8.1 `app/src/app/globals.css` — add `scroll-padding-top` to an `html` rule in `@layer base`, sized to the sticky header (`h-14` = 3.5rem) plus a little breathing room. Without it every anchored section heading lands under the sticky bar. This also fixes `#main-content`. One rule; no other CSS additions (no new tokens, no new utilities).

- [x] **Task 9: Tests (AC: all)**
  - [x] 9.1 `app/src/lib/tactical-sections.test.ts` (node env, pure — the harness has **no jsdom** by deliberate 2.2 decision; do not add it):
    - `SECTION_IDS` equals the normative order exactly, has 11 entries, all unique;
    - every id has a resolvable title in **both** locales, and every `COLLAPSIBLE_SECTION_IDS` entry a resolvable summary (loop the ids × `["es","en"]` through `t()` — this catches a missed `en` mirror even though the type system also would), and `COLLAPSIBLE_SECTION_IDS ∪ ALWAYS_EXPANDED_SECTION_IDS === SECTION_IDS` with no overlap;
    - `sectionDataState` over the three real fixtures (read them with `node:fs` like `build-data.ts`/`static-output.test.ts` do): m001 and m074 → all 11 `ready`; m002 → `momentum` `empty`, the other ten `ready`;
    - `sectionDataState` on constructed bundles: `events.shots = []` → `ready` (NOT empty), `events.shots = null` → `empty`; same pair for `goalkeeping`, `defensiveActions`, `receiving` (both receiving sections flip together), and `passNetworkNodes`/`Edges`;
    - `KEY_STAT_FIELDS` has 19 entries in the contract's `required[]` order and covers `TeamKeyStatistics` exhaustively (assert against `Object.keys` of a fixture's `keyStatistics.home`, sorted — a contract field added later must fail this test);
    - `COMPACT_KEY_STAT_FIELDS` is a subset of `KEY_STAT_FIELDS` and preserves their relative order;
    - `buildKeyStatRows` on m001: row count, and leader resolution for a home-leading row, an away-leading row and a constructed tie.
  - [x] 9.2 `app/src/lib/i18n.test.ts` (or the new test file): assert `enums.metric` has exactly one entry per `KEY_STAT_FIELDS` entry and `enums.unit.km` resolves in both locales.
  - [x] 9.3 Static-output: **do not** assert Tactical markup in `out/` — the layer mounts only after the client fetch, so the exported HTML legitimately contains none of it. Instead extend `app/src/app/matches/static-output.test.ts` with a guard that the exported page still carries the 2.4 Hero contract after the container change (existing assertions must stay green), and add one assertion that the exported HTML contains **no** `id="key-stats"` — a regression here would mean someone moved the Tactical Layer to the build-time path and broke AR-11.
  - [x] 9.4 All 103 existing tests stay green.

- [x] **Task 10: Verify (AC: all)**
  - [x] 10.1 `npm run build` (lint `--max-warnings 0` → tsc → schema assert → next build → copy-data) then `npm test`, in that order — the static-output tests read `out/`.
  - [x] 10.2 Browser over a static server rooted at `out/` (`/data/*` 404s under `next dev`; do not add dev rewrites). At **390 px** on m001: Hero → 64 px gap → `#key-stats` expanded (6 compact rows + "Ver todas las estadísticas") → `#momentum` expanded (its shell + pending panel) → the nine collapsed shells. Confirm zero horizontal scrolling, and again at 200 % zoom. Record the fold evidence in the Debug Log — 2.4 closed with this exact check unevidenced (deferred decision D7).
    > **ANNOTATION (added by the Story 2.19 code review, 2026-08-25 — ledger L211's own instruction).**
    > This `[x]` was only ever true of its FIRST clause. The 390 px fold was measured and evidenced;
    > the **200 % zoom clause failed** — at a 195 CSS px layout viewport `#key-stats` overflowed,
    > because `grid-cols-[76px_1fr_76px]` (`KeyStatisticsSection.tsx:93`) gives a tile a 247 px
    > min-content width. It was disclosed in this story's Debug Log at the time and filed for
    > Story 2.19, so nothing was hidden — but a checked box whose second clause demonstrably fails
    > reads as passing to anyone skimming, which is what L211 asked to have annotated rather than
    > silently re-patched.
    >
    > **FIXED IN STORY 2.19**, Task 6.2 (R2/D8): the tracks became
    > `grid-cols-[minmax(0,76px)_minmax(0,1fr)_minmax(0,76px)]` and all sixteen locale × route cells
    > now report a document scrollWidth of exactly 195. The clause is true today; it was not true
    > when this box was checked.
  - [x] 10.3 At **≥1024 px**: all 11 sections expanded, no summary lines, key stats in a two-column grid of 19 rows, `section-gap` rhythm visible.
  - [x] 10.4 Keyboard at `<lg`: Tab reaches every shell trigger; Enter/Space toggles; `aria-expanded` flips; focus lands inside the revealed region; the focus ring is visible on every trigger.
  - [x] 10.5 Deep links: load `/matches/m001-mexico-south-africa/#defensive-actions` at 390 px — after the bundle resolves the section auto-expands, scrolls into view clear of the sticky header, and takes focus. Then click an in-page `#pressing` link (or edit the hash) and confirm `hashchange` does the same.
  - [x] 10.6 m002 (`momentum: null`): the `#momentum` section keeps its heading and anchor and shows the empty-state panel in the slot — dashed border, headline + explanation, no layout collapse, no tap required at any width. This is the story's only browser-observable empty state; every other empty path is proven by Task 9.1's constructed bundles.
  - [x] 10.7 Toggle EN after load: all section titles, summaries, stat labels, the empty/pending copy and the leader `sr-only` string swap; numbers reformat (comma → period). Toggle theme: dashed borders, tiles and accents hold up in light mode.

### Review Findings

_Code review 2026-07-26 — three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 8 decisions, 11 patches, 4 deferred, 12 dismissed as noise. Blind Hunter died mid-run on an API error and was resumed from its transcript; all three layers ultimately reported._

**Decisions** — all 8 resolved by Juan on 2026-07-26. Seven became patches; one deferred. Rulings recorded inline below.

- [x] [Review][Decision] `≥lg` renders no disclosure control at all — deviation from Task 4.3 clause 3 — `TacticalLayer.tsx:147` computes `collapsible = !isEmpty && !isLg && isCollapsibleId(id)`, so at `≥lg` there is no `<button>`, no `aria-expanded`, no summary line, and a desktop user cannot collapse anything. Task 4.3.3's literal wording is "expanded at `≥lg`, collapsed at `<lg`" — i.e. an *open disclosure*, not a plain heading. Evidence favours the implementation: AC 1 scopes Accordion semantics to `<lg`, Task 3.1 says the summary `<p>` renders only in the `<lg` presentation, and the desktop mockup's only `aria-expanded` is the Hero lineups disclosure. Self-flagged by the dev in the completion notes. **RULED (Juan, 2026-07-26): Task 4.3 was literal — patch it.** Collapsible sections become genuine disclosures at `≥lg` too: trigger + `aria-expanded` + summary line, defaulting to open. Reviewer's flag on record: this contradicts Task 3.1's "summary renders only in the `<lg` presentation" and the desktop mockup, and invalidates the 10.3 Debug Log evidence ("0 disclosure triggers, 0 summary lines") — Task 3.1's wording and the 10.3 evidence both need updating with the patch. → **patch**
- [x] [Review][Decision] Focus on expand goes to the content region, not the heading — contradicts AC 1's literal words — AC 1 and UX-DR6 both say "focus to revealed heading"; `TacticalSection.tsx:77` focuses `contentRef` (`role="region"` + `aria-labelledby` + `tabIndex={-1}`). Ruled decision 7's reasoning is sound (the heading sits *inside* the always-visible trigger, so focusing it would not move focus into what was revealed). But it also splits the page's disclosure behaviour in two: `LineupsDisclosure.tsx:105` on the same route focuses `firstHeadingRef`. Two disclosures, two focus contracts, one page. **RULED (Juan, 2026-07-26): follow AC 1 literally — focus the revealed heading.** Ruled decision 7 is overturned; `TacticalSection` focuses its `<h2>` (`tabIndex={-1}`) instead of the content region, matching `LineupsDisclosure` and giving the page one focus contract. Reviewer's flag on record: focus lands on the parent of the button the user just pressed, so the "focus moved *into* what was revealed" affordance is lost — the heading placement is what lets a screen-reader user read forward into it. → **patch**
- [x] [Review][Decision] Eleven duplicate nested `region` landmarks — `TacticalSection.tsx:86` renders `<section id aria-labelledby={headingId}>`, which is already a *named* `region` landmark; `:136-141` then nests `<div role="region" aria-labelledby={headingId}>` inside it with the **same** accessible name. A screen-reader landmark list shows "Estadísticas clave, region" twice per section — 22 entries for 11 sections, and axe's `landmark-unique` rule fires. Ruled decision 7 justified *focusing* the region but never addressed that the wrapping `<section>` already is one. Options: (a) drop `role="region"` from the inner div and keep `tabIndex={-1}` as a bare focus target, (b) drop `aria-labelledby` from the inner div, (c) drop `aria-labelledby` from the `<section>`. **RULED (Juan, 2026-07-26): drop `role="region"` from the inner div.** The `<section>` keeps the named landmark; the inner div becomes a plain content wrapper with no role, no `aria-labelledby` and no `tabIndex` — consistent with D2 moving the focus target to the heading. → **patch**
- [x] [Review][Decision] A schema/matchId mismatch is reported as a network failure, and its retry can never succeed — `MatchBundleRegion.tsx:61` funnels both validation failures into the pre-existing error branch, whose copy is `match.bundle.error` = "No pudimos cargar los datos. Revisa tu conexión e intenta de nuevo." The user is told to check their connection about a payload that arrived intact, and "Reintentar" re-fetches the identical mismatched artifact forever. Two coupled sub-questions: what the distinct copy says, and whether the retry affordance should be suppressed for a mismatch. Related: neither validation branch has a test — `MatchBundleRegion` is a client component and the harness has no jsdom by the 2.2 decision, so the code closing 2.4's D4 shipped unverified by anything but the browser pass. **RULED (Juan, 2026-07-26): distinct copy, no retry button.** New `tactical`/`match.bundle` locale keys (ES canonical + EN mirror) naming a data-integrity failure, and the retry affordance is suppressed on that branch because re-fetching the same artifact cannot help. → **patch**
- [x] [Review][Decision] No error boundary exists anywhere under `app/src/app/`, so the deliberate fail-loud throws blank the entire route — `format.ts`'s helpers throw on non-finite input by design ("never pre-sanitize"), and `KeyStatisticsSection.tsx:134-150` / `:186` call them for 19 fields plus `contestedPossession`. `MatchBundleRegion.tsx:61` validates exactly two scalars before declaring success, then `TacticalLayer.tsx:94` dereferences `bundle.metadata.homeTeam.teamCode`, `bundle.events.*` and `bundle.keyStatistics` unguarded. One bad field or one truncated payload past the gate throws during render, outside the promise chain, so the `error` branch is unreachable — and with no `error.tsx`/`global-error.tsx`, Next's default client-exception page replaces the route, destroying the *pre-rendered Hero* too. Fail-loud is the right instinct; unbounded fail-loud contradicts FR-22's whole premise. **RULED (Juan, 2026-07-26): add `error.tsx` now.** A route-level error boundary so a bad payload degrades to an inline error inside the match page with the Hero and site chrome intact, instead of Next's default client-exception page replacing the route. → **patch**
- [x] [Review][Decision] `events.crosses` is nullable and now ingested, but no section keys on it — `tactical-sections.ts:98-128` maps `shots`, `passNetwork*`, `receiving`, `defensiveActions` and `goalkeeping`; `events.crosses` (nullable per the contract, and the subject of the just-landed Story 1.11 parser) has no section and therefore no FR-22 empty-state path. Either `shot-maps` should key on both (`events.shots !== null && events.crosses !== null`, or a partial-ready state), or the "normative order" this story declares complete is missing a section. Affects the registry 2.6–2.10 inherit. Story 2.7 owns "shot/cross maps", so this is likely its call — but the predicate lives here. **RULED (Juan, 2026-07-26): deferred to Story 2.7** — reason: _"2.7 owns shot/cross maps and should rule."_ → **defer**
- [x] [Review][Decision] Ruled decision 4's stated rationale is factually wrong about the mockups it cites — it claims the six compact fields are "the set both mockups lead with, minus `goals`". The mobile mockup's six rows are Posesión, **Tiros al arco**, Pases completados, Precisión de pases, **Recuperaciones forzadas**, **Tiros de esquina**; the implemented six substitute **xG** and **Tiros** for forced turnovers and corners (corners is not even a `TeamKeyStatistics` field, so the mockup's set is not reproducible). The six chosen are defensible on their own merits and the compactness clause is met — but the justification 2.6–2.10 will inherit is not the one the mockups support. **RULED (Juan, 2026-07-26): correct the rationale, keep the six.** `COMPACT_KEY_STAT_FIELDS` is unchanged; ruled decision 4's justification is rewritten to state what actually drove the choice (the Hero already carries `goals`, corners is not a `TeamKeyStatistics` field so the mockup's set was never reproducible, and xG + shots are what Diego reads first). Doc-only. → **patch**
- [x] [Review][Decision] AC 3's ruled copy drops the section name — AC 3 quotes "Sin datos de {sección} para este partido…"; `es.ts` ships "Sin datos de esta sección para este partido." Ruled decision 1 is sound on the interpolation point (`t()` has none by design). But the Blind Hunter's counter is cheap and worth ruling on: `EmptyStatePanel` already takes `headline` as an *already-resolved string*, and `TacticalLayer.tsx:180` already has the section's resolved `<h2>` title in hand — so passing a section-named headline costs no locale entries and no interpolation. **RULED (Juan, 2026-07-26): compose the section name at the call site.** `TacticalLayer` passes a section-named headline built from the resolved `<h2>` title it already holds — satisfies AC 3's intent with no new locale keys and no interpolation. Ruled decision 1's premise (no `t()` interpolation) stands; its conclusion does not. → **patch**

**Patches** — unambiguous fixes, no human input needed.

- [x] [Review][Patch] JS breakpoints are px while Tailwind's are rem — they desync under a non-16px root font [app/src/lib/use-media-query.ts:18,21]
- [x] [Review][Patch] `aria-controls` references an element that does not exist while collapsed (two sites, lazy-mount consequence) [app/src/components/TacticalSection.tsx:103, app/src/components/KeyStatisticsSection.tsx:215]
- [x] [Review][Patch] The disclosure/spacing precedence loop — the heart of AC 1 — is pure logic sitting untested in a client component while its registry has 24 unit tests; extract to `tactical-sections.ts` and test [app/src/components/TacticalLayer.tsx:143-161]
- [x] [Review][Patch] `sectionDataState` returns a literal `"ready"` for `key-stats`/`phases`/`pressing`/`set-plays` while its own docblock claims "they are mapped anyway so every section answers the same question the same way", and Task 1.3 said to map them; the `never`-guard's stated rationale ("hashes come from the URL") is also unreachable, since `sectionIdFromHash` already filters against `SECTION_IDS` [app/src/lib/tactical-sections.ts:101,114-117,120-126]
- [x] [Review][Patch] `list.addEventListener` is outside the try/catch whose own comment promises "never take the page down" [app/src/lib/use-media-query.ts:40]
- [x] [Review][Patch] `getSnapshot` mints a fresh `MediaQueryList` via `window.matchMedia()` on every render and every store notification [app/src/lib/use-media-query.ts:47]
- [x] [Review][Patch] `TacticalSection`'s `id` prop is typed `string`, discarding the `SectionId` union the rest of the story goes to lengths to enforce [app/src/components/TacticalSection.tsx:40]
- [x] [Review][Patch] The AR-11 absence guard checks 2 of 11 section ids and 1 of 11 titles; loop all eleven [app/src/app/matches/static-output.test.ts:176-185]
- [x] [Review][Patch] The revealed overflow rows get no `role="region"`, no `aria-labelledby`, no `tabIndex` and no focus move, while `TacticalSection` gives all four to its revealed content on the same page for the same interaction [app/src/components/KeyStatisticsSection.tsx:221-225]
- [x] [Review][Patch] The comment derives "h-14 = 3.5rem" and then sets 4.5rem without noting the +1rem breathing room, leaving the next person unsure which number is load-bearing [app/src/app/globals.css:357-362]
- [x] [Review][Patch] The header comment's "19 rows at ~56px is ≈1.3 viewports" understates its own case — the rendered tile measures ~79–94px including `gap-tile-gap`, per this story's own browser evidence (6 rows + caption + button = 661px) [app/src/components/KeyStatisticsSection.tsx:29-30]

**One patch dissolved rather than shipped.** The review flagged that the revealed overflow rows in `KeyStatisticsSection` had no `role="region"`/`aria-labelledby`/`tabIndex`/focus move while `TacticalSection`'s revealed content had all four — an inconsistency on one page. Decision D4 resolved it in the opposite direction: `TacticalSection`'s content wrapper became a plain `<div>` too, so both disclosures now reveal plain containers and the inconsistency is gone. Adding the four attributes here would have re-introduced the duplicate-landmark defect D4 exists to remove.

**Post-patch verification (2026-07-26).** `npm run build` green (lint `--max-warnings 0` → tsc → schema assert → next build → copy-data); `npm test` **138 passed / 10 files** (131 before the review; +7 from the new `buildSectionPlans` suite). Re-verified in Chrome against a static server rooted at `app/out/`, because D1/D2/D4 changed the disclosure model and the original Task 10.3–10.5 evidence no longer describes the build:

- **`≥lg` (1920 px), m001:** 11 sections; **9** tactical disclosure triggers all `aria-expanded="true"`; **9** summary lines — the reverse of the pre-review build, and what decision D1 ruled. **0** elements with `role="region"` (the 22-landmark duplication is gone, D4); 11 content wrappers mounted; **0** dangling `aria-controls`; all 11 `<h2>`s carry `tabIndex={-1}`.
- **Toggle:** collapsing `#shot-maps` unmounts its content and **removes** `aria-controls` from the trigger; re-opening remounts it and restores the attribute — the lazy-mount/ARIA fix, observed rather than assumed.
- **Focus (D2):** on a user toggle focus lands on `#shot-maps-heading` (`H2`), and on a `#pressing` hashchange on `#pressing-heading`, with the section top at 72 px clear of the sticky header's 57 px bottom.
- **Empty state (D3), m002:** "Sin datos de **Línea de momentum** para este partido." / after an EN toggle, "No data for **Momentum timeline** in this match." — AC 3's section name restored with no interpolation and no per-section keys. Still non-collapsible: no trigger, no summary, dashed border, 128 px.

_Not re-verified: the 390 px fold measurements and the 200 %-zoom probe (Task 10.2), which the deferred item below already owns; and the `<lg` collapsed-by-default first paint, since this Chrome window would not resize below 1024 px — the collapsed presentation was exercised by toggling instead, which drives the same code path._

**Deferred**

- [x] [Review][Defer] Task 10.2's 200 %-zoom clause fails at 195 CSS px and `#key-stats` is one of the three named owners, but the subtask is checked `[x]` [app/src/components/KeyStatisticsSection.tsx:93] — deferred, already filed for Story 2.19 and disclosed in the Debug Log; the checkbox should be annotated rather than the condition patched here
- [x] [Review][Defer] Crossing a breakpoint unmounts a focused content region and drops focus to `<body>`; `showAll` silently persists across the `md` boundary [app/src/components/TacticalLayer.tsx:150, app/src/components/KeyStatisticsSection.tsx:199-200] — deferred, requires a resize-aware focus policy this story has no ruling for
- [x] [Review][Defer] Hash re-entry edge cases: re-activating the *same* fragment never re-fires (browsers do not fire `hashchange` for an identical hash), a post-retry remount re-reads the still-present hash and re-scrolls, and a Back button out of a section fires `hashchange` and yanks focus back into it [app/src/components/TacticalLayer.tsx:58-72] — deferred, needs a consumed-hash/popstate policy
- [x] [Review][Defer] The loading skeleton and the error retry panel now stretch the full 1152px container; only `MatchHero` was re-wrapped in `max-w-2xl` [app/src/app/matches/[slug]/page.tsx:67-73] — deferred, cosmetic and arguably correct since the Tactical Layer below is full-width by design

## Dev Notes

### What this story is, in one line

The Tactical Layer's **scaffolding** — 11 section shells in normative order with real anchors and disclosure behaviour — plus **one** real content block (Key Statistics) and the **shared empty-state component** that stories 2.6–2.10 will each depend on. Everything else stays a shell.

### The load-bearing structural fact: the Tactical Layer is client-only

AR-11 pins two data paths and only two: build-time filesystem reads for the shell/meta/Hero, client fetch for **everything below the Hero**. `MatchBundleRegion` already owns that fetch and bakes `status: "loading"` into the exported HTML. Consequences you must design around, not fight:

- **No Tactical markup exists in `out/`.** Static-output assertions cannot cover this story's ACs (Task 9.3 turns that into an assertion instead of a gap).
- **Deep links land before the target exists.** The browser resolves `#momentum` against a document that has no `#momentum`, gives up, and never retries. Task 4.5's mount-time hash read is not belt-and-braces — it is the only thing that makes anchors work.
- **First client render is the first render of this subtree**, so `useSyncExternalStore` over `matchMedia` is safe and flash-free; there is no server markup for it to mismatch.
- Do **not** move the Tactical Layer to the build-time path to make testing easier. That is the one change this story must not make.

### Contract shapes (fixture-verified, quote-accurate)

- `MatchBundle.keyStatistics` = `{ home: TeamKeyStatistics, away: TeamKeyStatistics, contestedPossession: Percentage }`. `contestedPossession` is match-level: "the page prints possession as home / contested / away, and the three sum to 100, so the middle value cannot be derived from the two team values" (schema description, verbatim).
- `TeamKeyStatistics` — 19 required fields, in the source page's row order: `possession, goals, expectedGoals, shots, shotsOnTarget, passes, passesCompleted, passCompletion, completedLineBreaks, defensiveLineBreaks, receptionsInFinalThird, crosses, ballProgressions, defensivePressures, directPressures, forcedTurnovers, secondBalls, distanceCovered, sprintDistance`. All non-nullable numbers — no null guards needed (the 2.4 review dismissed that class of finding for the same reason). `sprintDistance` is the page's "Zone 4 — Low Speed Sprinting: 20-25 km/h" row; both distances are kilometres.
- m001 `keyStatistics.home`: possession 57.1, goals 2, xG 1.78, shots 16, on target 4, passes 547, completed 495, completion 90.0, distance 107.3, sprint 5.3. `contestedPossession` 6.8 (m002 10.0, m074 10.8).
- **Nullable slices (the only ones that can ever trigger an empty state):** `momentum`, `events.shots`, `events.crosses`, `events.passNetworkNodes`, `events.passNetworkEdges`, `events.receiving`, `events.defensiveActions`, `events.shootoutAttempts`, `goalkeeping`, `players`. `keyStatistics`, `tacticalIdentity` and `setPlays` are required objects — their empty state is **unreachable at contract v1** and exists only for uniformity. Say so in a comment rather than pretending otherwise.
- **Fixture reality:** the only `null` across all three bundles is m002's `momentum` (plus `shootoutAttempts` on the two group matches, which no section keys on). So exactly one section on one fixture renders the empty state in the browser; every other empty path must be proven by constructed-object unit tests (Task 9.1). Story 1.18's fixture request FR-1 will add `goalkeeping: null`, `players: null`, `events.*: null` and an empty `[]` array later — the tests you write now are what will catch a regression then.
- `MomentumSample` = `{ minute, home, away }` — for reference only; 2.6 owns momentum rendering.
- `MetricCode` is deliberately string-identical to the artifact field names it ranks ("so a board's code names the artifact field it ranks") — which is why Task 7.2 keys `enums.metric` by field name: Story 2.13 inherits 18 of its 32 labels for free.

### Existing code you build on (do not reinvent)

- `src/lib/match-hero.ts` — `resolveLeader(home, away): "home" | "away" | "tie"` is already the ruled leader predicate. Import it. Do not copy it, do not move it to a new module, do not "generalize" it.
- `src/components/StoryStatTiles.tsx` — the reference implementation of the UX-DR7 treatment (accent + `aria-hidden` ▲ + `sr-only` leader, `cn()` for class composition, `type-stat-value`). Mirror its structure in `StatPairTile`; do **not** refactor it into a shared component (a Hero regression is not worth the DRY).
- `src/lib/format.ts` — `formatDecimal / formatInteger / formatPercent` (+ `formatDate / formatKickoff / compareText`). The only formatting path. All fail loud on non-finite input.
- `src/lib/i18n-provider.tsx` — `useT()` / `useLocale()`; mandatory in `src/components/**` (enforced by `no-restricted-imports`; a direct `t()` import there is a lint error). `t()` has **no interpolation** and takes a statically-typed dot path.
- `src/lib/data.ts` — `fetchArtifact<T>()`, the only runtime fetch path; already called once by `MatchBundleRegion`. Do not add a second call site.
- `src/lib/contract/schema-version.ts` — `SCHEMA_VERSION` for Task 6.2. Never hardcode the integer.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge). Every vendored component uses it; the 2.4 review patched hand-rolled template-literal `className`s. Use `cn()`.
- Tokens in `globals.css`: `type-headline` (22 px, section `h2`), `type-title`, `type-body`, `type-stat-value`, `type-stat-label`, `type-label-caps`, `type-caption`; colors `surface-raised/overlay`, `ink-primary/secondary/muted`, `border-hairline`, `viz-team-a/b`; spacing `tile-gap` 12 / `section-gap` 48 / `layer-gap` 64; radii sm/md/lg. **No new tokens or utilities** — the only CSS addition allowed is Task 8's `scroll-padding-top`.
- `radix-ui` **is** already a dependency, so a shadcn Accordion could be vendored — deliberately not doing that (ruled decision 6). No new runtime dependencies either way.

### Ruled decisions (spec gaps closed by this story — flag in review if any looks wrong)

1. **Empty-state copy carries no section name.** EXPERIENCE's "Sin datos de {sección}…" is a template slot; `t()` has no interpolation (2.1's typed-dictionary design) and per-section noun forms would add 22 locale entries for a name the adjacent `<h2>` already states. Two keys, section-independent headline. The momentum-specific wording stays 2.6's.
2. **Section summaries are static locale copy in this story.** The mockup's data-derived summaries ("MEX 14 tiros · ARG 11 · 3 goles") need each section's own data plumbing, which is 2.6–2.10's work; deriving them here would also be client-side derivation (AD-5's carve-out is narrow). The registry types `summary` so a later story can swap in artifact values for its own section.
3. **`key-stats` and `momentum` never collapse.** UX-DR6 collapses "each dense section" at `<lg`; both mockups render exactly these two expanded at 390 px, and UJ-1's ~15-second story is *reading* them. The other nine collapse.
4. **`<md` key statistics = 6 compact rows + "Ver todas las estadísticas".** AC 2 demands both the *full* block and enough compactness that one scroll still reaches the momentum slot; 19 rows at ~56 px is ≈1.3 viewports and cannot satisfy the second clause. The disclosure satisfies both and matches the "declutter without deleting" pattern EXPERIENCE already rules for pass networks (SM-C2: nothing is removed). The six: possession, xG, shots, shots on target, completed passes, pass accuracy. _Rationale corrected by the 2.5 review (decision D8) — the original claim that these are "the set both mockups lead with, minus `goals`" is factually wrong. The mobile mockup's six are possession, **shots on target**, completed passes, pass accuracy, **forced turnovers** and **corners**, and `corners` is not a `TeamKeyStatistics` field at all, so that set was never reproducible. What actually drives this six: `goals` is out because the Hero scoreline already carries it, and `expectedGoals` + `shots` are in because they are what Diego reads first (UJ-1)._ *Rejected alternative:* render all 19 at `<md` (AC-literal on clause one, measurably breaks clause two).
5. **Higher value = leader, uniformly, for all 19 fields.** The contract carries no per-metric polarity for `TeamKeyStatistics` (`higherIsBetter` exists only on leaderboards), and inventing one would be an editorial value model. Consequence to accept knowingly: on a field where "more" is not obviously better, the higher number still takes the accent. Same rule 2.4 applied to the five Hero tiles.
6. **Native `<button aria-expanded>` inside `<h2>`, not a vendored Accordion.** Radix's Accordion owns its own mount/unmount and animation and would have to be defeated for the always-expanded `≥lg` case and for lazy mounting; the heading-wrapping-button pattern is the standard accordion structure, matches `LineupsDisclosure`'s precedent, and adds no vendored component. (It also settles 2.4's open D6 question — visible section titles are real headings here.)
7. ~~**Focus on expand goes to the revealed content region**, not the heading.~~ **OVERTURNED by the 2.5 review (decision D2).** Focus goes to the revealed **heading**, as AC 1 and UX-DR6 both say in as many words, and as `LineupsDisclosure` already did — one focus contract per page. The original argument (the heading sits inside the always-visible trigger) is real but was outweighed by the AC's explicit wording; the heading placement is what lets a screen-reader user read forward into what was revealed. Consequence of the reversal, accepted knowingly: the content wrapper needed neither `role="region"` nor `tabIndex`, which also removed the duplicate-landmark defect the review found (decision D4).
8. **No glossary underlines in the Tactical Layer yet.** A dotted cyan underline is an affordance; with no tooltip behind it, it is a broken promise. 2.18 marks terms once, across the whole layer, with the real popover. The Hero's existing xG treatment is out of scope and stays.
9. **A `ready` section with no content component yet gets a distinct "pending" panel**, never the empty state. Claiming "the official report does not include this section" about a section whose data is sitting in the bundle is exactly the dishonesty FR-22 exists to prevent (UJ-2's failure path: Diego trusts the rest *because* absence is named accurately).
10. **An `empty` section never collapses**, at any width. UX-DR13's "never a silent absence" is not satisfied by an absence you have to tap to discover, and a collapsed shell for missing data would need a summary line describing data that does not exist. Heading + panel, always visible.

**AD-5 clearance (pre-empting the obvious review question):** nothing here derives a number. The 19 values render verbatim from `keyStatistics`, and leader determination is explicitly named as allowed presentation geometry — AD-5: "the App may derive *presentation geometry only* (shared axis domains, **leader-accent determination between two displayed values**)". No sums, no averages, no cross-match values, and no client-derived section summaries (ruled decision 2 keeps them static precisely so this stays true).

### Prior-story intelligence you must not re-learn the hard way

From the 2.1 / 2.2 / 2.4 reviews (each cost a patch round):

- `outline-none` anywhere kills the global `:focus-visible` ring — the compiled utility beats the `@layer base` rule. Never.
- `min-h-11` belongs on the interactive element, not on a wrapper `<li>`/`<div>` around it.
- Arbitrary type sizes (`text-[13px]`) are rejected on sight; `globals.css` is the single token source.
- Hand-rolled `className` template literals ship dangling separators and skip tailwind-merge — use `cn()`.
- Tests that restate the function under test prove nothing (`expectedTitle = composeMatchTitle(...)` vs the page that calls `composeMatchTitle`). Assert literals and structure.
- Silent-discard branches get flagged: `groupScorers` dropping unmatched goals, `composeMatchTitle` skipping the pen suffix. If `sectionDataState` or the dispatch can fall through, make it throw with the offending value (a `default:` that throws on an unknown `SectionId`).
- `skipIf`-style test guards must key on the coarse artifact (`out/`) and then assert the specific one exists, or a partial export reports green.
- The i18n gate cannot see inside a template literal assigned to a variable — that is a hole, not a licence: route separator glyphs through the locale layer or module consts anyway.

### Boundaries — do NOT build (later stories own these)

Momentum chart + its dedicated empty state and "Ver los datos" table (2.6); pitch panels, shot/cross maps, popovers, Voronoi hit areas (2.7); pass networks (2.8); receiving + defensive-action maps (2.9); phases/pressing/set-plays/goalkeeping content (2.10); the **Expert Layer and its `#expert` anchor** (2.11) — this story builds 11 Tactical anchors, not 12; glossary tooltips (2.18); real-data swap and Lighthouse/a11y hardening (2.19). Do not derive any cross-match value (AD-5). Do not add jsdom, Testing Library, a state library, a client cache, a new Context, or any runtime dependency. Do not touch `pipeline/**`, `contract/**`, `data/**`, the layout/providers/bootstrap/storage/format modules, or the vendored `ui/*` components.

### Coordination & hygiene

- Stories **1.10** and **1.12** are in dev in other sessions and touch `pipeline/` only; the working tree carries their uncommitted changes plus `probe_counts.json`. **Never `git add -A`** — stage `app/`, `_bmad-output/implementation-artifacts/2-5-*.md` and `sprint-status.yaml` explicitly (2.3 review lesson).
- CS-1 (the 2.3 sign-off change-set) will bump `schemaVersion` 1→2 before Story 1.16 and regenerate fixtures + types. None of its values are Domain B fields, but never hardcode `SCHEMA_VERSION` or any enum; if the bump lands mid-story, run `npm run generate:types` and continue.
- Data source stays `data/fixtures/` until 1.19 (AD-14). Both `DATA_ROOT`s flip together in 2.19 — do not touch either.
- Test baseline at `6652fc3`: **103 passed, 9 files**, `npm run build` green.

### Latest-tech notes (pinned stack, verified against the installed lockfile)

Next 16.2.11 / React 19.2.8 / TypeScript 6.0.x / Tailwind 4.3.x / vitest 3.2.7, `radix-ui` 1.6.5 present. `useSyncExternalStore` is stable React and the correct primitive for `matchMedia` (an effect-based hook renders one frame at the wrong breakpoint). `next build` does not lint — the npm `build` chain is the gate. `trailingSlash: true`, so deep links are `/matches/{slug}/#anchor`. Under `output: 'export'` there is no server component boundary below the Hero to move work to; client-only is the design, not a limitation.

### Project Structure Notes

- **CREATE:** `app/src/lib/tactical-sections.ts` + `tactical-sections.test.ts`; `app/src/lib/use-media-query.ts`; `app/src/components/TacticalLayer.tsx`; `app/src/components/TacticalSection.tsx`; `app/src/components/EmptyStatePanel.tsx` (exports `EmptyStatePanel` + `PendingSectionPanel`); `app/src/components/KeyStatisticsSection.tsx`.
- **UPDATE:** `app/src/components/MatchBundleRegion.tsx` (hold + validate payload, render the layer); `app/src/app/matches/[slug]/page.tsx` (container width only); `app/src/locales/es.ts` + `en.ts`; `app/src/app/globals.css` (`scroll-padding-top` only); `app/src/app/matches/static-output.test.ts` (Task 9.3).
- Naming: PascalCase component files in `src/components/`; client route bodies live in `src/components/`, never colocated under `src/app/` (that path escapes the i18n import seam — a known deferred gap; do not trigger it).

### References

- Epics: story spec + AR/FR/NFR/UX-DR texts — `_bmad-output/planning-artifacts/epics.md` ("Story 2.5"; UX-DR6/7/11/13/18; AR-5/10/11/12)
- Architecture: `.../architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md` (AD-11 rendering split verbatim, AD-5 aggregation carve-out, AD-7 units/enums, AD-10 state rules, AD-12 i18n, AD-14 fixtures)
- UX: `.../ux-designs/ux-wc-stats-2026-07-21/EXPERIENCE.md` (Component Patterns → Layer section shell / Stat tile / Empty-state panel; State Patterns; Accessibility Floor; Progressive Disclosure Contract; Responsive table; i18n term table), `DESIGN.md` (`{components.layer-shell}`, `{components.stat-tile}`, `{components.empty-state-panel}`, spacing rhythm, `max-w-6xl`), `mockups/key-match-dashboard-mobile.html` (390 px: key-stats + momentum expanded, nine collapsed shells with anchors), `mockups/key-match-dashboard-desktop.html` (`.kgrid` two-column paired tiles — expanded-tactical reference). Mocks illustrate; spines win on conflict.
- Contract/fixtures: `contract/match-bundle.schema.json` (`TeamKeyStatistics`, `KeyStatisticsBlock`, `EventTables` null-vs-`[]` `$comment`s); `app/src/lib/contract/contract-types.d.ts`; `data/fixtures/matches/m001-mexico-south-africa.json`, `m002-korea-republic-czechia.json` (`momentum: null`), `m074-germany-paraguay.json`
- Prior stories: `2-4-match-route-hero-layer.md` (Hero patterns, review findings, the seven open decisions — D4 is closed by Task 6.2), `2-2-site-chrome-...md`, `2-1-static-app-scaffold-...md`; `_bmad-output/implementation-artifacts/deferred-work.md` (2.4 review items; the `LineupsDisclosure` empty-array item is explicitly waiting on this story's ruling)
- App code: `app/src/components/{MatchBundleRegion,StoryStatTiles,LineupsDisclosure,SiteHeader}.tsx`, `app/src/lib/{match-hero,format,i18n,i18n-provider,data,utils}.ts`, `app/src/app/globals.css`, `app/eslint.config.mjs`

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m] (Claude Code, `bmad-dev-story`)

### Debug Log References

**Build chain + suite (Task 10.1).** `npm run build` (lint `--max-warnings 0` → tsc → schema assert → next build → copy-data) green; 3 routes pre-rendered. `npm test`: **131 passed / 10 files** (baseline at `6652fc3`: 103 / 9). New: 24 in `tactical-sections.test.ts`, 3 in `i18n.test.ts`, 1 in `matches/static-output.test.ts`.

**Browser verification** — static server rooted at `app/out/` (`python -m http.server 8765 --directory app/out`), Chrome, `trailingSlash: true` URLs.

*Environment note:* Chrome's own minimum window width is 500 px, so the mobile pass ran at **500 CSS px** (below both `md` 768 and `lg` 1024, so the identical `<md`/`<lg` branches are exercised) and the 390 px reflow was measured by forcing the layout width (`documentElement.style.width`) — both widths are `<md`, so only the reflow differs, not the rendered branch.

- **10.2 — 390 px fold, m001.** Hero bottom **712** → `#key-stats` top **776** (= 64 px `layer-gap`, applied once by `MatchBundleRegion`) → `#momentum` top **1437**. `#key-stats` renders the 6 compact rows + "Ver todas las estadísticas"; `#momentum` expanded with its pending panel; then the nine collapsed shells. At a forced 390 px layout width: `body.scrollWidth` **390**, **0** elements overflowing → zero horizontal scrolling. Also probed at **320 px** (WCAG 1.4.10 reflow threshold): `scrollWidth` 320, **0** overflowing.
  *200 % zoom (= 195 CSS px at a 390 px device):* 32 elements overflow — owners are `header` (2.2 toggles), `hero` (2.4 score row) **and** `key-stats`. A paired tile's min-content width is **247 px** (fixed 76 px value tracks + `px-4` + the label), so it cannot fit 195 px without abandoning the type ramp. Page-wide condition, not introduced here; filed in `deferred-work.md` for 2.19 rather than silently reported as passing.
- **10.3 — ≥1024 px (1920 px actual).** _SUPERSEDED by the 2026-07-26 review patches — decisions D1/D2/D4 inverted the first three counts. Post-patch figures are in the Review Findings verification block above; the rest of this entry still holds._ ~~11 sections, **0** disclosure triggers, **0** summary lines (matches the desktop mockup, which draws plain `<h2>`s), 11 content regions~~ → now 11 sections, **9** triggers (`aria-expanded="true"`), **9** summary lines, 11 plain content wrappers with **0** `role="region"`; key stats in a two-column grid (`546px 546px`) of **19** rows; `margin-top` between every section pair **48 px** (`section-gap`); `border-top: 1px rgb(42,49,56)` (`border-hairline`); 10 pending panels; `scroll-padding-top: 72px`; no horizontal scroll.
- **10.4 — Keyboard at `<lg`.** All **9** triggers are 44 px tall and tabbable. Enter on `#shot-maps` → `aria-expanded` `false→true`, content mounts, computed `outline-width` **2px** (global `:focus-visible --ring`). _Focus target superseded by decision D2: it now lands on `#shot-maps-heading`, not `#shot-maps-content`, and the wrapper no longer carries `role="region"`._ Space → `true→false`, content **unmounts** (lazy mount confirmed), focus stays on the trigger. `aria-controls="shot-maps-content"`, `aria-describedby="shot-maps-summary"`.
- **10.5 — Deep links.** `/matches/m001-mexico-south-africa/#defensive-actions` at `<lg`: after the bundle resolves the section auto-expands, section top **72 px** vs sticky-header bottom **57 px** (clears it), focus on `#defensive-actions-`_`heading`_ _(was `-content` — superseded by decision D2; the 72/57 geometry re-verified unchanged post-patch on `#pressing`)_. Setting `#pressing` (hashchange): expands, top 134 px, focus on `#pressing-content`. Same behaviour re-verified at ≥lg (72 px / 105 px).
- **10.6 — m002 (`momentum: null`).** At both widths: heading "Línea de momentum" + `#momentum` anchor kept, **no trigger**, **no summary**, dashed-border panel **128 px** tall carrying headline + explanation, visible without any tap. The other nine shells behave normally.
- **10.7 — EN + theme.** After toggling EN: `<html lang="en">`, all 11 titles, the 9 summaries, all 19 stat labels, the pending/empty copy and the `sr-only` leader string swap ("líder"→"leader"); numbers reformat (`1,78`→`1.78`, `107,3`→`107.3`), unit labels compose as `Distance (km)`. Light theme: dashed borders, tiles and both team accents hold.

### Completion Notes List

- **Section registry is the single source of order.** `SECTION_IDS` array order *is* render order; `ALWAYS_EXPANDED_SECTION_IDS` / `COLLAPSIBLE_SECTION_IDS` encode ruled decision 3 in the type system, and `sectionSummaryKey` only accepts a `CollapsibleSectionId`, so a summary key for `key-stats`/`momentum` is a compile error rather than dead copy.
- **`sectionDataState` keys on `null`, never on `.length`.** Constructed-bundle tests pin `[] → ready` / `null → empty` for shots, defensive actions, receiving (both sections flip together), both pass-network tables and goalkeeping — the paths no fixture exercises today and that Story 1.18's FR-1 fixtures will exercise later. An out-of-union id throws with the offending value.
- ~~**Deviation from the story's literal Task 4.3 wording, resolved toward AC 1 and the mockups:** at `≥lg` a collapsible section renders in the **non-collapsible presentation** (plain `<h2>`, no trigger, no summary line), not as an open disclosure.~~ **Overturned by the 2.5 review (decision D1).** The other reading *was* intended: Task 4.3 is literal, so at `≥lg` the nine collapsible sections are real disclosures that merely default to open — trigger, `aria-expanded`, summary line and all. Task 3.1's conflicting clause was the error and has been corrected.
- **Focus-on-expand is nonce-driven, not `open`-driven.** `TacticalSection` moves focus on an explicit request from the layer (user toggle or anchor), so a viewport change that opens all nine sections at `≥lg` — and the initial `≥lg` render — never steal focus. **The target is the `<h2>` heading** (`tabIndex={-1}`), per AC 1's own words: the 2.5 review's decision D2 overturned ruled decision 7, which had sent focus to the content region.
- **Closes 2.4 deferred decision D4.** `MatchBundleRegion` now holds the payload and validates it before declaring success: `bundle.matchId === matchId` and `bundle.schemaVersion === SCHEMA_VERSION` (from the generated module, never hardcoded); a mismatch takes the existing `"error"` branch. Retry clears the held bundle. The fetch, skeleton, announcement and retry lifecycle are otherwise untouched.
- **`enums.metric` is keyed by `TeamKeyStatistics` field name** (string-identical to `MetricCode` for 18 of 19), so Story 2.13 inherits those labels; `i18n.test.ts` asserts one entry per `KEY_STAT_FIELDS` entry in both locales, so a contract field added later fails loudly instead of rendering unlabelled.
- **AD-5 clearance holds:** nothing is derived. The 19 values render verbatim; leader determination is the explicitly-allowed presentation geometry; section summaries are static locale copy (ruled decision 2).
- **Not built (later stories own them):** every section other than `#key-stats` renders `PendingSectionPanel` — deliberately distinct copy from the empty state (ruled decision 9). Stories 2.6–2.10 each delete their own placeholder line from the single dispatch switch in `TacticalLayer.tsx`.

### File List

**Created**
- `app/src/lib/tactical-sections.ts`
- `app/src/lib/tactical-sections.test.ts`
- `app/src/lib/use-media-query.ts`
- `app/src/components/TacticalLayer.tsx`
- `app/src/components/TacticalSection.tsx`
- `app/src/components/EmptyStatePanel.tsx`
- `app/src/components/KeyStatisticsSection.tsx`
- `app/src/components/TacticalErrorBoundary.tsx` _(added by the 2.5 review, decision D6)_

**Modified**
- `app/src/components/MatchBundleRegion.tsx`
- `app/src/app/matches/[slug]/page.tsx`
- `app/src/app/globals.css`
- `app/src/app/matches/static-output.test.ts`
- `app/src/lib/i18n.test.ts`
- `app/src/locales/es.ts`
- `app/src/locales/en.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-5-tactical-layer-shell-key-statistics-empty-state-pattern.md`

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-24 | Story 2.5 implemented: Tactical Layer shell (11 sections, registry-ordered anchors, `<lg` accordion with lazy-mounted content), Key Statistics section (19 paired tiles, 6 + disclosure at `<md`), shared `EmptyStatePanel` / `PendingSectionPanel`, `tactical.*` + `enums.metric` / `enums.unit` locale entries, `scroll-padding-top`, route container widened to `max-w-6xl`. Bundle payload now held and validated (closes 2.4 D4). Tests 103 → 131. Status → review. |
| 2026-07-26 | Code review (3 adversarial layers): 8 decisions resolved, 18 patches applied, 5 deferred, 12 dismissed. Disclosure model reworked per D1 — collapsible sections are real disclosures at every width, defaulting to open at `≥lg` (Task 3.1's conflicting clause corrected). Focus moved to the revealed heading per AC 1 (D2, overturning ruled decision 7), which also removed the duplicate `region` landmarks (D4). Empty-state headline now names its section (D3). Schema/matchId mismatch split into its own retry-less `invalid` branch (D5); `TacticalErrorBoundary` added so a fail-loud throw no longer blanks the route (D6). Disclosure/rhythm logic extracted to the pure `buildSectionPlans` and unit-tested; breakpoints moved px → rem; `aria-controls` no longer dangles. Ruled decision 4's rationale corrected (D8); `events.crosses` registry gap deferred to 2.7 (D7). Tests 131 → 138. Status → done. |

---
name: wc-stats
description: Experience specification for the WC2026 analytics site
status: final
updated: 2026-07-21
sources:
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-wc-stats-2026-07-21/addendum.md
  - project-brief-wc2026-analytics.md
---

# wc-stats — Experience Spine

> Paired with `DESIGN.md` (visual identity). This spine specifies behavior only; visual values are referenced by `{path.to.token}` and never restated. shadcn/ui + Tailwind: only behavioral deltas over shadcn primitives are specified — unlisted shadcn behavior is inherited. Spines win on conflict with any mock or wireframe.

## Foundation

Responsive web, mobile-first for the Hero Layer and Tournament Hub — a direct answer to the source's failure mode: 52-page PDFs are unreadable on a phone, and this product's job is to liberate that data. Next.js static export on Netlify free tier (FR-33): no backend, no auth, no server functions — every route pre-rendered, all interactivity (layer expansion, sorting, filtering, comparison, language, theme) client-side (FR-34). shadcn/ui on Tailwind is the component base; `DESIGN.md` is the visual identity reference and defines the token layer.

Two audiences, one surface: casual fans (Mariana — mobile, Spanish, ~15 seconds) and tactical analysts (Diego — desktop, density-tolerant, cites and screenshots). They are served by the same pages through the Progressive Disclosure Contract (below), never by separate apps or "simple mode" toggles.

Hard budgets that shape every behavior in this document: ≤500 KB compressed payload per route (FR-18/FR-34), Lighthouse mobile ≥90 on Match Dashboard and Tournament Hub, WCAG 2.1 AA intent, 390px Hero test viewport.

Browser support: current evergreen browsers only (latest two majors of Chrome, Edge, Firefox, Safari — desktop and mobile); no legacy or polyfill burden (PRD §5 NFR).

## Information Architecture

| Route | Surface | Reached from | Purpose |
|---|---|---|---|
| `/` | Tournament Hub | Entry, header logo | Results & standings by stage/group (FR-25), leaderboards (FR-26), entry to everything |
| `/matches/{match-slug}` | Match Dashboard | Hub results, profiles' per-match values, shared links, header search | One page per match: Hero → Tactical → Expert Layer (FR-21/22/23) |
| `/players/{player-slug}` | Player Profile | Leaderboards, lineups, header search | Aggregates, per-match series, physical profile, trends (FR-27) |
| `/teams/{team-slug}` | Team Profile | Standings, match header, header search | Tournament-wide tactical identity + per-match breakdowns (FR-28) |
| `/compare` | Comparison Mode | Hub, Player/Team Profile "Comparar" actions | Two players, two teams, or two matches side by side (FR-29) |
| `/glossary` | Glossary | Footer, every glossary tooltip's "see more" | Full tactical-term glossary, both languages |
| `/about` | About & data attribution | Footer attribution line | Data source statement, methodology, project credits, and the free/open independent passion-project framing (OQ-3) |
| `/404` | Not found | Any unknown URL | Static 404 (see State Patterns) |

- **Slugs** are language-neutral English/romanized, stable, human-readable — e.g. `/matches/m73-mexico-argentina`, `/players/ramirez-julian-mex`, `/teams/mexico` [ASSUMPTION: slug format; sources require only stable human-readable share-friendly URLs. Player slugs carry team code to disambiguate duplicate names — OQ-4 surface].
- **Language is not in the URL.** One pre-rendered HTML per route (Spanish-default content for SEO/link previews); the persisted locale swaps strings client-side per the Locale bootstrap mechanism (i18n & Terminology) (FR-31). [ASSUMPTION: single-tree i18n rather than `/en/` route duplication, to hold the route count and payload budget; revisit only via logged decision.] Consequences owned (logged): English content is invisible to search engines (no `/en/` URLs); link previews and share cards are always Spanish, even for links shared by EN users; **no `hreflang` is emitted** — a lone self-referencing hreflang would be worse than none.
- **Header search** [ASSUMPTION: scope addition beyond PRD FRs — logged deliberately]: a lightweight client-side typeahead over the Tournament Index (players, teams, matches) in the site header on every route. No search route, no server, no payload beyond the already-shipped Tournament Index. Behavioral spec: Component Patterns → Header search. This is the "search" entry path named in the route table above.
- **Link-preview meta:** every match, player, and team route pre-renders a meaningful `<title>` and OG description — match: teams + score + stage; player: name + team; team: name + tournament record (§5 shareability) [ASSUMPTION: exact meta patterns proposed].
- **Comparison URLs are shareable** [ASSUMPTION]: `/compare?type=players|teams|matches&a={slug}&b={slug}`. The `/compare` route is one pre-rendered shell; params are read client-side and the two entity bundles are fetched on demand. Profile "Comparar" actions deep-link with `a` pre-filled.
- **Mandatory cross-links:** every Hub result row → its Match Dashboard, all 104 matches reachable (FR-25); every per-match value on a Player Profile → that Match Dashboard (FR-27), anchored to the relevant section; Comparison Mode reachable from Hub and both profile types (FR-29); match header team names → Team Profiles; lineup player names → Player Profiles.
- **Deep-link anchors:** every Match Dashboard section has a stable anchor (`#key-stats`, `#momentum`, `#shot-maps`, `#pass-networks`, `#offers-to-receive`, `#movement-to-receive`, `#defensive-actions`, `#phases`, `#pressing`, `#set-plays`, `#goalkeeping`, `#expert`). Navigating to an anchor auto-expands its section if collapsed.
- Attribution placement: persistent footer line on every route + `/about` + the in-panel caption on every pitch panel (see i18n & Terminology for wording).

## Voice and Tone

Microcopy only; aesthetic posture lives in `DESIGN.md`. Spanish is the default voice; English strings are variants, not the source of truth. Register: **tuteo**, neutral Latin-American Spanish — warm but sober, no regionalisms, no exclamation marks [ASSUMPTION: tuteo over usted — consumer product, young sports audience; Bogotá-formal `usted` would read stiff in UI].

| Do | Don't |
|---|---|
| "Sin datos de momentum para este partido." | "¡Ups! Algo salió mal 😅" |
| "Velocidad máxima" / "Top speed" | "Speed máxima" (mixed-language strings) |
| "Ver los datos" — the one canonical control string (Component Patterns) | "Click aquí", or ad-hoc variants of canonical strings |
| Numbers carry the drama; copy stays flat: "3 goles en 11 minutos." | Editorializing: "¡Qué remontada increíble!" |
| Terms follow the i18n & Terminology table exactly | Ad-hoc translations of tactical terms per screen |

**Number formatting** [ASSUMPTION: `es-CO` conventions for Spanish]: Spanish uses comma decimals and dot thousands — `xG 1,24`, `10,4 km`, `34,2 km/h`, `62%`; English uses `1.24`, `10.4 km`, `62%`. Implemented via `Intl.NumberFormat('es-CO' | 'en')`; no hand-formatted numbers. `62%` without the RAE-prescribed space before `%` is a deliberate, logged UI choice. Data names (teams, players, venues) display as-is from source — English source strings are never translated (i18n is a UI-copy axis only, FR-30).

**Date formatting** [ASSUMPTION: `es-CO` conventions]: dates via `Intl.DateTimeFormat('es-CO' | 'en')`, never hand-formatted — es: "21 de julio de 2026" (lowercase months), en: "July 21, 2026". Kickoff times display in the venue's local time with the venue city as the timezone cue [ASSUMPTION: venue-local display; the three host countries span time zones, so no single tournament clock exists].

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`. shadcn primitives (Button, Tabs, Popover, Sheet, Tooltip, Table, Toggle, Accordion) are the base; only deltas are listed.

| Component | Use | Behavioral rules |
|---|---|---|
| Site header | Every route | Slim top bar, sticky on scroll [ASSUMPTION: sticky]: wordmark → `/`, header search, language toggle, theme toggle. On `<md` the search input collapses to an icon button that opens a full-width sheet. Visual spec `{components.site-header}`. |
| Header search | Site header, every route | Typeahead over the Tournament Index — players, teams, matches; client-side only, no network beyond the already-loaded index [ASSUMPTION: scope addition beyond PRD FRs — resolves the IA "reached from search" paths]. shadcn Command combobox semantics: `role="combobox"` + listbox, arrow keys move the active option, Enter navigates to the entity's route, Esc closes and returns focus to the input. Matching is accent- and case-insensitive (`Intl.Collator('es', {sensitivity:'base'})`). Empty result state: "Sin resultados para «{query}»." / EN variant, with a link to `/`. On `<md`: full-screen sheet, same semantics. |
| Layer section shell | Match Dashboard | Wraps every Tactical/Expert section. On `≥lg`: Tactical sections render expanded; on `<lg`: each dense section renders header + one-line summary, expands in place on tap (shadcn Accordion semantics, `aria-expanded`). Expert Layer shell is **collapsed by default at all widths** [ASSUMPTION], expands in place — never navigates away (FR-23, one-page rule). Anchor navigation auto-expands the target shell. Expanding lazy-mounts the viz (bundle already loaded; this is render cost, not network). |
| Stat tile | Hero Story Stats, profiles, comparison | Static display; head-to-head tiles show both values with the leading side accented **plus the ▲ leader glyph, and «líder» / "leader" appended to the leading value's accessible name** — who leads is never color-only (1.4.1). Glossary terms inside tile labels are the focusable triggers (the dotted-underline trigger style applies inside labels); the tile itself is not a tap target. |
| Momentum Timeline | Match Dashboard `#momentum`, reached within UJ-1's single scroll | The minute cursor is a slider: focusable (`role="slider"`, `aria-valuemin/max` over match minutes), arrow keys move ±1 minute, `aria-valuetext` announces minute + both teams' values. Pointer users tap anywhere on the timeline to place the cursor there (tap-to-position — no drag, consistent with the drag ban; serves touch and motor-impaired users alike). Goal markers are in the tab order and announce scorer + minute. If the series is absent → empty state (OQ-5, see State Patterns). |
| Pitch panel (shot map, cross map, receiving/defensive-action maps, pass network, heatmap) | Match Dashboard, profiles, comparison | Markers/nodes/edges at true 0–100 coordinates (FR-24). Tap/hover a marker → detail popover (player, minute, xG, outcome). **Overlapping markers are never displaced**: tapping a cluster opens a list popover of the stacked events; repeated taps cycle the stack's z-order (pointer redundancy only — Enter on a cluster opens the list popover with focus on its first item, arrow keys move through the stacked events). Hit areas partition by nearest marker (Voronoi); markers whose ≥44px hit areas would collide are treated as one cluster (list popover) even when visually separate. Pass-network node tap/focus → highlights that player's edges, dims the rest, and marks the selected node with a `{colors.focus-ring-on-pitch}` selection ring + `aria-pressed`; Enter toggles isolation, second tap or Esc clears. Every panel has a "Ver los datos / View data" control that opens the equivalent data table (Accessibility Floor). |
| Data table (sortable) | Leaderboards, Expert tables, viz alternatives | Client-side sort on any column head (click/Enter/Space, `aria-sort`), no network (FR-26). Text columns sort with `Intl.Collator('es', {sensitivity:'base'})` — never default string compare (Á/É/Ñ would missort). Default sort stated per table. Sticky header row; Expert per-player tables also stick the player column; `scroll-padding-top` equals the sticky-header height so a focused row is never occluded. On `<md` Hub tables the sort menu is a shadcn DropdownMenu listing all columns and mirroring `aria-sort`. Sorting never loses row focus. |
| Comparison entity picker | `/compare` | Type selector (Jugadores / Equipos / Partidos) + two search-select inputs (shadcn Command) over the Tournament Index. Selection updates the URL query params (shareable) and fetches the two bundles client-side. Swap-sides control exchanges A/B. |
| Comparison column | `/compare` | Mirrored stat rows around a shared label; each viz rendered per entity with identical scales/axes so sides are comparable. Entity accents follow `{components.comparison-column}`. |
| Language toggle | Site header, all routes | `ES \| EN` segmented control. Persisted to `localStorage` key `wcstats.locale` [ASSUMPTION: storage key] behind a try/catch — if storage is unavailable (private mode, blocked), fall back to in-memory Spanish default; the toggle still works for the session. An inline head script reads the persisted locale and sets `<html lang>` + a locale class before first paint; the string swap itself runs after hydration (mechanism + honest consequences: i18n & Terminology → Locale bootstrap) (FR-31). Toggling swaps all strings client-side, updates `<html lang>`, and announces via a polite live region ("Idioma: Español" / "Language: English") (4.1.3). |
| Theme toggle | Site header | System-aware default, manual override persisted (`wcstats.theme` [ASSUMPTION]; same try/catch storage fallback as the locale). Dark is canonical. Pitch panels do not change with theme. |
| Glossary tooltip | Any tactical term per the terminology table | Tap/hover/focus opens definition popover; "Ver en el glosario" links to `/glossary#term`. Per 1.4.13 the popover is hoverable and persistent: it stays open while pointer or focus is within trigger or panel, is dismissible with Esc without moving focus, and its glossary link is reachable by Tab from the trigger. Every tooltip and `/glossary` entry shows the counterpart-language term as a subtitle ("salida de balón — en: build-up"), so bilingual readers map terminology without toggling the whole site. Terms are marked once per section, not on every repetition. |
| Result chip | Hub standings/results, team form strings | Static, non-interactive indicator inside its (linked) row — the row, not the chip, is the link target. Always fill + letter (V/E/D es, W/D/L en — i18n table), never color-only. Visual spec `{components.result-chip}`. |
| Empty-state panel | Any missing section on any surface — Match Dashboard (FR-22), Profiles, Comparison | Occupies the section's slot with an explicit explanation — never a silent absence, never layout collapse. Copy per State Patterns. |
| Attribution footer | Every route | Static line + link to `/about`. Not dismissible. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold route load | All | Pre-rendered shell paints immediately (static export); route JSON bundle loads with shadcn Skeletons shaped like the target layout (score block + tile grid on Match Dashboard). Loading regions carry `aria-busy`; a polite live region announces "Datos cargados." / "Data loaded." when the bundle lands. Hero content is prioritized; Tactical/Expert render as data arrives. No spinner-only screens. |
| Missing Tactical section data | Match Dashboard | Empty-state panel in the section's slot: "Sin datos de {sección} para este partido. El informe oficial no incluye esta sección." / EN variant (FR-22). |
| Missing momentum series | Match Dashboard `#momentum` | Dedicated case of the above (OQ-5): "La línea de momentum no está disponible para este partido." The section header remains so the anchor and layout hold. |
| Empty comparison | `/compare` (no/partial params) | Picker-first state: "Elige dos {jugadores/equipos/partidos} para comparar." One entity selected → its column renders, other shows picker prompt. |
| Invalid comparison params | `/compare` (unknown slug/type) | "No encontramos {slug}. Elige de la lista." Valid side is preserved; invalid param dropped from URL. |
| Unknown route | `/404` | Static 404: "Esta página no existe. ¿Buscabas un partido?" + link to `/` and the match list. [ASSUMPTION: static Netlify 404 page; no redirects.] |
| Bundle fetch failure | Any | Inline panel in content area: "No pudimos cargar los datos. Revisa tu conexión e intenta de nuevo." with retry button. Shell and nav stay usable. |
| Focus | All | shadcn `--ring` focus-visible everywhere, including table headers. On the theme-invariant pitch, focus indicators use `{colors.focus-ring-on-pitch}` in **both** themes — the light theme's `--ring` cyan computes below 3:1 on the pitch (DESIGN → Data-visualization palette). Never `outline: none` without replacement. |

Offline support is explicitly not in scope (per sources); no service worker in MVP.

## Interaction Primitives

- **Tap = act.** Everything reachable by hover is reachable by tap and by keyboard focus — no hover-only information, ever (viz popovers included).
- Touch targets ≥44×44px CSS for all controls; d3 markers get an invisible ≥44px hit area even when drawn smaller [markers may visually be ~8–14px]. Hit-area partitioning and cluster collapse follow Component Patterns → Pitch panel — a touch never silently lands on the wrong event.
- Keyboard: `Tab` order follows reading order (see Accessibility Floor); `Enter`/`Space` activate; `Esc` closes the topmost popover/tooltip/sheet. Inside a viz: arrow keys move marker-to-marker (roving tabindex, ordered by match minute), `Enter` opens the detail popover.
- Scrolling: vertical page scroll only. Horizontal scroll exists solely *inside* wide containers (Expert tables) with visible affordance. Never in the Hero Layer at 390px (FR-21).
- **Banned:** infinite scroll (the dataset is finite and paginated/sectioned), carousels, drag interactions in v1 (the momentum scrub is tap-to-position + arrow keys, not a drag), modal stacks >1 deep, scroll-jacking, autoplaying motion.

## Accessibility Floor

WCAG 2.1 AA behavioral floor. Visual contrast obligations live in `DESIGN.md`.

- **Every d3/recharts visualization has a reachable data-table alternative** with the same numbers: the pitch panel's "Ver los datos" control opens it in place (collapsible region, real `<table>`). This is the text alternative of record; SVG internals are `aria-hidden` except focusable markers. Defined schemas so equivalence is auditable: the heatmap's alternative is a zone table (pitch third × channel, intensity % per zone) [ASSUMPTION: zone-grid schema]; the receiving and defensive-action maps get event logs like the shot log.
- Each viz is a `role="figure"` with an `aria-label` one-sentence summary in the active locale (e.g., "Mapa de tiros: México 14 tiros, 2 goles"). Focusable markers expose name/role/value ("Tiro de {player}, minuto 63, xG 0,08, al arco" — outcome vocabulary comes from the five ruled shot outcomes in the i18n table). All aria-label/aria-valuetext strings are locale-file keys under FR-30 — EN variants included, never hardcoded.
- Layer expansion uses `aria-expanded` on the shell trigger; expanding moves focus to the revealed section heading. Sortable headers use `aria-sort` and announce direction changes via a polite live region.
- Full keyboard operability: no traps; skip-link to main content; anchors and auto-expansion work by keyboard.
- `prefers-reduced-motion`: no expand/collapse animation (instant), no momentum-line draw-in, no scroll-smoothing. Motion is decorative-only everywhere, so nothing is lost.
- `<html lang>` tracks the active locale. Proper names (players, teams, venues) remain unmarked [ASSUMPTION: proper names are locale-neutral]. Retained-English jargon in Spanish copy ("xG", "sprint", "momentum"): acceptance includes a spot-check with a Spanish screen-reader voice; wrap terms in `lang="en"` spans only where pronunciation is unintelligible (3.1.2).
- 200% zoom: Hero Layer remains single-column with no horizontal page scroll. Reflow (1.4.10) holds down to **320 CSS px** for all content except data tables, which keep their internal-scroll exception.

## Responsive & Platform

Breakpoints: Tailwind defaults — design baseline 390px, `md` 768px, `lg` 1024px, `xl` 1280px. Mobile-first: the 390px rendering is the reference; wider viewports are enhancements. The `<md` and `≥lg` Match Dashboard renderings are illustrated by [mockups/key-match-dashboard-mobile.html](mockups/key-match-dashboard-mobile.html) and [mockups/key-match-dashboard-desktop.html](mockups/key-match-dashboard-desktop.html).

| Dense view | `≥lg` | `<md` (390px reference) |
|---|---|---|
| Shot map / cross map | Two half-pitches side by side (one per team), horizontal orientation | One team at a time via team tabs; **vertical half-pitch, attacking goal up** [ASSUMPTION: orientation], full container width. Marker positions unchanged (FR-24); hit areas ≥44px |
| Pass network | Two full pitches side by side | Team tabs, one vertical full pitch; edges below the lowest weight quintile hidden by default with "Mostrar todos los pases" toggle (declutter without deleting — SM-C2: the data remains one toggle away) |
| Heatmap | Side-by-side per team/player | Tabbed, single pitch |
| Receiving & defensive-action maps (offers to receive, movement to receive, defensive actions) | Two pitches side by side (one per team) | Team tabs, one vertical pitch; marker positions unchanged (FR-24); hit areas ≥44px with the Voronoi/cluster rule |
| Momentum Timeline | Full-width, comfortable height | Full-width, reduced height; scrub by tap-to-position + arrow keys (slider semantics — Component Patterns; no drag) |
| Head-to-head Key Statistics | Two-column mirrored tiles | Single column of paired tiles (both teams per tile) |
| Expert per-player tables | Full table, all column groups, internal horizontal scroll if needed | Column-group tabs (En posesión / Sin posesión / Físico), sticky player column, internal horizontal scroll within the table container. Every Domain G field remains reachable (FR-23) |
| Comparison side-by-side | True two-column layout | Stacked per section: paired stat rows (A and B values on one row); vizzes stack A above B with a sticky mini-header naming whose viz is on screen |
| Hub standings/leaderboards | Full tables | Fewer default-visible columns + "Más columnas" disclosure; sort still on all columns via sort menu |

Desktop optimization is allowed for Tactical/Expert and Comparison, but every capability must remain usable at 390px — degradation changes layout, never removes data.

**Spanish text expansion at 390px:** Spanish labels run ~20–30% longer than English, and the tightest surfaces are 11px ALL-CAPS labels in 12px-gap tiles. Stat-tile labels may wrap to two lines; table column heads use ruled abbreviations from the i18n table (e.g. "VEL. MÁX." for "Velocidad máxima") with the full term in the header's tooltip and `aria-label`. Ellipsis truncation is never the first resort.

## Key Flows

### UJ-1 — "Mariana catches up on last night's match from her phone"

Mariana, casual fan in Bogotá, half-watched the match; opens a shared link on the bus.

1. The shared link opens `/matches/{slug}` on her phone; the link preview already showed teams and score (meta tags).
2. The pre-rendered Hero Layer fills her first viewport: scoreline (`{typography.display-score}`), scorers with minutes, stage context chip ("Octavos de final" — orients her even for a match she doesn't remember), all in Spanish (default locale).
3. Just below: Story Stats tiles — posesión, tiros, xG, distancia, velocidad máxima.
4. One scroll: the compact head-to-head Key Statistics block (`#key-stats`) and, immediately below it, the Momentum Timeline (`#momentum`). She reads the arc — dominance, the collapse, the late surge.
5. **Climax:** ~15 seconds after tapping the link she has the match's story — score, who, when, and how it swung — and closes the tab satisfied (FR-21, SM-2).

Failure paths: momentum series missing → explicit empty state, and the Hero still delivers the story (OQ-5). Slow connection → static shell + skeletons; Hero data is the first bundle content parsed.

Acceptance pairs the mechanical 15-second test with SM-2's stated proxy — informal hallway tests: hand a phone to someone who missed the match; they should narrate its story unprompted.

### UJ-2 — "Diego dissects a knockout match for his tactics blog"

Diego, tactics blogger, on desktop.

1. Opens the same Match Dashboard route; scrolls past the Hero into the Tactical Layer — sections already expanded at `lg`.
2. Reads shot maps with xG, pass networks (taps a pivot's node to isolate his distribution), receiving and defensive-action maps, Phases-of-Play comparison, pressing & Defensive Blocks.
3. Expands the Expert Layer (`#expert`) on the same page — per-player tables: rupturas de líneas by player, distances by speed zone, duels (FR-23).
4. Switches the language toggle to EN to match his blog's terminology; every term swaps instantly, choice persists (FR-31).
5. Screenshots two pitch panels — each carries its in-panel attribution caption, so his posts credit the source automatically.
6. **Climax:** he finds the opponent's mid-block share — a number available nowhere else short of the 52-page PDF — and cites the app in his thread.

Failure path: a section missing from the source report → explicit empty state names what's absent, so he trusts the rest (FR-22).

### UJ-3 — "Diego compares two teams' tactical identity before a final"

1. From a Team Profile, Diego hits "Comparar equipo" → `/compare?type=teams&a={team}` with side A pre-filled.
2. Picks the second finalist in the B picker; the URL updates — shareable as-is (FR-29).
3. Side-by-side identities render on identical scales: Line Heights, Defensive Block distribution, pressing tendencies, formation usage (FR-28 data).
4. He scans mirrored stat rows; leading values carry each side's entity accent.
5. **Climax:** one composite view replaces manual notes across a dozen PDFs; he shares the URL in his group chat, and it opens to the same comparison.

Failure path: a shared URL with a bad slug → invalid-params state keeps the valid side and prompts a re-pick.

### UJ-4 — "Mariana settles a family argument about who was fastest"

1. At a family dinner, Mariana opens `/` on her phone.
2. Taps into Líderes del torneo (leaderboards — "Clasificaciones" is deliberately avoided; see i18n table), picks the physical board.
3. Taps the "Velocidad máxima" column head — client-side sort, instant, no network (FR-26).
4. Top of the table: the fastest player and his km/h figure, formatted es-CO (`36,8 km/h`).
5. **Climax:** she shows the phone around the table; the argument is settled in under a minute, in Spanish, on mobile.
6. Epilogue cross-link: tapping the player's row opens his Player Profile, where each per-match top speed links to that Match Dashboard (FR-27).

Failure path: none critical — the leaderboard ships in the Tournament Index; if the fetch fails, the retry panel appears.

> UJ-5 (pipeline re-run) is a builder/pipeline journey (Epic 1); it has no App surface and intentionally no flow here. Flow narratives use English tactical terms for spec readability — rendered section labels always come from the i18n & Terminology table.

## Progressive Disclosure Contract

> Visual references: [mockups/key-match-dashboard-mobile.html](mockups/key-match-dashboard-mobile.html) (390px hero contract, normative Tactical order, collapsed shells) · [mockups/key-match-dashboard-desktop.html](mockups/key-match-dashboard-desktop.html) (expanded Tactical Layer with pitch panels). Illustrative only — spines win on conflict.

Normative. The Match Dashboard is **one page, one route, one Match Bundle** — Hero → Tactical → Expert Layer are altitudes on that page, never separate pages, tabs-as-routes, or modals. Reaching full depth never leaves the page (FR-23). Depth is never deleted to serve readability or performance scores (SM-C2); it is placed at the right altitude.

**The 15-second hero test (acceptance):** at 390px, the score, scorers with minutes, stage context, and Story Stats render within the first viewport plus one scroll, with zero horizontal scrolling, and are comprehensible in ~15 seconds (FR-21, SM-2). The Tactical Layer opens with the head-to-head Key Statistics block — PRD §4.6's order is normative — with the Momentum Timeline immediately after it; Key Statistics is compact enough that UJ-1's single scroll still lands the timeline.

Layer assignment per data domain (A–G per addendum §6):

| Layer | Contract | Data domains |
|---|---|---|
| **Hero Layer** | Readable in ~15s on mobile; no tactical vocabulary without a glossary tooltip; the Hero itself never collapses, and it contains exactly one sub-disclosure — the compact lineups/formations disclosure; everything else is simply *there* | A (score, scorers+minutes, stage/group; lineups & formations in the one allowed compact disclosure) + Story Stats: possession, shots, xG from B; distance, top speed from G-physical aggregates |
| **Tactical Layer** | Named sections in fixed order (PRD §4.6): head-to-head Key Statistics → Momentum Timeline → shot maps + xG → Pass Networks → offers to receive → movement to receive → defensive actions [ASSUMPTION: the three Domain D marker maps inserted after Pass Networks; §4.6 omits them — full-visualization treatment is a logged decision; their data ships in every Match Bundle per FR-10, so rendering adds surface, not payload — the ≤500 KB budget holds] → Phases-of-Play comparison → pressing & Defensive Blocks → set plays → goalkeeping [ASSUMPTION: goalkeeping placed last in Tactical; §4.6 omits Domain E from its order]. Every section has an anchor and an explicit empty state (FR-22) | B (full Key Statistics block), C, D (all marker families as full visualizations), E, F |
| **Expert Layer** | Collapsed by default; expands in place; every Domain G field reachable on this page (FR-23); tables are the same data that feeds the viz — no "lite" versions | G (per-player in-possession / out-of-possession / physical tables) + full event logs (shot log, cross log, pass matrix, receiving log, defensive-actions log) which double as the viz data-table alternatives |

Profiles and the Hub apply the same grammar at smaller scale: headline aggregates first (hero altitude), tactical identity/trend visualizations second, full per-match tables last.

## Visualization Layering

Per viz type: what each altitude shows, how it collapses on mobile (mechanics in Responsive & Platform), and the overlap rule. Universal rules: true 0–100 coordinates always (FR-24); rendered maps must spot-check-match the source PDF's marker layout (SM-3); overlapping markers are preserved and disambiguated by the cluster-popover pattern (Component Patterns → Pitch panel); every viz has its data-table alternative.

| Viz | Hero altitude | Tactical altitude | Expert altitude |
|---|---|---|---|
| Story Stats tiles | The five headline numbers | — (superseded by full Key Statistics block) | — |
| Momentum Timeline | — | Full match arc + goal markers + minute scrub | Per-minute values via scrub; underlying series in data table |
| Shot map / cross map | xG + shots appear as Hero tiles | All shots plotted, outcome-encoded (`{colors.shot-goal}` family), xG-sized; per-shot popovers | Full shot/cross log table (player, minute, coordinates, xG, outcome) |
| Pass Network | — | Team network on pitch, node focus isolates a player | Full pass-matrix edges in table form |
| Offers / movement to receive | — | Marker maps on pitch (team accents, shape-encoded per DESIGN), per-marker popovers | Receiving log table (player, minute, coordinates, type) |
| Defensive actions | — | Marker map on pitch (team accents, triangle markers), per-marker popovers | Defensive-actions log table |
| Phases of Play / pressing / Defensive Blocks | — | Comparative distribution charts (recharts), team accents + direct series labels (never hue-only) | Exact percentages and per-match splits in tables |
| Set plays | — | Counts by type/side/style | Set-play log |
| Goalkeeping | — | Involvement + distribution summary | Full Domain E tables |
| Leaderboards (Hub) | Top-3 teaser rows | — | Full sortable table (FR-26) |
| Profile trends | Headline aggregates | Cross-match trend charts (recharts, `{colors.viz-single}` series) | Per-match series tables, each row linking to its match (FR-27) |

## i18n & Terminology

Spanish default, English toggle, persisted client-side (FR-31). All UI strings externalized to Locale files; no hardcoded user-facing strings, mechanically enforced (FR-30). Every tactical term below gets an explicit `es` locale entry — no fallthrough to keys or silent English (FR-32). Per FR-32 the policy is resolved **term-by-term** — each row below is its own decision, never a mechanical default. Within each per-term decision the tie-breaker (logged) is **Spanish-first**: translate unless no usable Spanish exists. Register: neutral Latin-American Spanish; goalkeeping vocabulary uses the LatAm register — arquero, atajada [ASSUMPTION: es-CO/LatAm register].

**Locale bootstrap (FR-31)** [ASSUMPTION: mechanism proposed]: every route is pre-rendered Spanish HTML. An inline `<head>` script reads the persisted locale (try/catch, in-memory fallback) and sets `<html lang>` plus a locale class **before first paint** — anything styleable by class (toggle state, direction-agnostic chrome) is correct from the first frame. What cannot be promised, owned honestly: for a persisted-EN user on cold load, the first paint of pre-rendered content is Spanish; the string swap runs **once, after hydration completes** — never during hydration, so server and client markup always match and there are no hydration mismatches. Mitigations that keep the flash minor [ASSUMPTION]: above-the-fold Hero content is dominated by numbers and data names, which are language-neutral; the few above-the-fold UI strings (tile labels, stage chip) swap in the single post-hydration pass. The SEO/share-card consequences are logged in IA.

Per-term policy table (OQ-1 resolution; decisions: **translate** / **jargon** (keep English) / **tooltip** (keep English + glossary tooltip); glossary tooltips exist for *all* terms regardless — the tooltip decision means the English term itself stays):

| Term (en) | Decision | Proposed es string | Rationale |
|---|---|---|---|
| line break | translate | rupturas de líneas | Established in Spanish tactical writing; plural in labels — FIFA's own Spanish EFI materials use the plural |
| counter-press | translate | contrapresión | Common in Spanish media; logged example |
| pressing | translate | presión (section label: "Presión y bloques defensivos") | Strong real usage; consistent with "contrapresión" — naturalized "pressing" adds nothing |
| build-up | translate | salida de balón | Standard broadcast Spanish; "build-up" adds nothing |
| high / mid / low block | translate | bloque alto / medio / bajo | Direct, universal |
| line height | translate | altura de la línea defensiva (short label: altura de la línea) | Bare "altura de línea" reads like typography; broadcast usage carries the article + "defensiva" |
| team length | translate | longitud del equipo | Descriptive; logged: "largo del equipo" is the colloquial alternative — the descriptive form stands |
| phases of play | translate | fases del juego | "fases del juego" is the common form |
| xG | jargon | xG (tooltip: "goles esperados") | Logged decision: no usable Spanish short form; "GE" unrecognizable |
| pass network | translate | red de pases | Self-explanatory |
| speed zones | translate | zonas de velocidad | Descriptive |
| high-speed run | translate | carreras a alta velocidad (abbr. column head: "CARR. ALTA VEL.") | "a alta velocidad" is the physical-performance form; "de alta velocidad" is a calque |
| sprint | jargon | sprint | Fully naturalized in Spanish sports usage; "esprint" reads pedantic |
| take-on | translate | regate | Exact common equivalent |
| step-in | translate | irrupción [ASSUMPTION: provisional pending the PMSR definition — if the metric is a defender stepping out to press, use "salto"; if a carry into the block, "conducción interior"] | Spanish-first; raw "step-in" opaque even to analysts; final term awaits the PMSR definition (content pass) |
| second ball | translate | segunda jugada | Established broadcast phrase |
| forced turnover | translate | recuperaciones forzadas | The metric credits the team that **forces** the loss; "pérdidas forzadas" would invert it into the team's own giveaways |
| ball progression | translate | progresión de balón | Established analytics Spanish |
| reception in final third | translate | recepción en el último tercio | Descriptive |
| set play | translate | balón parado | Universal Spanish football term; logged: Colombian broadcast favors "pelota quieta" — the neutral pan-LatAm form stands under the no-regionalisms rule |
| momentum | tooltip | momentum (tooltip: "impulso del partido: qué equipo domina en cada tramo") | Widely used untranslated in Spanish sports media; "ímpetu/impulso" would be a lossy label for a named product concept (Momentum Timeline → "Línea de momentum") |
| shot outcomes (legend + log headers) | translate | Gol / Al arco / Desviado / Bloqueado / Incompleto | Mirrors DESIGN's five ruled outcomes; "al arco" is the LatAm form ("a puerta" is peninsular) |
| goalkeeper | translate | arquero (section label: "Arqueros") [ASSUMPTION: es-CO/LatAm register] | LatAm/Colombian register; "portero" reads peninsular/Mexican for this audience |
| save | translate | atajada | LatAm register, pairs with "arquero" ("parada" is peninsular); shot-outcome aria strings use the ruled outcome vocabulary, not "atajado" |
| goalkeeping vocabulary | translate | distribución / salidas / mano a mano | Domain E summary + tables need ruled labels, not ad-hoc copies |
| stage names | translate | Fase de grupos / Dieciseisavos de final / Octavos de final / Cuartos de final / Semifinal / Tercer puesto / Final | Full 2026 set incl. the new round of 32 — Spanish media already uses "dieciseisavos" |
| result letters & standings columns | translate | V / E / D (chips); PJ, G, E, P, GF, GC, DG, Pts (columns) | Standard Spanish table scaffolding; chips EN: W / D / L |
| positions | translate | arquero / defensa / mediocampista / delantero | Standard LatAm set |
| lineup labels | translate | alineación / titulares / suplentes / formación | Formation labels themselves ("4-3-3") are locale-neutral data |
| corner | translate | tiro de esquina | Universal |
| offside | translate | posición adelantada | LatAm register; "fuera de juego" is peninsular |
| fouls / duels | translate | faltas / duelos | Direct equivalents (UJ-2's "duels") |
| cross | translate | centro (viz: "mapa de centros") | Universal |
| offers to receive | translate | ofrecimientos para recibir [ASSUMPTION: no settled broadcast term; verify against FIFA's Spanish EFI materials during content pass] | Spanish-first; descriptive |
| movement to receive | translate | desmarques [ASSUMPTION: "desmarque" is the established term for getting free to receive] | Established tactical Spanish |
| defensive actions | translate | acciones defensivas | Direct, universal |
| standings / leaderboards | translate | Tabla de posiciones / Líderes del torneo | "Clasificación" is avoided entirely — in LatAm it *means* the standings table, and the Hub carries both surfaces |
| Expert column groups | translate | En posesión / Sin posesión / Físico | Ruled here so the tabs aren't ad-hoc; "Con balón / Sin balón" noted as the chattier broadcast alternative |

New terms discovered during content work get their own row, decided under the same per-term Spanish-first tie-breaker (FR-32 — a tie-breaker, not a blanket rule); additions land in the locale files and this table.

**Attribution (OQ-3)** [ASSUMPTION: wording and placement proposed here; presence is the requirement]:

- Placement: (1) persistent site footer on every route; (2) in-panel caption on every pitch panel (survives screenshots — Diego's citation path); (3) full statement on `/about`.
- Footer/caption, es: "Datos: informes oficiales post-partido de la FIFA — Copa Mundial 2026. Sitio independiente, sin afiliación con la FIFA."
- Footer/caption, en: "Data: official FIFA Post-Match Summary Reports — 2026 World Cup. Independent site, not affiliated with FIFA."
- In-panel short form: "Datos: FIFA PMSR · wc-stats" / "Data: FIFA PMSR · wc-stats". `/about` carries the full statement plus methodology (xG is FIFA's value, used as-is, never recomputed).

## Requirements traceability

| Requirement | Where specified |
|---|---|
| FR-21 Hero Layer | Progressive Disclosure Contract, UJ-1, Interaction Primitives (no horizontal scroll) |
| FR-22 Tactical Layer + empty states | Progressive Disclosure Contract, State Patterns, Component Patterns (empty-state panel), UJ-2 |
| FR-23 Expert Layer one-page | Progressive Disclosure Contract, Component Patterns (layer shell), Responsive (Expert tables), UJ-2 |
| FR-24 True-coordinate viz | Visualization Layering, Component Patterns (pitch panel), Responsive table |
| FR-25 Results & standings | IA (Hub, cross-links), Responsive (Hub tables) |
| FR-26 Leaderboards client-side sort | Component Patterns (data table), UJ-4 |
| FR-27 Player Profile | IA, Visualization Layering (profile trends), UJ-4 epilogue |
| FR-28 Team Profile | IA, UJ-3 |
| FR-29 Comparison Mode | IA (URL scheme), Component Patterns (picker, column), UJ-3 |
| FR-30 Locale externalization | i18n & Terminology, Voice and Tone |
| FR-31 Spanish default + persistence | Component Patterns (language toggle), i18n & Terminology (Locale bootstrap) |
| FR-32 Per-term policy | i18n & Terminology table |
| FR-33 Static export | Foundation, IA |
| FR-34 Per-route bundles, client-side dynamism | Foundation, State Patterns (cold load), Component Patterns (sorting/comparison) |

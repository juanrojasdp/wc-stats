# Spine Pair Review — wc-stats (2026-08-26 delta: Epic 3 story 3.7)

> Scope: the 2026-08-26 delta (home IA refactor + navigation menu) against the pair finalized
> 2026-07-21. Pre-existing material was walked only far enough to catch what the delta broke or
> now contradicts. Baseline for comparison: `review-rubric.md` (2026-07-21).

## Overall verdict

The delta is a strong, well-governed contract extension: every ruling traces to a named decision
in `.memlog.md`, the two new components carry real rows in **both** spines, the three new mockups
are linked inline where they belong, the UX-DR4 re-ruling states its price in measured pixels, and
the deliberate overrides (story 3.9's 1,406, NFR-11's "home = 68") are argued in the open rather
than smuggled. The 2026-07-21 review's high and medium findings are all resolved.

What the delta did **not** do is walk its four new surfaces through the sections that already
existed. **State Patterns gained zero rows** for four new routes, so `/players`' filter has no
zero-result state and the "Cold route load — All" row prescribes a bundle-and-skeleton sequence
that is false on `/`. **i18n & Terminology gained zero rows**, so every reader-facing string the
delta invents — the landing `<h1>`, the eight badge support lines, *Inicio*, the trigger and sheet
names, the position abbreviations — is unruled in a document whose own binding procedure says new
copy gets a row; one badge label (*Tops*) actively contradicts a term the table already rules.

Two claims in the delta are false against the document's own rulings and will mislead an
implementer: `/tournament#results` names a nine-section surface, not a round, so UJ-0's "the round
he landed on is **open**" cannot be satisfied as written; and UJ-0's failure path claims an
English-browser first arrival "reads English… before paint", which the same file's Locale bootstrap
paragraph and story 3.5's own ACs both say is impossible on a pre-rendered-Spanish static export —
a regression of a critical the 2026-07-21 i18n lens closed. Extraction is otherwise clean: exactly
one token reference in the pair fails to resolve.

## 1. Flow coverage — adequate

Checked: `sources` frontmatter (all six paths resolve) → PRD §2.3 UJ-1..UJ-5, epics.md FR-36..FR-40
and NFR-11/NFR-12 → Key Flows. UJ-1..UJ-4 present; UJ-5 excluded with a stated reason. UJ-0 has a
named protagonist (Tomás), five numbered steps, an explicit `**Climax:**` beat, a failure-paths
line and an acceptance line — the four-element test passes cleanly. FR-39 and FR-40 both have flow
coverage through UJ-0.

### Findings

- **high** UJ-0's failure path asserts that an English-browser first arrival "reads English, because
  first-visit detection resolved `navigator.language` before paint (story 3.5)". The same file's
  **i18n & Terminology → Locale bootstrap** rules the opposite and owns it as an honest limitation:
  "for a persisted-EN user on cold load, the first paint of pre-rendered content is Spanish; the
  string swap runs **once, after hydration completes**." Story 3.5's own AC agrees — the pre-paint
  script sets `<html lang="en">`, and `i18n-provider.tsx`'s **mount effect** swaps the strings. Only
  `lang` is pre-paint; the copy is not. This is the "no-flash claim impossible on a
  pre-rendered-Spanish static export" finding the 2026-07-21 i18n lens raised as critical, reopened
  in a new section (EXPERIENCE.md → Key Flows, UJ-0 failure paths vs. i18n & Terminology → Locale
  bootstrap). *Fix:* rewrite to what ships — "his browser is English, so `<html lang>` is English
  from the first frame and the strings resolve to English on hydration; the Spanish first paint is
  the logged trade-off" — or drop the clause.
- **medium** UJ-4 was not walked against the new IA. Step 1 has Mariana open `/` and step 2 has her
  "Tap into Líderes del torneo (leaderboards)" — but `/` no longer carries leaderboards, the badge
  that reaches them is labelled *Tops*, and the boards now live at `/tops`. A story-writer using
  UJ-4 as acceptance tests a path the IA has removed (EXPERIENCE.md → Key Flows, UJ-4 steps 1–2 vs.
  IA route table and The Landing Page → ruled badge set). *Fix:* re-walk UJ-4 through `/` → *Tops*
  badge → `/tops#leaders`.
- **low** FR-37 (first-visit locale detection) and FR-38 (authorship signature) are now load-bearing
  in the delta — FR-38's caption is the whole reason the wrap threshold moved 237 → 354 px, and
  FR-37 is what UJ-0's failure path leans on — but neither appears in Requirements traceability
  (EXPERIENCE.md → Requirements traceability). *Fix:* two rows.

## 2. Token completeness — adequate

Checked: parsed DESIGN.md frontmatter as YAML, extracted every `{path.to.token}` from both files,
resolved each against the parsed tree. 90 distinct references in DESIGN.md, 17 in EXPERIENCE.md
(plus slug/query placeholders and the preamble's literal `{path.to.token}`, all correctly not
tokens). The two new component objects — `nav-menu` (6 tokens) and `feature-badge` (8 tokens) — are
well-formed and every value inside them resolves. Both `{components.nav-menu}` and
`{components.feature-badge}` referenced from EXPERIENCE.md resolve to DESIGN.md frontmatter.

### Findings

- **high** `{colors.nav-menu.current-marker-color}` does not resolve — the **only** unresolvable
  reference in the pair. `nav-menu` is defined under `components:`, not `colors:`; the correct path
  is `{components.nav-menu.current-marker-color}`, which resolves in turn to `{colors.accent-lime}`.
  A mechanical resolver returns null here, and the value it fails on is the current-route marker —
  the one accent the re-ruled header is allowed (DESIGN.md → Components → Navigation menu, line
  363). *Fix:* `{components.nav-menu.current-marker-color}`, or inline `{colors.accent-lime}`.
- **low** The delta adds two load-bearing color pairs and computes neither, against a document whose
  house standard is to state a ratio for every load-bearing combination (see the cyan-on-overlay
  paragraph 2.19 added, which computes to two decimals and warns about a 0.18 margin): the lime
  current-route marker on `{colors.surface-overlay}` / `-light` (non-text, 3:1) and the 2px lime
  `emphasis-border` on `{colors.surface-raised}` / `-light`. Both in fact clear their floors
  comfortably (≈13:1 dark, ≈6.3:1 light for the marker), so this is a documentation gap, not a
  failure — but the light-theme swap for the marker is left implicit in the `--primary` mapping
  rather than stated (DESIGN.md → Components → Navigation menu, Feature badge). *Fix:* one computed
  clause each, and say explicitly that the marker takes `accent-lime-light` in the light theme.
- **low** Five color tokens are defined but never referenced by name in either file:
  `accent-cyan-ink-light`, `ink-muted-light`, `result-win-light`, `result-draw-light`,
  `result-loss-light`. All are reachable through the prose's `-light` variant convention, so nothing
  is unspecified — pre-existing, noted for completeness (DESIGN.md frontmatter). *Fix:* none
  required; a one-line note that `-light` siblings are addressed by convention would close it.

## 3. Component coverage — adequate

Checked: extracted every component name used anywhere in either spine and cross-matched
DESIGN.md → Components against EXPERIENCE.md → Component Patterns. The delta's two new components
pass cleanly and symmetrically: **Navigation menu** (DESIGN.md trigger weight, sheet surface,
geometry, marker + weight change, `≥lg` inline treatment / EXPERIENCE.md nine destinations, links
not menu items, `aria-expanded` + `aria-controls`, Esc-returns-focus, `aria-current`) and **Feature
badge** (DESIGN.md card surface, typography, emphasised variant's three non-color signals /
EXPERIENCE.md whole-card link target, one tab stop, 2.5.3 accessible name, no JS-only affordance).
Both are real rules, not one-word descriptions. The re-ruled **Site header** row is updated in both
files and the retired clause is quoted rather than silently deleted.

### Findings

- **medium** The `/players` **name filter** is minted in prose inside an invented section and has no
  row in either spine: no Component Patterns row (trigger, `aria` semantics, whether it collapses
  empty groups, how it reports its count) and no DESIGN.md Components row. The prose says it
  "reus[es] the shipped `leaderboards.filter*` idiom", which covers the strings but not the
  behavior — and the behavior is explicitly **not** the shipped one ("It filters the whole set, not
  only what is open"), which is a delta the shipped idiom does not carry (EXPERIENCE.md → The Player
  and Team Indexes vs. Component Patterns). *Fix:* one Component Patterns row; the DESIGN row can
  say "inherits the shipped filter input, no visual delta."
- **medium** The **Component Patterns table is broken markdown** and has been since Story 2.19: the
  blockquote at lines 335–341 terminates the table, so the thirteen rows from *Layer section shell*
  through *Attribution footer* have no header row and render as literal pipe-delimited paragraphs
  rather than as table rows. A consumer extracting Component Patterns as a table gets four rows, not
  seventeen. The delta placed its three new rows above the break — so the new material extracts —
  but it edited this region without fixing it (EXPERIENCE.md lines 328–355). *Fix:* move the
  correction blockquote below the table, or convert it to a bolded paragraph after the last row.
- **low** The disclosure control itself (`ViewDataDisclosure`) still has no Component Patterns row,
  and the delta now makes it the primary structure of a new route — `/players` mounts 48 of them.
  Its behavior is described three times in prose (IA, The Player and Team Indexes, Deep-Link
  Fragment Grammar) and once through *Layer section shell*, which is a match-route component
  (EXPERIENCE.md). *Fix:* a row naming the shipped control, its counts-outside rule and its
  fragment addressability.

## 4. State coverage — thin

Walked all twelve IA surfaces against State Patterns. Generic coverage carries the four new routes:
cold load (row *All*), error (row *Bundle fetch failure — Any*), focus (row *Focus — All*). But
**State Patterns received no rows in this delta**, and three of its existing rows are now either
silent or wrong about the surfaces the delta added.

### Findings

- **high** `/tournament#results` is unruled on what it opens, and UJ-0 asserts a behavior the anchor
  cannot deliver. Badge 3 (*Partidos*) and the nav's *Partidos* entry both target
  `/tournament#results`; UJ-0 step 4 says he "arrives on `/tournament` at `#results`, and the round
  he landed on is **open** — not a heading above a closed control." But `#results` is
  `RESULTS_SURFACE_ID` (`app/src/lib/hub-model.ts:131`) — the `<h2>` over **nine** round sections,
  each with its own `<h3>` anchor and its own disclosure. There is no "round he landed on". The
  Deep-Link Fragment Grammar's own rule ("a fragment resolves through every closed layer… section
  shell first, then the disclosure inside it") would open all nine, which collides head-on with the
  SM-C2/Lighthouse-68 rationale for having them closed. Stories 3.8/3.9/3.10 must invent the answer
  — exactly what story 3.7 exists to prevent (EXPERIENCE.md → The Landing Page badge table row 3,
  Navigation, UJ-0 step 4, Deep-Link Fragment Grammar). *Fix:* rule it — either point *Partidos* at
  a specific round anchor, or state that a surface-level fragment scrolls-and-focuses without
  opening, and correct UJ-0 step 4 to match.
- **high** No zero-result state for the `/players` name filter. The section rules the filter's
  matching (`Intl.Collator`), its scope (whole set) and that it "reports its result count", but not
  what a reader sees at zero matches. Header search has ruled copy for the identical case
  ("Sin resultados para «{query}».", both locales, quoted verbatim in Component Patterns); this
  surface has none. Under this document's own binding rule that reader-facing copy is ruled here
  before it is implemented, story 3.9's implementer is blocked or must author unruled copy
  (EXPERIENCE.md → The Player and Team Indexes vs. State Patterns). *Fix:* one State Patterns row;
  the header-search string cannot be reused verbatim (that copy is search-scoped, per the 2.14
  precedent) so a new i18n row is needed with it.
- **medium** The *Cold route load — All* row prescribes "route JSON bundle loads with shadcn
  Skeletons… Loading regions carry `aria-busy`; a polite live region announces 'Datos cargados.'" —
  none of which is true on `/`, which UJ-0 step 1 and The Landing Page both describe as a static
  shell with no bundle at all. An implementer following the *All* row ships an `aria-busy` region
  and a "Datos cargados." announcement for a page that loads no data (EXPERIENCE.md → State Patterns
  row 1 vs. The Landing Page / UJ-0 step 1). *Fix:* scope the row, or add a `/` row saying the
  landing surface is fully static with no loading state.
- **low** The `/404` row's copy links to "`/` **and the match list**". The match list is no longer at
  or near `/`; it is `/tournament#results`, which is itself unruled per the high finding above
  (EXPERIENCE.md → State Patterns, Unknown route). *Fix:* name the new address.
- **low** `/players` and `/teams` are given no deep-link anchors, though IA states anchors for
  `/tournament` and `/tops` and Deep-Link Fragment Grammar rules that "every disclosure is
  addressable". `/players`' 48 team disclosures are disclosures under that rule and have no ruled
  fragment key (EXPERIENCE.md → IA "Deep-link anchors" vs. The Player and Team Indexes). *Fix:* say
  whether the 48 groups are addressable, and if so give the key shape.

## 5. Visual reference coverage — strong

`mockups/` holds five files; `wireframes/` does not exist; `imports/` is empty. All five are linked
inline at the section they serve, and the three new ones name their frames and viewports:
`key-landing-mobile.html` at **The Landing Page** ("390 px, dark, ES — zone order, the emphasised
*Comparar* badge, the `<lg` header") and again in DESIGN.md → Components; `key-navigation.html` at
**Navigation** ("three frames: sheet open at 320 px, header reflow at 195 px, inline nav at `≥lg`
with the width arithmetic that the `lg` threshold assumption rests on") and in DESIGN.md;
`key-players-index-mobile.html` at **The Player and Team Indexes**. No orphans. Spot-checked the
mocks against the spines: the badge labels, the emphasised *Comparar* treatment, the nine nav
destinations, the sheet geometry and the ~1,010 px `≥lg` width table all match the ruled text.

### Findings

- **low** The `key-players-index-mobile.html` reference names only "(390 px, dark, ES)" — viewport,
  theme and locale, but not *what it illustrates*. The other four references all name their subject
  (zone order, emphasised badge, three frames, hero contract, expanded Tactical Layer). Since this
  mock exists specifically to force the browse-grammar ruling, it should say so (EXPERIENCE.md →
  The Player and Team Indexes, line 157). *Fix:* "— team grouping, counts outside the disclosure,
  the name filter, position + name rows."
- **low** "Spines win on conflict" is now stated six times (preamble, four mock references, DESIGN.md
  → Components). The rubric asks for once; repetition invites divergent phrasings ("Illustrative
  only — spines win on conflict" / "Mocks illustrate, spines win on conflict"). *Fix:* keep the
  preamble statement and let the mock links be bare.
- **low** The nav mock's search field reads "Buscar jugador, equipo o partido", a third string
  against the ruled `search.label` ("Busca jugadores, equipos y partidos") and `search.placeholder`
  ("Escribe un nombre o un partido"). Spines win, so nothing is broken — but a mock that quietly
  invents copy in a project this strict about copy provenance is a trap
  (`mockups/key-navigation.html`, frame A). *Fix:* use the ruled string in the mock.

## 6. Bloat & overspecification — adequate

Every one of the four new sections is normative and load-bearing, and each answers something no
other section does: **The Landing Page** rules zone order and the badge set; **Navigation** carries
the UX-DR24 re-ruling and its pixel arithmetic; **Deep-Link Fragment Grammar** rules a grammar that
existed nowhere; **The Player and Team Indexes** rules a browse grammar that would otherwise fall to
story 3.9's implementer. None is bloat. No pixel specs escape into EXPERIENCE.md; no persona or FR
text is restated from sources; the new material is tables where tables work.

### Findings

- **low** The `/teams`-is-redundant ruling is stated twice, near-verbatim, in two adjacent sections —
  "Recorded as a cost, not disguised as a benefit" (The Landing Page) and "Recorded as a cost, not
  dressed up as a benefit" (The Player and Team Indexes). Two homes for one ruling is the drift this
  document's own i18n discipline exists to prevent. *Fix:* rule it once in The Player and Team
  Indexes and cross-reference from the badge bullet.
- **low** EXPERIENCE.md prose carries editorial voice throughout the delta, against the rubric's
  split (DESIGN.md may, EXPERIENCE.md should not): "owned rather than discovered", "data work
  wearing an IA costume", "The price, stated plainly", "stale in the project's favour". This is the
  established house register across the whole pre-existing file, so it reads as deliberate — but the
  clearest excisable case is the **Performance guard**'s closing two sentences, which argue at
  length against a reading nobody has proposed ("Reading the guard the other way… would be exactly
  the 'a gate that has never been red is not a gate' failure"). *Fix:* optional; if trimmed, trim
  the argument and keep the rule.

## 7. Inheritance discipline — adequate

`sources` frontmatter: all six paths resolve on disk, including the three added for this pass. The
two deliberate departures from source are stated in the open and argued — story 3.9's "route count
stays 1,406" (superseded to 1,410, with the clause's intent shown intact) and NFR-11's "Tournament
Hub / home = 68" (reinterpreted as `/tournament`'s inherited floor). UX-DR24 is named exactly as
epics.md reserves it. Component names are identical across all four sections in both files.
`.memlog.md` records a Juan ruling behind every substantive decision.

### Findings

- **high** **No i18n & Terminology rows were added for any of the delta's reader-facing copy.** The
  table's own extension procedure is binding ("New terms discovered during content work get their
  own row") and 2.14/2.16/2.17 each obeyed it under protest. This delta mints, unruled: the landing
  `<h1>`, the zone-1 identity paragraph, all eight badge **supporting lines**, *Inicio / Home*, the
  nav trigger's accessible name, the sheet's Radix-required title, the `<nav>` landmark name,
  `/players` and `/teams` page headings, the `/players` filter label and its zero-result copy, and
  the position abbreviations **POR / DEF / MED / DEL** (the existing `positions` row rules
  "arquero / defensa / mediocampista / delantero" and carries no abbreviation set). Meanwhile
  Navigation states that "Every accessible name… is a Locale-file key in both dictionaries (FR-30)"
  — a rule with no rows behind it. Stories 3.9/3.10 must author roughly a dozen strings the
  contract was written to hand them (EXPERIENCE.md → The Landing Page, The Player and Team Indexes,
  Navigation vs. i18n & Terminology). *Fix:* append a Story 3.7 block to the table under the
  existing procedure.
- **high** Badge 4 is labelled **es "Tops" / en "Leaders"**, which breaks two ruled things at once.
  (1) The *standings / leaderboards* row rules the Spanish term as **"Líderes del torneo"** and the
  shipped `LeaderboardsSection` uses it; "Tops" is a second name for one concept, the exact drift
  the table's own docblock rule forbids ("a second pair here would be two sources for one term").
  (2) Voice and Tone bans mixed-language strings ("Speed máxima") — and the labels are inverted, the
  *Spanish* label being the English-looking word while the *English* label is the translated one.
  UJ-4 still calls the destination "Líderes del torneo", so the two names already coexist in this
  file (EXPERIENCE.md → The Landing Page ruled badge set row 4 vs. i18n & Terminology *standings /
  leaderboards*, Voice and Tone, UJ-4 step 2). *Fix:* rule it explicitly — either label the badge
  "Líderes" / "Leaders" with the route staying `/tops`, or add a policy row that rules "Tops" as a
  deliberate short-form navigational label distinct from the board vocabulary, the way 2.17 ruled
  `compare.type.*` against `viz.table.player`.
- **medium** UJ-0 and Tomás are minted with no source and no `[ASSUMPTION]` tag. The PRD's journey
  series is UJ-1..UJ-5 and contains no UJ-0; epics.md names none; the personas of record are
  Mariana, Diego and Juan. Numbering it into the source's series makes it read as inherited, and
  Foundation's "Two audiences, one surface" statement was not updated for a third protagonist whose
  defining trait — arriving with no context and no domain interest — is neither audience. The
  journey itself is right and FR-39 needs one; only its provenance is misrepresented (EXPERIENCE.md
  → Key Flows UJ-0 vs. Foundation ¶2; prd.md §2.3). *Fix:* tag it `[ASSUMPTION: UJ-0 is minted by
  this pass to realize FR-39; sources carry no first-arrival journey]` and add one clause to
  Foundation.
- **medium** Foundation still lists "Lighthouse mobile **≥90** on Match Dashboard and Tournament Hub"
  among the "hard budgets that shape every behavior in this document", while the delta's Performance
  guard rules "**SM-5 stays CLOSED (D19): nothing in this contract designs toward 90.**" Two gate
  figures for one document; a consumer reading Foundation first sets the wrong gate. Note the delta
  correctly inherits NFR-1's original text — the contradiction is inside the spine, not with the
  source (EXPERIENCE.md → Foundation ¶3 vs. IA → Performance guard). *Fix:* amend Foundation to
  point at the guard.
- **medium** The route-count verification enumerates only six static routes for a figure that now
  requires ten: "1,406 → **1,410** (verified against the export: 1,400 entity routes + `/`,
  `/about`, `/compare`, `/glossary`, `/404`, `/_not-found`)". That list sums to 1,406.
  `/tournament`, `/tops`, `/players` and `/teams` are missing from it. The arithmetic elsewhere is
  right and the four routes are named in the table — but story 3.4's sitemap bijection assertion and
  story 3.9's route-count assertion are both written from this line (EXPERIENCE.md → IA re-ruling
  blockquote). *Fix:* extend the enumeration to ten static routes.

## 8. Shape fit — adequate

DESIGN.md sections are in canonical order — Brand & Style → Colors → Typography → Layout & Spacing →
Elevation & Depth → Shapes → Components → Do's and Don'ts — and the delta touched only Components
and Do's and Don'ts, in place. EXPERIENCE.md carries all eight required defaults. Responsive &
Platform is present and correctly triggered. **Inspiration & Anti-patterns remains correctly
absent**: `.memlog.md` records no reference products and no rejected products, only rejected
*options*, so the trigger does not fire. Frontmatter on both files is complete and both `updated`
fields moved to 2026-08-26.

### Findings

- **medium** The Responsive & Platform table's column header is `` `<md` (390px reference) ``, but
  three of the five new rows put non-`<md` content in that column: *Site header composition* reads
  "`<lg`: wordmark + caption + one menu trigger", and *Landing badge grid* reads "One column at
  `<sm`, two at `≥sm`". A consumer reading the table by its columns — which is what a breakpoint
  table is for — builds the menu trigger only below 768 px and leaves 768–1023 px with a
  four-element inline header and no nav, the precise band Navigation rules against. The correct
  reading is recoverable from Navigation, but not from the table (EXPERIENCE.md → Responsive &
  Platform, header row and rows 407–410). *Fix:* relabel the column to "narrow (breakpoint per row)"
  or split the header row out with its own explicit `<lg` / `≥lg` pair.
- **low** Key Flows now sits with **seven** invented or optional sections after it (Progressive
  Disclosure Contract, Visualization Layering, i18n & Terminology, Requirements traceability) and
  four before it (The Landing Page, The Player and Team Indexes, Navigation, Deep-Link Fragment
  Grammar). Both shape examples read flows-last as the capstone. This was flagged as cosmetic in
  2026-07-21 and the delta widened the gap; extraction is unaffected (EXPERIENCE.md section order).
  *Fix:* optional reorder.

## Mechanical notes

- **One broken cross-reference in the pair:** `{colors.nav-menu.current-marker-color}`
  (DESIGN.md:363). Every other `{path.to.token}` in both files resolves against DESIGN.md
  frontmatter, verified by parsing the YAML and resolving all 107 references.
- **Markdown:** Component Patterns' embedded blockquote (EXPERIENCE.md:335–341) terminates the
  table; thirteen of seventeen rows do not parse as table rows. Pre-existing since 2.19, but the
  delta edited this table without fixing it. All other tables in both files parse; the
  `ES \| EN` escape flagged in 2026-07-21 is fixed.
- **Frontmatter:** both files carry `name` / `description` / `status: final` / `updated: 2026-08-26`;
  EXPERIENCE.md's six `sources` paths all resolve on disk. DESIGN.md's `components` block is
  well-formed and both new entries use only `{path.to.token}` values, no literals.
- **Naming consistency:** *Navigation menu* / `nav-menu`, *Feature badge* / `feature-badge` and
  *Site header* / `site-header` are used identically across DESIGN.md frontmatter, DESIGN.md
  Components, EXPERIENCE.md Component Patterns, Responsive & Platform and Requirements traceability.
  "Tournament Hub" now names `/tournament` consistently — **no stale reference to `/` as the Hub
  survives in prose**. Two residues, both minor: the *tournament hub — page title* i18n row
  (line 635) still says "No spine specifies a title for `/`" while describing `hub.title`, which is
  now `/tournament`'s `<h1>` and leaves `/`'s `<h1>` genuinely unspecified (folded into finding 7.1);
  and the `/404` copy's "match list" pointer (finding 4.4).
- **Mockups:** `mockups/` and `.working/` each hold a copy of the three new HTML files. Two copies of
  one artifact can drift; the spines link `mockups/`, so `.working/` should be cleaned or left
  clearly scratch.
- **Mermaid:** none present in either file.

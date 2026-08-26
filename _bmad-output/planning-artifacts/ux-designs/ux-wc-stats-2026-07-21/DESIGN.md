---
name: wc-stats
description: Visual identity for the WC2026 analytics site — "broadcast dark" analytics system on shadcn/ui + Tailwind; dark is canonical, light is the derived variant.
status: final
updated: 2026-08-26
colors:
  # Convention: unsuffixed tokens are the DARK (canonical) theme; `-light` suffix
  # is the derived light variant. All shadcn tokens not listed here inherit
  # shadcn defaults remapped per the CSS-variable table in the Colors section.
  # --- Canvas & ink (dark canonical) ---
  surface-base: '#0E1114'
  surface-raised: '#171B1F'
  surface-overlay: '#1F252B'
  ink-primary: '#F2F5F7'
  ink-secondary: '#A7B0B8'
  ink-muted: '#6B757F'
  border-hairline: '#2A3138'
  # --- Canvas & ink (light variant) ---
  surface-base-light: '#F5F7F8'
  surface-raised-light: '#FFFFFF'
  surface-overlay-light: '#EDF0F2'
  ink-primary-light: '#15191D'
  ink-secondary-light: '#4B555E'
  ink-muted-light: '#5F6970'
  border-hairline-light: '#DCE1E5'
  # --- Brand accents ---
  accent-lime: '#C3F53C'
  accent-lime-ink: '#131A02'
  accent-lime-light: '#3F6212'
  accent-cyan: '#3DDBE8'
  accent-cyan-ink: '#062226'
  accent-cyan-light: '#0E7490'
  # Ratified 2026-07-23 (Story 2.1 review): on the darker light-theme cyan
  # (#0E7490) the dark ink fails contrast; light theme uses white ink.
  accent-cyan-ink-light: '#FFFFFF'
  destructive: '#F0708A'
  destructive-light: '#C22D50'
  # --- Data-visualization palette ---
  pitch-surface: '#0B3D2E'
  pitch-stripe: '#0E4634'
  pitch-line: '#4C9B72'
  viz-team-a: '#C3F53C'
  viz-team-a-light: '#4D7C0F'
  viz-team-b: '#3DDBE8'
  viz-team-b-light: '#0E7490'
  viz-neutral: '#8C979F'
  viz-neutral-light: '#5F6970'
  # viz-single deliberately aliases viz-team-a: single-entity charts carry no
  # second series, so the hex can never mean two things in one chart.
  viz-single: '#C3F53C'
  viz-single-light: '#4D7C0F'
  # Shot outcomes: own hues, never shared with team or brand accents.
  # Unsuffixed = on-pitch / dark canvas; `-light` = light-canvas contexts
  # (legends, momentum goal markers, data-table swatches).
  shot-goal: '#3FDD85'
  shot-goal-light: '#177245'
  shot-on-target: '#63C8F5'
  shot-on-target-light: '#155E8F'
  shot-off-target: '#F5B63C'
  shot-off-target-light: '#7A5200'
  shot-blocked: '#C9A1F5'
  shot-blocked-light: '#6D28D9'
  shot-incomplete: '#7C9BF7'
  shot-incomplete-light: '#3346C2'
  focus-ring-on-pitch: '#EAFBFD'
  edge-weight-1: '#5A9E78'
  edge-weight-2: '#7DB56E'
  edge-weight-3: '#A3CC60'
  edge-weight-4: '#C9E455'
  edge-weight-5: '#EEFB4E'
  heat-1: '#4E9E52'
  heat-2: '#6FB44F'
  heat-3: '#93C44B'
  heat-4: '#C4DE4F'
  heat-5: '#EEF9A3'
  result-win: '#65D98A'
  result-draw: '#8C979F'
  result-loss: '#F0708A'
  result-win-light: '#1E7A43'
  result-draw-light: '#5F6970'
  result-loss-light: '#C22D50'
  result-chip-ink: '#0E1114'
  result-chip-ink-light: '#FFFFFF'
typography:
  # [ASSUMPTION: concrete font picks — Archivo (display/numeric) + Inter (UI/body),
  # both open-source and self-hostable via next/font. Sources name no fonts.]
  display-score:
    fontFamily: 'Archivo'
    fontSize: 44px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: '-0.01em'
  display-stat:
    fontFamily: 'Archivo'
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1.05'
  headline:
    fontFamily: 'Archivo'
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.2'
  title:
    fontFamily: 'Inter'
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.35'
  body:
    fontFamily: 'Inter'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.55'
  stat-value:
    fontFamily: 'Archivo'
    fontSize: 26px
    fontWeight: '700'
    lineHeight: '1.1'
  stat-label:
    fontFamily: 'Inter'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: '0.08em'
  table-numeric:
    fontFamily: 'Inter'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  label-caps:
    fontFamily: 'Inter'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: '0.08em'
  caption:
    fontFamily: 'Inter'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  # Tailwind's 4-based scale inherited as-is. Named tokens below are additive.
  gutter-mobile: 16px
  gutter-desktop: 24px
  tile-gap: 12px
  section-gap: 48px
  layer-gap: 64px
  # --- Header height, ruled 2026-08-26 (story 3.7), RE-MEASURED (story 3.10). ---
  # ONE custom property, driven by the breakpoint, consumed by
  # `scroll-padding-top` AND by every sticky offset that mirrors it. Shipped in
  # story 3.10; the hardcoded 4.5rem it replaced was wrong by 46px at wrapped
  # widths -- an anchored heading was HIDDEN behind the bar, not merely tight.
  #
  # THE VALUES BELOW ARE RE-MEASURED FOR THE NAV, NOT THE ONES 3.7 RULED. Those
  # (62/118/124) described story 3.6's FOUR-element row: wordmark + search +
  # ES|EN + theme. UX-DR24 replaces three of them with one 44px trigger below
  # `xl`, so the composition changed and, as this file's own rule requires
  # ("Any change to the header's composition changes this token"), the token
  # followed. Measured in headless Chromium against the built export, 1px sweep
  # per locale, 96-cell matrix for the widths:
  #
  #   locale   one row (62px) from   wraps (118px) at
  #   es       215px                 <= 214px
  #   en       211px                 <= 210px
  #
  # Pre-nav those thresholds were 341 (es) / 337 (en), so THE HEADER NO LONGER
  # WRAPS ON ANY PHONE -- 62px at both 320 and 390 in both locales and themes.
  #
  # `header-h-zoom` IS REMOVED, and its removal is the measurement talking. It
  # named a 195px layout viewport where an already-wrapped row gained a caption
  # line, and measured 124px. It now measures 117.8px -- identical to every
  # other wrapped width, because the row that wraps there is the same two-line
  # wordmark+trigger row. "Wrapped" and "zoom" are no longer distinct states at
  # any shipped width, so a third token would be a value nothing consumes
  # differently. Reinstate it only if a future composition separates them again.
  #
  # NO LOCALE AXIS. The two locales agree on the VALUES and differ only in the
  # switch-over width; the breakpoint takes the larger (215px), because
  # over-reserving adds whitespace above an anchored heading while
  # under-reserving hides it -- which is the defect this token exists to end.
  header-h-oneline: 62px
  header-h-wrapped: 118px
  scroll-clearance: 16px
  # `/compare`'s `<md` mini-header, which sticks UNDER the site header. Named
  # here because it was the other half of two hardcoded literals ("56 header +
  # 48 mini") in CompareChartsSection.
  compare-mini-h: 48px
components:
  stat-tile:
    background: '{colors.surface-raised}'
    value-typography: '{typography.stat-value}'
    label-typography: '{typography.stat-label}'
    radius: '{rounded.md}'
    gap: '{spacing.tile-gap}'
  layer-shell:
    background: '{colors.surface-base}'
    divider: '{colors.border-hairline}'
    heading-typography: '{typography.headline}'
    section-gap: '{spacing.section-gap}'
  pitch-panel:
    surface: '{colors.pitch-surface}'
    stripe: '{colors.pitch-stripe}'
    line: '{colors.pitch-line}'
    radius: '{rounded.lg}'
    caption-typography: '{typography.caption}'
  data-table:
    header-background: '{colors.surface-raised}'
    row-divider: '{colors.border-hairline}'
    numeric-typography: '{typography.table-numeric}'
    sort-active-color: '{colors.accent-cyan}'
  comparison-column:
    entity-a-accent: '{colors.viz-team-a}'
    entity-b-accent: '{colors.viz-team-b}'
    background: '{colors.surface-raised}'
    radius: '{rounded.md}'
  language-toggle:
    active-color: '{colors.accent-lime}'
    inactive-color: '{colors.ink-secondary}'
    typography: '{typography.label-caps}'
  empty-state-panel:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    icon-color: '{colors.ink-muted}'
    radius: '{rounded.md}'
  glossary-tooltip:
    background: '{colors.surface-overlay}'
    foreground: '{colors.ink-primary}'
    trigger-underline: '{colors.accent-cyan}'
    radius: '{rounded.sm}'
  result-chip:
    fill-win: '{colors.result-win}'
    fill-draw: '{colors.result-draw}'
    fill-loss: '{colors.result-loss}'
    letter-color: '{colors.result-chip-ink}'
    letter-typography: '{typography.label-caps}'
    radius: '{rounded.full}'
  site-header:
    background: '{colors.surface-base}'
    divider: '{colors.border-hairline}'
    wordmark-typography: '{typography.title}'
  header-search:
    background: '{colors.surface-overlay}'
    result-typography: '{typography.body}'
    match-highlight: '{colors.accent-cyan}'
    radius: '{rounded.sm}'
  nav-menu:
    sheet-background: '{colors.surface-overlay}'
    divider: '{colors.border-hairline}'
    link-typography: '{typography.body}'
    link-color: '{colors.ink-primary}'
    current-marker-color: '{colors.accent-lime}'
    current-marker-color-light: '{colors.accent-lime-light}'
    radius: '{rounded.md}'
  feature-badge:
    background: '{colors.surface-raised}'
    border: '{colors.border-hairline}'
    label-typography: '{typography.title}'
    support-typography: '{typography.body}'
    support-color: '{colors.ink-secondary}'
    emphasis-border: '{colors.accent-lime}'
    emphasis-border-light: '{colors.accent-lime-light}'
    radius: '{rounded.md}'
    gap: '{spacing.tile-gap}'
---

## Brand & Style

wc-stats looks like the analytics segment of a world-class football broadcast: a dark charcoal studio, a glowing green pitch, and numbers that carry the story. The aesthetic is **broadcast dark** — dark is the canonical theme, light is a derived variant. The product's differentiation is "completeness, cross-match aggregation, and polish," and the visual language backs it: restrained chrome, vivid data, numbers-forward typography. Nothing decorative competes with the data. The site is also an explicit portfolio piece (brief, Post-MVP Vision) — when two treatments tie on every other criterion, choose the more demonstrable, polished one.

Three rules govern everything:

1. **The canvas is quiet; the data is loud.** Charcoal surfaces ({colors.surface-base} family), hairline structure, muted labels. Color belongs to data — team accents, shot outcomes, edge weights — never to chrome.
2. **The pitch is sacred ground.** All d3 pitch visualizations render on the deep-green {colors.pitch-surface}, in both themes. It is the one theme-invariant surface, the visual signature of the product.
3. **shadcn/ui is the base layer.** This DESIGN.md specifies the token deltas over shadcn defaults (mapping below) plus the product-specific data-visualization system. Unlisted shadcn components inherit shadcn's visual specs with these tokens applied.

[ASSUMPTION: all concrete hex values in this document are proposed by the UX pass — sources give only the "broadcast dark / deep-green pitch / electric lime-cyan" direction, which every value here serves.]

## Colors

### Canvas & ink

- **Charcoal Base ({colors.surface-base} dark / {colors.surface-base-light} light)** — the page canvas. Never pure black: the charcoal keeps viz surfaces and elevated cards distinguishable by tone.
- **Raised ({colors.surface-raised} / {colors.surface-raised-light})** — cards, stat tiles, table headers. One tonal step up; no shadows needed on dark.
- **Overlay ({colors.surface-overlay} / {colors.surface-overlay-light})** — popovers, tooltips, sheets.
- **Ink** — {colors.ink-primary} for values and body (computed 17.3:1 dark / 16.4:1 light on base); {colors.ink-secondary} for labels, secondary text, and any tertiary *text* (computed ≥7:1 on base, both themes; 6.65:1 on light overlay — still AA); {colors.ink-muted} is restricted to **disabled states and ≥3:1 non-text glyphs only** — it computes 3.30–4.04:1 on the dark surfaces, below the 4.5:1 text floor, so no real content (captions, meta, timestamps) may ship in it at body sizes.
- **Hairline ({colors.border-hairline} / {colors.border-hairline-light})** — the only divider weight. Structure comes from tone and spacing, not heavy borders.

### Brand accents

- **Electric Lime ({colors.accent-lime} dark / {colors.accent-lime-light} light)** — the primary action and "this team / this value leads" color. Maps to shadcn `--primary`. Text on lime fills uses {colors.accent-lime-ink}.
- **Cyan ({colors.accent-cyan} dark / {colors.accent-cyan-light} light)** — links, focus rings, interactive states on data (active sort column, focused marker, glossary-term underline). Maps to shadcn `--ring`. Text on cyan fills uses {colors.accent-cyan-ink}.
- **Destructive ({colors.destructive} / {colors.destructive-light})** — errors only. Never used to mean "losing team."

Both accents pass 4.5:1 against their theme's base surface for text-size usage (computed: lime 14.8 dark / 6.6 light; cyan 11.3 dark / 5.0 light). The dark-canonical lime and cyan are also ≥3:1 non-text against the pitch (9.56 / 7.26); the light variants are not — focus indicators on the pitch always use {colors.focus-ring-on-pitch} (rule and ratios: Data-visualization palette → Focus on the pitch).

**Cyan on the overlay surface** — computed **9.20:1 dark** ({colors.accent-cyan} on {colors.surface-overlay}) and **4.68:1 light** ({colors.accent-cyan-light} on {colors.surface-overlay-light}). Both clear the 4.5:1 text floor, so a cyan link, a glossary-term underline or an active-sort head is legible inside a popover, tooltip or sheet in either theme — the surfaces the two rows above did not cover, since they measure against the BASE surface. Note how much thinner the light-theme margin is: 4.68 against a floor of 4.5 leaves 0.18, so any future darkening of {colors.surface-overlay-light} or lightening of {colors.accent-cyan-light} must be re-measured rather than assumed. *(Measured by Story 2.14 and absorbed here by Story 2.19, ledger A21/L2929. The method reproduced this document's own published base-surface figures first — 11.3 dark / 5.0 light — before the new pair was trusted.)*

### shadcn CSS-variable mapping

Dark (`:root` / `.dark` is canonical) and light map as follows; unlisted variables keep shadcn defaults:

| shadcn variable | Dark (canonical) | Light |
|---|---|---|
| `--background` / `--foreground` | {colors.surface-base} / {colors.ink-primary} | {colors.surface-base-light} / {colors.ink-primary-light} |
| `--card`, `--muted` | {colors.surface-raised} | {colors.surface-raised-light} |
| `--muted-foreground` | {colors.ink-secondary} | {colors.ink-secondary-light} |
| `--popover` | {colors.surface-overlay} | {colors.surface-overlay-light} |
| `--primary` / `--primary-foreground` | {colors.accent-lime} / {colors.accent-lime-ink} | {colors.accent-lime-light} / {colors.surface-raised-light} |
| `--secondary`, `--accent` | {colors.surface-overlay} | {colors.surface-overlay-light} |
| `--border`, `--input` | {colors.border-hairline} | {colors.border-hairline-light} |
| `--ring` | {colors.accent-cyan} | {colors.accent-cyan-light} |
| `--destructive` | {colors.destructive} | {colors.destructive-light} |

### Data-visualization palette

This palette is normative for every d3 and recharts view. **One color means one thing per visualization** — a chart never mixes team encoding with outcome encoding. To make that rule mechanical, hex values are unique per meaning: shot outcomes, team accents, and brand accents never share a hex (the one deliberate alias is {colors.viz-single} = {colors.viz-team-a}, safe because single-entity charts have no second series).

**Focus on the pitch.** The pitch is theme-invariant, so focus indicators drawn on it use the dedicated near-white {colors.focus-ring-on-pitch} in **both** themes (computed 11.45:1 vs. {colors.pitch-surface}); the shadcn `--ring` cyan applies everywhere else. This closes the light-theme gap where {colors.accent-cyan-light} computes only 2.28:1 on the pitch.

**Pitch surface.** {colors.pitch-surface} with alternating mow stripes {colors.pitch-stripe} (decorative, contrast-exempt) and pitch lines {colors.pitch-line} (≈3.6:1 vs. pitch — meets WCAG AA non-text 3:1). The pitch is **theme-invariant**: it stays deep green in the light theme, framed by the light canvas. This guarantees marker contrast is verified once, against one background.

**Two-team contrast pair.** Head-to-head visualizations (Momentum Timeline, pass networks, phases-of-play, comparison views) use **app-owned accents, not real team colors**: Team A = {colors.viz-team-a}, Team B = {colors.viz-team-b} (light-canvas chart variants {colors.viz-team-a-light} / {colors.viz-team-b-light}). Assignment rule: home/first-listed team is A. This works for any pairing of the 48 teams; real federation colors would collide (Brazil–Australia, France–Japan) and cannot be guaranteed AA. [ASSUMPTION: real team colors rejected for v1; a future decorative-only team-color chip (flag/crest area, never data encoding) is possible but out of scope.] {colors.viz-neutral} / {colors.viz-neutral-light} is the "neither team" series (tournament average, midline). Because the pair is near-equal in lightness (A vs. B computes 1.32:1 dark, 1.07:1 light), **hue alone never distinguishes the teams**: every two-team recharts view carries direct series labels (team code at the bar/line end), and Team B series additionally use a dashed stroke or pattern fill where the mark geometry allows (behavioral rule mirrored in EXPERIENCE.md).

**Single-series charts** (Player Profile cross-match trends, Hub leaderboard charts — any chart that is not team-vs-team) use {colors.viz-single} / {colors.viz-single-light} as the one series color.

**Shot-outcome encoding** (shot maps and cross maps, on pitch — echoes the source-PDF hue families: green=goal, light blue=on target, amber=off target, purple=blocked, dark blue=incomplete; the source's dark blue is lightened so it clears 3:1 on the pitch). {colors.shot-goal} is its own emerald, deliberately distinct from {colors.accent-lime} / {colors.viz-team-a}, so outcome encoding can never read as team encoding:

| Outcome | Token (pitch / dark canvas) | Light-canvas variant | Marker shape (mandatory dual encoding) |
|---|---|---|---|
| Goal | {colors.shot-goal} | {colors.shot-goal-light} | Filled circle + 1.5px {colors.ink-primary} ring |
| On target | {colors.shot-on-target} | {colors.shot-on-target-light} | Filled circle |
| Off target | {colors.shot-off-target} | {colors.shot-off-target-light} | Hollow circle (2px stroke) |
| Blocked | {colors.shot-blocked} | {colors.shot-blocked-light} | Filled square |
| Incomplete | {colors.shot-incomplete} | {colors.shot-incomplete-light} | Hollow square (2px stroke) |

All five are ≥3:1 against {colors.pitch-surface} (computed 6.91 / 6.46 / 6.76 / 5.75 / 4.58 — WCAG AA non-text). On theme-aware canvases (legend swatches, momentum goal markers, data-table swatches) the light theme uses the `-light` variants, each computed ≥3:1 on {colors.surface-raised-light} (5.95 / 6.93 / 6.92 / 7.10 / 7.51). Shape encoding is mandatory because green vs. amber is ambiguous under red-green color-vision deficiency. Marker size scales with xG where the viz calls for it; positions are always true source coordinates (FR-24).

**Receiving & defensive-action maps** (offers to receive, movement to receive, defensive actions — the Domain D marker families): d3 pitch maps whose markers use the owning team's accent ({colors.viz-team-a} / {colors.viz-team-b}, computed 9.56 / 7.26 vs. pitch) with shape dual-encoding — hollow diamond = offer to receive, filled diamond = movement to receive, filled triangle = defensive action [ASSUMPTION: shape assignments proposed; the source PDF renders these families as distinct marker glyphs]. These maps encode team only, never mixed with outcome encoding. The heat and edge-weight ramps below, like the pitch itself, are theme-invariant (they render only on {colors.pitch-surface}) and therefore carry a single verified value instead of a `-light` variant.

**Pass-network edge weight ramp** (low → high volume): {colors.edge-weight-1} → {colors.edge-weight-2} → {colors.edge-weight-3} → {colors.edge-weight-4} → {colors.edge-weight-5}, with stroke width rising in parallel (weight is dual-encoded by color and thickness). Lowest stop is ≥3:1 vs. pitch. Nodes use the team accent; node size encodes pass involvement.

**Heatmap ramp** (intensity low → high): transparent-on-pitch below threshold, then {colors.heat-1} → {colors.heat-2} → {colors.heat-3} → {colors.heat-4} → {colors.heat-5}. Lightness rises strictly monotonically with intensity (computed relative luminance 0.267 → 0.366 → 0.462 → 0.645 → 0.886), so intensity reads without color perception, and every rendered step clears 3:1 against the pitch (computed 3.68 / 4.83 / 5.95 / 8.08 / 10.87).

**Momentum Timeline.** Area fills in {colors.viz-team-a} / {colors.viz-team-b} at 60% opacity above/below the midline. The midline is drawn in {colors.ink-primary} on a reserved 2px axis gutter that the area fills never enter, so it always sits on the card surface (computed 15.8:1 vs. {colors.surface-raised}) instead of vanishing inside a team fill. Goal events are marked on the axis with the shot-outcome goal marker — {colors.shot-goal} + ink ring (computed 9.80:1 vs. {colors.surface-raised}); its emerald hue is distinct from both team accents, so a goal marker can never read as "Team A." On light canvas use the `-light` team variants and {colors.shot-goal-light} (computed 5.95:1 on {colors.surface-raised-light}).

**Result chips** (standings/results): {colors.result-win} / {colors.result-draw} / {colors.result-loss} (light: `-light` variants), always paired with the letter (V/E/D in Spanish, W/D/L in English — i18n table) — never color-only. Letter color: {colors.result-chip-ink} on the dark-theme fills (computed 10.68 / 6.35 / 6.66) and {colors.result-chip-ink-light} on the `-light` fills (computed 5.36 / 5.61 / 5.55) — all six pass 4.5:1 text contrast. [ASSUMPTION: result-chip colors proposed; not in sources.]

## Typography

Numbers are the product, so type is numbers-forward. Two families, both open-source and self-hosted via `next/font` (zero external requests — static-site budget):

- **Archivo** — the broadcast voice. Scores, headline stats, section headings. Grotesque, high-contrast weights (700–800), tight leading. Used at {typography.display-score} (match score), {typography.display-stat} (hero story stats), {typography.stat-value} (stat tiles), {typography.headline} (section headings).
- **Inter** — the workhorse. Body, labels, tables, navigation: {typography.title}, {typography.body}, {typography.table-numeric}, {typography.label-caps}, {typography.caption}.

[ASSUMPTION: Archivo + Inter are the proposed picks; any swap must preserve: open license, self-hostable, true tabular figures, and a heavy grotesque display weight.]

**Tabular numerals are mandatory** wherever numbers align vertically or update in place: stat tiles, data tables, leaderboards, comparison columns, axis labels. Apply `font-variant-numeric: tabular-nums` (both families support it). Proportional figures are acceptable only in running prose.

Ramp discipline: {typography.display-score} appears once per Match Dashboard (the scoreline). No type below 11px anywhere. All sizes are px-specified but implemented in rem; the ramp must survive 200% browser zoom without horizontal scroll in the Hero Layer.

## Layout & Spacing

Tailwind's 4-based spacing scale is inherited. Named tokens set the page rhythm:

- {spacing.gutter-mobile} (16px) page margins below `md`; {spacing.gutter-desktop} (24px) above.
- {spacing.tile-gap} (12px) between stat tiles in a grid.
- {spacing.section-gap} (48px) between sections within a layer.
- {spacing.layer-gap} (64px) between Hero → Tactical → Expert layers — the largest gap on any page, making the layer boundary legible as a visual "altitude change."

**Header height is a token, not a constant (ruled 2026-08-26, shipped and re-measured in story 3.10).** {spacing.header-h-oneline} one row, {spacing.header-h-wrapped} where the row wraps, plus {spacing.scroll-clearance} of breathing room. It is declared once as a custom property driven by the breakpoint and consumed by `scroll-padding-top` **and** by every sticky offset that mirrors it — seven consumers in all, including `/compare`'s mini-header ({spacing.compare-mini-h}) and the `#main-content` skip link. The 4.5rem constant it replaced was wrong by 46px at wrapped widths, hiding anchored headings behind the bar; measured after the fix, an anchored heading now clears the bar by 16px at every width in both locales.

Two values, not three: `header-h-zoom` was removed because the nav's composition change collapsed it into `header-h-wrapped` (both measure 118px at 195px now). The thresholds moved too — the header wraps only below ~215px, so no phone wraps any more. **Any change to the header's composition changes this token, and this is the second time that rule has fired; nothing may hardcode the height again.**

Content max-width: `max-w-6xl` (1152px) for dashboard surfaces; data tables and comparison views may use full width inside it. Mobile-first single column at 390px design width; the Hero Layer must never require horizontal scrolling at 390px. Wide artifacts (Expert tables) scroll horizontally *inside their own container*, never the page.

## Elevation & Depth

Depth is tonal, not shadowed. The three-step surface ladder (base → raised → overlay) carries hierarchy in both themes. Shadows exist only on true overlays (popovers, sheets, tooltips): a single soft shadow `0 8px 24px rgba(0,0,0,0.35)` on dark, `0 4px 16px rgba(21,25,29,0.12)` on light. Pitch panels are flat — no shadow. In the dark theme they carry a {colors.border-hairline} border: the green-vs-charcoal edge computes only 1.55:1, too soft for low-vision users. In light the canvas itself is the edge (computed 11.35:1), so no border. Never use elevation to signal importance of a stat; importance is typography and position.

## Shapes

- {rounded.sm} (4px): inputs, chips, tooltips, table cells' selection highlight.
- {rounded.md} (8px): cards, stat tiles, buttons, empty-state panels.
- {rounded.lg} (12px): pitch panels and major viz containers.
- {rounded.full}: pills only — result chips, layer badges, the language toggle track.

The overall shape voice is crisp-but-not-sharp: a data tool with broadcast polish, not a neon dashboard. Corner radii on viz containers never clip data marks — pitch drawings keep an internal padding of at least `{spacing.tile-gap}`.

## Components

Visual specs only; behavior lives in EXPERIENCE.md → Component Patterns. Most components below are illustrated in situ by [mockups/key-match-dashboard-mobile.html](mockups/key-match-dashboard-mobile.html) (dark theme, 390px) and [mockups/key-match-dashboard-desktop.html](mockups/key-match-dashboard-desktop.html) (dark theme, expanded Tactical Layer with pitch panels). The 2026-08-26 additions — feature badge, navigation menu and the re-ruled site header — are illustrated by [mockups/key-landing-mobile.html](mockups/key-landing-mobile.html) (390px landing) and [mockups/key-navigation.html](mockups/key-navigation.html) (sheet at 320px, reflow at 195px, inline nav at `≥xl`). Mocks illustrate, spines win on conflict.

- **Stat tile** — {components.stat-tile}. Value in {typography.stat-value} tabular, label above in {typography.stat-label} uppercase {colors.ink-secondary}. In head-to-head context the leading side's value takes the team accent **plus a non-color leader cue: a small ▲ glyph before the leading value** (color alone never encodes who leads — 1.4.1); trailing side stays {colors.ink-primary}. No icons inside tiles beyond the leader glyph.
- **Stage-context chip** — {typography.label-caps} pill ({rounded.full}) on {colors.surface-overlay} with {colors.ink-secondary} text; sits beside the scoreline in the Hero ("Octavos de final").
- **Layer section shell** — {components.layer-shell}. Full-width band: section heading in {typography.headline}, optional one-line summary in {typography.body} {colors.ink-secondary}, hairline top rule. Expert-layer shells carry a `EXPERTO / EXPERT` pill in {typography.label-caps}.
- **Pitch panel** — {components.pitch-panel}. Deep-green pitch, {rounded.lg} container, viz title in {typography.title}, legend row in {typography.caption}, and a permanent attribution/source line in {typography.caption} {colors.ink-secondary} at the panel's bottom edge (so screenshots retain attribution).
- **Data table** — {components.data-table}. shadcn Table base; header row on {colors.surface-raised} with {typography.stat-label} column heads; numeric cells right-aligned in {typography.table-numeric} tabular; active sort column head in {colors.accent-cyan} with direction glyph; zebra striping never — hairline row dividers only.
- **Comparison column** — {components.comparison-column}. Entity header (name, crest placeholder, meta) top-bordered 2px in its entity accent ({colors.viz-team-a} / {colors.viz-team-b}); mirrored stat rows share a centered label. The accent border is the only entity color — no full-tinted columns.
- **Language toggle** — {components.language-toggle}. Segmented pill `ES | EN`, active segment {colors.accent-lime} fill with {colors.accent-lime-ink} text, inactive {colors.ink-secondary}. Sits in the site header next to the theme toggle.
- **Empty-state panel** — {components.empty-state-panel}. Dashed hairline border, centered {typography.title} headline + {typography.body} explanation, muted glyph. Occupies the same footprint as the missing viz — the layout never collapses silently (FR-22).
- **Glossary tooltip** — {components.glossary-tooltip}. Trigger: dotted underline in {colors.accent-cyan} on the term. Panel: {colors.surface-overlay}, {rounded.sm}, term in {typography.title}, definition in {typography.body}, link to the glossary entry in {colors.accent-cyan}.
- **Momentum Timeline** — a pitch-adjacent viz, not a pitch panel: rendered on {colors.surface-raised} (recharts), team areas, ink-primary midline gutter, and goal markers per the momentum spec in Colors → Data-visualization palette, axis labels in {typography.caption} tabular. Carries the same in-panel attribution caption as pitch panels.
- **Result chip** — {components.result-chip}. {rounded.full} filled pill; fill per outcome ({colors.result-win} / {colors.result-draw} / {colors.result-loss}, `-light` variants in light theme); letter in {typography.label-caps}, colored {colors.result-chip-ink} on dark fills and {colors.result-chip-ink-light} on light fills (computed ratios in Colors → Result chips). Always letter + fill, never color-only.
- **Site header** — {components.site-header}. Slim bar on {colors.surface-base} with a hairline bottom rule. **RE-RULED 2026-08-26 (UX-DR24).** The former clause — *"no primary nav beyond the wordmark"* — is superseded; it was a considered decision, not an oversight, and the reasoning that replaces it (including the 237 → 354 px width arithmetic) lives in EXPERIENCE.md → Navigation. Composition at `≥xl`: wordmark/home link in {typography.title} with the authorship caption in {typography.caption} {colors.ink-secondary} beneath it, then inline nav links in {typography.body}, header search, language toggle, theme toggle. At `<xl`: wordmark + caption, then a single menu trigger. **The chrome stays quiet either way** — nav links are {colors.ink-primary}, never accent-filled, and the active route's marker is the only accent in the bar.
- **Navigation menu** — {components.nav-menu}. Trigger is an unfilled icon button matching the theme toggle's weight — quiet chrome, never an accent-filled "active tool". Sheet on {colors.surface-overlay}, {rounded.md}, full-**width** 386 px at `top: 0` with content-driven height. **Geometry is not modality:** the sheet is *visually* partial and *behaviourally* modal — it follows the shipped Story 2.14 sheet, which is a modal Radix dialog that inerts the document (`HeaderSearch.tsx:388`). A scrim is therefore required over the inerted page; links in {typography.body} {colors.ink-primary} separated by hairline rules, grouped destinations above the {colors.border-hairline} rule that separates them from the language and theme controls. The current route carries a {components.nav-menu.current-marker-color} leading marker **plus its own weight change** — never the marker's color alone (1.4.1). Inline links at `≥xl` use the same type and color, with the current route underlined rather than marked.
- **Feature badge** — {components.feature-badge}. Landing page only. Card on {colors.surface-raised}, {rounded.md}, hairline border: label in {typography.title} {colors.ink-primary}, one supporting line in {typography.body} {colors.ink-secondary}. **Emphasised variant** (`/compare`): full width, first position, and a 2px {colors.accent-lime} top border — larger, higher, and bordered, so the emphasis survives both a grayscale render and a screen reader that sees none of it. No icons, no illustration, no gradient: the badge grid is chrome, and chrome stays quiet.
- **Header search** — {components.header-search}. shadcn Command-style input; results panel on {colors.surface-overlay} ({rounded.sm}), result rows in {typography.body} with the matched substring highlighted in {colors.accent-cyan} and the entity type in {typography.label-caps} {colors.ink-secondary}. [ASSUMPTION: search is a scope addition beyond PRD FRs — behavioral spec in EXPERIENCE.md → Component Patterns.]
- **Theme toggle & comparison entity picker** — shadcn components (Toggle, Command) used as-is with the mapped CSS variables; no visual delta beyond tokens.
- **Attribution footer** — one {typography.caption} line in {colors.ink-secondary} on {colors.surface-base}, hairline top rule, link to the about page in {colors.accent-cyan}. Present on every route.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep all analyst depth reachable — density moves behind progressive disclosure | Delete or thin Expert-layer data to improve readability or Lighthouse scores (SM-C2) |
| Fit the Hero Layer at 390px in first-viewport-plus-one-scroll, vertical only | Allow any horizontal page scroll at 390px in the Hero Layer (FR-21) |
| Render markers at true 0–100 source coordinates; overlaps stay overlapped | Jitter, snap-to-zone, or "clean up" marker positions — rendered maps must match the source PDF layout (FR-24) |
| Keep the attribution line visible on every route and inside every pitch panel | Ship any surface or screenshot-able viz without a visible data-source attribution (OQ-3) |
| One meaning per color per viz; dual-encode with shape/width/lightness | Mix team encoding and outcome encoding in one chart, or rely on hue alone |
| Use app-owned Team A/B accents for all head-to-head data encoding | Use real federation colors as data encoding (unverifiable contrast across 48×47 pairings) |
| Keep the pitch deep green in both themes | Invert or lighten the pitch surface in light mode |
| Tabular numerals in every aligned numeric context | Proportional figures in tables, tiles, or leaderboards |
| Quiet chrome: charcoal, hairlines, muted labels | Gradients, glows, or accent-colored chrome competing with data |
| Emphasise a landing badge with size, position and a border | Emphasise it with fill or hue alone — the emphasis has to survive grayscale and a screen reader |
| Keep the landing page free of tables — everything dense has its own route | Reintroduce standings, results or boards onto `/` "just as a teaser" |
| Let the `<xl` header shrink: one trigger absorbing the chrome is the ruled composition | Add a fifth element to the header row — the row already wraps below 354px |

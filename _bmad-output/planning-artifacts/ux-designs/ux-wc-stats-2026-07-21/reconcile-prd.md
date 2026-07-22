# Reconciliation — PRD run vs. UX spines

Source: `prd.md` + `addendum.md` (prd-wc-stats-2026-07-21). Spines: `DESIGN.md`, `EXPERIENCE.md` (ux-wc-stats-2026-07-21). Spines win on conflict; every conflict is surfaced below.

## 1. Coverage

### Functional requirements FR-21..FR-34

| PRD element | Spine coverage |
|---|---|
| FR-21 Hero Layer (~15s, 390px, no horizontal scroll) | EXPERIENCE → Progressive Disclosure Contract ("15-second hero test"), Key Flows UJ-1, Interaction Primitives; DESIGN → Layout & Spacing (390px rule), Do's and Don'ts |
| FR-22 Tactical Layer + explicit empty states | EXPERIENCE → Progressive Disclosure Contract (Tactical row), State Patterns, Component Patterns (empty-state panel); DESIGN → Components (empty-state panel "never collapses silently") |
| FR-23 Expert Layer, one page, every Domain G field | EXPERIENCE → Progressive Disclosure Contract (Expert row), Component Patterns (layer section shell), Responsive & Platform (Expert per-player tables) |
| FR-24 True-coordinate pitch viz | EXPERIENCE → Visualization Layering (universal rules), Component Patterns (pitch panel: "never displaced"); DESIGN → Data-visualization palette, Do's and Don'ts (no jitter/snap) |
| FR-25 Results & standings, all 104 reachable | EXPERIENCE → Information Architecture (Hub route, mandatory cross-links), Responsive & Platform (Hub tables) |
| FR-26 Leaderboards, client-side sort, no network | EXPERIENCE → Component Patterns (data table), Key Flows UJ-4 |
| FR-27 Player Profile + navigate to matches behind values | EXPERIENCE → IA (route + cross-links), Visualization Layering (profile trends row), UJ-4 epilogue |
| FR-28 Team Profile tactical identity | EXPERIENCE → IA, Key Flows UJ-3 |
| FR-29 Comparison Mode, two entities, client-side | EXPERIENCE → IA (URL scheme), Component Patterns (entity picker, comparison column), UJ-3; DESIGN → Components (comparison column) |
| FR-30 Externalized UI copy, mechanical enforcement | EXPERIENCE → i18n & Terminology, Voice and Tone (data names as-is) |
| FR-31 Spanish default + persistent toggle | EXPERIENCE → Component Patterns (language toggle, `localStorage`, pre-paint read), i18n & Terminology; DESIGN → Components (language toggle) |
| FR-32 Per-term tactical-terminology policy | EXPERIENCE → i18n & Terminology per-term table (21 terms, OQ-1 resolved) — but see Contradiction C4 |
| FR-33 Full static export, Netlify free tier | EXPERIENCE → Foundation, IA (all routes pre-rendered, static 404) |
| FR-34 Per-route bundles, client-side dynamism, budgets | EXPERIENCE → Foundation (hard budgets), State Patterns (cold load), Component Patterns |

Epic 1 FRs (FR-1..20, FR-35) are pipeline-side and out of UX scope; FR-35's App-side consumer is covered via the Momentum Timeline component and its OQ-5 empty state.

### User journeys

| Journey | Spine coverage |
|---|---|
| UJ-1 Mariana, phone catch-up | EXPERIENCE → Key Flows UJ-1 (including the "match she doesn't remember" stage-chip edge case and the momentum-missing failure path) |
| UJ-2 Diego, knockout dissection | EXPERIENCE → Key Flows UJ-2 (including EN toggle, screenshot-with-attribution, mid-block-share climax) |
| UJ-3 Diego, finalists comparison | EXPERIENCE → Key Flows UJ-3 (including shareable-URL climax and bad-slug failure path) |
| UJ-4 Mariana, fastest-player argument | EXPERIENCE → Key Flows UJ-4 (under a minute, es-CO formatting) |
| UJ-5 Juan, pipeline re-run | Not UX-relevant (builder/pipeline journey) — correctly absent |

### §4.6 section order

PRD §4.6: header → head-to-head key stats → possession/momentum timeline → shot maps + xG → passing networks → phases-of-play → pressing & defensive blocks → set plays.

EXPERIENCE → Progressive Disclosure Contract (Tactical row) reproduces this order exactly and appends goalkeeping last (flagged `[ASSUMPTION]` — §4.6 omits Domain E). **Covered**, with two flags: the momentum-first tension (Contradiction C1) and a missing `#key-stats` anchor (IA's anchor list starts at `#momentum` although the PDC says "Every section has an anchor").

### Cross-cutting NFRs (§5)

| NFR | Spine coverage |
|---|---|
| Performance budgets (Lighthouse ≥90, ≤500 KB/route) | EXPERIENCE → Foundation ("Hard budgets") |
| Accessibility WCAG 2.1 AA + data-table alternative per chart | EXPERIENCE → Accessibility Floor ("data-table alternative … text alternative of record"); DESIGN → contrast ratios throughout Colors |
| Responsive, mobile-first Hero/Hub; Tactical/Expert usable on mobile | EXPERIENCE → Responsive & Platform ("degradation changes layout, never removes data") |
| Shareability: stable human-readable URLs, meaningful titles/meta | EXPERIENCE → IA (slugs), UJ-1 step 1 (link-preview meta). Meta/title requirement only demonstrated for match pages, not stated for player/team routes — partial |
| Browser support (evergreen only) | **DROPPED** — neither spine states a browser-support posture (low risk; arguably architecture's line) |
| Pipeline reproducibility | Not UX-relevant — correctly absent |
| Language discipline (English artifacts, copy via Locales) | EXPERIENCE → i18n & Terminology, Voice and Tone |

### Open questions delegated to UX

| OQ | Spine coverage |
|---|---|
| OQ-1 terminology policy | **Resolved** in EXPERIENCE → i18n & Terminology per-term table + default rule for new terms (see C4) |
| OQ-3 attribution wording & placement | **Resolved** in EXPERIENCE → i18n & Terminology "Attribution (OQ-3)" (footer + in-panel caption + `/about`, es/en wording proposed); DESIGN → pitch panel + attribution footer components |
| OQ-5 momentum source | Correctly treated as open: EXPERIENCE → State Patterns (dedicated missing-momentum empty state), Component Patterns (Momentum Timeline) |

### Glossary vocabulary

Hero/Tactical/Expert Layer, Progressive Disclosure, Story Stats, Momentum Timeline, Comparison Mode, Locale, Pitch Coordinates, Match Bundle, Tournament Index, Phases of Play, Line Break, Defensive Block, Line Height/Team Length, Pass Network, Speed Zones, xG — all used with PRD meanings across both spines (EXPERIENCE throughout; DESIGN in Components and the viz palette). Pipeline-only terms (PMSR, Marker, Marker–Event Linking, Self-Validation, Text-Anchored Discovery) are correctly absent. "Spatial Event" subtypes are only partially represented — see D2.

### Counter-metrics

- SM-C2 depth preservation — DESIGN → Do's and Don'ts row 1; EXPERIENCE → Progressive Disclosure Contract ("Depth is never deleted…") and the pass-network quintile toggle rationale. Covered.
- SM-C1 validation integrity — pipeline-side; correctly absent.

## 2. Contradictions

- **C1 — Momentum "first on scroll" vs. §4.6 order (internal + PRD).** PRD §4.6 and EXPERIENCE's own Tactical order both put *head-to-head Key Statistics before the Momentum Timeline*. Yet EXPERIENCE → Progressive Disclosure Contract states "The Momentum Timeline is the first Tactical element encountered on scroll," and UJ-1 step 4 has Mariana reach the timeline in one scroll. Both cannot hold unless Key Statistics is absorbed into the Hero's Story Stats — which the PDC explicitly denies ("Story Stats … superseded by full Key Statistics block" at Tactical altitude). Needs a ruling: either Key Statistics precedes momentum (PRD §4.6 wording) or momentum leads the Tactical Layer (UJ-1 narrative).
- **C2 — Missing "incomplete" shot outcome.** Addendum §1 (binding) defines five exact-RGB outcomes — goal / on target / off target / blocked / **incomplete (dark blue)** — and the spike ground truth includes 1 incomplete marker. DESIGN → Data-visualization palette's shot-outcome table specifies only four (Goal, On target, Off target, Blocked), and its "echoes the source-PDF hue families" note also omits incomplete. Since the palette is declared "normative for every d3 and recharts view," an extracted incomplete shot/cross has no token or marker shape, conflicting with FR-24's "render from Pitch Coordinates" completeness and SM-3 spot-check fidelity.
- **C3 — Hero "nothing collapsible" vs. lineups "in a compact disclosure."** EXPERIENCE → Progressive Disclosure Contract's Hero row says "nothing collapsible — it is simply *there*," yet the same cell places "lineups & formations in a compact disclosure." Internal contradiction in the normative contract; also decides where PRD §4.6's header content (lineups, formations) sits without saying which rule wins.
- **C4 — FR-32 "not a blanket rule" vs. Spanish-first default.** PRD FR-32: the terminology policy "is a UI-copy decision resolved term-by-term … **not a blanket rule**." EXPERIENCE → i18n & Terminology sets a tie-breaker "**Spanish-first** — translate unless no usable Spanish exists" and defaults new terms to translate "unless they meet the xG bar." The 21 shipped terms are decided per-term (compliant), but the default rule for future terms is effectively a blanket rule with exceptions. Spine wins, but the deviation from FR-32's framing should be logged.
- **C5 — Goalkeeping appended to the §4.6 order.** PRD §4.6's fixed order ends at set plays; EXPERIENCE appends "→ goalkeeping" (self-flagged `[ASSUMPTION]`). An extension rather than a reversal — Domain E must render somewhere and §4.6 forgot it — but it alters a PRD-specified order and is surfaced here.
- **C6 — Route surface count.** PRD Epic 2 preamble: "four top-level surfaces … plus Comparison Mode." EXPERIENCE IA ships eight routes, adding `/glossary`, `/about`, `/404`. Additive and each traceable to a PRD requirement (FR-32 tooltips → glossary; OQ-3 → about; static delivery → 404), not a scope conflict — noted for completeness.

## 3. Dropped qualitative ideas

- **D1 — "Informal hallway tests" as the SM-2 proxy.** PRD §9 pairs FR-21's viewport consequence with informal hallway testing. The spines carry the mechanical 15-second test but not the human-validation intent. Minor, but it's the only stated qualitative acceptance method for the Hero.
- **D2 — Offers/movement-to-receive and defensive-action spatial maps.** PRD Vision §1 names "offers to receive" as part of the differentiating "full PMSR tactical taxonomy," and FR-10 extracts those marker families (Domain D also lists "defensive actions"). Neither spine gives them a visualization or an Expert-layer event log — Visualization Layering covers shot/cross maps, pass networks, and heatmaps only, and the Expert row's event logs are "shot log, cross log, pass matrix." The PRD's own FR-24 requires only shots/crosses/networks, so this mirrors a PRD gap rather than breaking a requirement — but extracted data with no rendering surface silently undercuts the "completeness" differentiation claim. Worth a deliberate decision (render, table-only, or explicitly defer).
- **D3 — Browser-support posture.** §5's "current evergreen browsers; no legacy burden" appears nowhere in the spines (also listed under Coverage as DROPPED).
- **D4 — Link-preview meta beyond match pages.** §5 shareability wants "meaningful titles/meta" on every match, player, and team URL; EXPERIENCE demonstrates it only in UJ-1 for matches. The player/team meta intent didn't land explicitly.
- **D5 — "Free, open" posture / portfolio framing (SM-6).** `/about` carries "methodology, project credits," which gestures at it, but the public-repo/write-up framing is absent. Acceptable — it's a builder outcome, not a UX surface — recorded for completeness.
- Intent that **did** land (verified, not dropped): "nobody gets a dumbed-down app and nobody gets an impenetrable one" → EXPERIENCE Foundation "Two audiences, one surface … never separate apps or 'simple mode' toggles"; UJ-1's match-arc-as-story ("dominance, the collapse, the late surge"); UJ-2's "number he could not have gotten anywhere else" climax; the stage-chip orientation edge case; SM-C2's density-behind-disclosure framing; screenshot-borne attribution as Diego's citation path.

## 4. Verdict

The reconciliation is clean enough to finalize, with a short parent-attention list rather than a rework. All fourteen App-side FRs, all four user journeys, the delegated open questions (OQ-1, OQ-3 resolved; OQ-5 correctly held open), the counter-metrics, and the glossary vocabulary are covered with traceable section-level homes, and the spines' deviations are mostly self-flagged assumptions. Two items warrant fixes before the spines are treated as frozen: C2 (the missing "incomplete" shot outcome breaks the palette's own normative-completeness claim against binding addendum ground truth) and C1 (the momentum-first narrative contradicts the §4.6 order the same document reproduces — an internal inconsistency a build team will trip over). C3's one-line "nothing collapsible vs. compact disclosure" wording and the missing `#key-stats` anchor are trivial edits. D2 (offers-to-receive / defensive-action rendering) should get an explicit defer-or-include decision logged, since it touches the product's completeness claim; the remaining drops (D1, D3, D4, D5) are low-risk and can ride along as notes.

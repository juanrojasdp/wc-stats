# PRD Quality Review — World Cup 2026 Match Analytics Dashboard

Reviewed against `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`. Calibration: solo passion/portfolio project, $0 budget, public launch, fast-path drafted from a validated brief; chain-top (feeds BMad UX → architecture → epics), so downstream usability and done-ness are weighted up while enterprise apparatus (ROI, stakeholders, rollout) is correctly absent.

## Overall verdict

This is a genuinely strong PRD for its stakes: the thesis is specific and defensible, decisions are stated as decisions with trade-offs and counter-metrics, scope honesty is exemplary (forceful Non-Goals, 10 indexed assumptions, gated Post-MVP), and the two-epic capability-spec/consumer-app split fits the product's shape exactly. The risk sits in done-ness: roughly a third of FRs carry no explicit testable consequence and a few lean on vague phrases ("sized for client-side consumption", "human-readable"), and the unlinked-marker tolerance that primary metric SM-1 depends on is referenced but never defined. Fix those two things and this is safely consumable by architecture and epics; nothing here is structurally broken.

**Verdict: ready-with-fixes.**

## Decision-readiness — strong

Decisions read as decisions throughout. §4.5 commits to JSON-first with the SQLite fallback explicitly demoted to "documented contingency, not an MVP deliverable" and a named trigger ("demonstrated client-side failure, not preference" — addendum §3). §6.2 takes a position on IP (free-with-attribution now, monetization hard-gated on OQ-2) rather than hedging. §8.1's ordering note ("first implementation tasks after kickoff are FR-15 and FR-12") is a real sequencing decision with stated risk rationale. The Open Questions (§10) are genuinely open — each has an owner and a resolution venue, none has its answer smuggled into the next sentence. The single `[NOTE FOR PM]` (§8.2, tactical-similarity as v2 anchor) sits at a real prioritization tension, not a safe checkpoint.

No findings. A pushback reader ("why not SQLite?", "why Spanish default?", "why no monetization?") finds their objection pre-answered with reasons, which is the test.

## Substance over theater — strong

No persona theater: §2 uses JTBD framing with exactly two user archetypes (Mariana, Diego) plus the builder, and both archetypes visibly drive decisions — Progressive Disclosure exists because of the two-audience tension named in §1, Spanish-default i18n (FR-30..32) exists because of Mariana, per-player tables (FR-23) because of Diego. The differentiation claim in §1 is specific and falsifiable ("no product — FIFA's own included — offers the full PMSR tactical taxonomy... tournament-wide"), not template-driven novelty. NFRs (§5) carry product-specific numbers (Lighthouse mobile ≥ 90, ≤ 500 KB compressed per route, WCAG 2.1 AA with the concrete "data tables reachable for every chart" floor) rather than boilerplate adjectives. The Vision could not swap into another PRD — it is built around the PMSR artifact and the 104-match frozen-dataset premise.

### Findings
- **low** "Analyst (social)" JTBD thinly served (§2.1 vs §4/§5) — the credible-citation job is carried only by the Shareability NFR (stable URLs, link-preview meta). Adequate for MVP, but worth one sentence acknowledging that citation support is URL-level only (no export/embed). *Fix:* add a line to §5 Shareability or §7 noting export/embed is out of scope; screenshots are the citation path (as UJ-2 already implies).

## Strategic coherence — strong

The thesis is stated and everything hangs off it: public-but-frozen data made usable, with completeness + cross-match aggregation + polish as the differentiation axis (§1). MVP scope kind is coherent — problem-solving/experience — and §8.1 prioritization follows risk, not ease (spatial linking and template verification first). Success Metrics validate the thesis rather than measuring activity: SM-1 (extraction completeness), SM-3 (positional fidelity), SM-4 (zero cost) are exactly the bets the Vision makes. The counter-metrics are a standout — SM-C1 (never loosen validation to hit 100%) and SM-C2 (never delete depth for speed scores) name the precise ways the primary metrics could be gamed.

### Findings
- **low** No audience-reach signal of any kind (§9, §6.3) — for a public-launch product there is zero measurement of whether anyone visits, compounded by the §6.3 no-analytics assumption. Defensible for a portfolio project (SM-6 covers the builder outcome), but the PRD never says this trade-off out loud. *Fix:* one sentence in §9 acknowledging reach is intentionally unmeasured at MVP (Netlify bandwidth dashboard as the only passive signal), so downstream doesn't add analytics "helpfully".

## Done-ness clarity — adequate

This is the weakest dimension, and the one the rubric says to be unforgiving on because story creation leans on it. Where consequences exist they are excellent — FR-10's "exactly 16 markers with the known 2/2/8/3/1 outcome distribution" and FR-11's injected off-palette abort are model acceptance criteria. But coverage is uneven: FR-5, FR-6, FR-7, FR-13, FR-16, FR-18, FR-22, FR-25, FR-27, FR-28, FR-29, FR-31, FR-32 have no explicit Consequences block. For the simple tabular extractions (FR-5..7, FR-13) the FR-3/FR-4 pattern (presence + type-check, fail loud) plus "Appendix A of the brief... is normative for coverage" (§4.2) is inferable, so those are tolerable. The App-side FRs are capability-phrased ("A visitor can..."), which carries some acceptance weight, but FR-27/28/29 are feature lists with no bound at all.

### Findings
- **high** Undefined Self-Validation threshold for unlinked markers (FR-12 → FR-14 → SM-1) — FR-12 says unlinked Markers "fail Self-Validation thresholds", but FR-14 defines Self-Validation as a binary count cross-check; no threshold for unlinked-marker tolerance exists anywhere. SM-1 (primary metric, "Self-Validation passing" 104/104) is therefore not fully computable, and SM-C1 forbids loosening a threshold that was never set. *Fix:* either define the tolerance (e.g., 100% of shot Markers linked, or N unlinked allowed with manifest documentation) or add an explicit `[ASSUMPTION: unlinked-marker threshold set during architecture]` and index it.
- **high** Thirteen FRs lack explicit testable consequences (§4.2–§4.12) — worst offenders are the vague phrases: FR-18 "sized for client-side consumption" (should bind to §5's ≤ 500 KB budget explicitly), FR-16 "human-readable batch summary" (no content floor beyond the description). *Fix:* add one consequence each to FR-16, FR-18, FR-27, FR-28, FR-29 at minimum; for FR-5..7/FR-13 a single blanket consequence in §4.2 ("every Domain record follows the FR-3/FR-4 presence + type-check + fail-loud pattern; Appendix A field inventory is the coverage test") would close the gap cheaply.
- **medium** FR-15's sample definition is under-specified ("at least one report per venue and per matchday round") — with 16 venues and multiple rounds this could be ~20+ reports or interpreted as a much smaller union; the consequence (deviation summary localizable to venue/matchday) is good but the sample-size intent should be pinned. *Fix:* state the intended sample construction (union vs. cross-product, approximate count).
- **low** "~15 seconds" appears in FR-21, the Hero Layer glossary entry, and SM-2 as a soft target — acceptable because FR-21's viewport consequence is the real testable proxy and SM-2 says so, but ensure downstream treats the viewport rule, not the stopwatch, as acceptance.

## Scope honesty — strong

Best-in-class for this PRD's size. §7 Non-Goals do real work and are written to resist re-litigation ("Ever, in this product's v1 shape — not 'later'"). §8.2 de-scopes with reasons and gates rather than silence (data pack gated on OQ-2; SQLite with a named trigger). Ten `[ASSUMPTION]` tags all indexed in §11; open-items density (5 OQs + 10 assumptions + 1 NOTE) is proportionate to a green-light PRD at these stakes because every item has an owner and none blocks Epic 1 kickoff except OQ-5 (see next dimension).

### Findings
- **low** Addendum/PRD scope drift on heatmaps (addendum §2 vs §4) — the addendum's tech selection says d3 is for "shot maps, pass networks, heatmaps", but no PRD feature mentions a heatmap. Either it was silently dropped or silently assumed. *Fix:* delete "heatmaps" from the addendum or add it to a feature/Out-of-Scope line.

## Downstream usability — strong (one gap)

The Glossary (§3) is comprehensive and actually used — Match Bundle, Tournament Index, Marker, Pitch Coordinates, Self-Validation, and the three Layers are employed identically across FRs, UJs, and SMs. IDs are contiguous and unique (FR-1..34, UJ-1..5, SM-1..6 + C1/C2, OQ-1..5); every cross-reference I chased resolves (FR-23→FR-8, FR-12→§8.1, FR-32→OQ-1, SM rows→FR ranges, addendum risk table→FR/§ targets). UJs all have named protagonists carrying context inline. The two-epic contract framing (§4 preamble, FR-20) is exactly what architecture needs to source-extract.

### Findings
- **medium** Momentum timeline has no extraction FR (UJ-1, FR-22, OQ-5) — the momentum/possession timeline is rendered by FR-22 (and is UJ-1's "scrolls once" payoff) but maps to no Epic 1 FR: Domain B has possession totals, not a time series. OQ-5 honestly flags the source as unconfirmed with an owner, which contains the risk, but as written an epics pass over FR-1..20 would produce a Pipeline that cannot feed FR-22's first visualization. *Fix:* add a provisional FR (or extend FR-4/FR-5) for timeline extraction marked contingent on OQ-5, so Epic 1 coverage is traceable.
- **low** Glossary gaps: "story stats" and "momentum timeline" (§3) — both are used repeatedly (FR-21, FR-22, UJ-1, Hero Layer definition) with meanings a reader must infer; "story stats" in particular has an enumerated list in FR-21 that should be the canonical definition. *Fix:* add both as Glossary entries.

## Shape fit — strong

The PRD correctly runs two shapes under one roof: Epic 1 is a single-operator capability spec (testable consequences, one lightweight builder journey UJ-5, operational SMs) and Epic 2 is a consumer product (UJs load-bearing, named protagonists, UX-facing NFRs). That is the right formalization for each half — no UJ theater on the pipeline, no missing UJs on the app. Solo/portfolio calibration is visible and appropriate: SM-6 is "intentionally informal", enterprise sections are absent by design, and rigor is spent where downstream needs it (contract, validation, IDs). Chain-top obligations are met per the dimension above.

No findings.

## Mechanical notes

- **Assumptions Index roundtrip: clean.** All 10 inline `[ASSUMPTION]` tags appear in §11 and vice versa. One label nit: the "Tournament Hub is the home page" entry is indexed as "§4.5/Epic 2 preamble" but the inline tag lives in the Epic 2 information-architecture preamble (before §4.6), not §4.5 — harmless, worth correcting.
- **Terminology nit:** FR-12 says unlinked Markers "fail Self-Validation *thresholds*" while FR-14 defines Self-Validation as a binary count match — the plural "thresholds" implies a mechanism the PRD doesn't define (see the high finding under Done-ness).
- **ID continuity:** no gaps or duplicates in FR/UJ/SM/OQ sequences.
- **Glossary drift:** none observed on defined terms (case and pluralization consistent, e.g. "Tournament Indices"). Undefined-but-recurring terms noted above ("story stats", "momentum timeline").
- **Addendum linkage:** addendum §1 is correctly marked binding and the PRD points to it at the right moments (§4.3, §4.5); the risk-register table's PRD landing references all resolve. Heatmap drift noted under Scope honesty.
- **Required sections for stakes/type:** all present; intentionally absent enterprise sections are consistent with the agreed stakes.

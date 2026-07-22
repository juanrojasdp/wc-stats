# Reconciliation: `project-brief-wc2026-analytics.md` vs PRD + Addendum

Date: 2026-07-21
Inputs compared:
- Source: `C:\Users\ADMINSTRADOR\Documents\wc-stats\project-brief-wc2026-analytics.md`
- PRD: `_bmad-output\planning-artifacts\prds\prd-wc-stats-2026-07-21\prd.md`
- Addendum: `_bmad-output\planning-artifacts\prds\prd-wc-stats-2026-07-21\addendum.md`

Overall verdict: coverage is strong. The two-epic split, spike findings, risk register, i18n two-axis rule, non-goals, and success metrics all carried over faithfully. The issues below are the residue: field-inventory gaps, one fabricated claim, two semantic hardenings/softenings that change meaning, and a handful of unflagged additions.

---

## 1. Factual gaps (in brief, absent from PRD + addendum)

### G-1. Appendix A field inventory is a live external dependency, not captured (HIGH)
PRD §4.2 declares "The full field inventory per domain is Appendix A of the brief and is normative for coverage" — but neither the PRD nor the addendum reproduces Appendix A. The addendum's stated purpose is to hold "technical depth extracted from the brief," and it reproduces Appendix B (spike findings) in full while omitting Appendix A entirely. If downstream artifacts are built from PRD + addendum alone, the following field lists exist nowhere:

- **Domain G in-possession itemization:** passes, pass %, **switches**, line breaks, ball progressions, **take-ons**, **step-ins**, attempts, goals. FR-8 names only the three category headings.
- **Domain G out-of-possession itemization:** tackles, blocks, interceptions, pressing, **duels**, clearances, recoveries. Same — FR-8 does not enumerate.
- **Domain D cross detail:** brief specifies crosses by "locations/**zones**/**types**". FR-10/FR-24 mention cross maps but never zones or types.
- **Domain D "defensive actions"** appears only in the PRD glossary's Spatial Event definition; no FR extracts it (FR-10 lists shots, crosses, defensive pressure, offers/movement — "defensive actions" as a distinct map/domain item from the brief's Domain D list is not clearly owned by any FR).

Consequence: FR-23's testable consequence ("Every Domain G field extracted by FR-8 is reachable") is untestable without the brief in hand. Either copy Appendix A into the addendum or formally register the brief as a normative annex of the PRD.

### G-2. Domain A "goal/sub/card minutes" survive, but Domain B is the only fully-enumerated stats block re-verified
Spot-check result: FR-3 (Domain A), FR-4 (Domain B), FR-5 (C), FR-6 (E), FR-7 (F) enumerate their fields faithfully and completely against Appendix A. No loss found in A/B/C/E/F. The gap is confined to D and G per G-1.

### G-3. Heatmaps mentioned in brief, never surfaced as an App feature
Brief (Technical Considerations): d3 is chosen for "shot maps, pass networks, **heatmaps**". The addendum copies the d3 line, but no FR in Epic 2 renders a heatmap. If heatmaps were intended as a visualization type (e.g., for defensive actions or offers-to-receive density), that intent is silently dropped from the feature set; if not intended, the tech rationale carries a dangling reference.

### G-4. "Passion project" framing partially dropped
Brief frames the whole endeavor as a passion project twice (Constraints: "Passion project: free to users, $0..."; Post-MVP: "tip jar... for a passion-project support model"). The PRD keeps the $0 constraint and the addendum keeps "tip jar / GitHub Sponsors" but drops the passion-project positioning. Minor, but it is decision-relevant context: it explains why $0 is a hard constraint, why monetization is deferred rather than planned, and why SM-6 (portfolio) is a first-class outcome.

---

## 2. Qualitative / intent content — assessment

Mostly well preserved, better than typical FR-structuring:

- Progressive-disclosure intent and the "no audience gets a separate app" positioning survive ("Nobody gets a dumbed-down app and nobody gets an impenetrable one" — Vision).
- Casual fan's "low tolerance for density" / analyst "wants and tolerates density" is structurally preserved via SM-C2 (Depth preservation counter-metric) — a genuinely good translation.
- "The value is all there — it's just trapped in an unusable container" problem framing survives in Vision §1.
- Career-leverage intent survives twice (builder JTBD §2.1, addendum §4, SM-6).
- The two-language-axes warning ("do not conflate") survives in §0, §4.11, §5 Language discipline.
- "Framed as a story" for casual stats survives as "story stats" vocabulary.

Residual qualitative losses:
- **Q-1.** The brief's "free, **open**" carries an open-ethos framing (open data liberation). The PRD's Vision keeps the words, and SM-6 implies a public repo, but nothing states the app/dataset is open-source or what "open" commits to. Left ambiguous.
- **Q-2.** Brief's mobile framing for the casual fan is "Mobile-first, low tolerance for density" as a persona attribute; PRD NFRs scope mobile-first to "Hero Layer and Hub" only and explicitly allow Tactical/Expert to be desktop-optimized. Reasonable, but it is an interpretation the brief did not make — unflagged.

---

## 3. Contradictions / distortions (PRD says something the brief does not support)

### C-1. Fabricated competitive-landscape claim (HIGH — unsourced addition presented as fact)
PRD Vision §1: "Adjacent projects surface fragments of this data (scraped per-player feeds, physical-data leaderboards, parsing toolkits), but no product — FIFA's own included — offers the full PMSR tactical taxonomy... tournament-wide and interactively; mainstream stats platforms stop at conventional event stats."
The brief contains no competitive analysis whatsoever (its claim is only "There is currently no tournament-wide view" of *this PDF dataset*). The PRD's specific claims about adjacent projects and FIFA's own products are invented and carry no `[ASSUMPTION]` tag, despite §0 promising all unconfirmed inferences are tagged. Either source it, tag it, or cut it.

### C-2. MVP out-of-scope hardened into permanent non-goals (MEDIUM)
Brief: the exclusion list is titled "Out of scope (explicit)" **under MVP Scope**; only monetization is explicitly "deferred to Post-MVP". PRD §7 escalates: backend/database/auth are excluded "**Ever**, in this product's v1 shape — not 'later'", and §8.2 states "Everything in §7 Non-Goals, **permanently**" — which sweeps user accounts, saved views, social features, and native mobile into permanent bans the brief never made. For backend-free-ness this matches the brief's architecture premise; for saved views / social / native app it is a scope decision the PRD made on its own, untagged.

### C-3. "Self-Validation thresholds" weakens the brief's exact-count check (MEDIUM)
Brief: Self-Validation is an exact cross-check — "extracted marker count vs. the tabular attempts table". FR-14 keeps this exact. But FR-12's consequence ("fail Self-Validation **thresholds**") and SM-C1 ("never loosen Self-Validation **thresholds**") introduce threshold language, implying tolerance bands exist. The brief has no thresholds — a mismatch is a failure. The wording invites a future implementer to add tolerance where the brief demands exactness. (SM-C1's *intent* — never loosen to hit 100% — is faithful; only the vocabulary is off.)

### C-4. "Byte-identical artifacts" / determinism is stronger than the brief's "idempotent" (LOW)
Brief promises idempotence "for dev convenience". FR-1's consequence requires **byte-identical** artifacts on re-run and §5 requires deterministic artifacts. That is a materially stronger engineering requirement (forbids timestamps, map-ordering nondeterminism, etc.). Half-tagged: the idempotence *mechanism* is tagged as architecture's call, but the byte-identical bar itself is not.

### C-5. Unflagged additions that should have been `[ASSUMPTION]`-tagged (LOW, list)
- FR-31: language choice "persists client-side **across visits**" — persistence is invented (harmless, but §0 promised tagging).
- FR-21: "scorers **with minutes**" in the Hero Layer — brief's hero list is score/scorers/stats; minutes come from lineups. Fine, but an inference.
- §4.6: section order presented as fixed contract ("Section order follows the brief") — the brief's arrow-list reads as content inventory at least as much as mandated order.
- FR-15: "at least one report per venue **and per matchday round**" — brief says "one report per venue / matchday", ambiguous between and/or; PRD silently resolved to the stricter reading (good choice, unflagged).

---

## 4. Items verified as faithfully carried (no action)

- Spike findings (Appendix B): reproduced in addendum §1 completely — 16-marker ground truth, 2/2/8/3/1 distribution, 11.25pt Bézier circles, exact-RGB map, dark-blue collision, full-rect normalization, filter chain, ~52-vs-8 page reality, overlapping-marker note. Verified line-by-line.
- All five brief risks land in addendum §5 with correct mitigations and FR traceability.
- Text-anchored discovery, assert-on-unknown-RGB, marker–event linking as hardest sub-task and its early scheduling (§8.1 ordering note) — all preserved and correctly prioritized.
- Data-model spine, scale estimate, SQLite-as-contingency (correctly kept out of MVP), tech stack, Netlify $0 — preserved.
- i18n from day one, es default / en toggle, tactical-terminology open question (OQ-1/FR-32), source-data-stays-English — preserved.
- Out-of-scope list (live ingestion, backend, accounts, native app, xG recomputation, monetization) — all present in §7.
- FIFA ToU gating of monetization, "not legal advice" caveat — preserved (§6.2, OQ-2).
- Momentum timeline: in scope per brief, and PRD responsibly flags its unknown extraction source as OQ-5 (the brief never said which page feeds it — the PRD caught a real gap in the brief here).

---

## 5. Recommended fixes, prioritized

1. Copy Appendix A's full per-domain field inventory into `addendum.md` (or declare the brief a normative annex) and enumerate Domain G and Domain D fields in FR-8/FR-10. (G-1)
2. Tag or delete the competitive-landscape paragraph in Vision §1. (C-1)
3. Decide explicitly: are saved views / social / native app banned permanently or just out of MVP? Align §7/§8.2 wording with the decision. (C-2)
4. Replace "Self-Validation thresholds" with "Self-Validation checks" in FR-12 and SM-C1, or explicitly define what thresholds exist. (C-3)
5. Tag the byte-identical/determinism bar as an assumption or confirm it deliberately. (C-4)
6. Add heatmaps to an FR or strike the reference; restore "passion project" framing in §6.1 context. (G-3, G-4)

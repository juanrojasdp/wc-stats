# Adversary Review — ARCHITECTURE-SPINE.md (wc-stats)

Lens: construct two units one level down (Epic 1 Pipeline, Epic 2 App) that each obey every AD to the letter yet build incompatibly. Every surviving pair below is a hole; each closes with the smallest new or tightened AD.

Reviewed: `ARCHITECTURE-SPINE.md` (2026-07-21) against `prd.md`, `addendum.md`, `EXPERIENCE.md`.

**Verdict:** The spine's ownership boundaries (AD-1/2/5/7) block most classic drift attacks, but the contract handshake has no bootstrap sequencing, at least one contracted visualization has data with no owner, and the budget gate is measured in an undefined unit — three attacks land cleanly and six more find double-owned or orphaned entities.

---

## CRITICAL

### C1 — Contract bootstrap deadlock: no first-schema milestone, no fixture story

**Build A (Epic 1, compliant):** authors `/contract` schemas incrementally as extractors land — Domain A schema in week 1, Domain D in week 4, momentum shape "after the first Domain B/C extraction look" (Deferred). `schemaVersion` churns with each addition. `/data` is empty until precompute exists.

**Build B (Epic 2, compliant):** AD-2 bans hand-written type mirrors, so the App may only consume *generated* types from `/contract`, and AD-11 requires build-time filesystem reads of real artifacts for static params, meta, and the pre-rendered Hero. With no schemas and no `/data`, the only compliant Epic 2 behavior is to **block entirely** — or to invent "provisional" local types, which violates AD-2's letter the moment they exist.

**Divergence:** the two epics are advertised as independently buildable ("possibly by different agents"), but Epic 2 has no compliant starting state. Worse, if Epic 2 self-authors sample JSON to unblock, that sample becomes a de-facto second schema owner — exactly what AD-2 exists to prevent.

**Close with (new AD-14 — contract bootstrap):** Epic 1's *first deliverable* (before any extractor beyond the spike) is the complete v1 schema set in `/contract` **plus committed fixture artifacts** — at least one full Match Bundle and one instance of every index artifact — schema-validated, hand-checked, and stamped `schemaVersion: 1`. Fixtures live in `/data` (or `/data/fixtures`, pinned) and are what Epic 2 builds and tests against until real artifacts replace them. The fixture set MUST cover the known edge shapes: a group match, a knockout match decided by extra time and shootout, a match with an own goal, and a match with `momentum: null`. Epic 2 signs off on v1 against a per-surface data-needs checklist (Hero build-time fields, search-entity fields, comparison fields) before Epic 1 proceeds; subsequent shape changes bump `schemaVersion` and regenerate fixtures in the same commit.

### C2 — Pass-network node positions have no owner

**Build A (Epic 1, compliant):** AD-3's entity list contains `PassNetworkEdge`; FR-13 defines edges as "player endpoints and volumes" — players and integers, **no coordinates**. Pipeline emits exactly that. Fully compliant: every Domain D marker family has its contracted table.

**Build B (Epic 2, compliant):** EXPERIENCE (Pitch panel, Visualization Layering) renders the pass network "at true 0–100 coordinates (FR-24)" — nodes at players' average positions as drawn on the PMSR pass-network page. AD-6 says the App "renders coordinates as-is" and never re-normalizes; AD-5's carve-out can't help because node positions **cannot be derived from edge volumes at all** — the positional data exists only in the PDF, which the App may never touch (AD-1).

**Divergence:** the App has a contracted obligation (FR-24 true-coordinate pass networks) with no contracted data source. Both epics are letter-compliant; the pass-network section is unbuildable.

**Close with (tighten AD-3):** add `PassNetworkNode` (player ID, x, y in the AD-6 frame, per team per match) to the entity-table list, extracted from the PDF's pass-network page alongside the edges. Edge endpoints reference node player IDs.

### C3 — "500 KB compressed" is an undefined unit, and index artifacts are ungated

**Build A (Epic 1, compliant):** AD-4 makes the pipeline the gate owner: "a bundle exceeding 500 KB compressed fails the pipeline run." Pipeline measures Brotli quality 11 (best available; nothing forbids it). A bundle at 640 KB gzip ≈ 495 KB brotli passes. Separately, AD-4's gate covers **bundles only** — the pipeline emits an 900 KB `leaderboards.json` and a fat `tournament.json` with zero gate, fully compliant ("A bundle exceeding…" says nothing about `data/index/`).

**Build B (Epic 2, compliant):** the App is accountable for §5/SM-5 ("per-route JSON payload ≤ 500 KB compressed" — the Hub route loads `tournament.json` + `leaderboards.json` together) and Lighthouse ≥ 90. Netlify's CDN decides actual wire compression per client (gzip for some agents). The App busts its budget with no compliant remedy: it can't drop fields (SM-C2), can't re-shape artifacts (AD-2), can't add a cache layer (AD-10).

**Divergence:** Epic 1 passes its gate; Epic 2 fails its budget; neither has violated anything. Two sub-holes: (a) the compression algorithm/level is unpinned, so the gate isn't even deterministic across pipeline implementations; (b) per-route payload ≠ per-bundle payload for the Hub, and index artifacts have no owner for the budget.

**Close with (tighten AD-4):** the budget unit is **gzip -9 of the canonical serialized bytes** (gzip chosen as the conservative floor — every CDN client gets at least gzip), measured by the pipeline; the App never re-measures. The gate applies **per route-payload set**: each Match Bundle ≤ 500 KB; each profile artifact ≤ 500 KB; `tournament.json` + `leaderboards.json` **combined** ≤ 500 KB (the Hub loads both). Breach of any set fails the pipeline run under the existing split-or-logged-decision rule.

---

## HIGH

### H1 — schemaVersion: global vs per-artifact is two compliant readings

**Build A:** pipeline treats `schemaVersion` as one repo-global integer stamped identically in every artifact; a leaderboards-only shape change bumps every artifact's version. **Build B:** pipeline versions each artifact family independently (every artifact still "carries an integer schemaVersion" — AD-2's letter is satisfied); `leaderboards.json` goes to 3 while bundles stay at 1. The App's "exact match with its generated types' version" now has no defined referent: one generated-types version vs N artifact versions. One reading fails the build spuriously; the other passes a stale-bundle mismatch. Related mechanical gap: `json-schema-to-typescript` emits no version constant, so *where* the App's expected version comes from is itself unpinned — two builders will invent two mechanisms.

**Close with (tighten AD-2):** one global integer `schemaVersion`, declared exactly once in `/contract/version.json`; the pipeline stamps that value into every artifact at emit; any shape change to any schema bumps it. The App's type-generation step reads the same `/contract/version.json` and bakes the constant in; at build time the App asserts every artifact it reads carries that exact value.

### H2 — "An ID, once emitted, never changes" contradicts deterministic re-derivation

**Build A (Epic 1, determinism-first):** IDs are derived functions of (name, team) per AD-3; determinism is keyed on (PDF hash, code version) per AD-8. A name-normalization bugfix changes `ramires-julian-mex` → `ramirez-julian-mex`. The re-run is perfectly deterministic — and the ID changed, breaking every shared URL and committed cross-reference. **Build B (Epic 1, stability-first):** preserves old IDs via a persisted registry from prior runs — cross-run state that is neither PDF content nor code, silently breaking AD-8's idempotence key and byte-identical re-runs from a clean checkout.

**Divergence:** the two AD-3/AD-8 clauses cannot both be satisfied by derivation alone; each build sacrifices a different one.

**Close with (tighten AD-3):** the existing manual override map is promoted to the **slug registry of record**: it is a committed file (hence part of "code version" — determinism preserved), and post-first-publish, any change in a derived slug must be reconciled by adding an override entry pinning the *original* slug. A pipeline check fails the run if a previously-emitted ID (diffed against committed `/data`) would change without an override entry.

### H3 — Route universe: static params enumeration vs emitted-profile set

**Build A (Epic 1):** emits `player-profiles/{id}.json` only for players with recorded minutes (a defensible reading of "aggregated Player Profiles"); `tournament.json` search entities list **all** rostered players (they appear in lineups as unused subs). **Build B (Epic 2):** `generateStaticParams` for `/players/[slug]` enumerates from `tournament.json` entities (the only index that lists everyone). Result: pre-rendered player routes whose build-time filesystem read (AD-11) finds no profile artifact — build crash or 404s for shareable URLs, depending on error handling. The reverse mismatch (profiles emitted for entities not in `tournament.json`) yields unreachable pages and broken search.

**Close with (tighten AD-4):** `tournament.json`'s entity lists are the **route manifest**: the set of match/team/player routes the App pre-renders is exactly and only those entities, and the pipeline MUST emit one profile artifact per listed entity (empty-sections allowed, absence not). Pipeline validation asserts the bijection.

### H4 — Acting-team semantics: own goals, defensive actions, shootouts

AD-6 orients coordinates "per acting team" but never defines the acting team per event family, and the bundle's event→team assignment rule is unstated.

**Build A (Epic 1):** an own goal is a shot by the defending player — filed under the *conceding* team's `ShotEvent` table, oriented toward the opponent's goal (x=100)… which is the goal it went into from the scorer's perspective, i.e., their **own** attack direction is inverted. **Build B (Epic 2):** renders each team's shots on that team's half-pitch (EXPERIENCE ≥lg layout) and lists scorers on the Hero by benefiting team. The own-goal marker lands on the wrong team's map (or off-frame), and the Hero scorer list disagrees with the shot log. Same class of hole: defensive actions (is the acting team the defender? then most x-values sit near 0 — must the App still render them on a *half*-pitch "attacking goal up"?), penalty-shootout attempts (in `ShotEvent` or excluded? they'd wreck the marker-count Self-Validation if counted, and wreck xG totals if not flagged), and events with no linkable acting team.

**Close with (tighten AD-6 + AD-3):** every spatial event carries an explicit `teamId` (the acting team), and the frame is defined **relative to that teamId's attack direction** — the App places events by `teamId` and never infers side. Per-family acting-team definitions are pinned in the schema: shot = shooting player's team, own goals flagged `ownGoal: true` and excluded from shot-map rendering but present in the log and scorer list (scorer list attributes to the *benefiting* team); defensive action = defending team; shootout attempts live in a separate `ShootoutAttempt` table, never in `ShotEvent`.

### H5 — Story Stats: precomputed or carve-out-derived? Two compliant owners

Hero needs match-level distance and top speed — per EXPERIENCE, "from G-physical aggregates": a **within-match** max/sum over player rows. **Build A (Epic 1):** doesn't emit match-level top speed; deriving max-over-players from one bundle is squarely AD-5's within-match carve-out — App's job. **Build B (Epic 2):** AD-5's headline says every aggregate is "precomputed by the Pipeline and read verbatim" and the App "never sums, averages, or derives"; builder expects a `storyStats` block and renders an empty Hero tile. Both readings are compliant; additionally the carve-out is "within-surface" and top speed appears on Hero *and* Expert tables *and* leaderboards — so whether it even qualifies is itself ambiguous.

**Close with (tighten AD-4/AD-5):** the Match Bundle contains a contracted `storyStats` block (possession, shots, xG, distance, topSpeed per team) emitted by precompute; the AD-5 carve-out is explicitly limited to values that appear on **exactly one** surface and are never Hero-critical.

### H6 — Standings order: pipeline rank vs App sort

**Build A (Epic 1):** emits group standings as an object keyed by team with points/GD/GF — computation done, per AD-5. **Build B (Epic 2):** receives rows, needs display order, and "sorting" is explicitly an allowed App operation (AD-5: "the App may filter, sort, and select") — sorts by points, then goal difference… missing FIFA's actual tiebreaker cascade (head-to-head, fair play, drawing of lots), which cannot be recomputed client-side without cross-match derivation. Both compliant; the displayed table disagrees with FIFA's official final order in any group decided by a deep tiebreaker.

**Close with (tighten AD-4):** standings arrays are **ordered, with an explicit `rank` field**, computed by the pipeline including full FIFA tiebreakers; the App renders artifact order verbatim. AD-5 gains one sentence: App sorting is *user-initiated re-ordering only* — canonical/default order always comes from the artifact.

---

## MEDIUM

### M1 — Momentum "nullable": null vs absent vs empty array

**Build A (Epic 1):** momentum unavailable → key **omitted** (schema marks it non-required; that's one legal reading of "reserves a nullable key"). **Build B (Epic 2):** checks `momentum === null` for the empty state, treats `undefined` as a fetch/shape error and renders the retry panel instead of the OQ-5 empty state. A third builder emits `[]`, which passes an array-typed schema and renders a broken zero-width chart.

**Close with (tighten Deferred/AD-2 note):** the key is **required**; value is either the (future) series object or JSON `null`; never omitted, never `[]`. Empty-state trigger is `null`, contractually.

### M2 — Match-vs-match comparison and shared scales vs AD-5's letter

Comparing two matches *is* cross-match by definition, and AD-4's exhaustive artifact list ("emits exactly:") forbids any pairwise comparison artifact — so a strict Epic 2 builder concludes the App may not compute even a shared axis max across the two fetched bundles (a cross-match derivation), while a permissive builder computes shared scales, deltas, and "who leads" accents client-side. One under-builds (mismatched axes — violating EXPERIENCE's "identical scales" rule), one over-builds (client-derived cross-match *numbers* on screen — exactly what AD-5 exists to prevent).

**Close with (tighten AD-5):** comparison renders each side's **precomputed values verbatim**; the App may derive *presentation geometry only* (shared axis domains, leader accent = a comparison of two displayed values) and may never display a derived cross-entity number (no deltas, no ratios) unless it ships in an artifact.

### M3 — Knockout score shape (extra time / shootout) unreserved

Nothing in the spine reserves how a match "score" represents AET and shootout results, yet the Hero pre-renders "score, scorers, stage" at build time (AD-11) and match search/meta compose titles from it. A schema authored off group-stage fixtures alone forces a breaking `schemaVersion` bump mid-Epic-2 when the first R32 shootout match is extracted. Largely absorbed by C1's fixture-coverage rule; recorded separately so the schema reserves `scoreAfter90`, `scoreAfterET`, `shootoutScore`, `winnerTeamId`, `decidedBy: regulation | extra-time | shootout` from v1.

### M4 — Heatmap zone-grid fork is a cross-epic decision with no owner

Deferred: heatmap is client-derived "unless the bundle's events prove insufficient… then the pipeline emits a zone grid instead — decided when the heatmap viz is built." The decision point sits inside Epic 2's build, but its implementation is an Epic 1 schema change — with both epics possibly running as different agents, neither owns the trigger, and the fallback implies a mid-flight `schemaVersion` bump nobody scheduled. **Close with:** name the owner (Epic 2 raises a contract-change request; Epic 1 implements; the request/response is a logged decision) and pin the evaluation moment (during Epic 2's first heatmap story, against real or fixture Domain D data).

### M5 — Leaderboard metric identity: open codes vs typed locale keys

**Build A (Epic 1):** schema types metric codes as free `string`; adds `secondBalls` to `leaderboards.json` in a re-run — no shape change, no `schemaVersion` bump, compliant. **Build B (Epic 2):** locale dictionaries are typed against a hardcoded metric union; the unknown code either falls through to a raw key (banned by FR-32/AD-12) or is silently dropped from the board (banned by SM-C2 in spirit). Units ("km/h", "km") have the same dual-owner ambiguity — a pipeline emitting unit strings arguably violates AD-7; an App guessing units per metric hardcodes data knowledge. **Close with (tighten AD-2/AD-7):** metric codes are a **closed schema enum**; adding a metric is a shape change (bumps `schemaVersion`), and the generated enum type drives a mapped locale type so a missing label/unit entry is a compile error. Units are locale-layer metadata keyed by metric code; artifacts carry raw numbers only.

---

## LOW

### L1 — Search-entity field sufficiency decided by the wrong epic

`tournament.json`'s entity fields are authored by Epic 1, but their sufficiency (accent-insensitive matching needs the display name; player results need team context; match entries need both team names + stage to compose a label without display strings) is only knowable by Epic 2. Mostly absorbed by C1's data-needs checklist; recorded so the checklist explicitly includes the search/typeahead and `<title>`/OG composition fields.

### L2 — Player-slug composition pinned only by example

`ramirez-julian-mex` implies surname-first + team code, but AD-3's rule text only says "lowercase ASCII kebab." A pipeline emitting `julian-ramirez-mex` is letter-compliant. Cross-epic impact is nil (the App reads IDs, never constructs them), but share-URL aesthetics and H2's registry diffing benefit from pinning the composition rule (`{surname}-{givenName}-{teamCode}`, name-order source = lineup listing) in AD-3's text, not just its example.

### L3 — Coordinate transform vocabulary

AD-6 allows "viewport/orientation mapping only" and bans "re-normalization" without defining either. The mobile vertical half-pitch requires a rotation + half-pitch crop of the 0–100 frame; a maximally cautious Epic 2 builder could read rotation as forbidden. One clarifying clause ("affine viewport transforms — rotate/scale/translate/crop — are orientation mapping; anything that rewrites stored coordinate values is re-normalization") closes it.

---

## Discarded attacks (spine already blocks)

- **Hand-written type drift** — AD-2's generated-types-only rule blocks it outright.
- **Two teams on one shared pitch** (y-axis mirroring ambiguity) — EXPERIENCE renders every spatial viz per-team (tabs on mobile, side-by-side pitches on desktop); no shared-frame surface exists, and H4's `teamId` rule covers the residue.
- **Spike fixture coordinates as ground truth in the wrong frame** — explicitly blocked by the Consistency Conventions testing row.
- **App-side re-aggregation drift** — AD-5's single-computation-site rule blocks it except at the seams already filed (H5, M2).
- **Marker dedup / silent drops, tolerance creep** — AD-8 + SM-C1 block every variant tried.
- **Locale/theme/state divergence** — AD-10/AD-12 are internal to Epic 2; no cross-epic pair constructible.
- **Kickoff timezone rendering** — AD-7's "venue-local time with UTC offset" ISO string lets the App render wall-clock time without IANA zone data; no incompatibility constructible.

## Summary

| Tier | Count | Findings |
|---|---|---|
| Critical | 3 | C1 bootstrap/fixtures, C2 pass-network nodes, C3 compression unit + index gate |
| High | 6 | H1 version scope, H2 ID stability vs determinism, H3 route universe, H4 acting-team semantics, H5 story-stats owner, H6 standings order |
| Medium | 5 | M1 momentum null, M2 compare carve-out, M3 shootout score, M4 heatmap fork owner, M5 metric enum |
| Low | 3 | L1 search fields, L2 slug composition, L3 transform vocabulary |

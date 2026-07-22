# Rubric Review — ARCHITECTURE-SPINE.md (wc-stats)

- **Reviewer:** rubric walker (architecture-spine gate)
- **Date:** 2026-07-21
- **Target:** `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md`
- **Inputs consulted:** PRD (`prd.md` + `addendum.md`), `EXPERIENCE.md`, `project-brief-wc2026-analytics.md`

## Verdict

**PASS WITH FINDINGS.** The spine is strong: the AD set hits the real Pipeline↔App divergence points (contract ownership, identity, coordinate frame, aggregation site, locale-neutral data, state, rendering split, deployment), the Capability→Architecture Map covers FR-1..35 with no holes, rules are mostly enforceable, and it is genuinely terse. No critical findings. Three high findings concern the delivery path of the one interface (`/data` serving), unanchored "fails the build" quality gates, and a payload-budget gate that covers only one artifact class.

---

## Checklist walk (summary judgments)

1. **Real divergence points fixed?** Yes for the big ones. Two missed: how `/data` physically reaches the Netlify publish (H-1) and profile-level heatmap aggregation site (M-2).
2. **Rules enforceable?** Mostly. AD-12's lint gate and AD-2's build-fail depend on a build/CI decision the spine never makes (H-2). AD-3's "first-seen" tie-break is under-specified against AD-8's determinism (M-1).
3. **Deferred safe?** Mostly. The heatmap deferral hides a cross-epic decision (M-2); the rest (momentum shape, SQLite, precision table, search fields, test harness) are single-owner and safe.
4. **Stack verified-current?** Plausible as pinned for 2026-07-21 (Node 24 LTS, React 19.2, d3 7.9, pdfplumber 0.11 are right; Next 16.2 / Tailwind 4.3 / recharts 3.10 / pymupdf 1.28 are plausible cadence). Two nits: `pytest latest stable` breaks the pin discipline (L-1); TS 5.9 pin alongside a noted TS 7.0 GA skips the 6.x bridge question (L-2).
5. **FR coverage?** Complete. FR-1..35 all mapped; UX additions (/glossary, /about, header search, 404) are present in the seed and AD-13.
6. **Dimensions decided/deferred/questioned?** Deployment & environments: decided (good). Build/CI and test-execution location: **silent** (H-2). Security posture: silent (L-4). Dependency management/lockfiles: silent (L-5). Error handling, versioning, testing conventions, ops: covered.
7. **Diagrams valid?** Yes — flowchart (`x--x` bidirectional-cross edge is valid mermaid) and erDiagram both parse and convey real structure. One cosmetic shape-syntax nit (L-3).
8. **Terse?** Yes. No empty sections, no restated PRD/UX content; the inline context in AD-8/AD-9 is operative, not rationale padding.

---

## Findings

### Critical

None.

### High

**H-1. The `/data` serving path — the delivery of the only interface — is undecided.**
- **Location:** AD-11 (runtime "client fetches the same artifacts over HTTP", "same-origin"), AD-13 ("Netlify runs only the App build … publishes the static export"), Structural Seed (`data/` at repo root, outside `app/`).
- **Problem:** Next.js `output: 'export'` publishes `app/out/`. Repo-root `/data` is not inside that publish directory, so the runtime same-origin `fetch('/data/...')` AD-11 mandates has no defined mechanism to exist in production. This is exactly the kind of gap where the two epics diverge: the Pipeline epic believes emitting to `/data` is done; the App epic believes `/data` is served. Neither owns the copy/publish step.
- **Fix:** Add one sentence to AD-13 (or AD-11) deciding the mechanism — e.g. "the App build copies `/data` into the export output (build script step); Netlify publish dir is `app/out`" or "Netlify publish dir is a composed root containing the export + `/data`." Name the owning epic (App).

**H-2. "Fails the build" gates have no decided place to run — build/CI is a silent dimension.**
- **Location:** AD-2 (schemaVersion mismatch "fails the build"), AD-12 (ESLint "fails the build"), AD-13 (binds "CI" but rules only on Netlify), Consistency Conventions (pytest), Deferred (App test harness).
- **Problem:** The spine's only build authority is Netlify running `next build`. But in Next.js 15+/16 `next build` no longer runs ESLint, so AD-12's mechanical FR-30 gate never fires unless a lint step is explicitly wired into the build command or a CI workflow — and the spine decides neither. Likewise pytest (the AD-8 correctness paradigm's regression net) and the AD-2 version check have no stated execution point; on a "single main branch" with no CI decision, every gate runs only by dev-machine discipline, which is precisely the divergence these ADs claim to prevent.
- **Fix:** Decide the gate surface in AD-13: either (a) Netlify build command is `lint && typecheck && verify-schema-version && next build`, pytest remains dev-machine (acceptable for a solo project — but say so), or (b) a GitHub Actions workflow runs pipeline tests + app lint/build on push. One sentence each; or move it to Deferred *with the constraint that the AD-2/AD-12 gates must be in whatever build path Netlify executes*.

**H-3. The 500 KB per-route budget is gated only on Match Bundles; index artifacts are unbudgeted.**
- **Location:** AD-4 ("A bundle exceeding 500 KB compressed fails the pipeline run — this is the per-route *JSON payload* budget"), vs PRD §5 ("per-route JSON payload ≤ 500 KB") and FR-34.
- **Problem:** The Hub route loads `tournament.json` (+ `leaderboards.json` on the leaderboard surface); profile routes load `team-profiles/*.json` / `player-profiles/*.json`; `/compare` loads two artifacts. None of these are covered by the pipeline's failure gate, so the Hub — one of the two Lighthouse-budgeted routes — can breach §5 with no loud failure anywhere. `tournament.json` carrying results + standings + nav + search entities for 104 matches is the likeliest breacher.
- **Fix:** Extend AD-4's rule to gate every emitted artifact in `/data/index/` at 500 KB compressed, and state the per-route accounting for routes that load more than one artifact (e.g. Hub = tournament.json + leaderboards.json must jointly fit, or leaderboards is deferred-loaded).

### Medium

**M-1. "First-seen" identity tie-break conflicts with byte-identical determinism unless traversal order is canonical.**
- **Location:** AD-3 ("collisions break by **first-seen** shirt number") vs AD-8 ("re-runs byte-identical", FR-1 consequence).
- **Problem:** "First-seen" depends on the order Extraction Records are consumed. Filesystem/glob iteration order is not guaranteed stable across machines or runs, so the same collision can resolve differently — changing an emitted ID, which AD-3 forbids ("an ID, once emitted, never changes").
- **Fix:** One clause in AD-3 or AD-9: precompute consumes Extraction Records in canonical order (ascending match ID / chronological kickoff), making "first-seen" well-defined and deterministic.

**M-2. Profile/comparison heatmaps fall outside AD-5's within-match carve-out; the Deferred item only covers the match case.**
- **Location:** AD-5 (carve-out is "within-match, within-surface"), Deferred "Heatmap zone-grid shape"; EXPERIENCE.md Component Patterns lists the pitch panel (incl. heatmap) for "Match Dashboard, **profiles**, comparison" and Responsive lists "Heatmap … per team/player".
- **Problem:** A tournament-wide team/player heatmap is a cross-match aggregate. Under AD-5 it must be precomputed by the Pipeline (into profile artifacts) — but the Deferred item only decides the within-match path, and computing it client-side would require fetching many bundles, violating FR-34. Two units could resolve this differently.
- **Fix:** Either scope heatmaps to Match Dashboard only (and note profiles get no heatmap in MVP), or add to AD-4/AD-5: "cross-match heatmap grids, if surfaced, are precomputed zone grids in profile artifacts" — and update the Deferred item to name both cases.

**M-3. AD-2's exact-version check needs a version carrier on the App side.**
- **Location:** AD-2 ("the App build reads `schemaVersion` and fails the build on anything but an exact match with its generated types' version").
- **Problem:** `json-schema-to-typescript` output carries no version. For the check to be mechanical, the contract must expose the version as data the codegen step embeds (e.g. a generated `SCHEMA_VERSION` constant emitted alongside the types). As written, the rule is enforceable only if someone remembers to build this — the classic hand-maintained mirror AD-2 exists to prevent.
- **Fix:** Add half a sentence: "the codegen step also emits the contract's `schemaVersion` as a constant; the build check compares that constant against every loaded artifact."

### Low

**L-1. `pytest: latest stable` breaks the table's own pin discipline.**
- **Location:** Stack table.
- **Fix:** Pin a major (e.g. `8.x` or current), same as every other row, or mark it explicitly as deliberately floating.

**L-2. TypeScript pin: the 5.9.x choice acknowledges TS 7.0 GA (2026-07-08) but is silent on the 6.x bridge.**
- **Location:** Stack table, TS row.
- **Problem:** Microsoft's stated path is 5.9 → 6.x (bridge, aligned semantics) → 7.0 (native). If 7.0 GA'd, a 6.x stable almost certainly exists and would be the natural conservative pin; pinning 5.9 while citing 7.0 is a half-verified claim.
- **Fix:** Verify whether 6.x is stable and either pin it or note why 5.9 is retained (ecosystem/toolchain lag is a fine reason — say it).

**L-3. Mermaid nit: the parallelogram shape syntax eats the leading slash of `/contract`.**
- **Location:** Design Paradigm diagram, `CONTRACT[/contract - JSON Schemas, schemaVersion/]`.
- **Problem:** `[/text/]` is shape syntax; the node renders as "contract - JSON Schemas, schemaVersion" without the leading `/`. Valid mermaid, slightly wrong label.
- **Fix:** `CONTRACT["/contract — JSON Schemas, schemaVersion"]`.

**L-4. Security posture is a silent dimension.**
- **Location:** absent (nearest neighbors: AD-13, Deferred "Netlify caching/headers").
- **Problem:** The honest decision is probably one line — "static site, no user input, no secrets, no cookies; supply-chain risk bounded by pinned deps; Netlify default headers suffice" — but the spine should own that decision rather than leave the dimension unaddressed.
- **Fix:** One sentence in AD-13 or a Consistency Conventions row.

**L-5. Dependency management/lockfiles undecided for both toolchains.**
- **Location:** Stack table / Structural Seed.
- **Problem:** Byte-identical, reproducible builds (AD-8, PRD §5 reproducibility) hinge on locked dependency trees; the spine pins majors/minors but names no lock mechanism for Python (requirements.txt/pip-tools — note: project memory says no `uv`) or Node (package manager + committed lockfile).
- **Fix:** One Consistency Conventions row: "Python deps pinned in `pipeline/requirements.txt` (pip); Node via npm with committed `package-lock.json`."

**L-6. `shadcn/ui CLI v4` is an ambiguous pin.**
- **Location:** Stack table.
- **Problem:** shadcn/ui is a vendored registry, not a versioned dependency; "CLI v4" conflates the CLI's version with the Tailwind-v4-compatible registry generation. Harmless but the one row a builder can't act on unambiguously.
- **Fix:** State it as "shadcn CLI (latest) with the Tailwind v4 registry; components vendored into `src/components`".

---

## Explicitly checked, no finding

- **FR map completeness:** FR-1..35 all appear; cross-checked against PRD §4 — no orphan FRs, no phantom FRs.
- **Stage enum** includes `r32` and `third-place` — matches the 2026 format and EXPERIENCE's stage-name table.
- **Shot-outcome enum** matches the addendum's five RGB-keyed outcomes and EXPERIENCE's ruled vocabulary.
- **Event-table set** (AD-3/erDiagram) extends the brief's spine with `CrossEvent`, `ReceivingEvent`, `DefensiveActionEvent` — every Domain D marker family has a destination, as claimed.
- **Deferred items** (momentum, SQLite trigger, precision table, search fields, attribution/glossary content, post-MVP): each has a single owner and a defined trigger; none besides M-2 can cause two-unit divergence.
- **Terseness/empty sections:** none found; the spike-fixture coordinate-frame warning in Consistency Conventions is a genuinely load-bearing trap disclosure, not padding.
- **AD-6 frame definition** is complete (origin, axis directions, per-acting-team orientation, normalization owner, render-side prohibition).
- **No-analytics/$0 posture** (PRD §6) is structural in AD-13, as required.

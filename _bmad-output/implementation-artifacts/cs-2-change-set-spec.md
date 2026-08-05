# Change-set CS-2 — Domain C's metres and Domain E's goalkeeping

**Requested by:** Story 1.16 (Match Bundle emission), Epic 1
**Ruled by:** Juan, 2026-08-04 (D1 and D2), scope expansion 2026-08-05
**Landed:** 2026-08-05, one atomic AD-14 commit
**`schemaVersion`:** 3 → 4
**Logged decision:** `contract/README.md` decision 18

---

## Why this exists

CS-2 is not a widening. **Two shapes in v3 modelled data the corpus does not contain, and
both were non-nullable — so Story 1.16 could not emit one valid Match Bundle.** The contract
was blocking its own producer, and no amount of pipeline work could route around it.

This is the same shape as CS-1's block and resolves the same way: one atomic commit, its own
spec, landing **before** emission.

## Scope, fixed by rulings D1 and D2 and by nothing else

1. **`PossessionSplitMetres` → `ShapeByPhase`** (D1). Three in-possession and three
   out-of-possession panel keys, three measures each, including the `teamWidth` v3 did not
   model at all.
2. **`GoalkeepingBlock` becomes per-team** with the keeper list as context (D2b).
3. **`feetTechniques`, `handsTechniques`, `throwTechniques`, `byBodyType`,
   `crossesFacedCompleted` become nullable** (D2a).
4. **`GoalkeeperInvolvementSample.minute` becomes `at: MinuteStamp`** (D2c).
5. **Riding along, not itself a change request:** three `description` corrections —
   `FreeKickCounts`' corpus-false nesting claim, the unstated corner-**style** non-partition,
   and `GoalPrevention`'s denominator claim re-grounded from the fixtures onto the corpus.

### Two additions to the filed scope, both made deliberately

- **`team-profile.schema.json`'s `AggregateLineHeight` / `AggregateTeamLength` are reshaped
  in step.** They aggregate the identical non-existent shape. Story 1.18 owns team profiles
  and has emitted nothing yet, so correcting it now costs one edit inside a bump that was
  happening anyway; leaving it would hand 1.18 the exact blocker that stopped 1.16 dead.
- **`app/` is repaired in this same commit.** Not optional: removing `lineHeight` /
  `teamLength` breaks `phases-model.ts` and `PressingSection.tsx`, and the per-team
  goalkeeping block breaks `goalkeeping-model.ts`. Landing the schema alone would leave
  `main` with a red build until a later story repaired it. Juan authorized the scope
  expansion on 2026-08-05 after the blast radius was measured (6 files).

## The measurements the rulings rest on

Every figure re-derived at implementation time over the 104 staged spine files.

| Claim | Measured |
|---|---|
| Metre values the corpus prints | **3,744** (104 × 2 sides × 2 pages × 3 panels × 3 measures) against the contract's **832** |
| `team_width` destinations in v3 `/contract` | **0** — 1,248 values with nowhere to go |
| Fractional metre values | **0 of 3,744**; all in (0, 105] |
| m001 home in-possession `line_height` | **19 / 39 / 54**; the v3 fixture's single **44.4** matched no panel and no mean (37.3) |
| The five goalkeeping sub-fields | `null` on **208/208** team-innings, each |
| Two-keeper team-innings | **7 of 208**, each still printing ONE team-level block |
| Involvement slots / in stoppage | **21,764** total, **2,506** in stoppage — minutes are NOT unique |
| `direct == directOnTarget + directOffTarget` | **0/208** (160 innings carry `on + off == 0` while `direct > 0`) |
| `sum(cornersByDeliveryStyle) == totalCorners` | **96/208**, 112 under, **0 over** |
| `sum(byInterventionType) == attemptsFaced` | **208/208**, delta histogram exactly `{0: 208}` |

## The recipe, followed as decision 17 corrected it

Decision 17 records that CS-1's filed recipe was wrong by omission on two points. CS-2
followed the corrected one:

- [x] Schema edits (`match-bundle.schema.json`, `team-profile.schema.json`)
- [x] Logged **decision 18** in `contract/README.md`
- [x] `schemaVersion` 3 → 4 in **SIX** declarations — `version.json` plus the five
      per-artifact `const` stamps
- [x] The **two** hardcoded asserts in `pipeline/tests/test_contract_schemas.py`
- [x] All **seven** fixtures re-pinned and reshaped
- [x] **BOTH** generated type trees regenerated — `npm run generate:types` in `contract/`
      **and** in `app/` (they write to different directories and neither regenerates the
      other)
- [x] The prose stating the version in `data/fixtures/README.md`
- [x] `app/` repaired so the build stays green
- [x] All in ONE commit

**Proof required:** the full `pipeline/tests` suite, plus `npm run check:types` run by hand
in `app/` — that tree has no freshness gate (`contract/README.md`, the gate-gap note under
the change flow).

## Coordination

A bump re-pins fixtures and regenerates App types, so CS-2 **must not land while an Epic 2
session is in flight**. Story 2.11c's work was committed first (`f2ea99d`) on Juan's
instruction, specifically to clear `app/` for this change-set.

**A concurrent session began editing `app/` again during implementation** — `ExpertLayer.tsx`
mid-refactor with a new untracked `expert-logs.ts`, not compiling. Its files do not overlap
CS-2's, so CS-2 stages only its own paths by explicit path and verifies in an isolated
worktree, which is this repo's established precedent (2.11a and 2.18 both did the same).
**`git add -A` is never used.**

## Consequences carried forward, not resolved here

- **`#pressing`'s metre presentation is RETIRED, not re-shaped.** `metreRows`' own docblock
  anticipated exactly this: *"when it rules, THIS PRESENTATION IS DELETED OR RE-SHAPED — it
  is not a surface to build on."* The four values it rendered were the synthetic ones.
  Re-presenting the 18 real values needs six panel labels that exist in neither locale, and
  minting user-visible copy is a ruling CS-2 does not have. **Filed: re-present
  `shapeByPhase`. Owner: Story 2.19.**
- **`CorpusNullableGoalkeeperRecord` collapsed to a re-export**, exactly as Story 2.10
  predicted. Its hand-written widening of the five fields is now the contract's own shape,
  and its presence gates go from workaround to contract.

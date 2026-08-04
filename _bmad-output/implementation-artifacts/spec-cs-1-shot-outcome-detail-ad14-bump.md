---
title: 'Change-set CS-1 — ShotOutcomeDetail 22→24, one-to-many outcome map, schemaVersion 2→3 (AD-14)'
type: 'feature'
created: '2026-08-04'
status: 'done'
baseline_commit: '0c407b3' # prompt named 163fa20; the Epic 2 sessions have committed 4x since
review_loop_iteration: 0
context:
  - '{project-root}/contract/README.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.16's contract emission is blocked: the closed 22-value `ShotOutcomeDetail`
enum is missing two corpus-real labels (bare `Incomplete` ×31, bare `On Target` ×3), and
`x-maps-to-outcome["deflected-on-target-defensive-event"]` declares `on-target` where the corpus
renders it in the incomplete colour 10:1. CS-1 gates Stories 1.16–1.19 — the whole remainder of
Epic 1.

**Approach:** Land CR-1 + CR-2 + the riding own-goal `$comment` correction as ONE atomic AD-14
commit executing Epic 1's side of the flow: schema edits, logged decision 17, `schemaVersion`
2→3 (`version.json` **and** the five per-artifact `const` stamps), all 7 fixtures re-pinned, both
generated type outputs regenerated, and every pipeline consumer of the changed values updated —
proven in that same commit by the full `pipeline/tests` suite plus `npm run check:types`.

## Boundaries & Constraints

**Always:** Every artifact of the AD-14 recipe lands in ONE commit — schemas, README decision,
version, fixtures, both generated outputs, pipeline consumers. `x-maps-to-outcome` keeps exact
scalars for all 21 other details; only `deflected-on-target-defensive-event` becomes the array
`["incomplete", "on-target"]` (majority first). Enum and map stay alphabetically ordered, bare
value before its compound siblings (mirroring the existing `off-target`). Stage only the paths
this spec names.

**Ask First:** Any type error, red test, or required edit that lands **inside `app/src/`** — two
Epic 2 agents are in flight and own those files. HALT and report; do not fix.

**Never:** Re-litigate CR-2's rejected alternatives (remap-to-`incomplete`, keep-`on-target`,
enum-split) — they are adjudicated with reasons. Never add the two locale label rows (owned by
Stories 2.13/2.18). Never delete the 2.7/2.18 `shotOutcomeDetail` tripwires — CS-1 ships no
labels, so they must stay green. Never `git add -A`. Never touch any `app/src` component,
section, model, viz or locale file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bare label parses | Shots table row printing `Incomplete` | Maps to detail `incomplete`, now an in-contract enum value; no `AD14_EXTRA_DETAILS` bypass | N/A |
| One-to-many detail | Row `deflected-on-target-defensive-event` under an **incomplete**-coloured marker | Linking cross-check accepts it — `DETAIL_COMPATIBLE_OUTCOMES` yields `("incomplete","on-target")`, derived from the contract array | N/A |
| Same detail, other colour | Same row under an **on-target** marker | Also accepted — same tuple | N/A |
| Map-vs-enum drift | `x-maps-to-outcome` keys ≠ enum values | `test_shot_outcome_agrees_with_its_finer_outcome_detail` fails loudly | Test failure, not silent |
| Array value in subset check | `set(mapping.values())` over an array entry | Must NOT `TypeError` — flatten scalars and arrays before the `<= outcomes` check | Rewritten assert |
| Fixture version drift | A fixture left at `schemaVersion: 2` | `assert:schema-version` and `test_fixtures.py` fail, naming the file | Build gate exits 1 |

</frozen-after-approval>

## Code Map

- `contract/common.schema.json` -- `ShotOutcomeDetail` `$def` (L105–157): enum + `x-maps-to-outcome` + description. CR-1 and CR-2 both land here.
- `contract/match-bundle.schema.json` -- `GoalOwnGoal.$comment` (L198) is stale (Story 1.6 disproved it); `schemaVersion.const` (L26).
- `contract/tournament|team-profile|player-profile|leaderboards.schema.json` -- each carries a `schemaVersion` `const: 2`. **Not in the filed recipe** — `test_every_artifact_schema_pins_schema_version_to_the_declared_version` fails without them, and fixtures pinned to 3 would not validate.
- `contract/version.json` -- the single global version (2 today, not 1 — the filed recipe is stale; c645cfe already landed 1→2).
- `contract/README.md` -- provenance row L122, "Verified against the shot markers" L158, "deliberately empty" table L191, decision 13 L416–428, sign-off CS-1 block L556–566. Decision 17 appends after decision 16 (L459).
- `contract/generated/{contract-types.d.ts,schema-version.ts}` + `app/src/lib/contract/{…}` -- the two generated outputs; currently byte-identical. Regenerated, never hand-edited.
- `pipeline/markers/attempts.py` -- `OUTCOME_LABEL_TO_DETAIL` (L59), `DETAIL_TO_OUTCOME` (L89), `DETAIL_COMPATIBLE_OUTCOMES` (L125) and their AD-14 comment blocks (L50–58, L86–88, L116–124).
- `pipeline/markers/linking.py` -- L215 sole production reader of `DETAIL_COMPATIBLE_OUTCOMES`; its shape (`dict[str, tuple[str, ...]]`) must not change.
- `pipeline/tests/test_markers_attempts.py` -- `AD14_EXTRA_DETAILS` (L74), `AD14_BOTH_COLOURS_DETAIL` (L77), the three cross-check tests (L81–110), and L140's scalar lookup.
- `pipeline/tests/test_fixtures.py` -- `test_shot_outcome_agrees_with_its_finer_outcome_detail` (L724–747); both asserts break (L741 `TypeError`s, L744 compares against an array).
- `pipeline/tests/test_contract_schemas.py` -- L165–166 hardcode `{"schemaVersion": 2}` / `schema_version() == 2` with a v1→v2 docstring. **Not in the filed recipe.**
- `data/fixtures/{matches/*.json ×3, index/*.json ×4}` -- the 7 hand-edited artifacts to re-pin.
- `data/fixtures/README.md` -- L26 states "Every file is stamped `schemaVersion: 2`".

## Tasks & Acceptance

**Execution:**
- [x] `contract/common.schema.json` -- add `incomplete` and `on-target` to the enum (each immediately before its compound siblings) and to `x-maps-to-outcome`; change `deflected-on-target-defensive-event` to `["incomplete","on-target"]`; rewrite the description for 24 values, the one array entry, and a pointer to decision 17 -- CR-1 + CR-2.
- [x] `contract/match-bundle.schema.json` -- replace the stale `GoalOwnGoal.$comment` with Story 1.6's finding (red-football lineup glyph, 14 across the corpus, reconciled 104/104; v1 still emits `false` pending 1.16's emission flip); bump `schemaVersion.const` to 3 -- riding correction + the bump.
- [x] `contract/{tournament,team-profile,player-profile,leaderboards}.schema.json` -- bump each `schemaVersion.const` to 3 -- the per-artifact stamps the recipe omitted.
- [x] `contract/version.json` -- `schemaVersion` 2 → 3 -- AD-14 step 4.
- [x] `contract/README.md` -- append logged decision 17 (both change requests, CR-2's rejected alternatives verbatim, the own-goal correction, and the solo-repo note that Epic 1 executed what Epic 2 filed); update the provenance row to 24 with both new source labels; update the L158, L191, L416–428 and L556–566 prose that hardcodes 22 or says CS-1 is pending -- AD-14 step 3.
- [x] `pipeline/markers/attempts.py` -- delete the AD-14-candidate framing from the three comment blocks; move `incomplete`/`on-target` into `DETAIL_TO_OUTCOME` as ordinary in-contract entries; widen its value type and derive `DETAIL_COMPATIBLE_OUTCOMES` uniformly from it so the both-colours case comes from the contract instead of a local override -- absorb the now-in-contract extras.
- [x] `pipeline/tests/test_markers_attempts.py` -- drop `AD14_EXTRA_DETAILS`; assert the label map covers the enum **exactly** and `DETAIL_TO_OUTCOME == contract_map` **exactly**; keep the both-colours test but source its expectation from the contract array; fix L140's scalar lookup for the array entry -- the two frozen-map asserts CR-1/CR-2 break.
- [x] `pipeline/tests/test_fixtures.py` -- rewrite BOTH asserts of `test_shot_outcome_agrees_with_its_finer_outcome_detail`: flatten scalar-or-array values before the `<= outcomes` subset check, and relax the per-shot check to set-membership; update the docstring from 22 to 24 -- the values-subset check `TypeError`s on an array.
- [x] `pipeline/tests/test_contract_schemas.py` -- retarget L165–166 to 3 and rewrite the docstring to record the v2→v3 CS-1 bump -- otherwise the suite fails on the bump itself.
- [x] `data/fixtures/{matches,index}/*.json` (7 files) -- re-pin `schemaVersion` to 3, value only, byte-identical otherwise -- AD-14 step 5.
- [x] `data/fixtures/README.md` -- restate the stamp as 3 and add the CS-1 bump note beside the Story 1.8 one -- keep the fixture doc true.
- [x] `contract/` then `app/` -- run `npm run generate:types` in each; commit both outputs -- AD-14 step 5, never hand-edited.

**Acceptance Criteria:**
- Given the post-change contract, when `ShotOutcomeDetail.enum` is read, then it holds 24 values and `x-maps-to-outcome` has 24 keys of which exactly one (`deflected-on-target-defensive-event`) is an array.
- Given the full `pipeline/tests` suite is run with `pipeline/venv/Scripts/python.exe`, then it passes with zero failures — including `test_markers_attempts.py`, `test_fixtures.py` and `test_contract_schemas.py`.
- Given `npm run check:types` is run in `contract/` and in `app/`, then both report the committed output up to date.
- Given `npm run assert:schema-version` is run in `app/`, then it reports 7 artifacts at schemaVersion 3.
- Given `app/src/lib/i18n.test.ts` and `glossary.test.ts`, when the app test suite runs, then the `shotOutcomeDetail` tripwires are still green and undeleted — CS-1 ships no locale labels.
- Given `git status`, when the commit is prepared, then no `app/src` file outside `app/src/lib/contract/` is staged.

## Spec Change Log

### Review iteration 1 (2026-08-04) — no loopback; 6 patches, 3 defers

Two adversarial reviewers (Blind Hunter, Edge Case Hunter) ran in parallel on the diff. No
finding reached `intent_gap` or `bad_spec`, so the spec's frozen intent stands unamended and no
code was reverted. Recorded because two findings were **regressions introduced by this change**,
not pre-existing issues:

- **`set(DETAIL_COMPATIBLE_OUTCOMES) == set(DETAIL_TO_OUTCOME)` became tautological.** Deriving
  the compatible-outcomes dict by comprehension from `DETAIL_TO_OUTCOME` made both key sets
  identical *by construction*, so the drift guard could never fail. Re-pointed at the contract's
  keys — which is the drift that actually matters. This is the exact "relaxed assert lost
  coverage" hazard the spec told the reviewers to hunt, and it landed in this change's own code.
- **The factory-label test was weakened by an unjustified subject swap.** Relaxing
  `DETAIL_TO_OUTCOME[...] == outcome` to membership in `DETAIL_COMPATIBLE_OUTCOMES` was
  defensible (it is the predicate `link_markers` applies), but it silently dropped the exact-map
  pin, letting a factory label be retargeted at the dual-colour detail while drawing the minority
  colour. Both asserts now stand, with the docstring explaining why each is needed.

Also patched: an empty-array value would have silently unlinked every marker of that detail with
zero test signal (impossible while the map was all scalars — a hazard *created* by CR-2); nothing
pinned the scalar-vs-array value TYPES the schema description promises consumers; and four
documentation sites still stated pre-CS-1 facts (`linking.py`'s docstrings, the README file map's
`schemaVersion 2`, the AD-14 numbered steps' one-file/one-tree framing, and CR-2's "other 21").

**KEEP for any re-derivation:** deriving `DETAIL_COMPATIBLE_OUTCOMES` from the contract map rather
than overriding it is the correct shape and survived review — but it must be paired with guards on
key set, value type and minimum length, because the derivation removes the structural guarantees
the old hand-built dict gave for free.

## Design Notes

`DETAIL_COMPATIBLE_OUTCOMES` is what `linking.py:215` reads, and its `dict[str, tuple[str, ...]]`
shape must survive. Post-CS-1 the both-colours case is contract knowledge, not a local exception,
so derive rather than override:

```python
DETAIL_TO_OUTCOME: dict[str, str | tuple[str, ...]] = {
    "deflected-on-target-defensive-event": ("incomplete", "on-target"),  # the one array entry
    ...  # 23 scalars, including the now-in-contract "incomplete" / "on-target"
}
DETAIL_COMPATIBLE_OUTCOMES: dict[str, tuple[str, ...]] = {
    detail: (value,) if isinstance(value, str) else value
    for detail, value in DETAIL_TO_OUTCOME.items()
}
```

The equality test then compares against the contract with JSON's `list` normalized to the frozen
`tuple` — that normalization is the only latitude the "exactly equal" assert gets.

No fixture carries `deflected-on-target-defensive-event`, so `test_fixtures.py`'s per-shot check
never exercises the array today; the subset check does. Both are still fixed — the per-shot one is
a live trap for Story 1.16's first real emission.

## Verification

**Commands:**
- `pipeline/venv/Scripts/python.exe -m pytest pipeline/tests -q` -- expected: 0 failures (~45 min; run in background, do not chunk).
- `cd contract && npm run check:types` -- expected: "generated output is up to date".
- `cd app && npm run check:types` -- expected: same.
- `cd app && npm run assert:schema-version` -- expected: "7 artifact(s) at schemaVersion 3".
- `cd app && npx vitest run src/lib/i18n.test.ts src/lib/glossary.test.ts` -- expected: green, tripwires intact.
- `git status --short` -- expected: no `app/src` path staged except `app/src/lib/contract/`.

## Suggested Review Order

**The contract change itself**

- Entry point: the one array value that makes the map heterogeneous — read this first.
  [`common.schema.json:113`](../../contract/common.schema.json#L113)

- The enum's two new bare values and the description that tells consumers to expect string OR array.
  [`common.schema.json:105`](../../contract/common.schema.json#L105)

- The durable AD-14 record: both change requests, CR-2's rejected alternatives, and what the filed recipe got wrong.
  [`README.md:471`](../../contract/README.md#L471)

- The riding correction — Story 1.6 disproved the old claim; the flip itself is 1.16's.
  [`match-bundle.schema.json:198`](../../contract/match-bundle.schema.json#L198)

**Production behaviour (the only code path that reads the change)**

- Compatible outcomes are now DERIVED from the contract, not overridden locally.
  [`attempts.py:134`](../../pipeline/markers/attempts.py#L134)

- The frozen mirror, now tuple-valued for the one dual-colour detail.
  [`attempts.py:96`](../../pipeline/markers/attempts.py#L96)

- The sole consumer. Unchanged by design — the widening kept its `dict[str, tuple]` shape.
  [`linking.py:222`](../../pipeline/markers/linking.py#L222)

**The version bump — six declarations, not one**

- The per-artifact `const` stamp; four sibling schemas carry the same edit.
  [`match-bundle.schema.json:26`](../../contract/match-bundle.schema.json#L26)

- The AD-14 flow, rewritten so the next bump author doesn't repeat the omission.
  [`README.md:542`](../../contract/README.md#L542)

- The unlisted fourth consumer: the version hardcoded in a test assert.
  [`test_contract_schemas.py:171`](../../pipeline/tests/test_contract_schemas.py#L171)

**Tests — where the review found the real problems**

- Was tautological after the comprehension; now asserts against the contract's keys, plus a non-empty guard.
  [`test_markers_attempts.py:122`](../../pipeline/tests/test_markers_attempts.py#L122)

- Lost its exact-map pin under an otherwise-fair relaxation; both asserts now stand.
  [`test_markers_attempts.py:174`](../../pipeline/tests/test_markers_attempts.py#L174)

- Exact equality plus a raw value-TYPE pin, so 1-element arrays can't drift in silently.
  [`test_markers_attempts.py:101`](../../pipeline/tests/test_markers_attempts.py#L101)

- Both asserts rewritten — the subset check raised `TypeError` on an array value.
  [`test_fixtures.py:748`](../../pipeline/tests/test_fixtures.py#L748)

**Peripherals**

- Version-only re-pins; no fixture content moved.
  [`m001-mexico-south-africa.json`](../../data/fixtures/matches/m001-mexico-south-africa.json)

- Generated, never hand-edited; both trees regenerated and byte-identical.
  [`contract-types.d.ts:1295`](../../contract/generated/contract-types.d.ts#L1295)

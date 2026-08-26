import type { PanelAnchorId } from "@/lib/match-anchors";
import type { DictionaryKey } from "@/lib/i18n";

/*
 * THE EXPERT LAYER'S FULL-EVENT-LOG LINK TABLE (Story 2.11c, AC 1 / UX-DR18).
 *
 * RULING 1 — "the same tables that serve as the viz data-table alternatives"
 * means ONE RENDERED INSTANCE REACHED FROM TWO ENTRY POINTS, not two instances.
 * UX-DR18 assigns the Expert layer "full event logs DOUBLING AS viz
 * alternatives" and EXPERIENCE.md repeats the phrase; "doubling as" is one
 * artifact serving two roles. Removing the viz disclosures was ruled out ON THE
 * SPEC — UX-DR9 requires every panel to carry "Ver los datos" opening its
 * equivalent table, and NFR-2/UX-DR16 make that the accessibility floor. So
 * these slots are LINKS.
 *
 * RULING 2 — SUPERSEDED BY STORY 3.8: THESE LINKS NOW OPEN THE TABLE.
 *
 * As written at 2.11c this ruling read "they are honest anchors, and nothing
 * here opens a disclosure", and it listed four blockers: a `ViewDataDisclosure`
 * whose `open` was a private `useState(false)`; a `PitchPanel` that forwarded
 * only `panelTitle` and `trailing`; a `sectionIdFromHash` that was whole-string
 * equality and returned null SILENTLY for a finer fragment; and `#shot-maps`
 * being ambiguous between two independent disclosures. The list is retired here
 * rather than left standing in the present tense, because a false description of
 * the tree is worse than no description.
 *
 * What each blocker became: Story 2.19 shipped `ViewDataDisclosure.openNonce`
 * AND the capture-phase click listener for the same-fragment case — the one this
 * entry called "fatal to a link list" — while building the Tournament Hub's own
 * deep links. Story 3.8 then ported that hook to `@/lib/use-anchor-nonce`, added
 * `anchorId`/`openNonce` to `PitchPanel`, and replaced `sectionIdFromHash` with
 * the `@/lib/match-anchors` grammar, which resolves BOTH `#<section>` and the
 * finer `#<section>-<panel>` and reports an addressed-but-unresolvable fragment
 * loudly in dev.
 *
 * So each href below now names a PANEL, not just a section: following one
 * expands the section, scrolls to the panel, moves focus there, and opens its
 * "Ver los datos" region — and following the SAME one again after closing it
 * re-opens it.
 *
 * WITH ONE HONEST EXCEPTION, RULED AT D10 AND RESTATED HERE because the first
 * draft of this ruling asserted the happy path unconditionally and was therefore
 * false on every real match for two of the six links. `events.crosses` and
 * `events.defensiveActions` are null on 104/104 shipped bundles, so the cross log
 * and the defensive log land on a NAMED ABSENCE — the section's or the panel's
 * empty state, which carries the anchor id precisely so the link lands on
 * something — and there is no "Ver los datos" control there to open. That is
 * ruled FR-22 behaviour, not a defect. The labels still state where the table
 * lives, which is what a reader scanning the list needs.
 *
 * SIX ENTRIES, NOT FIVE (ruling 6). AC 1 enumerates five logs; four of them are
 * linked here (the receiving log has no existing home and is rendered in the
 * layer itself), and Story 2.9's two AGGREGATE surfaces are added as pointers —
 * which is why their labels read "Tabla de ..." rather than "Registro de ...".
 * Cheap to reverse: delete two entries, two locale keys and two test rows.
 *
 * WHY THIS IS A PURE MODULE AND NOT PART OF `ExpertLayer.tsx` (ruled at the
 * 2.11c code review, 2026-08-05). Every comparable frozen list in this project
 * lives outside the component graph for one reason: so a unit suite can pin it
 * without importing a component. `SECTION_IDS` (this file's own import) and
 * `OFFER_MOVEMENT_TYPES` are the precedent. Holding it in the `"use client"`
 * component meant `lib/i18n.test.ts` reached it through `DataTable` ->
 * `SortAnnouncer` -> `radix-ui` under `environment: "node"` — green, until
 * anything in that chain touches `window` at module scope, at which point the
 * failure surfaces as "the i18n suite is red" with no visible cause. `lib/`
 * rather than `viz/` because this is navigation config, not a viz model.
 */

/** One entry in the Expert Layer's "Registros completos" link list. */
export interface ExpertLogLink {
  /** Stable per-row identity — the anchor's and the hint's DOM ids are built from it. */
  id: string;
  /** The link's own label. NEVER equal to `titleKey`'s value (i18n.test.ts asserts it). */
  labelKey: DictionaryKey;
  /**
   * An in-page fragment.
   *
   * TYPED AGAINST `MatchFragmentId`, NOT `string`, and that is the point: a typo
   * like `#pass-network` yields a dead anchor that nothing catches at runtime,
   * since an unresolvable fragment is silent in production by design (a URL is
   * reader input, and a throw would turn a typo into a crash). Typed this way it
   * is a COMPILE error instead — the same argument `RECEIVING_EVENT_ORDER` is
   * built on in `receiving-log-model.ts`.
   *
   * NARROWED TO `PanelAnchorId` AT THE 3.8 CODE REVIEW, and the narrowing is the
   * point. Story 3.8 first widened this to `MatchFragmentId`
   * (`SectionId | PanelAnchorId`) and called that "STRENGTHENED" — it was not.
   * That union still ADMITS every bare `#<section>`, so the type could not reject
   * a regression straight back to `href: "#shot-maps"`, which is the exact shape
   * ledger L1886 filed. Only the runtime pin in `i18n.test.ts` stood between the
   * repo and that regression.
   *
   * Every one of the six links names a PANEL, so the field's type says so, and the
   * L1886 guarantee now lives in the type where this docblock always claimed it
   * did. `i18n.test.ts` keeps its runtime pin as the second line of defence,
   * because the type cannot see a registry entry that is later removed.
   */
  href: `#${PanelAnchorId}`;
  /** The section the table lives in, composed into the link's description. */
  titleKey: DictionaryKey;
}

export const LOG_LINKS: readonly ExpertLogLink[] = [
  {
    id: "shot-log",
    labelKey: "expert.logs.shotLog",
    href: "#shot-maps-shots",
    titleKey: "viz.shotMap.title",
  },
  {
    id: "cross-log",
    labelKey: "expert.logs.crossLog",
    href: "#shot-maps-crosses",
    titleKey: "viz.crossMap.title",
  },
  {
    id: "pass-matrix",
    labelKey: "expert.logs.passMatrix",
    href: "#pass-networks-matrix",
    titleKey: "viz.passNetwork.title",
  },
  {
    id: "offers",
    labelKey: "expert.logs.offers",
    href: "#offers-to-receive-table",
    titleKey: "viz.offers.title",
  },
  {
    id: "movement",
    labelKey: "expert.logs.movement",
    href: "#movement-to-receive-table",
    titleKey: "viz.movement.title",
  },
  {
    id: "defensive",
    labelKey: "expert.logs.defensive",
    href: "#defensive-actions-table",
    titleKey: "viz.defensiveActions.title",
  },
];

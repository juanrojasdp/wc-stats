import type { DictionaryKey } from "@/lib/i18n";
import type { SectionId } from "@/lib/tactical-sections";

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
 * RULING 2 — THEY ARE HONEST ANCHORS, AND NOTHING HERE OPENS A DISCLOSURE. A
 * plain anchor does not deliver a reader to a table: every match-page table sits
 * behind a `ViewDataDisclosure` whose `open` is a private `useState(false)` with
 * no prop, no ref and a `useId()` region that is not authorable and does not
 * exist in the DOM while closed; `PitchPanel` forwards only `panelTitle` and
 * `trailing`; `sectionIdFromHash` is whole-string equality against the eleven
 * SectionIds, so a finer fragment resolves to null SILENTLY; and `#shot-maps` is
 * ambiguous, holding two independent disclosures. Real plumbing is ~12 files
 * across every match-page section and inherits the ledgered "an unchanged hash
 * never re-fires hashchange" defect, which is fatal to a link list. So each link
 * STATES where the table is and that "Ver los datos" opens it, and the gap is
 * FILED.
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
   * TYPED AGAINST `SectionId`, NOT `string`, and that is the point: a typo like
   * `#pass-network` yields a dead anchor that nothing catches at runtime, since
   * `sectionIdFromHash` is whole-string equality and returns `null` SILENTLY.
   * Typed this way it is a COMPILE error instead — the same argument
   * `RECEIVING_EVENT_ORDER` is built on in `receiving-log-model.ts`.
   * `i18n.test.ts` keeps the `SECTION_IDS` membership pin as a second line of
   * defence, because the type cannot see a `SECTION_IDS` entry that is removed.
   */
  href: `#${SectionId}`;
  /** The section the table lives in, composed into the link's description. */
  titleKey: DictionaryKey;
}

export const LOG_LINKS: readonly ExpertLogLink[] = [
  {
    id: "shot-log",
    labelKey: "expert.logs.shotLog",
    href: "#shot-maps",
    titleKey: "viz.shotMap.title",
  },
  {
    id: "cross-log",
    labelKey: "expert.logs.crossLog",
    href: "#shot-maps",
    titleKey: "viz.crossMap.title",
  },
  {
    id: "pass-matrix",
    labelKey: "expert.logs.passMatrix",
    href: "#pass-networks",
    titleKey: "viz.passNetwork.title",
  },
  {
    id: "offers",
    labelKey: "expert.logs.offers",
    href: "#offers-to-receive",
    titleKey: "viz.offers.title",
  },
  {
    id: "movement",
    labelKey: "expert.logs.movement",
    href: "#movement-to-receive",
    titleKey: "viz.movement.title",
  },
  {
    id: "defensive",
    labelKey: "expert.logs.defensive",
    href: "#defensive-actions",
    titleKey: "viz.defensiveActions.title",
  },
];

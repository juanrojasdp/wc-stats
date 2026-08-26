import { SECTION_IDS, type SectionId } from "@/lib/tactical-sections";

/*
 * THE MATCH ROUTE'S FRAGMENT GRAMMAR (Story 3.8, ruled decisions D1 and D2).
 *
 * ═══ WHY THIS IS A PURE MODULE AND NOT A HELPER IN `TacticalLayer` ═══
 *
 * It replaces `sectionIdFromHash`, which lived inside that `"use client"`
 * component and was therefore untestable without the whole component graph.
 * `expert-logs.ts:44` states the precedent for the location — "navigation
 * config, not a viz model" — and it is the same reason `LOG_LINKS` itself was
 * moved out of `ExpertLayer` at the 2.11c code review. `SECTION_IDS` (this
 * file's own import) and `OFFER_MOVEMENT_TYPES` are the other two.
 *
 * ═══ THE GRAMMAR, IN FULL ═══
 *
 *   #<SectionId>            → that section. UNCHANGED shipped behaviour: expand,
 *                             scroll, focus the heading, open NO table. That is
 *                             the ruled UX-DR18 anchor, verified live at two
 *                             widths by 2.11c, and widening it would change the
 *                             meaning of eleven links that already ship.
 *   #<SectionId>-<panel>    → that section AND that panel's disclosure. NEW.
 *   anything else           → null.
 *
 * ═══ WHY THE THIRD CASE IS NOT SIMPLY SILENT ═══
 *
 * L1553's complaint about the old grammar was never that it returned null; it
 * was that it returned null SILENTLY, so `#shot-maps-log` — a real section, a
 * panel that does not exist — was indistinguishable from a working link until
 * someone clicked it. A fragment that ADDRESSES a section and then fails to
 * resolve is reported loudly in dev/test and silently ignored in production.
 *
 * `#main-content` (SiteHeader.tsx:62) and `#expert` (ExpertLayer.tsx:71) name no
 * section, so they stay silent at every environment — they are legitimate
 * anchors on every match page, and ExpertLayer.tsx:226-229 records that a null
 * for `#expert` is BY DESIGN. A blanket warn would fire on both on every page
 * load, which is how a loud gate teaches its readers to stop looking.
 */

/** Strips the leading `#` off a `window.location.hash`-shaped string. */
const HASH_PREFIX = "#";

/** The separator between a section id and its panel suffix. */
const ANCHOR_SEPARATOR = "-";

/*
 * THE FROZEN REGISTRY — one entry per disclosure an Expert log link points at.
 *
 * `as const satisfies` rather than a widening annotation: the `satisfies` clause
 * type-checks every `section` against `SectionId` while the `as const` keeps the
 * `id`s as literals, which is what makes `PanelAnchorId` a six-member union and
 * a typo in `expert-logs.ts` a COMPILE error rather than a dead anchor. Annotate
 * this `readonly {id: string}[]` and that protection evaporates silently.
 */
export const PANEL_ANCHORS = [
  { id: "shot-maps-shots", section: "shot-maps" },
  { id: "shot-maps-crosses", section: "shot-maps" },
  /*
   * ONE anchor, TWO render sites (D5). `PassNetworksSection` puts a disclosure
   * in its matrix-only branch AND in its PitchPanel branch, and which one a
   * reader meets depends on the DATA: `passNetworkNodes` is null on 104/104 real
   * matches (the matrix branch) and populated on the m001 fixture (the panel
   * branch). Both are wired to this id; wiring either alone looks green in
   * exactly one of the two worlds.
   */
  { id: "pass-networks-matrix", section: "pass-networks" },
  { id: "offers-to-receive-table", section: "offers-to-receive" },
  { id: "movement-to-receive-table", section: "movement-to-receive" },
  { id: "defensive-actions-table", section: "defensive-actions" },
] as const satisfies readonly { id: string; section: SectionId }[];

/** The six addressable panels. Derived from the registry, never hand-listed. */
export type PanelAnchorId = (typeof PANEL_ANCHORS)[number]["id"];

/** Everything the match route's fragment grammar accepts. */
export type MatchFragmentId = SectionId | PanelAnchorId;

/** What a fragment names: always a section, and a panel only for the finer form. */
export interface MatchFragmentTarget {
  section: SectionId;
  panel: PanelAnchorId | null;
}

/*
 * A stale fragment re-resolves on EVERY render of a mounted layer, so each
 * distinct miss is reported once instead of flooding the console and burying
 * the first, useful line. Keyed by the fragment, not a one-shot boolean: two
 * different bad anchors are two different defects and both deserve a line.
 * Copied from `i18n.ts:44`'s `reportedMissing`.
 */
const reportedFragments = new Set<string>();

/**
 * True when `raw` addresses a real section and then something unresolvable —
 * the "someone changed an href and nothing went red" shape.
 */
function addressesASection(raw: string): boolean {
  return SECTION_IDS.some((id) => raw.startsWith(`${id}${ANCHOR_SEPARATOR}`));
}

function reportUnresolvable(raw: string): void {
  /*
   * `console.error`, NEVER `throw` — and `i18n.ts` is not the counter-example
   * (D2). `t()` throws because an unresolvable KEY is only reachable from a code
   * defect. A URL fragment is READER INPUT: someone hand-types `#shot-map`, and
   * a throw here takes the page down inside `TacticalErrorBoundary`, turning a
   * typo into a crash. Visible in dev, assertable in a test, harmless in prod.
   */
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (reportedFragments.has(raw)) {
    return;
  }
  reportedFragments.add(raw);
  console.error(
    `match-anchors: fragment "#${raw}" names a section but resolves to no panel. ` +
      `Expected a SectionId or one of: ${PANEL_ANCHORS.map((anchor) => anchor.id).join(", ")}`
  );
}

/**
 * Resolve a URL fragment to the section it names and, for the finer form, the
 * panel whose disclosure it addresses. `null` for anything outside the grammar.
 */
export function resolveMatchFragment(hash: string): MatchFragmentTarget | null {
  const raw = hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash;
  if (raw === "") {
    return null;
  }
  const section = SECTION_IDS.find((id) => id === raw);
  if (section !== undefined) {
    return { section, panel: null };
  }
  const anchor = PANEL_ANCHORS.find((entry) => entry.id === raw);
  if (anchor !== undefined) {
    return { section: anchor.section, panel: anchor.id };
  }
  if (addressesASection(raw)) {
    reportUnresolvable(raw);
  }
  return null;
}

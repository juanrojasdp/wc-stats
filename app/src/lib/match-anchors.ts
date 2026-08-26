import { SECTION_IDS, type SectionId } from "@/lib/tactical-sections";
import { stripHashPrefix } from "@/lib/use-anchor-nonce";

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

/*
 * THE RESET SEAM (code review).
 *
 * Without it the dedupe Set is once-per-SESSION rather than once-per-page: a
 * client-side route change to a second match carrying the same stale href stays
 * silent, and any test asserting a call COUNT becomes order-dependent on whatever
 * resolved the same fragment before it. Exported rather than inferred from a
 * route change, because this module is pure and knows nothing about navigation —
 * the caller that owns the page lifecycle is the one that can say when a page
 * began.
 */
export function resetFragmentReports(): void {
  reportedFragments.clear();
}

/*
 * THE SUFFIXES `TacticalSection` MINTS FOR ITS OWN A11Y WIRING (code review R4).
 *
 * `TacticalSection.tsx:109-111` builds `${id}-heading`, `${id}-content` and
 * `${id}-summary` for all ELEVEN sections — 33 real, valid DOM ids on every match
 * page. Each one matches `<SectionId>-` and would otherwise be denounced by the
 * guard below as a broken href, which is how a loud gate teaches its readers to
 * stop looking. They are not panels and were never addressable by the grammar;
 * they are the aria targets the disclosure control points at.
 *
 * D2's report SCOPE is otherwise unchanged and stays as ruled: only a fragment
 * that addresses a section and resolves to nothing reports. Near-miss shapes a
 * reader can hand-type (`#Shot-Maps-Shots`, `#shot-maps-shots?x=1`) remain silent
 * BY DESIGN — widening detection to them was considered at this review and
 * declined, because each would need a fuzzy match and a fuzzy match is how a gate
 * starts reporting things that are not defects.
 */
const RESERVED_SECTION_SUFFIXES = ["heading", "content", "summary"] as const;

/**
 * True when `raw` addresses a real section and then something unresolvable —
 * the "someone changed an href and nothing went red" shape. False for the
 * section's own a11y ids, which address a section and resolve to no panel BY
 * DESIGN.
 */
function addressesASection(raw: string): boolean {
  return SECTION_IDS.some((id) => {
    const prefix = `${id}${ANCHOR_SEPARATOR}`;
    if (!raw.startsWith(prefix)) {
      return false;
    }
    const suffix = raw.slice(prefix.length);
    return !RESERVED_SECTION_SUFFIXES.some((reserved) => reserved === suffix);
  });
}

/**
 * Report a fragment that addresses a section and resolves to no panel.
 *
 * SEPARATE FROM `resolveMatchFragment` AND THAT IS THE POINT (code review P5).
 * The resolver is called from a RENDER body (`TacticalLayer` adjusts state during
 * render, because `react-hooks/set-state-in-effect` rejects the effect shape), and
 * a render that emits `console.error` and mutates a module-level Set is not pure —
 * React may discard such a render, and StrictMode's double-invoke was being masked
 * by the dedupe Set rather than tolerated by design. So resolution stays pure and
 * the REPORT moved to the caller's effect, where a side effect belongs.
 *
 * Safe to call with any fragment: it is silent unless the fragment both addresses
 * a real section and resolves to nothing.
 */
export function reportUnresolvedFragment(hash: string): void {
  const raw = stripHashPrefix(hash);
  if (raw === "" || resolveMatchFragment(raw) !== null) {
    return;
  }
  if (!addressesASection(raw)) {
    return;
  }
  reportUnresolvable(raw);
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
 *
 * PURE — safe to call during render. The dev-visible report for an
 * addressed-but-unresolvable fragment lives in `reportUnresolvedFragment`, which
 * the caller invokes from an effect.
 */
export function resolveMatchFragment(hash: string): MatchFragmentTarget | null {
  const raw = stripHashPrefix(hash);
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
  return null;
}

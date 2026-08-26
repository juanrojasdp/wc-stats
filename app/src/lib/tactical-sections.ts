import type { KeyStatisticsBlock, MatchBundle, TeamKeyStatistics } from "@/lib/contract/contract-types";
import { resolveLeader, type TileLeader } from "@/lib/match-hero";

/*
 * The pure spine of the Tactical Layer (Task 1): section order, disclosure
 * class, the FR-22 data-state predicate and the Key Statistics row model. No
 * React, no DOM, no formatting — this module returns raw numerics plus a
 * format tag; @/lib/format stays the only formatting path and it needs the
 * locale, which only the component has.
 */

/**
 * The eleven Tactical sections in the PRD's normative order. This union's
 * order IS the render order — never sorted, never derived from the dictionary.
 */
export type SectionId =
  | "key-stats"
  | "momentum"
  | "shot-maps"
  | "pass-networks"
  | "offers-to-receive"
  | "movement-to-receive"
  | "defensive-actions"
  | "phases"
  | "pressing"
  | "set-plays"
  | "goalkeeping";

export const SECTION_IDS: readonly SectionId[] = [
  "key-stats",
  "momentum",
  "shot-maps",
  "pass-networks",
  "offers-to-receive",
  "movement-to-receive",
  "defensive-actions",
  "phases",
  "pressing",
  "set-plays",
  "goalkeeping",
];

/**
 * Ruled decision 3, encoded in the type system rather than in a component
 * conditional: both mockups render exactly these two expanded at 390px and
 * UJ-1's ~15-second story is *reading* them, so they never collapse.
 */
export const ALWAYS_EXPANDED_SECTION_IDS = ["key-stats", "momentum"] as const;

export type AlwaysExpandedSectionId = (typeof ALWAYS_EXPANDED_SECTION_IDS)[number];

/** The nine sections that collapse below `lg` — the complement of the above. */
export type CollapsibleSectionId = Exclude<SectionId, AlwaysExpandedSectionId>;

export const COLLAPSIBLE_SECTION_IDS: readonly CollapsibleSectionId[] = [
  "shot-maps",
  "pass-networks",
  "offers-to-receive",
  "movement-to-receive",
  "defensive-actions",
  "phases",
  "pressing",
  "set-plays",
  "goalkeeping",
];

/** Dictionary key for a section heading — `tactical.sections.<id>.title`. */
export function sectionTitleKey(id: SectionId): `tactical.sections.${SectionId}.title` {
  return `tactical.sections.${id}.title`;
}

/**
 * Dictionary key for a section's one-line summary. Summaries exist for the
 * nine COLLAPSIBLE sections only — the two always-expanded ones never show a
 * summary line, so a key for them would be dead copy.
 */
export function sectionSummaryKey(
  id: CollapsibleSectionId
): `tactical.sections.${CollapsibleSectionId}.summary` {
  return `tactical.sections.${id}.summary`;
}

/**
 * The FR-22 predicate: does the bundle carry this section's data at all?
 *
 * `null` and `[]` are DIFFERENT states in this contract (the schema $comments
 * say so verbatim): `null` = the report does not carry that page → empty
 * state. `[]` = the page was present and listed zero events → `ready`, and the
 * owning story renders its own zero-content view. `.length === 0` is never the
 * empty-state trigger.
 *
 * `keyStatistics`, `tacticalIdentity` and `setPlays` are REQUIRED objects, so
 * their empty state is unreachable at contract v1; they are mapped anyway so
 * every section answers the same question the same way.
 *
 * `shot-maps` is the one section fed by TWO tables, and Story 2.7 ruled
 * (decision 2, closing the 2.5 review's deferred decision D7) that it is
 * `empty` only when `shots` AND `crosses` are both null. When exactly one is
 * missing the section stays `ready` and the missing panel names its own
 * absence in its own slot: a whole-section empty state over a report that
 * carries crosses but no shots would hide data sitting in the bundle, which is
 * the FR-22 failure mode inverted.
 */
export type SectionDataState = "ready" | "empty";

export function sectionDataState(bundle: MatchBundle, id: SectionId): SectionDataState {
  const { events } = bundle;
  switch (id) {
    /*
     * The three required objects genuinely READ their field rather than
     * returning a literal "ready". At contract v1 they cannot be absent, so
     * this is unreachable by the types — but the bundle is `as`-cast
     * unvalidated JSON, so a truncated payload that survived the matchId /
     * schemaVersion gate would otherwise render an absent section as present,
     * which is precisely the silent absence FR-22 forbids.
     */
    case "key-stats":
      return bundle.keyStatistics ? "ready" : "empty";
    case "momentum":
      return bundle.momentum !== null ? "ready" : "empty";
    case "shot-maps":
      // Two panels, two tables (Story 2.7 ruled decision 2) — see the docblock.
      return events.shots !== null || events.crosses !== null ? "ready" : "empty";
    /*
     * STORY 2.19 RULED DECISION R1 / D7 — the second ruled exception to this
     * file's do-not-touch, and the reason is the whole cutover.
     *
     * 2.8's decision 13 required BOTH tables non-null. At the real corpus
     * `passNetworkNodes` is null on 104/104 while `passNetworkEdges` carries
     * **23,597 rows**, so that predicate returned "empty" for every match in the
     * tournament and the fully-real pass matrix never reached a reader. This is
     * the FR-22 failure mode inverted, at the largest scale it occurs anywhere
     * in the product.
     *
     * The node figure is not buildable and never will be — 0 pitch frames on
     * 208/208 pass-network pages and no average-positions page in any of the
     * 5,448 report pages (the 1.14 AD-14 filing) — so this is not a temporary
     * relaxation waiting on data.
     *
     * The three shapes, and why each lands where it does:
     *
     *   (null, non-empty edges) → READY. The matrix table renders alone; there
     *     is no figure and the section says so. This is the shape that ships.
     *   ([], anything)          → EMPTY, deliberately. Story 1.14 binds the
     *     emitter to `null`, NEVER `[]`, because `pass-network-model.ts`'s
     *     `positionOf` throws on every unresolvable endpoint. An empty node
     *     array is therefore a shape the contract cannot produce, and routing it
     *     down the populated branch hands the figure a network with no
     *     positions — which used to reach the error boundary through 228 throws
     *     instead of an honest empty state.
     *   (null, null) or (null, []) → EMPTY. No edges is no matrix.
     */
    case "pass-networks": {
      const nodes = events.passNetworkNodes;
      const edges = events.passNetworkEdges;
      if (edges === null) {
        return "empty";
      }
      if (nodes === null) {
        return edges.length > 0 ? "ready" : "empty";
      }
      return nodes.length > 0 ? "ready" : "empty";
    }
    /*
     * STORY 2.9 RULED DECISION 3 — a ruled exception to the standing
     * do-not-touch on this file, and the ONLY predicate 2.9 changes.
     *
     * These two sections read `bundle.players`, NOT `events.receiving`. Story
     * 1.13 measured `ReceivingEvent` unfulfillable in every one of its EIGHT
     * required fields over 104 reports / 416 pages, so `events.receiving` can
     * only ever be null: there is no receiving marker to draw and none may be
     * fabricated. What the two sections actually render is Domain G —
     * `players[].inPossession`'s `totalOffers`, `offersReceived` and the
     * six-value `offersByMovementType` split, all three `required` in the
     * contract and extracted for real by Story 1.10.
     *
     * The old predicate was wrong in BOTH directions: "ready" when `receiving`
     * was populated but `players` was null (the component mounts and throws,
     * taking all eleven Tactical sections down through the single shared error
     * boundary), and "empty" when `receiving` was null but `players` was
     * populated — hiding data sitting in the bundle, which is the FR-22 failure
     * mode inverted and exactly what Story 2.7's ruled decision 2 exists to
     * prevent. Pinned by a four-way truth table in this module's test.
     *
     * `players` is `PlayerRecords | null`, so the empty branch is reachable —
     * and when it fires, TacticalLayer overrides BOTH halves of the empty-state
     * copy (ruled decision 4): a Domain G absence is not a receiving-section
     * absence, and the generic "El informe oficial no incluye esta sección."
     * would be a false statement over a report whose receiving pages are
     * present.
     */
    case "offers-to-receive":
    case "movement-to-receive":
      return bundle.players !== null ? "ready" : "empty";
    case "defensive-actions":
      return events.defensiveActions !== null ? "ready" : "empty";
    case "phases":
    case "pressing":
      return bundle.tacticalIdentity ? "ready" : "empty";
    case "set-plays":
      return bundle.setPlays ? "ready" : "empty";
    case "goalkeeping":
      return bundle.goalkeeping !== null ? "ready" : "empty";
    default: {
      // Unreachable through the app: TacticalLayer only ever iterates
      // SECTION_IDS, and resolveMatchFragment (@/lib/match-anchors, which
      // replaced sectionIdFromHash in Story 3.8) resolves a URL hash against
      // that same array. Kept because a silent fall-through would render an absent
      // section as present, and because this module is a public seam that
      // 2.6-2.10 call — a wrong id must name itself, not return "ready".
      const unexpected: never = id;
      throw new Error(`tactical-sections: unknown section id ${JSON.stringify(unexpected)}`);
    }
  }
}

/** A Key Statistics field name — the 19 rows of Domain B, one team. */
export type KeyStatField = keyof TeamKeyStatistics;

/**
 * The contract's own `required[]` order, which is the source page's row order.
 * Exhaustiveness is asserted against a fixture in the tests: a contract field
 * added later must fail there rather than silently disappear from the page.
 */
export const KEY_STAT_FIELDS: readonly KeyStatField[] = [
  "possession",
  "goals",
  "expectedGoals",
  "shots",
  "shotsOnTarget",
  "passes",
  "passesCompleted",
  "passCompletion",
  "completedLineBreaks",
  "defensiveLineBreaks",
  "receptionsInFinalThird",
  "crosses",
  "ballProgressions",
  "defensivePressures",
  "directPressures",
  "forcedTurnovers",
  "secondBalls",
  "distanceCovered",
  "sprintDistance",
];

/**
 * The six rows shown at `<md` before the "view all statistics" disclosure
 * (ruled decision 4). Chosen deliberately, NOT copied from the mockup — the
 * mobile mockup's six are possession, shots on target, completed passes, pass
 * accuracy, forced turnovers and corners, and `corners` is not a
 * `TeamKeyStatistics` field at all, so that set was never reproducible. What
 * drives this six: `goals` is out because the Hero scoreline already carries
 * it, and `expectedGoals` + `shots` are in because they are what Diego reads
 * first (UJ-1's ~15-second story). Nothing is deleted — the other thirteen are
 * one tap away.
 */
export const COMPACT_KEY_STAT_FIELDS: readonly KeyStatField[] = [
  "possession",
  "expectedGoals",
  "shots",
  "shotsOnTarget",
  "passesCompleted",
  "passCompletion",
];

/** Which @/lib/format helper (and digit precision) a field renders through. */
export type KeyStatFormat = "percent" | "integer" | "decimal1" | "decimal2";

export const KEY_STAT_FORMAT: Record<KeyStatField, KeyStatFormat> = {
  possession: "percent",
  goals: "integer",
  expectedGoals: "decimal2",
  shots: "integer",
  shotsOnTarget: "integer",
  passes: "integer",
  passesCompleted: "integer",
  passCompletion: "percent",
  completedLineBreaks: "integer",
  defensiveLineBreaks: "integer",
  receptionsInFinalThird: "integer",
  crosses: "integer",
  ballProgressions: "integer",
  defensivePressures: "integer",
  directPressures: "integer",
  forcedTurnovers: "integer",
  secondBalls: "integer",
  distanceCovered: "decimal1",
  sprintDistance: "decimal1",
};

/**
 * Unit suffix for the two distance rows. Units are locale-layer metadata keyed
 * by metric code (AD-7), so this names the key, not the string.
 */
export const KEY_STAT_UNIT: Partial<Record<KeyStatField, "km">> = {
  distanceCovered: "km",
  sprintDistance: "km",
};

/** One head-to-head row: both raw values plus the ruled leader (UX-DR7). */
export interface KeyStatRow {
  field: KeyStatField;
  home: number;
  away: number;
  leader: TileLeader;
}

/**
 * Project the Domain B block into the 19 paired rows, in registry order.
 * Leader determination is AD-5-legal presentation geometry ("leader-accent
 * determination between two displayed values"); nothing is summed or averaged.
 * `resolveLeader` is imported from the Hero module, never re-implemented.
 */
export function buildKeyStatRows(keyStatistics: KeyStatisticsBlock): KeyStatRow[] {
  const { home, away } = keyStatistics;
  return KEY_STAT_FIELDS.map((field) => ({
    field,
    home: home[field],
    away: away[field],
    leader: resolveLeader(home[field], away[field]),
  }));
}

const COLLAPSIBLE_ID_SET = new Set<SectionId>(COLLAPSIBLE_SECTION_IDS);

/** Does this section collapse at all? (The complement of ALWAYS_EXPANDED.) */
export function isCollapsibleId(id: SectionId): id is CollapsibleSectionId {
  return COLLAPSIBLE_ID_SET.has(id);
}

/** One section's resolved presentation, before any locale or class binding. */
export interface SectionPlan {
  id: SectionId;
  isEmpty: boolean;
  collapsible: boolean;
  open: boolean;
  /** Summaries ride the collapsible presentation only — never an empty or always-expanded section. */
  showSummary: boolean;
  /** A `section-gap` separates this section from the previous one. */
  spacedFromPrevious: boolean;
}

/**
 * Resolve every section's disclosure state and vertical rhythm in one pass.
 *
 * Disclosure policy in precedence order (Task 4.3):
 *   1. `empty` → never collapsible at any width (ruled decision 10 — an absence
 *      you must tap to discover is still a silent absence, and a summary line
 *      describing data that is not there is nonsense);
 *   2. `key-stats` / `momentum` → never collapsible (ruled decision 3);
 *   3. everything else → collapsible at every width, DEFAULTING to open at
 *      `≥lg` and collapsed below it. An explicit user or anchor override wins
 *      over the breakpoint default and survives a trip across it.
 *
 * Rhythm (Task 4.4): expanded sections are separated by `section-gap`; a run of
 * collapsed shells stacks directly on its own hairlines, with one `section-gap`
 * before the first of the run.
 *
 * Pure and exported so it is unit-testable: this is the logic AC 1 is really
 * about, and it has no business being trapped in a client component.
 */
export function buildSectionPlans(
  bundle: MatchBundle,
  isLg: boolean,
  overrides: Partial<Record<SectionId, boolean>>
): SectionPlan[] {
  const plans: SectionPlan[] = [];
  let previousWasShell = false;
  for (const [index, id] of SECTION_IDS.entries()) {
    const isEmpty = sectionDataState(bundle, id) === "empty";
    const collapsible = !isEmpty && isCollapsibleId(id);
    const open = collapsible ? (overrides[id] ?? isLg) : true;
    const isShell = collapsible && !open;
    plans.push({
      id,
      isEmpty,
      collapsible,
      open,
      showSummary: collapsible,
      spacedFromPrevious: index > 0 && !(isShell && previousWasShell),
    });
    previousWasShell = isShell;
  }
  return plans;
}

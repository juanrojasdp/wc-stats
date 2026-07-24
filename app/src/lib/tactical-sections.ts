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
 */
export type SectionDataState = "ready" | "empty";

export function sectionDataState(bundle: MatchBundle, id: SectionId): SectionDataState {
  const { events } = bundle;
  switch (id) {
    case "key-stats":
      return "ready";
    case "momentum":
      return bundle.momentum !== null ? "ready" : "empty";
    case "shot-maps":
      return events.shots !== null ? "ready" : "empty";
    case "pass-networks":
      return events.passNetworkNodes !== null && events.passNetworkEdges !== null ? "ready" : "empty";
    case "offers-to-receive":
    case "movement-to-receive":
      return events.receiving !== null ? "ready" : "empty";
    case "defensive-actions":
      return events.defensiveActions !== null ? "ready" : "empty";
    case "phases":
    case "pressing":
    case "set-plays":
      return "ready";
    case "goalkeeping":
      return bundle.goalkeeping !== null ? "ready" : "empty";
    default: {
      // Bundles are `as`-cast unvalidated JSON and hashes come from the URL, so
      // an out-of-union id can reach here at runtime. A silent fall-through
      // would render an absent section as present; name the value instead.
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
 * (ruled decision 4): the set both mockups lead with, minus `goals` (the Hero
 * scoreline already carries it). Nothing is deleted — the other thirteen are
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

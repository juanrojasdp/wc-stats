import type {
  MatchBundle,
  OfferMovementType,
  PlayerInPossession,
  PlayerOutOfPossession,
  PlayerPhysical,
  Position,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { resolveSide, type LogSide } from "@/viz/marker-model";
import { OFFER_MOVEMENT_TYPES } from "@/viz/receiving-model";

/*
 * DOMAIN G, WHOLE (Story 2.11b, FR-23 / SM-C2). The Expert Layer's per-player
 * tables show EVERY field the bundle carries — PlayerRecord's own schema
 * description is the acceptance criterion restated: "there is no reduced
 * variant".
 *
 * 51 leaves = 5 identity + 46 data; 50 RENDERED columns (46 data + team code,
 * shirt, name, position). `playerId` is the join key and the React key, never
 * a column.
 *
 * Pure and locale-free like every module under src/viz: dictionary KEYS and
 * raw numbers out, the component resolves them. A t() call here is an ESLint
 * error (the client-import seam), and the seam is exactly why this file is in
 * src/viz/ rather than a new top-level directory — a new one would silently
 * escape the bar, which is the gap Story 2.7 filed.
 *
 * COLUMN ORDER IS THE CONTRACT'S `required[]` ORDER, which is the source
 * page's print order. NEVER alphabetical, and never `Object.keys` on a
 * fixture: the fixture JSON serialises its properties alphabetically, so a
 * fixture-derived order would ship a table that looks fine and is not the
 * report's. The `Record<keyof Block, true>` pattern (from
 * receiving-model's OFFER_MOVEMENT_ORDER) is what makes a contract change a
 * COMPILE ERROR here rather than a silently missing column.
 */

/** The one in-possession property that is a nested block, not a scalar. */
const NESTED_OFFERS = "offersByMovementType";

type InPossessionField = Exclude<keyof PlayerInPossession, typeof NESTED_OFFERS>;
type OutOfPossessionField = keyof PlayerOutOfPossession;
type PhysicalField = keyof PlayerPhysical;

/**
 * Any of Domain G's 40 KEYED scalar fields. The three blocks share no property
 * name, which is what lets `expert.field.*` be one flat namespace — asserted in
 * expert-model.test.ts, because a future collision would silently collapse two
 * columns onto one label.
 */
export type ExpertField = InPossessionField | OutOfPossessionField | PhysicalField;

const IN_POSSESSION_ORDER: Record<keyof PlayerInPossession, true> = {
  passesAttempted: true,
  passesCompleted: true,
  passCompletion: true,
  switchesOfPlay: true,
  crossesAttempted: true,
  crossesCompleted: true,
  lineBreaksAttempted: true,
  lineBreaksCompleted: true,
  lineBreakCompletion: true,
  ballProgressions: true,
  takeOns: true,
  stepIns: true,
  attemptsAtGoal: true,
  goals: true,
  totalOffers: true,
  offersByMovementType: true,
  offersReceived: true,
};

const OUT_OF_POSSESSION_ORDER: Record<OutOfPossessionField, true> = {
  tacklesMade: true,
  tacklesWon: true,
  blocks: true,
  interceptions: true,
  pressingDirect: true,
  pressingIndirect: true,
  duelsWonAerial: true,
  duelsWonPhysical: true,
  possessionContestsWon: true,
  clearances: true,
  looseBallReceptions: true,
  pushingOn: true,
  pushingOnIntoPressing: true,
  possessionRegains: true,
  possessionInterrupted: true,
};

const PHYSICAL_ORDER: Record<PhysicalField, true> = {
  totalDistance: true,
  distanceZone1: true,
  distanceZone2: true,
  distanceZone3: true,
  distanceZone4: true,
  distanceZone5: true,
  highSpeedRuns: true,
  sprints: true,
  topSpeed: true,
};

/** The 16 in-possession SCALARS — the nested offers block is not one of them. */
export const IN_POSSESSION_FIELDS: readonly InPossessionField[] = Object.keys(
  IN_POSSESSION_ORDER
).filter((field) => field !== NESTED_OFFERS) as InPossessionField[];

export const OUT_OF_POSSESSION_FIELDS: readonly OutOfPossessionField[] = Object.keys(
  OUT_OF_POSSESSION_ORDER
) as OutOfPossessionField[];

export const PHYSICAL_FIELDS: readonly PhysicalField[] = Object.keys(
  PHYSICAL_ORDER
) as PhysicalField[];

/** All 40 keyed fields, for the i18n resolution sweep and the unit map. */
export const EXPERT_FIELDS: readonly ExpertField[] = [
  ...IN_POSSESSION_FIELDS,
  ...OUT_OF_POSSESSION_FIELDS,
  ...PHYSICAL_FIELDS,
];

/**
 * One in-possession column: a keyed scalar, or one of the six movement counts.
 *
 * THE INTERLEAVING IS THE POINT. `offersByMovementType` sits BETWEEN
 * `totalOffers` and `offersReceived` in the contract, so its six columns
 * belong in that slot — appending them to the tail would be a quiet
 * re-ordering of the source page. Modelling it here rather than in the
 * component is what makes it assertable in a harness with no jsdom.
 */
export type InPossessionColumn =
  | { kind: "field"; field: InPossessionField }
  | { kind: "movement"; code: OfferMovementType };

export const IN_POSSESSION_COLUMNS: readonly InPossessionColumn[] = (
  Object.keys(IN_POSSESSION_ORDER) as (keyof PlayerInPossession)[]
).flatMap<InPossessionColumn>((property) =>
  property === NESTED_OFFERS
    ? OFFER_MOVEMENT_TYPES.map((code) => ({ kind: "movement", code }))
    : [{ kind: "field", field: property as InPossessionField }]
);

/*
 * THE UNIT MAP EXISTS BECAUSE THE COMPILER CANNOT HELP HERE. `Count`,
 * `Percentage`, `Metres` and `KmPerHour` all erase to `number` in TypeScript,
 * so a formatter mix-up is invisible to tsc AND to every render — only the
 * schema's `x-decimals` carries the distinction. Driving the formatter off this
 * map, and asserting the map, is the substitute.
 *
 * The two percentages are STORED, never recomputed from attempted/completed
 * (AD-5): the App does not derive.
 */
export type FieldUnit = "count" | "percentage" | "metres" | "kmh";

const NON_COUNT_UNIT: Partial<Record<ExpertField, FieldUnit>> = {
  passCompletion: "percentage",
  lineBreakCompletion: "percentage",
  totalDistance: "metres",
  distanceZone1: "metres",
  distanceZone2: "metres",
  distanceZone3: "metres",
  distanceZone4: "metres",
  distanceZone5: "metres",
  topSpeed: "kmh",
};

export const FIELD_UNIT: Record<ExpertField, FieldUnit> = Object.fromEntries(
  EXPERT_FIELDS.map((field) => [field, NON_COUNT_UNIT[field] ?? "count"])
) as Record<ExpertField, FieldUnit>;

/**
 * Dictionary key for a column head — `expert.field.<field>` (AD-7).
 *
 * The `as DictionaryKey` cast is what the house convention (i18n.test.ts)
 * requires a full-domain RESOLUTION SWEEP for: DictionaryKey is a literal
 * union and a template-literal expression infers `string`, so the cast
 * silences the compiler and the sweep is the only thing between a typo'd key
 * and a runtime miss.
 */
export function expertFieldKey(field: ExpertField): DictionaryKey {
  return `expert.field.${field}` as DictionaryKey;
}

/*
 * The seven heads that are ABBREVIATED and therefore carry a full term in
 * `headTitle` (TableColumn's own contract: "Full term when headText is
 * abbreviated; null otherwise").
 *
 * The five zone bands are the PAGE'S OWN km/h ranges (Z1 0-7, Z2 7-15,
 * Z3 15-20, Z4 20-25, Z5 25+), carried as dictionary keys rather than prose so
 * they stay in the locale layer. `highSpeedRuns` carries "CARR. ALTA VEL." —
 * the abbreviation the glossary's high-speed-run definition already ships as
 * ruled copy — with the full term as its title.
 */
const TITLED_FIELDS: Partial<Record<ExpertField, true>> = {
  distanceZone1: true,
  distanceZone2: true,
  distanceZone3: true,
  distanceZone4: true,
  distanceZone5: true,
  highSpeedRuns: true,
  /*
   * REVIEW PATCH (2.11b code review). `topSpeed` now ships the RULED
   * abbreviation "Vel. máx." in Spanish — `enums.metric.topSpeed` already
   * carried it, and EXPERIENCE.md:139 names this exact term as the
   * table-abbreviation precedent — so it needs its full term here. This map is
   * keyed per FIELD, not per locale, so the EN entry restates its already-short
   * head; that is the cost of one shared `headTitle` gate across both
   * dictionaries, and it is cheaper than a per-locale title predicate.
   */
  topSpeed: true,
};

/** `expert.fieldTitle.<field>` for an abbreviated head, else null. */
export function expertFieldTitleKey(field: ExpertField): DictionaryKey | null {
  return TITLED_FIELDS[field] === true
    ? (`expert.fieldTitle.${field}` as DictionaryKey)
    : null;
}

/**
 * One player's row. `key` is `playerId` because `DataTable`'s
 * `Row extends { key: string }` needs a stable per-row identity for decision
 * 6's focus restore, and it is the React key besides.
 *
 * The three Domain G blocks are carried WHOLE rather than flattened: the
 * column factories read them per group, and flattening 46 fields onto the row
 * would invite exactly the alphabetical spread the field lists exist to
 * prevent.
 */
export interface ExpertRow {
  key: string;
  playerId: string;
  playerName: string;
  teamId: string;
  /** The metadata team CODE, uppercased — PlayerRecord carries no teamCode. */
  teamCode: string;
  shirtNumber: number;
  position: Position;
  inPossession: PlayerInPossession;
  outOfPossession: PlayerOutOfPossession;
  physical: PlayerPhysical;
}

/**
 * Every player in the bundle, ARTIFACT ORDER VERBATIM — home team first, then
 * shirt number, which is `PlayerRecords`' own schema description. AD-5
 * reserves canonical order to the artifact; the caption states this order and
 * the sort contract's "no active column" state restores it.
 *
 * `players: null` yields NO ROWS rather than throwing: that is the report-does-
 * not-carry-Domain-G state, which the shell answers with an empty-state panel.
 * `[]` is a third state again — ready, with zero rows.
 *
 * A stray `teamId` THROWS naming the id (resolveSide). The component builds
 * these EAGERLY, so that lands on load rather than on expand.
 */
export function buildExpertRows(bundle: MatchBundle): ExpertRow[] {
  const players = bundle.players;
  if (players === null) {
    return [];
  }
  const home: LogSide = {
    teamId: bundle.metadata.homeTeam.teamId,
    teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
  };
  const away: LogSide = {
    teamId: bundle.metadata.awayTeam.teamId,
    teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
  };
  return players.map((record) => ({
    key: record.playerId,
    playerId: record.playerId,
    playerName: record.playerName,
    teamId: record.teamId,
    teamCode: resolveSide(record.teamId, home, away, "expert-model").teamCode,
    shirtNumber: record.shirtNumber,
    position: record.position,
    inPossession: record.inPossession,
    outOfPossession: record.outOfPossession,
    physical: record.physical,
  }));
}

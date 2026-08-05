import type {
  AerialControl,
  AerialInterventionType,
  CompletionCounts,
  CrossDeliveryType,
  CrossDeliveryTypeCounts,
  DistributionType,
  FeetDistributionTechnique,
  FeetTechniqueCounts,
  GoalPrevention,
  GoalkeeperDistribution,
  TeamGoalkeeping,
  Goalkeeping,
  HandsDistributionTechnique,
  HandsTechniqueCounts,
  InterventionBodyType,
  InterventionBodyTypeCounts,
  InterventionType,
  InterventionTypeCounts,
  ThrowDistributionTechnique,
  ThrowTechniqueCounts,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { CROSS_DELIVERY_TYPES, crossDeliveryKey } from "@/viz/cross-map-model";
import { resolveSide, type LogSide } from "@/viz/marker-model";

/*
 * Domain E -> the #goalkeeping surface (Story 2.10, Tasks 4 and 5).
 *
 * THE EPIC'S "each goalkeeper's ..." CLAUSE IS OVERTURNED, and by more than
 * deferred-work.md's AD-14 (d) notice recorded. Two measured facts drive this
 * whole module (both ruled by Juan at story creation):
 *
 * (a) THE SOURCE IS PER TEAM, NOT PER GOALKEEPER. Story 1.9 verified over 104
 *     reports / 936 goalkeeping pages that all four page families are titled
 *     {team}, that NO GOALKEEPER NAME APPEARS ON ANY OF THEM, and that 7 of 208
 *     team-innings used two keepers while still printing ONE team-level block
 *     each. So this module groups by teamId and the keeper names are CONTEXT,
 *     never the keying identity (ruled decision 2).
 *
 * (b) FIVE CONTRACT-REQUIRED SUB-BLOCKS ARE null ON 208/208 TEAM-INNINGS —
 *     distribution.{feet,hands,throw}Techniques, goalPrevention.byBodyType and
 *     aerialControl.crossesFacedCompleted. They are raster donut-slice labels
 *     and an unvalidatable marker colour (Story 1.9, AD-14 (c)). THE FIXTURES
 *     POPULATE ALL FIVE, because data/fixtures/README.md lists "Domain E
 *     goalkeeping" under Synthetic "in full, though the attempts faced and goals
 *     conceded are real". They are therefore PRESENCE-GATED (ruled decision 3),
 *     not assumed — see `CorpusNullableGoalkeeperRecord` below.
 *
 * Pure and locale-free like every module under src/viz.
 */

/* --------------------------- The widened view ----------------------------- */

/** Widen a chosen set of an interface's properties to also admit `null`. */
type Widen<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

/**
 * The truthful view of a `GoalkeeperRecord` (ruled decision 3).
 *
 * THE FIVE FIELDS ARE DECLARED NON-NULLABLE IN THE GENERATED TYPES, so a bare
 * `x != null` does not type-check cleanly and every consumer would otherwise
 * reach for its own cast. This is the ONE place that decision lives.
 *
 * MEASURED AT STORY CREATION, DIRECTLY OVER THE 104 STAGED EXTRACTION RECORDS
 * (208 team-innings). Each of the five is `null` on 208/208:
 *
 *   distribution.feetTechniques        null 208/208   (fixtures: 6/6 populated)
 *   distribution.handsTechniques       null 208/208   (fixtures: 6/6 populated)
 *   distribution.throwTechniques       null 208/208   (fixtures: 6/6 populated)
 *   goalPrevention.byBodyType          null 208/208   (fixtures: 6/6 populated)
 *   aerialControl.crossesFacedCompleted null 208/208  (fixtures: 6/6 populated)
 *
 * THE FIVE DO NOT SIT ON `GoalkeeperRecord` — they sit on three nested
 * interfaces, so the view is three widened types composed into one. A flat
 * interface cannot express it.
 *
 * `GoalkeeperRecord` is assignable to this (it only widens), so a plain `as`
 * suffices — NO `as unknown` double cast. Bundles reach the App as `as`-cast
 * unvalidated JSON, so the widened view is the TRUTHFUL one; this is the same
 * legitimacy Story 2.9's Task 3.7 established.
 *
 * SUCCESSOR CHANGE-SET, BY NAME: when Story 1.16 rules on Domain E emission,
 * either the schema marks these five nullable (and this alias collapses to a
 * re-export) or the extraction starts filling them (and the gates below go
 * permanently open). NEVER CS-1, which is already scoped and touches none of
 * this. Filed to deferred-work.md by Task 9.1.
 */
export type CorpusNullableGoalkeeperRecord = TeamGoalkeeping;

/**
 * THE SINGLE ENTRY CAST. Every consumer in this module reads the widened view;
 * nothing downstream casts again. "Do not scatter casts through the components"
 * is ruled decision 3's own instruction, and this function is what makes it
 * possible to obey.
 */
function widen(record: TeamGoalkeeping): CorpusNullableGoalkeeperRecord {
  return record;
}

/**
 * The keepers who kept goal for this team, joined.
 *
 * CS-2 (contract decision 18) made the block PER TEAM, because the source is: all four
 * goalkeeping page families are titled `{team}`, no goalkeeper name appears on any of
 * them, and 7 of 208 corpus team-innings used two keepers while still printing ONE
 * team-level block each. So identity moved off the record and onto `goalkeepers`, and both
 * names are carried as CONTEXT — AD-5 forbids splitting the team's figures between them,
 * which is exactly what the old per-keeper shape invited.
 */
function keeperNamesOf(record: CorpusNullableGoalkeeperRecord): string {
  return record.goalkeepers.map((keeper) => keeper.playerName).join(" / ");
}

function keeperIds(record: CorpusNullableGoalkeeperRecord): string {
  return record.goalkeepers.map((keeper) => keeper.playerId).join("-");
}

/* ------------------------------ Frozen enums ------------------------------ */

/*
 * Every list is derived from a `Record` keyed by the generated union, never a
 * bare array — receiving-model's review patch: an array stays assignable
 * however many members the union gains, and the i18n exhaustiveness suite
 * compares locale keys against these very lists.
 */

const DISTRIBUTION_TYPE_ORDER: Record<DistributionType, true> = {
  feet: true,
  hands: true,
  throw: true,
};

export const DISTRIBUTION_TYPES: readonly DistributionType[] = Object.keys(
  DISTRIBUTION_TYPE_ORDER
) as DistributionType[];

export function distributionTypeKey(code: DistributionType): DictionaryKey {
  return `enums.distributionType.${code}` as DictionaryKey;
}

const FEET_TECHNIQUE_ORDER: Record<FeetDistributionTechnique, true> = {
  "play-onto": true,
  "play-into": true,
  "play-around": true,
  "play-through": true,
  "play-beyond": true,
  other: true,
};

export const FEET_TECHNIQUES: readonly FeetDistributionTechnique[] = Object.keys(
  FEET_TECHNIQUE_ORDER
) as FeetDistributionTechnique[];

export const FEET_TECHNIQUE_PROPERTY: Record<
  FeetDistributionTechnique,
  keyof FeetTechniqueCounts
> = {
  "play-onto": "playOnto",
  "play-into": "playInto",
  "play-around": "playAround",
  "play-through": "playThrough",
  "play-beyond": "playBeyond",
  other: "other",
};

export function feetTechniqueKey(code: FeetDistributionTechnique): DictionaryKey {
  return `enums.feetTechnique.${code}` as DictionaryKey;
}

const HANDS_TECHNIQUE_ORDER: Record<HandsDistributionTechnique, true> = {
  "side-kick": true,
  "from-hands": true,
  "drop-kick": true,
};

export const HANDS_TECHNIQUES: readonly HandsDistributionTechnique[] = Object.keys(
  HANDS_TECHNIQUE_ORDER
) as HandsDistributionTechnique[];

export const HANDS_TECHNIQUE_PROPERTY: Record<
  HandsDistributionTechnique,
  keyof HandsTechniqueCounts
> = {
  "side-kick": "sideKick",
  "from-hands": "fromHands",
  "drop-kick": "dropKick",
};

export function handsTechniqueKey(code: HandsDistributionTechnique): DictionaryKey {
  return `enums.handsTechnique.${code}` as DictionaryKey;
}

const THROW_TECHNIQUE_ORDER: Record<ThrowDistributionTechnique, true> = {
  "over-arm": true,
  "under-arm": true,
  "side-arm": true,
  chest: true,
};

export const THROW_TECHNIQUES: readonly ThrowDistributionTechnique[] = Object.keys(
  THROW_TECHNIQUE_ORDER
) as ThrowDistributionTechnique[];

export const THROW_TECHNIQUE_PROPERTY: Record<
  ThrowDistributionTechnique,
  keyof ThrowTechniqueCounts
> = {
  "over-arm": "overArm",
  "under-arm": "underArm",
  "side-arm": "sideArm",
  chest: "chest",
};

export function throwTechniqueKey(code: ThrowDistributionTechnique): DictionaryKey {
  return `enums.throwTechnique.${code}` as DictionaryKey;
}

const INTERVENTION_ORDER: Record<InterventionType, true> = {
  "save-and-retain": true,
  "save-and-deflect": true,
  "deflect-and-retain": true,
  "save-attempt": true,
  "no-save-attempt": true,
};

export const INTERVENTION_TYPES: readonly InterventionType[] = Object.keys(
  INTERVENTION_ORDER
) as InterventionType[];

export const INTERVENTION_PROPERTY: Record<InterventionType, keyof InterventionTypeCounts> = {
  "save-and-retain": "saveAndRetain",
  "save-and-deflect": "saveAndDeflect",
  "deflect-and-retain": "deflectAndRetain",
  "save-attempt": "saveAttempt",
  "no-save-attempt": "noSaveAttempt",
};

export function interventionTypeKey(code: InterventionType): DictionaryKey {
  return `enums.interventionType.${code}` as DictionaryKey;
}

const INTERVENTION_BODY_ORDER: Record<InterventionBodyType, true> = {
  head: true,
  hands: true,
  "upper-body": true,
  "lower-body": true,
  feet: true,
};

export const INTERVENTION_BODY_TYPES: readonly InterventionBodyType[] = Object.keys(
  INTERVENTION_BODY_ORDER
) as InterventionBodyType[];

export const INTERVENTION_BODY_PROPERTY: Record<
  InterventionBodyType,
  keyof InterventionBodyTypeCounts
> = {
  head: "head",
  hands: "hands",
  "upper-body": "upperBody",
  "lower-body": "lowerBody",
  feet: "feet",
};

export function interventionBodyTypeKey(code: InterventionBodyType): DictionaryKey {
  return `enums.interventionBodyType.${code}` as DictionaryKey;
}

const AERIAL_ORDER: Record<AerialInterventionType, true> = {
  punch: true,
  claim: true,
  "tipped-palmed": true,
};

export const AERIAL_TYPES: readonly AerialInterventionType[] = Object.keys(
  AERIAL_ORDER
) as AerialInterventionType[];

export const AERIAL_PROPERTY: Record<
  AerialInterventionType,
  "punches" | "claims" | "tippedPalmed"
> = {
  punch: "punches",
  claim: "claims",
  "tipped-palmed": "tippedPalmed",
};

export function aerialTypeKey(code: AerialInterventionType): DictionaryKey {
  return `enums.aerialType.${code}` as DictionaryKey;
}

/*
 * CrossDeliveryType (6) already has `enums.crossDelivery.*` from Story 2.7 and
 * is REUSED for `aerialControl.deliveryTypesFaced` — a second namespace for the
 * same enum would be two sources of truth for one vocabulary, and 2.7's list is
 * already consumed by the i18n exhaustiveness suite.
 */
export { CROSS_DELIVERY_TYPES, crossDeliveryKey };

const CROSS_DELIVERY_PROPERTY: Record<CrossDeliveryType, keyof CrossDeliveryTypeCounts> = {
  inswing: "inswing",
  outswing: "outswing",
  driven: "driven",
  lofted: "lofted",
  cutback: "cutback",
  "push-cross": "pushCross",
};

/* --------------------------- Presence predicates -------------------------- */

/*
 * ONE PREDICATE PER GATED PANEL (ruled decision 3), each narrowing the type so
 * the consuming component gets a non-null value without a cast of its own.
 *
 * A panel renders ONLY when its data is non-null; when absent it is OMITTED
 * ENTIRELY, never rendered as a row of em dashes.
 */

export function hasFeetTechniques(
  distribution: CorpusNullableGoalkeeperRecord["distribution"]
): distribution is CorpusNullableGoalkeeperRecord["distribution"] & {
  feetTechniques: FeetTechniqueCounts;
} {
  return distribution.feetTechniques !== null && distribution.feetTechniques !== undefined;
}

export function hasHandsTechniques(
  distribution: CorpusNullableGoalkeeperRecord["distribution"]
): distribution is CorpusNullableGoalkeeperRecord["distribution"] & {
  handsTechniques: HandsTechniqueCounts;
} {
  return distribution.handsTechniques !== null && distribution.handsTechniques !== undefined;
}

export function hasThrowTechniques(
  distribution: CorpusNullableGoalkeeperRecord["distribution"]
): distribution is CorpusNullableGoalkeeperRecord["distribution"] & {
  throwTechniques: ThrowTechniqueCounts;
} {
  return distribution.throwTechniques !== null && distribution.throwTechniques !== undefined;
}

export function hasBodyTypes(
  goalPrevention: CorpusNullableGoalkeeperRecord["goalPrevention"]
): goalPrevention is CorpusNullableGoalkeeperRecord["goalPrevention"] & {
  byBodyType: InterventionBodyTypeCounts;
} {
  return goalPrevention.byBodyType !== null && goalPrevention.byBodyType !== undefined;
}

export function hasCrossesFacedCompleted(
  aerialControl: CorpusNullableGoalkeeperRecord["aerialControl"]
): aerialControl is CorpusNullableGoalkeeperRecord["aerialControl"] & {
  crossesFacedCompleted: number;
} {
  return (
    aerialControl.crossesFacedCompleted !== null &&
    aerialControl.crossesFacedCompleted !== undefined
  );
}

/* ------------------------------- The grouping ------------------------------ */

/** One value row: a label key and a number. Raw — the component formats. */
export interface CountRow {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  count: number;
}

/** A complete/incomplete/total triple, all three read verbatim (never derived). */
export interface CompletionRow {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  complete: number;
  incomplete: number;
  total: number;
}

/** A gated panel: absent, or present with its rows. */
export interface GatedRows {
  present: boolean;
  rows: CountRow[];
}

const ABSENT: GatedRows = { present: false, rows: [] };

export interface InvolvementPoint {
  /**
   * THE X AXIS. Unique and contiguous 0..n-1 — see `involvementSeries`.
   */
  index: number;
  /** A LABEL read off the sample. NEVER the key, never the domain. */
  minute: number;
  involvements: number;
}

export interface DistributionSummary {
  /** total / feet / hands / throw, all four read verbatim. */
  families: CompletionRow[];
  lineBreaks: number;
  feetTechniques: GatedRows;
  handsTechniques: GatedRows;
  throwTechniques: GatedRows;
}

export interface GoalPreventionSummary {
  attemptsFaced: number;
  /** Read VERBATIM from the contract. NEVER re-derived from the counts. */
  savePercentage: number;
  totalInterventions: number;
  /** Sums to `attemptsFaced` — its OWN denominator (ruled decision 13). */
  byInterventionType: CountRow[];
  interventionDenominator: number;
  /** Sums to `totalInterventions` — a DIFFERENT denominator. GATED. */
  byBodyType: GatedRows;
  bodyTypeDenominator: number;
}

export interface AerialSummary {
  totalInterventions: number;
  types: CompletionRow[];
  crossesFacedAttempted: number;
  /** GATED: null on 208/208 corpus team-innings. */
  crossesFacedCompleted: number | null;
  deliveryTypes: CountRow[];
  /** `deliveryTypesFaced.total`, read verbatim — never summed from the six. */
  deliveryTypesTotal: number;
}

/** One goalkeeper's four summaries. */
export interface GoalkeeperBlock {
  key: string;
  playerId: string;
  playerName: string;
  /** Printed VERBATIM as the headline (ruled decision 14). */
  totalInvolvements: number;
  involvement: InvolvementPoint[];
  distribution: DistributionSummary;
  goalPrevention: GoalPreventionSummary;
  aerial: AerialSummary;
  /**
   * ANY of this keeper's five gated panels is closed. Ruled decision 3: when a
   * gate is closed the block renders ONE ruled sentence, once, naming why —
   * silent absence at panel granularity is the one thing FR-22 forbids.
   */
  anyGateClosed: boolean;
}

/** One TEAM's block — the unit this surface renders (ruled decision 2). */
export interface GoalkeepingTeamBlock {
  key: string;
  teamId: string;
  teamCode: string;
  /** The keeper name(s) for this team, as CONTEXT. Never the keying identity. */
  keeperNames: string[];
  /**
   * 0 when the report carries no record for this team.
   *
   * CARRIED SEPARATELY FROM `records.length === 0` ON PURPOSE (Task 5.7): the
   * component must be able to tell "NO RECORD FOR THIS TEAM" from "this keeper
   * did nothing", and rendering the first as zeros is a POSITIVE CLAIM that the
   * report recorded zero. That is the exact defect Story 2.9's review patched:
   * "'NO ROWS FOR THIS TEAM' IS NOT 'THIS TEAM MADE ZERO OFFERS'".
   */
  recordCount: number;
  records: GoalkeeperBlock[];
  anyGateClosed: boolean;
}

export interface GoalkeepingGrouping {
  home: GoalkeepingTeamBlock;
  away: GoalkeepingTeamBlock;
  /** `goalkeeping` was a present-but-empty array — `ready`, never `empty`. */
  isEmptyArray: boolean;
}

/**
 * Group the records BY TEAM, home first (ruled decision 2).
 *
 * ORDER COMES FROM `metadata.homeTeam` / `awayTeam`, NEVER FROM ARRAY ORDER.
 * `resolveSide` is the one place a stray teamId fails loud — a silent drop
 * would leave a team's block rendering as an absence when the data is right
 * there. Called EAGERLY by the section (never inside a lazily-mounted
 * disclosure), so a bad id names itself on load.
 *
 * THE TWO-KEEPER CASE IS REAL AND HANDLED: 7 of 208 corpus team-innings used
 * two keepers (M21 home, M41 away, M53 away, M62 away, M66 home, M88 home, M98
 * away). Both records are kept, both names go in the context label, and NOTHING
 * IS SUMMED ACROSS THEM — AD-5 forbids the App summing, and adding two keepers'
 * save percentages would be arithmetic nonsense. No fixture carries this shape,
 * so Task 5.8 constructs one.
 *
 * `null` never reaches here (`sectionDataState` gates on `!== null`); `[]`
 * does, and is `ready` by the schema's own words — "An empty array means the
 * pages were present and listed no goalkeeper; null means there was nothing to
 * read. The App renders those two states differently, so they must never be
 * collapsed." The component owns the zero-content view.
 */
export function goalkeepingByTeam(
  goalkeeping: Goalkeeping,
  home: LogSide,
  away: LogSide
): GoalkeepingGrouping {
  const buckets: Record<"home" | "away", TeamGoalkeeping[]> = { home: [], away: [] };
  const records = goalkeeping ?? [];
  for (const record of records) {
    const side = resolveSide(record.teamId, home, away, "goalkeeping");
    buckets[side.teamId === home.teamId ? "home" : "away"].push(record);
  }
  return {
    home: teamBlock(buckets.home, home),
    away: teamBlock(buckets.away, away),
    isEmptyArray: goalkeeping !== null && records.length === 0,
  };
}

function teamBlock(records: readonly TeamGoalkeeping[], side: LogSide): GoalkeepingTeamBlock {
  const blocks = records.map((record, index) => keeperBlock(widen(record), side, index));
  return {
    key: `goalkeeping-${side.teamId}`,
    teamId: side.teamId,
    teamCode: side.teamCode,
    keeperNames: blocks.map((block) => block.playerName),
    recordCount: blocks.length,
    records: blocks,
    anyGateClosed: blocks.some((block) => block.anyGateClosed),
  };
}

function keeperBlock(
  record: CorpusNullableGoalkeeperRecord,
  side: LogSide,
  index: number
): GoalkeeperBlock {
  const distribution = distributionRows(record);
  const goalPrevention = goalPreventionRows(record);
  const aerial = aerialRows(record);
  return {
    /*
     * Keyed on teamId + RECORD INDEX + playerId + name.
     *
     * THE INDEX IS LOAD-BEARING AND IT IS NOT DECORATION. `playerId` and
     * `playerName` are `required` but UNFULFILLABLE FROM THE SOURCE (Story 1.9,
     * AD-14 (a)) — no goalkeeper name appears on any of the 936 goalkeeping
     * pages — so whatever Story 1.16 emits for them may well be one placeholder
     * per team. Two keepers are real on 7 of 208 corpus team-innings, and
     * without the index those two records would collide on one React key: React
     * drops the duplicate, so the second keeper's panel AND its table rows
     * silently vanish — defeating ruled decision 2, which exists precisely to
     * render both and sum neither. No fixture can catch this (all six carry one
     * keeper), so the constructed two-keeper test is the only guard.
     *
     * `playerId` still contributes, but it is a DISAMBIGUATOR here and never an
     * identity this surface keys on.
     */
    key: `keeper-${side.teamId}-${index}-${keeperIds(record)}`,
    playerId: keeperIds(record),
    playerName: keeperNamesOf(record),
    totalInvolvements: record.totalInvolvements,
    involvement: involvementSeries(record),
    distribution,
    goalPrevention,
    aerial,
    /*
     * SCOPED TO THE FOUR GATES THAT ACTUALLY REMOVE A PANEL.
     *
     * `crossesFacedCompleted` is deliberately NOT in this list even though it is
     * one of decision 3's five corpus-null fields. It hides no panel: when it is
     * null the aerial block swaps to the `crossesFacedAlone` label, which states
     * the absence IN WORDS at the point of use, and drops a single value. The
     * gate sentence this flag drives says "esos paneles no se muestran" — so
     * including the crosses field would let a record whose ONLY null is that one
     * announce hidden panels while every panel is on screen. All five are null
     * together on corpus data and present together on the fixtures, so the
     * mismatch is a mixed-record case only; the flag is still scoped, because a
     * disclosure sentence that can be false is worse than no sentence.
     */
    anyGateClosed:
      !distribution.feetTechniques.present ||
      !distribution.handsTechniques.present ||
      !distribution.throwTechniques.present ||
      !goalPrevention.byBodyType.present,
  };
}

/* ----------------------------- The involvement ---------------------------- */

/**
 * The involvement timeline as INDEX-KEYED rows (ruled decision 7).
 *
 * THE X AXIS IS THE SAMPLE INDEX. The minute is a LABEL read off the sample —
 * never the key, never the domain, and NEVER ASSUMED UNIQUE.
 *
 * `GoalkeeperInvolvementSample` is `{minute: Minute, involvements: Count}` — a
 * BARE `Minute`, 0-120, WITH NO STOPPAGE FIELD. The corpus draws 95-145 slots
 * per team-inning (min 95, median 102, max 145) and 2,506 of 21,764 corpus
 * slots fall in stoppage time, so on real data MANY SAMPLES COLLIDE ONTO ONE
 * MINUTE. That is exactly the non-uniqueness Story 1.8's schemaVersion 2 bump
 * fixed for `MomentumSample.at` by making it a `MinuteStamp`, and exactly what
 * invalidated Story 2.6's original slider AC.
 *
 * THE FIXTURES HIDE IT COMPLETELY: m001/m002 carry 19 samples at minutes
 * 0,5,10..90 and m074 carries 25 at 0,5..120 — evenly spaced, unique, and
 * summing EXACTLY to totalInvolvements. Build to this docblock, not to what is
 * on screen.
 *
 * Filed to the successor change-set as a BLOCKER for Story 2.19's real-data
 * cutover (Task 9.4): `minute` needs to become a `MinuteStamp`. Because this
 * story already indexes by sample, no App change is owed when that lands.
 */
export function involvementSeries(
  record: CorpusNullableGoalkeeperRecord
): InvolvementPoint[] {
  const timeline = record.involvementTimeline;
  if (!Array.isArray(timeline)) {
    return [];
  }
  return timeline.map((sample, index) => ({
    index,
    minute: sample.at.minute,
    involvements: sample.involvements,
  }));
}

/**
 * Thinned x-axis tick INDICES, first and last always present (decision 9).
 *
 * THE SHIPPED TICK MODEL IS NOT DIRECTLY IMPLEMENTABLE HERE, and the interim
 * behaviour is ruled rather than left to the implementer.
 * `momentumTickIndices` emits a tick only at a row whose minute is a multiple
 * of the step AND IS NOT A STOPPAGE SLOT, with a `seen` set added by review
 * patch "so a later row carrying the SAME minute cannot emit a second tick at
 * the same clock label". Both mechanisms read `row.at.stoppageMinute`, WHICH
 * THIS CONTRACT DOES NOT CARRY.
 *
 * So the surviving half is implemented: DEDUPE TICK MINUTES BY VALUE, FIRST
 * OCCURRENCE WINS — the half that stops a repeated axis label. The axis says
 * what it is, once, in its own <Label> and in the figureSummary (Task 8.4's
 * minted sentence): it plots the report's slots in order, and a stoppage slot
 * carries the preceding regulation minute.
 */
export function involvementTicks(points: readonly InvolvementPoint[]): number[] {
  if (points.length === 0) {
    return [];
  }
  const lastIndex = points.length - 1;
  if (points.length <= MAX_INVOLVEMENT_TICKS) {
    return dedupeByMinute(points, points.map((point) => point.index));
  }
  const stride = Math.ceil(lastIndex / (MAX_INVOLVEMENT_TICKS - 1));
  const candidates: number[] = [];
  for (let index = 0; index <= lastIndex; index += stride) {
    candidates.push(index);
  }
  // FIRST AND LAST ARE ALWAYS PRESENT: the series' ends anchor the axis, and a
  // stride that does not divide evenly would otherwise drop the last one.
  if (candidates[candidates.length - 1] !== lastIndex) {
    candidates.push(lastIndex);
  }
  return dedupeByMinute(points, candidates);
}

/** At most this many x ticks: 320 px / ~40 px per "45+" label. */
const MAX_INVOLVEMENT_TICKS = 7;

/**
 * Drop any candidate whose MINUTE LABEL has already been emitted, first
 * occurrence winning — except the last index, which always survives so the axis
 * keeps its right anchor.
 */
function dedupeByMinute(points: readonly InvolvementPoint[], candidates: number[]): number[] {
  const seen = new Set<number>();
  const ticks: number[] = [];
  const lastIndex = points.length - 1;
  for (const index of candidates) {
    const point = points[index];
    if (point === undefined) {
      continue;
    }
    if (seen.has(point.minute) && index !== lastIndex) {
      continue;
    }
    seen.add(point.minute);
    ticks.push(index);
  }
  return ticks;
}

/**
 * Explicit, always-includes-ZERO ticks for a `[0, niceMax]` COUNT axis
 * (decision 9). Same forcing reason as `percentTicks`: recharts' generator
 * omits the zero tick on an un-nice domain, and this story is the one the 2.6
 * finding was filed against by name.
 */
export function countTicks(max: number): number[] {
  const axisMax = countAxisMax(max);
  const step = countStep(max);
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== axisMax) {
    ticks.push(axisMax);
  }
  return ticks;
}

function countStep(max: number): number {
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  const target = safeMax / 4;
  const exponent = Math.floor(Math.log10(target));
  const base = Math.pow(10, exponent);
  let step = base * 10;
  for (const multiple of [1, 2, 5, 10]) {
    if (base * multiple >= target) {
      step = base * multiple;
      break;
    }
  }
  // Integer steps: involvements are counts, and a 2.5 tick is not a count.
  return Math.max(1, Math.round(step));
}

/** The count axis's nice max. Floored at the step so `[0, 0]` is impossible. */
export function countAxisMax(max: number): number {
  const step = countStep(max);
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  return Math.max(step, Math.ceil(safeMax / step) * step);
}

/** The tallest bar in a series. `Math.max(...[])` is -Infinity — guarded. */
export function involvementPeak(points: readonly InvolvementPoint[]): number {
  let peak = 0;
  for (const point of points) {
    peak = Math.max(peak, point.involvements);
  }
  return peak;
}

/**
 * The InvolvementChart's height class (ruled decision 12).
 *
 * Exported from THIS pure module rather than from TacticalCharts, because a
 * VALUE import from the chart module re-links recharts onto the critical path
 * and defeats the code-split (MomentumSection.tsx:6-13). The section's skeleton
 * fallback uses this same constant, so fallback and chart cannot drift.
 */
export const INVOLVEMENT_CHART_HEIGHT_CLASS = "h-[132px] md:h-[180px]";

/* ------------------------------ The summaries ------------------------------ */

function completionRow(
  key: string,
  code: string,
  labelKey: DictionaryKey,
  counts: CompletionCounts
): CompletionRow {
  // All three values are READ, never derived: the contract stores the total
  // separately "so a report whose printed total disagrees with its parts becomes
  // a visible deviation rather than a silent correction".
  return {
    key,
    code,
    labelKey,
    complete: counts.complete,
    incomplete: counts.incomplete,
    total: counts.total,
  };
}

/**
 * The distribution summary (Task 5.3): the four contracted families, the line
 * breaks, and the three GATED technique breakdowns.
 */
export function distributionRows(
  record: CorpusNullableGoalkeeperRecord
): DistributionSummary {
  const distribution = record.distribution;
  const families: CompletionRow[] = [
    completionRow("dist-total", "total", "viz.goalkeeping.distributionTotal", distribution.total),
    ...DISTRIBUTION_TYPES.map((code) =>
      completionRow(`dist-${code}`, code, distributionTypeKey(code), distribution[code])
    ),
  ];
  return {
    families,
    lineBreaks: distribution.lineBreaks,
    feetTechniques: hasFeetTechniques(distribution)
      ? {
          present: true,
          rows: FEET_TECHNIQUES.map((code) => ({
            key: `feet-${code}`,
            code,
            labelKey: feetTechniqueKey(code),
            count: distribution.feetTechniques[FEET_TECHNIQUE_PROPERTY[code]],
          })),
        }
      : ABSENT,
    handsTechniques: hasHandsTechniques(distribution)
      ? {
          present: true,
          rows: HANDS_TECHNIQUES.map((code) => ({
            key: `hands-${code}`,
            code,
            labelKey: handsTechniqueKey(code),
            count: distribution.handsTechniques[HANDS_TECHNIQUE_PROPERTY[code]],
          })),
        }
      : ABSENT,
    throwTechniques: hasThrowTechniques(distribution)
      ? {
          present: true,
          rows: THROW_TECHNIQUES.map((code) => ({
            key: `throw-${code}`,
            code,
            labelKey: throwTechniqueKey(code),
            count: distribution.throwTechniques[THROW_TECHNIQUE_PROPERTY[code]],
          })),
        }
      : ABSENT,
  };
}

/**
 * The goal-prevention summary (Task 5.4).
 *
 * RULED DECISION 13 — THE TWO BREAKDOWNS HAVE DIFFERENT DENOMINATORS, and the
 * contract says so verbatim: "byInterventionType sums to attemptsFaced (every
 * attempt faced is categorised, including no-save-attempt), while byBodyType
 * sums to totalInterventions (only attempts the keeper actually intervened on
 * have a body part) ... An App rendering the two panels side by side must label
 * them with their own totals rather than implying a shared one."
 *
 * Each denominator is carried AS DATA, so the component cannot imply a shared
 * one by accident.
 *
 * `savePercentage` is a CONTRACTED FIELD and is read verbatim. It is NEVER
 * re-derived — not from attemptsFaced, not from the intervention counts.
 */
export function goalPreventionRows(
  record: CorpusNullableGoalkeeperRecord
): GoalPreventionSummary {
  const prevention = record.goalPrevention;
  return {
    attemptsFaced: prevention.attemptsFaced,
    savePercentage: prevention.savePercentage,
    totalInterventions: prevention.totalInterventions,
    byInterventionType: INTERVENTION_TYPES.map((code) => ({
      key: `intervention-${code}`,
      code,
      labelKey: interventionTypeKey(code),
      count: prevention.byInterventionType[INTERVENTION_PROPERTY[code]],
    })),
    interventionDenominator: prevention.attemptsFaced,
    byBodyType: hasBodyTypes(prevention)
      ? {
          present: true,
          rows: INTERVENTION_BODY_TYPES.map((code) => ({
            key: `body-${code}`,
            code,
            labelKey: interventionBodyTypeKey(code),
            count: prevention.byBodyType[INTERVENTION_BODY_PROPERTY[code]],
          })),
        }
      : ABSENT,
    bodyTypeDenominator: prevention.totalInterventions,
  };
}

/**
 * The aerial-control summary (Task 5.5).
 *
 * `crossesFacedAttempted` RENDERS ALONE once its counterpart is gated away, and
 * that state has its OWN label key (ruled decision 3): a value labelled as the
 * *attempted half of a pair* with no counterpart reads as a MISSING number
 * rather than an ABSENT one.
 */
export function aerialRows(record: CorpusNullableGoalkeeperRecord): AerialSummary {
  const aerial = record.aerialControl;
  return {
    totalInterventions: aerial.totalInterventions,
    types: AERIAL_TYPES.map((code) =>
      completionRow(`aerial-${code}`, code, aerialTypeKey(code), aerial[AERIAL_PROPERTY[code]])
    ),
    crossesFacedAttempted: aerial.crossesFacedAttempted,
    crossesFacedCompleted: hasCrossesFacedCompleted(aerial) ? aerial.crossesFacedCompleted : null,
    deliveryTypes: CROSS_DELIVERY_TYPES.map((code) => ({
      key: `cross-${code}`,
      code,
      labelKey: crossDeliveryKey(code),
      count: aerial.deliveryTypesFaced[CROSS_DELIVERY_PROPERTY[code]],
    })),
    // Read verbatim — `CrossDeliveryTypeCounts` stores its own total, and AD-5
    // forbids the App adding the six up instead.
    deliveryTypesTotal: aerial.deliveryTypesFaced.total,
  };
}

/* ------------------------------- Table rows -------------------------------- */

/**
 * Decision 19's rows, one caption per table.
 *
 * DECISION 14'S TWO-TABLE DISCLOSURE, implemented rather than described. A
 * single table reading `Total: 47` above a column of per-slot counts that sum
 * to 44 is the single most likely place a reader adds a column, and the
 * mismatch then reads as the app dropping data.
 *
 * Measured over 208 team-innings: `totalInvolvements − Σ(involvementTimeline)`
 * runs 0..5, is NEVER negative, and is exactly 0 on only 59 of 208. Story 1.9
 * ships the BOUND, not the equality, and the ledger is explicit: "Do not resolve
 * it by making the numbers agree." THE FIXTURES MAKE IT LOOK EXACT — all six
 * fixture keepers sum precisely to their total.
 *
 * So: `involvementSummaryRows` carries what the report PRINTS, and
 * `involvementTimelineRows` carries what it PLOTS, each with its own caption.
 * NOTHING HERE SUMS THE TIMELINE (AD-5 forbids it independently).
 */

export interface InvolvementSummaryRow {
  key: string;
  teamCode: string;
  playerName: string;
  /** Verbatim (ruled decision 14). */
  totalInvolvements: number;
  /** How many slots the report plotted — a COUNT OF ROWS, not a sum of values. */
  sampleCount: number;
}

export function involvementSummaryRows(
  team: GoalkeepingTeamBlock
): InvolvementSummaryRow[] {
  return team.records.map((record) => ({
    key: `${record.key}-summary`,
    teamCode: team.teamCode,
    playerName: record.playerName,
    totalInvolvements: record.totalInvolvements,
    sampleCount: record.involvement.length,
  }));
}

export interface InvolvementTimelineRow {
  key: string;
  teamCode: string;
  playerName: string;
  /** THE SLOT INDEX COLUMN: duplicate-minute rows are otherwise identical. */
  index: number;
  minute: number;
  involvements: number;
}

export function involvementTimelineRows(
  team: GoalkeepingTeamBlock
): InvolvementTimelineRow[] {
  return team.records.flatMap((record) =>
    record.involvement.map((point) => ({
      key: `${record.key}-slot-${point.index}`,
      teamCode: team.teamCode,
      playerName: record.playerName,
      index: point.index,
      minute: point.minute,
      involvements: point.involvements,
    }))
  );
}

/*
 * THE DISTRIBUTION AND AERIAL TABLES (added by the 2.10 code review).
 *
 * Ruled decision 19 requires each section's disclosure to carry THE SAME NUMBERS
 * THE SURFACE DISPLAYS, and UX-DR16 / ARCHITECTURE-SPINE.md:140 require "a
 * reachable data table rendering the same artifact slice" — with EXPERIENCE.md:113
 * making a data-table alternative the accessibility floor for every viz.
 *
 * The first implementation shipped three tables (involvement summary, involvement
 * timeline, intervention types) against roughly thirty numbers on screen. The
 * distribution families and their complete/incomplete triples, `lineBreaks`, the
 * three gated technique panels, `attemptsFaced` / `savePercentage` /
 * `totalInterventions`, `byBodyType`, the three aerial families,
 * `crossesFacedAttempted` / `Completed` and the six cross-delivery counts all
 * reached the screen and NO table. The two caption keys minted for exactly these
 * tables — `viz.goalkeeping.distributionCaption` and `aerialCaption` — sat in both
 * locales with zero call sites, which is what identified the gap as dropped work
 * rather than a ruling.
 *
 * ONE ROW SHAPE FOR BOTH, because both mix two kinds of quantity: a family row is
 * a complete/incomplete/total triple read verbatim, while a technique, body-type
 * or delivery-type row is a bare count. `complete` and `incomplete` are therefore
 * `number | null`, and null means THIS QUANTITY HAS NO SUCH SPLIT — never "the
 * report recorded zero". The component renders an em dash for it, the same
 * treatment the set-plays table already gives a non-partition group's share.
 *
 * GATED ROWS ARE ABSENT, NOT EM-DASHED (ruled decision 3): a closed gate
 * contributes no rows at all here, exactly as it renders no panel on the surface,
 * so the table and the surface agree on real data as well as on the fixtures.
 * NOTHING IN THIS FILE SUMS ANYTHING (AD-5) — every number is read verbatim, and
 * each breakdown carries its OWN denominator (ruled decision 13) rather than
 * implying a shared one.
 */
export interface KeeperBreakdownRow {
  key: string;
  teamCode: string;
  playerName: string;
  labelKey: DictionaryKey;
  /** Verbatim. For a count-only row this IS the quantity. */
  total: number;
  /** null when the quantity carries no completion split — NOT a zero. */
  complete: number | null;
  incomplete: number | null;
}

function breakdownFromCompletion(
  team: GoalkeepingTeamBlock,
  record: GoalkeeperBlock,
  prefix: string,
  rows: readonly CompletionRow[]
): KeeperBreakdownRow[] {
  return rows.map((row) => ({
    key: `${record.key}-${prefix}-${row.key}`,
    teamCode: team.teamCode,
    playerName: record.playerName,
    labelKey: row.labelKey,
    total: row.total,
    complete: row.complete,
    incomplete: row.incomplete,
  }));
}

function breakdownFromCounts(
  team: GoalkeepingTeamBlock,
  record: GoalkeeperBlock,
  prefix: string,
  rows: readonly CountRow[]
): KeeperBreakdownRow[] {
  return rows.map((row) => ({
    key: `${record.key}-${prefix}-${row.key}`,
    teamCode: team.teamCode,
    playerName: record.playerName,
    labelKey: row.labelKey,
    total: row.count,
    complete: null,
    incomplete: null,
  }));
}

/**
 * Every distribution number the surface prints: the four families as triples,
 * `lineBreaks`, and the three GATED technique groups (absent when gated).
 */
export function distributionTableRows(team: GoalkeepingTeamBlock): KeeperBreakdownRow[] {
  return team.records.flatMap((record) => {
    const distribution = record.distribution;
    return [
      ...breakdownFromCompletion(team, record, "dist", distribution.families),
      {
        key: `${record.key}-dist-line-breaks`,
        teamCode: team.teamCode,
        playerName: record.playerName,
        labelKey: "viz.goalkeeping.lineBreaks" as DictionaryKey,
        total: distribution.lineBreaks,
        complete: null,
        incomplete: null,
      },
      // Gated: absent, never em-dashed (ruled decision 3).
      ...breakdownFromCounts(team, record, "feet", distribution.feetTechniques.rows),
      ...breakdownFromCounts(team, record, "hands", distribution.handsTechniques.rows),
      ...breakdownFromCounts(team, record, "throw", distribution.throwTechniques.rows),
    ];
  });
}

/**
 * Every aerial number the surface prints: the three families as triples, the
 * crosses-faced pair (the completed half GATED), and the six delivery types.
 */
export function aerialTableRows(team: GoalkeepingTeamBlock): KeeperBreakdownRow[] {
  return team.records.flatMap((record) => {
    const aerial = record.aerial;
    const crosses: KeeperBreakdownRow[] = [
      {
        key: `${record.key}-aerial-crosses`,
        teamCode: team.teamCode,
        playerName: record.playerName,
        /*
         * The SAME label swap the surface makes: once its counterpart is gated
         * away, a value labelled as the *attempted half of a pair* reads as a
         * MISSING number rather than an ABSENT one (decision 3's first named
         * consequence). The table must not re-introduce the ambiguity the panel
         * was careful to remove.
         */
        labelKey: (aerial.crossesFacedCompleted === null
          ? "viz.goalkeeping.crossesFacedAlone"
          : "viz.goalkeeping.crossesFaced") as DictionaryKey,
        total: aerial.crossesFacedAttempted,
        complete: null,
        incomplete: null,
      },
    ];
    if (aerial.crossesFacedCompleted !== null) {
      crosses.push({
        key: `${record.key}-aerial-crosses-completed`,
        teamCode: team.teamCode,
        playerName: record.playerName,
        labelKey: "viz.goalkeeping.crossesFacedCompleted" as DictionaryKey,
        total: aerial.crossesFacedCompleted,
        complete: null,
        incomplete: null,
      });
    }
    return [
      ...breakdownFromCompletion(team, record, "aerial", aerial.types),
      ...crosses,
      ...breakdownFromCounts(team, record, "delivery", aerial.deliveryTypes),
    ];
  });
}

/**
 * The goal-prevention HEADLINE figures — `attemptsFaced`, `savePercentage` and
 * `totalInterventions` — which the surface prints above its breakdowns and which
 * no table carried.
 *
 * SEPARATE FROM THE BREAKDOWN ROWS ON PURPOSE (ruled decision 13). The two
 * breakdowns have DIFFERENT denominators — `byInterventionType` sums to
 * `attemptsFaced`, `byBodyType` to `totalInterventions` — and the contract
 * requires an App rendering them together to "label them with their own totals
 * rather than implying a shared one". Folding these three into the intervention
 * table would imply exactly that shared total.
 *
 * `savePercentage` is read VERBATIM and is a percentage, not a count, which is
 * why this row shape carries it separately rather than as another
 * `KeeperBreakdownRow`.
 */
export interface PreventionHeadlineRow {
  key: string;
  teamCode: string;
  playerName: string;
  attemptsFaced: number;
  savePercentage: number;
  totalInterventions: number;
}

export function preventionHeadlineRows(team: GoalkeepingTeamBlock): PreventionHeadlineRow[] {
  return team.records.map((record) => ({
    key: `${record.key}-prevention-headline`,
    teamCode: team.teamCode,
    playerName: record.playerName,
    attemptsFaced: record.goalPrevention.attemptsFaced,
    savePercentage: record.goalPrevention.savePercentage,
    totalInterventions: record.goalPrevention.totalInterventions,
  }));
}

/**
 * The GATED body-type breakdown, as its own rows.
 *
 * Kept out of `preventionHeadlineRows` and out of the intervention-type rows for
 * decision 13's reason: it sums to `totalInterventions`, a DIFFERENT denominator
 * from the intervention-type breakdown's `attemptsFaced`. On real data this
 * returns nothing at all — `byBodyType` is null on 208/208 corpus team-innings —
 * so the fixtures are the only place it is exercised, which is exactly where the
 * mislabelling risk decision 13 guards against is live.
 */
export function bodyTypeTableRows(team: GoalkeepingTeamBlock): KeeperBreakdownRow[] {
  return team.records.flatMap((record) =>
    breakdownFromCounts(team, record, "body", record.goalPrevention.byBodyType.rows)
  );
}

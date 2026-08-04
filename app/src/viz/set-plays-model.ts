import type {
  CornerDeliveryStyle,
  CornerDeliveryStyleCounts,
  CornerDeliveryType,
  CornerDeliveryTypeCounts,
  FreeKickCounts,
  FreeKickType,
  PitchSide,
  SetPlaysBlock,
  TeamSetPlays,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import type { LogSide } from "@/viz/marker-model";

/*
 * Domain F -> the #set-plays surface (Story 2.10, Task 3).
 *
 * THE HEADLINE FINDING, and the reason half this module is shaped the way it
 * is: TWO OF THE FOUR OBVIOUS PARTITIONS ARE FALSE ON REAL DATA, and BOTH are
 * TRUE in the fixtures. Measured over 208 corpus team-innings at story
 * creation (ruled decision 6):
 *
 *   direct == directOnTarget + directOffTarget     0 / 208   (fixtures 6/6 TRUE)
 *       160 of those have on+off == 0 while direct > 0.
 *   sum(cornersByDeliveryStyle) == totalCorners   96 / 208   (fixtures 6/6 TRUE)
 *       112 under, never over.
 *
 *   direct + indirect == totalFreeKicks           208 / 208
 *   sum(cornersByDeliveryType[*].total) == total  208 / 208
 *   left + right == total, per type and overall   208 / 208
 *   totalSetPlays == FK + corners + throws + pens 208 / 208
 *
 * The contract's own `FreeKickCounts` description asserts the first relation
 * "holds across all six fixture team-innings" — true, and corpus-false on every
 * single report. data/fixtures/README.md says why in as many words: free-kick
 * and corner breakdowns are Synthetic, "the totals are real; the splits beneath
 * them are synthesised so that they add up to those totals". A surface
 * validated only against fixtures ships a chart that is wrong on every real
 * report. Task 3.1's test pins both halves so nobody "fixes" this back.
 *
 * Pure and locale-free like every module under src/viz.
 */

/* ------------------------------ Frozen enums ------------------------------ */

const FREE_KICK_ORDER: Record<FreeKickType, true> = {
  direct: true,
  "direct-on-target": true,
  "direct-off-target": true,
  indirect: true,
};

export const FREE_KICK_TYPES: readonly FreeKickType[] = Object.keys(
  FREE_KICK_ORDER
) as FreeKickType[];

export const FREE_KICK_PROPERTY: Record<FreeKickType, keyof FreeKickCounts> = {
  direct: "direct",
  "direct-on-target": "directOnTarget",
  "direct-off-target": "directOffTarget",
  indirect: "indirect",
};

export function freeKickTypeKey(code: FreeKickType): DictionaryKey {
  return `enums.freeKick.${code}` as DictionaryKey;
}

const CORNER_DELIVERY_TYPE_ORDER: Record<CornerDeliveryType, true> = {
  "direct-to-area": true,
  short: true,
  "edge-of-penalty-area": true,
};

export const CORNER_DELIVERY_TYPES: readonly CornerDeliveryType[] = Object.keys(
  CORNER_DELIVERY_TYPE_ORDER
) as CornerDeliveryType[];

export const CORNER_DELIVERY_PROPERTY: Record<
  CornerDeliveryType,
  keyof CornerDeliveryTypeCounts
> = {
  "direct-to-area": "directToArea",
  short: "short",
  "edge-of-penalty-area": "edgeOfPenaltyArea",
};

export function cornerDeliveryTypeKey(code: CornerDeliveryType): DictionaryKey {
  return `enums.cornerDeliveryType.${code}` as DictionaryKey;
}

const CORNER_DELIVERY_STYLE_ORDER: Record<CornerDeliveryStyle, true> = {
  inswing: true,
  outswing: true,
  driven: true,
  lofted: true,
};

export const CORNER_DELIVERY_STYLES: readonly CornerDeliveryStyle[] = Object.keys(
  CORNER_DELIVERY_STYLE_ORDER
) as CornerDeliveryStyle[];

const CORNER_DELIVERY_STYLE_PROPERTY: Record<
  CornerDeliveryStyle,
  keyof CornerDeliveryStyleCounts
> = {
  inswing: "inswing",
  outswing: "outswing",
  driven: "driven",
  lofted: "lofted",
};

export function cornerDeliveryStyleKey(code: CornerDeliveryStyle): DictionaryKey {
  return `enums.cornerDeliveryStyle.${code}` as DictionaryKey;
}

const PITCH_SIDE_ORDER: Record<PitchSide, true> = {
  left: true,
  right: true,
};

export const PITCH_SIDES: readonly PitchSide[] = Object.keys(PITCH_SIDE_ORDER) as PitchSide[];

export function pitchSideKey(code: PitchSide): DictionaryKey {
  return `enums.pitchSide.${code}` as DictionaryKey;
}

/* -------------------------------- The totals ------------------------------- */

/** The five contracted per-team totals, raw. Nothing here is derived (AD-5). */
export interface SetPlayTotals {
  key: string;
  teamId: string;
  teamCode: string;
  totalSetPlays: number;
  totalFreeKicks: number;
  totalCorners: number;
  totalThrowIns: number;
  totalPenalties: number;
}

export interface SetPlayTotalsPair {
  home: SetPlayTotals;
  away: SetPlayTotals;
}

export function setPlayTotals(
  setPlays: SetPlaysBlock,
  home: LogSide,
  away: LogSide
): SetPlayTotalsPair {
  return {
    home: teamTotals(setPlays.home, home),
    away: teamTotals(setPlays.away, away),
  };
}

function teamTotals(team: TeamSetPlays, side: LogSide): SetPlayTotals {
  return {
    key: `set-play-totals-${side.teamId}`,
    teamId: side.teamId,
    teamCode: side.teamCode,
    totalSetPlays: team.totalSetPlays,
    totalFreeKicks: team.totalFreeKicks,
    totalCorners: team.totalCorners,
    totalThrowIns: team.totalThrowIns,
    totalPenalties: team.totalPenalties,
  };
}

/* ------------------------------- Free kicks -------------------------------- */

/** One free-kick count. FOUR FLAT SIBLINGS — see `subordinate` below. */
export interface FreeKickRow {
  key: string;
  code: FreeKickType;
  labelKey: DictionaryKey;
  count: number;
  /**
   * The contract CLAIMS this value is a subdivision of `direct`
   * (`FreeKickCounts.description`: "directOnTarget and directOffTarget are
   * subdivisions of direct").
   *
   * IT MUST NOT DRIVE ANY CONTAINMENT CUE — no indentation, no nesting glyph,
   * no arrow, no inset. Ruled decision 6 is explicit that indentation "is the
   * most conventional visual assertion of containment there is, and it would
   * smuggle back exactly the claim this decision bans". The claim is FALSE on
   * 208/208 corpus team-innings, and on 160 of them the surface would read
   * "Tiro libre directo 7 / Al arco 0 / Desviado 0" — which a reader parses as
   * a rendering bug rather than as a property of the source, and which is
   * INVISIBLE IN DEV because the fixtures satisfy the relation 6/6.
   *
   * The flag is carried as DATA, for the disclosure copy that names the
   * contract's claim, and for a future consumer that has a corrected contract
   * to read. The four rows RENDER FLAT.
   */
  subordinate: boolean;
}

export interface FreeKickRowSet {
  key: string;
  teamId: string;
  teamCode: string;
  /** `totalFreeKicks`, read VERBATIM — never the sum of the four rows. */
  declaredTotal: number;
  isZero: boolean;
  rows: FreeKickRow[];
}

/**
 * The four free-kick counts per team, as INDEPENDENT COUNTS (ruled decision 6).
 *
 * No stack, no segmented bar, no part-of-whole geometry — and no arithmetic of
 * any kind: nothing here adds two contract fields together (AD-5).
 *
 * THE ONE TRUE FREE-KICK PARTITION IS DELIBERATELY NOT DRAWN EITHER.
 * `direct + indirect == totalFreeKicks` holds 208/208, and is still not a bar:
 * a segmented bar over {direct, indirect} sitting beside two non-exhaustive
 * subdivisions of one of its own segments is unreadable regardless of which
 * geometry is correct. Stated here so a later reader does not read its absence
 * as an oversight.
 */
export function freeKickRows(
  setPlays: SetPlaysBlock,
  home: LogSide,
  away: LogSide
): { home: FreeKickRowSet; away: FreeKickRowSet } {
  return {
    home: teamFreeKicks(setPlays.home, home),
    away: teamFreeKicks(setPlays.away, away),
  };
}

function teamFreeKicks(team: TeamSetPlays, side: LogSide): FreeKickRowSet {
  const rows = FREE_KICK_TYPES.map((code) => ({
    key: `free-kick-${side.teamId}-${code}`,
    code,
    labelKey: freeKickTypeKey(code),
    count: team.freeKicks[FREE_KICK_PROPERTY[code]],
    subordinate: code === "direct-on-target" || code === "direct-off-target",
  }));
  return {
    key: `free-kicks-${side.teamId}`,
    teamId: side.teamId,
    teamCode: side.teamCode,
    declaredTotal: team.totalFreeKicks,
    // The declared total is what decides "this team took no free kicks", NOT
    // the four rows: they are not a partition of it on real data.
    isZero: team.totalFreeKicks === 0 && rows.every((row) => row.count === 0),
    rows,
  };
}

/* --------------------------------- Corners --------------------------------- */

/** One segment of a part-of-whole bar, and one entry of its value list. */
export interface SetPlaySegment {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  count: number;
  /** Percent points of `segmentsTotal`; 0 for every segment when that is 0. */
  share: number;
}

/**
 * A group of category counts, with an EXPLICIT statement of whether it may be
 * drawn as parts of a whole.
 *
 * `partition` is a field rather than a naming convention on purpose: ruled
 * decision 6 turns on a measurement no reader of this code can see, and a
 * component that decided by reading a variable name would get corner STYLE
 * wrong (it looks exactly like corner TYPE and is false on 112/208).
 */
export interface SetPlayGroup {
  key: string;
  teamId: string;
  teamCode: string;
  /** May this be rendered with part-of-whole geometry? */
  partition: boolean;
  /**
   * THE BAR'S DENOMINATOR — the SUM OF THE RENDERED SEGMENTS, never the
   * contracted total (ruled decision 8).
   *
   * 2.9 could use its contracted total safely because that total WAS the sum of
   * its six categories. Here the contracted total is `totalCorners`, a SEPARATE
   * field, and this story's headline finding is that one of the three obvious
   * corner partitions is false on 112/208. Summing the rendered segments makes
   * the geometry self-consistent by construction.
   */
  segmentsTotal: number;
  /** `totalCorners`, printed VERBATIM beside the bar. Never normalized. */
  declaredTotal: number;
  /**
   * The two disagree. The surface SHOWS BOTH and normalizes neither (AD-6 bans
   * re-normalisation). False on all 6 fixture team-innings; true on 112 of 208
   * corpus ones for the STYLE group.
   */
  disagreesWithDeclaredTotal: boolean;
  isZero: boolean;
  segments: SetPlaySegment[];
}

/** The three corner breakdowns for one team. */
export interface TeamCornerGroups {
  /** From the PRECOMPUTED `cornersBySide`. Partition-legal (208/208). */
  bySide: SetPlayGroup;
  /** By delivery type. Partition-legal (208/208). Carries each type's sides. */
  byDeliveryType: SetPlayGroup;
  /** Per-type left/right splits, index-aligned to `byDeliveryType.segments`. */
  deliveryTypeSides: CornerTypeSideRow[];
  /** By delivery style. NOT a partition (96/208) — flat counts only. */
  byStyle: SetPlayGroup;
}

/** One delivery type's own left/right split. */
export interface CornerTypeSideRow {
  key: string;
  code: CornerDeliveryType;
  labelKey: DictionaryKey;
  left: number;
  right: number;
  /** The type's own contracted `total`, read verbatim. */
  total: number;
}

function makeGroup(
  key: string,
  side: LogSide,
  partition: boolean,
  declaredTotal: number,
  entries: { code: string; labelKey: DictionaryKey; count: number }[]
): SetPlayGroup {
  let segmentsTotal = 0;
  for (const entry of entries) {
    segmentsTotal += entry.count;
  }
  return {
    key: `${key}-${side.teamId}`,
    teamId: side.teamId,
    teamCode: side.teamCode,
    partition,
    segmentsTotal,
    declaredTotal,
    disagreesWithDeclaredTotal: segmentsTotal !== declaredTotal,
    isZero: segmentsTotal === 0 && declaredTotal === 0,
    segments: entries.map((entry) => ({
      key: `${key}-${side.teamId}-${entry.code}`,
      code: entry.code,
      labelKey: entry.labelKey,
      count: entry.count,
      /*
       * A zero denominator yields 0 for EVERY category rather than NaN.
       * Reachable on real data: corpus `total_corners` has a minimum of 0, so
       * the all-zero corner branch is not a theoretical guard (Task 3.8).
       */
      share: segmentsTotal === 0 ? 0 : (entry.count / segmentsTotal) * 100,
    })),
  };
}

/**
 * The three corner breakdowns per team (ruled decision 6).
 *
 * THE SIDE SPLIT IS READ FROM THE PRECOMPUTED `cornersBySide`, never by adding
 * the three per-type left/right numbers. contract/README.md section 14 exists
 * to say so, and the field's own description states it: "AD-5 forbids the App
 * summing, so the team-level side split is its own field rather than three
 * numbers the browser adds up out of cornersByDeliveryType."
 */
export function cornerRows(
  setPlays: SetPlaysBlock,
  home: LogSide,
  away: LogSide
): { home: TeamCornerGroups; away: TeamCornerGroups } {
  return {
    home: teamCorners(setPlays.home, home),
    away: teamCorners(setPlays.away, away),
  };
}

function teamCorners(team: TeamSetPlays, side: LogSide): TeamCornerGroups {
  const bySide = makeGroup(
    "corner-side",
    side,
    true,
    team.totalCorners,
    PITCH_SIDES.map((code) => ({
      code,
      labelKey: pitchSideKey(code),
      // Verbatim from the precomputed team-level field (contract README s14).
      count: team.cornersBySide[code],
    }))
  );

  const byDeliveryType = makeGroup(
    "corner-type",
    side,
    true,
    team.totalCorners,
    CORNER_DELIVERY_TYPES.map((code) => ({
      code,
      labelKey: cornerDeliveryTypeKey(code),
      count: team.cornersByDeliveryType[CORNER_DELIVERY_PROPERTY[code]].total,
    }))
  );

  const deliveryTypeSides: CornerTypeSideRow[] = CORNER_DELIVERY_TYPES.map((code) => {
    const counts = team.cornersByDeliveryType[CORNER_DELIVERY_PROPERTY[code]];
    return {
      key: `corner-type-sides-${side.teamId}-${code}`,
      code,
      labelKey: cornerDeliveryTypeKey(code),
      left: counts.left,
      right: counts.right,
      total: counts.total,
    };
  });

  /*
   * STYLE IS NOT A PARTITION. It sums to `totalCorners` on only 96 of 208
   * corpus team-innings (112 under, 0 over) — and on 6/6 fixture ones, which is
   * exactly why this flag is data rather than a judgement made while looking at
   * a dev server.
   */
  const byStyle = makeGroup(
    "corner-style",
    side,
    false,
    team.totalCorners,
    CORNER_DELIVERY_STYLES.map((code) => ({
      code,
      labelKey: cornerDeliveryStyleKey(code),
      count: team.cornersByDeliveryStyle[CORNER_DELIVERY_STYLE_PROPERTY[code]],
    }))
  );

  return { bySide, byDeliveryType, deliveryTypeSides, byStyle };
}

/* ------------------------------- Table rows -------------------------------- */

/** Decision 19: the tables carry the SAME NUMBERS the surface displays. */

export interface SetPlayTotalsRow {
  key: string;
  teamCode: string;
  totalSetPlays: number;
  totalFreeKicks: number;
  totalCorners: number;
  totalThrowIns: number;
  totalPenalties: number;
}

export function setPlayTotalsRows(totals: SetPlayTotalsPair): SetPlayTotalsRow[] {
  return [totals.home, totals.away].map((team) => ({
    key: `totals-row-${team.teamId}`,
    teamCode: team.teamCode,
    totalSetPlays: team.totalSetPlays,
    totalFreeKicks: team.totalFreeKicks,
    totalCorners: team.totalCorners,
    totalThrowIns: team.totalThrowIns,
    totalPenalties: team.totalPenalties,
  }));
}

export interface FreeKickTableRow {
  key: string;
  teamCode: string;
  counts: Record<FreeKickType, number>;
  declaredTotal: number;
}

export function freeKickTableRows(sets: {
  home: FreeKickRowSet;
  away: FreeKickRowSet;
}): FreeKickTableRow[] {
  return [sets.home, sets.away].map((set) => {
    const counts = {} as Record<FreeKickType, number>;
    for (const row of set.rows) {
      counts[row.code] = row.count;
    }
    return {
      key: `free-kick-row-${set.teamId}`,
      teamCode: set.teamCode,
      counts,
      declaredTotal: set.declaredTotal,
    };
  });
}

/**
 * One corner table row per team per group. The SHARE IS PRINTED as well as
 * drawn: `MovementToReceiveSection` prints it, so "copy the pattern" means
 * printing a client-derived percentage — which makes it a DISPLAYED NUMBER, and
 * decision 19 therefore requires it in the table too.
 */
export interface CornerTableRow {
  key: string;
  teamCode: string;
  groupKey: string;
  labelKey: DictionaryKey;
  count: number;
  /** Null for a non-partition group, where no share is drawn or printed. */
  share: number | null;
}

export function cornerTableRows(groups: {
  home: TeamCornerGroups;
  away: TeamCornerGroups;
}): CornerTableRow[] {
  const rows: CornerTableRow[] = [];
  for (const team of [groups.home, groups.away]) {
    for (const group of [team.bySide, team.byDeliveryType, team.byStyle]) {
      for (const segment of group.segments) {
        rows.push({
          key: `${segment.key}-table`,
          teamCode: group.teamCode,
          groupKey: group.key,
          labelKey: segment.labelKey,
          count: segment.count,
          share: group.partition ? segment.share : null,
        });
      }
    }
  }
  return rows;
}

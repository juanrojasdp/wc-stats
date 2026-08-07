import type {
  InPossessionPhase,
  KeyStatisticsBlock,
  MatchBundle,
  PlayerProfile,
  TeamProfile,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { resolveLeader, type TileLeader } from "@/lib/match-hero";
import {
  buildKeyStatRows,
  KEY_STAT_FORMAT,
  KEY_STAT_UNIT,
  type KeyStatField,
} from "@/lib/tactical-sections";
import { countAxisMax, countTicks } from "@/viz/goalkeeping-model";
import {
  LEADERBOARD_UNIT,
  leaderboardMetricKey,
  type LeaderboardUnit,
} from "@/viz/leaderboard-model";
import {
  IN_POSSESSION_PHASES,
  IN_POSSESSION_PROPERTY,
  inPossessionPhaseKey,
  percentAxisMax,
  percentTicks,
} from "@/viz/phases-model";
import {
  aggregateRows,
  SPEED_ZONES,
  speedZoneAxis,
  type Axis,
  type SpeedZone,
} from "@/viz/player-profile-model";

/*
 * ═══════════ THE `/compare` DECISION LAYER (Story 2.17) ═══════════
 *
 * PURE: no React, no DOM, no t(), no fetch, no `@/lib/format`. Everything the
 * comparison decides — which rows exist, which values pair with which, where the
 * shared axis runs, which side leads — is decided here so `compare-model.test.ts`
 * can hold it against fixture literals under the repo's `environment: "node"`
 * default. The components paint what this returns and nothing else.
 *
 * ═══════════ THE DERIVATION WHITELIST IS THE WHOLE POINT (AD-5) ═══════════
 *
 * `ARCHITECTURE-SPINE.md:74`, written for this surface: "Comparison mode renders
 * each side's precomputed values verbatim; the App may derive PRESENTATION
 * GEOMETRY ONLY (shared axis domains, leader-accent determination between two
 * displayed values) and never displays a derived cross-entity number (no deltas,
 * no ratios) unless it ships in an artifact."
 *
 * EXACTLY TWO DERIVATIONS LIVE IN THIS FILE, and both are named in that clause:
 *
 *   1. `sharedAxis*` — one `domain` + `ticks` computed over BOTH sides' values,
 *      so the two charts are read against the same scale. Tick labels are the
 *      axis's own scale, not a cross-entity number.
 *   2. `resolveLeader(a, b)` — imported from `match-hero.ts`, NEVER re-minted
 *      (ruled D14). Ties get no marks.
 *
 * Selecting WHICH metrics to show is licensed too (AD-5 permits "filter,
 * select"), which is what `TEAM_COMPARE_FIELDS` and `MATCH_CHART_FIELDS` are.
 *
 * 🔴 THERE IS NO SUBTRACTION, NO DIVISION, NO SUM AND NO RATIO ANYWHERE IN THIS
 * MODULE, and adding one is a defect rather than a feature. No `a - b`, no
 * combined total, no "12% better", no difference series, no gap sparkline. If a
 * future story needs one it must ship in an artifact first.
 *
 * ═══════════ `home`/`away` MEAN SIDE A / SIDE B HERE ═══════════
 *
 * `resolveLeader` returns `"home" | "away" | "tie"` because it was minted for the
 * Hero's head-to-head tiles, where the two sides genuinely are home and away. On
 * `/compare` there is no home and no away: `"home"` means SIDE A and `"away"`
 * means SIDE B. Reusing the comparator with its own vocabulary is ruled D14 —
 * minting a second three-valued comparator so the words read better would be two
 * homes for one decision, which is the drift this codebase punishes. Every
 * consumer below maps the union to a side explicitly.
 *
 * ═══════════ WHY `src/viz` AND NOT `src/lib` ═══════════
 *
 * Nothing here imports `@/lib/format`, so it stays on the pure side of the house
 * convention. That is load-bearing rather than incidental: the speed-zone label
 * keys and the metric-unit suffixes are composed in `compare-format.ts`, which
 * DOES import the format layer and therefore lives in `src/lib`. This module
 * hands back dictionary KEYS and raw numerics; it never holds a user-visible
 * glyph.
 */

/* ------------------------------- Entry guards ------------------------------ */

/**
 * Rejects a value `@/lib/format` would throw on, WHERE THE ENTITY CAN STILL BE
 * NAMED.
 *
 * `player-profile-model.ts`'s `finite`, restated for this module's two-sided
 * boundary. Both payloads arrive through `fetchArtifact`'s `as`-cast, so a field
 * the contract declares required can still be `undefined` at runtime — and by
 * the time `formatPercent` sees it, it holds a bare number and can only say
 * "non-finite value NaN". Naming the side and the field here turns a search into
 * a fix.
 *
 * FAIL LOUD ON LOAD, not inside a disclosure: every row is built eagerly by the
 * region before any chart or table mounts (Story 2.9's review finding).
 */
function finite(value: number, entityId: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `compare-model: ${entityId} has a non-finite "${field}" (${String(value)}); ` +
        `every compared leaf is non-nullable by contract.`
    );
  }
  return value;
}

/* -------------------------------- Row model -------------------------------- */

/**
 * How one compared value prints — `LeaderboardFormat` exactly, with NO fifth
 * case.
 *
 * A signed variant for `goalDifference` was considered and rejected: 2.16 already
 * ruled that field's presentation in `formatGoalDifference`, whose docblock says
 * an explicit `+` "would make this the only signed figure on the site that
 * carries a plus". A negative difference still prints its own minus through
 * `Intl`, so nothing is lost and the site keeps one convention.
 */
export type CompareFormat = "integer" | "decimal1" | "decimal2" | "percent";

/**
 * One mirrored row: a shared label and both sides' PRECOMPUTED values.
 *
 * `a` and `b` are the artifacts' own numbers, carried verbatim (AR-5). Nothing
 * between the artifact and the screen changes them — `leader` is the only thing
 * this row adds, and it is a three-valued accent decision, not a number.
 */
export interface CompareRow {
  key: string;
  /** Resolved by the component through `useT()`; never a string here (AD-7). */
  labelKey: DictionaryKey;
  /** Which unit suffix the label carries, or null when the term is unitless. */
  unit: LeaderboardUnit | null;
  a: number;
  b: number;
  format: CompareFormat;
  /** `"home"` = side A, `"away"` = side B, `"tie"` = no marks. See the header. */
  leader: TileLeader;
}

/* --------------------------------- Players --------------------------------- */

/**
 * The eighteen headline aggregates, paired by metric code.
 *
 * REUSES `aggregateRows` WHOLESALE rather than re-projecting `profile.aggregates`
 * — that function already carries 2.15's `finite` guards, the artifact-order
 * rule, the `perNinety` exclusion and the `totalDistance` precision override, and
 * a second projection here would be a second place for all four to drift.
 *
 * 🔴 PAIRED BY CODE, NEVER BY INDEX. Both artifacts are total and emit the same
 * eighteen codes in the same alphabetical order today, so an index pairing would
 * pass every test that exists — and would silently compare `crosses` against
 * `defensiveLineBreaks` the day one profile's array is truncated by a bad
 * emission. A code that is absent from either side is DROPPED rather than
 * defaulted: `?? 0` would assert a real measured zero on a row that has no
 * measurement, which is the same lie as a derived number.
 *
 * A's order governs, because A is the artifact order of the left-hand side and
 * the reader's eye starts there.
 */
export function playerCompareRows(a: PlayerProfile, b: PlayerProfile): CompareRow[] {
  const bByCode = new Map(aggregateRows(b).map((row) => [row.metricCode, row]));
  const rows: CompareRow[] = [];
  for (const rowA of aggregateRows(a)) {
    const rowB = bByCode.get(rowA.metricCode);
    if (rowB === undefined) {
      continue;
    }
    rows.push({
      key: `player-${rowA.metricCode}`,
      labelKey: leaderboardMetricKey(rowA.metricCode),
      unit: LEADERBOARD_UNIT[rowA.metricCode],
      a: rowA.value,
      b: rowB.value,
      format: rowA.format,
      leader: resolveLeader(rowA.value, rowB.value),
    });
  }
  return rows;
}

/**
 * The five speed bands, one series per side, ON ONE SHARED AXIS.
 *
 * `speedZoneAxis` takes a FLAT `readonly number[]` and derives its domain from
 * that array's extrema — so the shared domain is literally
 * `speedZoneAxis([...aMetres, ...bMetres])`, with no change to 2.15's module and
 * no second axis generator. It is zero-based and count-floored, which is
 * mandatory here: these are BARS, and a bar encodes its LENGTH as the value, so
 * a truncated baseline misstates it.
 *
 * The axis can never be degenerate — `countAxisMax` floors it — which matters on
 * this route because 209 corpus players have no appearances at all and two of
 * them compared would otherwise ask recharts to scale `[0, 0]`.
 */
export interface PlayerChartModel {
  zones: readonly SpeedZone[];
  a: number[];
  b: number[];
  axis: Axis;
}

export function playerChartModel(a: PlayerProfile, b: PlayerProfile): PlayerChartModel {
  const aValues = speedZoneMetres(a);
  const bValues = speedZoneMetres(b);
  return {
    zones: SPEED_ZONES,
    a: aValues,
    b: bValues,
    // THE ONE LICENSED CROSS-ENTITY DERIVATION: one domain over both sides.
    axis: speedZoneAxis([...aValues, ...bValues]),
  };
}

/** The five band distances in band order, guarded at model entry. */
function speedZoneMetres(profile: PlayerProfile): number[] {
  const physical = profile.physical;
  return SPEED_ZONES.map((zone) =>
    finite(
      physical?.[`distanceZone${zone}` as const] as number,
      profile.playerId,
      `physical.distanceZone${zone}`
    )
  );
}

/* ---------------------------------- Teams ---------------------------------- */

/**
 * One comparable team scalar: where to read it, how to label it, how to print it.
 *
 * 🔴 EVERY LABEL KEY IS ALREADY SHIPPED AND NOT ONE IS MINTED. `hub.standings.
 * columnTitle.*` carries the FULL terms behind the standings table's nine
 * abbreviated heads ("Partidos jugados", "Ganados", "Diferencia de gol", …),
 * which is exactly the register a mirrored comparison row needs — the abbreviated
 * `column.*` forms are table furniture and would read as noise under a centred
 * label. The two tactical scalars take `team.tile.*`, which 2.16 minted for the
 * same two numbers on the team's own Hero.
 *
 * This is the reuse-first house rule (2.11a decision 1) held exactly, and it is
 * the CONTRAST to D12: `compare.type.*` was minted because a plural filter
 * segment is genuinely not a singular column head. There is no such gap here —
 * "Puntos" on a comparison row is the same term as "Puntos" on a standings head.
 */
export interface TeamCompareField {
  key: string;
  labelKey: DictionaryKey;
  format: CompareFormat;
  unit: LeaderboardUnit | null;
  read: (profile: TeamProfile) => number;
  /** Dotted path for the entry guard's error message. */
  path: string;
}

/**
 * The ten team scalars, in reading order: the record first, the two tactical
 * means last.
 *
 * `furthestStage` is deliberately absent — it is a Stage ENUM, not a number, so
 * it has no leader, no axis and no place in a numeric mirrored row. It is carried
 * in the side header's meta line instead.
 */
export const TEAM_COMPARE_FIELDS: readonly TeamCompareField[] = [
  {
    key: "played",
    labelKey: "hub.standings.columnTitle.played",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.played,
    path: "record.played",
  },
  {
    key: "won",
    labelKey: "hub.standings.columnTitle.won",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.won,
    path: "record.won",
  },
  {
    key: "drawn",
    labelKey: "hub.standings.columnTitle.drawn",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.drawn,
    path: "record.drawn",
  },
  {
    key: "lost",
    labelKey: "hub.standings.columnTitle.lost",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.lost,
    path: "record.lost",
  },
  {
    key: "goalsFor",
    labelKey: "hub.standings.columnTitle.goalsFor",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.goalsFor,
    path: "record.goalsFor",
  },
  {
    key: "goalsAgainst",
    labelKey: "hub.standings.columnTitle.goalsAgainst",
    format: "integer",
    unit: "count",
    read: (profile) => profile.record.goalsAgainst,
    path: "record.goalsAgainst",
  },
  {
    /*
     * A CONTRACT FIELD, NOT `goalsFor - goalsAgainst`. `TeamTournamentRecord`
     * ships `goalDifference` precomputed precisely so the App never subtracts —
     * and subtracting it here would be the first banned derivation in a file
     * whose whole subject is not performing them.
     */
    key: "goalDifference",
    labelKey: "hub.standings.columnTitle.goalDifference",
    format: "integer",
    unit: null,
    read: (profile) => profile.record.goalDifference,
    path: "record.goalDifference",
  },
  {
    key: "points",
    labelKey: "hub.standings.columnTitle.points",
    format: "integer",
    unit: null,
    read: (profile) => profile.record.points,
    path: "record.points",
  },
  {
    key: "possession",
    labelKey: "team.tile.possession",
    format: "percent",
    unit: "percent",
    read: (profile) => profile.tacticalIdentity.possession,
    path: "tacticalIdentity.possession",
  },
  {
    /*
     * A COUNT-VALUED MEAN at 1 dp with no percent sign — the contract calls it
     * "Mean defensive pressures applied per match" and 2.16's Hero prints Mexico
     * at 213,0. `unit: null` because the "por partido" qualifier rides the
     * label's own caption on the Hero and there is no `enums.unit` code for it.
     */
    key: "pressingIntensity",
    labelKey: "team.tile.pressingIntensity",
    format: "decimal1",
    unit: null,
    read: (profile) => profile.tacticalIdentity.pressingIntensity,
    path: "tacticalIdentity.pressingIntensity",
  },
];

export function teamCompareRows(a: TeamProfile, b: TeamProfile): CompareRow[] {
  return TEAM_COMPARE_FIELDS.map((field) => {
    const valueA = finite(field.read(a), a.teamId, field.path);
    const valueB = finite(field.read(b), b.teamId, field.path);
    return {
      key: `team-${field.key}`,
      labelKey: field.labelKey,
      unit: field.unit,
      a: valueA,
      b: valueB,
      format: field.format,
      leader: resolveLeader(valueA, valueB),
    };
  });
}

/**
 * The eight in-possession phase rates, one series per side, on one shared axis.
 *
 * 🔴 BUILT FROM `phases-model.ts`, NOT FROM `team-profile-model.ts`. The team
 * profile module's `rowsPeak` and `toRateChart` are UNEXPORTED and its
 * `identityCharts` hardcodes ONE `TeamProfile`, so there is no seam to reuse
 * there — and that file belongs to Story 2.16, which was still writing it while
 * this story ran. `phases-model.ts` is marked read-only by 2.15 AND 2.16 and
 * exports everything needed: the frozen phase order, the property map, the label
 * keys, and a percent axis pair that floors its maximum so `[0, 0]` is
 * impossible.
 *
 * IN-POSSESSION ONLY, and that is a selection rather than an omission (AD-5
 * licenses "filter, select"). Nine out-of-possession rates on a second chart
 * would double this route's recharts mounts for a surface whose reader is
 * comparing two teams' shapes, not auditing seventeen rates; the full
 * seventeen stay one click away on each team's own route.
 *
 * The rates DO NOT SUM TO 100 and nothing here stacks them — corpus in-possession
 * sums run 84-149, and `InPossessionPhase`'s own description forbids treating
 * them as slices of a whole.
 */
export interface TeamChartModel {
  phases: readonly InPossessionPhase[];
  phaseLabelKeys: DictionaryKey[];
  a: number[];
  b: number[];
  axis: Axis;
}

export function teamChartModel(a: TeamProfile, b: TeamProfile): TeamChartModel {
  const aValues = phaseRates(a);
  const bValues = phaseRates(b);
  // THE ONE LICENSED CROSS-ENTITY DERIVATION: one peak over both sides' values.
  const peak = [...aValues, ...bValues].reduce((best, value) => (value > best ? value : best), 0);
  return {
    phases: IN_POSSESSION_PHASES,
    phaseLabelKeys: IN_POSSESSION_PHASES.map(inPossessionPhaseKey),
    a: aValues,
    b: bValues,
    axis: { ticks: percentTicks(peak), min: 0, max: percentAxisMax(peak) },
  };
}

function phaseRates(profile: TeamProfile): number[] {
  const phases = profile.tacticalIdentity?.phasesInPossession;
  return IN_POSSESSION_PHASES.map((code) =>
    finite(
      phases?.[IN_POSSESSION_PROPERTY[code]] as number,
      profile.teamId,
      `tacticalIdentity.phasesInPossession.${IN_POSSESSION_PROPERTY[code]}`
    )
  );
}

/* --------------------------------- Matches --------------------------------- */

/**
 * The four count-family Key Statistics the match charts plot.
 *
 * 🔴 THIS IS R1's SHAPE, AND THE SELECTION IS THE WHOLE RULING. A match is
 * already two-sided — `keyStatistics` is `{home, away}` — so comparing two
 * matches compares FOUR team-innings, and there is almost no genuine match-level
 * scalar in a bundle to compare instead. The obvious repair, summing or averaging
 * home and away into a match total, is a DISPLAYED DERIVED NUMBER and is banned
 * outright. So each side stays a whole match rendered as its own two-team block,
 * and cross-side comparability comes from the shared axis alone.
 *
 * ONE UNIT FAMILY, NON-NEGOTIABLY. A single domain over four series is only
 * honest if every series is the same kind of quantity: `KEY_STAT_FORMAT` puts
 * exactly two fields in the percent family and seventeen in the count family, and
 * mixing a 90 % pass completion with a 344-count reception tally on one axis
 * would compress every count into the axis floor. These four are the shot-and-
 * delivery counts, whose fixture range is 3-52 across both matches.
 *
 * FOUR, because `distributionChartHeightClass` is typed `3 | 4 | 8 | 9` with an
 * exhaustive `never` — a five-category set would be a compile error, and minting
 * a private height function to dodge that would be a second home for a decision
 * `phases-model.ts` already owns.
 */
export const MATCH_CHART_FIELDS: readonly KeyStatField[] = [
  "shots",
  "shotsOnTarget",
  "crosses",
  "defensiveLineBreaks",
];

/**
 * ONE match's nineteen Key Statistics as mirrored rows — HOME against AWAY.
 *
 * 🔴 THE ROWS RUN WITHIN A SIDE, NOT ACROSS THEM, AND THAT IS R1's WHOLE SHAPE.
 * For `players` and `teams` a mirrored row is "A's value against B's". For
 * `matches` it is "this match's home against this match's away", because a match
 * has no single value to put opposite another match's — `keyStatistics` is
 * `{home, away}` by contract and summing the pair into a match total would be a
 * displayed derived number, banned outright.
 *
 * So each side renders its own two-team block, `a` = home and `b` = away, through
 * the SAME `CompareRow` grammar and the same grid the other two types use. Side
 * A/B identity is carried by the column header's accent top border and the sticky
 * mini-header ONLY (D5's corollary) — never by the values themselves.
 *
 * REUSES `buildKeyStatRows` WHOLESALE. That function already walks
 * `KEY_STAT_FIELDS` in the contract's own `required[]` order and already calls
 * `resolveLeader`; re-deriving nineteen fields here would be a second home for
 * both. This maps its output into the row shape and adds nothing.
 */
export function matchCompareRows(bundle: MatchBundle): CompareRow[] {
  return buildKeyStatRows(bundle.keyStatistics).map((row) => ({
    key: `match-${row.field}`,
    labelKey: `enums.metric.${row.field}` as DictionaryKey,
    unit: KEY_STAT_UNIT[row.field] ?? null,
    a: finite(row.home, bundle.matchId, `keyStatistics.home.${row.field}`),
    b: finite(row.away, bundle.matchId, `keyStatistics.away.${row.field}`),
    /*
     * `KEY_STAT_FORMAT`'s union IS `CompareFormat` — the same four cases. A new
     * case on either side is a compile error here rather than a silent default.
     */
    format: KEY_STAT_FORMAT[row.field],
    leader: row.leader,
  }));
}

/**
 * Both matches' four series, on ONE shared count axis.
 *
 * The domain spans ALL FOUR SERIES (A-home, A-away, B-home, B-away), which is
 * what makes the two blocks readable against each other at all — and it is the
 * only thing that crosses between them. Inside either block the two accents mean
 * HOME and AWAY (D5's corollary, `DESIGN.md:260`'s "one color means one thing per
 * visualization"); side A/B identity is carried by the header's accent top border
 * and the sticky mini-header, never by series colour.
 */
export interface MatchChartModel {
  fields: readonly KeyStatField[];
  aHome: number[];
  aAway: number[];
  bHome: number[];
  bAway: number[];
  axis: Axis;
}

export function matchChartModel(a: MatchBundle, b: MatchBundle): MatchChartModel {
  const aHome = keyStatSeries(a.keyStatistics, "home", a.matchId);
  const aAway = keyStatSeries(a.keyStatistics, "away", a.matchId);
  const bHome = keyStatSeries(b.keyStatistics, "home", b.matchId);
  const bAway = keyStatSeries(b.keyStatistics, "away", b.matchId);
  const peak = [...aHome, ...aAway, ...bHome, ...bAway].reduce(
    (best, value) => (value > best ? value : best),
    0
  );
  return {
    fields: MATCH_CHART_FIELDS,
    aHome,
    aAway,
    bHome,
    bAway,
    axis: { ticks: countTicks(peak), min: 0, max: countAxisMax(peak) },
  };
}

function keyStatSeries(
  block: KeyStatisticsBlock,
  side: "home" | "away",
  matchId: string
): number[] {
  return MATCH_CHART_FIELDS.map((field) =>
    finite(block?.[side]?.[field] as number, matchId, `keyStatistics.${side}.${field}`)
  );
}

/* ------------------------------ Chart heights ------------------------------ */

/**
 * The single-series compare bar chart's height class, by category count.
 *
 * A FUNCTION RETURNING LITERALS, never arithmetic — `` className={`h-[${n}px]`} ``
 * is a class Tailwind v4 NEVER GENERATES, because it scans source text for
 * complete class names, and it fails SILENTLY: zero height, and a height-less
 * `ResponsiveContainer` parent renders NOTHING AT ALL.
 *
 * The two values are lifted verbatim from the shipped functions for the same
 * category counts — `speedZoneChartHeightClass(5)` and
 * `distributionChartHeightClass(8)` — rather than re-tuned. Neither of those
 * could simply be called: the first is typed to the literal `5` and the second to
 * `3 | 4 | 8 | 9`, so one function cannot serve both counts, and this route mounts
 * both. The exhaustive `never` keeps a third count a compile error here too.
 *
 * The `dynamic()` skeleton fallback calls THIS SAME FUNCTION, so the fallback and
 * the chart cannot drift in height (a CLS hit against the budget the code-split
 * protects).
 */
export function compareBarChartHeightClass(categoryCount: 5 | 8): string {
  switch (categoryCount) {
    case 5:
      return "h-[196px] md:h-[228px]";
    case 8:
      return "h-[302px] md:h-[348px]";
    default: {
      const unexpected: never = categoryCount;
      throw new Error(
        `compare-model: unsupported compare bar category count ${JSON.stringify(unexpected)}`
      );
    }
  }
}

/* ------------------------------- Section ids ------------------------------- */

/*
 * STABLE ENGLISH ANCHOR IDS, on the shipped convention (`deferred-work.md:
 * 2236-2243`). NOT `SectionId` values: `tactical-sections.ts` is do-not-touch and
 * its `SectionId` union is closed at eleven members, so widening it for a route
 * that has no collapsible shell was rejected outright.
 */
export const COMPARE_STATS_SECTION_ID = "stats";
export const COMPARE_CHARTS_SECTION_ID = "charts";

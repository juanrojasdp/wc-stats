import type {
  EntityRef,
  MetricCode,
  PhysicalProfile,
  PlayerMatchRow,
  PlayerProfile,
  Stage,
} from "@/lib/contract/contract-types";
import {
  LEADERBOARD_FORMAT,
  LEADERBOARD_UNIT,
  type LeaderboardFormat,
  type LeaderboardUnit,
} from "@/viz/leaderboard-model";
import { countAxisMax, countTicks } from "@/viz/goalkeeping-model";
import { percentAxisMax, percentTicks } from "@/viz/phases-model";

/*
 * `/players/{slug}`'s decision layer, as a PURE module (Story 2.15): no React,
 * no DOM, no t(), no fetch, no `@/lib/format`. The harness has no jsdom, so
 * anything decided inside a component is structurally untestable — every
 * keying, ordering, axis and guard decision lives here so
 * `player-profile-model.test.ts` can hold it.
 *
 * SELECTION AND PRESENTATION ONLY (AD-5 / AR-5). Nothing here sums, averages,
 * ranks or re-orders: `aggregates[]`, `trends[]` and `matches[]` are rendered in
 * the ARTIFACT'S OWN ORDER, and the only thing this file adds to a row is a
 * stable `key`. A profile is cross-match by definition, so AD-5's single-bundle
 * carve-out does not apply here at all.
 *
 * THE ARTIFACT IS TOTAL IN SHAPE, AND THIS FILE NEVER BRANCHES ON SHAPE (ruled
 * D8). Story 1.18 R2 shipped totality on all 1,248 files: every player carries
 * all eighteen aggregates and all six trend series, the 209 zero-appearance
 * players (16.7%) included — their values are `0` and their `matches[]` and
 * `points[]` are `[]`. So there is no `if (aggregates.length === 0)` and no
 * per-position column set anywhere below. EMPTINESS is a different question and
 * is answered by the SECTIONS (`matches.length === 0` renders an
 * `EmptyStatePanel`, UX-DR13); the model reports it and decides nothing about
 * it.
 *
 * EVERY ROW IS BUILT EAGERLY, and that is Story 2.9's review finding rather than
 * a preference: the trend and physical tables sit behind `ViewDataDisclosure`,
 * so a value that throws in the format layer would throw WHEN THE READER OPENS
 * THE DISCLOSURE — the deferred throw the eager-build convention exists to
 * prevent. "Guard at model entry and fail loud on load." Everything numeric is
 * checked here, at load, naming the player.
 */

/* ------------------------------ Metric precision --------------------------- */

/**
 * How a metric prints ON A PROFILE — `LEADERBOARD_FORMAT` with exactly ONE
 * override, and the override is a correctness fix rather than a preference.
 *
 * `LEADERBOARD_FORMAT.totalDistance` is `"integer"`, which is right for the
 * leaderboards artifact and WRONG here. Measured across the real corpus:
 * `totalDistance` is fractional in 918 of 1,248 aggregates and in 2,937 of 3,288
 * per-match rows (Story 1.18's precision rule puts metres at 1 dp). Printing
 * 47.274,9 m as "47.275" is the App silently rounding a precomputed value, which
 * is exactly what AR-5's "read verbatim" forbids — and it is invisible, because
 * a rounded distance still looks like a distance.
 *
 * Every other code this route renders already agrees: `topSpeed` is `decimal1`,
 * `passCompletion` is `percent` (1 dp), and the remaining fifteen are integer
 * counts with 0 fractional values corpus-wide.
 *
 * IT IS A NARROWING, NOT A SECOND TABLE. The unit assignment
 * (`LEADERBOARD_UNIT`) is untouched and still contract-fixed, and the base map
 * is still `Record<MetricCode, …>`, so a new contract code remains a compile
 * error there rather than a silent default here.
 */
export function profileMetricFormat(code: MetricCode): LeaderboardFormat {
  return code === "totalDistance" ? "decimal1" : LEADERBOARD_FORMAT[code];
}

/* ------------------------------- Entry guards ------------------------------ */

/**
 * THREE ABSENT STATES, NOT TWO — `hub-model.ts`'s `listOf`, restated for this
 * artifact because the reason transfers exactly. Every array below arrives
 * inside an `as`-cast, unvalidated JSON payload: `fetchArtifact<PlayerProfile>`
 * ASSERTS the shape, it does not check it. So a field the contract declares
 * required can still be `undefined` at runtime, and `null` is the shape the
 * contract uses for "not carried" while `[]` means "carried, empty".
 *
 * Normalizing all three to `[]` here — at the boundary, once — is what lets
 * every section treat its rows as a plain array and render a real zero state
 * instead of throwing on `.map` of undefined. It normalizes for RENDERING only:
 * it never invents a row and never drops one.
 */
function listOf<Item>(value: readonly Item[] | null | undefined): readonly Item[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Rejects a value `@/lib/format` would throw on, WHERE THE PLAYER CAN STILL BE
 * NAMED.
 *
 * `format.ts` throws `format: non-finite value NaN — handle null/absent fields
 * before formatting` and cannot say more, because by then it holds a bare
 * number. At 1,248 routes that message is a search; this one is a fix.
 */
function finite(value: number, playerId: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `player-profile-model: ${playerId} has a non-finite "${field}" (${String(value)}); ` +
        `every Domain G leaf is non-nullable by contract.`
    );
  }
  return value;
}

/*
 * The date guard, mirroring `format.ts`'s own `DATE_ONLY` anchor.
 *
 * RESTATED RATHER THAN IMPORTED, deliberately: `src/viz/**` keeps `@/lib/format`
 * out by design discipline so the pure models stay locale-free, and this is a
 * VALIDITY question, not a formatting one. `formatDate` throws on a malformed
 * string — and the per-match table's date cell is inside a disclosure on some
 * layouts — so the string is checked at model entry instead, naming the row.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * WELL-FORMED IS NOT ENOUGH — the value must be a REAL CALENDAR DATE.
 *
 * `Date.UTC` silently rolls out-of-range components over (month 13 becomes
 * January of the next year, day 40 becomes the 9th of the next month), so
 * "2026-13-40" passes a shape-only regex and then renders as a PLAUSIBLE BUT
 * WRONG date. `format.ts`'s `utcDateFrom` rejects exactly this by round-tripping
 * the components back out of the constructed `Date`; the same check runs here,
 * at model entry, so the failure lands on LOAD rather than the first time a
 * reader opens a disclosure containing that row.
 */
function isoDate(value: string, playerId: string, matchId: string): string {
  const match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  const utc =
    match === null
      ? null
      : new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const isRealDate =
    match !== null &&
    utc !== null &&
    utc.getUTCMonth() === Number(match[2]) - 1 &&
    utc.getUTCDate() === Number(match[3]);
  if (!isRealDate) {
    throw new Error(
      `player-profile-model: ${playerId} match ${matchId} has a malformed date ` +
        `${JSON.stringify(value)}; @/lib/format would throw on it inside a disclosure.`
    );
  }
  return value;
}

/* ------------------------------ Aggregates --------------------------------- */

export interface AggregateRow {
  key: string;
  metricCode: MetricCode;
  value: number;
  /** From the contract-fixed table in `leaderboard-model`, never re-derived. */
  unit: LeaderboardUnit;
  format: LeaderboardFormat;
}

/**
 * All eighteen aggregates, IN ARTIFACT ORDER (D5).
 *
 * All eighteen, not the four the Hero selects: SM-C2 puts depth behind
 * disclosure and forbids deleting it to tidy a hero. The order is the
 * artifact's own (alphabetical by code, as emitted) and is never re-sorted —
 * the table mounts with `sortState === null`, which IS that order, and its
 * caption says so.
 *
 * `perNinety` IS DELIBERATELY NOT PROJECTED (ruled D3). The denominator
 * explodes: 62 players have 1–14 minutes and the corpus maximum is 104,139.0
 * (`stewart-ross-sco`, `totalDistance`, 1,157.1 m over ONE minute). A minutes
 * floor would be a product rule this story does not have, and unsuppressed it
 * puts a six-digit number beside a four-digit one in the same column. The field
 * stays in the artifact untouched.
 */
export function aggregateRows(profile: PlayerProfile): AggregateRow[] {
  return listOf(profile.aggregates).map((aggregate) => ({
    key: `aggregate-${aggregate.metricCode}`,
    metricCode: aggregate.metricCode,
    value: finite(aggregate.value, profile.playerId, `aggregates.${aggregate.metricCode}`),
    unit: LEADERBOARD_UNIT[aggregate.metricCode],
    format: profileMetricFormat(aggregate.metricCode),
  }));
}

/* -------------------------------- Physical --------------------------------- */

/** The five speed bands, as a frozen list. NEVER `Object.keys` on a fixture. */
export const SPEED_ZONES = [1, 2, 3, 4, 5] as const;

export type SpeedZone = (typeof SPEED_ZONES)[number];

export interface SpeedZoneRow {
  key: string;
  zone: SpeedZone;
  /** Metres. `totalDistance` on a player profile is METRES, never kilometres. */
  metres: number;
}

export interface PhysicalModel {
  zones: SpeedZoneRow[];
  highSpeedRuns: number;
  sprints: number;
  topSpeed: number;
}

/**
 * The physical block: five zone rows plus the three tile values (AC 2).
 *
 * `totalDistance` IS ABSENT FROM THIS MODEL ON PURPOSE, and so is any sum of the
 * zones. Story 1.10's reconciliation tolerance is |totalDistance − Σ zones| ≤
 * 0.35 m (worst observed 0.200 m over 3,289 rows), so the bands are CLOSE to the
 * total and are not a decomposition of it. Rendering a zone-derived total would
 * be both a client-side derivation (AD-5) and a number that disagrees with the
 * one in the aggregates table by up to a third of a metre.
 */
export function physicalModel(profile: PlayerProfile): PhysicalModel {
  const physical: PhysicalProfile = profile.physical;
  return {
    zones: SPEED_ZONES.map((zone) => ({
      key: `zone-${zone}`,
      zone,
      metres: finite(
        physical[`distanceZone${zone}` as const],
        profile.playerId,
        `physical.distanceZone${zone}`
      ),
    })),
    highSpeedRuns: finite(physical.highSpeedRuns, profile.playerId, "physical.highSpeedRuns"),
    sprints: finite(physical.sprints, profile.playerId, "physical.sprints"),
    topSpeed: finite(physical.topSpeed, profile.playerId, "physical.topSpeed"),
  };
}

/* ------------------------------- Per-match --------------------------------- */

export interface MatchRow extends PlayerMatchRow {
  key: string;
}

/**
 * `matches[]` verbatim, chronological, keyed by `matchId` (AC 1's "full" table).
 *
 * `matchId` IS THE KEY and is unique by construction — one row per match, which
 * is also why `hub-model`'s "never `rank`, never the array index" rule is
 * satisfiable here with the id alone.
 *
 * `henderson-jordan-eng` IS WHY NOTHING HERE COUNTS ROWS AGAINST A TEAM'S MATCH
 * COUNT. Story 1.18 filters `matches[]` to lineups-with-minutes, so his m092
 * unused-substitute row — which the source report prints as an all-zero line —
 * is ABSENT from the artifact entirely: "the zero surfaces as the correct
 * absence of an appearance, not as a zeroed appearance". A "why is this match
 * missing?" note keyed off the team's fixtures would contradict the artifact.
 */
export function matchRows(profile: PlayerProfile): MatchRow[] {
  return listOf(profile.matches).map((row) => {
    const playerId = profile.playerId;
    const at = (field: keyof PlayerMatchRow, value: number): number =>
      finite(value, playerId, `matches.${row.matchId}.${String(field)}`);
    return {
      ...row,
      key: row.matchId,
      date: isoDate(row.date, playerId, row.matchId),
      minutesPlayed: at("minutesPlayed", row.minutesPlayed),
      goals: at("goals", row.goals),
      attemptsAtGoal: at("attemptsAtGoal", row.attemptsAtGoal),
      passesAttempted: at("passesAttempted", row.passesAttempted),
      passesCompleted: at("passesCompleted", row.passesCompleted),
      passCompletion: at("passCompletion", row.passCompletion),
      ballProgressions: at("ballProgressions", row.ballProgressions),
      duelsWonAerial: at("duelsWonAerial", row.duelsWonAerial),
      duelsWonPhysical: at("duelsWonPhysical", row.duelsWonPhysical),
      totalDistance: at("totalDistance", row.totalDistance),
      topSpeed: at("topSpeed", row.topSpeed),
    };
  });
}

/** The `Stage` of a row, for the `enums.stage.*` label the column head needs. */
export function matchRowStage(row: MatchRow): Stage {
  return row.stage;
}

/* --------------------------------- Trends ---------------------------------- */

export interface TrendPointModel {
  key: string;
  matchId: string;
  value: number;
  /** Joined from `matches[]` — the artifact carries only `matchId` on a point. */
  date: string;
  opponent: EntityRef;
}

export interface TrendSeriesModel {
  key: string;
  metricCode: MetricCode;
  unit: LeaderboardUnit;
  format: LeaderboardFormat;
  points: TrendPointModel[];
}

/**
 * The six trend series, IN ARTIFACT ORDER, each point joined to its match row.
 *
 * THE JOIN IS A REAL INTEGRITY GATE, not plumbing. A `TrendPoint` carries only
 * `{matchId, value}`, and the x-axis label and the data-table alternative both
 * need the match's date and opponent — so a point whose `matchId` is not in
 * `matches[]` has no identity at all and would render an anonymous mark. Checked
 * across all 1,248 real profiles: 0 violations, and every series carries exactly
 * one point per match row. It therefore never fires on a good artifact, which is
 * precisely what makes it worth throwing on.
 *
 * The DEFAULT SERIES is `[0]` — the artifact's first, which is its canonical
 * order (AR-5). Never an alphabetical or "most interesting" pick.
 */
export function trendSeries(profile: PlayerProfile): TrendSeriesModel[] {
  const byMatchId = new Map(listOf(profile.matches).map((row) => [row.matchId, row]));
  return listOf(profile.trends).map((series) => ({
    key: `trend-${series.metricCode}`,
    metricCode: series.metricCode,
    unit: LEADERBOARD_UNIT[series.metricCode],
    format: profileMetricFormat(series.metricCode),
    points: listOf(series.points).map((point) => {
      const match = byMatchId.get(point.matchId);
      if (match === undefined) {
        throw new Error(
          `player-profile-model: ${profile.playerId} trend "${series.metricCode}" ` +
            `references match ${point.matchId}, which is absent from matches[]; ` +
            `the point has no date or opponent to identify it by.`
        );
      }
      return {
        key: `${series.metricCode}-${point.matchId}`,
        matchId: point.matchId,
        value: finite(
          point.value,
          profile.playerId,
          `trends.${series.metricCode}.${point.matchId}`
        ),
        date: isoDate(match.date, profile.playerId, match.matchId),
        opponent: match.opponent,
      };
    }),
  }));
}

/* ---------------------------------- Axes ----------------------------------- */

/**
 * Which tick generator a metric's axis takes. The six trend series span FOUR
 * unit types, so one generator cannot serve them (D6).
 */
export type AxisFamily = "count" | "percent" | "decimal";

export function axisFamily(unit: LeaderboardUnit): AxisFamily {
  if (unit === "percent") {
    return "percent";
  }
  if (unit === "count") {
    return "count";
  }
  if (unit === "km" || unit === "m" || unit === "kmh") {
    return "decimal";
  }
  const unexpected: never = unit;
  throw new Error(`player-profile-model: unhandled LeaderboardUnit ${JSON.stringify(unexpected)}`);
}

export interface Axis {
  ticks: number[];
  min: number;
  max: number;
}

/**
 * How many decimal places a decimal-family axis quantizes to. Story 1.18's
 * precision rule: metres 1 dp, km/h 1 dp, kilometres 2.
 */
function axisDecimals(unit: LeaderboardUnit): number {
  return unit === "km" ? 2 : 1;
}

/**
 * A `[niceMin, niceMax]` axis for a DECIMAL, NOT-ZERO-BASED family — km/h and
 * metres (ruled D6).
 *
 * WHY IT CANNOT BE `countTicks`. A count-floored generator anchors at zero and
 * nices the top, so a real 32,0–33,0 km/h series lands on `[0, 36]` with three
 * ticks and renders as a flat line pinned to the top of the plot: the whole
 * point of a trend — that it moved — is erased. `countTicks(9500)` is the same
 * story for metres, at `0 / 5000 / 10000`.
 *
 * NON-ZERO BASELINES ARE HONEST HERE AND WOULD NOT BE ON A BAR. `TrendChart`
 * draws a LINE, whose vertical position encodes the value against a labelled
 * axis; a bar encodes its LENGTH, so truncating its baseline misstates it. That
 * is why `SpeedZoneChart` (bars) uses the zero-based count family below and this
 * one does not.
 *
 * ALL ARITHMETIC IS IN INTEGER UNITS of 10^-decimals. Accumulating a 0.1 step in
 * floating point drifts (0.1+0.2 !== 0.3), and a tick that misses its own
 * `domain` bound by 1e-15 is a tick recharts drops.
 */
export function decimalAxis(values: readonly number[], decimals: number): Axis {
  const scale = Math.pow(10, decimals);
  const units = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.round(value * scale));
  /*
   * NEVER DEGENERATE, in every empty/flat case. recharts cannot scale `[n, n]`
   * — every mark resolves to the same or a NaN coordinate — and both cases are
   * REAL here: 209 players have no points at all, and a one-match player (191 of
   * them) has exactly one, so min === max is the common case, not the edge.
   */
  if (units.length === 0) {
    return { ticks: [0, 1], min: 0, max: 1 };
  }
  const minUnit = Math.min(...units);
  const maxUnit = Math.max(...units);
  const stepUnit = niceStep(maxUnit - minUnit);
  let lowUnit = Math.floor(minUnit / stepUnit) * stepUnit;
  let highUnit = Math.ceil(maxUnit / stepUnit) * stepUnit;
  if (highUnit === lowUnit) {
    // A flat or single-point series: centre it in one step of headroom rather
    // than pinning it to an axis edge, and never emit a zero-width domain.
    lowUnit -= stepUnit;
    highUnit += stepUnit;
  }
  const ticks: number[] = [];
  for (let unit = lowUnit; unit <= highUnit; unit += stepUnit) {
    ticks.push(unit / scale);
  }
  return { ticks, min: lowUnit / scale, max: highUnit / scale };
}

/**
 * The smallest 1/2/5-times-a-power-of-ten giving at most ~5 ticks over `span`,
 * floored at ONE UNIT so the step can never be zero.
 *
 * `momentumYTicks`' step selection, in integer units. Same 1/2/5 ladder, same
 * `Math.max(1, …)` floor, same reason: a step of 0 is an infinite loop and a
 * fractional step in a quantized domain emits ticks that cannot be printed at
 * the metric's own precision.
 */
function niceStep(span: number): number {
  const safeSpan = Math.max(1, Number.isFinite(span) ? span : 1);
  const target = safeSpan / 4;
  const exponent = Math.floor(Math.log10(target));
  const base = Math.pow(10, exponent);
  let step = base * 10;
  for (const multiple of [1, 2, 5, 10]) {
    if (base * multiple >= target) {
      step = base * multiple;
      break;
    }
  }
  return Math.max(1, Math.round(step));
}

/**
 * The axis for one trend series, dispatched by unit family (D6).
 *
 * `percentTicks` and `countTicks` are REUSED rather than restated — both are
 * shipped, property-tested and already floor their maxima so `[0, 0]` is
 * impossible. Only the decimal family needed minting.
 */
export function trendAxis(unit: LeaderboardUnit, values: readonly number[]): Axis {
  const family = axisFamily(unit);
  if (family === "decimal") {
    return decimalAxis(values, axisDecimals(unit));
  }
  const peak = values.reduce((best, value) => (value > best ? value : best), 0);
  if (family === "percent") {
    return { ticks: percentTicks(peak), min: 0, max: percentAxisMax(peak) };
  }
  return { ticks: countTicks(peak), min: 0, max: countAxisMax(peak) };
}

/**
 * The speed-zone axis. ALWAYS ZERO-BASED — these are bars, and a bar encodes its
 * length as the value, so a truncated baseline is a misstatement rather than a
 * scaling choice.
 */
export function speedZoneAxis(metres: readonly number[]): Axis {
  const peak = metres.reduce((best, value) => (value > best ? value : best), 0);
  return { ticks: countTicks(peak), min: 0, max: countAxisMax(peak) };
}

/* ------------------------------ Chart heights ------------------------------ */

/**
 * The trend chart's height class.
 *
 * A CONST OF LITERAL CLASSES, never arithmetic. `` className={`h-[${n}px]`} ``
 * is a class Tailwind v4 NEVER GENERATES — it scans source text for complete
 * class names — and it fails silently: zero height, and a height-less
 * `ResponsiveContainer` parent renders NOTHING AT ALL, recharts' single most
 * common failure mode.
 *
 * Fixed rather than per-point, unlike the zone chart below: the x axis is
 * categorical with at most 8 entries, so the plot's HEIGHT does not depend on
 * how many matches a player has.
 */
export const TREND_CHART_HEIGHT_CLASS = "h-[192px] md:h-[248px]";

/**
 * The speed-zone chart's height class, by band count — `distributionChartHeight
 * Class`'s shape, and the reason a sibling was needed rather than a reuse:
 * that function's parameter is typed `3 | 4 | 8 | 9` with an exhaustive `never`
 * default, so calling it with FIVE bands is a compile error and, cast past that,
 * a runtime throw.
 *
 * Five horizontal single-series bars need less room than four category PAIRS,
 * so this is not the same arithmetic either. Every class is written out
 * statically where Tailwind's scanner can see it, and the consuming section's
 * `dynamic()` skeleton calls THIS SAME FUNCTION so fallback and chart cannot
 * drift in height (a CLS hit against the budget the code-split protects).
 */
export function speedZoneChartHeightClass(bandCount: 5): string {
  switch (bandCount) {
    case 5:
      return "h-[196px] md:h-[228px]";
    default: {
      const unexpected: never = bandCount;
      throw new Error(
        `speedZoneChartHeightClass: unsupported band count ${JSON.stringify(unexpected)}`
      );
    }
  }
}

/* --------------------------------- Anchors --------------------------------- */

/**
 * The route's four section anchors (UX-DR18).
 *
 * PLAIN `<section id>` VALUES, NOT `SectionId`s. `tactical-sections.ts` closes
 * that union at eleven members and is do-not-touch, `TacticalSection`'s `id`
 * prop is typed to it, and this route has no collapsible section shell at all —
 * sections 2–5 are ordinary blocks in normal flow. Widening `SectionId` or
 * building a second expansion model was rejected in the story's Route
 * Composition; these ids exist only so the sections can be linked to.
 */
export const PHYSICAL_SECTION_ID = "physical";
export const TRENDS_SECTION_ID = "trends";
export const AGGREGATES_SECTION_ID = "aggregates";
export const MATCHES_SECTION_ID = "matches";

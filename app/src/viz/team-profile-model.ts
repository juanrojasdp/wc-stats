import type {
  AggregateInPossessionShapePanels,
  AggregateOutOfPossessionShapePanels,
  AggregateShapeMetrics,
  BlockLevel,
  EntityRef,
  MatchResult,
  Stage,
  TeamProfile,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import {
  BLOCK_LEVELS,
  blockLevelKey,
  distributionChartHeightClass,
  IN_POSSESSION_PHASES,
  IN_POSSESSION_PROPERTY,
  inPossessionPhaseKey,
  OUT_OF_POSSESSION_PHASES,
  OUT_OF_POSSESSION_PROPERTY,
  outOfPossessionPhaseKey,
  percentAxisMax,
  percentTicks,
  PRESS_PHASES,
} from "@/viz/phases-model";

/*
 * `/teams/{slug}`'s decision layer, as a PURE module (Story 2.16): no React, no
 * DOM, no t(), no fetch, no `@/lib/format`. The harness has no jsdom, so
 * anything decided inside a component is structurally untestable — every keying,
 * ordering, axis and guard decision lives here so `team-profile-model.test.ts`
 * can hold it.
 *
 * SELECTION AND PRESENTATION ONLY (AD-5 / AR-5). Nothing here sums, averages,
 * ranks or re-orders. `matches[]` and `formationUsage[]` render in the ARTIFACT'S
 * OWN ORDER and the only thing this file adds to a row is a stable `key`. A team
 * profile is cross-match by definition, so AD-5's single-bundle carve-out does
 * not apply here at all — "the App never sums a team's matches" is the contract's
 * own wording on `TeamProfile`.
 *
 * THE FROZEN ENUM LISTS AND KEY BUILDERS ARE IMPORTED, NEVER RE-MINTED
 * (`phases-model.ts`, read-only). `IN_POSSESSION_PHASES`, `OUT_OF_POSSESSION_
 * PHASES`, `PRESS_PHASES` and `BLOCK_LEVELS` are each pinned by an i18n
 * exhaustiveness assertion in both locales; a second copy here would drift out
 * from under those assertions silently.
 *
 * EVERY CHART ON THIS ROUTE IS SINGLE-SERIES, and that is ruled (D1). The
 * artifact carries no opponent series — `tacticalIdentity` is one team's
 * aggregates and `matches[].opponent` is a bare `EntityRef` with no metrics
 * attached — so `CategoryRow` carries ONE value where `phases-model`'s `PhaseRow`
 * carries `home` and `away`. The Team B non-hue channel is Story 2.17's, the
 * genuine first two-team surface.
 */

/* ------------------------------ Section anchors ---------------------------- */

/*
 * STABLE ENGLISH ANCHOR IDS, and deliberately NOT `SectionId`s. `TacticalSection`
 * is do-not-touch and its `id` prop is typed to the closed eleven-member
 * `SectionId` union; this route has no collapsible shell to widen it for, and
 * `ViewDataDisclosure` is the viz-alternative control rather than a section
 * shell. Plain `<section>` + `<h2>` in normal flow, per the route's ruled
 * composition.
 */
export const IDENTITY_SECTION_ID = "tactical-identity";
export const FORMATIONS_SECTION_ID = "formations";
export const TEAM_MATCHES_SECTION_ID = "matches";

/* --------------------------------- Guards ---------------------------------- */

/**
 * Fail loud, NAMING THE TEAM AND THE FIELD.
 *
 * `format.ts` throws `format: non-finite value NaN — handle null/absent fields
 * before formatting` and cannot say more, because by then it holds a bare
 * number. At 48 routes that message is a search; this one is a fix.
 *
 * EVERY LEAF ON `TeamProfile` IS REQUIRED AND NON-NULLABLE — the root `required`
 * lists all nine properties and every `$defs` object is `additionalProperties:
 * false` with all properties required — so a non-finite value is a broken
 * artifact, not a shape this route may branch on (D9).
 */
function finite(value: number, teamId: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `team-profile-model: ${teamId} has a non-finite "${field}" (${String(value)}); ` +
        `every TeamProfile leaf is required and non-nullable by contract.`
    );
  }
  return value;
}

/*
 * The date guard, mirroring `player-profile-model`'s and `format.ts`'s own
 * anchor. RESTATED RATHER THAN IMPORTED, deliberately: `src/viz/**` keeps
 * `@/lib/format` out by design discipline so the pure models stay locale-free.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: string, teamId: string): string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new Error(
      `team-profile-model: ${teamId} has a malformed match date (${String(value)}); ` +
        `TeamMatchBreakdown.date is a contracted ISO calendar date.`
    );
  }
  return value;
}

/* ------------------------------ The rate charts ---------------------------- */

/**
 * One single-entity category: a label key and ONE value.
 *
 * `value` is RAW PERCENTAGE POINTS (`formatPercent`'s contract: 62 -> "62%"),
 * unformatted and un-normalized — the section owns the locale and the format
 * layer.
 */
export interface CategoryRow {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  value: number;
}

/**
 * One rate chart, complete: its rows, its explicit axis, and its height class.
 *
 * THE AXIS IS NEVER LEFT TO RECHARTS. Its automatic generator emitted
 * `+17, +1, -8, -17` on m074 — four ticks, unevenly spaced, with no zero tick at
 * all — and every bar chart here reads its length as the value, so a missing or
 * non-zero baseline is a misstatement rather than a cosmetic issue.
 *
 * `categoryCount` is narrowed to the four `distributionChartHeightClass` accepts.
 * That is not a coincidence to be maintained by hand: the four rate charts are
 * exactly 8 / 9 / 3 / 4 categories, and the function throws on anything else via
 * an exhaustive `never`.
 */
export interface RateChartModel {
  rows: CategoryRow[];
  ticks: number[];
  axisMax: number;
  heightClass: string;
  categoryCount: 3 | 4 | 8 | 9;
  /** Pixels reserved for the category axis — see `RATE_CATEGORY_AXIS_WIDTH`. */
  categoryAxisWidth: number;
}

/**
 * Pixels reserved for the CATEGORY (y) axis on the four rate charts.
 *
 * IT LIVES IN THE PURE MODEL, not at the call site and not imported from the
 * chart. Everything in `ProfileCharts.tsx` sits on the deferred side of the
 * `Charts.tsx` lazy boundary, so importing a const from it would create a static
 * import edge to recharts and pull ~300 kB into the eager bundle — defeating the
 * code-split that barrel exists to protect. This module already owns every other
 * axis decision (ticks, axisMax, heightClass), so it owns this one too.
 *
 * 96 px, matching `DistributionChart`'s, because it fits `AXIS_LABEL_MAX_CHARS`
 * at the 11 px type floor. The chart's own 62 px default is sized for "Zona 1" …
 * "Zona 5"; at phase-name length it overlapped and clipped — measured on
 * `/teams/mexico/`: "Salida de balón sin presión" and "Salida de balón con
 * presión" collided vertically, "Progresión" rendered as "rogresión".
 */
export const RATE_CATEGORY_AXIS_WIDTH = 96;

/** The largest value across a single-series row set — the axis max's input. */
function rowsPeak(rows: readonly CategoryRow[]): number {
  let peak = 0;
  for (const row of rows) {
    peak = Math.max(peak, row.value);
  }
  return peak;
}

function toRateChart(rows: CategoryRow[], categoryCount: 3 | 4 | 8 | 9): RateChartModel {
  const peak = rowsPeak(rows);
  return {
    rows,
    ticks: percentTicks(peak),
    axisMax: percentAxisMax(peak),
    heightClass: distributionChartHeightClass(categoryCount),
    categoryCount,
    categoryAxisWidth: RATE_CATEGORY_AXIS_WIDTH,
  };
}

/** The four rate charts this route renders, each in its frozen enum order. */
export interface IdentityChartModels {
  /** The eight in-possession phase rates. */
  inPossession: RateChartModel;
  /** The nine out-of-possession phase rates. */
  outOfPossession: RateChartModel;
  /** The three defensive block levels. */
  blocks: RateChartModel;
  /** The four press rates — a frozen ordered SUBSET of the nine. */
  press: RateChartModel;
}

/**
 * The tournament-wide tactical identity as four independent bar charts.
 *
 * THE SEVEN-VALUE DUPLICATION IS DELIBERATE AND INHERITED (D11). Seven of the
 * nine out-of-possession rates appear twice on this page — once in
 * `outOfPossession` and once in `press` or `blocks`. Mexico's
 * `phasesOutOfPossession.highBlock` is 4.0 and `defensiveBlockDistribution.high`
 * is 4.0: the same number from the same contract fields. The source keeps
 * `high-press` and `high-block` as SEPARATE enum values, so no reading collapses
 * them, and nothing here is recomputed. `deferred-work.md` names Story 2.16 as
 * the owner of that ruling. Do not dedupe it; do not annotate it as an error.
 *
 * NONE OF THE FOUR IS A PARTITION (D10), which is why they are four separate
 * grouped charts and never a stacked 100% bar, a pie, or a "remainder" segment:
 * `defensiveBlockDistribution` sums to 46.4 on Mexico, `shapeByPhase`'s own
 * schema description says "not a partition and not aggregable across panels",
 * and the 8 + 9 phase rates are independent rates whose corpus sums run 84–149
 * in possession and 73–97 out of it.
 */
export function identityCharts(profile: TeamProfile): IdentityChartModels {
  const { teamId } = profile;
  const identity = profile.tacticalIdentity;

  const inPossession = IN_POSSESSION_PHASES.map<CategoryRow>((code) => ({
    key: `in-${code}`,
    code,
    labelKey: inPossessionPhaseKey(code),
    value: finite(
      identity.phasesInPossession[IN_POSSESSION_PROPERTY[code]],
      teamId,
      `phasesInPossession.${IN_POSSESSION_PROPERTY[code]}`
    ),
  }));

  const outOfPossession = OUT_OF_POSSESSION_PHASES.map<CategoryRow>((code) => ({
    key: `out-${code}`,
    code,
    labelKey: outOfPossessionPhaseKey(code),
    value: finite(
      identity.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
      teamId,
      `phasesOutOfPossession.${OUT_OF_POSSESSION_PROPERTY[code]}`
    ),
  }));

  const press = PRESS_PHASES.map<CategoryRow>((code) => ({
    key: `press-${code}`,
    code,
    labelKey: outOfPossessionPhaseKey(code),
    value: finite(
      identity.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
      teamId,
      `phasesOutOfPossession.${OUT_OF_POSSESSION_PROPERTY[code]}`
    ),
  }));

  const blocks = BLOCK_LEVELS.map<CategoryRow>((code: BlockLevel) => ({
    key: `block-${code}`,
    code,
    labelKey: blockLevelKey(code),
    value: finite(
      identity.defensiveBlockDistribution[code],
      teamId,
      `defensiveBlockDistribution.${code}`
    ),
  }));

  return {
    inPossession: toRateChart(inPossession, 8),
    outOfPossession: toRateChart(outOfPossession, 9),
    blocks: toRateChart(blocks, 3),
    press: toRateChart(press, 4),
  };
}

/* ----------------------------- The shape tables ---------------------------- */

/*
 * `shapeByPhase` RENDERS AS TWO TABLES, NEVER AS A CHART, and it is ruled (D13).
 *
 * Eighteen values across 2 possession states x 3 panels x 3 measures cannot be
 * charted by anything in this codebase. The single-series bar chart takes ONE
 * series and `DistributionChart` takes at most two, but three measures need
 * three; `--viz-single` is ONE colour, so three measures could not be
 * distinguished on one plot even if a chart accepted them; and 6 panels x 1
 * measure is a `categoryCount` of 6, which `distributionChartHeightClass` throws
 * on outright — and `phases-model.ts` is read-only here.
 *
 * A TABLE IS NOT A VIZ, so neither table carries a `ViewDataDisclosure`: the
 * disclosure is the text ALTERNATIVE to a figure, and a table needs no
 * alternative to itself.
 */

/** The three measures each panel carries, in the schema's declaration order. */
const SHAPE_MEASURE_ORDER: Record<keyof AggregateShapeMetrics, true> = {
  lineHeight: true,
  teamLength: true,
  teamWidth: true,
};

export type ShapeMeasure = keyof AggregateShapeMetrics;

/** `lineHeight` -> `teamLength` -> `teamWidth`, frozen. */
export const SHAPE_MEASURES: readonly ShapeMeasure[] = Object.keys(
  SHAPE_MEASURE_ORDER
) as ShapeMeasure[];

/*
 * The panel lists, as `Record`s keyed by the GENERATED interfaces rather than
 * bare arrays — `phases-model`'s ruling, for its reason: a bare
 * `readonly Panel[] = [...]` gives no compile-time exhaustiveness, so a panel
 * added to the contract would slip past both this list and the i18n
 * exhaustiveness suite that compares locale keys against it.
 */
const IN_POSSESSION_PANEL_ORDER: Record<keyof AggregateInPossessionShapePanels, true> = {
  buildUpLow: true,
  buildUpMid: true,
  finalThirdPhase: true,
};

const OUT_OF_POSSESSION_PANEL_ORDER: Record<keyof AggregateOutOfPossessionShapePanels, true> = {
  highBlockPress: true,
  midBlock: true,
  lowBlock: true,
};

export type InPossessionShapePanel = keyof AggregateInPossessionShapePanels;
export type OutOfPossessionShapePanel = keyof AggregateOutOfPossessionShapePanels;

export const IN_POSSESSION_SHAPE_PANELS: readonly InPossessionShapePanel[] = Object.keys(
  IN_POSSESSION_PANEL_ORDER
) as InPossessionShapePanel[];

export const OUT_OF_POSSESSION_SHAPE_PANELS: readonly OutOfPossessionShapePanel[] = Object.keys(
  OUT_OF_POSSESSION_PANEL_ORDER
) as OutOfPossessionShapePanel[];

/**
 * Dictionary key for a measure — `team.shape.measure.<measure>`.
 *
 * MINTED BY THIS STORY (R1, option A, taken by Juan). CS-2 reshaped
 * `shapeByPhase` from the v3 pair into these eighteen values and filed the
 * vocabulary to Story 2.19, but 2.19 has not run and `/teams/{slug}` is the
 * first surface that can render them. The only panel-neutral leaves that existed
 * were the possession-COMPOUND `viz.pressing.metre.*` keys, which CS-2 orphaned.
 */
export function shapeMeasureKey(measure: ShapeMeasure): DictionaryKey {
  // `as DictionaryKey` is mandatory: DictionaryKey is a literal union
  // (DotPaths<Dictionary>) and a template-literal expression infers `string`.
  // The cast is exactly why the exhaustiveness test in i18n.test.ts is not
  // optional.
  return `team.shape.measure.${measure}` as DictionaryKey;
}

/** Dictionary key for an in-possession panel — `team.shape.inPossession.<panel>`. */
export function inPossessionShapePanelKey(panel: InPossessionShapePanel): DictionaryKey {
  return `team.shape.inPossession.${panel}` as DictionaryKey;
}

/** Dictionary key for an out-of-possession panel. */
export function outOfPossessionShapePanelKey(panel: OutOfPossessionShapePanel): DictionaryKey {
  return `team.shape.outOfPossession.${panel}` as DictionaryKey;
}

/**
 * One panel's row: the panel label plus its three metre measurements.
 *
 * `DataTable<Row extends { key: string }>` requires `key`, and it is the PANEL
 * CODE — a stable identity, never an array index (the sort contract's first
 * rule).
 */
export interface ShapeRow {
  key: string;
  panel: string;
  labelKey: DictionaryKey;
  lineHeight: number;
  teamLength: number;
  teamWidth: number;
}

export interface ShapeTableModel {
  inPossession: ShapeRow[];
  outOfPossession: ShapeRow[];
}

function toShapeRow(
  panel: string,
  labelKey: DictionaryKey,
  metrics: AggregateShapeMetrics,
  teamId: string,
  state: string
): ShapeRow {
  return {
    key: `${state}-${panel}`,
    panel,
    labelKey,
    lineHeight: finite(metrics.lineHeight, teamId, `${state}.${panel}.lineHeight`),
    teamLength: finite(metrics.teamLength, teamId, `${state}.${panel}.teamLength`),
    teamWidth: finite(metrics.teamWidth, teamId, `${state}.${panel}.teamWidth`),
  };
}

/** The eighteen metre values as two tables, one per possession state (D13). */
export function shapeTables(profile: TeamProfile): ShapeTableModel {
  const { teamId } = profile;
  const shape = profile.tacticalIdentity.shapeByPhase;
  return {
    inPossession: IN_POSSESSION_SHAPE_PANELS.map((panel) =>
      toShapeRow(panel, inPossessionShapePanelKey(panel), shape.inPossession[panel], teamId, "inPossession")
    ),
    outOfPossession: OUT_OF_POSSESSION_SHAPE_PANELS.map((panel) =>
      toShapeRow(
        panel,
        outOfPossessionShapePanelKey(panel),
        shape.outOfPossession[panel],
        teamId,
        "outOfPossession"
      )
    ),
  };
}

/* ---------------------------- Formation usage ------------------------------ */

/**
 * One formation the team started, with its match count and share.
 *
 * `formation` IS LOCALE-NEUTRAL DATA and is never translated or
 * dictionary-mapped: "4-1-2-3" is a notation, not a term. It is also the row
 * key, which is safe because the artifact's own distribution cannot repeat a
 * formation.
 */
export interface FormationRow {
  key: string;
  formation: string;
  matches: number;
  share: number;
}

/**
 * `formationUsage` in ARTIFACT ORDER — descending by match count.
 *
 * THE ORDER IS PART OF THE CONTRACT, stated in the schema description
 * ("ordered by descending match count"), so re-sorting it here would be the App
 * re-deriving a precomputed ordering (AR-5). Max 4 rows corpus-wide.
 */
export function formationRows(profile: TeamProfile): FormationRow[] {
  const { teamId } = profile;
  return profile.formationUsage.map((row) => ({
    key: row.formation,
    formation: row.formation,
    matches: finite(row.matches, teamId, `formationUsage.${row.formation}.matches`),
    share: finite(row.share, teamId, `formationUsage.${row.formation}.share`),
  }));
}

/* --------------------------- The per-match rows ---------------------------- */

/**
 * One per-match breakdown row. All fifteen contracted fields survive the model —
 * `matchId` becomes the link TARGET rather than a column, and the rest are
 * columns.
 *
 * `distanceCovered` IS KILOMETRES (2 dp), never the player profile's METRES.
 * Story 1.10 rules the two must never cross: "convert explicitly and once".
 */
export interface TeamMatchRow {
  key: string;
  matchId: string;
  stage: Stage;
  date: string;
  opponent: EntityRef;
  isHome: boolean;
  result: MatchResult;
  goalsFor: number;
  goalsAgainst: number;
  formation: string;
  possession: number;
  expectedGoals: number;
  shots: number;
  shotsOnTarget: number;
  passCompletion: number;
  /** Kilometres, 2 dp — the TEAM-scope distance field. */
  distanceCovered: number;
}

/**
 * `matches[]` in the artifact's own order, which is chronological by contract
 * ("one row per match played, chronological").
 *
 * THAT ORDER IS THE TABLE'S DEFAULT AND IS DECLARED IN ITS CAPTION, never by a
 * sorted-on-mount column: `DataTable` has no `defaultSort` prop and one must not
 * be added — every table mounts at `null`, which IS the artifact order (AD-5).
 *
 * `matchId` IS the match route slug (AD-3) and `opponent` is a full `EntityRef`,
 * so the row's link and the opponent's display name need no second fetch.
 *
 * THE FOUR SHOOTOUT MATCHES READ `draw` AND THAT IS CORRECT (Story 1.18 R4):
 * `result` follows `metadata.score`, so a team that advanced on penalties shows
 * a draw chip on that row. Progression is carried ONLY by `record.furthestStage`
 * on the Hero. Do not annotate or override those rows — ruled Q3, taken by Juan:
 * no new copy.
 */
export function teamMatchRows(profile: TeamProfile): TeamMatchRow[] {
  const { teamId } = profile;
  return profile.matches.map((row) => ({
    key: row.matchId,
    matchId: row.matchId,
    stage: row.stage,
    date: isoDate(row.date, teamId),
    opponent: row.opponent,
    isHome: row.isHome,
    result: row.result,
    goalsFor: finite(row.goalsFor, teamId, `matches.${row.matchId}.goalsFor`),
    goalsAgainst: finite(row.goalsAgainst, teamId, `matches.${row.matchId}.goalsAgainst`),
    formation: row.formation,
    possession: finite(row.possession, teamId, `matches.${row.matchId}.possession`),
    expectedGoals: finite(row.expectedGoals, teamId, `matches.${row.matchId}.expectedGoals`),
    shots: finite(row.shots, teamId, `matches.${row.matchId}.shots`),
    shotsOnTarget: finite(row.shotsOnTarget, teamId, `matches.${row.matchId}.shotsOnTarget`),
    passCompletion: finite(row.passCompletion, teamId, `matches.${row.matchId}.passCompletion`),
    distanceCovered: finite(row.distanceCovered, teamId, `matches.${row.matchId}.distanceCovered`),
  }));
}

/* -------------------------------- The form strip --------------------------- */

/**
 * The Hero's form strip: `matches[].result` in the artifact's stated order.
 *
 * A PROJECTION, NOT AN AGGREGATION, which is what satisfies AR-5 — nothing is
 * summed, averaged or derived, each letter is a verbatim contracted enum value
 * and the ordering is the artifact's own.
 *
 * THE `form` FIELD YOU WILL FIND IS THE WRONG ONE (D3). `team-profile.schema.json`
 * has NO `form` property — the word appears there only inside `formationUsage` —
 * while `tournament.json`'s `groups[].standings[].form` IS a `MatchResult[]` and
 * is already chipped by `TournamentHub`. It is GROUP-STAGE ONLY (three entries
 * for a team that played eight), and `/teams/[slug]` touching `tournament.json`
 * at all would fail the per-route module-graph allow-list, which uses set
 * equality.
 */
export function formResults(profile: TeamProfile): MatchResult[] {
  return profile.matches.map((row) => row.result);
}

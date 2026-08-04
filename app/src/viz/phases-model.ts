import type {
  BlockLevel,
  DefensiveBlockDistribution,
  InPossessionPhase,
  InPossessionPhases,
  OutOfPossessionPhase,
  OutOfPossessionPhases,
  TacticalIdentityBlock,
  TeamTacticalIdentity,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import type { LogSide } from "@/viz/marker-model";

/*
 * Domain C -> the #phases and #pressing surfaces (Story 2.10, Tasks 2 and 4).
 *
 * THE ONE THING TO CARRY IN YOUR HEAD: THESE ARE NOT PARTITIONS. The eight
 * in-possession and nine out-of-possession values are INDEPENDENT per-phase
 * rates. Measured over 208 corpus team-innings: in-possession sums run 84-149
 * (median 107, equal to 100 on FIVE); out-of-possession 73-97 (median 87.5,
 * equal to 100 on ZERO). Nothing here or downstream may normalize them, stack
 * them, or draw them as slices of a whole — `InPossessionPhase`'s own
 * `description` says so, contract/README.md logged decision 5 says so, and the
 * 2.3 sign-off names this story: "renderers in 2.10/2.16 must never sum,
 * normalize, or pie these". Task 2.1's test makes that mechanical rather than
 * advisory.
 *
 * THE #phases / #pressing SPLIT (ruled decision 4). #phases renders all 17
 * rates — the Phases of Play page verbatim. #pressing renders the FOUR press
 * rates plus `defensiveBlockDistribution` plus the four metre values, so seven
 * of the nine out-of-possession rates appear in BOTH sections. That duplication
 * is deliberate and contract-sanctioned: `DefensiveBlockDistribution`'s
 * `$comment` names this story ("Story 2.10's #pressing section renders block
 * height as its own concept"), and #pressing's shipped, frozen summary promises
 * "intensidad de la presión" — copy that would be FALSE with the press rates
 * living only in #phases. It is also the <lg collapsed-shell copy, so a phone
 * reader hunting press intensity opens #pressing and never opens #phases.
 *
 * Pure and locale-free like every module under src/viz: dictionary KEYS and raw
 * numbers out, components resolve them. A t() call here is an ESLint error (the
 * client-import seam), and `@/lib/format` stays out by the same discipline.
 */

/* ------------------------------ Frozen enums ------------------------------ */

/*
 * A frozen list is a `Record`, NEVER a bare array (receiving-model's review
 * patch): `readonly Enum[] = [...]` gives no compile-time exhaustiveness — an
 * array stays assignable however many members the union gains, and the i18n
 * exhaustiveness suite compares locale keys against this very list, so a widened
 * enum would slip past both. `Object.keys` preserves insertion order for
 * non-numeric string keys, so the schema's declaration order survives.
 */

const IN_POSSESSION_ORDER: Record<InPossessionPhase, true> = {
  "build-up-unopposed": true,
  "build-up-opposed": true,
  progression: true,
  "final-third": true,
  "long-ball": true,
  "attacking-transition": true,
  "counter-attack": true,
  "set-piece": true,
};

/** The eight InPossessionPhase codes in the schema's declaration order. */
export const IN_POSSESSION_PHASES: readonly InPossessionPhase[] = Object.keys(
  IN_POSSESSION_ORDER
) as InPossessionPhase[];

/** Kebab enum code -> camelCase counts property (AD-7 keys labels by CODE). */
export const IN_POSSESSION_PROPERTY: Record<InPossessionPhase, keyof InPossessionPhases> = {
  "build-up-unopposed": "buildUpUnopposed",
  "build-up-opposed": "buildUpOpposed",
  progression: "progression",
  "final-third": "finalThird",
  "long-ball": "longBall",
  "attacking-transition": "attackingTransition",
  "counter-attack": "counterAttack",
  "set-piece": "setPiece",
};

/** Dictionary key for an in-possession phase — `enums.inPossessionPhase.<code>`. */
export function inPossessionPhaseKey(code: InPossessionPhase): DictionaryKey {
  // `as DictionaryKey` is mandatory: DictionaryKey is a literal union
  // (DotPaths<Dictionary>) and a template-literal expression infers `string`.
  // The cast is exactly why Task 8.5's exhaustiveness test is not optional.
  return `enums.inPossessionPhase.${code}` as DictionaryKey;
}

const OUT_OF_POSSESSION_ORDER: Record<OutOfPossessionPhase, true> = {
  "high-press": true,
  "mid-press": true,
  "low-press": true,
  "high-block": true,
  "mid-block": true,
  "low-block": true,
  recovery: true,
  "defensive-transition": true,
  "counter-press": true,
};

/** The nine OutOfPossessionPhase codes in the schema's declaration order. */
export const OUT_OF_POSSESSION_PHASES: readonly OutOfPossessionPhase[] = Object.keys(
  OUT_OF_POSSESSION_ORDER
) as OutOfPossessionPhase[];

export const OUT_OF_POSSESSION_PROPERTY: Record<
  OutOfPossessionPhase,
  keyof OutOfPossessionPhases
> = {
  "high-press": "highPress",
  "mid-press": "midPress",
  "low-press": "lowPress",
  "high-block": "highBlock",
  "mid-block": "midBlock",
  "low-block": "lowBlock",
  recovery: "recovery",
  "defensive-transition": "defensiveTransition",
  "counter-press": "counterPress",
};

/** Dictionary key for an out-of-possession phase. */
export function outOfPossessionPhaseKey(code: OutOfPossessionPhase): DictionaryKey {
  return `enums.outOfPossessionPhase.${code}` as DictionaryKey;
}

/**
 * The FOUR press rates #pressing renders (ruled decision 4), as a frozen
 * ordered SUBSET of the nine.
 *
 * Derived from a `Record` keyed by the generated union for the same reason the
 * full lists are, so it cannot silently drift: the source keeps `high-press`
 * and `high-block` as SEPARATE enum values, and no reading collapses them.
 */
const PRESS_PHASE_ORDER: Record<
  Extract<OutOfPossessionPhase, "high-press" | "mid-press" | "low-press" | "counter-press">,
  true
> = {
  "high-press": true,
  "mid-press": true,
  "low-press": true,
  "counter-press": true,
};

export const PRESS_PHASES: readonly OutOfPossessionPhase[] = Object.keys(
  PRESS_PHASE_ORDER
) as OutOfPossessionPhase[];

const BLOCK_LEVEL_ORDER: Record<BlockLevel, true> = {
  high: true,
  mid: true,
  low: true,
};

/** The three BlockLevel codes, high -> mid -> low. */
export const BLOCK_LEVELS: readonly BlockLevel[] = Object.keys(BLOCK_LEVEL_ORDER) as BlockLevel[];

/** Dictionary key for a defensive block height — `enums.blockLevel.<code>`. */
export function blockLevelKey(code: BlockLevel): DictionaryKey {
  return `enums.blockLevel.${code}` as DictionaryKey;
}

/* -------------------------------- The rows -------------------------------- */

/**
 * One comparative category: both teams' value for one phase or block level.
 *
 * `home` / `away` are RAW PERCENTAGE POINTS (formatPercent's contract: 62 ->
 * "62%"), unformatted and un-normalized.
 */
export interface PhaseRow {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  home: number;
  away: number;
}

/** Both phase families, each an ordered array in the frozen enum order. */
export interface PhaseRowSets {
  inPossession: PhaseRow[];
  outOfPossession: PhaseRow[];
}

/**
 * The 17 phase rates as two comparative distributions (#phases).
 *
 * `home`/`away` name the SIDES, not a lookup: `TacticalIdentityBlock` is keyed
 * `{home, away}` by the contract, so no teamId resolution is possible or needed
 * here — the LogSide arguments carry the team CODES the chart labels its two
 * series with (ruled decision 10a).
 */
export function phaseRows(identity: TacticalIdentityBlock): PhaseRowSets {
  return {
    inPossession: IN_POSSESSION_PHASES.map((code) => ({
      key: `in-${code}`,
      code,
      labelKey: inPossessionPhaseKey(code),
      home: identity.home.phasesInPossession[IN_POSSESSION_PROPERTY[code]],
      away: identity.away.phasesInPossession[IN_POSSESSION_PROPERTY[code]],
    })),
    outOfPossession: OUT_OF_POSSESSION_PHASES.map((code) => ({
      key: `out-${code}`,
      code,
      labelKey: outOfPossessionPhaseKey(code),
      home: identity.home.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
      away: identity.away.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
    })),
  };
}

/**
 * The four press rates (#pressing, ruled decision 4).
 *
 * Read from `phasesOutOfPossession` — the SAME contract fields `phaseRows`
 * reads, deliberately, because the duplication is the ruling. Nothing is
 * recomputed or re-derived; both surfaces print the same contracted numbers.
 */
export function pressRows(identity: TacticalIdentityBlock): PhaseRow[] {
  return PRESS_PHASES.map((code) => ({
    key: `press-${code}`,
    code,
    labelKey: outOfPossessionPhaseKey(code),
    home: identity.home.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
    away: identity.away.phasesOutOfPossession[OUT_OF_POSSESSION_PROPERTY[code]],
  }));
}

/**
 * The three defensive block heights (#pressing).
 *
 * `defensiveBlockDistribution` mirrors three of the nine out-of-possession
 * rates (contract/README.md section 6) and is surfaced here as its own concept
 * — the `$comment` on `DefensiveBlockDistribution` sanctions exactly this by
 * naming Story 2.10. Independent rates like everything else in Domain C: the
 * three do NOT sum to 100 and are never stacked.
 */
export function blockRows(identity: TacticalIdentityBlock): PhaseRow[] {
  const read = (team: TeamTacticalIdentity, code: BlockLevel): number =>
    team.defensiveBlockDistribution[code as keyof DefensiveBlockDistribution];
  return BLOCK_LEVELS.map((code) => ({
    key: `block-${code}`,
    code,
    labelKey: blockLevelKey(code),
    home: read(identity.home, code),
    away: read(identity.away, code),
  }));
}

/* -------------------------------- The metres ------------------------------ */

/** The two contracted distance measures. Also the METRE_UNIT lookup's key. */
export type MetreMeasure = "lineHeight" | "teamLength";

/** The possession state a distance was measured in. */
export type PossessionState = "inPossession" | "outOfPossession";

export interface MetreRow {
  key: string;
  measure: MetreMeasure;
  state: PossessionState;
  labelKey: DictionaryKey;
  unitKey: DictionaryKey;
  home: number;
  away: number;
}

/**
 * Units are LOCALE-LAYER METADATA keyed by metric code (AD-7: "Units are
 * locale-layer metadata keyed by metric code, never artifact strings"),
 * following KEY_STAT_UNIT's shipped shape. `Partial` because a measure without
 * a unit is legal; both of these carry metres.
 */
export const METRE_UNIT: Partial<Record<MetreMeasure, "m">> = {
  lineHeight: "m",
  teamLength: "m",
};

const METRE_MEASURES: readonly MetreMeasure[] = ["lineHeight", "teamLength"];
const POSSESSION_STATES: readonly PossessionState[] = ["inPossession", "outOfPossession"];

function metreLabelKey(measure: MetreMeasure, state: PossessionState): DictionaryKey {
  return `viz.pressing.metre.${measure}.${state}` as DictionaryKey;
}

/**
 * The four contracted metre values per team (#pressing, ruled decision 5).
 *
 * THESE ARE THE ONE PART OF DOMAIN C WITH NO REAL COUNTERPART, and that is
 * measured rather than inferred. The 8+9 phases and the block distribution are
 * REAL — every fixture value matches the staged record exactly, and
 * data/fixtures/README.md lists "All of Domain C phase percentages" under
 * "Real, from the source reports". The metres are NOT in that list:
 *
 *  - The corpus prints THREE PANELS PER POSSESSION STATE with THREE MEASURES
 *    each (in possession: build-up-low / build-up-mid / final-third-phase; out
 *    of possession: high-block-press / low-block / mid-block), including
 *    `team_width`, WHICH THE CONTRACT DOES NOT MODEL AT ALL.
 *  - m001 home in-possession staged `line_height` is 19 / 39 / 54 against the
 *    fixture's single 44.4 — it matches no panel and no mean of them.
 *  - Corpus ranges: line_height 10-71 m, team_length 13-51 m, team_width
 *    28-60 m.
 *
 * RULED: render the four contracted values EXACTLY as the contract names them.
 * They are `required` and non-nullable, and the App's job is to render what the
 * bundle carries. INVENT NO AGGREGATION, add no third measure, and write no
 * copy claiming which phase they describe.
 *
 * BINDING FORWARD: Story 1.16 owns the aggregation rule (deferred-work.md, grep
 * "the line-height/team-length pages are per-phase panels"). When it rules,
 * THIS PRESENTATION IS DELETED OR RE-SHAPED — it is not a surface to build on.
 */
export function metreRows(identity: TacticalIdentityBlock): MetreRow[] {
  const rows: MetreRow[] = [];
  for (const measure of METRE_MEASURES) {
    for (const state of POSSESSION_STATES) {
      rows.push({
        key: `${measure}-${state}`,
        measure,
        state,
        labelKey: metreLabelKey(measure, state),
        unitKey: "enums.unit.m",
        home: identity.home[measure][state],
        away: identity.away[measure][state],
      });
    }
  }
  return rows;
}

/* --------------------------------- The axis -------------------------------- */

/**
 * The nice maximum of a `[0, max]` percentage axis: `max` rounded UP to a whole
 * number of steps, floored so a degenerate `[0, 0]` domain is impossible
 * (recharts cannot scale one).
 */
export function percentAxisMax(max: number): number {
  const step = percentStep(max);
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 1);
  return Math.max(step, Math.ceil(safeMax / step) * step);
}

/** The step: the smallest 1/2/5-times-a-power-of-ten giving at most ~5 ticks. */
function percentStep(max: number): number {
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
  // Integer steps: these are percentage points, and a 2.5% tick label beside a
  // whole-number value list reads as a different quantity.
  return Math.max(1, Math.round(step));
}

/**
 * Explicit, always-includes-ZERO ticks for a `[0, percentAxisMax(max)]` domain
 * (ruled decision 9).
 *
 * NOT optional and NOT cosmetic. deferred-work.md filed this finding against
 * THIS STORY BY NAME (grep "non-uniform and omit zero"): recharts' automatic
 * generator emitted `+17, +1, -8, -17` on m074 — "four ticks, unevenly spaced,
 * with no zero tick at all" — and the entry closes "Recorded because stories
 * 2.10 / 2.13 / 2.15 / 2.16 all carry recharts statistical charts and will hit
 * the same default."
 *
 * THE DOMAIN IS DATA-DRIVEN, NEVER HARDCODED 0-100. In-possession phase sums
 * reach 149 corpus-wide and individual rates are not bounded by 100 in any
 * contracted way, so a 0-100 assumption is corpus-false. Property-tested over
 * 1-160 plus the fixture literals, on momentumYTicks' test model.
 */
export function percentTicks(max: number): number[] {
  const step = percentStep(max);
  const axisMax = percentAxisMax(max);
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += step) {
    ticks.push(value);
  }
  // Floating-point accumulation cannot drop the top tick: the loop is integer
  // stepped, but the guard is cheap and the top tick IS the domain max.
  if (ticks[ticks.length - 1] !== axisMax) {
    ticks.push(axisMax);
  }
  return ticks;
}

/** The largest value across a row set — the axis max's input. */
export function rowsPeak(rows: readonly PhaseRow[]): number {
  let peak = 0;
  for (const row of rows) {
    peak = Math.max(peak, row.home, row.away);
  }
  return peak;
}

/* ------------------------------- Chart height ------------------------------ */

/**
 * The DistributionChart's height class, by category count (ruled decision 12).
 *
 * WHY A FUNCTION RETURNING LITERALS RATHER THAN ARITHMETIC: this chart is
 * consumed at 3, 4, 8 and 9 categories x 2 series, and momentum-model's single
 * `CHART_HEIGHT_CLASS = "h-[122px] md:h-[170px]"` would put 18 bars in 122 px.
 * The obvious workaround — className={`h-[${n * 22}px]`} — is a class TAILWIND
 * V4 NEVER GENERATES, because it scans source text for complete class names. It
 * fails SILENTLY: zero height, and a height-less ResponsiveContainer parent
 * renders NOTHING AT ALL, which is recharts' single most common failure mode.
 *
 * So every class below is written out statically, where Tailwind's scanner can
 * see it. ~26 px per category-pair plus axis margin below md, ~34 px above.
 *
 * Each consuming section's `dynamic()` skeleton fallback calls THIS SAME
 * FUNCTION, so the fallback and the chart cannot drift in height (a CLS hit
 * against the very budget the code-split protects).
 */
export function distributionChartHeightClass(categoryCount: 3 | 4 | 8 | 9): string {
  switch (categoryCount) {
    case 3:
      return "h-[152px] md:h-[176px]";
    case 4:
      return "h-[182px] md:h-[212px]";
    case 8:
      return "h-[302px] md:h-[348px]";
    case 9:
      return "h-[332px] md:h-[382px]";
    default: {
      const unexpected: never = categoryCount;
      throw new Error(
        `distributionChartHeightClass: unsupported category count ${JSON.stringify(unexpected)}`
      );
    }
  }
}

/**
 * Wrap a category-axis label onto at most `maxLines` lines of at most
 * `maxChars` each, ellipsing whatever still does not fit.
 *
 * WHY THIS EXISTS, and why it is here rather than in the chart. `layout=
 * "vertical"` puts the 17 phase names on the CATEGORY (y) axis, and recharts
 * renders axis ticks as a single `<text>` with NO WRAPPING and no truncation —
 * a long label simply runs under the plot or off the SVG. The longest Spanish
 * label in this story is "Salida de balón sin presión" at 27 characters, which
 * at the 11 px type floor is ~140 px against a 320 px viewport. Spanish already
 * runs 20-30% longer than English (review-i18n.md:45), so this is the locale
 * that decides the geometry.
 *
 * Pure and unit-tested because the harness has no jsdom: the chart module gets
 * no tests at all (Task 6.6), so every decision it makes that CAN live in a
 * pure function does.
 *
 * The full, unabbreviated label is always reachable in the section's data table
 * and in the figure summary, so an ellipsis never costs the reader the value.
 */
export function wrapAxisLabel(label: string, maxChars: number, maxLines: number): string[] {
  if (maxChars <= 0 || maxLines <= 0) {
    return [];
  }
  const words = label.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
      current = "";
    }
    if (lines.length === maxLines) {
      break;
    }
    // A single word longer than the line is hard-cut rather than allowed to
    // overrun: "defensiva" fits, but a hyphenless compound might not.
    current = word.length > maxChars ? `${word.slice(0, Math.max(1, maxChars - 1))}…` : word;
  }
  if (current.length > 0 && lines.length < maxLines) {
    lines.push(current);
  }
  /*
   * Anything past the last line is dropped, and the last line says so. Silent
   * truncation would leave "Salida de balón" and "Salida de balón sin" looking
   * like two different phases.
   */
  const consumed = lines.join(" ");
  if (consumed.replace(/…$/, "").length < label.replace(/\s+/g, " ").length) {
    const last = lines[lines.length - 1];
    if (!last.endsWith("…")) {
      lines[lines.length - 1] =
        last.length >= maxChars ? `${last.slice(0, Math.max(1, maxChars - 1))}…` : `${last}…`;
    }
  }
  return lines;
}

/** Category-axis wrapping geometry, shared by the chart and its height class. */
export const AXIS_LABEL_MAX_CHARS = 16;
export const AXIS_LABEL_MAX_LINES = 2;

/* ------------------------------- Table rows -------------------------------- */

/**
 * Decision 19's table rows. The data table carries the SAME NUMBERS the surface
 * displays — UX-DR16 and ARCHITECTURE-SPINE.md:140 require "a reachable data
 * table rendering the same artifact slice".
 *
 * These are the phase rows themselves: every category, both teams, in the
 * frozen order. Nothing is summed into a "total" column, because THERE IS NO
 * TOTAL — a column footer adding the eight in-possession rates would assert the
 * partition this whole module exists to deny.
 */
export type PhaseTableRow = PhaseRow;

/** The metre rows, unchanged — four rows, both teams, no total. */
export type MetreTableRow = MetreRow;

/** Convenience for a caller that wants every #phases row in one table. */
export function phaseTableRows(identity: TacticalIdentityBlock): PhaseTableRow[] {
  const sets = phaseRows(identity);
  return [...sets.inPossession, ...sets.outOfPossession];
}

/**
 * The side codes a chart labels its two series with.
 *
 * Re-exported as a type alias so the sections and the chart agree on one shape
 * without either importing marker-model for a two-field interface.
 */
export type PhaseSide = LogSide;

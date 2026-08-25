import type {
  BlockLevel,
  InPossessionPhase,
  InPossessionPhases,
  OutOfPossessionPhase,
  OutOfPossessionPhases,
  TacticalIdentityBlock,
  TeamTacticalIdentity,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
/*
 * THE FROZEN SHAPE ENUMS ARE IMPORTED, NEVER RE-DECLARED (Story 2.19 Task 7.1).
 * `/teams/{slug}` and `#pressing` render the SAME contract field, and two
 * private copies of the panel order is exactly how one surface silently drifts
 * out of order from the other.
 */
import {
  IN_POSSESSION_SHAPE_PANELS,
  OUT_OF_POSSESSION_SHAPE_PANELS,
  inPossessionShapePanelKey,
  outOfPossessionShapePanelKey,
} from "@/viz/team-profile-model";

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

/* ------------------------- Shape by phase (#pressing) ---------------------- */

/**
 * One shape PANEL for one side: the three metre distances the report prints.
 *
 * ═══ WHY THIS EXISTS — ledger A13 / L1979 / L3412, Story 2.19 Task 7.1 ═══
 *
 * `#pressing` used to present a "metre" surface. Change-set CS-2 RETIRED that
 * presentation and reshaped the underlying data into `shapeByPhase` — 2 states
 * x 3 panels x 3 measures — and the whole `viz.pressing.metre*` locale family
 * was deleted with it. The DATA never went away: `shapeByPhase` is populated on
 * 104 of 104 real match bundles. So the section has been rendering a strictly
 * smaller surface than the report carries, and the ledger filed the debt TWICE.
 *
 * THE VOCABULARY IS NOT MINTED HERE. Story 2.16 already coined `team.shape.*`
 * for the identical values on `/teams/{slug}` (its R1 option A, taken by Juan)
 * — the panel labels, the three measure names and the metre unit. This surface
 * REUSES every one of them; 2.19 owns the match-route presentation only.
 *
 * ONE ROW PER PANEL PER SIDE, which is the match route's own idiom rather than
 * the team route's. `/teams/{slug}` renders one team, so it puts the three
 * measures in columns and the panels in rows. A match has two teams and every
 * other table in this section carries both, so the side is a COLUMN here and
 * the row count doubles to six. Nothing is summed or compared across the two —
 * they are printed side by side, which is all AD-5 permits.
 */
export interface ShapePanelRow {
  key: string;
  code: string;
  labelKey: DictionaryKey;
  /** The side's own code, e.g. "MEX" — resolved by the caller. */
  teamCode: string;
  lineHeight: number;
  teamLength: number;
  teamWidth: number;
}

/** Both possession states, each an ordered array in the frozen panel order. */
export interface ShapeRowSets {
  inPossession: ShapePanelRow[];
  outOfPossession: ShapePanelRow[];
}

/**
 * `shapeByPhase` for both sides, as two tables (#pressing).
 *
 * The panel order and the label keys come from `team-profile-model`, which owns
 * the frozen enums CS-2 minted; importing them is what stops this surface and
 * `/teams/{slug}` drifting into two orders for one contract field.
 */
export function shapePanelRows(
  identity: TacticalIdentityBlock,
  home: { teamCode: string },
  away: { teamCode: string }
): ShapeRowSets {
  const sides = [
    { side: "home" as const, team: identity.home, code: home.teamCode },
    { side: "away" as const, team: identity.away, code: away.teamCode },
  ];
  return {
    inPossession: sides.flatMap(({ side, team, code }) =>
      IN_POSSESSION_SHAPE_PANELS.map((panel) => ({
        key: `shape-in-${side}-${panel}`,
        code: panel,
        labelKey: inPossessionShapePanelKey(panel),
        teamCode: code,
        ...team.shapeByPhase.inPossession[panel],
      }))
    ),
    outOfPossession: sides.flatMap(({ side, team, code }) =>
      OUT_OF_POSSESSION_SHAPE_PANELS.map((panel) => ({
        key: `shape-out-${side}-${panel}`,
        code: panel,
        labelKey: outOfPossessionShapePanelKey(panel),
        teamCode: code,
        ...team.shapeByPhase.outOfPossession[panel],
      }))
    ),
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
  /*
   * NO CAST. `BlockLevel` is "high" | "mid" | "low" and
   * `DefensiveBlockDistribution` is { high, mid, low }, so the code IS the
   * property name and this indexes cleanly — which is the point: every other
   * enum in this story routes through an explicit Record<Enum, keyof Counts> map
   * (IN_POSSESSION_PROPERTY, FREE_KICK_PROPERTY, INTERVENTION_PROPERTY, ...)
   * precisely so that a renamed or widened contract field is a COMPILE ERROR.
   * A `code as keyof DefensiveBlockDistribution` cast here would have silenced
   * exactly that check while adding nothing, so the review removed it.
   */
  const read = (team: TeamTacticalIdentity, code: BlockLevel): number =>
    team.defensiveBlockDistribution[code];
  return BLOCK_LEVELS.map((code) => ({
    key: `block-${code}`,
    code,
    labelKey: blockLevelKey(code),
    home: read(identity.home, code),
    away: read(identity.away, code),
  }));
}

/* -------------------------------- The metres ------------------------------ */

/*
 * RETIRED BY CHANGE-SET CS-2 (contract logged decision 18), which is exactly what
 * `metreRows`' own docblock said would happen: "When it rules, THIS PRESENTATION IS
 * DELETED OR RE-SHAPED - it is not a surface to build on."
 *
 * The four values it rendered were `tacticalIdentity[side].lineHeight/.teamLength`, a
 * shape the source never printed. The corpus prints THREE PANELS PER POSSESSION STATE
 * WITH THREE MEASURES EACH - 18 values per team, 3,744 corpus-wide against the contract's
 * 832 - including a `teamWidth` v3 did not model at all. m001 home in-possession
 * `lineHeight` is 19 / 39 / 54 and the old fixture's single 44.4 matched no panel and no
 * mean of them, because it was synthetic. So this surface was rendering invented numbers.
 *
 * `tacticalIdentity[side].shapeByPhase` now carries all 18 REAL values. Re-presenting them
 * needs six panel labels that do not exist in either locale, and minting user-visible copy
 * is a ruling this change-set does not have. The values ship in the artifact; the surface
 * that renders them is filed.
 *
 * FILED: re-present shapeByPhase on #pressing. Owner: Story 2.19, or whichever story next
 * re-opens #pressing - see deferred-work.md, "Filed by change-set CS-2".
 */

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
  /*
   * `.trim()` matters: the comparison normalizes internal runs of whitespace but
   * would otherwise KEEP a leading or trailing space, making the source look one
   * character longer than what was consumed and appending an ellipsis to a label
   * that was never cut. A false truncation cue is worse than none — it tells the
   * reader a phase name continues when it does not.
   */
  if (consumed.replace(/…$/, "").length < label.replace(/\s+/g, " ").trim().length) {
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

/* --------------------------- The direct series label ---------------------- */

/**
 * The index of a series' largest value — where its direct label is anchored, or
 * `-1` when the series is FLAT and the label must be suppressed.
 *
 * 🔴 THE `-1` SENTINEL IS LOAD-BEARING (Story 2.17, ruled D9; ledger owner line
 * "the first successor story to reuse `DistributionChart`"). `best` starts at 0
 * and the test is strict `>`, so an ALL-EQUAL series — the all-zero case
 * included — used to return `0` for BOTH series. `SeriesEndLabel` then anchored
 * both team codes at the axis origin, overlapping, and decision 10(a)'s primary
 * UX-DR11 channel failed silently: the two direct labels are the ONLY thing
 * distinguishing the series once `<Legend>` is banned.
 *
 * Suppression rather than a fallback position is correct: when every value is
 * equal there is no "largest" bar to label, and drawing the code at an arbitrary
 * index would assert a peak the data does not have.
 *
 * `SeriesEndLabel`'s existing `if (index !== labelIndex) return null` guard is
 * ALREADY sentinel-compatible — no bar index can equal -1, so the label
 * suppresses itself with no change there.
 *
 * ⚠️ THE CONDITION IS "EVERY VALUE EQUAL", NOT D9's LITERAL "no value beats the
 * first". Those differ, and the literal form is a regression: on `[10, 3, 2]`
 * nothing beats the first value either, so it would suppress the label on a
 * perfectly ordinary series whose peak simply sits at index 0 — silently
 * deleting a label that ships correctly today. The degenerate case the ruling
 * actually describes, and the only one where both series collide at the origin,
 * is the FLAT series. That is what is tested for.
 *
 * ═══ WHY IT LIVES HERE AND NOT IN `TacticalCharts` (code review 2026-08-07) ═══
 *
 * It shipped as an export ON `TacticalCharts.tsx`, and `CompareCharts.tsx`
 * imported it from there — a VALUE crossing between two recharts leaves, against
 * the Recharts Contract's "only `import type` may cross into a chart module".
 * Both leaves now import it from the pure layer, which is where every other
 * decision they share already lives (`wrapAxisLabel`, `AXIS_LABEL_MAX_CHARS`,
 * `distributionChartHeightClass`) and the only layer the node-env harness can
 * unit-test. It also returns `TacticalCharts.tsx` to D9's declared "only edit".
 */
export function seriesLabelIndex(values: readonly number[]): number {
  if (values.length === 0) {
    return -1;
  }
  if (values.every((value) => value === values[0])) {
    return -1;
  }
  let best = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[best]) {
      best = index;
    }
  }
  return best;
}

/* ------------------------------- Table rows -------------------------------- */

/*
 * DECISION 19'S TABLE ROWS ARE `PhaseRow` AND `MetreRow` THEMSELVES. Both
 * sections build their tables per family straight from `phaseRows` / `pressRows`
 * / `blockRows` / `metreRows` — every category, both teams, in the frozen order.
 * Nothing is summed into a "total" column, because THERE IS NO TOTAL: a column
 * footer adding the eight in-possession rates would assert the partition this
 * whole module exists to deny.
 *
 * The `PhaseTableRow` / `MetreTableRow` aliases, the `phaseTableRows` convenience
 * and the `PhaseSide` re-export that once lived here were removed by the 2.10
 * code review: all four were referenced ONLY by this module's own test, and
 * nothing in the build chain catches a dead export (`no-unused-vars` is not in
 * the flat config's active set and `tsconfig.json` sets no `noUnusedLocals`), so
 * they would have accumulated silently. Add a table-row type here only when a
 * component actually needs a shape `PhaseRow` cannot express.
 */

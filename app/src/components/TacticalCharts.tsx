"use client";

import { useId } from "react";
import { Bar, BarChart, LabelList, Label, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import {
  AXIS_LABEL_MAX_CHARS,
  AXIS_LABEL_MAX_LINES,
  wrapAxisLabel,
} from "@/viz/phases-model";

/*
 * The SECOND recharts-bearing leaf (Story 2.10, Task 6), imported by all four
 * of this story's sections through next/dynamic so the ~147 kB gzipped chart
 * library stays in its own chunk.
 *
 * MomentumChart.tsx's docblock says "This module is the ONLY place recharts is
 * imported". THIS FILE UPDATES THAT CLAIM BY ADDING A SIBLING, not by widening
 * that file — MomentumChart is shipped, reviewed and on this story's
 * do-not-touch list, and its geometry (a diverging area chart with a slider,
 * goal markers and a cursor chip) shares nothing with a grouped bar chart.
 *
 * IT RESOLVES NO COPY. Every string arrives pre-resolved from the section,
 * which owns the locale and the format layer. That is not tidiness: THE i18n
 * ESLint GATE DOES NOT REACH RECHARTS, because recharts delivers text through
 * OBJECT-SHAPED props (`label={{ value: "…" }}`) and the gate's selectors match
 * a Literal that is a direct child of a JSXExpressionContainer. Every text value
 * here is a pre-resolved identifier BY DISCIPLINE, NOT ENFORCEMENT.
 *
 * NO UNIT TESTS EXIST FOR THIS FILE and none can — the harness has no jsdom.
 * That is exactly why every decision that CAN be pure lives upstream in
 * phases-model / goalkeeping-model (the tick functions, the axis maxima, the
 * label wrapping, the height classes), and why Task 10.2's browser pass is this
 * module's only verification.
 *
 * THE MANDATORY RECHARTS CONTRACT, every rule with a named failure behind it:
 *
 *   accessibilityLayer={false}  — defaults TRUE in v3 and installs
 *       role="application" plus its own tabIndex and arrow-key handler on the
 *       container. Three direct collisions with the section's role="figure"
 *       panel and its keyboard contract.
 *   isAnimationActive={false}   — the global prefers-reduced-motion CSS kill
 *       switch does NOT reach recharts' JS-driven animation.
 *   explicit `ticks` and `domain`, never degenerate — recharts' own generator
 *       omits the zero tick on an un-nice domain (measured on m074), and
 *       deferred-work.md filed that finding against THIS STORY by name.
 *   colours as var(--token) PRESENTATION PROPS — Tailwind fill-* utilities do
 *       not reliably reach recharts' internally-rendered <text>.
 *   tick text via { className, fill } — `type-caption` deliberately carries no
 *       font-variant-numeric, so the tabular half of DESIGN.md:301's mandatory
 *       pairing comes from the Tailwind utility.
 *   NO <Tooltip>  — hover-only, banned outright (UX-DR15, EXPERIENCE.md:103).
 *   NO <Legend>   — ruled decision 10(a) requires DIRECT series labels.
 *   axis titles via <Label>, never `name` — `name` feeds the tooltip and legend
 *       payloads ONLY, both of which are banned, so it would reach no surface
 *       at all: not the screen, not the accessibility tree.
 *   a parent with a RESOLVED HEIGHT — a height-less ResponsiveContainer renders
 *       nothing at all, recharts' single most common failure mode. The height
 *       classes come from the pure models, never from this file: a VALUE import
 *       from here re-links recharts onto the critical path.
 */

/* ------------------------- The Team B non-hue channel ---------------------- */

/**
 * Diagonal-hatch geometry for Team B (ruled decision 10(b)).
 *
 * UX-DR11 requires TWO channels and the accessibility review is explicit that
 * hue alone fails: the --viz-team-a / --viz-team-b pair computes 1.32:1 dark and
 * 1.07:1 light against EACH OTHER (review-accessibility.md:27), and that review
 * names "the recharts 'Phases-of-Play comparison,' pressing, and Defensive
 * Blocks" as the surfaces specifying neither a direct label nor a pattern.
 *
 * THE HATCH IS DRAWN OVER A SOLID --viz-team-b GROUND, NEVER OVER TRANSPARENT
 * GAPS. This is the difference between a legibility question and a contrast
 * question: transparent gaps let the card through and collapse the effective
 * ratio, so the measured solid figures (10.30 dark / 5.36 light on
 * --surface-raised) would transfer to neither. With a solid ground they govern
 * and the hatch only adds texture — which is why the stripe is drawn in
 * --ink-primary rather than in the card colour. Carving the card colour back
 * out would reintroduce exactly the transparency this rules against.
 *
 * MomentumChart discharges the same rule with TEAM_B_DASH_ARRAY on a stroke,
 * which a filled bar cannot use.
 */
const HATCH_TILE_PX = 6;
const HATCH_STROKE_PX = 1.5;

/** Bar geometry. A category row holds two bars plus the gap between them. */
const BAR_GAP = 2;
const CATEGORY_GAP = "22%";

/** The direct series label's inset past the end of the bar it names. */
const SERIES_LABEL_INSET_PX = 6;

/** Y-axis width: fits AXIS_LABEL_MAX_CHARS at the 11 px type floor. */
const CATEGORY_AXIS_WIDTH = 96;
/** Line height for the wrapped category tick, in CSS px. */
const AXIS_LINE_HEIGHT_PX = 11;

const DISTRIBUTION_MARGIN = { top: 8, right: 34, bottom: 20, left: 4 } as const;
const INVOLVEMENT_MARGIN = { top: 8, right: 10, bottom: 20, left: 4 } as const;

export interface ChartSeries {
  /** Already uppercased at the TacticalLayer prop boundary. */
  teamCode: string;
  /** Index-aligned to `categoryLabels`. Raw values; the axis is pre-scaled. */
  values: number[];
}

export interface DistributionChartProps {
  /** Resolved category labels, in the model's frozen order. */
  categoryLabels: string[];
  home: ChartSeries;
  away: ChartSeries;
  /** Explicit ticks from the pure model. Never left to recharts. */
  ticks: number[];
  /** The value axis maximum — `ticks[ticks.length - 1]`, passed explicitly. */
  axisMax: number;
  /** Axis titles, already resolved. */
  axisValueLabel: string;
  axisCategoryLabel: string;
  /** Formats a value-axis tick. The SECTION owns the locale, not recharts. */
  formatValue: (value: number) => string;
  /**
   * The figure's one-sentence summary.
   *
   * NAMED `figureSummary`, THE HOUSE NAME. `label`, `description`, `caption`,
   * `title`, `text` and `heading` are all gated by the i18n
   * no-restricted-syntax rule, and MomentumChart's `figureLabel` predates the
   * house naming — both are legal (the gate matches ^label$ exactly) but one
   * name per concept.
   */
  figureSummary: string;
  /** The height class, from the PURE model — never declared in this file. */
  heightClass: string;
}

/**
 * A wrapped, two-line-capable category tick.
 *
 * recharts renders an axis tick as ONE `<text>` with no wrapping and no
 * truncation, so the 17 Spanish phase names would run under the plot at 320 px.
 * The wrapping itself is a pure, unit-tested model function; this only paints
 * the `<tspan>`s.
 */
function CategoryTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const { x, y, payload } = props;
  if (x === undefined || y === undefined) {
    return null;
  }
  const raw = payload?.value;
  const lines = wrapAxisLabel(String(raw ?? ""), AXIS_LABEL_MAX_CHARS, AXIS_LABEL_MAX_LINES);
  if (lines.length === 0) {
    return null;
  }
  // Centre the block on the tick: one line sits on it, two straddle it.
  const offset = ((lines.length - 1) * AXIS_LINE_HEIGHT_PX) / 2;
  return (
    <text
      x={x}
      y={y - offset}
      textAnchor="end"
      dominantBaseline="middle"
      fill="var(--ink-secondary)"
      className="type-caption"
    >
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 0 : AXIS_LINE_HEIGHT_PX}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * The direct series label — the team code at the END of one bar of that series
 * (ruled decision 10(a)). NOT A LEGEND, and shown ALWAYS.
 *
 * It is placed on the series' own LONGEST bar, chosen in `seriesLabelIndex`
 * below. Deterministic, and it puts the label where there is guaranteed room:
 * anchoring it to category 0 would bury it against the axis whenever that
 * category happens to be near zero.
 */
function SeriesEndLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
  labelIndex?: number;
  code?: string;
  colorVar?: string;
}) {
  const { x, y, width, height, index, labelIndex, code, colorVar } = props;
  if (index !== labelIndex) {
    return null;
  }
  const left = Number(x);
  const top = Number(y);
  const barWidth = Number(width);
  const barHeight = Number(height);
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }
  const safeWidth = Number.isFinite(barWidth) ? barWidth : 0;
  const safeHeight = Number.isFinite(barHeight) ? barHeight : 0;
  return (
    <text
      x={left + safeWidth + SERIES_LABEL_INSET_PX}
      y={top + safeHeight / 2}
      textAnchor="start"
      dominantBaseline="middle"
      fill={`var(${colorVar})`}
      className="type-label-caps"
    >
      {code}
    </text>
  );
}

/** The index of a series' largest value — where its direct label is anchored. */
function seriesLabelIndex(values: readonly number[]): number {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[best]) {
      best = index;
    }
  }
  return best;
}

/**
 * A horizontal grouped bar chart, N categories x 2 teams.
 *
 * Consumed FOUR times: #phases in-possession (8), #phases out-of-possession
 * (9), #pressing press rates (4), #pressing blocks (3).
 *
 * `layout="vertical"` is recharts' name for HORIZONTAL BARS, and it is not a
 * preference: 17 categories with Spanish labels cannot be read on a vertical
 * axis at 320 px.
 *
 * NOTHING HERE STACKS. No `stackId` appears in this file at all — the values
 * are independent rates that do not sum to 100 (corpus in-possession sums run
 * 84-149), and `InPossessionPhase`'s own description forbids treating them as
 * slices of a whole.
 */
export function DistributionChart({
  categoryLabels,
  home,
  away,
  ticks,
  axisMax,
  axisValueLabel,
  axisCategoryLabel,
  formatValue,
  figureSummary,
  heightClass,
}: DistributionChartProps) {
  /*
   * FOUR DistributionChart INSTANCES MOUNT ON ONE PAGE, so a hardcoded pattern
   * id would collide and every Team B bar would resolve to the first chart's
   * pattern. React 19 emits guillemet-delimited ids (`«r3»`), which are NOT
   * valid XML NCName start characters — they break querySelector and
   * getComputedStyle debugging even when the browser tolerates the fill. This
   * is the project's FIRST <defs> / <pattern> / url(#…) reference, so there is
   * no precedent to copy: every shipped useId() feeds an id or aria-controls,
   * never an SVG functional IRI.
   */
  const patternId = `team-b-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const data = categoryLabels.map((label, index) => ({
    label,
    home: home.values[index] ?? 0,
    away: away.values[index] ?? 0,
  }));

  const homeLabelIndex = seriesLabelIndex(home.values);
  const awayLabelIndex = seriesLabelIndex(away.values);
  const tickStyle = { className: "type-caption tabular-nums", fill: "var(--ink-secondary)" };

  return (
    <figure
      role="figure"
      aria-label={figureSummary}
      className="min-w-0 rounded-lg bg-surface-raised p-tile-gap"
    >
      <div className={cn("w-full", heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={DISTRIBUTION_MARGIN}
            barGap={BAR_GAP}
            barCategoryGap={CATEGORY_GAP}
            accessibilityLayer={false}
          >
            <defs>
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width={HATCH_TILE_PX}
                height={HATCH_TILE_PX}
                patternTransform="rotate(45)"
              >
                {/* THE SOLID GROUND. Without it the hatch is transparency. */}
                <rect width={HATCH_TILE_PX} height={HATCH_TILE_PX} fill="var(--viz-team-b)" />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={HATCH_TILE_PX}
                  stroke="var(--ink-primary)"
                  strokeWidth={HATCH_STROKE_PX}
                />
              </pattern>
            </defs>

            <XAxis
              type="number"
              /*
               * Floored by the model so it can never be degenerate: recharts
               * cannot scale [0, 0], and every mark then resolves to the same
               * or a NaN coordinate.
               */
              domain={[0, axisMax]}
              ticks={ticks}
              tickFormatter={formatValue}
              tick={tickStyle}
              axisLine={{ stroke: "var(--border-hairline)" }}
              tickLine={{ stroke: "var(--border-hairline)" }}
            >
              <Label
                value={axisValueLabel}
                position="insideBottom"
                offset={-12}
                className="type-caption"
                fill="var(--ink-secondary)"
              />
            </XAxis>
            <YAxis
              type="category"
              dataKey="label"
              width={CATEGORY_AXIS_WIDTH}
              tick={<CategoryTick />}
              interval={0}
              axisLine={false}
              tickLine={false}
            >
              {/*
               * The category axis title is carried in the figure summary and
               * the data-table header rather than painted beside 96 px of
               * wrapped labels, where it would collide at 320 px. Passing it
               * through `name` would reach NO surface at all — that prop feeds
               * only the tooltip and legend payloads, both banned here.
               */}
              <Label value={axisCategoryLabel} className="sr-only" />
            </YAxis>

            <Bar
              dataKey="home"
              fill="var(--viz-team-a)"
              stroke="var(--viz-team-a)"
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="home"
                content={
                  <SeriesEndLabel
                    labelIndex={homeLabelIndex}
                    code={home.teamCode}
                    colorVar="--viz-team-a"
                  />
                }
              />
            </Bar>
            <Bar
              dataKey="away"
              /*
               * UX-DR11's SECOND, NON-HUE channel: the diagonal hatch over a
               * solid --viz-team-b ground, plus the solid --viz-team-b stroke
               * the decision also requires.
               */
              fill={`url(#${patternId})`}
              stroke="var(--viz-team-b)"
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="away"
                content={
                  <SeriesEndLabel
                    labelIndex={awayLabelIndex}
                    code={away.teamCode}
                    colorVar="--viz-team-b"
                  />
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/* --------------------------- The involvement chart ------------------------- */

export interface InvolvementChartProps {
  /** Index-keyed rows from the model. `index` IS the x domain. */
  points: { index: number; minute: number; involvements: number }[];
  /** Tick INDICES, thinned and minute-deduped by the model. */
  tickIndices: number[];
  /** Formats a tick index into its minute label. Locale lives in the section. */
  formatSlot: (index: number) => string;
  /** Explicit count-axis ticks and maximum, from the model. */
  countTicks: number[];
  countAxisMax: number;
  formatCount: (value: number) => string;
  axisSlotLabel: string;
  axisCountLabel: string;
  /** Which team's accent to paint. Team B still carries the hatch. */
  accent: "a" | "b";
  figureSummary: string;
  heightClass: string;
}

/**
 * One goalkeeper's involvement timeline (ruled decision 7).
 *
 * THE X AXIS IS THE SAMPLE INDEX, NEVER THE MINUTE. `GoalkeeperInvolvementSample`
 * is `{minute: Minute, involvements: Count}` — a bare 0-120 Minute with NO
 * stoppage field — while the corpus draws 95-145 slots per team-inning and puts
 * 2,506 of 21,764 of them in stoppage time. Minutes therefore REPEAT on real
 * data. The minute is a tick LABEL read off the sample, deduped by value with
 * first occurrence winning, and the axis says so in its own title.
 *
 * The fixtures hide all of this: 19 or 25 evenly-spaced, minute-unique samples.
 */
export function InvolvementChart({
  points,
  tickIndices,
  formatSlot,
  countTicks: valueTicks,
  countAxisMax,
  formatCount,
  axisSlotLabel,
  axisCountLabel,
  accent,
  figureSummary,
  heightClass,
}: InvolvementChartProps) {
  const patternId = `team-b-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const tickStyle = { className: "type-caption tabular-nums", fill: "var(--ink-secondary)" };
  const fill = accent === "a" ? "var(--viz-team-a)" : `url(#${patternId})`;
  const stroke = accent === "a" ? "var(--viz-team-a)" : "var(--viz-team-b)";

  return (
    <figure
      role="figure"
      aria-label={figureSummary}
      className="min-w-0 rounded-lg bg-surface-raised p-tile-gap"
    >
      <div className={cn("w-full", heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={INVOLVEMENT_MARGIN} accessibilityLayer={false}>
            <defs>
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width={HATCH_TILE_PX}
                height={HATCH_TILE_PX}
                patternTransform="rotate(45)"
              >
                <rect width={HATCH_TILE_PX} height={HATCH_TILE_PX} fill="var(--viz-team-b)" />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={HATCH_TILE_PX}
                  stroke="var(--ink-primary)"
                  strokeWidth={HATCH_STROKE_PX}
                />
              </pattern>
            </defs>
            <XAxis
              dataKey="index"
              type="category"
              ticks={tickIndices}
              tickFormatter={(value: number) => formatSlot(Number(value))}
              tick={tickStyle}
              interval={0}
              axisLine={{ stroke: "var(--border-hairline)" }}
              tickLine={{ stroke: "var(--border-hairline)" }}
            >
              <Label
                value={axisSlotLabel}
                position="insideBottom"
                offset={-12}
                className="type-caption"
                fill="var(--ink-secondary)"
              />
            </XAxis>
            <YAxis
              type="number"
              domain={[0, countAxisMax]}
              ticks={valueTicks}
              tickFormatter={formatCount}
              tick={tickStyle}
              width={30}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value={axisCountLabel}
                angle={-90}
                position="insideLeft"
                className="type-caption"
                fill="var(--ink-secondary)"
              />
            </YAxis>
            <Bar
              dataKey="involvements"
              fill={fill}
              stroke={stroke}
              strokeWidth={1}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

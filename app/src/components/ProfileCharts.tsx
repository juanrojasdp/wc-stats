"use client";

import {
  Bar,
  BarChart,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import {
  AXIS_LABEL_MAX_CHARS,
  AXIS_LABEL_MAX_LINES,
  wrapAxisLabel,
} from "@/viz/phases-model";

/*
 * The THIRD recharts-bearing leaf (Story 2.15): the two single-series charts
 * `/players/{slug}` renders — the cross-match `TrendChart` and the speed-zone
 * `SpeedZoneChart`.
 *
 * IT IS NEVER IMPORTED BY A `dynamic()` CALL SITE DIRECTLY, and that is ruled
 * (D1), not stylistic. `next/dynamic` dedupes on the IMPORT SPECIFIER and mints
 * one async chunk group per distinct specifier, so a third specifier would mint
 * a THIRD 300 kB recharts vendor copy — the exact duplication AC 6 exists to
 * remove. Every call site in the app now points at `@/components/Charts`, the
 * one barrel; this module is reached only through it.
 *
 * IT RESOLVES NO COPY, on TacticalCharts' terms: every string arrives
 * pre-resolved from the section, which owns the locale and the format layer.
 * THE i18n ESLint GATE DOES NOT REACH RECHARTS — it delivers text through
 * OBJECT-SHAPED props — so every text value here is a pre-resolved identifier
 * BY DISCIPLINE, NOT ENFORCEMENT.
 *
 * NO UNIT TESTS EXIST FOR THIS FILE and none can (the harness has no jsdom).
 * Every decision that CAN be pure lives upstream in `viz/player-profile-model`:
 * the tick sets, the axis bounds, the axis widths, the height classes. Task 11's
 * browser pass is this module's only verification.
 *
 * THE MANDATORY RECHARTS CONTRACT is TacticalCharts.tsx's docblock, copied in
 * behaviour rather than restated in prose: accessibilityLayer={false},
 * isAnimationActive={false}, explicit `ticks` AND `domain` (never degenerate),
 * colours as var(--token) PRESENTATION props, tick text via
 * `{ className: "type-caption tabular-nums", fill: … }`, NO <Tooltip>, NO
 * <Legend>, axis titles via <Label>, and a parent with a RESOLVED HEIGHT.
 *
 * ONE SERIES, SO NO SECOND CHANNEL. UX-DR11's two-channel rule exists to
 * separate Team A from Team B; there is no second series on either chart here,
 * so neither carries a hatch (Story 2.13 ruling 2 routes the Team B non-hue
 * channel to 2.16/2.17 and says so by name). The colour is `--viz-single`,
 * which `globals.css` declares ONCE as `var(--viz-team-a)` inside `:root, .dark`
 * and which is therefore already theme-aware through that indirection — there is
 * no `--viz-single-light` and minting one would break the single-declaration
 * pattern.
 */

/** Shared tick style. `type-caption` carries no font-variant-numeric on its own. */
const TICK_STYLE = { className: "type-caption tabular-nums", fill: "var(--ink-secondary)" } as const;

const TREND_MARGIN = { top: 8, right: 12, bottom: 20, left: 4 } as const;
const ZONE_MARGIN = { top: 8, right: 12, bottom: 20, left: 4 } as const;

/**
 * Y-axis width for SHORT category ticks — "Zona 1" … "Zona 5" (Story 2.15).
 *
 * THE DEFAULT, NOT THE ONLY VALUE. Story 2.16 generalized this chart to any
 * single-series category set and its labels are the seventeen Spanish phase
 * names, which do not fit in 62 px: measured on `/teams/mexico/` before the fix,
 * "Salida de balón sin presión" and "Salida de balón con presión" overlapped
 * vertically, "Progresión" clipped to "rogresión" and "Contraataque" to
 * "traataque". `CATEGORY_AXIS_WIDTH_WIDE` is what those callers pass.
 */
const ZONE_CATEGORY_AXIS_WIDTH = 62;

/*
 * The WIDE width is NOT exported from here, deliberately. Everything in this
 * module sits on the deferred side of the `Charts.tsx` lazy boundary, so a
 * section importing a const from it would create a STATIC import edge to
 * recharts and pull ~300 kB into the eager bundle — defeating the split that
 * barrel exists to protect. Callers get the value from their own PURE model,
 * which already owns the other axis decisions (ticks, axisMax, heightClass):
 * see `RATE_CATEGORY_AXIS_WIDTH` in `viz/team-profile-model.ts`.
 */

/** Line height for the wrapped category tick, in CSS px. */
const AXIS_LINE_HEIGHT_PX = 11;

/**
 * A wrapped, two-line-capable category tick.
 *
 * recharts renders an axis tick as ONE `<text>` with NO wrapping and NO
 * truncation — a long label simply runs under the plot or off the SVG, and
 * recharts' own attempt at it breaks mid-word ("Salidadebalónsinpresión").
 *
 * COPIED IN BEHAVIOUR FROM `TacticalCharts`' `CategoryTick`, and it shares that
 * file's wrapping MODEL rather than re-deriving one: `wrapAxisLabel`,
 * `AXIS_LABEL_MAX_CHARS` and `AXIS_LABEL_MAX_LINES` are imported from
 * `phases-model`, which is pure and unit-tested. One wrapping contract in the
 * codebase, two painters.
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
  const lines = wrapAxisLabel(String(payload?.value ?? ""), AXIS_LABEL_MAX_CHARS, AXIS_LABEL_MAX_LINES);
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
      /*
       * `tabular-nums` IS CARRIED OVER FROM `TICK_STYLE`, which this tick
       * replaces. Dropping it would be a silent regression on the speed zones:
       * "Zona 1" … "Zona 5" all contain digits, `type-caption` carries no
       * font-variant-numeric of its own, and five category labels whose digits
       * do not align column-to-column is exactly what the utility exists to
       * prevent. It is inert on the phase names, which have no digits.
       */
      className="type-caption tabular-nums"
    >
      {/*
       * Keyed by INDEX, not by line content: a label that wraps to two identical
       * lines would otherwise collide on the key and React would drop one tspan,
       * rendering half the label.
       */}
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : AXIS_LINE_HEIGHT_PX}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/* --------------------------------- Trends ---------------------------------- */

export interface TrendChartPoint {
  /** The x-axis category — an already-formatted, already-localized match label. */
  label: string;
  /** The plotted value, raw. The axis is pre-scaled by the model. */
  value: number;
}

export interface TrendChartProps {
  points: TrendChartPoint[];
  /** Explicit ticks from the pure model. Never left to recharts. */
  ticks: number[];
  /**
   * The value-axis bounds, passed explicitly and NEVER degenerate.
   *
   * `axisMin` is not always 0, and that is the point of the decimal-aware
   * generator behind it: a 32,0–33,0 km/h series on a count-floored `[0, max]`
   * axis is a flat line against three ticks. Count and percentage families still
   * floor at zero — the model decides per metric family, not this file.
   */
  axisMin: number;
  axisMax: number;
  /** Formats a value-axis tick. The SECTION owns the locale, not recharts. */
  formatValue: (value: number) => string;
  /** Pixel width reserved for the value axis, from the model. */
  axisWidth: number;
  /** Axis titles, already resolved. */
  axisPointLabel: string;
  axisValueLabel: string;
  /** The figure's one-sentence summary. `figureSummary` is the house prop name. */
  figureSummary: string;
  /** The height class, from the PURE model — never declared in this file. */
  heightClass: string;
}

/**
 * One metric's value across a player's matches, in artifact order (D6).
 *
 * A LINE, NOT BARS, and the axis bounds are why. Two of the six series
 * (`topSpeed` in km/h, `totalDistance` in metres) are read on a NON-ZERO
 * baseline, which is honest for a line and a misstatement for a bar — a
 * truncated bar encodes its length as the value. Dots are painted at every
 * point so a one-match player (191 of them corpus-wide) still renders a visible
 * mark rather than a zero-length line.
 *
 * `role="img"`, not `role="figure"`: the section wraps this in an UNNAMED
 * `<figure>` grouping it with its data-table alternative, and a named figure
 * around a named img gives the reader two competing accessible names —
 * `InvolvementChart`'s ruling, same reason.
 */
export function TrendChart({
  points,
  ticks,
  axisMin,
  axisMax,
  formatValue,
  axisWidth,
  axisPointLabel,
  axisValueLabel,
  figureSummary,
  heightClass,
}: TrendChartProps) {
  return (
    <div role="img" aria-label={figureSummary} className="min-w-0">
      <div className={cn("w-full", heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={TREND_MARGIN} accessibilityLayer={false}>
            <XAxis
              dataKey="label"
              type="category"
              /*
               * `interval={0}` labels EVERY match. `matches[]` never exceeds 8
               * entries corpus-wide and the label is a short date, so there is
               * nothing to thin — and thinning would drop the identity of the
               * points a reader is comparing.
               */
              interval={0}
              tick={TICK_STYLE}
              axisLine={{ stroke: "var(--border-hairline)" }}
              tickLine={{ stroke: "var(--border-hairline)" }}
            >
              <Label
                value={axisPointLabel}
                position="insideBottom"
                offset={-12}
                className="type-caption"
                fill="var(--ink-secondary)"
              />
            </XAxis>
            <YAxis
              type="number"
              domain={[axisMin, axisMax]}
              ticks={ticks}
              tickFormatter={formatValue}
              tick={TICK_STYLE}
              width={axisWidth}
              axisLine={false}
              tickLine={false}
            >
              <Label
                value={axisValueLabel}
                angle={-90}
                position="insideLeft"
                className="type-caption"
                fill="var(--ink-secondary)"
              />
            </YAxis>
            <Line
              type="linear"
              dataKey="value"
              stroke="var(--viz-single)"
              strokeWidth={2}
              dot={{ fill: "var(--viz-single)", stroke: "var(--viz-single)", r: 3 }}
              /*
               * `activeDot` is HOVER state, and hover-only affordances are
               * banned outright (UX-DR15) — there is no <Tooltip> for it to
               * accompany either.
               */
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------- The category bar chart ------------------------ */

/*
 * GENERALIZED FROM `SpeedZoneChart` BY STORY 2.16 (its ruled D2).
 *
 * The component was already general — one series, `--viz-single`, a
 * caller-supplied `heightClass` with no category-count constraint — and its NAME
 * was the only speed-specific thing about it. `/teams/{slug}` mounts it four
 * times at 8 / 9 / 3 / 4 categories.
 *
 * THE ALTERNATIVES WERE REJECTED FOR MEASURED REASONS. Widening
 * `DistributionChart` (structurally two-series: `home` and `away` are both
 * required) would put regression surface on four shipped two-series mounts for
 * zero gain. A NEW chart module would mint a fresh `dynamic()` specifier, hence
 * a fresh chunk group and a second ~300 kB recharts vendor copy — the exact
 * defect `Charts.tsx` exists to remove, and the private copy 2.11a decision 1
 * bans.
 *
 * TWO THINGS CHANGED BEYOND THE NAME, both forced by prose-length labels:
 * the category axis width became a PROP (defaulted, so the speed zones are
 * untouched), and the default tick became the wrapping `CategoryTick`.
 */

export interface CategoryBarPoint {
  /** The already-resolved category label ("Zona 1", "Salida de balón", …). */
  label: string;
  /** The plotted value, raw. The axis is pre-scaled by the model. */
  value: number;
}

export interface CategoryBarChartProps {
  points: CategoryBarPoint[];
  ticks: number[];
  axisMax: number;
  formatValue: (value: number) => string;
  axisValueLabel: string;
  axisCategoryLabel: string;
  figureSummary: string;
  heightClass: string;
  /**
   * Pixels reserved for the CATEGORY (y) axis. Defaults to the narrow width the
   * speed zones need; pass `CATEGORY_AXIS_WIDTH_WIDE` for prose-length labels.
   */
  categoryAxisWidth?: number;
}

/**
 * Distance in each of the five speed bands, in metres (D7).
 *
 * HORIZONTAL BARS (`layout="vertical"` is recharts' name for them), on
 * `DistributionChart`'s proven geometry: five Spanish category labels cannot be
 * read on a vertical axis at 320 px.
 *
 * ZERO-BASED, non-negotiably — a bar encodes its length as the value.
 *
 * THE BARS DO NOT DECOMPOSE `totalDistance` AND NOTHING HERE CLAIMS THEY DO.
 * Story 1.10's reconciliation tolerance is |totalDistance − Σ zones| ≤ 0.35 m
 * (worst observed 0.200 m over 3,289 rows), so the sum is CLOSE to the total and
 * is not the total. No total is rendered, no total is derived, and the section's
 * data table lists the five bands only.
 */
export function CategoryBarChart({
  points,
  ticks,
  axisMax,
  formatValue,
  axisValueLabel,
  axisCategoryLabel,
  figureSummary,
  heightClass,
  categoryAxisWidth = ZONE_CATEGORY_AXIS_WIDTH,
}: CategoryBarChartProps) {
  return (
    <div role="img" aria-label={figureSummary} className="min-w-0">
      {/*
       * The category-axis title, in HTML where `sr-only` GENUINELY WORKS — it
       * does not apply to an SVG <text>, which is the trap DistributionChart
       * records at length.
       */}
      <span className="sr-only">{axisCategoryLabel}</span>
      <div className={cn("w-full", heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" margin={ZONE_MARGIN} accessibilityLayer={false}>
            <XAxis
              type="number"
              domain={[0, axisMax]}
              ticks={ticks}
              tickFormatter={formatValue}
              tick={TICK_STYLE}
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
              width={categoryAxisWidth}
              /* The WRAPPING tick, not `TICK_STYLE`: recharts' default renders
               * one unwrapped <text>, which broke mid-word and overlapped at
               * phase-name length. `CategoryTick` carries its own fill and
               * class, so the style object is not passed alongside it. */
              tick={<CategoryTick />}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="value"
              fill="var(--viz-single)"
              stroke="var(--viz-single)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

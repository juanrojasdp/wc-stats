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

/** Y-axis width for the zone chart's category ticks ("Zona 1" … "Zona 5"). */
const ZONE_CATEGORY_AXIS_WIDTH = 62;

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

/* ----------------------------- The speed zones ----------------------------- */

export interface SpeedZoneChartPoint {
  /** The already-resolved zone label ("Zona 1" … "Zona 5"). */
  label: string;
  /** Metres in that band. */
  value: number;
}

export interface SpeedZoneChartProps {
  points: SpeedZoneChartPoint[];
  ticks: number[];
  axisMax: number;
  formatValue: (value: number) => string;
  axisValueLabel: string;
  axisCategoryLabel: string;
  figureSummary: string;
  heightClass: string;
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
export function SpeedZoneChart({
  points,
  ticks,
  axisMax,
  formatValue,
  axisValueLabel,
  axisCategoryLabel,
  figureSummary,
  heightClass,
}: SpeedZoneChartProps) {
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
              width={ZONE_CATEGORY_AXIS_WIDTH}
              tick={TICK_STYLE}
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

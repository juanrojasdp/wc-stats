"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  Label,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { seriesLabelIndex } from "@/components/TacticalCharts";
import { cn } from "@/lib/utils";
import { AXIS_LABEL_MAX_CHARS, AXIS_LABEL_MAX_LINES, wrapAxisLabel } from "@/viz/phases-model";

/*
 * ═══════ THE FOURTH RECHARTS LEAF: `/compare`'s per-side bar (Story 2.17) ═══
 *
 * ONE SERIES, ONE ENTITY, ONE SIDE. `EXPERIENCE.md:78` rules each viz "rendered
 * PER ENTITY with identical scales/axes so sides are comparable" — two charts, not
 * one chart with two series. The shared axis domain arrives pre-computed from
 * `viz/compare-model.ts`; this file paints and decides nothing.
 *
 * ═══════ WHY A NEW MODULE AND NOT AN EDIT TO `ProfileCharts` (ruled D6) ═══════
 *
 * `CategoryBarChart` hard-codes `fill="var(--viz-single)"` and cannot serve D5
 * without a colour prop — and `globals.css:68` declares `--viz-single` as
 * `var(--viz-team-a)`, so a naive reuse would paint side A and side B THE SAME
 * COLOUR. That file is also 2.15's, was mid-rename by 2.16 while this story ran
 * (`SpeedZoneChart` → `CategoryBarChart`), and carries four shipped mounts of
 * regression surface. A new leaf costs zero of that.
 *
 * 🔴 IT IS REACHED ONLY THROUGH `@/components/Charts`. `next/dynamic` dedupes on
 * the IMPORT SPECIFIER and mints one async chunk group per distinct specifier, so
 * a `dynamic()` call pointing here directly would mint a FOURTH ~370 kB recharts
 * vendor copy — the precise defect that barrel exists to remove. One export line
 * was added there and nothing else.
 *
 * ═══════ THE MANDATORY RECHARTS CONTRACT ═══════
 *
 * `TacticalCharts.tsx:41-65`, obeyed identically rather than restated:
 * `accessibilityLayer={false}` (v3 defaults TRUE and installs
 * `role="application"`), `isAnimationActive={false}` (the reduced-motion CSS kill
 * switch does not reach recharts' JS animation), explicit `ticks` AND `domain`
 * never degenerate, colours as `var(--token)` PRESENTATION props never Tailwind
 * `fill-*`, tick text through the shared style object, NO `<Tooltip>` (hover-only,
 * banned by UX-DR15), NO `<Legend>` (direct labels only, decision 10(a)), axis
 * titles via `<Label>` never `name`, and a parent with a RESOLVED HEIGHT — a
 * height-less `ResponsiveContainer` renders nothing at all.
 *
 * THIS MODULE RESOLVES NO COPY. Every string arrives pre-resolved from the
 * section, which owns the locale and the format layer. The i18n ESLint gate does
 * not reach recharts' object-shaped props, so that is DISCIPLINE, NOT ENFORCEMENT.
 *
 * NO UNIT TESTS EXIST FOR THIS FILE and none can — the harness is
 * `environment: "node"` with no global jsdom. Every decision that CAN be pure is
 * upstream in `viz/compare-model.ts`: the tick sets, the shared domain, the
 * category order, the height classes. Task 11's browser pass is the verification.
 */

/** Shared tick style. `type-caption` carries no font-variant-numeric on its own. */
const TICK_STYLE = { className: "type-caption tabular-nums", fill: "var(--ink-secondary)" } as const;

/*
 * `right: 34` reserves the gutter the direct series label is drawn into —
 * `DISTRIBUTION_MARGIN`'s value, for the same reason: a code painted past the
 * plot's right edge is clipped by the SVG viewport, silently.
 */
const COMPARE_MARGIN = { top: 8, right: 34, bottom: 20, left: 4 } as const;

/** Pixels reserved for prose-length category labels ("Salida de balón sin presión"). */
const CATEGORY_AXIS_WIDTH = 96;

/** Line height for the wrapped category tick, in CSS px. */
const AXIS_LINE_HEIGHT_PX = 11;

/** How far past the bar's end the direct series label sits. */
const SERIES_LABEL_INSET_PX = 6;

/*
 * THE 2.10 HATCH, COPIED EXACTLY (ruled D4). 6 px tile, 1.5 px stripe, rotated
 * 45°. Both numbers are the measured pair, not a re-derivation — see the ruling
 * for the contrast table and for why re-measuring it is wasted work.
 */
const HATCH_TILE_PX = 6;
const HATCH_STROKE_PX = 1.5;

/**
 * A wrapped, two-line-capable category tick.
 *
 * recharts renders an axis tick as ONE `<text>` with NO wrapping and NO
 * truncation — a long label simply runs under the plot or off the SVG, and
 * recharts' own attempt breaks mid-word ("Salidadebalónsinpresión").
 *
 * A PAINTER, NOT A MODEL. `TacticalCharts` and `ProfileCharts` each ship their own
 * copy of this same twenty lines over the ONE shared pure wrapping contract —
 * `wrapAxisLabel`, `AXIS_LABEL_MAX_CHARS`, `AXIS_LABEL_MAX_LINES`, all imported
 * from `phases-model` and unit-tested there. One wrapping contract, three
 * painters, and the alternative — exporting a component across two lazy chart
 * leaves — would couple their chunks for twenty lines of SVG.
 */
function CategoryTick(props: { x?: number; y?: number; payload?: { value?: string | number } }) {
  const { x, y, payload } = props;
  if (x === undefined || y === undefined) {
    return null;
  }
  const lines = wrapAxisLabel(
    String(payload?.value ?? ""),
    AXIS_LABEL_MAX_CHARS,
    AXIS_LABEL_MAX_LINES
  );
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
      className="type-caption tabular-nums"
    >
      {/* Keyed by INDEX: two identical wrapped lines would collide on a content
          key and React would drop one tspan, rendering half the label. */}
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? 0 : AXIS_LINE_HEIGHT_PX}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * The direct series label — the entity's short code at the END of this series'
 * longest bar (UX-DR11 channel 1, decision 10(a)). NOT A LEGEND, and shown ALWAYS.
 *
 * 🔴 THE `-1` SENTINEL IS HONOURED HERE, and this route is why it exists.
 * `seriesLabelIndex` is imported from `TacticalCharts` — the PURE decision, shared
 * — and returns `-1` for a FLAT series, which no bar index can equal, so the
 * guard below suppresses the label rather than anchoring it at the axis origin.
 * That case is real on this route: 209 corpus players have no appearances at all,
 * so an all-zero speed-zone series is the common comparison, not the edge.
 *
 * A LOCAL PAINTER over that shared model, on `CategoryTick`'s terms exactly:
 * `TacticalCharts`' own `SeriesEndLabel` is private, sits on a two-series
 * geometry, and exporting it would couple two lazy chart chunks for thirty lines
 * of SVG.
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

export interface CompareBarPoint {
  /** The already-resolved category label ("Zona 1", "Salida de balón", …). */
  label: string;
  /** The plotted value, raw. The axis is pre-scaled by the shared model. */
  value: number;
}

export interface CompareBarChartProps {
  points: CompareBarPoint[];
  /** Explicit ticks from the pure model. NEVER left to recharts. */
  ticks: number[];
  /** The SHARED maximum — identical on both sides. That is what makes them comparable. */
  axisMax: number;
  formatValue: (value: number) => string;
  axisValueLabel: string;
  axisCategoryLabel: string;
  /** The figure's one-sentence summary. `figureSummary` is the house prop name. */
  figureSummary: string;
  /** The height class, from the PURE model — never declared in this file. */
  heightClass: string;
  /**
   * `"--viz-team-a"` for side A, `"--viz-team-b"` for side B (ruled D5).
   *
   * 🔴 NOT `--viz-single`, AND THAT IS THE RULING. `globals.css:68` declares
   * `--viz-single: var(--viz-team-a)`, and the alias's own safety argument —
   * "safe because single-entity charts have no second series" — FAILS the moment
   * two single-entity charts sit side by side under one comparison. On this route
   * `--viz-single` does not appear at all.
   */
  colorVar: string;
  /**
   * Side B only: the non-hue channel (ruled D4, UX-DR11(b)).
   *
   * The measured pair is 1.32:1 dark / 1.07:1 light between the two accents —
   * "which is why a second channel is mandatory at all". A dashed-stroke fallback
   * is NOT available on a filled bar: a dashed `--viz-team-b` stroke over a solid
   * `--viz-team-b` fill is invisible, and a card-coloured stripe is the
   * "transparent gaps" case decision 10(b) bans by name.
   */
  hatch: boolean;
  /** The entity's short code, painted at this series' longest bar. */
  seriesCode: string;
}

/**
 * One entity's category distribution, on a domain shared with its counterpart.
 *
 * HORIZONTAL BARS (`layout="vertical"` is recharts' name for them), on
 * `DistributionChart`'s proven geometry: Spanish phase names cannot be read on a
 * vertical axis at 320 px.
 *
 * ZERO-BASED, non-negotiably — a bar encodes its LENGTH as the value, so a
 * truncated baseline misstates it. The model floors every maximum, so the domain
 * can never be `[0, 0]`: recharts cannot scale one, and every mark then resolves
 * to the same or a NaN coordinate.
 *
 * `role="img"`, not `role="figure"`: the section wraps this in an UNNAMED
 * `<figure>` grouping it with its data-table alternative, and a named figure
 * around a named img gives the reader two competing accessible names.
 */
export function CompareBarChart({
  points,
  ticks,
  axisMax,
  formatValue,
  axisValueLabel,
  axisCategoryLabel,
  figureSummary,
  heightClass,
  colorVar,
  hatch,
  seriesCode,
}: CompareBarChartProps) {
  /*
   * PER INSTANCE, and this route mounts two. A hardcoded pattern id would collide
   * and every hatched bar would resolve to the first chart's pattern. React 19
   * emits guillemet-delimited ids (`«r3»`), which are NOT valid XML NCName start
   * characters — they break querySelector and getComputedStyle debugging even
   * where the browser tolerates the fill.
   */
  const patternId = `compare-b-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const labelIndex = seriesLabelIndex(points.map((point) => point.value));

  return (
    <div role="img" aria-label={figureSummary} className="min-w-0">
      {/*
       * The category-axis title, in HTML where `sr-only` GENUINELY WORKS — it does
       * not apply to an SVG `<text>`, which is the trap `DistributionChart`
       * records at length. It cannot ride a `<Label>` either: painting it beside
       * 96 px of wrapped labels has nowhere to go.
       */}
      <span className="sr-only">{axisCategoryLabel}</span>
      <div className={cn("w-full", heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            layout="vertical"
            margin={COMPARE_MARGIN}
            accessibilityLayer={false}
          >
            {hatch ? (
              <defs>
                <pattern
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  width={HATCH_TILE_PX}
                  height={HATCH_TILE_PX}
                  patternTransform="rotate(45)"
                >
                  {/* THE SOLID GROUND. Without it the hatch is transparency, and
                      decision 10(b) bans transparent gaps outright — the measured
                      10.30 / 5.36 against --surface-raised is what passes WCAG
                      1.4.11, and it only holds over a solid fill. */}
                  <rect width={HATCH_TILE_PX} height={HATCH_TILE_PX} fill={`var(${colorVar})`} />
                  {/*
                   * DRAWN AT THE TILE CENTRE, NOT THE TILE EDGE. A stroke centred
                   * on x=0 puts half its width at negative x, and an SVG pattern
                   * tile CLIPS rather than wraps — so an edge-drawn 1.5 px stroke
                   * renders as 0.75 px with no compensating mark at the opposite
                   * edge. That is half the texture UX-DR11(b) is discharged with,
                   * and it is invisible unless you measure it.
                   */}
                  <line
                    x1={HATCH_TILE_PX / 2}
                    y1={0}
                    x2={HATCH_TILE_PX / 2}
                    y2={HATCH_TILE_PX}
                    stroke="var(--ink-primary)"
                    strokeWidth={HATCH_STROKE_PX}
                  />
                </pattern>
              </defs>
            ) : null}

            <XAxis
              type="number"
              /* Floored by the model, so it can never be degenerate. */
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
              width={CATEGORY_AXIS_WIDTH}
              /* The WRAPPING tick, not `TICK_STYLE`: `CategoryTick` carries its
                 own fill and class, so the style object is not passed alongside. */
              tick={<CategoryTick />}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="value"
              fill={hatch ? `url(#${patternId})` : `var(${colorVar})`}
              /*
               * THE SOLID STROKE RIDES THE HATCH TOO. It keeps the bar's OUTLINE
               * at the mark's own measured contrast (10.30 dark / 5.36 light
               * against --surface-raised) rather than at the hatch's internal
               * texture figure, which WCAG 1.4.11 does not govern.
               */
              stroke={`var(${colorVar})`}
              strokeWidth={1}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="value"
                content={<SeriesEndLabel labelIndex={labelIndex} code={seriesCode} colorVar={colorVar} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

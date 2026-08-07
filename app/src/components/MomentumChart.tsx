"use client";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Label,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { useElementWidth } from "@/lib/use-element-width";
import { cn } from "@/lib/utils";
import {
  CHART_HEIGHT_CLASS,
  GOAL_MARKER_RADIUS_PX,
  GOAL_MARKER_RING_PX,
  MIDLINE_STROKE_PX,
  MIN_HIT_PX,
  MOMENTUM_FILL_OPACITY,
  MOMENTUM_MARGIN,
  MOMENTUM_STROKE_PX,
  MOMENTUM_Y_AXIS_WIDTH,
  TEAM_B_DASH_ARRAY,
  clampIndex,
  goalMarkerHitHalfWidths,
  indexAtOffset,
  momentumPlotBox,
  momentumYTicks,
  type MomentumGoalMarker,
  type MomentumRow,
} from "@/viz/momentum-model";

/*
 * The FIRST of THREE recharts-bearing leaves (Task 5). The claim this docblock
 * used to make — "this module is the ONLY place recharts is imported" — was
 * already false when Story 2.10 added `TacticalCharts.tsx` beside it, and Story
 * 2.15 adds `ProfileCharts.tsx` as the third; it is corrected here rather than
 * left to mislead the next reader.
 *
 * MomentumSection NO LONGER IMPORTS THIS FILE FROM ITS `dynamic()` CALL (Story
 * 2.15 ruled D1). It names `@/components/Charts` — the ONE lazy boundary — and
 * reaches `MomentumChart` through that barrel. `next/dynamic` mints one async
 * chunk group per distinct import SPECIFIER, so two call sites naming two leaves
 * produced two groups and two 300.4 kB copies of the recharts vendor; one
 * specifier produces one. The chart library still lands in its own deferred
 * chunk, which is what the code-split was for.
 *
 * It resolves NO copy: every string arrives pre-resolved from the section,
 * which owns the locale and the format layer. That is not tidiness — the i18n
 * ESLint gate does NOT reach recharts, because recharts delivers text through
 * OBJECT-SHAPED props (`label={{ value: "…" }}`) and the gate's selectors match
 * a Literal that is a DIRECT CHILD of a JSXExpressionContainer. Every text
 * value here must be a pre-resolved identifier by discipline, not enforcement.
 *
 * GEOMETRY IS RECHARTS-NATIVE (ruled decision 24). recharts does not expose its
 * resolved x-scale to a sibling node and there is no jsdom to test against, so
 * an HTML overlay would be a blind iteration loop. Everything positional rides
 * a ReferenceDot/ReferenceLine, which resolve cx/cy (or the full plot height)
 * for us:
 *
 *   goal markers   ReferenceDot x={index} y={0}     -> cx on the axis, cy = midline
 *   series labels  ReferenceDot x={0}    y={±peak*} -> cx at the left edge
 *   cursor rule    ReferenceLine x={index}          -> full plot height, natively
 *   cursor handle  ReferenceDot x={index} y={0}     -> the role="slider" node
 *   cursor chip    ReferenceDot x={index} y={peak}  -> cy = plot top
 *   the midline    ReferenceLine y={0}, DECLARED LAST
 *
 * PAINT ORDER IS NOT DECLARATION ORDER — the story's decisions 24 and 25 reason
 * from a premise that is FALSE for the installed recharts, and a code review
 * corrected it here rather than leave the next maintainer the opposite of how it
 * works. recharts 3.4+ reintroduced explicit layering: every ReferenceDot and
 * ReferenceLine is portalled out of its declared position into a z-indexed <g>
 * (`zIndex/ZIndexLayer.js`), and `DefaultZIndexes` fixes area=100, line=400,
 * axis=500, scatter(=ReferenceDot)=600. So:
 *
 *   - the midline paints over the fills because 400 > 100, NOT because it is
 *     declared last. Declaring it first would look identical.
 *   - every ReferenceDot paints over the midline regardless of declaration.
 *   - DECLARATION ORDER STILL DECIDES *WITHIN* ONE z LAYER, and it is still DOM
 *     order and therefore TAB ORDER. The decision-20 tab sequence holds only
 *     because every focusable node here happens to be a ReferenceDot (z 600).
 *     Adding a focusable ReferenceLine or Customized layer would silently
 *     reorder the tab sequence — pass an explicit `zIndex` if that day comes.
 */

/** Fallback width before the ResizeObserver reports — a mid-range phone. */
const FALLBACK_WIDTH_PX = 326;

/**
 * A conservative rendered width for the cursor chip ("45+2′ · MEX 10 · RSA 6" at
 * caption size), used to keep it inside the viewport. Measured rather than
 * guessed at a fraction of the chart: the previous `cx > width * 0.65` flip was
 * unrelated to the chip's actual extent and left a band where a start-anchored
 * chip was clipped by the SVG edge, plus a first-frame flash where the fallback
 * width made every position "near right" and ran the text off the LEFT edge.
 */
const CHIP_WIDTH_PX = 150;

/** Series labels sit at 60% of the domain: inside the plot, clear of the axis. */
const SERIES_LABEL_FRACTION = 0.6;
const SERIES_LABEL_INSET_PX = 8;

/** Large step for PageUp/PageDown — the WAI-ARIA slider pattern's large step. */
const LARGE_STEP = 10;

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CHIP_SEPARATOR = " · ";

export interface MomentumChartSide {
  teamId: string;
  /** Already uppercased at the TacticalLayer prop boundary. */
  teamCode: string;
  name: string;
}

export interface MomentumChartProps {
  rows: MomentumRow[];
  peak: number;
  markers: MomentumGoalMarker[];
  home: MomentumChartSide;
  away: MomentumChartSide;
  /** Row indices to label on the x axis (thinned responsively by the caller). */
  tickIndices: number[];
  /** The cursor position — ephemeral component state owned by the section. */
  index: number;
  /**
   * Accepts a FUNCTIONAL updater as well as an absolute index, and the key
   * handler always uses the functional form. A held-down arrow key fires
   * repeats faster than React commits, and a handler that read the index out of
   * its render closure would drop every press in a batched tick — the cursor
   * would visibly stall under key repeat. Tap-to-position passes an absolute
   * index because a tap IS absolute.
   */
  onIndexChange: (next: number | ((previous: number) => number)) => void;

  /* ---- Everything below is already resolved. No t() in this module. ---- */
  /** The figure's one-sentence aria-label. */
  figureLabel: string;
  /** x tick labels, index-aligned to `tickIndices`. */
  tickLabels: string[];
  /** y axis title and x axis title. */
  axisEntriesLabel: string;
  axisMinuteLabel: string;
  /** Formats a y tick value — MUST make it non-negative (decision 6). */
  formatYTick: (value: number) => string;
  /** The slider's aria-label and its composed aria-valuetext. */
  cursorLabel: string;
  cursorValueText: string;
  /** The visible chip: minute AND both teams' values (decision 23). */
  chipClock: string;
  chipHome: string;
  chipAway: string;
  /** One accessible name per marker, index-aligned to `markers`. */
  markerNames: string[];
}

/** A goal marker: emerald disc + full-opacity ink ring, team-NEUTRAL by design. */
function GoalMarkerShape(props: {
  cx?: number;
  cy?: number;
  name?: string;
  hitHalfWidth?: number;
  onActivate?: () => void;
}) {
  const { cx, cy, name, hitHalfWidth, onActivate } = props;
  if (cx === undefined || cy === undefined) {
    return null;
  }
  const halfWidth = hitHalfWidth ?? MIN_HIT_PX / 2;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={name}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onActivate?.();
        }
      }}
      /*
       * A role="button" MUST answer a real click: assistive technologies
       * activate a button by synthesizing a `click` event, not a keydown and not
       * a pointerdown. Without this, NVDA/JAWS/VoiceOver activation was a no-op
       * — precisely the user the "markers move the cursor" departure was written
       * to serve. Found by code review, 2026-08-03.
       */
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
      /*
       * Decision 26: the plot area's own tap-to-position handler occupies these
       * same pixels and pointer events bubble, so activating a marker must not
       * ALSO move the cursor.
       */
      onPointerDown={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
      className="cursor-pointer"
    >
      {/*
       * Invisible hit target (UX-DR15), centred on the mark. Its half-width is
       * capped at half the gap to the nearest neighbouring marker, so two goals
       * closer than 44px apart CANNOT overlap. Decision 26 ruled that the
       * first-in-DOM (chronologically earlier) marker wins such a collision, but
       * SVG hit-testing hands the pointer to whatever paints LAST — the opposite
       * — and DOM order cannot be reversed without also reversing the decision-20
       * tab order. Removing the overlap resolves it for both: the visually nearer
       * goal always wins, and where two goals are closer than 44px no arrangement
       * could give both a full target anyway.
       */}
      <rect
        x={cx - halfWidth}
        y={cy - MIN_HIT_PX / 2}
        width={halfWidth * 2}
        height={MIN_HIT_PX}
        fill="transparent"
      />
      <circle
        cx={cx}
        cy={cy}
        r={GOAL_MARKER_RADIUS_PX}
        /*
         * --shot-goal-CANVAS, not --shot-goal: this mark sits on the
         * theme-aware --surface-raised card, where the pitch emerald computes
         * 1.77:1 in the light theme (5.95:1 for the canvas value).
         */
        fill="var(--shot-goal-canvas)"
        stroke="var(--ink-primary)"
        strokeWidth={GOAL_MARKER_RING_PX}
      />
    </g>
  );
}

/** The direct series label — uppercase team code, flush LEFT (the mockup). */
function SeriesLabelShape(props: { cx?: number; cy?: number; code?: string; colorVar?: string }) {
  const { cx, cy, code, colorVar } = props;
  if (cx === undefined || cy === undefined) {
    return null;
  }
  return (
    <text
      x={cx + SERIES_LABEL_INSET_PX}
      y={cy}
      dominantBaseline="middle"
      textAnchor="start"
      fill={`var(${colorVar})`}
      className="type-label-caps"
    >
      {code}
    </text>
  );
}

/** The focusable role="slider" node. Its VISIBLE rule is a sibling ReferenceLine. */
function CursorHandleShape(props: {
  cx?: number;
  cy?: number;
  label?: string;
  valueText?: string;
  min?: number;
  max?: number;
  now?: number;
  onKeyDown?: (event: KeyboardEvent<SVGGElement>) => void;
}) {
  const { cx, cy, label, valueText, min, max, now, onKeyDown } = props;
  if (cx === undefined || cy === undefined) {
    return null;
  }
  return (
    <g
      role="slider"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      className="cursor-ew-resize"
    >
      {/*
       * NO transparent 44x44 hit rect here, deliberately. The handle used to
       * carry one, and because it is a ReferenceDot declared AFTER the goal
       * markers — same z layer, so declaration order decides — that rect painted
       * on top of them: every marker within 22px of the cursor became
       * pointer-dead, and since activating a marker moves the cursor onto it,
       * the marker you just tapped could never be tapped again.
       *
       * The handle does not need a pointer target of its own. The slider is
       * driven by the keyboard, and pointer users position it by tapping the
       * plot area, whose own >=44px-tall target (decision 19) covers every pixel
       * this rect did. Found by code review, 2026-08-03.
       */}
      <circle cx={cx} cy={cy} r={4} fill="var(--ink-primary)" />
    </g>
  );
}

/**
 * The cursor chip: minute AND both teams' values (ruled decision 23).
 *
 * NOT a recharts <Tooltip>, which is hover-only and therefore banned outright
 * (UX-DR15 / EXPERIENCE.md:103: "no hover-only information, ever"). And not the
 * mockup's bare minute either: as specified there, screen-reader users would
 * get both teams' values through aria-valuetext while sighted users got a lone
 * number — the one thing the scrub exists to deliver, unavailable to most.
 */
function CursorChipShape(props: {
  cx?: number;
  cy?: number;
  text?: string;
  chartWidth?: number;
}) {
  const { cx, cy, text, chartWidth } = props;
  if (cx === undefined || cy === undefined) {
    return null;
  }
  /*
   * Flip the anchor only when the chip would ACTUALLY overrun the right edge,
   * and only once a real measurement exists — and having flipped, make sure the
   * end-anchored chip does not then run off the LEFT edge, which is what the old
   * fraction-based flip did on the first frame, before the ResizeObserver
   * reported and while `chartWidth` was still the 326px phone fallback.
   */
  const measured = chartWidth !== undefined && chartWidth > 0;
  const overrunsRight = measured && cx + SERIES_LABEL_INSET_PX + CHIP_WIDTH_PX > chartWidth;
  const fitsLeftFlipped = cx - SERIES_LABEL_INSET_PX - CHIP_WIDTH_PX >= 0;
  const nearRight = overrunsRight && fitsLeftFlipped;
  return (
    <text
      x={cx + (nearRight ? -SERIES_LABEL_INSET_PX : SERIES_LABEL_INSET_PX)}
      y={cy - 6}
      textAnchor={nearRight ? "end" : "start"}
      fill="var(--ink-primary)"
      className="type-table-numeric"
    >
      {text}
    </text>
  );
}

export function MomentumChart({
  rows,
  peak,
  markers,
  home,
  away,
  tickIndices,
  index,
  onIndexChange,
  figureLabel,
  tickLabels,
  axisEntriesLabel,
  axisMinuteLabel,
  formatYTick,
  cursorLabel,
  cursorValueText,
  chipClock,
  chipHome,
  chipAway,
  markerNames,
}: MomentumChartProps) {
  const [widthRef, width] = useElementWidth(FALLBACK_WIDTH_PX);

  const lastIndex = rows.length - 1;
  const safeIndex = clampIndex(index, rows.length);

  /*
   * Decision 2's key model: arrows +/-1 SAMPLE, PageUp/PageDown +/-10, Home/End
   * to the ends, NO WRAP.
   *
   * "+/-1 sample" IS "+/-1 minute" through regulation play; inside stoppage it
   * steps 45+1 -> 45+2, which is the honest reading and the reason the offset is
   * in aria-valuetext. PageUp/PageDown is not optional: m074 has 138 samples, so
   * arrow-only traversal is 137 keypresses. No wrap matches PitchPanel's ruled
   * roving contract — arrowing past the last sample must not silently restart
   * the match.
   */
  /** Clamp BOTH sides of the step, so "no wrap" cannot drift past the end. */
  function step(delta: number): (previous: number) => number {
    return (previous) => clampIndex(clampIndex(previous, rows.length) + delta, rows.length);
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    /*
     * Never claim a modifier chord. Matching on `event.key` alone and calling
     * preventDefault() unconditionally swallowed Alt+Left (browser Back),
     * macOS Cmd+Left/Right (line start/end) and screen-reader pass-through
     * combinations, reinterpreting all of them as +/-1 sample.
     */
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    let next: number | ((previous: number) => number);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = step(1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = step(-1);
        break;
      case "PageUp":
        next = step(LARGE_STEP);
        break;
      case "PageDown":
        next = step(-LARGE_STEP);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = lastIndex;
        break;
      default:
        return;
    }
    event.preventDefault();
    onIndexChange(next);
  }

  /*
   * Tap-to-position (decision 19). ONE pointerdown on the plot area, mapping
   * clientX to the nearest sample. There is deliberately NO pointermove
   * listener, no setPointerCapture and no drag state: EXPERIENCE.md:107 bans
   * drag in v1, and the ban is enforced by NOT WRITING THE HANDLER rather than
   * by a flag someone can flip.
   */
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    /*
     * Only a primary-button press positions the cursor. Without this a
     * right-click, a second simultaneous touch point, or the pointerdown that
     * merely BEGINS a vertical page scroll over this full-width 122-170px target
     * all threw the reader's position away with no undo.
     */
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    /*
     * The plot box comes from the model, NOT from `rect.width - margin`. recharts
     * adds each visible left y-axis's own `width` on top of `margin.left`, so the
     * true origin is 68 here, not 34 — the old arithmetic landed a left-edge tap
     * ~17 samples late on a 138-sample mobile chart while remaining exact at the
     * right edge, which is why verification passed it.
     */
    const box = momentumPlotBox(rect.width);
    const next = indexAtOffset(event.clientX - rect.left, box.left, box.width, rows.length);
    // `null` means the box is degenerate — a no-op, never a reset to minute 1.
    if (next === null) {
      return;
    }
    onIndexChange(next);
  }

  function formatXTick(value: number): string {
    const position = tickIndices.indexOf(value);
    return position === -1 ? "" : (tickLabels[position] ?? "");
  }

  const chipText = `${chipClock}${CHIP_SEPARATOR}${chipHome}${CHIP_SEPARATOR}${chipAway}`;
  const tickStyle = { className: "type-caption tabular-nums", fill: "var(--ink-secondary)" };

  /*
   * Per-marker hit half-widths, capped so adjacent markers never overlap
   * (see GoalMarkerShape). Computed from the same plot box tap-to-position uses,
   * against the linear [0, lastIndex] x domain.
   */
  const markerHitHalfWidths = goalMarkerHitHalfWidths(
    markers,
    lastIndex,
    momentumPlotBox(width).width
  );

  /*
   * `type-caption` deliberately does NOT carry font-variant-numeric, because
   * table and panel captions want proportional figures — so the tabular half of
   * DESIGN.md:301's mandatory pairing comes from Tailwind's own `tabular-nums`
   * utility rather than by amending the shared type utility. `fill` is a
   * presentation prop with a var(), because Tailwind `fill-*` utilities do not
   * reliably reach recharts' internally-rendered <text>.
   */

  let content: ReactNode = null;
  if (rows.length > 0) {
    content = (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={MOMENTUM_MARGIN}
          /*
           * Decision 4. recharts' accessibilityLayer defaults to TRUE in v3 and
           * installs role="application" on the container, its own tabIndex and
           * its own arrow-key keydown handler that moves a tooltip. That is
           * three direct collisions: with this panel's role="figure", with the
           * slider's arrow keys, and with the goal markers' tab stops. We own
           * the keyboard contract in our own code instead.
           */
          accessibilityLayer={false}
        >
          <XAxis
            dataKey="index"
            type="number"
            /*
             * `Math.max(1, lastIndex)`: a single-sample series is contract-legal
             * (@minItems 1) and would otherwise give the degenerate domain
             * [0, 0], which recharts cannot scale — every mark then resolves to
             * the same or a NaN cx. momentumPeak floors the Y domain for exactly
             * this reason; the X domain had no equivalent.
             */
            domain={[0, Math.max(1, lastIndex)]}
            ticks={tickIndices}
            tickFormatter={formatXTick}
            tick={tickStyle}
            interval={0}
            axisLine={{ stroke: "var(--border-hairline)" }}
            tickLine={{ stroke: "var(--border-hairline)" }}
          >
            {/*
             * <Label>, not `name`. recharts' `name` prop feeds the tooltip and
             * legend payloads ONLY — and decision 23 bans the <Tooltip> outright
             * — so the axis titles previously reached no surface at all: not the
             * screen, not the accessibility tree. The y title is what names the
             * metric beside the numbers, which decision 13 requires.
             */}
            <Label value={axisMinuteLabel} position="insideBottom" className="type-caption" fill="var(--ink-secondary)" />
          </XAxis>
          <YAxis
            type="number"
            /*
             * Symmetric and DERIVED (decision 17): the midline is the true zero
             * and the two halves are comparable. Never hardcoded — per-report
             * maxima run 9-21 corpus-wide.
             */
            domain={[-peak, peak]}
            /*
             * EXPLICIT ticks. recharts' generator emits a non-uniform set with
             * no zero tick on an un-nice domain (measured on m074, peak 17:
             * +17, +1, -8, -17), which the sign-stripping formatter below then
             * renders as an unreadable "17 1 8 17".
             */
            ticks={momentumYTicks(peak)}
            /*
             * Decision 6: a [-peak, peak] domain renders "-10 -5 0 5 10" by
             * default. Both series are non-negative counts; the sign is
             * GEOMETRY. A negative number where a reader can see it is a defect.
             */
            tickFormatter={formatYTick}
            tick={tickStyle}
            axisLine={false}
            tickLine={false}
            /*
             * Pinned, and pinned to the SAME constant momentumPlotBox reads, so
             * the tap-to-position origin stays derivable. Changing one without
             * the other silently reintroduces the left-edge offset defect.
             */
            width={MOMENTUM_Y_AXIS_WIDTH}
          >
            <Label value={axisEntriesLabel} angle={-90} position="insideLeft" className="type-caption" fill="var(--ink-secondary)" />
          </YAxis>

          {/*
           * type="linear", never monotone: the mockup draws straight segments
           * and smoothing would invent values between real per-minute counts,
           * which decision 16 forbids. Every prop is pinned rather than left to
           * a default. No stackId, no connectNulls — zeros are DATA.
           */}
          <Area
            dataKey="home"
            type="linear"
            baseValue={0}
            fill="var(--viz-team-a)"
            fillOpacity={MOMENTUM_FILL_OPACITY}
            stroke="var(--viz-team-a)"
            strokeWidth={MOMENTUM_STROKE_PX}
            strokeOpacity={1}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name={home.name}
          />
          <Area
            dataKey="awayPlotted"
            type="linear"
            baseValue={0}
            fill="var(--viz-team-b)"
            fillOpacity={MOMENTUM_FILL_OPACITY}
            stroke="var(--viz-team-b)"
            strokeWidth={MOMENTUM_STROKE_PX}
            strokeOpacity={1}
            /*
             * Decision 9: the 60% fill alone measures 2.40:1 / 2.54:1 on the
             * LIGHT card against a 3:1 floor — the fills were only ever verified
             * in the dark theme. The full-opacity stroke carries the floor, and
             * Team B's DASH carries UX-DR11's non-hue channel, discharging
             * DESIGN.md:266's standing "Team B additionally dashed" rule.
             */
            strokeDasharray={TEAM_B_DASH_ARRAY}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            name={away.name}
          />

          {/* Direct series labels, flush LEFT (decision 9a, desktop.html:253). */}
          <ReferenceDot
            x={0}
            y={peak * SERIES_LABEL_FRACTION}
            shape={<SeriesLabelShape code={home.teamCode} colorVar="--viz-team-a" />}
          />
          <ReferenceDot
            x={0}
            y={-peak * SERIES_LABEL_FRACTION}
            shape={<SeriesLabelShape code={away.teamCode} colorVar="--viz-team-b" />}
          />

          {/*
           * Goal markers FIRST in declaration order, because declaration order
           * is DOM order is TAB ORDER (decision 20), and `markers` is already
           * chronological. Never a positive tabIndex.
           */}
          {markers.map((marker, position) => (
            <ReferenceDot
              key={`${marker.index}-${position}`}
              x={marker.index}
              y={0}
              shape={
                <GoalMarkerShape
                  /*
                   * `?? ""` for the same reason the x ticks have one: the two
                   * props carry no length invariant, and an undefined name
                   * renders a focusable role="button" with NO accessible name.
                   */
                  name={markerNames[position] ?? ""}
                  hitHalfWidth={markerHitHalfWidths[position]}
                  onActivate={() => onIndexChange(marker.index)}
                />
              }
            />
          ))}

          {/*
           * The cursor's visible rule: a full-plot-height dashed line, drawn by
           * recharts itself so no pixel arithmetic is needed for its extent.
           */}
          <ReferenceLine
            x={safeIndex}
            stroke="var(--ink-secondary)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <ReferenceDot
            x={safeIndex}
            y={peak}
            shape={<CursorChipShape text={chipText} chartWidth={width} />}
          />
          <ReferenceDot
            x={safeIndex}
            y={0}
            shape={
              <CursorHandleShape
                label={cursorLabel}
                valueText={cursorValueText}
                min={0}
                max={lastIndex}
                now={safeIndex}
                onKeyDown={onKeyDown}
              />
            }
          />

          {/*
           * THE MIDLINE, DECLARED LAST so it paints over both fills (decision
           * 25). DESIGN.md:288's "reserved 2px gutter that the fills never
           * enter" is not expressible in recharts — `baseValue` is one number
           * per Area, so opening a gap would render every 0/0 minute as a
           * visible band. --ink-primary, NEVER --viz-neutral, which measures
           * 1.03:1 over the composited team-A fill.
           */}
          <ReferenceLine
            y={0}
            stroke="var(--ink-primary)"
            strokeWidth={MIDLINE_STROKE_PX}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div
      role="figure"
      aria-label={figureLabel}
      className={cn("rounded-lg bg-surface-raised p-tile-gap")}
    >
      {/*
       * The ResponsiveContainer's parent MUST have a resolved height — a
       * height-less one renders nothing at all, which is recharts' single most
       * common failure mode and reads exactly like the React 19 blank-chart
       * issue. 122px below md keeps the plot >=44px tall, so the pointer floor
       * still holds (decision 27).
       */}
      <div
        ref={widthRef}
        onPointerDown={onPointerDown}
        className={cn("w-full touch-manipulation", CHART_HEIGHT_CLASS)}
      >
        {content}
      </div>
    </div>
  );
}

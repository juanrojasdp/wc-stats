import type { GoalRecord, Goals, MinuteStamp, MomentumSeries } from "@/lib/contract/contract-types";
import { MIN_HIT_PX } from "@/viz/marker-layout";

/*
 * MomentumSeries + metadata.goals -> plot rows, the symmetric domain, the goal
 * markers, the data-table rows and the figure counts (Task 3). Pure and
 * locale-free: this module returns RAW numbers and RAW MinuteStamps, and
 * MomentumSection resolves every string. A t() call here is an ESLint error —
 * src/viz is inside the client-import seam — and `@/lib/format` stays out by
 * discipline rather than by enforcement (the seam restricts exactly two paths,
 * probed live: the `t` binding and `@/lib/build-data`). The split is the only
 * reason any of this is testable: the harness has no jsdom, so nothing rendered
 * can be unit-tested at all.
 *
 * THE ONE THING TO CARRY IN YOUR HEAD: `at.minute` IS NOT UNIQUE. m001 carries
 * minute 45 five times and 90 eight times; m074 carries 45x7, 90x6, 105x5,
 * 120x4. Everything here is keyed on the ROW INDEX, which is unique and
 * contiguous, and the slider indexes samples for exactly that reason (ruled
 * decision 1) — a minute-indexed slider cannot address `45+1 … 45+4` at all,
 * silently deleting 11 samples in m001 and 18 in m074 from keyboard reach.
 */

/** UX-DR15's touch floor, re-exported so the chart has one import, not two. */
export { MIN_HIT_PX };

/*
 * The area encoding (ruled decision 9). 60% fill PLUS a full-opacity boundary
 * stroke: the fills are contrast-verified in the DARK theme only
 * (review-accessibility.md:11, 5.62 / 4.48 vs the card) and computed 2.40:1 /
 * 2.54:1 against the LIGHT theme's #ffffff card, under a 3:1 non-text floor.
 * The stroke carries the floor (4.99 / 5.36 light, 13.56 dark) and Team B's
 * dash carries UX-DR11's non-hue channel — which also discharges DESIGN.md:266's
 * standing "every two-team recharts view ... Team B additionally dashed" rule.
 */
export const MOMENTUM_FILL_OPACITY = 0.6;
export const MOMENTUM_STROKE_PX = 2;
export const TEAM_B_DASH_ARRAY = "6 3";

/*
 * The midline (ruled decision 25). DESIGN.md:288's "reserved 2px axis gutter"
 * is NOT expressible in recharts — with a continuous [-peak, peak] domain and
 * both Areas anchored at 0 the fills meet exactly at y=0, and `baseValue` is a
 * single number per Area, so offsetting to open a gap would render every 0/0
 * minute as a visible band (30 samples in m001, 23 in m074). The line is drawn
 * OVER the fills in --ink-primary instead, declared last because recharts v3
 * removed `isFront`. Never --viz-neutral: it measures 1.03:1 over the
 * composited team-A fill (review-accessibility.md:18).
 */
export const MIDLINE_STROKE_PX = 2;

/** Goal marker geometry, CSS px. Team-neutral by design (decision 7). */
export const GOAL_MARKER_RADIUS_PX = 5;
export const GOAL_MARKER_RING_PX = 1.5;

/*
 * Chart box geometry. These live HERE, not in the component, for two reasons.
 *
 * 1. `CHART_HEIGHT_CLASS` was previously exported from MomentumChart and
 *    imported as a VALUE by MomentumSection — a static module-graph edge into
 *    the very module `next/dynamic` exists to defer (decision 21), which pulls
 *    recharts back onto the critical path. Only the TYPE may cross that
 *    boundary now.
 * 2. The plot-box arithmetic below is the one piece of pixel math in this story,
 *    and it belongs where it can be unit-tested without a DOM.
 *
 * Decision 27's heights: ~170px at >=md (desktop.html's 1056x170 viewBox),
 * ~122px below (mobile.html's 326x122). At 122px the plot still clears
 * decision 19's 44px pointer floor.
 */
export const CHART_HEIGHT_CLASS = "h-[122px] md:h-[170px]";

/** The fixed `margin` object handed to `<AreaChart>` (decision 24). */
export const MOMENTUM_MARGIN = { top: 18, right: 10, bottom: 18, left: 34 } as const;

/** The explicit `width` handed to `<YAxis>`. Pinned so the plot box is derivable. */
export const MOMENTUM_Y_AXIS_WIDTH = 34;

/**
 * The recharts plot area's own box, in container-relative CSS px.
 *
 * THE TRAP THIS EXISTS FOR: the plot does NOT start at `margin.left`. recharts
 * computes `offset.left = margin.left + leftAxesOffset`
 * (`selectChartOffsetInternal.js`), and `selectLeftAxesOffset` adds each visible
 * left-oriented y-axis's own `width`. With both at 34 the true origin is 68, not
 * 34 — and a tap handler that assumes 34 is wrong by a full axis width at the
 * left edge, decaying to exactly zero at the right edge. That decay is why a
 * right-edge spot-check passes while the left edge is off by ~17 samples on a
 * 138-sample mobile chart. Found by code review, 2026-08-03.
 */
export function momentumPlotBox(containerWidth: number): { left: number; width: number } {
  const left = MOMENTUM_MARGIN.left + MOMENTUM_Y_AXIS_WIDTH;
  return { left, width: containerWidth - left - MOMENTUM_MARGIN.right };
}

/** One plot row. `index` is the slider's address space and the x dataKey. */
export interface MomentumRow {
  /** Position in the series: unique, contiguous 0…n-1. The slider's value. */
  index: number;
  /** The raw stamp. NEVER formatted here — the component owns the locale. */
  at: MinuteStamp;
  /** Raw final-third distribution counts, both non-negative. */
  home: number;
  away: number;
  /**
   * `-away`, for GEOMETRY ONLY (ruled decision 6). The diverging
   * above/below-midline layout is presentation, not sign: both series are
   * non-negative counts on the same scale. Read `away` everywhere a number
   * reaches a human — the table, aria-valuetext, the cursor chip, the axis
   * ticks. A negative number rendered anywhere a reader can see it is a defect.
   */
  awayPlotted: number;
}

/** A goal resolved onto the sample grid. Chronological — that IS the tab order. */
export interface MomentumGoalMarker {
  /** Row index this goal sits on. */
  index: number;
  /** The BENEFITING team, even for own goals (AD-6). */
  teamId: string;
  scorerName: string;
  ownGoal: boolean;
  penalty: boolean;
  /** The goal's own stamp, which may differ from the row's when `exact` is false. */
  at: MinuteStamp;
  /**
   * True when `(minute, stoppageMinute)` hit a sample exactly; false when the
   * nearest-sample fallback fired (decision 7a). Recorded rather than silent:
   * a goal that vanishes from the axis is a data lie on the one chart whose
   * job is to show when the match swung.
   */
  exact: boolean;
}

/** One data-table row. RAW values only — never `awayPlotted` (decision 6). */
export interface MomentumTableRow {
  /*
   * A STRING key, `momentum-row-${index}`, on the `shot-row-${index}` /
   * `defensive-row-${index}` precedent — every other row model in src/viz/ uses
   * one. Unified by Story 2.11a (decision 6): the shared sortable table stamps
   * `data-row-key` on every `<tr>` so a sort can restore focus into the row that
   * had it, and that key must be one type across all twenty tables.
   */
  key: string;
  /** The raw stamp; the component formats it. No `?? 0` defaulting here — see below. */
  at: MinuteStamp;
  home: number;
  away: number;
  /** Whether at least one goal fell on this sample. */
  hasGoal: boolean;
}

export interface MomentumFigureCounts {
  samples: number;
  goals: number;
}

/**
 * The packing base for `stampRank`. `readStamp` ENFORCES `stoppageMinute` below
 * this, so the collapse below is collision-free by construction rather than by
 * assertion — the contract's own bound is 1-30, and a review found the previous
 * code merely commented the bound while accepting any number, which let
 * `45+100` rank identically to minute 46 and silently reorder both the markers
 * and (because that order IS the tab order) the keyboard sequence.
 */
const STOPPAGE_RANK_BASE = 100;

/**
 * Lexicographic (minute, stoppageMinute ?? 0) collapsed into one monotone
 * scalar, so "nearest by that ordering" is a plain subtraction. The ordering
 * this produces is identical to `orderByMinute`'s.
 *
 * A null stoppageMinute sorts BEFORE 45+1, which is correct: `45/null` is the
 * 45th regulation minute and the stoppage slots follow it.
 */
function stampRank(at: MinuteStamp): number {
  return at.minute * STOPPAGE_RANK_BASE + (at.stoppageMinute ?? 0);
}

function sameStamp(a: MinuteStamp, b: MinuteStamp): boolean {
  return a.minute === b.minute && (a.stoppageMinute ?? null) === (b.stoppageMinute ?? null);
}

function readStamp(value: unknown, field: string): MinuteStamp {
  if (value === null || typeof value !== "object") {
    throw new Error(`${field}: expected a MinuteStamp object, got ${JSON.stringify(value)}`);
  }
  const at = value as { minute?: unknown; stoppageMinute?: unknown };
  if (!Number.isInteger(at.minute) || (at.minute as number) < 0) {
    throw new Error(
      `${field}.minute: expected a non-negative integer, got ${JSON.stringify(at.minute)}`
    );
  }
  const stoppage = at.stoppageMinute;
  /*
   * `stoppageMinute` is checked as strictly as `minute`, and bounded. The
   * previous guard tested only `typeof stoppage !== "number"`, which NaN and
   * Infinity both pass (`typeof NaN === "number"`) — a NaN rank makes every
   * `distance < bestDistance` comparison false, collapsing every off-grid goal
   * onto row 0, and renders "45+NaN" into the cursor chip, aria-valuetext and
   * the table. The upper bound is what makes STOPPAGE_RANK_BASE collision-free.
   */
  if (stoppage !== null && stoppage !== undefined) {
    if (!Number.isInteger(stoppage) || (stoppage as number) < 0) {
      throw new Error(
        `${field}.stoppageMinute: expected a non-negative integer or null, got ${JSON.stringify(stoppage)}`
      );
    }
    if ((stoppage as number) >= STOPPAGE_RANK_BASE) {
      throw new Error(
        `${field}.stoppageMinute: expected below ${STOPPAGE_RANK_BASE} (the contract bounds it 1-30), got ${JSON.stringify(stoppage)}`
      );
    }
  }
  return {
    minute: at.minute as number,
    stoppageMinute: typeof stoppage === "number" ? stoppage : null,
  };
}

/*
 * Counts are NON-NEGATIVE INTEGERS by contract, and this guard now says so.
 * Finiteness alone was not enough: a negative `away` is turned POSITIVE by the
 * `away === 0 ? 0 : -away` projection, drawing team B's area above the midline
 * inside team A's half and escaping the `[-peak, peak]` domain; and a
 * fractional count renders through `formatInteger` as "1" while failing
 * `count === 1`, producing "1 entradas".
 */
function readCount(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(
      `${field}: expected a non-negative integer, got ${JSON.stringify(value)}`
    );
  }
  return value as number;
}

/**
 * The plot rows (Task 3.2).
 *
 * FAILS LOUD on an empty or malformed series (ruled decision 8). `MomentumSamples`
 * is `[MomentumSample, ...MomentumSample[]]` (`@minItems 1`), so `samples: []` is
 * a CONTRACT VIOLATION, not a zero-content state — the null-vs-[] three-way
 * `panelDataState` Story 2.7 needed does not apply here, and momentum is
 * genuinely two-state (`bundle.momentum === null` is the only absence). But the
 * bundle arrives as an unvalidated `as`-cast, so every field is read through a
 * guard and every throw names the field. TacticalErrorBoundary catches it; a
 * silently blank chart does not.
 *
 * ZEROS ARE DATA (decision 16): nothing is filtered, gapped, interpolated or
 * smoothed. 30 of m001's 101 samples and 23 of m074's 138 are 0/0, and the
 * contract is explicit that a minute in which neither team entered the final
 * third carries 0/0, never a missing sample.
 */
export function momentumRows(series: MomentumSeries): MomentumRow[] {
  const samples = (series as { samples?: unknown } | null | undefined)?.samples;
  if (!Array.isArray(samples)) {
    throw new Error(
      `momentum.samples: expected an array, got ${JSON.stringify(samples ?? null)}`
    );
  }
  if (samples.length === 0) {
    throw new Error(
      "momentum.samples: the contract declares @minItems 1, so an empty series is a contract violation, not an absence — momentum: null is the only absence state"
    );
  }
  return samples.map((raw, index) => {
    const sample = raw as { at?: unknown; home?: unknown; away?: unknown };
    const at = readStamp(sample.at, `momentum.samples[${index}].at`);
    const home = readCount(sample.home, `momentum.samples[${index}].home`);
    const away = readCount(sample.away, `momentum.samples[${index}].away`);
    /*
     * `away === 0 ? 0 : -away`, not a bare `-away`: JavaScript's unary minus
     * yields NEGATIVE ZERO for 0, and 30 of m001's samples / 23 of m074's are
     * exactly that. -0 plots identically but formats as "-0" the moment it
     * reaches a formatter — precisely the "a negative number anywhere a reader
     * can see it is a defect" rule decision 6 exists to enforce.
     */
    return { index, at, home, away, awayPlotted: away === 0 ? 0 : -away };
  });
}

/**
 * The symmetric domain's half-extent (Task 3.3, decision 17): the y-domain is
 * `[-peak, peak]` so the midline is the true zero and the two halves are
 * comparable. Derived, NEVER hardcoded — per-report maxima run 9-21 corpus-wide
 * (m001 tops at 10 home / 6 away; m074 at 17 / 9).
 *
 * Floored at 1: an all-zeros series would otherwise produce a degenerate
 * `[0, 0]` domain, which recharts cannot scale.
 */
export function momentumPeak(rows: readonly MomentumRow[]): number {
  let peak = 0;
  for (const row of rows) {
    peak = Math.max(peak, row.home, row.away);
  }
  return Math.max(1, peak);
}

/**
 * Goals resolved onto the sample grid (Task 3.4).
 *
 * The source is `bundle.metadata.goals`, NEVER the momentum series — the
 * contract states it twice ("The Momentum Timeline's goal markers come from
 * here, never from the momentum series"). `teamId` is the BENEFITING team even
 * for own goals, so m074 credits Gustavo GOMEZ's own goal to `germany`.
 * Shoot-out conversions are never goals, so m074 carries exactly 2 markers on a
 * match decided on penalties.
 *
 * Exact `(minute, stoppageMinute)` match first; nearest-by-ordering fallback
 * second, flagged (decision 7a). The composite key matters: no fixture has a
 * goal in stoppage time, so real data only ever exercises the `null` branch —
 * the stoppage branch is covered by constructed tests or it ships unverified.
 *
 * The returned order is chronological, and THAT ORDER IS THE TAB ORDER
 * (decision 20) and the first-in-DOM-order tiebreak when two markers' hit boxes
 * overlap (decision 26).
 */
export function goalMarkers(goals: Goals, rows: readonly MomentumRow[]): MomentumGoalMarker[] {
  if (!Array.isArray(goals) || rows.length === 0) {
    return [];
  }
  const resolved = goals.map((raw, order) => {
    const goal = raw as Partial<GoalRecord>;
    const at = readStamp(goal.at, `metadata.goals[${order}].at`);
    const exactRow = rows.find((row) => sameStamp(row.at, at));
    if (exactRow !== undefined) {
      return { goal, at, order, index: exactRow.index, exact: true };
    }
    /*
     * Nearest sample by the same ordering. Ties resolve to the EARLIER row —
     * `<` rather than `<=` on the scan — so the fallback is deterministic.
     */
    const target = stampRank(at);
    let best = rows[0];
    let bestDistance = Math.abs(stampRank(rows[0].at) - target);
    for (const row of rows) {
      const distance = Math.abs(stampRank(row.at) - target);
      if (distance < bestDistance) {
        best = row;
        bestDistance = distance;
      }
    }
    return { goal, at, order, index: best.index, exact: false };
  });

  return resolved
    .sort((a, b) => {
      const rankDelta = stampRank(a.at) - stampRank(b.at);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      // Stable tiebreak on the source order, so two goals sharing a stamp keep
      // the contract's own chronology — which is what decision 26 resolves on.
      return a.order - b.order;
    })
    .map(({ goal, at, index, exact }) => ({
      index,
      teamId: typeof goal.teamId === "string" ? goal.teamId : "",
      scorerName: typeof goal.scorerName === "string" ? goal.scorerName : "",
      ownGoal: goal.ownGoal === true,
      penalty: goal.penalty === true,
      at,
      exact,
    }));
}

/**
 * Per-marker pointer hit half-widths in CSS px, index-aligned to `markers`.
 *
 * Each is `MIN_HIT_PX / 2` (UX-DR15's touch floor) capped at HALF the pixel gap
 * to the nearest neighbouring marker, so two markers' hit boxes can never
 * overlap.
 *
 * Why this exists: ruled decision 26 says that when two goals' hit boxes overlap
 * the first-in-DOM (chronologically earlier) marker wins. SVG hit-testing gives
 * the pointer to whatever paints LAST, which is the opposite — and the markers
 * cannot simply be reversed, because their DOM order is also the decision-20 tab
 * order. Removing the overlap satisfies both contracts at once: the visually
 * nearer goal always wins, deterministically. Where two goals are closer than
 * MIN_HIT_PX apart no arrangement could give both a full-size target anyway.
 *
 * Reachable on real data: at `<md` a 138-sample chart puts samples ~2.4px apart,
 * so any two goals within ~9 minutes of each other collide.
 */
export function goalMarkerHitHalfWidths(
  markers: readonly MomentumGoalMarker[],
  lastIndex: number,
  plotWidth: number
): number[] {
  const fullHalf = MIN_HIT_PX / 2;
  if (markers.length === 0) {
    return [];
  }
  if (lastIndex <= 0 || plotWidth <= 0) {
    return markers.map(() => fullHalf);
  }
  const pxPerIndex = plotWidth / lastIndex;
  return markers.map((marker, position) => {
    let half = fullHalf;
    for (const neighbour of [markers[position - 1], markers[position + 1]]) {
      if (neighbour === undefined) {
        continue;
      }
      const gapPx = Math.abs(neighbour.index - marker.index) * pxPerIndex;
      half = Math.min(half, gapPx / 2);
    }
    return half;
  });
}

/**
 * The data-table rows (Task 3.5). RAW values only — never `awayPlotted`, never
 * a negative number, because this is the surface UX-DR16/NFR-2 exist for.
 *
 * The stamp is carried RAW rather than formatted, and deliberately NOT through
 * `ShotLogRow`'s `?? 0` minute defaulting (deferred-work: "dead fields carrying
 * a defaulting decision") — that pattern sorts a clock-less row to minute 0,
 * the opposite of `orderByMinute`'s ruled contract. A MomentumSample's `at` is
 * required and `momentumRows` has already thrown if it is unreadable, so there
 * is nothing here to default.
 *
 * SORTABLE as of Story 2.11a: the shared `components/DataTable` sorts this row
 * array through the one cross-table contract in `lib/table-sort.ts`. The clock
 * column sorts on the raw `at` stamp, never on the rendered "45+2′" label.
 */
export function momentumTableRows(
  rows: readonly MomentumRow[],
  markers: readonly MomentumGoalMarker[]
): MomentumTableRow[] {
  const goalIndices = new Set(markers.map((marker) => marker.index));
  return rows.map((row) => ({
    key: `momentum-row-${row.index}`,
    at: row.at,
    home: row.home,
    away: row.away,
    hasGoal: goalIndices.has(row.index),
  }));
}

/**
 * The figure summary's counts (Task 3.6). Counts come from what is DRAWN —
 * never from `keyStatistics.goals`, which is the defect Story 2.7's ruled
 * decision 12 filed (reading keyStatistics renders "1 gol" over a goal-less
 * figure; m074 Germany is exactly that case).
 *
 * Nothing else is counted, summed, averaged or totalled (decision 15): the
 * momentum series has no per-team total anywhere in the report — best
 * exact-match rate 2 of 208 team-innings — so a "total final-third entries"
 * chip would be an unvalidatable derivation.
 */
export function momentumFigureCounts(
  rows: readonly MomentumRow[],
  markers: readonly MomentumGoalMarker[]
): MomentumFigureCounts {
  return { samples: rows.length, goals: markers.length };
}

/**
 * Symmetric, integer, always-includes-zero y-axis ticks for the `[-peak, peak]`
 * domain.
 *
 * NOT optional, and not cosmetic. recharts' own tick generator produces a
 * NON-UNIFORM set on a domain it considers un-nice: measured live on m074
 * (peak 17) it emitted `+17, +1, -8, -17` — four ticks, unevenly spaced, and
 * **with no zero tick at all** on the one chart whose entire encoding is
 * "above or below the zero line". Worse, decision 6 strips the sign for
 * display, so those labels render as `17 1 8 17` and a reader cannot tell the
 * +8 half from the -8 half. m001 (peak 10) happened to come out clean, which is
 * exactly how this would have shipped unnoticed.
 *
 * The step is the smallest 1/2/5-times-a-power-of-ten that puts at most two
 * ticks on each side of zero, floored at 1 because these are integer counts.
 */
export function momentumYTicks(peak: number): number[] {
  const safePeak = Math.max(1, peak);
  const target = safePeak / 2;
  const exponent = Math.floor(Math.log10(target));
  const base = Math.pow(10, exponent);
  let step = base * 10;
  for (const multiple of [1, 2, 5, 10]) {
    if (base * multiple >= target) {
      step = base * multiple;
      break;
    }
  }
  step = Math.max(1, Math.round(step));
  const count = Math.floor(safePeak / step);
  const positives: number[] = [];
  for (let k = 1; k <= count; k += 1) {
    positives.push(k * step);
  }

  /*
   * THE PEAK IS ALWAYS LABELLED (ruled by code review, 2026-08-03). The round
   * steps alone left m074's peak of 17 unlabelled above a top tick of 10 — the
   * tallest label covered 59% of the domain, so the curve's maximum could not be
   * read off the axis at all. With no axis line, no tick line and no grid, three
   * floating numbers are the entire y scale.
   *
   * If the peak is at least half a step clear of the outermost round tick it is
   * APPENDED (17 -> -17 -10 0 10 17); if it crowds that tick it REPLACES it
   * (11 -> -11 0 11), so two labels never collide. Gaps are therefore no longer
   * uniform, which is the deliberate trade — an unlabelled maximum is worse.
   */
  const outer = positives.length > 0 ? positives[positives.length - 1] : 0;
  if (safePeak > outer) {
    if (safePeak - outer >= step / 2) {
      positives.push(safePeak);
    } else {
      positives[positives.length - 1] = safePeak;
    }
  }

  return [...positives.map((t) => -t).reverse(), 0, ...positives];
}

/**
 * Row indices to label on the x axis: the first row, then the first row of each
 * minute that is a multiple of `stepMinutes` and is NOT a stoppage slot.
 *
 * Pure and index-based for the same reason everything else here is — minute is
 * not unique, so "the row for minute 45" has to mean a specific one, and the
 * regulation slot is the honest choice. `stepMinutes` is a parameter so the tick
 * count can be reduced responsively at 200% zoom or below `md` without the
 * component doing arithmetic (Task 11.6a).
 */
export function momentumTickIndices(
  rows: readonly MomentumRow[],
  stepMinutes: number
): number[] {
  if (rows.length === 0 || stepMinutes <= 0) {
    return [];
  }
  /*
   * Index 0 always anchors the axis — it is the series' start and the mockup
   * labels it. Its minute is seeded into `seen` when it is a regulation slot, so
   * a later row carrying the SAME minute cannot emit a second tick at the same
   * clock label (reachable whenever minute 0 or the step minute repeats across
   * stoppage). Previously index 0 was pushed without any of the tests every
   * other tick must pass, and its minute was never recorded.
   */
  const ticks: number[] = [0];
  const seen = new Set<number>();
  const firstStoppage = rows[0].at.stoppageMinute;
  if (firstStoppage === null || firstStoppage === undefined) {
    seen.add(rows[0].at.minute);
  }
  for (const row of rows) {
    if (row.at.stoppageMinute !== null && row.at.stoppageMinute !== undefined) {
      continue;
    }
    if (row.at.minute % stepMinutes !== 0 || seen.has(row.at.minute)) {
      continue;
    }
    seen.add(row.at.minute);
    if (row.index !== 0) {
      ticks.push(row.index);
    }
  }
  return ticks;
}

/**
 * Clamp a slider index into range (Task 6.4). Clamped at READ time, never
 * synced in an effect — `react-hooks/set-state-in-effect` fires otherwise, and
 * PitchPanel already ruled this shape.
 */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * clientX -> nearest row index for tap-to-position (decision 19). Pure so the
 * one piece of pointer arithmetic in the story is testable without a DOM.
 *
 * `plotLeft`/`plotWidth` are the recharts plot area's own box — get them from
 * `momentumPlotBox`, NEVER by subtracting the margin alone, which omits the
 * y-axis width and lands the cursor a full axis width late at the left edge.
 *
 * Returns `null` when the box is degenerate (a `display:none` ancestor, a
 * collapsed flex parent, a print stylesheet all give `width <= 0`). That is a
 * NO-OP signal, not index 0: silently resetting a reader's cursor to minute 1
 * because the container happened to be unmeasurable is a defect, not a default.
 */
export function indexAtOffset(
  offsetX: number,
  plotLeft: number,
  plotWidth: number,
  length: number
): number | null {
  if (length <= 1) {
    return 0;
  }
  if (plotWidth <= 0) {
    return null;
  }
  const fraction = (offsetX - plotLeft) / plotWidth;
  return clampIndex(Math.round(fraction * (length - 1)), length);
}

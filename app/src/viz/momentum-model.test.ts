import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  GoalRecord,
  MatchBundle,
  MinuteStamp,
  MomentumSeries,
} from "@/lib/contract/contract-types";
import { MIN_HIT_PX } from "@/viz/marker-layout";
import {
  GOAL_MARKER_RADIUS_PX,
  MOMENTUM_FILL_OPACITY,
  MOMENTUM_MARGIN,
  MOMENTUM_Y_AXIS_WIDTH,
  clampIndex,
  goalMarkerHitHalfWidths,
  goalMarkers,
  indexAtOffset,
  momentumPlotBox,
  momentumFigureCounts,
  momentumPeak,
  momentumRows,
  momentumTableRows,
  momentumTickIndices,
  momentumYTicks,
} from "@/viz/momentum-model";

/*
 * Task 4. Node environment, no jsdom — the same shape as the five viz suites
 * stories 2.7 and 2.8 shipped, and the reason every decision that can be a
 * function lives in a pure module at all.
 *
 * Every number below is a LITERAL read off the real fixtures, never a
 * re-derivation of the implementation's own formula (the 2.4 review lesson: a
 * test that recomputes the formula proves nothing). If one of these moves, the
 * fixture moved and something upstream needs a look.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

function seriesOf(bundle: MatchBundle): MomentumSeries {
  const { momentum } = bundle;
  if (momentum === null) {
    throw new Error("fixture carries momentum: null");
  }
  return momentum;
}

const rows001 = momentumRows(seriesOf(m001));
const rows074 = momentumRows(seriesOf(m074));

function stamp(minute: number, stoppageMinute: number | null = null): MinuteStamp {
  return { minute, stoppageMinute };
}

function goal(at: MinuteStamp, overrides: Partial<GoalRecord> = {}): GoalRecord {
  return {
    teamId: "mexico",
    scorerPlayerId: "test-player",
    scorerName: "TEST PLAYER",
    at,
    ownGoal: false,
    penalty: false,
    ...overrides,
  } as GoalRecord;
}

describe("momentumRows — the plot rows (decisions 8, 16)", () => {
  it("emits one row per sample over m001, pinned as a literal", () => {
    expect(rows001).toHaveLength(101);
    expect(rows001[0].at).toEqual({ minute: 1, stoppageMinute: null });
    expect(rows001[0].home).toBe(1);
    expect(rows001[0].away).toBe(0);
    expect(rows001[100].at).toEqual({ minute: 90, stoppageMinute: 7 });
    expect(rows001[100].home).toBe(0);
    expect(rows001[100].away).toBe(0);
  });

  it("emits one row per sample over m074, pinned as a literal", () => {
    expect(rows074).toHaveLength(138);
    expect(rows074[0].at).toEqual({ minute: 1, stoppageMinute: null });
    expect(rows074[0].home).toBe(2);
    expect(rows074[137].at).toEqual({ minute: 120, stoppageMinute: 3 });
  });

  it("pins m001's measured shape: range 1-90, 11 stoppage samples, 30 zero-zero samples", () => {
    expect(rows001[0].at.minute).toBe(1);
    expect(rows001[rows001.length - 1].at.minute).toBe(90);
    expect(rows001.filter((row) => row.at.stoppageMinute !== null)).toHaveLength(11);
    expect(rows001.filter((row) => row.home === 0 && row.away === 0)).toHaveLength(30);
    expect(Math.max(...rows001.map((row) => row.home))).toBe(10);
    expect(Math.max(...rows001.map((row) => row.away))).toBe(6);
  });

  it("pins m074's measured shape: range 1-120, 18 stoppage samples, 23 zero-zero samples", () => {
    expect(rows074[0].at.minute).toBe(1);
    expect(rows074[rows074.length - 1].at.minute).toBe(120);
    expect(rows074.filter((row) => row.at.stoppageMinute !== null)).toHaveLength(18);
    expect(rows074.filter((row) => row.home === 0 && row.away === 0)).toHaveLength(23);
    expect(Math.max(...rows074.map((row) => row.home))).toBe(17);
    expect(Math.max(...rows074.map((row) => row.away))).toBe(9);
  });

  it("keeps EVERY zero-zero sample — none filtered, no gap, no interpolation (decision 16)", () => {
    for (const [rows, series] of [
      [rows001, seriesOf(m001)],
      [rows074, seriesOf(m074)],
    ] as const) {
      const zeroSamples = series.samples.filter((s) => s.home === 0 && s.away === 0);
      const zeroRows = rows.filter((row) => row.home === 0 && row.away === 0);
      expect(zeroRows).toHaveLength(zeroSamples.length);
      // And the row array is the same length as the source: nothing dropped.
      expect(rows).toHaveLength(series.samples.length);
    }
  });

  it("throws naming the field on an empty series (decision 8: [] is a contract violation)", () => {
    expect(() => momentumRows({ samples: [] } as unknown as MomentumSeries)).toThrow(
      /momentum\.samples/
    );
    expect(() => momentumRows({ samples: [] } as unknown as MomentumSeries)).toThrow(/@minItems 1/);
  });

  it("throws naming the field on samples: null and on a missing samples key", () => {
    expect(() => momentumRows({ samples: null } as unknown as MomentumSeries)).toThrow(
      /momentum\.samples: expected an array/
    );
    expect(() => momentumRows({} as unknown as MomentumSeries)).toThrow(
      /momentum\.samples: expected an array/
    );
    expect(() => momentumRows(null as unknown as MomentumSeries)).toThrow(
      /momentum\.samples: expected an array/
    );
  });

  it("throws naming the indexed field on a malformed sample", () => {
    expect(() =>
      momentumRows({ samples: [{ at: stamp(1), home: 1 }] } as unknown as MomentumSeries)
    ).toThrow(/momentum\.samples\[0\]\.away/);
    expect(() =>
      momentumRows({ samples: [{ home: 1, away: 0 }] } as unknown as MomentumSeries)
    ).toThrow(/momentum\.samples\[0\]\.at/);
  });
});

describe("the index space — decision 1's teeth", () => {
  /*
   * THIS SUITE FAILS IF ANYONE RE-INDEXES THE SLIDER BY MINUTE. `at.minute` is
   * not injective over either fixture, so a minute-indexed slider cannot address
   * `45+1 … 45+4` at all — 11 real samples in m001 and 18 in m074 would be
   * unreachable by keyboard, which is the exact failure the slider exists to fix.
   */
  it("at.minute is NOT unique in m001: minute 45 five times, minute 90 eight times", () => {
    const counts = new Map<number, number>();
    for (const row of rows001) {
      counts.set(row.at.minute, (counts.get(row.at.minute) ?? 0) + 1);
    }
    expect(counts.get(45)).toBe(5);
    expect(counts.get(90)).toBe(8);
    expect(new Set(rows001.map((row) => row.at.minute)).size).toBeLessThan(rows001.length);
  });

  it("at.minute is NOT unique in m074: 45x7, 90x6, 105x5, 120x4", () => {
    const counts = new Map<number, number>();
    for (const row of rows074) {
      counts.set(row.at.minute, (counts.get(row.at.minute) ?? 0) + 1);
    }
    expect(counts.get(45)).toBe(7);
    expect(counts.get(90)).toBe(6);
    expect(counts.get(105)).toBe(5);
    expect(counts.get(120)).toBe(4);
  });

  it("row indices ARE unique and contiguous 0…n-1 on both fixtures", () => {
    for (const rows of [rows001, rows074]) {
      expect(rows.map((row) => row.index)).toEqual(rows.map((_, index) => index));
      expect(new Set(rows.map((row) => row.index)).size).toBe(rows.length);
    }
  });

  it("m001 indices 44-48 are the five distinct minute-45 samples", () => {
    expect(rows001.slice(44, 49).map((row) => row.at)).toEqual([
      { minute: 45, stoppageMinute: null },
      { minute: 45, stoppageMinute: 1 },
      { minute: 45, stoppageMinute: 2 },
      { minute: 45, stoppageMinute: 3 },
      { minute: 45, stoppageMinute: 4 },
    ]);
  });
});

describe("momentumPeak — the symmetric domain (decision 17)", () => {
  it("is the per-report maximum over BOTH series, pinned as a literal", () => {
    expect(momentumPeak(rows001)).toBe(10);
    expect(momentumPeak(rows074)).toBe(17);
  });

  it("floors an all-zeros series at 1 rather than returning a degenerate [0,0] domain", () => {
    const flat = momentumRows({
      samples: [
        { at: stamp(1), home: 0, away: 0 },
        { at: stamp(2), home: 0, away: 0 },
      ],
    } as unknown as MomentumSeries);
    expect(momentumPeak(flat)).toBe(1);
  });
});

describe("awayPlotted — geometry only (decision 6)", () => {
  it("is negative wherever away > 0, and zero where away is zero", () => {
    for (const rows of [rows001, rows074]) {
      for (const row of rows) {
        if (row.away > 0) {
          expect(row.awayPlotted).toBe(-row.away);
          expect(row.awayPlotted).toBeLessThan(0);
        } else {
          // POSITIVE zero, asserted with Object.is semantics: a bare `-away`
          // yields -0, which formats as "-0" the moment it reaches a formatter.
          expect(row.awayPlotted).toBe(0);
          expect(Object.is(row.awayPlotted, -0)).toBe(false);
        }
      }
    }
  });

  it("leaves the raw home/away non-negative on every row of both fixtures", () => {
    for (const rows of [rows001, rows074]) {
      for (const row of rows) {
        expect(row.home).toBeGreaterThanOrEqual(0);
        expect(row.away).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("goalMarkers — from metadata.goals, never the series (decision 7)", () => {
  it("m001: exactly 2 markers, both exact grid hits, at the pinned indices", () => {
    const markers = goalMarkers(m001.metadata.goals, rows001);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      index: 7,
      teamId: "mexico",
      scorerName: "Julian QUINONES",
      ownGoal: false,
      penalty: false,
      exact: true,
    });
    expect(markers[0].at).toEqual({ minute: 8, stoppageMinute: null });
    expect(markers[1]).toMatchObject({
      index: 69,
      teamId: "mexico",
      scorerName: "Raul JIMENEZ",
      exact: true,
    });
    expect(markers[1].at).toEqual({ minute: 66, stoppageMinute: null });
  });

  it("m074: exactly 2 markers on a SHOOTOUT match — no conversion appears", () => {
    const markers = goalMarkers(m074.metadata.goals, rows074);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      index: 4,
      // The BENEFITING team, even though GOMEZ is a Paraguay player (AD-6).
      teamId: "germany",
      scorerName: "Gustavo GOMEZ",
      ownGoal: true,
      exact: true,
    });
    expect(markers[1]).toMatchObject({ index: 40, teamId: "paraguay", ownGoal: false, exact: true });
  });

  it("returns markers in chronological order — that order IS the tab order", () => {
    const markers = goalMarkers(m074.metadata.goals, rows074);
    expect(markers.map((marker) => marker.index)).toEqual([4, 40]);
    // Constructed: source order reversed, resolved order still chronological.
    const reversed = goalMarkers(
      [goal(stamp(66)), goal(stamp(8))] as unknown as GoalRecord[],
      rows001
    );
    expect(reversed.map((marker) => marker.at.minute)).toEqual([8, 66]);
  });

  it("returns [] for an empty goal list and for an empty row list", () => {
    expect(goalMarkers([], rows001)).toEqual([]);
    expect(goalMarkers(m001.metadata.goals, [])).toEqual([]);
  });
});

describe("goalMarkers — the three cases no fixture can give us (Task 4.4a)", () => {
  /*
   * No fixture has a goal in stoppage time and none has penalty: true, so real
   * data only ever exercises the composite key's `null` branch. Constructed
   * here or these branches ship unverified.
   */
  it("(a) an OFF-GRID stamp falls back to the nearest sample and is FLAGGED", () => {
    // m001 has no sample at minute 91 — the grid ends at 90+7 (index 100).
    const markers = goalMarkers([goal(stamp(91))] as unknown as GoalRecord[], rows001);
    expect(markers).toHaveLength(1);
    expect(markers[0].exact).toBe(false);
    expect(markers[0].index).toBe(100);
    // The marker keeps the GOAL's own stamp, not the row's.
    expect(markers[0].at).toEqual({ minute: 91, stoppageMinute: null });
  });

  it("(a2) a goal never silently disappears: every goal yields exactly one marker", () => {
    const offGrid = [goal(stamp(91)), goal(stamp(0)), goal(stamp(47, 9))];
    const markers = goalMarkers(offGrid as unknown as GoalRecord[], rows001);
    expect(markers).toHaveLength(3);
    expect(markers.every((marker) => marker.exact === false)).toBe(true);
    expect(markers.every((marker) => Number.isInteger(marker.index))).toBe(true);
  });

  it("(b) an exact STOPPAGE stamp resolves to that sample, NOT to the 45/null one", () => {
    const markers = goalMarkers([goal(stamp(45, 2))] as unknown as GoalRecord[], rows001);
    expect(markers).toHaveLength(1);
    expect(markers[0].exact).toBe(true);
    // Index 46 is 45+2; index 44 is 45/null. This is the ONLY test proving the
    // key is really composite rather than minute-only.
    expect(markers[0].index).toBe(46);
    expect(rows001[46].at).toEqual({ minute: 45, stoppageMinute: 2 });
    expect(rows001[44].at).toEqual({ minute: 45, stoppageMinute: null });
  });

  it("(b2) a bare minute-45 goal resolves to the REGULATION slot, not a stoppage one", () => {
    const markers = goalMarkers([goal(stamp(45))] as unknown as GoalRecord[], rows001);
    expect(markers[0].index).toBe(44);
    expect(markers[0].exact).toBe(true);
  });

  it("(c) penalty: true survives to the marker so the spoken qualifier can render", () => {
    const markers = goalMarkers(
      [goal(stamp(66), { penalty: true })] as unknown as GoalRecord[],
      rows001
    );
    expect(markers[0].penalty).toBe(true);
    expect(markers[0].ownGoal).toBe(false);
  });

  it("(d) two goals closer than MIN_HIT_PX resolve first-in-DOM-order = chronological (decision 26)", () => {
    /*
     * At <md, 138 samples land ~2.4px apart on a 326px chart, so two goals one
     * minute apart are ~2px apart and their >=44px hit boxes overlap heavily.
     * Decision 26 resolves that by DOM order, and DOM order is this array.
     */
    const markers = goalMarkers(
      [goal(stamp(9), { scorerName: "SECOND" }), goal(stamp(8), { scorerName: "FIRST" })] as unknown as GoalRecord[],
      rows001
    );
    expect(markers.map((marker) => marker.scorerName)).toEqual(["FIRST", "SECOND"]);
    expect(markers.map((marker) => marker.index)).toEqual([7, 8]);
    // Their x positions are ~2.4px apart at the <md width, far inside the floor.
    const chartPx = 326;
    const spacing = chartPx / (rows001.length - 1);
    expect(spacing * (markers[1].index - markers[0].index)).toBeLessThan(MIN_HIT_PX);
  });

  it("(e) two goals sharing one stamp keep the source order", () => {
    const markers = goalMarkers(
      [goal(stamp(8), { scorerName: "A" }), goal(stamp(8), { scorerName: "B" })] as unknown as GoalRecord[],
      rows001
    );
    expect(markers.map((marker) => marker.scorerName)).toEqual(["A", "B"]);
    expect(markers.map((marker) => marker.index)).toEqual([7, 7]);
  });
});

describe("momentumTableRows — raw values only (decisions 6, 14)", () => {
  it("emits one row per sample and NO negative number anywhere, both fixtures", () => {
    for (const [rows, bundle] of [
      [rows001, m001],
      [rows074, m074],
    ] as const) {
      const markers = goalMarkers(bundle.metadata.goals, rows);
      const tableRows = momentumTableRows(rows, markers);
      expect(tableRows).toHaveLength(rows.length);
      for (const row of tableRows) {
        expect(row.home).toBeGreaterThanOrEqual(0);
        expect(row.away).toBeGreaterThanOrEqual(0);
        expect(row.at.minute).toBeGreaterThanOrEqual(0);
        expect(Object.values(row).some((value) => typeof value === "number" && value < 0)).toBe(
          false
        );
      }
    }
  });

  it("never carries awayPlotted, and its away matches the RAW series value", () => {
    const tableRows = momentumTableRows(rows001, []);
    expect(tableRows[0]).not.toHaveProperty("awayPlotted");
    const series = seriesOf(m001);
    for (const row of tableRows) {
      expect(row.away).toBe(series.samples[row.key].away);
      expect(row.home).toBe(series.samples[row.key].home);
    }
  });

  it("carries the RAW stamp object, with no `?? 0` minute defaulting", () => {
    const tableRows = momentumTableRows(rows001, []);
    expect(tableRows[44].at).toEqual({ minute: 45, stoppageMinute: null });
    expect(tableRows[46].at).toEqual({ minute: 45, stoppageMinute: 2 });
    // Slot 0 is match minute 1, not 0 — do not assume a zero-indexed clock.
    expect(tableRows[0].at.minute).toBe(1);
  });

  it("flags exactly the sample indices a goal fell on", () => {
    const markers = goalMarkers(m001.metadata.goals, rows001);
    const tableRows = momentumTableRows(rows001, markers);
    expect(tableRows.filter((row) => row.hasGoal).map((row) => row.key)).toEqual([7, 69]);
  });
});

describe("momentumFigureCounts — counts from what is DRAWN (decision 15)", () => {
  it("counts samples and the markers actually resolved, never keyStatistics", () => {
    const markers001 = goalMarkers(m001.metadata.goals, rows001);
    expect(momentumFigureCounts(rows001, markers001)).toEqual({ samples: 101, goals: 2 });
    const markers074 = goalMarkers(m074.metadata.goals, rows074);
    expect(momentumFigureCounts(rows074, markers074)).toEqual({ samples: 138, goals: 2 });
  });

  it("reports 0 goals when the match has none drawn, regardless of keyStatistics", () => {
    expect(momentumFigureCounts(rows074, [])).toEqual({ samples: 138, goals: 0 });
  });
});

describe("momentumYTicks — symmetric, integer, always includes zero", () => {
  /*
   * The regression this exists for, measured LIVE on m074 before it was fixed:
   * recharts' own generator emitted +17, +1, -8, -17 for the [-17, 17] domain —
   * four ticks, unevenly spaced, NO zero tick, and once decision 6 strips the
   * sign they render as "17 1 8 17". These assertions fail if anyone drops the
   * explicit `ticks` prop and lets recharts choose again.
   */
  it("always contains 0 AND the peak, and is symmetric, across every corpus-plausible peak", () => {
    for (let peak = 1; peak <= 40; peak += 1) {
      const ticks = momentumYTicks(peak);
      expect(ticks).toContain(0);
      // `-t + 0` normalises the negative zero unary minus produces at t === 0.
      expect(ticks.map((t) => -t + 0).reverse()).toEqual(ticks);
      expect(ticks.every((t) => Number.isInteger(t))).toBe(true);
      expect(ticks.every((t) => Math.abs(t) <= peak)).toBe(true);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      // Strictly ascending, so no two labels can land on the same position.
      expect(ticks.slice(1).every((t, i) => t > ticks[i])).toBe(true);
      /*
       * THE PEAK IS ALWAYS LABELLED (ruled by code review, 2026-08-03). The
       * round steps alone left m074's peak of 17 unlabelled under a top tick of
       * 10 — the tallest label covered 59% of the domain, and with no axis line,
       * no tick line and no grid, the curve's maximum simply could not be read.
       * Gaps are deliberately NOT uniform any more; that is the trade.
       */
      expect(ticks).toContain(peak);
      expect(ticks).toContain(-peak);
    }
  });

  it("pins the two real fixture peaks as literals", () => {
    // m001, peak 10 — the round step already lands exactly on the peak.
    expect(momentumYTicks(momentumPeak(rows001))).toEqual([-10, -5, 0, 5, 10]);
    // m074, peak 17 — the peak is APPENDED beyond the round tick it clears.
    expect(momentumYTicks(momentumPeak(rows074))).toEqual([-17, -10, 0, 10, 17]);
  });

  it("replaces the outer tick instead of crowding it when the peak is close", () => {
    // 11 sits one unit above the round tick 10; two labels a unit apart would
    // collide, so the peak REPLACES it rather than being appended.
    expect(momentumYTicks(11)).toEqual([-11, 0, 11]);
  });

  it("degrades sanely at the all-zeros floor", () => {
    expect(momentumYTicks(1)).toEqual([-1, 0, 1]);
    expect(momentumYTicks(0)).toEqual([-1, 0, 1]);
  });
});

describe("momentumTickIndices — labelled axis positions", () => {
  it("picks the FIRST row of each 15-minute regulation slot in m001", () => {
    const ticks = momentumTickIndices(rows001, 15);
    expect(ticks[0]).toBe(0);
    for (const index of ticks) {
      expect(rows001[index].at.stoppageMinute).toBeNull();
    }
    expect(ticks.map((index) => rows001[index].at.minute)).toEqual([1, 15, 30, 45, 60, 75, 90]);
    // Minute 45's tick is the REGULATION slot, not one of the four stoppage ones.
    expect(ticks).toContain(44);
  });

  it("covers extra time in m074 and stays strictly increasing", () => {
    const ticks = momentumTickIndices(rows074, 15);
    expect(ticks.map((index) => rows074[index].at.minute)).toEqual([
      1, 15, 30, 45, 60, 75, 90, 105, 120,
    ]);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it("thins out at a larger step, for the 200%-zoom / <md reduction", () => {
    expect(momentumTickIndices(rows001, 30).map((i) => rows001[i].at.minute)).toEqual([
      1, 30, 60, 90,
    ]);
    expect(momentumTickIndices(rows001, 0)).toEqual([]);
    expect(momentumTickIndices([], 15)).toEqual([]);
  });
});

describe("clampIndex / indexAtOffset — the slider's arithmetic", () => {
  it("clamps at both ends with NO wrap (decision 2)", () => {
    expect(clampIndex(-1, 101)).toBe(0);
    expect(clampIndex(0, 101)).toBe(0);
    expect(clampIndex(100, 101)).toBe(100);
    expect(clampIndex(101, 101)).toBe(100);
    expect(clampIndex(9999, 101)).toBe(100);
    // A stored index surviving a series that shrank underneath it.
    expect(clampIndex(137, 101)).toBe(100);
    expect(clampIndex(5, 0)).toBe(0);
  });

  it("maps a tap to the NEAREST sample and never escapes the range", () => {
    const length = 101;
    expect(indexAtOffset(40, 40, 400, length)).toBe(0);
    expect(indexAtOffset(440, 40, 400, length)).toBe(100);
    expect(indexAtOffset(240, 40, 400, length)).toBe(50);
    // Off the plot on both sides clamps rather than throwing or wrapping.
    expect(indexAtOffset(-500, 40, 400, length)).toBe(0);
    expect(indexAtOffset(5000, 40, 400, length)).toBe(100);
    expect(indexAtOffset(100, 40, 400, 1)).toBe(0);
  });

  it("returns null rather than 0 on a degenerate plot box", () => {
    /*
     * A display:none ancestor, a collapsed flex parent and a print stylesheet
     * all give width 0. Returning index 0 there silently reset the reader's
     * cursor to minute 1 on any tap; null is the no-op signal the caller needs.
     */
    expect(indexAtOffset(100, 40, 0, 101)).toBeNull();
    expect(indexAtOffset(100, 40, -20, 101)).toBeNull();
  });

  it("derives the plot box from the margin AND the y-axis width, not the margin alone", () => {
    /*
     * THE REGRESSION THIS PINS (code review, 2026-08-03). recharts computes
     * offset.left = margin.left + leftAxesOffset, and leftAxesOffset is the
     * y-axis's own width. The chart previously passed MARGIN.left alone as the
     * origin, which lands a left-edge tap a full axis width late — ~17 samples
     * on a 138-sample mobile chart — while staying exact at the right edge,
     * which is exactly why manual verification passed it. This test fails if
     * anyone reverts the origin to the bare margin.
     */
    expect(MOMENTUM_Y_AXIS_WIDTH).toBeGreaterThan(0);
    const box = momentumPlotBox(600);
    expect(box.left).toBe(MOMENTUM_MARGIN.left + MOMENTUM_Y_AXIS_WIDTH);
    expect(box.left).not.toBe(MOMENTUM_MARGIN.left);
    expect(box.width).toBe(600 - box.left - MOMENTUM_MARGIN.right);

    // End to end: a tap at the true plot origin is sample 0, not sample 6.
    expect(indexAtOffset(box.left, box.left, box.width, 101)).toBe(0);
    expect(indexAtOffset(box.left + box.width, box.left, box.width, 101)).toBe(100);

    // A degenerate container yields a non-positive width, hence the null no-op.
    expect(momentumPlotBox(20).width).toBeLessThanOrEqual(0);
  });
});

describe("goalMarkerHitHalfWidths — decision 26 without a paint-order fight", () => {
  const marker = (index: number) => ({
    index,
    teamId: "mexico",
    scorerName: "X",
    ownGoal: false,
    penalty: false,
    at: { minute: index + 1, stoppageMinute: null },
    exact: true,
  });

  it("gives well-separated markers the full 44px target", () => {
    const halves = goalMarkerHitHalfWidths([marker(7), marker(69)], 100, 1000);
    expect(halves).toEqual([MIN_HIT_PX / 2, MIN_HIT_PX / 2]);
  });

  it("caps both markers at half the gap when they would overlap", () => {
    /*
     * The reachable case: at <md a 138-sample chart is ~2.4px per sample, so any
     * two goals within ~9 minutes collide. Decision 26 ruled the earlier marker
     * wins; SVG hit-testing gives it to whichever paints LAST, and DOM order
     * cannot be reversed without also reversing the decision-20 tab order.
     * Removing the overlap satisfies both: the nearer goal always wins.
     */
    const plotWidth = 300;
    const lastIndex = 137;
    const halves = goalMarkerHitHalfWidths([marker(40), marker(44)], lastIndex, plotWidth);
    const gapPx = 4 * (plotWidth / lastIndex);
    expect(halves[0]).toBeCloseTo(gapPx / 2, 10);
    expect(halves[1]).toBeCloseTo(gapPx / 2, 10);
    // The boxes now abut rather than overlap.
    expect(halves[0] + halves[1]).toBeCloseTo(gapPx, 10);
    expect(halves[0]).toBeLessThan(MIN_HIT_PX / 2);
  });

  it("degrades safely on empty input and a degenerate box", () => {
    expect(goalMarkerHitHalfWidths([], 100, 500)).toEqual([]);
    expect(goalMarkerHitHalfWidths([marker(0)], 0, 500)).toEqual([MIN_HIT_PX / 2]);
    expect(goalMarkerHitHalfWidths([marker(0)], 100, 0)).toEqual([MIN_HIT_PX / 2]);
  });
});

describe("encoding constants (Task 3.7)", () => {
  it("pins the ruled fill opacity and reuses MIN_HIT_PX rather than re-declaring it", () => {
    expect(MOMENTUM_FILL_OPACITY).toBe(0.6);
    expect(MIN_HIT_PX).toBe(44);
    // The marker's own visible radius is far below the hit floor — hence the
    // invisible >=44x44 hit rect decision 19 requires.
    expect(GOAL_MARKER_RADIUS_PX * 2).toBeLessThan(MIN_HIT_PX);
  });
});

describe("m002 — the deliberate synthetic absence", () => {
  it("carries momentum: null, which is the ONLY absence state (decision 8)", () => {
    expect(m002.momentum).toBeNull();
    /*
     * This branch never fires on real corpus data — all 104 reports carry a
     * band, and m002's null is a deliberate synthetic edge case that must never
     * be regenerated. Do NOT conclude from a clean run that it is dead code.
     */
  });

  it("still carries goals, which the momentum panel must NOT render (there is no grid)", () => {
    expect(m002.metadata.goals).toHaveLength(3);
    expect(goalMarkers(m002.metadata.goals, [])).toEqual([]);
  });
});

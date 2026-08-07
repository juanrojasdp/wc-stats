import { describe, expect, it } from "vitest";

import { seriesLabelIndex } from "@/components/TacticalCharts";

/*
 * `seriesLabelIndex` — the direct-series-label anchor (Story 2.17, ruled D9).
 *
 * THE LEDGER'S OWNERSHIP CONDITION FIRED HERE: the owner line was "the first
 * successor story to reuse `DistributionChart`", and `type=matches` renders a
 * two-series home/away distribution. 2.13, 2.15 and 2.16 all declined it.
 *
 * There was no co-located test for this file before this one. The defect it
 * pins is silent by construction — an all-equal series returned 0 for BOTH
 * series, so both team codes anchored at the axis origin and overlapped. With
 * `<Legend>` banned by decision 10(a), those two direct labels are the ONLY
 * thing telling the series apart, so the primary UX-DR11 channel failed with no
 * error anywhere.
 */

describe("seriesLabelIndex", () => {
  it("anchors at the largest value", () => {
    expect(seriesLabelIndex([1, 7, 3])).toBe(1);
    expect(seriesLabelIndex([2, 4, 9])).toBe(2);
  });

  /*
   * A peak at index 0 is ORDINARY and keeps its label. This is the case D9's
   * literal wording ("return -1 when no value beats the first") would have
   * suppressed — nothing beats 10 here either, but the series is not flat and
   * the label belongs at the peak.
   */
  it("keeps the label when the peak is the first value", () => {
    expect(seriesLabelIndex([10, 3, 2])).toBe(0);
  });

  it("takes the FIRST maximum when the peak is tied", () => {
    expect(seriesLabelIndex([1, 9, 9])).toBe(1);
  });

  /*
   * 🔴 THE DEFECT. Both series return -1, so `SeriesEndLabel`'s
   * `index !== labelIndex` guard suppresses both rather than stacking two codes
   * on top of each other at the origin.
   */
  it("returns the -1 sentinel for an all-equal series", () => {
    expect(seriesLabelIndex([4, 4, 4])).toBe(-1);
    expect(seriesLabelIndex([0.5, 0.5])).toBe(-1);
  });

  /* The all-zero case, which is the one that actually occurs in the data. */
  it("returns the -1 sentinel for an all-zero series", () => {
    expect(seriesLabelIndex([0, 0, 0, 0])).toBe(-1);
  });

  it("returns the sentinel for an empty series", () => {
    expect(seriesLabelIndex([])).toBe(-1);
  });

  /*
   * A single-point series is flat by definition: there is no second bar for its
   * code to be distinguished FROM, so labelling it asserts a peak it does not
   * have.
   */
  it("returns the sentinel for a single-point series", () => {
    expect(seriesLabelIndex([7])).toBe(-1);
  });

  /*
   * NO BAR INDEX CAN EQUAL -1, which is why `SeriesEndLabel:212-214` needed no
   * change to honour the sentinel. Stated as an executable claim rather than a
   * comment so it cannot rot.
   */
  it("returns a value outside every valid bar index when it suppresses", () => {
    const flat = [3, 3, 3];
    const index = seriesLabelIndex(flat);
    expect(index).toBe(-1);
    expect(flat.some((_value, position) => position === index)).toBe(false);
  });
});

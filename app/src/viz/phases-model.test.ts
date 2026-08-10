import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle } from "@/lib/contract/contract-types";
import {
  AXIS_LABEL_MAX_CHARS,
  AXIS_LABEL_MAX_LINES,
  BLOCK_LEVELS,
  IN_POSSESSION_PHASES,
  IN_POSSESSION_PROPERTY,
  OUT_OF_POSSESSION_PHASES,
  OUT_OF_POSSESSION_PROPERTY,
  PRESS_PHASES,
  blockLevelKey,
  blockRows,
  distributionChartHeightClass,
  inPossessionPhaseKey,
  outOfPossessionPhaseKey,
  percentAxisMax,
  percentTicks,
  phaseRows,
  pressRows,
  rowsPeak,
  seriesLabelIndex,
  wrapAxisLabel,
} from "@/viz/phases-model";

/*
 * Task 2.7. Fixtures are read with node:fs (src/viz is inside the
 * client-import seam, which bars @/lib/build-data), the way shot-map-model's
 * suite does.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

const FIXTURES: { slug: string; bundle: MatchBundle }[] = [
  { slug: "m001", bundle: m001 },
  { slug: "m002", bundle: m002 },
  { slug: "m074", bundle: m074 },
];

function sumIn(bundle: MatchBundle, side: "home" | "away"): number {
  const phases = bundle.tacticalIdentity[side].phasesInPossession;
  return IN_POSSESSION_PHASES.reduce(
    (total, code) => total + phases[IN_POSSESSION_PROPERTY[code]],
    0
  );
}

function sumOut(bundle: MatchBundle, side: "home" | "away"): number {
  const phases = bundle.tacticalIdentity[side].phasesOutOfPossession;
  return OUT_OF_POSSESSION_PHASES.reduce(
    (total, code) => total + phases[OUT_OF_POSSESSION_PROPERTY[code]],
    0
  );
}

/* ------------------------------------------------------------------------- */

describe("the phases are NOT a partition (Task 2.1)", () => {
  /*
   * THIS IS THE ASSERTION THAT MAKES "NEVER NORMALIZE" MECHANICAL rather than a
   * comment somebody later deletes. Corpus, 208 team-innings: in-possession
   * sums run 84-149 (median 107) and equal 100 on FIVE; out-of-possession
   * 73-97 (median 87.5) and equal 100 on ZERO. The fixtures are in the same
   * shape, so a renderer that stacked or normalized these would be visibly
   * wrong on the data sitting in the repo — but only if somebody looked. This
   * looks.
   */
  it("no fixture team-inning's eight in-possession rates sum to 100", () => {
    for (const { slug, bundle } of FIXTURES) {
      for (const side of ["home", "away"] as const) {
        expect(sumIn(bundle, side), `${slug} ${side}`).not.toBeCloseTo(100, 6);
      }
    }
  });

  it("no fixture team-inning's nine out-of-possession rates sum to 100", () => {
    for (const { slug, bundle } of FIXTURES) {
      for (const side of ["home", "away"] as const) {
        expect(sumOut(bundle, side), `${slug} ${side}`).not.toBeCloseTo(100, 6);
      }
    }
  });

  /** The six fixture sums, pinned as literals so a fixture edit is a red test. */
  it("pins the six fixture in-possession sums", () => {
    expect(sumIn(m001, "home")).toBeCloseTo(106, 6);
    expect(sumIn(m001, "away")).toBeCloseTo(102, 6);
    expect(sumIn(m002, "home")).toBeCloseTo(108, 6);
    expect(sumIn(m002, "away")).toBeCloseTo(106, 6);
    expect(sumIn(m074, "home")).toBeCloseTo(124, 6);
    expect(sumIn(m074, "away")).toBeCloseTo(98, 6);
  });

  it("pins the six fixture out-of-possession sums", () => {
    expect(sumOut(m001, "home")).toBeCloseTo(80, 6);
    expect(sumOut(m001, "away")).toBeCloseTo(78, 6);
    expect(sumOut(m002, "home")).toBeCloseTo(79, 6);
    expect(sumOut(m002, "away")).toBeCloseTo(83, 6);
    expect(sumOut(m074, "home")).toBeCloseTo(80, 6);
    expect(sumOut(m074, "away")).toBeCloseTo(89, 6);
  });

  it("the three block heights are not a partition either", () => {
    for (const { slug, bundle } of FIXTURES) {
      for (const side of ["home", "away"] as const) {
        const blocks = bundle.tacticalIdentity[side].defensiveBlockDistribution;
        const total = blocks.high + blocks.mid + blocks.low;
        expect(total, `${slug} ${side}`).not.toBeCloseTo(100, 6);
      }
    }
  });
});

describe("frozen enum lists (Task 2.2)", () => {
  it("carries all eight in-possession codes in declaration order", () => {
    expect(IN_POSSESSION_PHASES).toEqual([
      "build-up-unopposed",
      "build-up-opposed",
      "progression",
      "final-third",
      "long-ball",
      "attacking-transition",
      "counter-attack",
      "set-piece",
    ]);
  });

  it("carries all nine out-of-possession codes in declaration order", () => {
    expect(OUT_OF_POSSESSION_PHASES).toEqual([
      "high-press",
      "mid-press",
      "low-press",
      "high-block",
      "mid-block",
      "low-block",
      "recovery",
      "defensive-transition",
      "counter-press",
    ]);
  });

  it("carries the three block levels high -> mid -> low", () => {
    expect(BLOCK_LEVELS).toEqual(["high", "mid", "low"]);
  });

  /*
   * The press subset is FOUR of the nine, and every member must still be a
   * member of the nine — the drift this guards is somebody adding a fifth
   * "press-like" code that the locale exhaustiveness suite would then never see.
   */
  it("the press subset is four codes, all drawn from the nine", () => {
    expect(PRESS_PHASES).toEqual(["high-press", "mid-press", "low-press", "counter-press"]);
    for (const code of PRESS_PHASES) {
      expect(OUT_OF_POSSESSION_PHASES).toContain(code);
    }
  });

  it("every property map member names a real counts property", () => {
    for (const { bundle } of FIXTURES) {
      const inPhases = bundle.tacticalIdentity.home.phasesInPossession;
      for (const code of IN_POSSESSION_PHASES) {
        expect(typeof inPhases[IN_POSSESSION_PROPERTY[code]]).toBe("number");
      }
      const outPhases = bundle.tacticalIdentity.home.phasesOutOfPossession;
      for (const code of OUT_OF_POSSESSION_PHASES) {
        expect(typeof outPhases[OUT_OF_POSSESSION_PROPERTY[code]]).toBe("number");
      }
    }
  });

  it("builds enum-code dictionary keys", () => {
    expect(inPossessionPhaseKey("build-up-unopposed")).toBe(
      "enums.inPossessionPhase.build-up-unopposed"
    );
    expect(outOfPossessionPhaseKey("counter-press")).toBe(
      "enums.outOfPossessionPhase.counter-press"
    );
    expect(blockLevelKey("mid")).toBe("enums.blockLevel.mid");
  });
});

describe("phaseRows (Task 2.3)", () => {
  it("returns eight in-possession and nine out-of-possession rows per fixture", () => {
    for (const { slug, bundle } of FIXTURES) {
      const sets = phaseRows(bundle.tacticalIdentity);
      expect(sets.inPossession, slug).toHaveLength(8);
      expect(sets.outOfPossession, slug).toHaveLength(9);
      expect(sets.inPossession.map((row) => row.code)).toEqual([...IN_POSSESSION_PHASES]);
      expect(sets.outOfPossession.map((row) => row.code)).toEqual([...OUT_OF_POSSESSION_PHASES]);
    }
  });

  it("reads raw percentage points straight from the contract fields", () => {
    const sets = phaseRows(m001.tacticalIdentity);
    const longBall = sets.inPossession.find((row) => row.code === "long-ball");
    expect(longBall?.home).toBe(m001.tacticalIdentity.home.phasesInPossession.longBall);
    expect(longBall?.away).toBe(m001.tacticalIdentity.away.phasesInPossession.longBall);
    const midBlock = sets.outOfPossession.find((row) => row.code === "mid-block");
    expect(midBlock?.home).toBe(m001.tacticalIdentity.home.phasesOutOfPossession.midBlock);
  });

  it("the two families concatenate to 17 rows in frozen order with unique keys", () => {
    /*
     * Asserted against `phaseRows` directly, which is what BOTH sections
     * actually consume. The `phaseTableRows` convenience this test used to call
     * was removed by the 2.10 code review as a dead export — it had no call site
     * outside this file, and asserting on it proved only that the test could
     * reach it.
     */
    const sets = phaseRows(m074.tacticalIdentity);
    const rows = [...sets.inPossession, ...sets.outOfPossession];
    expect(rows).toHaveLength(17);
    expect(rows[0].code).toBe("build-up-unopposed");
    expect(rows[16].code).toBe("counter-press");
    // Keys are unique — the two families share no code, but the prefixes make
    // that structural rather than incidental.
    expect(new Set(rows.map((row) => row.key)).size).toBe(17);
  });
});

describe("pressRows and blockRows (Task 2.4)", () => {
  it("pressRows returns the four press rates, verbatim from the same fields", () => {
    for (const { slug, bundle } of FIXTURES) {
      const rows = pressRows(bundle.tacticalIdentity);
      expect(rows, slug).toHaveLength(4);
      expect(rows.map((row) => row.code)).toEqual([
        "high-press",
        "mid-press",
        "low-press",
        "counter-press",
      ]);
      const out = bundle.tacticalIdentity.home.phasesOutOfPossession;
      expect(rows[0].home).toBe(out.highPress);
      expect(rows[3].home).toBe(out.counterPress);
    }
  });

  /*
   * RULED DECISION 4'S DUPLICATION, pinned as a test so a later reader does not
   * "fix" it: seven of the nine out-of-possession rates appear in BOTH #phases
   * and #pressing (the four press rates here, the three block heights via
   * defensiveBlockDistribution). The values are IDENTICAL objects' fields read
   * twice, never recomputed.
   */
  it("the press rates #pressing renders are the same numbers #phases renders", () => {
    for (const { slug, bundle } of FIXTURES) {
      const all = phaseRows(bundle.tacticalIdentity).outOfPossession;
      for (const pressRow of pressRows(bundle.tacticalIdentity)) {
        const phaseRow = all.find((row) => row.code === pressRow.code);
        expect(phaseRow?.home, `${slug} ${pressRow.code}`).toBe(pressRow.home);
        expect(phaseRow?.away, `${slug} ${pressRow.code}`).toBe(pressRow.away);
      }
    }
  });

  it("blockRows returns the three block heights, high -> mid -> low", () => {
    for (const { slug, bundle } of FIXTURES) {
      const rows = blockRows(bundle.tacticalIdentity);
      expect(rows, slug).toHaveLength(3);
      expect(rows.map((row) => row.code)).toEqual(["high", "mid", "low"]);
      const blocks = bundle.tacticalIdentity.away.defensiveBlockDistribution;
      expect(rows[0].away).toBe(blocks.high);
      expect(rows[1].away).toBe(blocks.mid);
      expect(rows[2].away).toBe(blocks.low);
    }
  });

  it("pins m074's block heights, the widest fixture spread", () => {
    const rows = blockRows(m074.tacticalIdentity);
    expect(rows.map((row) => row.home)).toEqual([2, 4, 9]);
    expect(rows.map((row) => row.away)).toEqual([1, 16, 50]);
  });
});

/*
 * The `metreRows` suite was RETIRED with the model it covered, by change-set CS-2
 * (contract logged decision 18). It pinned the four `lineHeight`/`teamLength` values and
 * asserted m001 home in-possession was 44.4 "so the number a reader sees on screen is
 * traceable to the gap filed to Story 1.16" - that gap is now closed, and the 44.4 is
 * gone with it. `tacticalIdentity.shapeByPhase` carries the 18 real values; re-presenting
 * them is filed to 2.19 with the six panel labels it needs.
 */
describe("percentTicks and percentAxisMax (Task 2.6, ruled decision 9)", () => {
  /*
   * PROPERTY TEST over 1-160. The corpus in-possession SUM reaches 149, so a
   * 0-100 assumption is corpus-false; the range is deliberately wider than any
   * single rate to cover a future aggregate consumer too.
   */
  it("always includes zero, over every input 1-160", () => {
    for (let max = 1; max <= 160; max += 1) {
      expect(percentTicks(max)[0], `max=${max}`).toBe(0);
    }
  });

  it("always ends at the axis max, which is >= the input", () => {
    for (let max = 1; max <= 160; max += 1) {
      const ticks = percentTicks(max);
      const axisMax = percentAxisMax(max);
      expect(ticks[ticks.length - 1], `max=${max}`).toBe(axisMax);
      expect(axisMax, `max=${max}`).toBeGreaterThanOrEqual(max);
    }
  });

  it("is strictly ascending with a uniform integer step", () => {
    for (let max = 1; max <= 160; max += 1) {
      const ticks = percentTicks(max);
      const step = ticks[1] - ticks[0];
      expect(Number.isInteger(step), `max=${max}`).toBe(true);
      expect(step, `max=${max}`).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < ticks.length; i += 1) {
        expect(ticks[i] - ticks[i - 1], `max=${max} at ${i}`).toBe(step);
      }
    }
  });

  it("keeps the tick count readable at every input 1-160", () => {
    for (let max = 1; max <= 160; max += 1) {
      const ticks = percentTicks(max);
      expect(ticks.length, `max=${max}`).toBeGreaterThanOrEqual(2);
      expect(ticks.length, `max=${max}`).toBeLessThanOrEqual(7);
    }
  });

  it("never produces a degenerate domain, even at 0 or a non-finite input", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const axisMax = percentAxisMax(bad);
      expect(axisMax, `input=${bad}`).toBeGreaterThan(0);
      expect(percentTicks(bad)[0], `input=${bad}`).toBe(0);
    }
  });

  it("pins the shape at the fixture peaks", () => {
    // m074 away low-block is 50 — the tallest single block value in the set.
    expect(percentTicks(50)).toEqual([0, 20, 40, 60]);
    expect(percentTicks(30)).toEqual([0, 10, 20, 30]);
    expect(percentTicks(7)).toEqual([0, 2, 4, 6, 8]);
  });

  it("rowsPeak reports the largest value across both teams", () => {
    expect(rowsPeak(blockRows(m074.tacticalIdentity))).toBe(50);
    expect(rowsPeak([])).toBe(0);
  });
});

describe("wrapAxisLabel", () => {
  /*
   * The category axis carries 17 Spanish phase names at a hard 11 px type floor
   * on a 320 px viewport, and recharts renders axis ticks as a single <text>
   * with no wrapping and no truncation. This is the function that stops the
   * longest label running off the SVG.
   */
  it("keeps a short label on one line", () => {
    expect(wrapAxisLabel("Progresión", AXIS_LABEL_MAX_CHARS, AXIS_LABEL_MAX_LINES)).toEqual([
      "Progresión",
    ]);
  });

  it("wraps the longest Spanish label in the story onto two lines", () => {
    const lines = wrapAxisLabel(
      "Salida de balón sin presión",
      AXIS_LABEL_MAX_CHARS,
      AXIS_LABEL_MAX_LINES
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(AXIS_LABEL_MAX_CHARS);
    }
    expect(lines.join(" ")).toContain("Salida de balón");
  });

  it("never exceeds the line budget for any label this story ships", () => {
    const labels = [
      "Salida de balón sin presión",
      "Salida de balón con presión",
      "Transición ofensiva",
      "Transición defensiva",
      "Contrapresión",
      "Bloque medio",
      "Presión alta",
      "Último tercio",
      "Balón largo",
      "Contraataque",
      "Balón parado",
      "Repliegue",
      "Build-up unopposed",
      "Attacking transition",
    ];
    for (const label of labels) {
      const lines = wrapAxisLabel(label, AXIS_LABEL_MAX_CHARS, AXIS_LABEL_MAX_LINES);
      expect(lines.length, label).toBeGreaterThanOrEqual(1);
      expect(lines.length, label).toBeLessThanOrEqual(AXIS_LABEL_MAX_LINES);
      for (const line of lines) {
        expect(line.length, `${label} / ${line}`).toBeLessThanOrEqual(AXIS_LABEL_MAX_CHARS);
      }
    }
  });

  it("marks a label it had to cut, rather than truncating silently", () => {
    const lines = wrapAxisLabel("uno dos tres cuatro cinco seis siete", 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[lines.length - 1].endsWith("…")).toBe(true);
  });

  it("hard-cuts a single word longer than the line", () => {
    const lines = wrapAxisLabel("Supercalifragilisticoexpialidoso", 10, 2);
    expect(lines[0].endsWith("…")).toBe(true);
    expect(lines[0].length).toBeLessThanOrEqual(10);
  });

  it("survives degenerate inputs", () => {
    expect(wrapAxisLabel("", 16, 2)).toEqual([]);
    expect(wrapAxisLabel("   ", 16, 2)).toEqual([]);
    expect(wrapAxisLabel("Progresión", 0, 2)).toEqual([]);
    expect(wrapAxisLabel("Progresión", 16, 0)).toEqual([]);
  });
});

describe("distributionChartHeightClass (ruled decision 12)", () => {
  /*
   * Every returned class must be a COMPLETE, STATICALLY-WRITTEN Tailwind class.
   * An interpolated one (`h-[${n}px]`) is never generated by Tailwind v4's
   * source scanner and fails silently at zero height, taking the whole chart
   * with it — a height-less ResponsiveContainer parent renders nothing at all.
   */
  it("returns a distinct literal class for each consumed category count", () => {
    const classes = ([3, 4, 8, 9] as const).map(distributionChartHeightClass);
    expect(new Set(classes).size).toBe(4);
    for (const value of classes) {
      expect(value).toMatch(/^h-\[\d+px\] md:h-\[\d+px\]$/);
    }
  });

  it("grows monotonically with the category count", () => {
    const heights = ([3, 4, 8, 9] as const).map((count) => {
      const match = /^h-\[(\d+)px\]/.exec(distributionChartHeightClass(count));
      return Number(match?.[1]);
    });
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });
});

/*
 * `seriesLabelIndex` — the direct-series-label anchor (Story 2.17, ruled D9).
 *
 * THE LEDGER'S OWNERSHIP CONDITION FIRED HERE: the owner line was "the first
 * successor story to reuse `DistributionChart`", and `type=matches` renders a
 * two-series home/away distribution. 2.13, 2.15 and 2.16 all declined it.
 *
 * The defect it pins is silent by construction — an all-equal series returned 0
 * for BOTH series, so both team codes anchored at the axis origin and
 * overlapped. With `<Legend>` banned by decision 10(a), those two direct labels
 * are the ONLY thing telling the series apart, so the primary UX-DR11 channel
 * failed with no error anywhere.
 *
 * MOVED HERE FROM `TacticalCharts.test.ts` by the code review of 2026-08-07,
 * with the function itself: a value import from one recharts leaf into another
 * breaks the Recharts Contract, and the pure layer is the only one this
 * node-env harness can test at all.
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
   * NO BAR INDEX CAN EQUAL -1, which is why `SeriesEndLabel`'s existing guard
   * needed no change to honour the sentinel. Stated as an executable claim
   * rather than a comment so it cannot rot.
   */
  it("returns a value outside every valid bar index when it suppresses", () => {
    const flat = [3, 3, 3];
    const index = seriesLabelIndex(flat);
    expect(index).toBe(-1);
    expect(flat.some((_value, position) => position === index)).toBe(false);
  });
});

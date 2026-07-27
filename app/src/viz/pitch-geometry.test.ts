import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle } from "@/lib/contract/contract-types";
import {
  PITCH_LENGTH_M,
  PITCH_WIDTH_M,
  panelSize,
  pitchExtentFor,
  pitchMarkings,
  project,
  type PitchExtent,
  type Size,
} from "@/viz/pitch-geometry";

/*
 * Task 2.8. This is the load-bearing suite of the whole story: AR-6 says the
 * App may apply affine viewport transforms and NOTHING else, and a transposed
 * or mirrored frame renders a perfectly plausible map that passes every test
 * which only checks "a number came out". So the assertions here are literals
 * and edge identities, never a re-derivation of the formula under test (the
 * 2.4 review lesson).
 *
 * Fixtures are read with node:fs rather than through @/lib/build-data: src/viz
 * is inside the client-import seam as of Task 1.3, and laundering the build-time
 * fs reader in through a test file would make that seam decorative.
 */

const FIXTURE_SLUGS = [
  "m001-mexico-south-africa",
  "m002-korea-republic-czechia",
  "m074-germany-paraguay",
] as const;

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const BUNDLES = FIXTURE_SLUGS.map(readFixture);

const HALF: PitchExtent = { xMin: 50 };
const FULL: PitchExtent = { xMin: 0 };

/*
 * A deliberately round synthetic size: pad 12 on every side leaves an inner box
 * of exactly 200 x 100 px, so every expected value below is a whole number that
 * can be checked by hand against the derivation in the module docblock.
 */
const PAD = 12;
const SYNTHETIC: Size = { width: 224, height: 124 };

describe("pitch constants", () => {
  it("carries the FIFA pitch in metres, because the 0-100 frame is non-uniform", () => {
    expect(PITCH_LENGTH_M).toBe(105);
    expect(PITCH_WIDTH_M).toBe(68);
  });
});

describe("pitchExtentFor (ruled decision 3)", () => {
  it("returns the half pitch when every point is in the attacking half", () => {
    expect(pitchExtentFor([{ x: 50 }, { x: 70.34 }, { x: 98.71 }])).toEqual({ xMin: 50 });
  });

  it("widens to the full pitch as soon as ONE point sits behind halfway", () => {
    // The long-range attempt AR-6 forbids clipping, clamping or dropping.
    expect(pitchExtentFor([{ x: 98.71 }, { x: 49.99 }, { x: 70.34 }])).toEqual({ xMin: 0 });
    expect(pitchExtentFor([{ x: 0 }])).toEqual({ xMin: 0 });
  });

  it("treats a side with no events as a half pitch", () => {
    // markers.length === 0 still draws a pitch (Task 6.11); the half pitch is
    // the default frame and there is no data to widen it.
    expect(pitchExtentFor([])).toEqual({ xMin: 50 });
  });

  it("returns the half pitch for every shot and cross in all three fixtures", () => {
    for (const bundle of BUNDLES) {
      const shots = bundle.events.shots ?? [];
      const crosses = bundle.events.crosses ?? [];
      expect(shots.length, bundle.matchId).toBeGreaterThan(0);
      expect(crosses.length, bundle.matchId).toBeGreaterThan(0);
      expect(pitchExtentFor(shots), bundle.matchId).toEqual({ xMin: 50 });
      expect(pitchExtentFor(crosses), bundle.matchId).toEqual({ xMin: 50 });
      expect(pitchExtentFor([...shots, ...crosses]), bundle.matchId).toEqual({ xMin: 50 });
    }
  });

  it("does not mutate its input", () => {
    const points = [{ x: 70 }, { x: 80 }];
    const snapshot = JSON.stringify(points);
    pitchExtentFor(points);
    expect(JSON.stringify(points)).toBe(snapshot);
  });
});

describe("panelSize", () => {
  it("takes the horizontal half pitch's aspect from METRES, not from the 0-100 numbers", () => {
    const size = panelSize("horizontal", HALF, 246);
    expect(size.width).toBe(246);
    // 68 m across vs 52.5 m deep — the mockup's 318/246 ratio.
    expect(size.height / size.width).toBeCloseTo(68 / 52.5, 10);
  });

  it("transposes the aspect for the vertical half pitch", () => {
    const size = panelSize("vertical", HALF, 246);
    expect(size.height / size.width).toBeCloseTo(52.5 / 68, 10);
  });

  it("uses the whole pitch length once the extent widens", () => {
    expect(panelSize("horizontal", FULL, 246).height / 246).toBeCloseTo(68 / 105, 10);
    expect(panelSize("vertical", FULL, 246).height / 246).toBeCloseTo(105 / 68, 10);
  });
});

describe("project — horizontal (attack left to right)", () => {
  const p = project("horizontal", HALF, SYNTHETIC, PAD);

  it("puts the ATTACKED GOAL at the right edge", () => {
    expect(p(100, 50).cx).toBe(SYNTHETIC.width - PAD);
  });

  it("puts the halfway boundary at the left edge", () => {
    expect(p(50, 50).cx).toBe(PAD);
  });

  it("puts the attacker's left (y=0) at the TOP edge", () => {
    // AD-6 puts y=0 on the attacker's left. A player attacking up the page has
    // their left hand toward page-left; rotating that 90 degrees clockwise into
    // this layout sends page-left to the top, so cy grows with y.
    expect(p(75, 0).cy).toBe(PAD);
    expect(p(75, 100).cy).toBe(SYNTHETIC.height - PAD);
  });

  it("maps a hand-computed point to its literal pixel position", () => {
    // inner box 200 x 100 at offset 12: cx = 12 + (75-50)/50*200 = 112,
    //                                   cy = 12 + 40/100*100      = 52.
    expect(p(75, 40)).toEqual({ cx: 112, cy: 52 });
  });

  it("reaches the goal line from x=0 once the extent is the full pitch", () => {
    const full = project("horizontal", FULL, SYNTHETIC, PAD);
    expect(full(0, 50).cx).toBe(PAD);
    expect(full(50, 50).cx).toBe(PAD + 100);
    expect(full(100, 50).cx).toBe(SYNTHETIC.width - PAD);
  });
});

describe("project — vertical (attacking goal UP, the source PDF's own frame)", () => {
  const p = project("vertical", HALF, SYNTHETIC, PAD);

  it("puts the ATTACKED GOAL at the top edge", () => {
    expect(p(100, 50).cy).toBe(PAD);
  });

  it("puts the halfway boundary at the bottom edge", () => {
    expect(p(50, 50).cy).toBe(SYNTHETIC.height - PAD);
  });

  it("puts the attacker's left (y=0) at the LEFT edge", () => {
    expect(p(75, 0).cx).toBe(PAD);
    expect(p(75, 100).cx).toBe(SYNTHETIC.width - PAD);
  });

  it("maps a hand-computed point to its literal pixel position", () => {
    // cx = 12 + 40/100*200 = 92, cy = 12 + (100-75)/50*100 = 62.
    expect(p(75, 40)).toEqual({ cx: 92, cy: 62 });
  });
});

describe("the map is affine and nothing else (AR-6)", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    it(`preserves collinearity and ratios — ${orientation}`, () => {
      const p = project(orientation, HALF, SYNTHETIC, PAD);
      const a = { x: 60, y: 10 };
      const c = { x: 90, y: 90 };
      // b sits one quarter of the way from a to c.
      const b = { x: a.x + 0.25 * (c.x - a.x), y: a.y + 0.25 * (c.y - a.y) };
      const [pa, pb, pc] = [p(a.x, a.y), p(b.x, b.y), p(c.x, c.y)];
      expect(pb.cx - pa.cx).toBeCloseTo(0.25 * (pc.cx - pa.cx), 10);
      expect(pb.cy - pa.cy).toBeCloseTo(0.25 * (pc.cy - pa.cy), 10);
    });

    it(`sends the midpoint of two points to the midpoint of their images — ${orientation}`, () => {
      const p = project(orientation, HALF, SYNTHETIC, PAD);
      const a = p(62, 18);
      const c = p(94, 76);
      const mid = p((62 + 94) / 2, (18 + 76) / 2);
      expect(mid.cx).toBeCloseTo((a.cx + c.cx) / 2, 10);
      expect(mid.cy).toBeCloseTo((a.cy + c.cy) / 2, 10);
    });
  }

  it("is pure: neither the extent nor the size object is mutated", () => {
    const extent: PitchExtent = { xMin: 50 };
    const size: Size = { width: 224, height: 124 };
    const before = JSON.stringify([extent, size]);
    const p = project("horizontal", extent, size, PAD);
    p(70, 30);
    p(90, 80);
    expect(JSON.stringify([extent, size])).toBe(before);
  });
});

describe("pitchMarkings", () => {
  const size = panelSize("horizontal", HALF, 246);
  const markings = pitchMarkings("horizontal", HALF, size, PAD);
  const p = project("horizontal", HALF, size, PAD);

  it("draws the boundary as the padded inner box", () => {
    expect(markings.boundary).toEqual({
      x: PAD,
      y: PAD,
      width: size.width - 2 * PAD,
      height: size.height - 2 * PAD,
    });
  });

  it("anchors the penalty area and six-yard box on the goal line", () => {
    const goalLineX = size.width - PAD;
    expect(markings.penaltyArea.x + markings.penaltyArea.width).toBeCloseTo(goalLineX, 6);
    expect(markings.sixYardBox.x + markings.sixYardBox.width).toBeCloseTo(goalLineX, 6);
    // 16.5 m of 52.5 m visible depth, and the six-yard box nests inside it.
    expect(markings.penaltyArea.width).toBeCloseTo((16.5 / 52.5) * (size.width - 2 * PAD), 6);
    expect(markings.sixYardBox.x).toBeGreaterThan(markings.penaltyArea.x);
    expect(markings.sixYardBox.height).toBeLessThan(markings.penaltyArea.height);
  });

  it("puts the penalty spot 11 m from the goal line, on the centre axis", () => {
    expect(markings.penaltySpot.cy).toBeCloseTo(p(90, 50).cy, 6);
    expect(markings.penaltySpot.cx).toBeCloseTo(p(100 - (11 / 105) * 100, 50).cx, 6);
  });

  it("hangs the goal OUTSIDE the goal line, in the panel's padding", () => {
    expect(markings.goal.x).toBeCloseTo(size.width - PAD, 6);
    expect(markings.goal.x + markings.goal.width).toBeLessThanOrEqual(size.width);
    // 7.32 m of the 68 m width.
    expect(markings.goal.height).toBeCloseTo((7.32 / 68) * (size.height - 2 * PAD), 6);
  });

  it("shades three mow bands on a half pitch and six on a full one", () => {
    expect(markings.stripes).toHaveLength(3);
    expect(pitchMarkings("horizontal", FULL, panelSize("horizontal", FULL, 246), PAD).stripes).toHaveLength(6);
  });

  it("omits the halfway line and centre circle on a half pitch, draws them on a full one", () => {
    expect(markings.halfwayLine).toBeNull();
    expect(markings.centreCircle).toBeNull();
    expect(markings.centreSpot).toBeNull();
    const full = pitchMarkings("horizontal", FULL, panelSize("horizontal", FULL, 246), PAD);
    expect(full.halfwayLine).not.toBeNull();
    expect(full.centreCircle).not.toBeNull();
    expect(full.centreSpot).not.toBeNull();
  });

  it("emits the penalty arc as a projected path that starts outside the penalty area", () => {
    expect(markings.penaltyArc.startsWith("M")).toBe(true);
    expect(markings.penaltyArc.length).toBeGreaterThan(20);
    // Every sampled point of the arc must sit at or left of the penalty-area
    // edge — the arc is the part of the 9.15 m circle OUTSIDE the box.
    const xs = markings.penaltyArc
      .slice(1)
      .split("L")
      .map((pair) => Number(pair.trim().split(",")[0]));
    for (const x of xs) {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeLessThanOrEqual(markings.penaltyArea.x + 0.001);
    }
  });

  it("transposes cleanly: the vertical penalty area hangs off the TOP edge", () => {
    const verticalSize = panelSize("vertical", HALF, 246);
    const vertical = pitchMarkings("vertical", HALF, verticalSize, PAD);
    expect(vertical.penaltyArea.y).toBeCloseTo(PAD, 6);
    expect(vertical.goal.y + vertical.goal.height).toBeCloseTo(PAD, 6);
    expect(vertical.goal.y).toBeGreaterThanOrEqual(0);
    // Width, not depth, now runs across the panel.
    expect(vertical.penaltyArea.width).toBeCloseTo((40.32 / 68) * (verticalSize.width - 2 * PAD), 6);
  });
});

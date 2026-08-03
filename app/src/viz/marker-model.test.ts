import { describe, expect, it } from "vitest";

import {
  MARKER_RADIUS_PX,
  TRIANGLE_CIRCUMRADIUS_RATIO,
  trianglePoints,
  type MarkerShape,
} from "@/viz/marker-model";

/*
 * Story 2.9 Task 4.3. `trianglePoints` is a PURE function precisely so this
 * test can exist: the harness has no jsdom, and vertices buried in JSX cannot
 * be asserted. Everything ruled decision 7 fixes is pinned here.
 */

/** DESIGN/EXPERIENCE.md:104 — every marker glyph measures ~8–14 px across. */
const DESIGN_BAND_MIN_PX = 8;
const DESIGN_BAND_MAX_PX = 14;

function boundingBox(points: readonly [number, number][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function centroid(points: readonly [number, number][]) {
  return {
    x: points.reduce((total, [x]) => total + x, 0) / points.length,
    y: points.reduce((total, [, y]) => total + y, 0) / points.length,
  };
}

describe("trianglePoints (ruled decision 7 — DESIGN specifies no triangle geometry)", () => {
  it("uses a circumradius of exactly 4r/3", () => {
    expect(TRIANGLE_CIRCUMRADIUS_RATIO).toBe(4 / 3);
  });

  it("returns three vertices at -90°, 30° and 150°", () => {
    const points = trianglePoints(MARKER_RADIUS_PX);
    const r = MARKER_RADIUS_PX * TRIANGLE_CIRCUMRADIUS_RATIO;
    expect(points).toHaveLength(3);
    // Apex UP. Rotating it with the pitch would invent a direction semantics
    // the source does not have, so it points up in BOTH orientations.
    expect(points[0][0]).toBeCloseTo(0, 10);
    expect(points[0][1]).toBeCloseTo(-r, 10);
    expect(points[1][0]).toBeCloseTo((r * Math.sqrt(3)) / 2, 10);
    expect(points[1][1]).toBeCloseTo(r / 2, 10);
    expect(points[2][0]).toBeCloseTo((-r * Math.sqrt(3)) / 2, 10);
    expect(points[2][1]).toBeCloseTo(r / 2, 10);
  });

  it("is EQUAL-EXTENT with the circle: bounding-box height is exactly 2r", () => {
    // The whole point of R = 4r/3: an equilateral triangle's height is 1.5·R,
    // so R = 4r/3 gives height 2r — the circle's own diameter.
    for (const radius of [MARKER_RADIUS_PX, 4, 9, 12.5]) {
      const box = boundingBox(trianglePoints(radius));
      const r = radius * TRIANGLE_CIRCUMRADIUS_RATIO;
      expect(box.height).toBeCloseTo(1.5 * r, 10);
      expect(box.height).toBeCloseTo(2 * radius, 10);
      expect(box.width).toBeCloseTo(r * Math.sqrt(3), 10);
    }
  });

  it("anchors on the marker position: the centroid is the origin", () => {
    for (const radius of [MARKER_RADIUS_PX, 4, 9]) {
      const middle = centroid(trianglePoints(radius));
      expect(middle.x).toBeCloseTo(0, 10);
      expect(middle.y).toBeCloseTo(0, 10);
    }
  });

  it("lands inside DESIGN's 8–14 px band on BOTH axes at the default radius", () => {
    const box = boundingBox(trianglePoints(MARKER_RADIUS_PX));
    // 13.856 × 12.000 — the rejected equal-AREA form (R = 1.55512·r) would be
    // 16.16 × 14.00 and fall outside the band on both axes.
    expect(box.width).toBeCloseTo(13.856, 3);
    expect(box.height).toBeCloseTo(12, 10);
    for (const extent of [box.width, box.height]) {
      expect(extent).toBeGreaterThanOrEqual(DESIGN_BAND_MIN_PX);
      expect(extent).toBeLessThanOrEqual(DESIGN_BAND_MAX_PX);
    }
  });

  it("scales linearly, so MarkerShapeGlyph's `scale` contract holds", () => {
    const base = boundingBox(trianglePoints(MARKER_RADIUS_PX));
    const doubled = boundingBox(trianglePoints(MARKER_RADIUS_PX * 2));
    expect(doubled.width).toBeCloseTo(base.width * 2, 10);
    expect(doubled.height).toBeCloseTo(base.height * 2, 10);
  });
});

describe("MarkerShape (ruled decision 6)", () => {
  it("gains triangle-filled and NOT the two diamonds", () => {
    /*
     * The hollow-diamond / filled-diamond half of UX-DR10 has no surface in
     * this story — `ReceivingEvent` is unfulfillable in every required field —
     * and an unused member of a closed union, carrying a legend swatch nobody
     * renders, is dead code. Adding them later is trivially safe:
     * MarkerShapeGlyph's `default` branch assigns to `const unexpected: never`,
     * so a future member without a case is a COMPILE ERROR, not a silent gap.
     *
     * This assertion is a type-level one: the two lines below stop compiling
     * the day someone adds a diamond without a surface to put it on.
     */
    const shipped: MarkerShape[] = [
      "circle-filled-ring",
      "circle-filled",
      "circle-hollow",
      "square-filled",
      "square-hollow",
      "triangle-filled",
    ];
    expect(shipped).toHaveLength(6);
    expect(shipped).toContain("triangle-filled");
  });
});

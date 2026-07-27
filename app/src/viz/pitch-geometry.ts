/*
 * The AD-6 -> screen affine map (Task 2). Pure: no React, no DOM, no t(), no
 * locale — this module is the tested heart of the pitch panels, in the same
 * split that made buildSectionPlans the tested heart of Story 2.5.
 *
 * AR-6 is the invariant most likely to break silently: the App may apply
 * affine viewport transforms (rotate, scale, translate, crop) and NOTHING
 * else. Stored coordinates are never rewritten — not clamped, not mirrored,
 * not re-normalized. Everything below is rotate + scale + translate.
 *
 * AD-6, verbatim in shape: coordinates are 0-100 per ACTING TEAM, x=100 at the
 * goal that team is attacking, y=0 on the ATTACKER'S LEFT. The frame is
 * NON-UNIFORM — x=100 spans 105 m while y=100 spans 68 m — so every aspect
 * ratio and every distance below is derived from metres, never from the 0-100
 * numbers themselves.
 */

/** FIFA pitch length: the span of x = 0..100. */
export const PITCH_LENGTH_M = 105;

/** FIFA pitch width: the span of y = 0..100. */
export const PITCH_WIDTH_M = 68;

/*
 * Markings in metres, from the Laws of the Game. Kept as metres and pushed
 * through `project` rather than pre-baked into pixels, so the markings and the
 * markers can never disagree about where the penalty spot is.
 */
const PENALTY_AREA_DEPTH_M = 16.5;
const PENALTY_AREA_WIDTH_M = 40.32;
const SIX_YARD_DEPTH_M = 5.5;
const SIX_YARD_WIDTH_M = 18.32;
const PENALTY_SPOT_DEPTH_M = 11;
const ARC_RADIUS_M = 9.15;
const GOAL_WIDTH_M = 7.32;

/** How far the goal mouth hangs outside the goal line, in px (mockup: 4). */
const GOAL_DEPTH_PX = 4;

/** Radius of the penalty/centre spot dots, in px (mockup: 2). */
const SPOT_RADIUS_PX = 2;

/** Sampling resolution for curved markings. */
const ARC_SEGMENTS = 48;

/**
 * `horizontal` = attack left to right, attacked goal at the RIGHT edge (>=md,
 * the desktop mockup's 246x318 viewBox). `vertical` = attacking goal UP (<md,
 * UX-DR17) — which is also the source PDF's own drawing orientation, so the
 * <md rendering is a direct visual overlay of the report page.
 */
export type PitchOrientation = "horizontal" | "vertical";

/** The frame's x floor: 50 for the half pitch, 0 for the full pitch. */
export interface PitchExtent {
  xMin: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  cx: number;
  cy: number;
}

/** The affine map itself: AD-6 coordinates in, CSS px out. */
export type Projection = (x: number, y: number) => Point;

/**
 * Half pitch by default, full pitch the moment ANY event sits behind halfway
 * (ruled decision 3). Every shot and cross in all three fixtures is in the
 * attacking half (shots x 70.34-98.71, crosses 60.38-94.80) and both mockups
 * draw half pitches — but a long-range attempt at x=45 in real data must never
 * be clipped, displaced or dropped, so the panel silently widens instead.
 *
 * NEVER clamp a coordinate to the extent. That is coordinate rewriting, which
 * AR-6 bans outright; widening the frame is a viewport crop, which it allows.
 */
export function pitchExtentFor(points: readonly { x: number }[]): PitchExtent {
  for (const point of points) {
    if (!(point.x >= 50)) {
      // Written as a negated >= so a NaN x (an `as`-cast bundle can carry one)
      // widens the frame rather than silently passing the half-pitch test.
      return { xMin: 0 };
    }
  }
  return { xMin: 50 };
}

/** Visible pitch depth in metres for an extent — 52.5 for a half pitch. */
function visibleLengthM(extent: PitchExtent): number {
  return ((100 - extent.xMin) / 100) * PITCH_LENGTH_M;
}

/**
 * The panel box for a measured container width. The aspect comes from metres:
 * a horizontal half pitch is 68 m across by 52.5 m deep, i.e. the mockup's
 * 318/246. The internal padding lives INSIDE this box (as it does in the
 * mockup, whose 246x318 viewBox holds a 230x302 boundary), so the drawn pitch
 * carries the same slight vertical stretch the mockup does — still a pure
 * non-uniform scale, still affine.
 */
export function panelSize(
  orientation: PitchOrientation,
  extent: PitchExtent,
  widthPx: number
): Size {
  const lengthM = visibleLengthM(extent);
  const height =
    orientation === "horizontal"
      ? (widthPx * PITCH_WIDTH_M) / lengthM
      : (widthPx * lengthM) / PITCH_WIDTH_M;
  return { width: widthPx, height };
}

/**
 * The affine map, in CSS px, with `padPx` of internal padding on every side
 * (DESIGN: "pitch drawings keep an internal padding of at least
 * {spacing.tile-gap}").
 *
 * Derivation, so nobody "fixes" it later: AD-6 puts x=100 at the attacked goal
 * and y=0 on the ATTACKER'S LEFT. A player attacking up the page has their left
 * hand toward page-left, so y=0 is page-left in the source frame — that is the
 * `vertical` map, and it is the source PDF's own drawing. Rotating it 90
 * degrees clockwise into the horizontal layout sends page-left to the TOP,
 * which is why `cy` grows with y there. The desktop mockup corroborates: its
 * two goal markers sit right of the penalty-area edge and vertically inside the
 * box.
 */
export function project(
  orientation: PitchOrientation,
  extent: PitchExtent,
  size: Size,
  padPx: number
): Projection {
  const innerW = size.width - 2 * padPx;
  const innerH = size.height - 2 * padPx;
  const span = 100 - extent.xMin;
  if (orientation === "horizontal") {
    return (x, y) => ({
      cx: padPx + ((x - extent.xMin) / span) * innerW,
      cy: padPx + (y / 100) * innerH,
    });
  }
  return (x, y) => ({
    cx: padPx + (y / 100) * innerW,
    cy: padPx + ((100 - x) / span) * innerH,
  });
}

export interface PitchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PitchLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PitchSpot extends Point {
  r: number;
}

/**
 * Every drawable pitch marking as DATA in px — never JSX, so the geometry is
 * unit-testable in a harness with no DOM. Curved markings are projected
 * polylines rather than SVG arc commands: the 0-100 -> px scale is non-uniform
 * and orientation-dependent, so a circle of 9.15 m is an ellipse on screen
 * whose axes swap between orientations. Sampling through `project` is exactly
 * correct under any affine map, and it cannot drift from the markers.
 */
export interface PitchMarkings {
  boundary: PitchRect;
  /** The shaded mow bands only — three across a half pitch, six across a full one. */
  stripes: PitchRect[];
  penaltyArea: PitchRect;
  sixYardBox: PitchRect;
  penaltySpot: PitchSpot;
  /** The 9.15 m arc outside the penalty area, as a projected polyline path. */
  penaltyArc: string;
  goal: PitchRect;
  /** Full pitch only — a half pitch has no halfway line and no centre circle. */
  halfwayLine: PitchLine | null;
  centreCircle: string | null;
  centreSpot: PitchSpot | null;
}

/** Rect through two projected corners, normalized so width/height stay positive. */
function rectThrough(a: Point, b: Point): PitchRect {
  return {
    x: Math.min(a.cx, b.cx),
    y: Math.min(a.cy, b.cy),
    width: Math.abs(b.cx - a.cx),
    height: Math.abs(b.cy - a.cy),
  };
}

/** An x offset in metres from the attacked goal line, in 0-100 x units. */
function xFromGoalLine(metres: number): number {
  return 100 - (metres / PITCH_LENGTH_M) * 100;
}

/** Half of a width in metres, in 0-100 y units either side of the centre. */
function yHalfSpan(metres: number): number {
  return (metres / 2 / PITCH_WIDTH_M) * 100;
}

/**
 * Sample an ellipse arc in the 0-100 frame and project every point. `startDeg`
 * / `endDeg` are measured in the source frame (0 = +x, i.e. toward the attacked
 * goal), which keeps the geometry orientation-independent.
 */
function arcPath(
  projection: Projection,
  centreX: number,
  centreY: number,
  radiusX: number,
  radiusY: number,
  startDeg: number,
  endDeg: number
): string {
  const commands: string[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    const degrees = startDeg + ((endDeg - startDeg) * i) / ARC_SEGMENTS;
    const radians = (degrees * Math.PI) / 180;
    const point = projection(
      centreX + radiusX * Math.cos(radians),
      centreY + radiusY * Math.sin(radians)
    );
    commands.push(`${i === 0 ? "M" : "L"}${point.cx},${point.cy}`);
  }
  return commands.join("");
}

export function pitchMarkings(
  orientation: PitchOrientation,
  extent: PitchExtent,
  size: Size,
  padPx: number
): PitchMarkings {
  const p = project(orientation, extent, size, padPx);
  const boundary = rectThrough(p(extent.xMin, 0), p(100, 100));

  /*
   * Mow bands run along the pitch's length and alternate; the mockup shades
   * three of six across a half pitch, so the band count scales with the extent
   * (twelve bands, six shaded, across a full pitch) and a stripe is never a
   * different physical width on one panel than on another.
   */
  const bandCount = extent.xMin === 50 ? 6 : 12;
  const bandSpan = (100 - extent.xMin) / bandCount;
  const stripes: PitchRect[] = [];
  for (let band = 1; band < bandCount; band += 2) {
    const from = extent.xMin + band * bandSpan;
    stripes.push(rectThrough(p(from, 0), p(from + bandSpan, 100)));
  }

  const penaltyAreaX = xFromGoalLine(PENALTY_AREA_DEPTH_M);
  const penaltyHalf = yHalfSpan(PENALTY_AREA_WIDTH_M);
  const penaltyArea = rectThrough(
    p(penaltyAreaX, 50 - penaltyHalf),
    p(100, 50 + penaltyHalf)
  );

  const sixYardHalf = yHalfSpan(SIX_YARD_WIDTH_M);
  const sixYardBox = rectThrough(
    p(xFromGoalLine(SIX_YARD_DEPTH_M), 50 - sixYardHalf),
    p(100, 50 + sixYardHalf)
  );

  const spotX = xFromGoalLine(PENALTY_SPOT_DEPTH_M);
  const spotPoint = p(spotX, 50);
  const penaltySpot: PitchSpot = { ...spotPoint, r: SPOT_RADIUS_PX };

  /*
   * The visible penalty arc is the part of the 9.15 m circle around the penalty
   * spot that lies OUTSIDE the penalty area. Solving for the angle where the
   * circle crosses the box edge keeps the two in exact agreement at every
   * width, which hand-tuned endpoints would not.
   */
  const arcRadiusX = (ARC_RADIUS_M / PITCH_LENGTH_M) * 100;
  const arcRadiusY = (ARC_RADIUS_M / PITCH_WIDTH_M) * 100;
  const crossing = Math.acos(
    Math.max(-1, Math.min(1, (penaltyAreaX - spotX) / arcRadiusX))
  );
  const crossingDeg = (crossing * 180) / Math.PI;
  const penaltyArc = arcPath(p, spotX, 50, arcRadiusX, arcRadiusY, crossingDeg, 360 - crossingDeg);

  const goalHalf = yHalfSpan(GOAL_WIDTH_M);
  const goalMouth = rectThrough(p(100, 50 - goalHalf), p(100, 50 + goalHalf));
  const goal: PitchRect =
    orientation === "horizontal"
      ? { x: goalMouth.x, y: goalMouth.y, width: GOAL_DEPTH_PX, height: goalMouth.height }
      : {
          x: goalMouth.x,
          y: goalMouth.y - GOAL_DEPTH_PX,
          width: goalMouth.width,
          height: GOAL_DEPTH_PX,
        };

  const isFullPitch = extent.xMin === 0;
  const halfwayStart = p(50, 0);
  const halfwayEnd = p(50, 100);
  const centrePoint = p(50, 50);

  return {
    boundary,
    stripes,
    penaltyArea,
    sixYardBox,
    penaltySpot,
    penaltyArc,
    goal,
    halfwayLine: isFullPitch
      ? { x1: halfwayStart.cx, y1: halfwayStart.cy, x2: halfwayEnd.cx, y2: halfwayEnd.cy }
      : null,
    centreCircle: isFullPitch ? arcPath(p, 50, 50, arcRadiusX, arcRadiusY, 0, 360) : null,
    centreSpot: isFullPitch ? { ...centrePoint, r: SPOT_RADIUS_PX } : null,
  };
}

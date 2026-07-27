import { Delaunay } from "d3-delaunay";

import type { MinuteStamp } from "@/lib/contract/contract-types";
import type { Point } from "@/viz/pitch-geometry";

/*
 * Ordering, clustering and hit partitioning (Task 3). Pure, because everything
 * AC 3 is really about lives here and the harness has no jsdom — the components
 * stay thin so this can be tested for real.
 *
 * d3-delaunay is used for GEOMETRY MATH ONLY. It never touches the DOM: React
 * owns every SVG node, and the cell paths below are plain strings handed to
 * React as `d` attributes. `d3.select().append()` anywhere in this story would
 * fight the reconciler, break lazy unmount and make the whole viz untestable.
 */

/** UX-DR15's touch floor: every hit target measures at least this across. */
export const MIN_HIT_PX = 44;

/**
 * Stable order by (minute, stoppageMinute ?? 0) — the roving-tabindex order
 * (UX-DR16) and the data table's default sort, in one place so they can never
 * disagree.
 *
 * `at` is typed as nullable because CrossEvent's clock is `required` in the
 * schema but UNFULFILLABLE from the source page (Story 1.11), and the bundle
 * arrives as an unvalidated `as`-cast. Clock-less events sort last, stably,
 * rather than crashing the sort or silently taking minute 0.
 */
export function orderByMinute<T extends { at?: MinuteStamp | null }>(events: readonly T[]): T[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const left = a.event.at;
      const right = b.event.at;
      if (left == null || right == null) {
        if (left == null && right == null) {
          return a.index - b.index;
        }
        return left == null ? 1 : -1;
      }
      if (left.minute !== right.minute) {
        return left.minute - right.minute;
      }
      const leftStoppage = left.stoppageMinute ?? 0;
      const rightStoppage = right.stoppageMinute ?? 0;
      if (leftStoppage !== rightStoppage) {
        return leftStoppage - rightStoppage;
      }
      // Explicit index tiebreak: Array.sort is stable in every supported
      // engine, but the ordering contract is load-bearing enough to state.
      return a.index - b.index;
    })
    .map(({ event }) => event);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

/** The centroid of a cluster's members — its Voronoi seed and popover anchor. */
export function clusterCentroid(points: readonly Point[], cluster: readonly number[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const index of cluster) {
    sumX += points[index].cx;
    sumY += points[index].cy;
  }
  return { cx: sumX / cluster.length, cy: sumY / cluster.length };
}

/**
 * Single-link clustering: two markers whose centres are closer than `minDistPx`
 * land in one cluster, transitively. Returns arrays of indices into the input,
 * each in the input's own order — which, since the caller orders by minute
 * first, is the order a cluster popover lists its events in.
 *
 * This is UX-DR9's "markers whose >=44px hit areas would collide are treated as
 * one cluster EVEN WHEN VISUALLY SEPARATE". **Markers are never moved**:
 * clustering changes only the hit target, never a cx/cy. Overlapping markers
 * stay exactly where the artifact put them (AR-6), and the cluster popover is
 * how a user reaches the one underneath.
 *
 * Why the cells this feeds satisfy ">=44px areas" without inflating anything —
 * stated here so nobody adds a fudge factor: cluster representatives are
 * >= minDistPx apart by construction, so every Voronoi cell extends at least
 * half that toward each neighbour, i.e. >= minDistPx across. Inflating cells
 * would make them overlap and break "a touch never silently lands on the wrong
 * event".
 *
 * The second pass is what makes that "by construction" literally true rather
 * than nearly true. Single-link alone guarantees only that two points in
 * DIFFERENT clusters are >= minDistPx apart; their CENTROIDS can still be
 * closer (a ring of chained markers centroids onto a lone marker at its
 * middle). So clusters whose representatives collide are merged until the set
 * is stable. It converges because every pass strictly reduces the cluster
 * count.
 */
export function clusterMarkers(
  points: readonly Point[],
  minDistPx: number = MIN_HIT_PX
): number[][] {
  if (points.length === 0) {
    return [];
  }

  // Union-find over the raw points (single link).
  const parent = points.map((_, index) => index);
  function find(index: number): number {
    let root = index;
    while (parent[root] !== root) {
      root = parent[root];
    }
    // Path compression, so a long transitive chain stays cheap.
    let walk = index;
    while (parent[walk] !== root) {
      const next = parent[walk];
      parent[walk] = root;
      walk = next;
    }
    return root;
  }
  function union(a: number, b: number): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
    }
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (distance(points[i], points[j]) < minDistPx) {
        union(i, j);
      }
    }
  }

  let clusters = groupByRoot(points.length, find);

  // Centroid stabilisation — see the docblock above.
  for (;;) {
    const centroids = clusters.map((cluster) => clusterCentroid(points, cluster));
    let merged = false;
    outer: for (let i = 0; i < centroids.length; i += 1) {
      for (let j = i + 1; j < centroids.length; j += 1) {
        if (distance(centroids[i], centroids[j]) < minDistPx) {
          clusters[i] = [...clusters[i], ...clusters[j]].sort((a, b) => a - b);
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
    if (!merged) {
      break;
    }
  }

  // Clusters ordered by their earliest member, so the hit targets follow the
  // same minute order the markers and the table use.
  clusters = clusters.sort((a, b) => a[0] - b[0]);
  return clusters;
}

function groupByRoot(count: number, find: (index: number) => number): number[][] {
  const byRoot = new Map<number, number[]>();
  for (let index = 0; index < count; index += 1) {
    const root = find(index);
    const bucket = byRoot.get(root);
    if (bucket === undefined) {
      byRoot.set(root, [index]);
    } else {
      bucket.push(index);
    }
  }
  return [...byRoot.values()].sort((a, b) => a[0] - b[0]);
}

/**
 * One SVG path per cluster representative, partitioning `bounds` by nearest
 * representative — UX-DR9's "hit areas partition by nearest marker (Voronoi)".
 *
 * The two degenerate inputs are special-cased rather than trusted: n = 0 has no
 * meaningful Voronoi at all, and while d3-delaunay does happen to return the
 * bounds rectangle for n = 1, pinning it here makes the panel's behaviour
 * independent of that implementation detail. A fully collinear set is the other
 * rough edge; d3-delaunay handles it (verified in the tests) but coincident
 * seeds return `undefined` from renderCell, so the return type admits null and
 * every caller must tolerate a cell-less cluster. Coincident representatives
 * cannot actually occur here — clusterMarkers merges anything closer than the
 * floor, and zero is closer.
 */
export function hitCells(
  clusterPoints: readonly Point[],
  bounds: [number, number, number, number]
): (string | null)[] {
  const [x0, y0, x1, y1] = bounds;
  if (clusterPoints.length === 0) {
    return [];
  }
  if (clusterPoints.length === 1) {
    return [`M${x0},${y0}L${x1},${y0}L${x1},${y1}L${x0},${y1}Z`];
  }
  const delaunay = Delaunay.from(
    clusterPoints,
    (point) => point.cx,
    (point) => point.cy
  );
  const voronoi = delaunay.voronoi(bounds);
  return clusterPoints.map((_, index) => voronoi.renderCell(index) ?? null);
}

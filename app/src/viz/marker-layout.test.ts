import { readFileSync } from "node:fs";
import path from "node:path";

import { Delaunay } from "d3-delaunay";
import { describe, expect, it } from "vitest";

import type { MatchBundle, MinuteStamp } from "@/lib/contract/contract-types";
import {
  MIN_HIT_PX,
  clusterCentroid,
  clusterMarkers,
  hitCells,
  orderByMinute,
} from "@/viz/marker-layout";
import { panelSize, project } from "@/viz/pitch-geometry";

/*
 * Task 3.8. Everything AC 3 is really about lives in this module, because the
 * harness has no jsdom (the deliberate 2.2 decision) and nothing rendered can
 * be unit-tested. Fixtures are read with node:fs — src/viz sits inside the
 * client-import seam as of Task 1.3.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");

function at(minute: number, stoppageMinute: number | null = null): MinuteStamp {
  return { minute, stoppageMinute };
}

describe("MIN_HIT_PX", () => {
  it("is UX-DR15's 44 px touch floor", () => {
    expect(MIN_HIT_PX).toBe(44);
  });
});

describe("orderByMinute (UX-DR16 roving order, and the table's default sort)", () => {
  it("orders by minute, then by stoppage minute", () => {
    const events = [
      { id: "e", at: at(46) },
      { id: "c", at: at(45, 3) },
      { id: "a", at: at(45) },
      { id: "d", at: at(45, 7) },
      { id: "b", at: at(45, 1) },
    ];
    expect(orderByMinute(events).map((e) => e.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("treats a null stoppage minute as 0, so 45 precedes 45+1", () => {
    const events = [{ id: "stoppage", at: at(45, 1) }, { id: "plain", at: at(45) }];
    expect(orderByMinute(events).map((e) => e.id)).toEqual(["plain", "stoppage"]);
  });

  it("is stable: ties keep artifact order", () => {
    const events = [
      { id: "first", at: at(41) },
      { id: "second", at: at(41) },
      { id: "third", at: at(41) },
    ];
    expect(orderByMinute(events).map((e) => e.id)).toEqual(["first", "second", "third"]);
  });

  it("sorts events with no clock last, stably (Task 4.4: CrossEvent.at may be absent)", () => {
    const events = [
      { id: "late", at: at(90) },
      { id: "missing-a", at: null },
      { id: "early", at: at(2) },
      { id: "missing-b", at: undefined },
    ];
    expect(orderByMinute(events).map((e) => e.id)).toEqual([
      "early",
      "late",
      "missing-a",
      "missing-b",
    ]);
  });

  it("does not mutate or alias its input", () => {
    const events = [{ id: "b", at: at(9) }, { id: "a", at: at(1) }];
    const ordered = orderByMinute(events);
    expect(events.map((e) => e.id)).toEqual(["b", "a"]);
    expect(ordered).not.toBe(events);
  });

  it("orders m002's real stoppage-time shots after the 90th minute", () => {
    /*
     * The story's worked example says "45+3 between 45 and 46"; m002's three
     * stoppage shots are in fact at 90+2, 90+3 and 90+3. Same property, real
     * data — asserted against the fixture rather than the prose.
     */
    const shots = m002.events.shots ?? [];
    const stoppage = shots.filter((s) => s.at.stoppageMinute !== null);
    expect(stoppage).toHaveLength(3);
    const ordered = orderByMinute(shots);
    const clock = ordered.map((s) => `${s.at.minute}+${s.at.stoppageMinute ?? 0}`);
    expect(clock.slice(-3)).toEqual(["90+2", "90+3", "90+3"]);
    // Every plain-90 shot precedes every stoppage shot.
    const firstStoppage = ordered.findIndex((s) => s.at.stoppageMinute !== null);
    expect(ordered.slice(0, firstStoppage).every((s) => s.at.stoppageMinute === null)).toBe(true);
  });
});

describe("clusterMarkers (UX-DR9: colliding hit areas are one cluster)", () => {
  it("merges markers closer than the floor and separates them at it", () => {
    // Exactly at 44 the two hit areas touch without overlapping, so they stay
    // two targets; 43.9 collides and merges.
    expect(clusterMarkers([{ cx: 0, cy: 0 }, { cx: 43.9, cy: 0 }])).toEqual([[0, 1]]);
    expect(clusterMarkers([{ cx: 0, cy: 0 }, { cx: 44, cy: 0 }])).toEqual([[0], [1]]);
    expect(clusterMarkers([{ cx: 0, cy: 0 }, { cx: 44.1, cy: 0 }])).toEqual([[0], [1]]);
  });

  it("chains transitively: A-B 30 px and B-C 30 px make one cluster of three", () => {
    const clusters = clusterMarkers([
      { cx: 0, cy: 0 },
      { cx: 30, cy: 0 },
      { cx: 60, cy: 0 },
    ]);
    expect(clusters).toEqual([[0, 1, 2]]);
  });

  it("keeps members in input order, so a cluster list reads in minute order", () => {
    const clusters = clusterMarkers([
      { cx: 200, cy: 200 },
      { cx: 10, cy: 10 },
      { cx: 20, cy: 10 },
    ]);
    expect(clusters).toEqual([[0], [1, 2]]);
  });

  it("handles the empty and single-point cases", () => {
    expect(clusterMarkers([])).toEqual([]);
    expect(clusterMarkers([{ cx: 5, cy: 5 }])).toEqual([[0]]);
  });

  it("merges coincident markers, which AD-8 guarantees the pipeline never dedupes", () => {
    expect(clusterMarkers([{ cx: 12, cy: 12 }, { cx: 12, cy: 12 }])).toEqual([[0, 1]]);
  });

  it("never moves a marker — clustering changes the hit target, not a position", () => {
    const points = [{ cx: 10, cy: 10 }, { cx: 20, cy: 10 }];
    const snapshot = JSON.stringify(points);
    clusterMarkers(points);
    expect(JSON.stringify(points)).toBe(snapshot);
  });

  it("clusters m001 Mexico's two real near-pairs on the rendered half pitch", () => {
    /*
     * Real fixture geometry, not synthetic: the two Mexico goals sit at
     * (79.40, 41.88) and (78.52, 41.50), and three attempts cluster around
     * (86.83, 30.28) / (88.25, 33.93) / (89.04, 34.36).
     */
    const shots = (m001.events.shots ?? []).filter((s) => s.teamId === "mexico");
    expect(shots).toHaveLength(16);
    const size = panelSize("horizontal", { xMin: 50 }, 380);
    const p = project("horizontal", { xMin: 50 }, size, 12);
    const ordered = orderByMinute(shots);
    const points = ordered.map((s) => p(s.x, s.y));
    const clusters = clusterMarkers(points);
    // Fewer targets than markers: the near-pairs collapsed.
    expect(clusters.length).toBeLessThan(points.length);
    expect(clusters.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i)
    );
    // The two goals (minute 8 and minute 66) share one hit target.
    const goalIndices = ordered
      .map((s, i) => (s.outcome === "goal" ? i : -1))
      .filter((i) => i >= 0);
    expect(goalIndices).toHaveLength(2);
    const goalCluster = clusters.find((c) => c.includes(goalIndices[0]));
    expect(goalCluster).toContain(goalIndices[1]);
  });
});

describe("cluster representatives stay at least a hit area apart (Task 3.6)", () => {
  function minRepresentativeDistance(points: { cx: number; cy: number }[]): number {
    const clusters = clusterMarkers(points);
    const reps = clusters.map((cluster) => clusterCentroid(points, cluster));
    let smallest = Infinity;
    for (let i = 0; i < reps.length; i += 1) {
      for (let j = i + 1; j < reps.length; j += 1) {
        smallest = Math.min(smallest, Math.hypot(reps[i].cx - reps[j].cx, reps[i].cy - reps[j].cy));
      }
    }
    return smallest;
  }

  it("holds for a deterministic pseudo-random sweep", () => {
    // A seeded LCG, so a failure is reproducible rather than a flake.
    let seed = 20260726;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let trial = 0; trial < 60; trial += 1) {
      const points = Array.from({ length: 24 }, () => ({
        cx: random() * 360,
        cy: random() * 300,
      }));
      expect(minRepresentativeDistance(points)).toBeGreaterThanOrEqual(MIN_HIT_PX - 1e-9);
    }
  });

  it("holds for the adversarial ring, which single-link alone would fail", () => {
    /*
     * Single-link clustering ALONE does not give this guarantee: a ring of
     * points chained at 43 px around a lone centre point puts the ring's
     * centroid on top of the centre point, even though every cross-cluster pair
     * is >= 44 px apart. The centroid-stabilisation pass in clusterMarkers is
     * what makes Task 3.6's reasoning literally true instead of nearly true.
     */
    const radius = 60;
    const ring = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * 2 * Math.PI;
      return { cx: 200 + radius * Math.cos(angle), cy: 200 + radius * Math.sin(angle) };
    });
    const points = [...ring, { cx: 200, cy: 200 }];
    expect(minRepresentativeDistance(points)).toBeGreaterThanOrEqual(MIN_HIT_PX - 1e-9);
  });

  it("centroids the members it is given", () => {
    const points = [{ cx: 0, cy: 0 }, { cx: 10, cy: 20 }, { cx: 500, cy: 500 }];
    expect(clusterCentroid(points, [0, 1])).toEqual({ cx: 5, cy: 10 });
    expect(clusterCentroid(points, [2])).toEqual({ cx: 500, cy: 500 });
  });
});

describe("hitCells (Voronoi partition by nearest cluster)", () => {
  const BOUNDS: [number, number, number, number] = [0, 0, 200, 200];

  it("returns nothing for no clusters", () => {
    expect(hitCells([], BOUNDS)).toEqual([]);
  });

  it("gives a single cluster the whole bounds rectangle", () => {
    const cells = hitCells([{ cx: 30, cy: 40 }], BOUNDS);
    expect(cells).toHaveLength(1);
    // Special-cased rather than trusting d3-delaunay's degenerate n=1 output.
    expect(cells[0]).toBe("M0,0L200,0L200,200L0,200Z");
  });

  it("emits one cell per cluster for two, three and many points", () => {
    for (const count of [2, 3, 9]) {
      const points = Array.from({ length: count }, (_, i) => ({
        cx: 20 + i * 17,
        cy: 30 + ((i * 53) % 140),
      }));
      const cells = hitCells(points, BOUNDS);
      expect(cells, `n=${count}`).toHaveLength(count);
      for (const cell of cells) {
        expect(cell, `n=${count}`).not.toBeNull();
        expect(cell?.startsWith("M"), `n=${count}`).toBe(true);
      }
    }
  });

  it("survives a fully collinear point set — the documented degenerate case", () => {
    const collinear = [
      { cx: 20, cy: 100 },
      { cx: 70, cy: 100 },
      { cx: 120, cy: 100 },
      { cx: 170, cy: 100 },
    ];
    expect(() => hitCells(collinear, BOUNDS)).not.toThrow();
    const cells = hitCells(collinear, BOUNDS);
    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell !== null)).toBe(true);
  });

  it("partitions by nearest: the cell count always equals the cluster count", () => {
    const points = [
      { cx: 10, cy: 10 },
      { cx: 190, cy: 10 },
      { cx: 10, cy: 190 },
      { cx: 190, cy: 190 },
      { cx: 100, cy: 100 },
    ];
    expect(hitCells(points, BOUNDS)).toHaveLength(points.length);
  });

  it("does not mutate its input", () => {
    const points = [{ cx: 30, cy: 40 }, { cx: 150, cy: 90 }];
    const snapshot = JSON.stringify(points);
    hitCells(points, BOUNDS);
    expect(JSON.stringify(points)).toBe(snapshot);
  });
});

/*
 * Story 2.7 code-review regression. AC 3 words the hit layer as "hit areas
 * partition by NEAREST MARKER (Voronoi)". The panel originally seeded the
 * diagram on cluster CENTROIDS, which looks equivalent and is not: single-link
 * clustering chains transitively, so a cluster's outlying member can sit closer
 * to a neighbouring cluster's centroid than to its own — and a click dead
 * centre on that marker opened a popover that did not contain it, silently.
 *
 * These tests pin the invariant the fix restores: every marker's own pixel
 * resolves to a cell belonging to its OWN cluster. They run over the real
 * fixture geometry at the widths the panel actually renders at, because the
 * counterexamples were found there, not in a constructed case.
 */
describe("hit cells resolve every marker to its own cluster (AC 3)", () => {
  const PAD_PX = 12;

  /** Mirrors PitchPanel's layout composition exactly. */
  function partition(points: { cx: number; cy: number }[], width: number, height: number) {
    const clusters = clusterMarkers(points);
    const clusterOfMarker = new Array<number>(points.length).fill(0);
    clusters.forEach((cluster, clusterIndex) => {
      for (const markerIndex of cluster) {
        clusterOfMarker[markerIndex] = clusterIndex;
      }
    });
    return { clusters, clusterOfMarker, cells: hitCells(points, [0, 0, width, height]) };
  }

  it("gives one cell per MARKER, not one per cluster", () => {
    // Three markers close enough to be one cluster: still three cells.
    const points = [
      { cx: 100, cy: 100 },
      { cx: 120, cy: 105 },
      { cx: 140, cy: 110 },
    ];
    const { clusters, cells } = partition(points, 400, 400);
    expect(clusters).toHaveLength(1);
    expect(cells).toHaveLength(3);
  });

  it("the chained-cluster counterexample: every marker resolves to its own cluster", () => {
    /*
     * The shape that broke centroid seeding — five markers chained at 40px
     * (one cluster, centroid at cx 100) plus a lone marker 46px below the
     * chain's first member. Marker 0's nearest CENTROID was the lone marker's,
     * so marker 0's own pixel opened the wrong popover.
     */
    const points = [
      { cx: 0, cy: 0 },
      { cx: 40, cy: 0 },
      { cx: 80, cy: 0 },
      { cx: 120, cy: 0 },
      { cx: 160, cy: 0 },
      { cx: 200, cy: 0 },
      { cx: 0, cy: 46 },
    ];
    const { clusters, clusterOfMarker, cells } = partition(points, 400, 400);
    expect(clusters).toHaveLength(2);
    expect(cells).toHaveLength(points.length);

    /*
     * The two seedings, run side by side. This is the assertion that actually
     * earns its keep: it shows the OLD scheme misrouting a specific marker and
     * the NEW one routing every marker correctly, so reverting to centroids
     * fails here with the reason attached rather than shipping silently.
     */
    const centroids = clusters.map((cluster) => clusterCentroid(points, cluster));
    const byCentroid = Delaunay.from(
      centroids,
      (p) => p.cx,
      (p) => p.cy
    );
    const byMarker = Delaunay.from(
      points,
      (p) => p.cx,
      (p) => p.cy
    );

    // Centroid seeding: marker 0 lands in cluster 1's cell — the wrong popover.
    expect(byCentroid.find(points[0].cx, points[0].cy)).toBe(1);
    expect(clusterOfMarker[0]).toBe(0);

    // Marker seeding: every marker resolves to a cell owned by its own cluster.
    points.forEach((point, markerIndex) => {
      const hitMarker = byMarker.find(point.cx, point.cy);
      expect(clusterOfMarker[hitMarker]).toBe(clusterOfMarker[markerIndex]);
    });
  });

  it("holds across the real fixtures at the widths the panel renders at", () => {
    const widths = [320, 386, 527, 768];
    const orientations = ["horizontal", "vertical"] as const;
    let checked = 0;
    for (const bundle of [m001, m002]) {
      for (const teamId of [
        bundle.metadata.homeTeam.teamId,
        bundle.metadata.awayTeam.teamId,
      ]) {
        const shots = (bundle.events.shots ?? []).filter(
          (shot) => shot.teamId === teamId && shot.ownGoal !== true
        );
        if (shots.length === 0) {
          continue;
        }
        for (const orientation of orientations) {
          for (const width of widths) {
            const extent = { xMin: 50 };
            const size = panelSize(orientation, extent, width);
            const projection = project(orientation, extent, size, PAD_PX);
            const points = shots.map((shot) => projection(shot.x, shot.y));
            const { clusters, cells } = partition(points, size.width, size.height);
            // One cell per marker, none dropped, and every cluster non-empty.
            expect(cells).toHaveLength(points.length);
            expect(clusters.flat()).toHaveLength(points.length);
            checked += 1;
          }
        }
      }
    }
    // Guard the guard: a silently-empty sweep would report green (2.4 lesson).
    expect(checked).toBeGreaterThanOrEqual(16);
  });
});

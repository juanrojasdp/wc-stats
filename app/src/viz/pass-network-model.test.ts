import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  MatchBundle,
  PassNetworkEdge,
  PassNetworkNode,
} from "@/lib/contract/contract-types";
import { panelDataState } from "@/viz/marker-model";
import { pitchExtentFor } from "@/viz/pitch-geometry";
import {
  EDGE_STROKE_PX,
  EDGE_WEIGHT_VARS,
  NODE_RADIUS_MAX_PX,
  NODE_RADIUS_MID_PX,
  NODE_RADIUS_MIN_PX,
  dimmedNodeKeys,
  edgeStop,
  edgeWeightThresholds,
  incidentEdgeKeys,
  incidentPlayerIds,
  involvementDomain,
  involvementRadius,
  nodeDegree,
  passEdgeRows,
  passNetworkEdgeGeometry,
  passNetworkFigureCounts,
  passNetworkMarkers,
  passNodeRows,
  quintileBands,
  teamIdOfPlayer,
  visibleEdgeGeometry,
} from "@/viz/pass-network-model";

/*
 * Task 3. Node environment, no jsdom — the same shape as the four viz suites
 * Story 2.7 shipped, and the reason the encoding decisions live in a pure
 * module at all.
 *
 * The fixtures are handcrafted (data/fixtures/README.md:70-72) and Story 1.14
 * has never probed the source page, so every assertion here is about GEOMETRY
 * and ENCODING — never about a shape resembling a real formation.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

const FIXTURES = [
  { slug: "m001", bundle: m001 },
  { slug: "m002", bundle: m002 },
  { slug: "m074", bundle: m074 },
];

const ACCENT_A = "--viz-team-a-on-pitch";
const ACCENT_B = "--viz-team-b-on-pitch";

/** The component's own value clause, stubbed: the model never resolves copy. */
function valuePhrase({ involvement, degree }: { involvement: number | null; degree: number }): string {
  return `${involvement ?? "?"}p ${degree}c`;
}

function nodesOf(bundle: MatchBundle): PassNetworkNode[] {
  const nodes = bundle.events.passNetworkNodes;
  if (nodes === null) {
    throw new Error(`fixture ${bundle.matchId} has no pass-network nodes`);
  }
  return nodes;
}

function edgesOf(bundle: MatchBundle): PassNetworkEdge[] {
  const edges = bundle.events.passNetworkEdges;
  if (edges === null) {
    throw new Error(`fixture ${bundle.matchId} has no pass-network edges`);
  }
  return edges;
}

function sides(bundle: MatchBundle) {
  return {
    home: {
      teamId: bundle.metadata.homeTeam.teamId,
      teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
    },
    away: {
      teamId: bundle.metadata.awayTeam.teamId,
      teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
    },
  };
}

/** Every team-inning in every fixture: (slug, teamId, accent). */
const TEAM_INNINGS = FIXTURES.flatMap(({ slug, bundle }) => {
  const { home, away } = sides(bundle);
  return [
    { slug, bundle, teamId: home.teamId, accent: ACCENT_A },
    { slug, bundle, teamId: away.teamId, accent: ACCENT_B },
  ];
});

function markersFor(bundle: MatchBundle, teamId: string, accent: string) {
  const nodes = nodesOf(bundle);
  return passNetworkMarkers(
    nodes,
    edgesOf(bundle),
    teamId,
    accent,
    involvementDomain(nodes),
    valuePhrase
  );
}

function node(overrides: Partial<PassNetworkNode> & { playerId: string }): PassNetworkNode {
  return {
    teamId: "home",
    playerName: `Player ${overrides.playerId}`,
    shirtNumber: 1,
    x: 50,
    y: 50,
    involvement: 10,
    ...overrides,
  } as PassNetworkNode;
}

function edge(from: string, to: string, volume: number, teamId = "home"): PassNetworkEdge {
  return { teamId, fromPlayerId: from, toPlayerId: to, volume } as PassNetworkEdge;
}

describe("constants", () => {
  it("keeps the ramp vars and stroke widths index-aligned and frozen", () => {
    expect(EDGE_WEIGHT_VARS).toEqual([
      "--edge-weight-1",
      "--edge-weight-2",
      "--edge-weight-3",
      "--edge-weight-4",
      "--edge-weight-5",
    ]);
    // Ruled decision 4: stroke width is the encoding, not decoration —
    // adjacent ramp stops separate by only ~1.3:1 in colour alone.
    expect(EDGE_STROKE_PX).toEqual([1.2, 1.8, 2.5, 3.4, 4.5]);
    expect(EDGE_WEIGHT_VARS).toHaveLength(EDGE_STROKE_PX.length);
    expect(Object.isFrozen(EDGE_WEIGHT_VARS)).toBe(true);
    expect(Object.isFrozen(EDGE_STROKE_PX)).toBe(true);
  });
});

describe("passNetworkMarkers — coordinate identity (Task 3.1)", () => {
  it.each(TEAM_INNINGS)(
    "$slug/$teamId copies x and y VERBATIM from the artifact",
    ({ bundle, teamId, accent }) => {
      const mine = nodesOf(bundle).filter((n) => n.teamId === teamId);
      const markers = markersFor(bundle, teamId, accent);
      expect(markers).toHaveLength(mine.length);
      /*
       * Identity, never a range assertion: every fixture coordinate sits inside
       * [20.2, 79.8] x [21.9, 80.0], so a transpose or a 100-x mirror stays on
       * the pitch and looks entirely plausible (Story 2.7's precedent).
       */
      for (const marker of markers) {
        const source = mine.find((n) => marker.key === `node-${n.playerId}`);
        expect(source).toBeDefined();
        expect(marker.x).toBe(source?.x);
        expect(marker.y).toBe(source?.y);
      }
    }
  );

  it.each(TEAM_INNINGS)("$slug/$teamId roves in shirt-ascending order", ({ bundle, teamId, accent }) => {
    const shirts = markersFor(bundle, teamId, accent).map((marker) => {
      const row = marker.detail.find((detailRow) => detailRow.labelKey === "viz.table.shirt");
      return row?.value.kind === "number" ? row.value.value : null;
    });
    expect(shirts).toEqual([...shirts].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(shirts).toHaveLength(11);
  });

  it("puts a nullish shirt last and breaks the tie on playerId", () => {
    const nodes = [
      node({ playerId: "c", shirtNumber: null as unknown as number }),
      node({ playerId: "b", shirtNumber: 7 }),
      node({ playerId: "a", shirtNumber: 7 }),
      node({ playerId: "d", shirtNumber: 2 }),
    ];
    const markers = passNetworkMarkers(nodes, [], "home", ACCENT_A, involvementDomain(nodes), valuePhrase);
    expect(markers.map((marker) => marker.key)).toEqual(["node-d", "node-a", "node-b", "node-c"]);
  });

  it("carries the accent, the circle shape and a sized radius", () => {
    const markers = markersFor(m001, "mexico", ACCENT_A);
    for (const marker of markers) {
      expect(marker.colorVar).toBe(ACCENT_A);
      expect(marker.shape).toBe("circle-filled");
      expect(marker.radius).toBeGreaterThanOrEqual(NODE_RADIUS_MIN_PX);
      expect(marker.radius).toBeLessThanOrEqual(NODE_RADIUS_MAX_PX);
    }
  });

  it("never passes minuteLabel null — that would speak 'minuto desconocido' (Task 2.6)", () => {
    for (const { bundle, teamId, accent } of TEAM_INNINGS) {
      for (const marker of markersFor(bundle, teamId, accent)) {
        expect(marker.minuteLabel).not.toBeNull();
        expect(marker.minuteLabel).toContain("c");
      }
    }
  });

  it("throws, naming the player, on a non-finite coordinate", () => {
    const nodes = [node({ playerId: "ghost", x: undefined as unknown as number })];
    expect(() =>
      passNetworkMarkers(nodes, [], "home", ACCENT_A, involvementDomain(nodes), valuePhrase)
    ).toThrow(/ghost/);
  });

  it("speaks an unknown player through subjectName null, never a crash", () => {
    const nodes = [node({ playerId: "x", playerName: null as unknown as string })];
    const markers = passNetworkMarkers(
      nodes,
      [],
      "home",
      ACCENT_A,
      involvementDomain(nodes),
      valuePhrase
    );
    expect(markers[0].subjectName).toBeNull();
  });

  it("renders the unknown placeholder for a missing shirt or involvement", () => {
    const nodes = [
      node({
        playerId: "x",
        shirtNumber: null as unknown as number,
        involvement: null as unknown as number,
      }),
    ];
    const markers = passNetworkMarkers(
      nodes,
      [],
      "home",
      ACCENT_A,
      involvementDomain(nodes),
      valuePhrase
    );
    const values = markers[0].detail.map((row) => row.value);
    expect(values[0]).toEqual({ kind: "key", value: "viz.table.unknown" });
    expect(values[1]).toEqual({ kind: "key", value: "viz.table.unknown" });
    // Degree is always a real number: it is counted, never read.
    expect(values[2]).toEqual({ kind: "number", value: 0, digits: 0 });
  });
});

describe("the pass network is a FULL pitch by construction (Task 3.2)", () => {
  it.each(TEAM_INNINGS)("$slug/$teamId returns xMin 0 on its own", ({ bundle, teamId, accent }) => {
    expect(pitchExtentFor(markersFor(bundle, teamId, accent))).toEqual({ xMin: 0 });
  });

  it("returns xMin 0 for the pooled panel too", () => {
    for (const { bundle } of FIXTURES) {
      const { home, away } = sides(bundle);
      const pooled = [
        ...markersFor(bundle, home.teamId, ACCENT_A),
        ...markersFor(bundle, away.teamId, ACCENT_B),
      ];
      expect(pitchExtentFor(pooled)).toEqual({ xMin: 0 });
    }
  });
});

describe("edgeWeightThresholds / edgeStop (Task 3.3)", () => {
  /*
   * Pinned as literals, computed independently of the implementation from the
   * nearest-rank definition t_k = V[ceil(k * 0.2 * n) - 1]. Monotonicity alone
   * cannot catch an off-by-one in that index.
   */
  const EXPECTED: Record<string, { thresholds: number[]; distribution: number[] }> = {
    m001: { thresholds: [4, 7, 11, 14], distribution: [12, 10, 15, 7, 9] },
    m002: { thresholds: [5, 7, 13, 15], distribution: [12, 7, 10, 8, 9] },
    m074: { thresholds: [4, 9, 13, 15], distribution: [12, 7, 10, 9, 7] },
  };

  it.each(FIXTURES)("$slug pins its panel-pooled thresholds and stop distribution", ({ slug, bundle }) => {
    const edges = edgesOf(bundle);
    const thresholds = edgeWeightThresholds(edges);
    expect(thresholds).toEqual(EXPECTED[slug].thresholds);
    const distribution = [1, 2, 3, 4, 5].map(
      (stop) => edges.filter((e) => edgeStop(e.volume, thresholds) === stop).length
    );
    expect(distribution).toEqual(EXPECTED[slug].distribution);
    expect(distribution.reduce((a, b) => a + b, 0)).toBe(edges.length);
  });

  it("is monotonic non-decreasing in volume and always lands in 1..5", () => {
    const thresholds = edgeWeightThresholds(edgesOf(m001));
    let previous = 1;
    for (let volume = 0; volume <= 40; volume += 1) {
      const stop = edgeStop(volume, thresholds);
      expect(stop).toBeGreaterThanOrEqual(1);
      expect(stop).toBeLessThanOrEqual(5);
      expect(stop).toBeGreaterThanOrEqual(previous);
      previous = stop;
    }
  });

  it("satisfies AC 2's identity directly: stop 1 IS volume <= t1", () => {
    for (const { bundle } of FIXTURES) {
      const thresholds = edgeWeightThresholds(edgesOf(bundle));
      for (const e of edgesOf(bundle)) {
        expect(edgeStop(e.volume, thresholds) === 1).toBe(e.volume <= thresholds[0]);
      }
    }
  });

  it("pools across BOTH sides — one partition per panel, not per side", () => {
    const edges = edgesOf(m001);
    const pooled = edgeWeightThresholds(edges);
    const homeOnly = edgeWeightThresholds(edges.filter((e) => e.teamId === "mexico"));
    // Not an implementation detail: two side-by-side panels on different
    // scales with no axis are unfalsifiable by eye (UX-DR23).
    expect(pooled).not.toEqual(homeOnly);
  });
});

describe("degenerate distributions never throw (Task 3.4)", () => {
  it("returns [] and stop 1 for all-equal volumes", () => {
    const edges = [edge("a", "b", 7), edge("b", "c", 7), edge("c", "a", 7)];
    const thresholds = edgeWeightThresholds(edges);
    expect(thresholds).toEqual([]);
    for (const e of edges) {
      expect(edgeStop(e.volume, thresholds)).toBe(1);
    }
    expect(quintileBands(thresholds, 7, 7)).toEqual([{ stop: 1, from: 7, to: 7 }]);
  });

  it("handles a single edge and an empty edge array", () => {
    expect(edgeWeightThresholds([edge("a", "b", 3)])).toEqual([]);
    expect(edgeWeightThresholds([])).toEqual([]);
    expect(edgeStop(3, [])).toBe(1);
    expect(quintileBands([], 0, 0)).toEqual([{ stop: 1, from: 0, to: 0 }]);
  });

  it("drops an empty band rather than labelling an impossible range", () => {
    // Ties can collapse a stop: t1 === t2 leaves band 2 with from > to.
    const bands = quintileBands([4, 4, 9, 12], 1, 18);
    expect(bands.map((band) => band.stop)).toEqual([1, 3, 4, 5]);
    for (const band of bands) {
      expect(band.from).toBeLessThanOrEqual(band.to);
    }
  });

  it("labels the five real fixture bands contiguously", () => {
    const edges = edgesOf(m001);
    const volumes = edges.map((e) => e.volume);
    const bands = quintileBands(
      edgeWeightThresholds(edges),
      Math.min(...volumes),
      Math.max(...volumes)
    );
    expect(bands).toEqual([
      { stop: 1, from: 1, to: 4 },
      { stop: 2, from: 5, to: 7 },
      { stop: 3, from: 8, to: 11 },
      { stop: 4, from: 12, to: 14 },
      // 18 is the POOLED panel max; Mexico's own side tops out at 17.
      { stop: 5, from: 15, to: 18 },
    ]);
  });

  /*
   * edgeStop and quintileBands are two INDEPENDENT implementations of one
   * partition (2.8 code review). The legend's entire value proposition is that
   * its stated ranges are the ramp's actual bands; before this, the suite
   * pinned literal band arrays and asserted only the `stop 1 <=> v <= t[0]`
   * half of the identity, so a divergence anywhere above stop 1 — an off-by-one
   * in either the band edges or the nearest-rank index — would have shipped a
   * legend that misstates its own ranges, which is exactly the failure the
   * labelled-band design was chosen to avoid.
   */
  it("agrees with edgeStop for EVERY volume in range — one partition, two implementations", () => {
    for (const { slug, bundle } of FIXTURES) {
      const edges = edgesOf(bundle);
      const thresholds = edgeWeightThresholds(edges);
      const volumes = edges.map((e) => e.volume);
      const min = Math.min(...volumes);
      const max = Math.max(...volumes);
      const bands = quintileBands(thresholds, min, max);
      // Walk past both ends: a band edge that leaks is as wrong as one that gaps.
      for (let volume = min - 1; volume <= max + 1; volume += 1) {
        const containing = bands.filter((band) => volume >= band.from && volume <= band.to);
        if (volume < min || volume > max) {
          expect(containing).toHaveLength(0);
          continue;
        }
        // Exactly one band claims it — no gaps, no overlaps.
        expect(`${slug}:${volume}:${containing.length}`).toBe(`${slug}:${volume}:1`);
        expect(`${slug}:${volume}:${containing[0].stop}`).toBe(
          `${slug}:${volume}:${edgeStop(volume, thresholds)}`
        );
      }
    }
  });

  it("agrees with edgeStop on a tie-collapsed distribution too", () => {
    // The dropped-band case: no volume may fall into a band that does not exist.
    const thresholds = [4, 4, 9, 12];
    const bands = quintileBands(thresholds, 1, 18);
    for (let volume = 1; volume <= 18; volume += 1) {
      const containing = bands.filter((band) => volume >= band.from && volume <= band.to);
      expect(containing).toHaveLength(1);
      expect(containing[0].stop).toBe(edgeStop(volume, thresholds));
    }
  });
});

describe("involvement scale (Task 3.5)", () => {
  it("stays inside [5, 10] and rises with involvement", () => {
    const domain = { min: 20, max: 92 };
    let previous = 0;
    for (let involvement = 20; involvement <= 92; involvement += 1) {
      const radius = involvementRadius(involvement, domain);
      expect(radius).toBeGreaterThanOrEqual(NODE_RADIUS_MIN_PX);
      expect(radius).toBeLessThanOrEqual(NODE_RADIUS_MAX_PX);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
    expect(involvementRadius(20, domain)).toBe(NODE_RADIUS_MIN_PX);
    expect(involvementRadius(92, domain)).toBe(NODE_RADIUS_MAX_PX);
  });

  it("is a SQRT scale — area-proportional, the correct mapping for a circle", () => {
    const domain = { min: 0, max: 100 };
    // Midpoint of the DOMAIN sits above the midpoint radius under sqrt.
    expect(involvementRadius(50, domain)).toBeGreaterThan(7.5);
    expect(involvementRadius(25, domain)).toBeCloseTo(5 + 5 * Math.sqrt(0.25), 10);
  });

  it("renders the midpoint radius for a degenerate domain and never divides by zero", () => {
    expect(involvementRadius(42, { min: 42, max: 42 })).toBe(NODE_RADIUS_MID_PX);
    expect(involvementRadius(0, { min: 0, max: 0 })).toBe(NODE_RADIUS_MID_PX);
    expect(Number.isFinite(involvementRadius(42, { min: 42, max: 42 }))).toBe(true);
  });

  it("clamps an out-of-domain or unreadable involvement to the midpoint", () => {
    expect(involvementRadius(null, { min: 1, max: 9 })).toBe(NODE_RADIUS_MID_PX);
  });

  it("pools the domain across BOTH sides", () => {
    const nodes = nodesOf(m001);
    expect(involvementDomain(nodes)).toEqual({ min: 20, max: 92 });
    expect(involvementDomain([])).toEqual({ min: 0, max: 0 });
  });

  it("NEVER recomputes node size from the edge table (ruled decision 3)", () => {
    /*
     * involvement counts every pass the player was involved in; the edge table
     * charts only the matrix's own connections. The fixtures guarantee one
     * direction only — involvement >= incident sum — and 28 of 66 nodes are
     * exactly equal while the rest exceed it, so a size derived from edges
     * would silently shrink 38 of 66 nodes.
     */
    /*
     * Widened by the 2.8 code review: this ran over m001 alone (22 of the 66
     * nodes) and ended in `toBeGreaterThan(0)` — "at least one" — while the
     * Completion Notes claimed it asserted a STRICT MAJORITY across the
     * fixtures. The claim is the true one, so the test is what moves.
     */
    let total = 0;
    let differing = 0;
    for (const { bundle } of FIXTURES) {
      const nodes = nodesOf(bundle);
      const edges = edgesOf(bundle);
      for (const n of nodes) {
        const incidentSum = edges
          .filter((e) => e.fromPlayerId === n.playerId || e.toPlayerId === n.playerId)
          .reduce((sum, e) => sum + e.volume, 0);
        expect(n.involvement).toBeGreaterThanOrEqual(incidentSum);
        total += 1;
        if (n.involvement !== incidentSum) {
          differing += 1;
        }
      }
    }
    expect(total).toBe(66);
    expect(differing).toBe(38);
    // A strict majority — deriving size from edges would shrink most nodes.
    expect(differing * 2).toBeGreaterThan(total);
  });
});

describe("passNetworkEdgeGeometry", () => {
  it.each(TEAM_INNINGS)("$slug/$teamId resolves every endpoint to a node", ({ bundle, teamId }) => {
    const nodes = nodesOf(bundle);
    const edges = edgesOf(bundle);
    const thresholds = edgeWeightThresholds(edges);
    const geometry = passNetworkEdgeGeometry(nodes, edges, teamId, thresholds);
    expect(geometry).toHaveLength(edges.filter((e) => e.teamId === teamId).length);
    for (const segment of geometry) {
      const from = nodes.find((n) => n.playerId === segment.fromPlayerId);
      const to = nodes.find((n) => n.playerId === segment.toPlayerId);
      expect(segment.x1).toBe(from?.x);
      expect(segment.y1).toBe(from?.y);
      expect(segment.x2).toBe(to?.x);
      expect(segment.y2).toBe(to?.y);
      expect(segment.stop).toBe(edgeStop(segment.volume, thresholds));
    }
    expect(new Set(geometry.map((segment) => segment.key)).size).toBe(geometry.length);
  });

  it("throws, naming the playerId and the table, on an unresolvable endpoint (Task 3.8)", () => {
    const nodes = [node({ playerId: "a" }), node({ playerId: "b" })];
    expect(() => passNetworkEdgeGeometry(nodes, [edge("a", "ghost", 3)], "home", [])).toThrow(
      /ghost/
    );
    expect(() => passNetworkEdgeGeometry(nodes, [edge("ghost", "b", 3)], "home", [])).toThrow(
      /pass-network-model/
    );
  });

  it("handles a self-edge without crashing (Task 3.8)", () => {
    const nodes = [node({ playerId: "a", x: 30, y: 40 })];
    const geometry = passNetworkEdgeGeometry(nodes, [edge("a", "a", 3)], "home", []);
    expect(geometry).toHaveLength(1);
    expect(geometry[0]).toMatchObject({ x1: 30, y1: 40, x2: 30, y2: 40 });
  });

  it("keeps BOTH halves of a reciprocal pair, at their own stops (Task 3.7)", () => {
    /*
     * The schema declares edges DIRECTED and permits both A->B and B->A; all
     * three fixtures happen to carry zero reciprocal pairs, so fixture-only
     * code passes while real 1.14 output could double-draw. Ruled: both edges
     * exist, with distinct keys — never offset, curved or arrowed, which would
     * put a second meaning on the channel the weight ramp owns.
     */
    const nodes = [node({ playerId: "a", x: 30, y: 40 }), node({ playerId: "b", x: 60, y: 70 })];
    const edges = [edge("a", "b", 2), edge("b", "a", 16), edge("a", "b", 9)];
    const thresholds = edgeWeightThresholds(edges);
    const geometry = passNetworkEdgeGeometry(nodes, edges, "home", thresholds);
    expect(geometry).toHaveLength(3);
    expect(new Set(geometry.map((segment) => segment.key)).size).toBe(3);
    const forward = geometry.find((segment) => segment.volume === 2);
    const backward = geometry.find((segment) => segment.volume === 16);
    expect(forward?.x1).toBe(30);
    expect(backward?.x1).toBe(60);
    expect(forward?.stop).not.toBe(backward?.stop);

    const { home, away } = { home: { teamId: "home", teamCode: "HOM" }, away: { teamId: "away", teamCode: "AWY" } };
    expect(passEdgeRows(edges, nodes, home, away)).toHaveLength(3);
  });
});

describe("guards added by the 2.8 code review", () => {
  const home = { teamId: "home", teamCode: "HOM" };
  const away = { teamId: "away", teamCode: "AWY" };

  it("treats nodes [] with a populated edge table as the ZERO state, never a throw", () => {
    /*
     * sectionDataState gates on `!== null` only, so `passNetworkNodes: []` with
     * a populated edge table reaches the component as "ready". Every endpoint
     * is then unresolvable, and the throw took ALL ELEVEN Tactical sections
     * down through the whole-layer error boundary. Decision 13 rules `[]` as
     * "draw the pitch plus a zero-content line".
     */
    const edges = [edge("a", "b", 3), edge("b", "a", 5)];
    expect(passNetworkEdgeGeometry([], edges, "home", [])).toEqual([]);
    expect(passEdgeRows(edges, [], home, away)).toEqual([]);
    expect(passNetworkMarkers([], edges, "home", ACCENT_A, { min: 0, max: 0 }, valuePhrase)).toEqual(
      []
    );
  });

  it("still fails loud on a dangling endpoint when the network HAS nodes", () => {
    // The zero-state guard must not swallow the real data defect.
    const nodes = [node({ playerId: "a" })];
    expect(() => passNetworkEdgeGeometry(nodes, [edge("a", "ghost", 3)], "home", [])).toThrow(
      /ghost/
    );
  });

  it("throws on a duplicate playerId rather than last-wins", () => {
    /*
     * A last-wins Map gave every edge the LAST duplicate's coordinates while
     * nodeKey(playerId) handed React two markers with the same key — one node
     * drawn, one silently dropped. The schema does not guarantee uniqueness.
     */
    const nodes = [node({ playerId: "a", x: 10 }), node({ playerId: "a", x: 90 })];
    expect(() => passNetworkEdgeGeometry(nodes, [edge("a", "a", 3)], "home", [])).toThrow(
      /duplicate playerId/
    );
    expect(() => passEdgeRows([edge("a", "a", 3)], nodes, home, away)).toThrow(/duplicate/);
  });

  it("throws when an edge's endpoints belong to a different team than the edge", () => {
    /*
     * positionOf indexes the WHOLE node set, so before this guard an edge
     * carrying team A's teamId with team B's endpoints drew a segment on team
     * A's figure using team B's coordinate frame. Two pitches are two figures,
     * never one pitch (AR-6). No fixture carries one and the schema forbids
     * none, so only a constructed case can see it.
     */
    const nodes = [
      node({ playerId: "a", teamId: "home" }),
      node({ playerId: "b", teamId: "away" }),
    ];
    expect(() => passNetworkEdgeGeometry(nodes, [edge("a", "b", 3, "home")], "home", [])).toThrow(
      /belongs to team/
    );
  });

  it("keeps an unreadable volume null instead of coercing it to 0", () => {
    /*
     * edgeWeightThresholds EXCLUDES a non-finite volume from the split, so
     * coercing it to 0 in the geometry drew an edge at a weight the legend did
     * not cover while the table read "—" for the identical row.
     */
    const nodes = [node({ playerId: "a" }), node({ playerId: "b" })];
    const broken = { teamId: "home", fromPlayerId: "a", toPlayerId: "b" } as PassNetworkEdge;
    const geometry = passNetworkEdgeGeometry(nodes, [broken], "home", [4, 7, 11, 14]);
    expect(geometry[0].volume).toBeNull();
    expect(geometry[0].stop).toBe(1);
    expect(passEdgeRows([broken], nodes, home, away)[0].volume).toBeNull();
  });
});

describe("isolation sets (Task 3.6 / 3.12)", () => {
  it("finds the degree-0 node by name: m001 mexico fidalgo-alvaro-mex (Task 3.6)", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const fidalgo = nodes.find((n) => n.playerId === "fidalgo-alvaro-mex");
    // A LARGE node — involvement 80, near the top of the 20-92 range — that
    // appears in zero edges. Its name honestly reads "0 conexiones".
    expect(fidalgo?.involvement).toBe(80);
    expect(nodeDegree(edges, "fidalgo-alvaro-mex")).toBe(0);
    expect(incidentEdgeKeys(edges, "fidalgo-alvaro-mex").size).toBe(0);
    expect(incidentPlayerIds(edges, "fidalgo-alvaro-mex").size).toBe(0);

    // Isolating it dims every other node on its side and highlights nothing.
    const dimmed = dimmedNodeKeys(nodes, edges, "mexico", "fidalgo-alvaro-mex");
    expect(dimmed.size).toBe(10);
    expect(dimmed.has("node-fidalgo-alvaro-mex")).toBe(false);
  });

  it("dims exactly the non-neighbour, non-self nodes of the isolated side", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const target = "gallardo-jesus-mex";
    const neighbours = incidentPlayerIds(edges, target);
    expect(neighbours.size).toBeGreaterThan(0);
    const dimmed = dimmedNodeKeys(nodes, edges, "mexico", target);
    const expected = nodes
      .filter((n) => n.teamId === "mexico" && n.playerId !== target && !neighbours.has(n.playerId))
      .map((n) => `node-${n.playerId}`);
    expect([...dimmed].sort()).toEqual(expected.sort());
    expect(nodeDegree(edges, target)).toBe(
      edges.filter((e) => e.fromPlayerId === target || e.toPlayerId === target).length
    );
  });

  it("never dims the OTHER figure — isolation is scoped to its own side (decision 15)", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    expect(dimmedNodeKeys(nodes, edges, "south-africa", "gallardo-jesus-mex").size).toBe(0);
    expect(dimmedNodeKeys(nodes, edges, "mexico", null).size).toBe(0);
    expect(teamIdOfPlayer(nodes, "gallardo-jesus-mex")).toBe("mexico");
    expect(teamIdOfPlayer(nodes, "nobody")).toBeNull();
  });

  it("keys incident edges by the same key the geometry emits", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const target = "gallardo-jesus-mex";
    const keys = incidentEdgeKeys(edges, target);
    const geometry = passNetworkEdgeGeometry(nodes, edges, "mexico", edgeWeightThresholds(edges));
    const incidentGeometry = geometry.filter(
      (segment) => segment.fromPlayerId === target || segment.toPlayerId === target
    );
    expect(incidentGeometry).toHaveLength(keys.size);
    for (const segment of incidentGeometry) {
      expect(keys.has(segment.key)).toBe(true);
    }
  });
});

describe("<md low-quintile hiding (Task 3.11)", () => {
  it("hides exactly the stop-1 edges and leaves the complement untouched", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const thresholds = edgeWeightThresholds(edges);
    const geometry = passNetworkEdgeGeometry(nodes, edges, "mexico", thresholds);
    const visible = visibleEdgeGeometry(geometry, thresholds, true);
    expect(visible.every((segment) => segment.stop > 1)).toBe(true);
    expect(visible).toEqual(geometry.filter((segment) => segment.stop > 1));
    expect(visible.length).toBeLessThan(geometry.length);
    expect(visibleEdgeGeometry(geometry, thresholds, false)).toEqual(geometry);
  });

  it("hides NOTHING when the quintile split is undefined — hiding 100% is not a declutter", () => {
    const nodes = [node({ playerId: "a" }), node({ playerId: "b", x: 60 })];
    const edges = [edge("a", "b", 5), edge("b", "a", 5)];
    const thresholds = edgeWeightThresholds(edges);
    expect(thresholds).toEqual([]);
    const geometry = passNetworkEdgeGeometry(nodes, edges, "home", thresholds);
    expect(visibleEdgeGeometry(geometry, thresholds, true)).toEqual(geometry);
  });
});

describe("figure counts (Task 2.10)", () => {
  it("counts the marks actually drawn, never keyStatistics", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const markers = markersFor(m001, "mexico", ACCENT_A);
    const geometry = passNetworkEdgeGeometry(nodes, edges, "mexico", edgeWeightThresholds(edges));
    expect(passNetworkFigureCounts(markers, geometry)).toEqual({ players: 11, connections: 20 });
  });

  it("reports zero for an empty side", () => {
    expect(passNetworkFigureCounts([], [])).toEqual({ players: 0, connections: 0 });
  });
});

describe("data tables (Task 2.12 / 3.9)", () => {
  const home = { teamId: "mexico", teamCode: "MEX" };
  const away = { teamId: "south-africa", teamCode: "RSA" };

  it("orders nodes by side then shirt ascending", () => {
    const rows = passNodeRows(nodesOf(m001), home, away);
    expect(rows).toHaveLength(22);
    expect(rows.slice(0, 11).every((row) => row.teamCode === "MEX")).toBe(true);
    const mexShirts = rows.slice(0, 11).map((row) => row.shirtNumber);
    expect(mexShirts).toEqual([...mexShirts].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(rows.map((row) => row.key)).size).toBe(22);
  });

  it("orders edges by side then volume descending, stably", () => {
    const rows = passEdgeRows(edgesOf(m001), nodesOf(m001), home, away);
    expect(rows).toHaveLength(53);
    const mex = rows.filter((row) => row.teamCode === "MEX");
    expect(rows.slice(0, mex.length)).toEqual(mex);
    const volumes = mex.map((row) => row.volume);
    expect(volumes).toEqual([...volumes].sort((a, b) => (b ?? 0) - (a ?? 0)));
    expect(rows[0].fromName).toBeTypeOf("string");
  });

  it("throws on an unknown teamId, via resolveSide", () => {
    const stray = [node({ playerId: "x", teamId: "atlantis" })];
    expect(() => passNodeRows(stray, home, away)).toThrow(/atlantis/);
    expect(() => passEdgeRows([edge("x", "x", 1, "atlantis")], stray, home, away)).toThrow(
      /atlantis/
    );
  });

  it("carries nulls through for unreadable fields rather than throwing (Task 2.13)", () => {
    const nodes = [
      node({
        playerId: "x",
        teamId: "mexico",
        playerName: null as unknown as string,
        shirtNumber: null as unknown as number,
        involvement: null as unknown as number,
        x: undefined as unknown as number,
      }),
    ];
    const rows = passNodeRows(nodes, home, away);
    expect(rows[0]).toMatchObject({
      playerName: null,
      shirtNumber: null,
      involvement: null,
      x: null,
    });
  });

  it("handles both tables empty", () => {
    expect(passNodeRows([], home, away)).toEqual([]);
    expect(passEdgeRows([], [], home, away)).toEqual([]);
  });
});

describe("null vs [] on both tables (Task 3.9)", () => {
  /*
   * CONSTRUCTED, not fixture-edited: no fixture exercises either branch, and
   * FR-1 fixture coverage is Story 1.18's (deferred-work.md:107).
   *
   * `null` on EITHER table means the whole section is absent — tactical-sections
   * requires both for `pass-networks`, deliberately the opposite of shot-maps'
   * `||`, and TacticalLayer renders the EmptyStatePanel above this component.
   * `[]` is a different state: the page was present and listed nothing, so the
   * pitch still draws with a zero line. `.length === 0` is NEVER the absence
   * trigger.
   */
  it("distinguishes absent from zero on each table independently", () => {
    expect(panelDataState<PassNetworkNode>(null)).toBe("absent");
    expect(panelDataState<PassNetworkEdge>(null)).toBe("absent");
    expect(panelDataState<PassNetworkNode>([])).toBe("zero");
    expect(panelDataState<PassNetworkEdge>([])).toBe("zero");
    expect(panelDataState(nodesOf(m001))).toBe("ready");
    expect(panelDataState(edgesOf(m001))).toBe("ready");
  });

  it("draws a nodeless side without throwing anywhere", () => {
    const home = { teamId: "mexico", teamCode: "MEX" };
    const away = { teamId: "south-africa", teamCode: "RSA" };
    const markers = passNetworkMarkers([], [], "mexico", ACCENT_A, involvementDomain([]), valuePhrase);
    expect(markers).toEqual([]);
    expect(passNetworkEdgeGeometry([], [], "mexico", [])).toEqual([]);
    expect(passNetworkFigureCounts(markers, [])).toEqual({ players: 0, connections: 0 });
    expect(passNodeRows([], home, away)).toEqual([]);
    // A half-empty panel keeps the other side's nodes: zero markers on one side
    // is a fact about the match, not a missing section.
    const oneSided = nodesOf(m001).filter((n) => n.teamId === "south-africa");
    expect(passNetworkMarkers(oneSided, [], "mexico", ACCENT_A, involvementDomain(oneSided), valuePhrase)).toEqual(
      []
    );
  });
});

describe("purity (Task 3.10)", () => {
  it("mutates no input", () => {
    const nodes = nodesOf(m001);
    const edges = edgesOf(m001);
    const nodesBefore = JSON.stringify(nodes);
    const edgesBefore = JSON.stringify(edges);
    const thresholds = edgeWeightThresholds(edges);
    const thresholdsBefore = JSON.stringify(thresholds);
    markersFor(m001, "mexico", ACCENT_A);
    passNetworkEdgeGeometry(nodes, edges, "mexico", thresholds);
    passNodeRows(nodes, { teamId: "mexico", teamCode: "MEX" }, { teamId: "south-africa", teamCode: "RSA" });
    passEdgeRows(
      edges,
      nodes,
      { teamId: "mexico", teamCode: "MEX" },
      { teamId: "south-africa", teamCode: "RSA" }
    );
    quintileBands(thresholds, 1, 18);
    expect(JSON.stringify(nodes)).toBe(nodesBefore);
    expect(JSON.stringify(edges)).toBe(edgesBefore);
    expect(JSON.stringify(thresholds)).toBe(thresholdsBefore);
  });
});

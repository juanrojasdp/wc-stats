import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { CrossDeliveryType, CrossEvent, MatchBundle } from "@/lib/contract/contract-types";
import {
  CROSS_COMPLETED_SHAPE,
  CROSS_DELIVERY_TYPES,
  crossCompletedEncoding,
  crossDeliveryKey,
  crossFigureCounts,
  crossLogRows,
  crossMarkers,
} from "@/viz/cross-map-model";

/*
 * Task 4.5, cross half. The defensive-field assertions here are the point of
 * this suite: CrossEvent's playerId / playerName / at / deliveryType are
 * `required` in the schema but UNFULFILLABLE from the source page — Story 1.11
 * proved the crosses section prints per-player delivery AGGREGATES with no
 * per-event rows and no ordinal glyphs, so 1.16's emission is blocked pending
 * an AD-14 decision that will likely make them nullable. The fixtures' values
 * are handcrafted samples, and the bundle reaches this code as an unvalidated
 * `as`-cast.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

const ACCENT_A = "--viz-team-a";
const ACCENT_B = "--viz-team-b";

function crossesOf(bundle: MatchBundle): CrossEvent[] {
  const crosses = bundle.events.crosses;
  if (crosses === null) {
    throw new Error(`fixture ${bundle.matchId} has no crosses`);
  }
  return crosses;
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

describe("CROSS_COMPLETED encoding (ruled decision 4: team accent, fill for completion)", () => {
  it("dual-encodes the two states by shape", () => {
    expect(CROSS_COMPLETED_SHAPE).toEqual({
      completed: "circle-filled",
      attempted: "circle-hollow",
    });
  });

  it("paints both states in the ACTING TEAM's accent, never a shot-outcome hue", () => {
    /*
     * Borrowing --shot-on-target / --shot-off-target would put one hex on two
     * meanings inside a single section where both panels are often on screen at
     * once — exactly the collision DESIGN's "hex values are unique per meaning"
     * rule exists to prevent.
     */
    const teamA = crossCompletedEncoding(ACCENT_A);
    expect(teamA.completed).toEqual({ shape: "circle-filled", colorVar: ACCENT_A });
    expect(teamA.attempted).toEqual({ shape: "circle-hollow", colorVar: ACCENT_A });
    const teamB = crossCompletedEncoding(ACCENT_B);
    expect(teamB.completed.colorVar).toBe(ACCENT_B);
    for (const encoding of [teamA, teamB]) {
      for (const state of ["completed", "attempted"] as const) {
        expect(encoding[state].colorVar.startsWith("--shot-")).toBe(false);
      }
    }
  });

  it("names all six CrossDeliveryType values", () => {
    const expected: CrossDeliveryType[] = [
      "inswing",
      "outswing",
      "driven",
      "lofted",
      "cutback",
      "push-cross",
    ];
    expect([...CROSS_DELIVERY_TYPES].sort()).toEqual([...expected].sort());
    expect(crossDeliveryKey("push-cross")).toBe("enums.crossDelivery.push-cross");
  });
});

describe("crossMarkers over the fixtures", () => {
  it("splits m001's 21 crosses by acting team and keeps coordinates verbatim", () => {
    const crosses = crossesOf(m001);
    expect(crosses).toHaveLength(21);
    const mexico = crossMarkers(crosses, "mexico", ACCENT_A);
    const southAfrica = crossMarkers(crosses, "south-africa", ACCENT_B);
    expect(mexico.length + southAfrica.length).toBe(21);

    const first = southAfrica[0];
    // The minute-6 Teboho MOKOENA attempt, verbatim from the fixture.
    expect(first.x).toBe(66.15);
    expect(first.y).toBe(8.91);
    expect(first.subjectName).toBe("Teboho MOKOENA");
    expect(first.shape).toBe("circle-hollow");
    expect(first.colorVar).toBe(ACCENT_B);
    expect(first.minuteLabel).toBe("6′");
  });

  it("orders by minute and keys markers uniquely", () => {
    const markers = crossMarkers(crossesOf(m074), "germany", ACCENT_A);
    const keys = markers.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.startsWith("cross-"))).toBe(true);
    const minutes = markers.map((m) => Number(m.minuteLabel?.replace(/\D+$/, "") ?? 0));
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });

  it("counts the figure it drew", () => {
    const markers = crossMarkers(crossesOf(m001), "mexico", ACCENT_A);
    const counts = crossFigureCounts(markers);
    expect(counts.crosses).toBe(markers.length);
    expect(counts.completed).toBe(
      crossesOf(m001).filter((c) => c.teamId === "mexico" && c.completed).length
    );
  });

  it("carries player, minute, delivery type and completion in the popover rows", () => {
    const marker = crossMarkers(crossesOf(m001), "south-africa", ACCENT_B)[0];
    expect(marker.detail.map((row) => row.labelKey)).toEqual([
      "viz.table.player",
      "viz.table.minute",
      "viz.table.delivery",
      "viz.table.completed",
    ]);
    expect(marker.detail[2].value).toEqual({ kind: "key", value: "enums.crossDelivery.driven" });
    expect(marker.detail[3].value).toEqual({ kind: "key", value: "viz.table.no" });
  });
});

describe("defensive field handling — the fields Story 1.11 proved unfulfillable", () => {
  function rogue(patch: Partial<CrossEvent>): CrossEvent {
    return { ...crossesOf(m001)[0], teamId: "mexico", ...patch };
  }

  it("renders a placeholder instead of throwing on a null deliveryType", () => {
    const marker = crossMarkers(
      [rogue({ deliveryType: null as unknown as CrossDeliveryType })],
      "mexico",
      ACCENT_A
    )[0];
    expect(marker.detail[2].value).toEqual({ kind: "key", value: "viz.table.unknown" });
  });

  it("renders a placeholder instead of throwing on a missing clock", () => {
    const marker = crossMarkers(
      [rogue({ at: undefined as unknown as CrossEvent["at"] })],
      "mexico",
      ACCENT_A
    )[0];
    expect(marker.minuteLabel).toBeNull();
    expect(marker.detail[1].value).toEqual({ kind: "key", value: "viz.table.unknown" });
  });

  it("renders a placeholder instead of throwing on a missing player name", () => {
    const marker = crossMarkers(
      [rogue({ playerName: undefined as unknown as string })],
      "mexico",
      ACCENT_A
    )[0];
    expect(marker.subjectName).toBeNull();
    expect(marker.detail[0].value).toEqual({ kind: "key", value: "viz.table.unknown" });
  });

  it("sorts clock-less crosses last rather than treating them as minute 0", () => {
    const events = [
      rogue({ at: undefined as unknown as CrossEvent["at"] }),
      rogue({ at: { minute: 70, stoppageMinute: null } }),
      rogue({ at: { minute: 5, stoppageMinute: null } }),
    ];
    const markers = crossMarkers(events, "mexico", ACCENT_A);
    expect(markers.map((m) => m.minuteLabel)).toEqual(["5′", "70′", null]);
  });

  it("keeps the log row null-defensive too", () => {
    const { home, away } = sides(m001);
    const rows = crossLogRows(
      [
        rogue({
          at: undefined as unknown as CrossEvent["at"],
          playerName: undefined as unknown as string,
          deliveryType: null as unknown as CrossDeliveryType,
        }),
      ],
      home,
      away
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].playerName).toBeNull();
    expect(rows[0].minuteLabel).toBeNull();
    expect(rows[0].deliveryKey).toBe("viz.table.unknown");
    expect(rows[0].teamCode).toBe("MEX");
  });
});

describe("crossLogRows", () => {
  it("covers both teams, ordered by minute then home before away", () => {
    const { home, away } = sides(m074);
    const rows = crossLogRows(crossesOf(m074), home, away);
    expect(rows).toHaveLength(72);
    expect(new Set(rows.map((r) => r.teamCode))).toEqual(new Set(["GER", "PAR"]));
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1];
      const current = rows[i];
      const previousClock = (previous.minute ?? Infinity) * 1000 + (previous.stoppageMinute ?? 0);
      const currentClock = (current.minute ?? Infinity) * 1000 + (current.stoppageMinute ?? 0);
      expect(previousClock).toBeLessThanOrEqual(currentClock);
    }
  });

  it("throws, naming the id, on a cross belonging to neither side (Task 8.5)", () => {
    const { home, away } = sides(m001);
    const stray: CrossEvent = { ...crossesOf(m001)[0], teamId: "atlantis" };
    expect(() => crossLogRows([stray], home, away)).toThrow(/atlantis/);
  });
});

describe("fixture reality, recorded but NOT depended upon", () => {
  it("keyStatistics[side].crosses equals the plotted cross count on all six team-innings", () => {
    // Observation only — the pipeline owns count validation, and the App must
    // not fail loud on a divergence it cannot fix. See the shot-map twin.
    for (const bundle of [m001, m002, m074]) {
      const crosses = crossesOf(bundle);
      const { home, away } = sides(bundle);
      expect(crossMarkers(crosses, home.teamId, ACCENT_A).length, `${bundle.matchId} home`).toBe(
        bundle.keyStatistics.home.crosses
      );
      expect(crossMarkers(crosses, away.teamId, ACCENT_B).length, `${bundle.matchId} away`).toBe(
        bundle.keyStatistics.away.crosses
      );
    }
  });
});

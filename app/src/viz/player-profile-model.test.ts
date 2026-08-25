import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { PlayerProfile } from "@/lib/contract/contract-types";
import {
  AGGREGATES_SECTION_ID,
  MATCHES_SECTION_ID,
  PHYSICAL_SECTION_ID,
  SPEED_ZONES,
  TRENDS_SECTION_ID,
  TREND_CHART_HEIGHT_CLASS,
  aggregateRows,
  axisFamily,
  decimalAxis,
  matchAnchorHref,
  matchRows,
  physicalModel,
  profileMetricFormat,
  speedZoneAxis,
  speedZoneChartHeightClass,
  trendAxis,
  trendSeries,
} from "@/viz/player-profile-model";

/*
 * Task 4.1. Fixtures are read with node:fs — `src/viz` is inside the
 * client-import seam, which bars `@/lib/build-data` (and the seam applies to
 * test files too, with no exemption) — the way `phases-model.test.ts` does.
 *
 * EVERY EXPECTATION IS A FIXTURE LITERAL. Building one by calling the function
 * under test "reproduces that function's bugs and can only prove it was called"
 * (the shipped suites' rule, learned the hard way). The numbers below were read
 * out of the JSON by hand.
 */

function readProfile(slug: string): PlayerProfile {
  const file = path.join(
    process.cwd(),
    "..",
    "data",
    "fixtures",
    "index",
    "player-profiles",
    `${slug}.json`
  );
  return JSON.parse(readFileSync(file, "utf8")) as PlayerProfile;
}

/** Five appearances, every section populated. */
const quinones = readProfile("quinones-julian-mex");
/** The ZERO-APPEARANCE goalkeeper: totality with empty `matches` and `points`. */
const acevedo = readProfile("acevedo-carlos-mex");

/** The eighteen codes, in the order the pipeline emits them. Hand-copied. */
const AGGREGATE_ORDER = [
  "ballProgressions",
  "crossesCompleted",
  "duelsWonAerial",
  "duelsWonPhysical",
  "goals",
  "highSpeedRuns",
  "interceptions",
  "lineBreaksCompleted",
  "passCompletion",
  "passesCompleted",
  "possessionRegains",
  "sprints",
  "stepIns",
  "switchesOfPlay",
  "tacklesWon",
  "takeOns",
  "topSpeed",
  "totalDistance",
];

/** The six trend series, in the order the pipeline emits them. Hand-copied. */
const TREND_ORDER = [
  "ballProgressions",
  "goals",
  "passCompletion",
  "passesCompleted",
  "topSpeed",
  "totalDistance",
];

const MATCH_IDS = [
  "m001-mexico-south-africa",
  "m028-mexico-korea-republic",
  "m053-czechia-mexico",
  "m079-mexico-ecuador",
  "m092-mexico-england",
];

describe("aggregateRows", () => {
  it("renders all eighteen aggregates in artifact order", () => {
    expect(aggregateRows(quinones).map((row) => row.metricCode)).toEqual(AGGREGATE_ORDER);
  });

  it("keeps the zero-appearance player's eighteen rows — totality, not a shape branch", () => {
    // Story 1.18 R2: 209 players (16.7%) carry all 18 aggregates at value 0.
    const rows = aggregateRows(acevedo);
    expect(rows.map((row) => row.metricCode)).toEqual(AGGREGATE_ORDER);
    expect(rows.every((row) => row.value === 0)).toBe(true);
  });

  it("reads values verbatim", () => {
    const byCode = new Map(aggregateRows(quinones).map((row) => [row.metricCode, row.value]));
    expect(byCode.get("ballProgressions")).toBe(9);
    expect(byCode.get("goals")).toBe(4);
    expect(byCode.get("passCompletion")).toBe(82.2);
    expect(byCode.get("passesCompleted")).toBe(111);
    expect(byCode.get("topSpeed")).toBe(33);
    expect(byCode.get("totalDistance")).toBe(47274.9);
  });

  it("keys every row uniquely", () => {
    const keys = aggregateRows(quinones).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries the contract-fixed unit, never a re-derived one", () => {
    const byCode = new Map(aggregateRows(quinones).map((row) => [row.metricCode, row.unit]));
    expect(byCode.get("totalDistance")).toBe("m");
    expect(byCode.get("topSpeed")).toBe("kmh");
    expect(byCode.get("passCompletion")).toBe("percent");
    expect(byCode.get("goals")).toBe("count");
  });

  it("does NOT project perNinety (ruled D3)", () => {
    // The field stays in the artifact; it must not reach a row model.
    expect(Object.keys(aggregateRows(quinones)[0])).not.toContain("perNinety");
  });
});

describe("profileMetricFormat", () => {
  it("prints totalDistance at 1 dp, not as an integer", () => {
    // 918 of 1,248 aggregates and 2,937 of 3,288 match rows are fractional;
    // the leaderboards' "integer" would silently round a verbatim value.
    expect(profileMetricFormat("totalDistance")).toBe("decimal1");
  });

  it("leaves every other code on the leaderboard table", () => {
    expect(profileMetricFormat("topSpeed")).toBe("decimal1");
    expect(profileMetricFormat("passCompletion")).toBe("percent");
    expect(profileMetricFormat("goals")).toBe("integer");
    expect(profileMetricFormat("passesCompleted")).toBe("integer");
  });
});

describe("physicalModel", () => {
  it("emits the five bands in zone order with their metres verbatim", () => {
    const model = physicalModel(quinones);
    expect(model.zones.map((zone) => zone.zone)).toEqual([1, 2, 3, 4, 5]);
    expect(model.zones.map((zone) => zone.metres)).toEqual([
      17458.7, 19021.8, 6575.9, 2983.3, 1235.1,
    ]);
  });

  it("carries the three tile values verbatim", () => {
    const model = physicalModel(quinones);
    expect(model.highSpeedRuns).toBe(581);
    expect(model.sprints).toBe(251);
    expect(model.topSpeed).toBe(33);
  });

  it("prints real zeros for the zero-appearance goalkeeper", () => {
    const model = physicalModel(acevedo);
    expect(model.zones.map((zone) => zone.metres)).toEqual([0, 0, 0, 0, 0]);
    expect(model.topSpeed).toBe(0);
  });

  it("exposes no zone-derived total (D7)", () => {
    // |totalDistance - sum(zones)| <= 0.35 m: close, and not the same number.
    expect(Object.keys(physicalModel(quinones))).toEqual([
      "zones",
      "highSpeedRuns",
      "sprints",
      "topSpeed",
    ]);
  });

  it("declares exactly five bands", () => {
    expect(SPEED_ZONES).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("matchRows", () => {
  it("keys each row by its matchId, in chronological artifact order", () => {
    expect(matchRows(quinones).map((row) => row.key)).toEqual(MATCH_IDS);
  });

  it("is empty — not absent — for a player with no appearances", () => {
    expect(matchRows(acevedo)).toEqual([]);
  });

  it("preserves all fifteen rendered fields of the first row verbatim", () => {
    const row = matchRows(quinones)[0];
    expect(row.stage).toBe("group");
    expect(row.date).toBe("2026-06-11");
    expect(row.opponent).toEqual({ id: "south-africa", name: "South Africa" });
    expect(row.started).toBe(true);
    expect(row.minutesPlayed).toBe(79);
    expect(row.goals).toBe(1);
    expect(row.attemptsAtGoal).toBe(5);
    expect(row.passesAttempted).toBe(34);
    expect(row.passesCompleted).toBe(28);
    expect(row.passCompletion).toBe(82);
    expect(row.ballProgressions).toBe(4);
    expect(row.duelsWonAerial).toBe(0);
    expect(row.duelsWonPhysical).toBe(0);
    expect(row.totalDistance).toBe(8832.2);
    expect(row.topSpeed).toBe(32.9);
  });

  it("throws NAMING the player and the field on a non-finite value", () => {
    const broken = {
      ...quinones,
      matches: [{ ...quinones.matches[0], totalDistance: Number.NaN }],
    } as PlayerProfile;
    expect(() => matchRows(broken)).toThrow(/quinones-julian-mex.*totalDistance/s);
  });

  it("throws on a malformed date rather than deferring it to the disclosure", () => {
    const broken = {
      ...quinones,
      matches: [{ ...quinones.matches[0], date: "2026-13-40" }],
    } as PlayerProfile;
    expect(() => matchRows(broken)).toThrow(/malformed date/);
  });

  it("normalizes the third absent state — undefined — to an empty array", () => {
    // fetchArtifact<T> ASSERTS the shape; it does not check it.
    const truncated = { ...quinones, matches: undefined } as unknown as PlayerProfile;
    expect(matchRows(truncated)).toEqual([]);
  });
});

describe("trendSeries", () => {
  it("emits the six series in artifact order", () => {
    expect(trendSeries(quinones).map((series) => series.metricCode)).toEqual(TREND_ORDER);
  });

  it("keeps all six series — empty — for the zero-appearance goalkeeper", () => {
    const series = trendSeries(acevedo);
    expect(series.map((entry) => entry.metricCode)).toEqual(TREND_ORDER);
    expect(series.every((entry) => entry.points.length === 0)).toBe(true);
  });

  it("joins every point to its match row for the date and opponent", () => {
    const topSpeed = trendSeries(quinones).find((entry) => entry.metricCode === "topSpeed");
    expect(topSpeed?.points.map((point) => point.value)).toEqual([32.9, 32.1, 32, 32.2, 33]);
    expect(topSpeed?.points.map((point) => point.date)).toEqual([
      "2026-06-11",
      "2026-06-18",
      "2026-06-24",
      "2026-06-30",
      "2026-07-05",
    ]);
    expect(topSpeed?.points[0].opponent.name).toBe("South Africa");
  });

  it("throws when a point references a match the artifact does not carry", () => {
    const broken = {
      ...quinones,
      trends: [{ metricCode: "goals", points: [{ matchId: "m999-nowhere", value: 1 }] }],
    } as unknown as PlayerProfile;
    expect(() => trendSeries(broken)).toThrow(/m999-nowhere.*absent from matches/s);
  });

  it("keys points uniquely across series", () => {
    const keys = trendSeries(quinones).flatMap((series) =>
      series.points.map((point) => point.key)
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("decimalAxis", () => {
  it("does not floor a narrow km/h band at zero", () => {
    // The whole reason the decimal family exists: countTicks would give
    // [0, 18, 36] and flatten a real 32,0-33,0 series against the plot top.
    const axis = decimalAxis([32.9, 32.1, 32, 32.2, 33], 1);
    expect(axis.min).toBeGreaterThan(0);
    expect(axis.min).toBeLessThanOrEqual(32);
    expect(axis.max).toBeGreaterThanOrEqual(33);
  });

  it("is never degenerate on an empty series", () => {
    const axis = decimalAxis([], 1);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("is never degenerate on a single point or a flat series", () => {
    for (const values of [[8832.2], [5, 5, 5], [0], [0, 0]]) {
      const axis = decimalAxis(values, 1);
      expect(axis.max).toBeGreaterThan(axis.min);
      expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
    }
  });

  /*
   * PROPERTY-TESTED on `momentumYTicks`' model, over the real corpus ranges:
   * topSpeed 15,7-37,6 km/h and totalDistance 90-16.290,4 m.
   */
  /*
   * EXPLICIT TIMEOUT, and it is a HARNESS fact rather than a slow model
   * (Story 2.19 Task 6). 117 low values x 7 spans is 819 axis constructions and
   * roughly fifteen thousand `expect` calls; the assertions themselves are the
   * cost, not `decimalAxis`. It runs in well under a second alone and
   * intermittently crossed vitest's 5 s DEFAULT under ten-worker contention on a
   * loaded desktop — a red suite that is red at random teaches everyone to
   * ignore it. Raised HERE rather than globally, on
   * `assert-schema-version.test.ts`'s established precedent: the other
   * pure-model cases keep the 5 s default, where it is a genuine signal.
   */
  it("holds its invariants across the corpus range", () => {
    for (let low = 0; low <= 16000; low += 137) {
      for (const span of [0, 0.1, 0.9, 3, 17.5, 250, 4000]) {
        const values = [low, low + span];
        const axis = decimalAxis(values, 1);
        expect(axis.max).toBeGreaterThan(axis.min);
        // The data fits inside the axis.
        expect(axis.min).toBeLessThanOrEqual(low);
        expect(axis.max).toBeGreaterThanOrEqual(low + span);
        /*
         * AND NEVER BELOW ZERO. Added at code review 2026-08-07: `min <= low`
         * alone accepted `decimalAxis([0], 1) === { min: -0.1, ticks: [-0.1, 0,
         * 0.1] }`, because -0.1 <= 0 — a labelled NEGATIVE distance or top
         * speed. Both units this generator serves are non-negative by
         * definition, so the invariant set has to say so.
         */
        expect(axis.min).toBeGreaterThanOrEqual(0);
        // The first and last ticks ARE the domain bounds — recharts drops a
        // tick that misses its own domain by a floating-point hair.
        expect(axis.ticks[0]).toBe(axis.min);
        expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
        // Uniformly spaced, strictly increasing, and a readable number of them.
        expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
        expect(axis.ticks.length).toBeLessThanOrEqual(12);
        for (let index = 1; index < axis.ticks.length; index += 1) {
          expect(axis.ticks[index]).toBeGreaterThan(axis.ticks[index - 1]);
        }
        // Every tick is printable at the metric's own precision — no 32,0333.
        for (const tick of axis.ticks) {
          expect(Math.abs(tick * 10 - Math.round(tick * 10))).toBeLessThan(1e-6);
        }
      }
    }
  }, 20_000);

  it("quantizes to two decimals when asked (kilometres)", () => {
    for (const tick of decimalAxis([1.234, 1.239], 2).ticks) {
      expect(Math.abs(tick * 100 - Math.round(tick * 100))).toBeLessThan(1e-6);
    }
  });

  /*
   * The case the invariant loop cannot reach: `span` is always paired with a
   * `low`, so a series that is flat AT ZERO — every point 0 — is its own test.
   * It is what a player with match rows but no distance in any of them would
   * emit, and it returned a negative axis minimum before the clamp.
   */
  it("never floors below zero for a flat series at zero", () => {
    const axis = decimalAxis([0, 0, 0], 1);
    expect(axis.min).toBe(0);
    expect(axis.max).toBeGreaterThan(0);
    expect(axis.ticks[0]).toBe(0);
    for (const tick of axis.ticks) {
      expect(tick).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("trendAxis", () => {
  it("floors count and percent families at zero", () => {
    expect(trendAxis("count", [1, 2, 3]).min).toBe(0);
    expect(trendAxis("percent", [82, 91]).min).toBe(0);
  });

  it("routes metres and km/h to the decimal family", () => {
    expect(axisFamily("m")).toBe("decimal");
    expect(axisFamily("kmh")).toBe("decimal");
    expect(axisFamily("km")).toBe("decimal");
    expect(axisFamily("count")).toBe("count");
    expect(axisFamily("percent")).toBe("percent");
  });

  it("always includes a zero tick on the zero-based families", () => {
    expect(trendAxis("count", [0, 0, 0]).ticks[0]).toBe(0);
    expect(trendAxis("percent", [0]).ticks[0]).toBe(0);
  });

  it("is never degenerate for the zero-appearance goalkeeper's empty series", () => {
    for (const unit of ["count", "percent", "m", "kmh"] as const) {
      const axis = trendAxis(unit, []);
      expect(axis.max).toBeGreaterThan(axis.min);
    }
  });
});

describe("speedZoneAxis", () => {
  it("is zero-based — a bar encodes its length as the value", () => {
    const axis = speedZoneAxis([17458.7, 19021.8, 6575.9, 2983.3, 1235.1]);
    expect(axis.min).toBe(0);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.max).toBeGreaterThanOrEqual(19021.8);
  });

  it("never scales [0, 0] for an all-zero keeper", () => {
    const axis = speedZoneAxis([0, 0, 0, 0, 0]);
    expect(axis.max).toBeGreaterThan(0);
  });
});

describe("chart heights", () => {
  it("returns a statically-written class Tailwind's scanner can see", () => {
    expect(speedZoneChartHeightClass(5)).toBe("h-[196px] md:h-[228px]");
    expect(TREND_CHART_HEIGHT_CLASS).toBe("h-[192px] md:h-[248px]");
  });

  it("throws on an unsupported band count rather than emitting an unknown class", () => {
    expect(() => speedZoneChartHeightClass(6 as 5)).toThrow(/unsupported band count/);
  });
});

describe("section anchors", () => {
  it("are plain ids, distinct, and never SectionId members", () => {
    const ids = [
      PHYSICAL_SECTION_ID,
      TRENDS_SECTION_ID,
      AGGREGATES_SECTION_ID,
      MATCHES_SECTION_ID,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/*
 * AC 3's DEEP LINK, pinned here because nothing else can pin it (code review
 * 2026-08-07). Task 9.1 said the static-output suite asserted the `#expert`
 * href; it never did, and it cannot — `PlayerMatchesSection` is client-rendered,
 * so the string never reaches the exported HTML. The href was therefore the one
 * load-bearing composition in the story with no regression protection at all.
 */
describe("matchAnchorHref", () => {
  /*
   * A LITERAL EXPECTATION, never one built by calling `matchHref` — "an
   * expectation built by the function under test reproduces that function's bugs
   * and can only prove it was called."
   */
  it("composes the match route with the Expert fragment", () => {
    expect(matchAnchorHref("m001")).toBe("/matches/m001/#expert");
  });

  /*
   * THE SLASH IS THE WHOLE POINT. `trailingSlash: true` rewrites a slash-less
   * href at request time and the fragment is dropped in the redirect, so
   * `/matches/m001#expert` would land on the Match Dashboard with the Expert
   * Layer closed — AC 3 failing in a way that looks like a working link.
   */
  it("keeps the trailing slash immediately before the fragment", () => {
    for (const matchId of ["m001", "m028", "m053", "m079", "m092"]) {
      const href = matchAnchorHref(matchId);
      expect(href.endsWith("/#expert"), href).toBe(true);
      expect(href).not.toContain("#expert-");
    }
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle, PlayerProfile, TeamProfile } from "@/lib/contract/contract-types";
import {
  COMPARE_CHARTS_SECTION_ID,
  COMPARE_STATS_SECTION_ID,
  MATCH_CHART_FIELDS,
  TEAM_COMPARE_FIELDS,
  compareBarChartHeightClass,
  matchChartModel,
  matchCompareRows,
  playerChartModel,
  playerCompareRows,
  teamChartModel,
  teamCompareRows,
} from "@/viz/compare-model";

/*
 * Story 2.17 Task 5.1/5.3. Fixtures are read with `node:fs` — `src/viz` is inside
 * the client-import seam, which bars `@/lib/build-data`, and that seam applies to
 * test files too with NO exemption — the way `player-profile-model.test.ts` and
 * `phases-model.test.ts` both do.
 *
 * 🔴 EVERY EXPECTATION IS A FIXTURE LITERAL, hand-copied out of the JSON. "An
 * expectation built by the function under test reproduces that function's bugs
 * and can only prove it was called." Nothing below calls a model function to
 * produce a number it then asserts.
 *
 * ═══════ WHAT THIS SUITE IS ACTUALLY GUARDING ═══════
 *
 * Two properties, and they are the two the whole route stands on:
 *
 *  1. THE SHARED DOMAIN IS GENUINELY SHARED. Side A's axis and side B's axis are
 *     `toEqual` — one object, one domain, both charts. That is the licensed
 *     derivation AD-5 names, and a per-side axis would silently make two charts
 *     that look comparable and are not.
 *  2. NO CROSS-ENTITY NUMBER IS EVER PRODUCED. Every row's `a` and `b` are the
 *     ARTIFACTS' OWN values, byte-for-byte; the only thing the model adds is a
 *     three-valued `leader`. There is no field on `CompareRow` that could hold a
 *     delta, and these tests pin the values so one could not be smuggled in.
 */

const FIXTURES = path.join(process.cwd(), "..", "data", "fixtures");

function readPlayer(slug: string): PlayerProfile {
  return JSON.parse(
    readFileSync(path.join(FIXTURES, "index", "player-profiles", `${slug}.json`), "utf8")
  ) as PlayerProfile;
}

function readTeam(slug: string): TeamProfile {
  return JSON.parse(
    readFileSync(path.join(FIXTURES, "index", "team-profiles", `${slug}.json`), "utf8")
  ) as TeamProfile;
}

function readMatch(slug: string): MatchBundle {
  return JSON.parse(
    readFileSync(path.join(FIXTURES, "matches", `${slug}.json`), "utf8")
  ) as MatchBundle;
}

/** Five appearances, every block populated. */
const quinones = readPlayer("quinones-julian-mex");
/**
 * THE ZERO-APPEARANCE GOALKEEPER, and he is the most valuable fixture on this
 * route. His `physical` block is all zeros, so a comparison against him is the
 * degenerate case that would ask recharts to scale `[0, 0]` — 209 corpus players
 * are in the same position, which makes it the common comparison rather than an
 * edge one.
 */
const acevedo = readPlayer("acevedo-carlos-mex");

const mexico = readTeam("mexico");

const m001 = readMatch("m001-mexico-south-africa");
const m074 = readMatch("m074-germany-paraguay");

describe("playerCompareRows (Story 2.17, AC 3)", () => {
  it("pairs the eighteen aggregates by metric code, in side A's artifact order", () => {
    const rows = playerCompareRows(quinones, acevedo);
    expect(rows).toHaveLength(18);
    // The pipeline's emission order, alphabetical by CODE. Hand-copied.
    expect(rows.slice(0, 4).map((row) => row.key)).toEqual([
      "player-ballProgressions",
      "player-crossesCompleted",
      "player-duelsWonAerial",
      "player-duelsWonPhysical",
    ]);
  });

  it("carries both sides' values VERBATIM and derives nothing across them", () => {
    const rows = playerCompareRows(quinones, acevedo);
    const goals = rows.find((row) => row.key === "player-goals");
    // quinones.aggregates goals = 4; acevedo = 0. Both read out of the JSON.
    expect(goals?.a).toBe(4);
    expect(goals?.b).toBe(0);
    /*
     * THE WHOLE ANTI-DERIVATION PROPERTY, pinned. If a delta ever appeared it
     * would have to live on this object, and this asserts the object's exact
     * shape.
     */
    expect(Object.keys(goals ?? {}).sort()).toEqual([
      "a",
      "b",
      "format",
      "key",
      "labelKey",
      "leader",
      "unit",
    ]);
  });

  it("resolves the leader, and gives an equal pair NO marks", () => {
    const rows = playerCompareRows(quinones, acevedo);
    // 4 vs 0 → side A leads. `resolveLeader`'s union: "home" IS side A here.
    expect(rows.find((row) => row.key === "player-goals")?.leader).toBe("home");
    // duelsWonPhysical is 0 on BOTH fixtures — a genuine tie, not a contrivance.
    expect(rows.find((row) => row.key === "player-duelsWonPhysical")?.leader).toBe("tie");
  });

  it("keeps `totalDistance`'s profile precision override rather than re-deriving it", () => {
    const rows = playerCompareRows(quinones, acevedo);
    // 2.15's one override: the leaderboards artifact says "integer", a profile
    // says decimal1, and 918 of 1,248 real aggregates are fractional.
    expect(rows.find((row) => row.key === "player-totalDistance")?.format).toBe("decimal1");
  });
});

describe("playerChartModel — the shared speed-zone domain (AC 4)", () => {
  it("reads both players' five bands verbatim", () => {
    const model = playerChartModel(quinones, acevedo);
    // quinones.physical.distanceZone1..5, hand-copied from the fixture.
    expect(model.a).toEqual([17458.7, 19021.8, 6575.9, 2983.3, 1235.1]);
    // The zero-appearance goalkeeper.
    expect(model.b).toEqual([0, 0, 0, 0, 0]);
    expect(model.zones).toEqual([1, 2, 3, 4, 5]);
  });

  it("gives BOTH sides one domain — the licensed derivation, and the same object", () => {
    const model = playerChartModel(quinones, acevedo);
    /*
     * There is ONE axis on the model by construction, which is the strongest
     * form of "identical scales": the two charts cannot disagree because there is
     * nothing for them to disagree about. Swapping the arguments must not change
     * it either — the domain is a property of the PAIR, not of the order.
     */
    const swapped = playerChartModel(acevedo, quinones);
    expect(swapped.axis).toEqual(model.axis);
  });

  it("is never degenerate, even when BOTH sides are all zeros", () => {
    /*
     * recharts cannot scale `[n, n]` — every mark resolves to the same or a NaN
     * coordinate. Two zero-appearance players is a real comparison (209 of them
     * corpus-wide), so this is the common case rather than the edge.
     */
    const model = playerChartModel(acevedo, acevedo);
    expect(model.axis.min).toBe(0);
    expect(model.axis.max).toBeGreaterThan(0);
    expect(model.axis.ticks.length).toBeGreaterThan(1);
  });
});

describe("teamCompareRows (AC 3)", () => {
  it("reads the ten scalars off the artifact and mints no label key", () => {
    expect(TEAM_COMPARE_FIELDS).toHaveLength(10);
    /*
     * EVERY KEY ALREADY SHIPS. `hub.standings.columnTitle.*` are the FULL terms
     * behind the standings table's abbreviated heads; the two tactical scalars
     * take 2.16's own Hero keys. A `compare.*` key here would be a second home
     * for a term that already has one.
     */
    expect(TEAM_COMPARE_FIELDS.map((field) => field.labelKey)).toEqual([
      "hub.standings.columnTitle.played",
      "hub.standings.columnTitle.won",
      "hub.standings.columnTitle.drawn",
      "hub.standings.columnTitle.lost",
      "hub.standings.columnTitle.goalsFor",
      "hub.standings.columnTitle.goalsAgainst",
      "hub.standings.columnTitle.goalDifference",
      "hub.standings.columnTitle.points",
      "team.tile.possession",
      "team.tile.pressingIntensity",
    ]);
  });

  it("carries Mexico's record verbatim on both sides of a self-comparison", () => {
    const rows = teamCompareRows(mexico, mexico);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    // Hand-copied from `team-profiles/mexico.json`.
    expect(byKey.get("team-played")?.a).toBe(5);
    expect(byKey.get("team-won")?.a).toBe(4);
    expect(byKey.get("team-goalDifference")?.a).toBe(7);
    expect(byKey.get("team-points")?.a).toBe(9);
    expect(byKey.get("team-possession")?.a).toBe(48.2);
    expect(byKey.get("team-pressingIntensity")?.a).toBe(213);
    // Every row of a self-comparison ties, and a tie gets no marks.
    expect(rows.every((row) => row.leader === "tie")).toBe(true);
  });

  /*
   * 🔴 THE ONLY TEAM FIXTURE IS MEXICO, WHICH IS WHY THE BUG SURVIVED. Every
   * team assertion above compares Mexico with ITSELF, so every row ties, and
   * `rows.every(leader === "tie")` was green no matter what `teamCompareRows`
   * decided about direction. A self-comparison cannot see a comparator at all.
   *
   * Synthesised by spread, on the pattern the non-finite test one block below
   * already uses. RIVAL IS DELIBERATELY WORSE ON THE LOWER-IS-BETTER METRICS and
   * better on nothing: it concedes five more goals and loses two more matches, so
   * a model that feeds `resolveLeader` raw hands it the accent, the ▲ and the
   * `sr-only` «líder» on both rows.
   */
  const rival = {
    ...mexico,
    teamId: "rival",
    record: {
      ...mexico.record,
      won: mexico.record.won - 1,
      drawn: mexico.record.drawn + 1,
      lost: mexico.record.lost + 2,
      goalsAgainst: mexico.record.goalsAgainst + 5,
      // Both are CONTRACT fields the model reads rather than derives, so they are
      // moved explicitly: leaving them at Mexico's values would tie two
      // higher-is-better rows and quietly narrow what this test covers.
      goalDifference: mexico.record.goalDifference - 5,
      points: mexico.record.points - 2,
    },
    tacticalIdentity: {
      ...mexico.tacticalIdentity,
      pressingIntensity: mexico.tacticalIdentity.pressingIntensity + 50,
    },
  } as TeamProfile;

  it("resolves each leader THROUGH the metric's direction, never on the raw value", () => {
    const byKey = new Map(teamCompareRows(mexico, rival).map((row) => [row.key, row]));

    /*
     * LOWER IS BETTER, so Mexico leads by conceding and losing FEWER. Both of
     * these read "away" — the worse team — without the direction field.
     */
    expect(byKey.get("team-lost")?.leader, "conceding more matches must not lead").toBe("home");
    expect(byKey.get("team-goalsAgainst")?.leader, "conceding more goals must not lead").toBe(
      "home"
    );

    // HIGHER IS BETTER, unchanged: the direction routes rather than inverts.
    expect(byKey.get("team-won")?.leader).toBe("home");
    expect(byKey.get("team-points")?.leader).toBe("home");
    expect(byKey.get("team-goalDifference")?.leader).toBe("home");
    // Untouched on the rival, so it ties — a tie gets no marks either way.
    expect(byKey.get("team-goalsFor")?.leader).toBe("tie");

    /*
     * NO DIRECTION AT ALL. A draw is not a win and not a loss; pressing harder is
     * a style, not an achievement — 2.16's Hero prints it as a descriptive mean.
     * The route may not assert a leader that does not exist, so these tie on
     * UNEQUAL values, which is the case a self-comparison can never produce.
     */
    expect(byKey.get("team-drawn")?.a).not.toBe(byKey.get("team-drawn")?.b);
    expect(byKey.get("team-drawn")?.leader).toBe("tie");
    expect(byKey.get("team-pressingIntensity")?.a).not.toBe(
      byKey.get("team-pressingIntensity")?.b
    );
    expect(byKey.get("team-pressingIntensity")?.leader).toBe("tie");
    expect(byKey.get("team-played")?.leader).toBe("tie");
  });

  it("declares a direction on every one of the ten fields", () => {
    // There is no default: a new metric that forgets one is a compile error, and
    // this pins that none of the ten drifted to a direction it does not have.
    for (const field of TEAM_COMPARE_FIELDS) {
      expect(["higher", "lower", "none"], field.key).toContain(field.direction);
    }
    const byKey = new Map(TEAM_COMPARE_FIELDS.map((field) => [field.key, field.direction]));
    expect(byKey.get("lost")).toBe("lower");
    expect(byKey.get("goalsAgainst")).toBe("lower");
    expect(byKey.get("drawn")).toBe("none");
    expect(byKey.get("pressingIntensity")).toBe("none");
    expect(byKey.get("played")).toBe("none");
  });

  it("does NOT subtract goalsFor − goalsAgainst for the difference", () => {
    /*
     * `goalDifference` ships PRECOMPUTED (`TeamTournamentRecord`), and computing
     * it here would be the first banned derivation in a model whose subject is
     * not performing them. Mexico's 10 − 3 happens to be 7, so this asserts the
     * FIELD is read rather than the arithmetic agreeing.
     */
    const field = TEAM_COMPARE_FIELDS.find((entry) => entry.key === "goalDifference");
    expect(field?.path).toBe("record.goalDifference");
  });

  it("throws NAMING the team on a non-finite scalar", () => {
    const broken = {
      ...mexico,
      record: { ...mexico.record, points: Number.NaN },
    } as TeamProfile;
    expect(() => teamCompareRows(broken, mexico)).toThrow(/mexico/);
    expect(() => teamCompareRows(broken, mexico)).toThrow(/record\.points/);
  });
});

describe("teamChartModel — the shared phase-rate domain (AC 4)", () => {
  it("reads the eight in-possession rates in the schema's frozen order", () => {
    const model = teamChartModel(mexico, mexico);
    // `phasesInPossession`, in `IN_POSSESSION_PHASES` order. Hand-copied.
    expect(model.a).toEqual([38.0, 13.4, 17.4, 16.0, 4.4, 12.4, 1.2, 6.2]);
    expect(model.a).toEqual(model.b);
    expect(model.phaseLabelKeys).toHaveLength(8);
  });

  it("floors the axis so the domain can never be [0, 0]", () => {
    const model = teamChartModel(mexico, mexico);
    expect(model.axis.min).toBe(0);
    // Peak is 38.0; `percentAxisMax` nices it up. Never below the peak.
    expect(model.axis.max).toBeGreaterThanOrEqual(38);
    expect(model.axis.ticks[0]).toBe(0);
  });

  /*
   * 🔴 AC 4's ACTUAL CLAIM — "vizzes render per entity with IDENTICAL SCALES" —
   * is unfalsifiable against a team compared with itself, where one peak is
   * trivially both peaks. The one licensed cross-entity derivation on this route
   * is that shared maximum, so it needs two different series to mean anything.
   */
  it("spans BOTH teams with one domain when the peaks differ", () => {
    const spiky = {
      ...mexico,
      teamId: "spiky",
      tacticalIdentity: {
        ...mexico.tacticalIdentity,
        phasesInPossession: {
          ...mexico.tacticalIdentity.phasesInPossession,
          // Mexico's own peak is 38.0 (build-up-unopposed); this clears it.
          progression: 91.5,
        },
      },
    } as TeamProfile;

    const model = teamChartModel(mexico, spiky);
    expect(model.a).not.toEqual(model.b);
    // The domain is driven by the LARGER side and still covers the smaller one.
    expect(model.axis.max).toBeGreaterThanOrEqual(91.5);
    expect(Math.max(...model.a)).toBeLessThanOrEqual(model.axis.max);
    expect(Math.max(...model.b)).toBeLessThanOrEqual(model.axis.max);
    // One axis object serves both sides — there is no per-side domain to diverge.
    expect(teamChartModel(spiky, mexico).axis.max).toBe(model.axis.max);
  });
});

describe("matchCompareRows — R1(A)'s within-side block (AC 3)", () => {
  it("mirrors HOME against AWAY inside one match, not one match against another", () => {
    const rows = matchCompareRows(m001);
    expect(rows).toHaveLength(19);
    const possession = rows.find((row) => row.key === "match-possession");
    // m001 keyStatistics.possession — home 57.1, away 36.1. Hand-copied.
    expect(possession?.a).toBe(57.1);
    expect(possession?.b).toBe(36.1);
    expect(possession?.leader).toBe("home");
    expect(possession?.format).toBe("percent");
  });

  it("labels through the SEALED `enums.metric.*` namespace", () => {
    const rows = matchCompareRows(m001);
    expect(rows[0]?.labelKey).toBe("enums.metric.possession");
    // The two distance rows are the only ones carrying a unit.
    expect(rows.find((row) => row.key === "match-distanceCovered")?.unit).toBe("km");
    expect(rows.find((row) => row.key === "match-shots")?.unit).toBeNull();
  });
});

describe("matchChartModel — one domain across FOUR series (AC 4)", () => {
  it("plots one unit family only", () => {
    /*
     * A single domain over four series is honest only if every series is the same
     * KIND of quantity. `KEY_STAT_FORMAT` puts exactly two fields in the percent
     * family and seventeen in the count family; mixing a 90 % completion with a
     * 344-count tally would compress every count into the axis floor.
     */
    expect(MATCH_CHART_FIELDS).toEqual([
      "shots",
      "shotsOnTarget",
      "crosses",
      "defensiveLineBreaks",
    ]);
  });

  it("reads all four series verbatim and shares one axis between the matches", () => {
    const model = matchChartModel(m001, m074);
    // m001: shots 16/3, shotsOnTarget 4/2, crosses 13/8, defensiveLineBreaks 10/3.
    expect(model.aHome).toEqual([16, 4, 13, 10]);
    expect(model.aAway).toEqual([3, 2, 8, 3]);
    // m074: shots 21/7, shotsOnTarget 6/3, crosses 52/20, defensiveLineBreaks 10/6.
    expect(model.bHome).toEqual([21, 6, 52, 10]);
    expect(model.bAway).toEqual([7, 3, 20, 6]);
    /*
     * THE DOMAIN SPANS THE HIGHEST OF ALL FOUR — m074's 52 crosses — so m001's
     * block is drawn against m074's scale and the two are readable together.
     * Reading it off m001 alone would put its 16-shot bar at full width beside
     * m074's 21, which is the "mismatched axes" failure the spine's M2 names.
     */
    expect(model.axis.max).toBeGreaterThanOrEqual(52);
    expect(model.axis.min).toBe(0);
  });

  it("gives the same domain whichever match is on which side", () => {
    expect(matchChartModel(m074, m001).axis).toEqual(matchChartModel(m001, m074).axis);
  });

  it("fits `distributionChartHeightClass`'s closed 3 | 4 | 8 | 9 parameter", () => {
    // Five categories would be a COMPILE error there and a runtime throw past it.
    expect(MATCH_CHART_FIELDS).toHaveLength(4);
  });
});

describe("chart heights and anchors", () => {
  it("returns literal classes Tailwind's scanner can see, never arithmetic", () => {
    expect(compareBarChartHeightClass(5)).toBe("h-[196px] md:h-[228px]");
    expect(compareBarChartHeightClass(8)).toBe("h-[302px] md:h-[348px]");
  });

  it("throws on an unsupported category count rather than returning nothing", () => {
    // Cast past the closed union the way a future caller's bug would.
    expect(() => compareBarChartHeightClass(6 as 5)).toThrow(/compare bar category count/);
  });

  it("uses stable ENGLISH anchor ids and does not widen SectionId", () => {
    expect(COMPARE_STATS_SECTION_ID).toBe("stats");
    expect(COMPARE_CHARTS_SECTION_ID).toBe("charts");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { TeamProfile } from "@/lib/contract/contract-types";
import {
  FORMATIONS_SECTION_ID,
  IDENTITY_SECTION_ID,
  IN_POSSESSION_SHAPE_PANELS,
  OUT_OF_POSSESSION_SHAPE_PANELS,
  SHAPE_MEASURES,
  TEAM_MATCHES_SECTION_ID,
  formResults,
  formationRows,
  identityCharts,
  inPossessionShapePanelKey,
  outOfPossessionShapePanelKey,
  shapeMeasureKey,
  shapeTables,
  teamMatchRows,
} from "@/viz/team-profile-model";

/*
 * Task 4.1. Fixtures are read with node:fs — `src/viz` is inside the
 * client-import seam, which bars `@/lib/build-data` (and the seam applies to
 * test files too, with no exemption) — the way `phases-model.test.ts` and
 * `player-profile-model.test.ts` do.
 *
 * EVERY EXPECTATION IS A FIXTURE LITERAL, READ OUT OF THE JSON BY HAND. Building
 * one by calling the function under test "reproduces that function's bugs and can
 * only prove it was called" — Story 1.17's precision gate was grading itself and
 * 41 tests stayed green while 553 leaves shipped truncated.
 *
 * WHERE A FIXTURE FACT WOULD BE BRITTLE, THE BEHAVIOUR IS PINNED INSTEAD. Story
 * 2.13 shipped a hardcoded rank literal that broke on the next regeneration;
 * rewritten as a property it survived. So counts and orderings are asserted as
 * properties of the artifact, and only genuinely contracted values are literals.
 */

function readTeamProfile(slug: string): TeamProfile {
  const file = path.join(
    process.cwd(),
    "..",
    "data",
    "fixtures",
    "index",
    "team-profiles",
    `${slug}.json`
  );
  return JSON.parse(readFileSync(file, "utf8")) as TeamProfile;
}

const MEXICO = readTeamProfile("mexico");

describe("team-profile-model — section anchors", () => {
  /*
   * The anchors are STABLE ENGLISH IDS and are deep-link targets (UX-DR18), so
   * they are part of the route's contract with anything that links into it.
   */
  it("keeps the three section anchors stable and English", () => {
    expect(IDENTITY_SECTION_ID).toBe("tactical-identity");
    expect(FORMATIONS_SECTION_ID).toBe("formations");
    expect(TEAM_MATCHES_SECTION_ID).toBe("matches");
  });
});

describe("team-profile-model — identityCharts (AC 1, AC 2)", () => {
  const charts = identityCharts(MEXICO);

  it("emits the four rate charts at 8 / 9 / 3 / 4 categories", () => {
    // The counts distributionChartHeightClass accepts, and the reason D13 makes
    // shapeByPhase a table: a 6-category chart would throw there.
    expect(charts.inPossession.categoryCount).toBe(8);
    expect(charts.outOfPossession.categoryCount).toBe(9);
    expect(charts.blocks.categoryCount).toBe(3);
    expect(charts.press.categoryCount).toBe(4);
    expect(charts.inPossession.rows).toHaveLength(8);
    expect(charts.outOfPossession.rows).toHaveLength(9);
    expect(charts.blocks.rows).toHaveLength(3);
    expect(charts.press.rows).toHaveLength(4);
  });

  it("reads the eight in-possession rates VERBATIM, in the frozen enum order", () => {
    // Literals from data/fixtures/index/team-profiles/mexico.json, in
    // IN_POSSESSION_PHASES order (schema declaration order), NOT JSON key order.
    expect(charts.inPossession.rows.map((row) => row.value)).toEqual([
      38.0, // build-up-unopposed
      13.4, // build-up-opposed
      17.4, // progression
      16.0, // final-third
      4.4, // long-ball
      12.4, // attacking-transition
      1.2, // counter-attack
      6.2, // set-piece
    ]);
  });

  it("reads the nine out-of-possession rates VERBATIM, zero included", () => {
    /*
     * `lowPress` IS 0.0 AND PRINTS AS A MEASUREMENT (D9). ExpertLayer's ruling
     * is binding here: "NO PRESENCE GATE AND NO EM DASH, ever … a zero is a
     * real, dense measurement". A model that dropped or nulled it would be
     * branching on shape, and there is no null on this artifact to branch on.
     */
    expect(charts.outOfPossession.rows.map((row) => row.value)).toEqual([
      5.4, // high-press
      3.6, // mid-press
      0.0, // low-press  <- a measurement, not an absence
      4.0, // high-block
      23.2, // mid-block
      19.2, // low-block
      5.2, // recovery
      11.4, // defensive-transition
      8.4, // counter-press
    ]);
    expect(charts.outOfPossession.rows[2].value).toBe(0);
  });

  it("reads the three block levels high -> mid -> low, verbatim", () => {
    expect(charts.blocks.rows.map((row) => row.code)).toEqual(["high", "mid", "low"]);
    expect(charts.blocks.rows.map((row) => row.value)).toEqual([4.0, 23.2, 19.2]);
  });

  it("takes the four press rates as a frozen subset of the nine", () => {
    expect(charts.press.rows.map((row) => row.code)).toEqual([
      "high-press",
      "mid-press",
      "low-press",
      "counter-press",
    ]);
    expect(charts.press.rows.map((row) => row.value)).toEqual([5.4, 3.6, 0.0, 8.4]);
  });

  /*
   * D11, AND IT IS THE POINT OF THE STORY'S 6.1a. Seven of the nine
   * out-of-possession rates REPEAT across the three out-of-possession
   * presentations. The duplication is deliberate and inherited; this test exists
   * so a future reader who "fixes" it by deduping gets a red suite naming the
   * ruling instead of a silent behaviour change.
   */
  it("REPEATS the shared out-of-possession values across press and blocks (D11)", () => {
    const byCode = new Map(charts.outOfPossession.rows.map((row) => [row.code, row.value]));
    for (const row of charts.press.rows) {
      expect(byCode.get(row.code), `press ${row.code}`).toBe(row.value);
    }
    // The block levels read the SAME contract fields under different enum
    // values: defensiveBlockDistribution.high === phasesOutOfPossession.highBlock.
    expect(charts.blocks.rows[0].value).toBe(byCode.get("high-block"));
    expect(charts.blocks.rows[1].value).toBe(byCode.get("mid-block"));
    expect(charts.blocks.rows[2].value).toBe(byCode.get("low-block"));
  });

  it("gives every chart an explicit zero-based axis that contains its peak", () => {
    /*
     * NEVER LEFT TO RECHARTS (its generator emitted `+17, +1, -8, -17` on m074:
     * four ticks, unevenly spaced, no zero). A bar encodes its LENGTH as the
     * value, so the baseline must be zero and the domain must cover the data.
     */
    for (const [name, chart] of Object.entries(charts)) {
      const peak = Math.max(...chart.rows.map((row) => row.value));
      expect(chart.ticks[0], name).toBe(0);
      expect(chart.axisMax, name).toBeGreaterThanOrEqual(peak);
      expect(chart.ticks[chart.ticks.length - 1], name).toBe(chart.axisMax);
      expect(chart.heightClass, name).toMatch(/^h-\[\d+px\] md:h-\[\d+px\]$/);
    }
  });

  it("keeps every row key unique across all four charts (React key safety)", () => {
    const keys = [
      ...charts.inPossession.rows,
      ...charts.outOfPossession.rows,
      ...charts.blocks.rows,
      ...charts.press.rows,
    ].map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("throws NAMING the team and the field on a non-finite leaf", () => {
    const broken = JSON.parse(JSON.stringify(MEXICO)) as TeamProfile;
    // @ts-expect-error — deliberately breaking a contracted non-nullable leaf.
    broken.tacticalIdentity.phasesInPossession.progression = null;
    expect(() => identityCharts(broken)).toThrow(/mexico/);
    expect(() => identityCharts(broken)).toThrow(/progression/);
  });
});

describe("team-profile-model — shapeTables (D13, R1)", () => {
  const tables = shapeTables(MEXICO);

  it("frozen panel and measure lists match the contract exactly", () => {
    expect([...IN_POSSESSION_SHAPE_PANELS]).toEqual([
      "buildUpLow",
      "buildUpMid",
      "finalThirdPhase",
    ]);
    expect([...OUT_OF_POSSESSION_SHAPE_PANELS]).toEqual([
      "highBlockPress",
      "midBlock",
      "lowBlock",
    ]);
    expect([...SHAPE_MEASURES]).toEqual(["lineHeight", "teamLength", "teamWidth"]);
  });

  it("emits 2 states x 3 panels x 3 measures = the artifact's 18 values verbatim", () => {
    // Fixture literals, panel order = schema declaration order.
    expect(
      tables.inPossession.map((row) => [row.lineHeight, row.teamLength, row.teamWidth])
    ).toEqual([
      [19.4, 40.6, 53.4], // buildUpLow
      [41.8, 32.2, 53.6], // buildUpMid
      [56.6, 33.4, 44.6], // finalThirdPhase
    ]);
    expect(
      tables.outOfPossession.map((row) => [row.lineHeight, row.teamLength, row.teamWidth])
    ).toEqual([
      [47.8, 36.8, 41.4], // highBlockPress
      [37.8, 27.2, 40.8], // midBlock
      [18.6, 24.2, 35.8], // lowBlock
    ]);
  });

  it("keys rows by panel, never by index, and never collides across states", () => {
    const keys = [...tables.inPossession, ...tables.outOfPossession].map((row) => row.key);
    expect(new Set(keys).size).toBe(6);
    // `midBlock` and `lowBlock` are panel names in BOTH the out-of-possession
    // panel list and the block-level enum; the state prefix is what keeps the
    // two tables' keys apart.
    expect(tables.outOfPossession.map((row) => row.key)).toEqual([
      "outOfPossession-highBlockPress",
      "outOfPossession-midBlock",
      "outOfPossession-lowBlock",
    ]);
  });

  it("builds the minted vocabulary keys under the team namespace", () => {
    expect(shapeMeasureKey("teamWidth")).toBe("team.shape.measure.teamWidth");
    expect(inPossessionShapePanelKey("buildUpLow")).toBe("team.shape.inPossession.buildUpLow");
    expect(outOfPossessionShapePanelKey("highBlockPress")).toBe(
      "team.shape.outOfPossession.highBlockPress"
    );
  });

  it("labels every panel through a key builder, never a bare string", () => {
    for (const row of tables.inPossession) {
      expect(row.labelKey).toBe(`team.shape.inPossession.${row.panel}`);
    }
    for (const row of tables.outOfPossession) {
      expect(row.labelKey).toBe(`team.shape.outOfPossession.${row.panel}`);
    }
  });
});

describe("team-profile-model — formationRows (AC 1)", () => {
  it("preserves the artifact's descending-match-count order verbatim", () => {
    const rows = formationRows(MEXICO);
    /*
     * THE ORDER IS CONTRACTED ("ordered by descending match count"), so this is
     * a PROPERTY rather than a fixture literal — the fixture ships one row today
     * and the real corpus ships up to four.
     */
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(4);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index - 1].matches).toBeGreaterThanOrEqual(rows[index].matches);
    }
    expect(rows.map((row) => row.formation)).toEqual(
      MEXICO.formationUsage.map((row) => row.formation)
    );
  });

  it("keys by the formation notation and never translates it", () => {
    const rows = formationRows(MEXICO);
    expect(rows[0].key).toBe(rows[0].formation);
    expect(rows[0].formation).toMatch(/^[0-9]+(-[0-9]+)+$/);
  });
});

describe("team-profile-model — teamMatchRows (AC 1)", () => {
  const rows = teamMatchRows(MEXICO);

  it("preserves the artifact's chronological order", () => {
    // A property, not a literal: `matches[]` runs 3–16 rows across the corpus.
    expect(rows.length).toBe(MEXICO.matches.length);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index - 1].date <= rows[index].date).toBe(true);
    }
  });

  it("carries the full breakdown for the first match verbatim", () => {
    // Fixture literals from m001-mexico-south-africa.
    expect(rows[0]).toMatchObject({
      matchId: "m001-mexico-south-africa",
      stage: "group",
      date: "2026-06-11",
      isHome: true,
      result: "win",
      goalsFor: 2,
      goalsAgainst: 0,
      formation: "4-1-2-3",
      possession: 57.1,
      expectedGoals: 1.78,
      shots: 16,
      shotsOnTarget: 4,
      passCompletion: 90.0,
      distanceCovered: 107.3,
    });
    expect(rows[0].opponent).toEqual({ id: "south-africa", name: "South Africa" });
  });

  it("keys rows by matchId — the route slug, never an index", () => {
    expect(rows.map((row) => row.key)).toEqual(rows.map((row) => row.matchId));
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it("keeps distanceCovered in KILOMETRES, never the player profile's metres", () => {
    /*
     * A PROPERTY, and the boundary Story 1.10 rules must never be crossed. A
     * team's match distance is ~100–120 km; a player's is ~10,000 m. If this
     * ever reads in the thousands, a metres field has leaked in.
     */
    for (const row of rows) {
      expect(row.distanceCovered, row.matchId).toBeGreaterThan(50);
      expect(row.distanceCovered, row.matchId).toBeLessThan(200);
    }
  });

  it("rejects a malformed date rather than handing it to the format layer", () => {
    const broken = JSON.parse(JSON.stringify(MEXICO)) as TeamProfile;
    broken.matches[0].date = "11/06/2026";
    expect(() => teamMatchRows(broken)).toThrow(/mexico/);
    expect(() => teamMatchRows(broken)).toThrow(/date/);
  });
});

describe("team-profile-model — formResults (D3)", () => {
  it("projects matches[].result in artifact order, one letter per match", () => {
    const results = formResults(MEXICO);
    // Fixture literal: four wins then the r16 loss to England.
    expect(results).toEqual(["win", "win", "win", "win", "loss"]);
    expect(results).toHaveLength(MEXICO.matches.length);
  });

  it("is a PROJECTION and never an aggregation (AR-5)", () => {
    /*
     * The strip must stay index-aligned to `matches[]`: nothing is summed,
     * counted, grouped or re-ordered. This is what distinguishes it from
     * `tournament.json`'s `standings[].form`, which is group-stage only (three
     * entries for a team that played eight) and is the wrong field.
     */
    expect(formResults(MEXICO)).toEqual(MEXICO.matches.map((row) => row.result));
  });

  it("counts the record's decided matches without re-deriving the record", () => {
    /*
     * D12: `record.played` is ALL matches and `record.points` is GROUP-STAGE
     * ONLY. Mexico is won 4 / drawn 0 / lost 1 — a naive `won*3 + drawn` gives
     * 12 and the contract says 9, which disagrees on 19 of 48 real teams. This
     * test pins that the model NEVER re-derives either.
     */
    const results = formResults(MEXICO);
    expect(results.filter((result) => result === "win")).toHaveLength(MEXICO.record.won);
    expect(results.filter((result) => result === "loss")).toHaveLength(MEXICO.record.lost);
    expect(MEXICO.record.points).toBe(9);
    expect(MEXICO.record.won * 3 + MEXICO.record.drawn).toBe(12);
    expect(MEXICO.record.points).not.toBe(MEXICO.record.won * 3 + MEXICO.record.drawn);
  });
});

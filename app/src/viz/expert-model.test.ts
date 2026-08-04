import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle, PlayerRecord } from "@/lib/contract/contract-types";
import {
  EXPERT_FIELDS,
  FIELD_UNIT,
  IN_POSSESSION_COLUMNS,
  IN_POSSESSION_FIELDS,
  OUT_OF_POSSESSION_FIELDS,
  PHYSICAL_FIELDS,
  buildExpertRows,
  expertFieldKey,
  expertFieldTitleKey,
} from "@/viz/expert-model";
import { OFFER_MOVEMENT_PROPERTY, OFFER_MOVEMENT_TYPES } from "@/viz/receiving-model";

/*
 * Story 2.11b Task 8.1. Fixtures are read with node:fs, not @/lib/build-data —
 * src/viz sits inside the client-import seam, exactly as receiving-model.test.ts
 * and shot-map-model.test.ts do it.
 *
 * THE HARNESS HAS NO JSDOM, so nothing this story RENDERS can be unit-tested.
 * That is why the column order, the row build, the unit assignment and the key
 * builders all live in a pure module: these assertions are the only thing
 * standing between a 50-column table and a silently alphabetised, mis-united or
 * silently-dropped column.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");
const ALL = [m001, m002, m074];

function playersOf(bundle: MatchBundle): PlayerRecord[] {
  const players = bundle.players;
  if (players === null) {
    throw new Error(`fixture ${bundle.matchId} has no players`);
  }
  return players;
}

describe("the frozen field lists (AC 1)", () => {
  /*
   * HARD-CODED ON PURPOSE. This is the test that catches an alphabetical
   * regression — the exact failure mode `Object.keys` on a FIXTURE would
   * produce, because the fixture JSON serialises its properties alphabetically
   * while the contract's `required[]` is the source page's print order.
   */
  it("in-possession is the contract's required[] order, verbatim", () => {
    expect([...IN_POSSESSION_FIELDS]).toEqual([
      "passesAttempted",
      "passesCompleted",
      "passCompletion",
      "switchesOfPlay",
      "crossesAttempted",
      "crossesCompleted",
      "lineBreaksAttempted",
      "lineBreaksCompleted",
      "lineBreakCompletion",
      "ballProgressions",
      "takeOns",
      "stepIns",
      "attemptsAtGoal",
      "goals",
      "totalOffers",
      "offersReceived",
    ]);
  });

  it("out-of-possession is the contract's required[] order, verbatim", () => {
    expect([...OUT_OF_POSSESSION_FIELDS]).toEqual([
      "tacklesMade",
      "tacklesWon",
      "blocks",
      "interceptions",
      "pressingDirect",
      "pressingIndirect",
      "duelsWonAerial",
      "duelsWonPhysical",
      "possessionContestsWon",
      "clearances",
      "looseBallReceptions",
      "pushingOn",
      "pushingOnIntoPressing",
      "possessionRegains",
      "possessionInterrupted",
    ]);
  });

  it("physical is the contract's required[] order, verbatim", () => {
    expect([...PHYSICAL_FIELDS]).toEqual([
      "totalDistance",
      "distanceZone1",
      "distanceZone2",
      "distanceZone3",
      "distanceZone4",
      "distanceZone5",
      "highSpeedRuns",
      "sprints",
      "topSpeed",
    ]);
  });

  it("is 16 + 15 + 9 = 40 keyed fields", () => {
    expect(IN_POSSESSION_FIELDS).toHaveLength(16);
    expect(OUT_OF_POSSESSION_FIELDS).toHaveLength(15);
    expect(PHYSICAL_FIELDS).toHaveLength(9);
    expect(EXPERT_FIELDS).toHaveLength(40);
  });

  it("names no field twice across the three groups", () => {
    // `expert.field.<field>` is a FLAT namespace, so one shared name between
    // two blocks would silently collapse two columns onto one label.
    expect(new Set(EXPERT_FIELDS).size).toBe(EXPERT_FIELDS.length);
  });

  it("keeps the nested offers block OUT of the scalar list", () => {
    expect([...IN_POSSESSION_FIELDS]).not.toContain("offersByMovementType");
  });

  it("40 keyed fields + 6 reused movement types = 46 data columns", () => {
    const dataColumns =
      IN_POSSESSION_COLUMNS.length + OUT_OF_POSSESSION_FIELDS.length + PHYSICAL_FIELDS.length;
    expect(IN_POSSESSION_COLUMNS).toHaveLength(16 + OFFER_MOVEMENT_TYPES.length);
    expect(dataColumns).toBe(46);
  });

  it("places the six movement columns where the contract nests them", () => {
    // Between `totalOffers` and `offersReceived` — the source page's print
    // order, not a convenient tail append.
    const shape = IN_POSSESSION_COLUMNS.map((column) =>
      column.kind === "field" ? column.field : `movement:${column.code}`
    );
    expect(shape.slice(14)).toEqual([
      "totalOffers",
      "movement:in-front",
      "movement:in-between",
      "movement:out-to-in",
      "movement:in-to-out",
      "movement:in-behind",
      "movement:no-movement",
      "offersReceived",
    ]);
  });
});

describe("units (AD-7 — the compiler cannot catch these)", () => {
  /*
   * Count, Percentage, Metres and KmPerHour all erase to `number` in
   * TypeScript, so a formatter mix-up is invisible to tsc and to every render.
   * Only the schema's x-decimals carries the distinction, and this is where it
   * is asserted.
   */
  it("assigns exactly the two stored percentages", () => {
    const percentages = EXPERT_FIELDS.filter((field) => FIELD_UNIT[field] === "percentage");
    expect([...percentages]).toEqual(["passCompletion", "lineBreakCompletion"]);
  });

  it("assigns metres to the total and all five zones, and km/h to top speed only", () => {
    const metres = EXPERT_FIELDS.filter((field) => FIELD_UNIT[field] === "metres");
    expect([...metres]).toEqual([
      "totalDistance",
      "distanceZone1",
      "distanceZone2",
      "distanceZone3",
      "distanceZone4",
      "distanceZone5",
    ]);
    const speeds = EXPERT_FIELDS.filter((field) => FIELD_UNIT[field] === "kmh");
    expect([...speeds]).toEqual(["topSpeed"]);
  });

  it("leaves the remaining 31 keyed fields — 37 count COLUMNS — as counts", () => {
    /*
     * 40 keyed fields − 2 percentages − 6 metres − 1 km/h = 31 counts. The
     * six movement counts are keyed through enums.offerMovement rather than
     * expert.field, so the COLUMN count is 31 + 6 = 37, and 37 + 2 + 6 + 1 is
     * the full 46 data columns.
     */
    const counts = EXPERT_FIELDS.filter((field) => FIELD_UNIT[field] === "count");
    expect(counts).toHaveLength(31);
    expect(counts.length + OFFER_MOVEMENT_TYPES.length).toBe(37);
  });

  it("gives every field a unit", () => {
    for (const field of EXPERT_FIELDS) {
      expect(FIELD_UNIT[field], field).toBeDefined();
    }
  });
});

describe("the key builders", () => {
  it("builds expert.field.<field>", () => {
    expect(expertFieldKey("passesAttempted")).toBe("expert.field.passesAttempted");
    expect(expertFieldKey("topSpeed")).toBe("expert.field.topSpeed");
  });

  it("carries a full-term title for exactly the abbreviated heads", () => {
    // The five speed-zone bands (the page's own km/h ranges) and the two ruled
    // table abbreviations: "CARR. ALTA VEL." (glossary term high-speed-run) and
    // "Vel. máx." (enums.metric.topSpeed, added by the 2.11b code review —
    // EXPERIENCE.md:139 names topSpeed as the abbreviation precedent itself).
    const titled = EXPERT_FIELDS.filter((field) => expertFieldTitleKey(field) !== null);
    expect([...titled]).toEqual([
      "distanceZone1",
      "distanceZone2",
      "distanceZone3",
      "distanceZone4",
      "distanceZone5",
      "highSpeedRuns",
      "topSpeed",
    ]);
    expect(expertFieldTitleKey("distanceZone3")).toBe("expert.fieldTitle.distanceZone3");
    expect(expertFieldTitleKey("goals")).toBeNull();
  });
});

describe("buildExpertRows (AC 1)", () => {
  it("yields 96 rows over the three fixtures — 31 / 31 / 34", () => {
    expect(buildExpertRows(m001)).toHaveLength(31);
    expect(buildExpertRows(m002)).toHaveLength(31);
    expect(buildExpertRows(m074)).toHaveLength(34);
    expect(ALL.flatMap(buildExpertRows)).toHaveLength(96);
  });

  it("preserves ARTIFACT ORDER verbatim — home team first, then shirt number", () => {
    // AD-5 reserves canonical order to the artifact. Any re-sort here would be
    // a derivation the contract never asked for, and the caption states this
    // order as the table's default.
    for (const bundle of ALL) {
      expect(buildExpertRows(bundle).map((row) => row.playerId)).toEqual(
        playersOf(bundle).map((record) => record.playerId)
      );
    }
  });

  it("keys every row on playerId", () => {
    for (const bundle of ALL) {
      const rows = buildExpertRows(bundle);
      expect(rows.map((row) => row.key)).toEqual(rows.map((row) => row.playerId));
      expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    }
  });

  it("resolves teamId to the metadata team CODE, uppercased", () => {
    for (const bundle of ALL) {
      const codes = new Set(buildExpertRows(bundle).map((row) => row.teamCode));
      expect([...codes].sort()).toEqual(
        [
          bundle.metadata.homeTeam.teamCode.toUpperCase(),
          bundle.metadata.awayTeam.teamCode.toUpperCase(),
        ].sort()
      );
    }
  });

  it("keeps (teamId, shirtNumber) unique per bundle", () => {
    for (const bundle of ALL) {
      const rows = buildExpertRows(bundle);
      const pairs = rows.map((row) => `${row.teamId}#${row.shirtNumber}`);
      expect(new Set(pairs).size, bundle.matchId).toBe(rows.length);
    }
  });

  it("populates all 51 leaves on all 96 rows — no nulls, no missing keys", () => {
    /*
     * The nullability census, asserted rather than asserted-in-prose: zero `?`
     * and zero `| null` anywhere inside PlayerRecord, every sub-object
     * additionalProperties:false. THIS is what licenses the "no cell may ever
     * render an em dash, and no presence gate applies" ruling — and what makes
     * @/lib/format's assertFinite throw unreachable here by construction.
     */
    const rows = ALL.flatMap(buildExpertRows);
    expect(rows).toHaveLength(96);
    for (const row of rows) {
      expect(typeof row.playerName, row.key).toBe("string");
      expect(typeof row.shirtNumber, row.key).toBe("number");
      expect(typeof row.position, row.key).toBe("string");
      for (const field of IN_POSSESSION_FIELDS) {
        expect(Number.isFinite(row.inPossession[field]), `${row.key}.${field}`).toBe(true);
      }
      for (const code of OFFER_MOVEMENT_TYPES) {
        const property = OFFER_MOVEMENT_PROPERTY[code];
        expect(
          Number.isFinite(row.inPossession.offersByMovementType[property]),
          `${row.key}.${property}`
        ).toBe(true);
      }
      for (const field of OUT_OF_POSSESSION_FIELDS) {
        expect(Number.isFinite(row.outOfPossession[field]), `${row.key}.${field}`).toBe(true);
      }
      for (const field of PHYSICAL_FIELDS) {
        expect(Number.isFinite(row.physical[field]), `${row.key}.${field}`).toBe(true);
      }
    }
  });

  it("throws NAMING the offending id on a stray teamId", () => {
    /*
     * Rows are built EAGERLY at mount (ShotMapsSection's precedent), so this
     * throw lands on load rather than on expand, and TacticalErrorBoundary
     * contains it. A silent drop is the class of finding prior reviews flagged
     * on groupScorers and composeMatchTitle.
     */
    const clone = JSON.parse(JSON.stringify(m001)) as MatchBundle;
    playersOf(clone)[0].teamId = "atlantis";
    expect(() => buildExpertRows(clone)).toThrow(/atlantis/);
    expect(() => buildExpertRows(clone)).toThrow(/expert-model/);
  });

  it("returns no rows — never throws — when the report carries no Domain G", () => {
    // `players: null` is the EMPTY STATE the shell renders a panel for, not an
    // error. `[]` is a different state again: ready, with zero rows.
    const absent = { ...m001, players: null } as MatchBundle;
    expect(buildExpertRows(absent)).toEqual([]);
  });
});

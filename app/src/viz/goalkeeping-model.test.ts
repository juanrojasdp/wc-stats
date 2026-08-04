import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { GoalkeeperRecord, MatchBundle } from "@/lib/contract/contract-types";
import type { LogSide } from "@/viz/marker-model";
import {
  AERIAL_TYPES,
  CROSS_DELIVERY_TYPES,
  DISTRIBUTION_TYPES,
  FEET_TECHNIQUES,
  HANDS_TECHNIQUES,
  INTERVENTION_BODY_TYPES,
  INTERVENTION_TYPES,
  THROW_TECHNIQUES,
  aerialTableRows,
  aerialTypeKey,
  bodyTypeTableRows,
  countAxisMax,
  countTicks,
  distributionTableRows,
  distributionTypeKey,
  feetTechniqueKey,
  goalkeepingByTeam,
  handsTechniqueKey,
  interventionBodyTypeKey,
  interventionTypeKey,
  involvementPeak,
  involvementSummaryRows,
  involvementTicks,
  involvementTimelineRows,
  preventionHeadlineRows,
  throwTechniqueKey,
} from "@/viz/goalkeeping-model";

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");

const FIXTURES: { slug: string; bundle: MatchBundle }[] = [
  { slug: "m001", bundle: m001 },
  { slug: "m002", bundle: m002 },
  { slug: "m074", bundle: m074 },
];

function sides(bundle: MatchBundle): { home: LogSide; away: LogSide } {
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

function group(bundle: MatchBundle) {
  const { home, away } = sides(bundle);
  return goalkeepingByTeam(bundle.goalkeeping, home, away);
}

function records(bundle: MatchBundle): GoalkeeperRecord[] {
  const goalkeeping = bundle.goalkeeping;
  if (goalkeeping === null) {
    throw new Error(`fixture ${bundle.matchId} carries no goalkeeping block`);
  }
  return goalkeeping;
}

/* ------------------------------------------------------------------------- */

describe("goalkeepingByTeam (Task 4.3, ruled decision 2)", () => {
  it("returns one block per TEAM, home first, on every fixture", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      expect(grouping.home.teamId, slug).toBe(bundle.metadata.homeTeam.teamId);
      expect(grouping.away.teamId, slug).toBe(bundle.metadata.awayTeam.teamId);
      expect(grouping.home.recordCount, slug).toBe(1);
      expect(grouping.away.recordCount, slug).toBe(1);
      expect(grouping.isEmptyArray, slug).toBe(false);
    }
  });

  /*
   * ORDER COMES FROM metadata, NEVER FROM ARRAY ORDER. Reversing the array must
   * not reverse the rendered blocks — the contract says the block is "ordered
   * home team first", but that is a statement about emission, not a guarantee
   * the App may key on.
   */
  it("ignores array order entirely", () => {
    const { home, away } = sides(m001);
    const reversed = [...records(m001)].reverse();
    const grouping = goalkeepingByTeam(reversed, home, away);
    expect(grouping.home.teamId).toBe(home.teamId);
    expect(grouping.home.keeperNames).toEqual(["Raul RANGEL"]);
    expect(grouping.away.keeperNames).toEqual(["Ronwen WILLIAMS"]);
  });

  it("carries the keeper names as CONTEXT, one per record", () => {
    const grouping = group(m074);
    expect(grouping.home.keeperNames).toEqual(["Manuel NEUER"]);
    expect(grouping.away.keeperNames).toEqual(["Orlando GILL"]);
  });

  it("fails loud on a teamId matching neither side", () => {
    const { home, away } = sides(m001);
    const stray = [{ ...records(m001)[0], teamId: "atlantis" }];
    expect(() => goalkeepingByTeam(stray, home, away)).toThrow(/goalkeeping/);
    expect(() => goalkeepingByTeam(stray, home, away)).toThrow(/atlantis/);
  });
});

describe("frozen enum lists (Task 4.2)", () => {
  it("carries every Domain E code in declaration order", () => {
    expect(DISTRIBUTION_TYPES).toEqual(["feet", "hands", "throw"]);
    expect(FEET_TECHNIQUES).toEqual([
      "play-onto",
      "play-into",
      "play-around",
      "play-through",
      "play-beyond",
      "other",
    ]);
    expect(HANDS_TECHNIQUES).toEqual(["side-kick", "from-hands", "drop-kick"]);
    expect(THROW_TECHNIQUES).toEqual(["over-arm", "under-arm", "side-arm", "chest"]);
    expect(INTERVENTION_TYPES).toEqual([
      "save-and-retain",
      "save-and-deflect",
      "deflect-and-retain",
      "save-attempt",
      "no-save-attempt",
    ]);
    expect(INTERVENTION_BODY_TYPES).toEqual([
      "head",
      "hands",
      "upper-body",
      "lower-body",
      "feet",
    ]);
    expect(AERIAL_TYPES).toEqual(["punch", "claim", "tipped-palmed"]);
  });

  /*
   * Story 2.7's CrossDeliveryType list is REUSED for deliveryTypesFaced rather
   * than a second cross-delivery namespace being minted. Re-exported here so a
   * consumer has one import; asserted so the re-export cannot silently drop.
   */
  it("reuses Story 2.7's six cross delivery types", () => {
    expect(CROSS_DELIVERY_TYPES).toEqual([
      "inswing",
      "outswing",
      "driven",
      "lofted",
      "cutback",
      "push-cross",
    ]);
  });

  it("builds enum-code dictionary keys", () => {
    expect(distributionTypeKey("throw")).toBe("enums.distributionType.throw");
    expect(feetTechniqueKey("play-beyond")).toBe("enums.feetTechnique.play-beyond");
    expect(handsTechniqueKey("drop-kick")).toBe("enums.handsTechnique.drop-kick");
    expect(throwTechniqueKey("over-arm")).toBe("enums.throwTechnique.over-arm");
    expect(interventionTypeKey("no-save-attempt")).toBe("enums.interventionType.no-save-attempt");
    expect(interventionBodyTypeKey("upper-body")).toBe("enums.interventionBodyType.upper-body");
    expect(aerialTypeKey("tipped-palmed")).toBe("enums.aerialType.tipped-palmed");
  });
});

describe("the four summaries on fixture data (Tasks 5.3-5.5)", () => {
  it("reads the distribution families and line breaks verbatim", () => {
    const keeper = group(m001).home.records[0];
    const source = records(m001)[0].distribution;
    expect(keeper.distribution.families).toHaveLength(4);
    expect(keeper.distribution.families[0].total).toBe(source.total.total);
    expect(keeper.distribution.families[1].complete).toBe(source.feet.complete);
    expect(keeper.distribution.lineBreaks).toBe(source.lineBreaks);
  });

  /*
   * `savePercentage` IS A CONTRACTED FIELD and is read verbatim, never
   * re-derived. m002 away is 66.7 against 6 attempts and 4 interventions —
   * neither 4/6 (66.67, which would round-trip differently) nor any other
   * client-side derivation is used.
   */
  it("reads savePercentage verbatim rather than deriving it", () => {
    /*
     * Sources are matched BY teamId, never by array position.
     *
     * The previous form read `records(bundle)[index === 0 ? 0 : 1]`, i.e. it
     * assumed `goalkeeping[0]` is the home record — the exact assumption the
     * "ignores array order entirely" test above exists to forbid. It passed only
     * because the fixtures happen to be emitted home-first, so it would have
     * gone green against a grouping that had silently reverted to array order.
     * It also softened its assertion with `matching?.`, which compares
     * `undefined` on a lookup miss instead of failing.
     */
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const block of [grouping.home, grouping.away]) {
        const sources = records(bundle).filter((record) => record.teamId === block.teamId);
        expect(block.records, slug).toHaveLength(sources.length);
        for (const source of sources) {
          const matching = block.records.find(
            (record) => record.playerId === source.playerId
          );
          expect(matching, `${slug}: no block for ${source.playerId}`).toBeDefined();
          expect(matching!.goalPrevention.savePercentage, slug).toBe(
            source.goalPrevention.savePercentage
          );
        }
      }
    }
  });

  /*
   * RULED DECISION 13. The two breakdowns have DIFFERENT denominators, and the
   * model carries each as data so the component cannot imply a shared one.
   * byInterventionType sums to attemptsFaced; byBodyType sums to
   * totalInterventions. Both hold on all six fixture keepers.
   */
  it("carries each goal-prevention breakdown's OWN denominator", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        for (const keeper of team.records) {
          const prevention = keeper.goalPrevention;
          expect(prevention.interventionDenominator, slug).toBe(prevention.attemptsFaced);
          expect(prevention.bodyTypeDenominator, slug).toBe(prevention.totalInterventions);
          const typeSum = prevention.byInterventionType.reduce(
            (total, row) => total + row.count,
            0
          );
          expect(typeSum, `${slug} intervention types`).toBe(prevention.attemptsFaced);
          if (prevention.byBodyType.present) {
            const bodySum = prevention.byBodyType.rows.reduce(
              (total, row) => total + row.count,
              0
            );
            expect(bodySum, `${slug} body types`).toBe(prevention.totalInterventions);
          }
        }
      }
    }
  });

  it("reads the aerial delivery-type total verbatim, never by summing the six", () => {
    const keeper = group(m074).away.records[0];
    const source = records(m074)[1].aerialControl;
    expect(keeper.aerial.deliveryTypesTotal).toBe(source.deliveryTypesFaced.total);
    expect(keeper.aerial.deliveryTypes).toHaveLength(6);
    expect(keeper.aerial.crossesFacedAttempted).toBe(source.crossesFacedAttempted);
  });

  it("opens all five gates on fixture data, which populates all five", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        for (const keeper of team.records) {
          expect(keeper.distribution.feetTechniques.present, slug).toBe(true);
          expect(keeper.distribution.handsTechniques.present, slug).toBe(true);
          expect(keeper.distribution.throwTechniques.present, slug).toBe(true);
          expect(keeper.goalPrevention.byBodyType.present, slug).toBe(true);
          expect(keeper.aerial.crossesFacedCompleted, slug).not.toBeNull();
          expect(keeper.anyGateClosed, slug).toBe(false);
        }
        expect(team.anyGateClosed, slug).toBe(false);
      }
    }
  });
});

describe("involvementSeries (Task 5.1, ruled decision 7)", () => {
  it("is keyed by SAMPLE INDEX, contiguous from zero", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        const points = team.records[0].involvement;
        expect(points.map((point) => point.index), slug).toEqual(
          points.map((_, index) => index)
        );
      }
    }
  });

  it("carries the minute as a LABEL alongside the index, never as the key", () => {
    const points = group(m074).home.records[0].involvement;
    // m074's fixture timeline: 25 slots at 0,5,10..120.
    expect(points).toHaveLength(25);
    expect(points[0].minute).toBe(0);
    expect(points[24].minute).toBe(120);
    expect(points[1].index).toBe(1);
  });

  /*
   * THE FIXTURES CANNOT PRODUCE THE CORPUS SHAPE, so it is constructed. The
   * corpus draws 95-145 slots per team-inning against a bare 0-120 `Minute`
   * with NO stoppage field, and 2,506 of 21,764 slots fall in stoppage time —
   * so minutes REPEAT. A minute-keyed axis would collapse them.
   */
  it("survives duplicate minutes without collapsing any slot", () => {
    const { home, away } = sides(m001);
    const duplicated = {
      ...records(m001)[0],
      involvementTimeline: [
        { minute: 45, involvements: 2 },
        { minute: 45, involvements: 1 },
        { minute: 45, involvements: 3 },
        { minute: 46, involvements: 0 },
      ],
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([duplicated], home, away);
    const points = grouping.home.records[0].involvement;
    expect(points).toHaveLength(4);
    expect(points.map((point) => point.index)).toEqual([0, 1, 2, 3]);
    expect(points.map((point) => point.involvements)).toEqual([2, 1, 3, 0]);
  });

  it("involvementPeak guards Math.max over an empty series", () => {
    expect(involvementPeak([])).toBe(0);
    expect(involvementPeak(group(m001).home.records[0].involvement)).toBeGreaterThan(0);
  });
});

describe("involvementTicks and countTicks (Task 5.2, ruled decision 9)", () => {
  it("always keeps the first and last index", () => {
    for (let length = 1; length <= 160; length += 1) {
      const points = Array.from({ length }, (_, index) => ({
        index,
        minute: Math.min(120, index),
        involvements: 0,
      }));
      const ticks = involvementTicks(points);
      expect(ticks[0], `length=${length}`).toBe(0);
      expect(ticks[ticks.length - 1], `length=${length}`).toBe(length - 1);
    }
  });

  it("returns no ticks for an empty series", () => {
    expect(involvementTicks([])).toEqual([]);
  });

  it("stays readable — never more than seven ticks", () => {
    for (let length = 1; length <= 160; length += 1) {
      const points = Array.from({ length }, (_, index) => ({
        index,
        minute: index,
        involvements: 0,
      }));
      expect(involvementTicks(points).length, `length=${length}`).toBeLessThanOrEqual(7);
    }
  });

  /*
   * DEDUPE BY MINUTE VALUE, FIRST OCCURRENCE WINS — the half of
   * momentumTickIndices' model that survives without a stoppage field, and the
   * half that stops a repeated axis label. The last index always survives so
   * the axis keeps its right anchor.
   */
  it("never emits the same minute label twice, except at the final anchor", () => {
    const points = Array.from({ length: 40 }, (_, index) => ({
      index,
      // Every minute repeated four times — the stoppage-heavy corpus shape.
      minute: Math.floor(index / 4),
      involvements: 0,
    }));
    const ticks = involvementTicks(points);
    const minutes = ticks.slice(0, -1).map((index) => points[index].minute);
    expect(new Set(minutes).size).toBe(minutes.length);
    expect(ticks[ticks.length - 1]).toBe(39);
  });

  it("countTicks always includes zero and ends at the axis max", () => {
    for (let max = 0; max <= 200; max += 1) {
      const ticks = countTicks(max);
      expect(ticks[0], `max=${max}`).toBe(0);
      expect(ticks[ticks.length - 1], `max=${max}`).toBe(countAxisMax(max));
      expect(countAxisMax(max), `max=${max}`).toBeGreaterThanOrEqual(Math.max(1, max));
      for (const tick of ticks) {
        expect(Number.isInteger(tick), `max=${max}`).toBe(true);
      }
    }
  });

  it("never produces a degenerate count domain", () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(countAxisMax(bad), `input=${bad}`).toBeGreaterThan(0);
    }
  });
});

describe("totalInvolvements is printed verbatim (ruled decision 14)", () => {
  /*
   * Measured over 208 team-innings: totalInvolvements − Σ(timeline) runs 0..5,
   * is NEVER negative, and is exactly 0 on only 59 of 208. THE FIXTURES MAKE IT
   * LOOK EXACT — all six fixture keepers sum precisely. Story 1.9 ships the
   * BOUND, not the equality, and the ledger says "Do not resolve it by making
   * the numbers agree."
   */
  it("keeps the printed total even when the timeline sums to something else", () => {
    const { home, away } = sides(m001);
    const short = {
      ...records(m001)[0],
      totalInvolvements: 47,
      involvementTimeline: [
        { minute: 10, involvements: 20 },
        { minute: 20, involvements: 24 },
      ],
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([short], home, away);
    const keeper = grouping.home.records[0];
    // The headline is the report's own number; the timeline sums to 44.
    expect(keeper.totalInvolvements).toBe(47);
    const summary = involvementSummaryRows(grouping.home);
    expect(summary[0].totalInvolvements).toBe(47);
    // `sampleCount` is a COUNT OF ROWS, deliberately — not a sum of values.
    expect(summary[0].sampleCount).toBe(2);
  });

  it("the timeline table carries a slot-index column", () => {
    const rows = involvementTimelineRows(group(m074).home);
    expect(rows).toHaveLength(25);
    expect(rows.map((row) => row.index)).toEqual(rows.map((_, index) => index));
    expect(rows[0].playerName).toBe("Manuel NEUER");
  });
});

describe("the CORPUS shape no fixture can produce (Task 5.8)", () => {
  /*
   * ALL FIVE GATED FIELDS null — the shape on 208/208 corpus team-innings, and
   * the shape 0/6 fixture keepers have.
   *
   * `as unknown as GoalkeeperRecord` is AUTHORISED HERE AND ONLY HERE, for the
   * reason Story 2.9's Task 3.7 established: bundles reach the App as `as`-cast
   * unvalidated JSON, so the test simulates the real path rather than
   * fabricating an impossible one. The generated types declare all five
   * NON-nullable, which is precisely the contract defect this story files.
   */
  const corpusShaped = (): GoalkeeperRecord => {
    const base = records(m001)[0];
    return {
      ...base,
      distribution: {
        ...base.distribution,
        feetTechniques: null,
        handsTechniques: null,
        throwTechniques: null,
      },
      goalPrevention: { ...base.goalPrevention, byBodyType: null },
      aerialControl: { ...base.aerialControl, crossesFacedCompleted: null },
    } as unknown as GoalkeeperRecord;
  };

  it("omits all five panels entirely rather than em-dashing them", () => {
    const { home, away } = sides(m001);
    const grouping = goalkeepingByTeam([corpusShaped()], home, away);
    const keeper = grouping.home.records[0];

    expect(keeper.distribution.feetTechniques.present).toBe(false);
    expect(keeper.distribution.feetTechniques.rows).toEqual([]);
    expect(keeper.distribution.handsTechniques.present).toBe(false);
    expect(keeper.distribution.handsTechniques.rows).toEqual([]);
    expect(keeper.distribution.throwTechniques.present).toBe(false);
    expect(keeper.distribution.throwTechniques.rows).toEqual([]);
    expect(keeper.goalPrevention.byBodyType.present).toBe(false);
    expect(keeper.goalPrevention.byBodyType.rows).toEqual([]);
    expect(keeper.aerial.crossesFacedCompleted).toBeNull();
  });

  it("still renders everything that IS present", () => {
    const { home, away } = sides(m001);
    const grouping = goalkeepingByTeam([corpusShaped()], home, away);
    const keeper = grouping.home.records[0];
    expect(keeper.distribution.families).toHaveLength(4);
    expect(keeper.goalPrevention.byInterventionType).toHaveLength(5);
    expect(keeper.aerial.types).toHaveLength(3);
    expect(keeper.aerial.deliveryTypes).toHaveLength(6);
    expect(keeper.aerial.crossesFacedAttempted).toBeGreaterThan(0);
  });

  /*
   * A CLOSED GATE MUST SAY SO. Ruled decision 3: silent absence at panel
   * granularity is the one thing FR-22 forbids, so the block raises a flag the
   * component turns into ONE ruled sentence.
   */
  it("flags that at least one gate is closed, at keeper AND team level", () => {
    const { home, away } = sides(m001);
    const grouping = goalkeepingByTeam([corpusShaped()], home, away);
    expect(grouping.home.records[0].anyGateClosed).toBe(true);
    expect(grouping.home.anyGateClosed).toBe(true);
    // The other team has no record at all, so nothing is claimed about it.
    expect(grouping.away.anyGateClosed).toBe(false);
  });

  it("flags a partial gate closure too", () => {
    const { home, away } = sides(m001);
    const base = records(m001)[0];
    const partial = {
      ...base,
      goalPrevention: { ...base.goalPrevention, byBodyType: null },
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([partial], home, away);
    const keeper = grouping.home.records[0];
    expect(keeper.distribution.feetTechniques.present).toBe(true);
    expect(keeper.goalPrevention.byBodyType.present).toBe(false);
    expect(keeper.anyGateClosed).toBe(true);
  });

  /*
   * THE TWO-KEEPER CASE (ruled decision 2). Real on 7 of 208 corpus
   * team-innings (M21 home, M41 away, M53 away, M62 away, M66 home, M88 home,
   * M98 away) and on ZERO fixtures, so it is constructed.
   */
  it("renders BOTH keepers' records for a two-keeper team, summing nothing", () => {
    const { home, away } = sides(m001);
    const first = records(m001)[0];
    const awayKeeper = records(m001)[1];
    const second = {
      ...awayKeeper,
      teamId: home.teamId,
      playerId: "second-keeper",
      playerName: "Luis MALAGON",
    } as unknown as GoalkeeperRecord;
    // Interleaved deliberately: the away record sits BETWEEN the home team's
    // two, so a grouping that leaned on array adjacency would fail here.
    const grouping = goalkeepingByTeam([first, awayKeeper, second], home, away);

    expect(grouping.home.recordCount).toBe(2);
    expect(grouping.home.keeperNames).toEqual(["Raul RANGEL", "Luis MALAGON"]);
    expect(grouping.home.records).toHaveLength(2);

    // NOTHING IS SUMMED ACROSS THEM. Each record keeps its own numbers — AD-5
    // forbids the App summing, and adding two keepers' save percentages would
    // be arithmetic nonsense.
    expect(grouping.home.records[0].totalInvolvements).toBe(first.totalInvolvements);
    expect(grouping.home.records[1].totalInvolvements).toBe(second.totalInvolvements);
    expect(grouping.home.records[0].goalPrevention.savePercentage).toBe(
      first.goalPrevention.savePercentage
    );
    expect(grouping.home.records[1].goalPrevention.savePercentage).toBe(
      second.goalPrevention.savePercentage
    );

    // Both keepers' timelines are separate row sets in the table, each labelled.
    const rows = involvementTimelineRows(grouping.home);
    expect(new Set(rows.map((row) => row.playerName)).size).toBe(2);
    expect(involvementSummaryRows(grouping.home)).toHaveLength(2);

    // Away is untouched by the home team's two records.
    expect(grouping.away.recordCount).toBe(1);
  });

  it("gives two keepers distinct React keys even on a duplicated playerId", () => {
    const { home, away } = sides(m001);
    const first = records(m001)[0];
    const clone = {
      ...first,
      playerName: "Luis MALAGON",
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([first, clone], home, away);
    const keys = grouping.home.records.map((record) => record.key);
    expect(new Set(keys).size).toBe(2);
  });

  /*
   * THE REAL COLLISION, which the test above does not reach because it varies
   * `playerName`.
   *
   * `teamId`, `playerId` and `playerName` are all `required` and ALL THREE ARE
   * UNFULFILLABLE FROM THE SOURCE (Story 1.9, AD-14 (a)): no goalkeeper name
   * appears on any of the 936 goalkeeping pages. Whatever Story 1.16 emits could
   * therefore be ONE placeholder per team — at which point a two-keeper team
   * (real on 7 of 208 team-innings) produces two records identical in every
   * field this key was built from. React would drop the duplicate, silently
   * deleting the second keeper's panel and every one of its table rows, which is
   * exactly what ruled decision 2 exists to prevent. No fixture can produce this
   * shape, so it is constructed.
   */
  it("keys two keepers apart even when playerId AND playerName are identical", () => {
    const { home, away } = sides(m001);
    const first = records(m001)[0];
    const indistinguishable = { ...first } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([first, indistinguishable], home, away);

    expect(grouping.home.recordCount).toBe(2);
    const keys = grouping.home.records.map((record) => record.key);
    expect(new Set(keys).size, "both keepers must survive as distinct React keys").toBe(2);

    // And the table rows built off those keys stay distinct too.
    const summary = involvementSummaryRows(grouping.home);
    expect(new Set(summary.map((row) => row.key)).size).toBe(2);
    const timeline = involvementTimelineRows(grouping.home);
    expect(new Set(timeline.map((row) => row.key)).size).toBe(timeline.length);
  });

  /*
   * THE GATE FLAG IS SCOPED TO THE FOUR GATES THAT REMOVE A PANEL.
   * `crossesFacedCompleted` hides nothing — the aerial block swaps to the
   * `crossesFacedAlone` label, which states the absence in words — so a record
   * whose only null is that field must NOT drive the "esos paneles no se
   * muestran" sentence. A disclosure sentence that can be false is worse than
   * no sentence.
   */
  it("does not claim hidden panels when only crossesFacedCompleted is absent", () => {
    const { home, away } = sides(m001);
    const base = records(m001)[0];
    const crossesOnly = {
      ...base,
      aerialControl: { ...base.aerialControl, crossesFacedCompleted: null },
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([crossesOnly], home, away);
    const keeper = grouping.home.records[0];

    expect(keeper.aerial.crossesFacedCompleted).toBeNull();
    // Every actual panel is still present...
    expect(keeper.distribution.feetTechniques.present).toBe(true);
    expect(keeper.distribution.handsTechniques.present).toBe(true);
    expect(keeper.distribution.throwTechniques.present).toBe(true);
    expect(keeper.goalPrevention.byBodyType.present).toBe(true);
    // ...so nothing announces that panels were omitted.
    expect(keeper.anyGateClosed).toBe(false);
    expect(grouping.home.anyGateClosed).toBe(false);
  });
});

describe("zero-state guards (Task 5.7)", () => {
  const { home, away } = sides(m001);

  /*
   * `goalkeeping: []` IS `ready`, NEVER `empty` — the schema says so verbatim:
   * "An empty array means the pages were present and listed no goalkeeper; null
   * means there was nothing to read. The App renders those two states
   * differently, so they must never be collapsed." So this reaches the model,
   * and the component owns a zero-content view.
   */
  it("handles an empty goalkeeping array without throwing", () => {
    const grouping = goalkeepingByTeam([], home, away);
    expect(grouping.isEmptyArray).toBe(true);
    expect(grouping.home.recordCount).toBe(0);
    expect(grouping.away.recordCount).toBe(0);
    expect(grouping.home.records).toEqual([]);
    expect(grouping.home.keeperNames).toEqual([]);
    expect(involvementSummaryRows(grouping.home)).toEqual([]);
    expect(involvementTimelineRows(grouping.home)).toEqual([]);
  });

  /*
   * RECORDS FOR ONE TEAM ONLY. This is the trap Story 2.9's own review patched:
   * `sectionDataState` returns `ready` whenever goalkeeping !== null, so the
   * other team's block is left to the component — and the natural
   * implementation renders it with ZEROS, "a positive claim that the report
   * recorded zero when the truth is that no record exists".
   *
   * `recordCount` is what lets the component tell the two apart, so the model
   * must never collapse them.
   */
  it("distinguishes NO RECORD from a keeper who did nothing", () => {
    const grouping = goalkeepingByTeam([records(m001)[0]], home, away);
    expect(grouping.home.recordCount).toBe(1);
    expect(grouping.away.recordCount).toBe(0);
    expect(grouping.away.records).toEqual([]);
    // isEmptyArray stays FALSE: the array had a record, just not for this team.
    expect(grouping.isEmptyArray).toBe(false);
  });

  it("handles an empty involvementTimeline", () => {
    const empty = {
      ...records(m001)[0],
      involvementTimeline: [],
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([empty], home, away);
    const keeper = grouping.home.records[0];
    expect(keeper.involvement).toEqual([]);
    expect(involvementPeak(keeper.involvement)).toBe(0);
    expect(involvementTicks(keeper.involvement)).toEqual([]);
    // The printed headline survives an unplotted timeline (decision 14).
    expect(keeper.totalInvolvements).toBe(records(m001)[0].totalInvolvements);
  });

  it("handles attemptsFaced: 0 and every count at zero", () => {
    const base = records(m001)[0];
    const blank = {
      ...base,
      totalInvolvements: 0,
      involvementTimeline: [],
      goalPrevention: {
        attemptsFaced: 0,
        savePercentage: 0,
        totalInterventions: 0,
        byInterventionType: {
          saveAndRetain: 0,
          saveAndDeflect: 0,
          deflectAndRetain: 0,
          saveAttempt: 0,
          noSaveAttempt: 0,
        },
        byBodyType: null,
      },
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([blank], home, away);
    const prevention = grouping.home.records[0].goalPrevention;
    expect(prevention.attemptsFaced).toBe(0);
    expect(prevention.interventionDenominator).toBe(0);
    for (const row of prevention.byInterventionType) {
      expect(row.count).toBe(0);
      expect(Number.isNaN(row.count)).toBe(false);
    }
    // A zero denominator produced no division anywhere: savePercentage is
    // contracted and read verbatim, never re-derived.
    expect(prevention.savePercentage).toBe(0);
  });
});

/*
 * DECISION 19'S REMAINING TABLES (added by the 2.10 code review).
 *
 * The first implementation shipped three tables against roughly thirty numbers
 * on screen: the distribution families and their triples, lineBreaks, the three
 * gated technique groups, attemptsFaced / savePercentage / totalInterventions,
 * byBodyType, the aerial families, the crosses-faced pair and the six delivery
 * types all reached the surface and NO table. That is a decision-19 gap, an AC 3
 * gap through UX-DR16 / ARCHITECTURE-SPINE.md:140, and it sits below
 * EXPERIENCE.md:113's floor that every viz carries a data-table alternative.
 *
 * These assertions are the regression guard: they compare the table rows against
 * the SAME model summaries the surface renders, so the two cannot drift apart
 * again without a red test.
 */
describe("the distribution, aerial and prevention tables (decision 19)", () => {
  it("carries every distribution number the surface displays, on every fixture", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        const rows = distributionTableRows(team);
        for (const keeper of team.records) {
          const mine = rows.filter((row) => row.playerName === keeper.playerName);
          const distribution = keeper.distribution;
          // Four families + lineBreaks + the three gated groups, all present on
          // the fixtures (6/6 keepers), which is where this is exercised.
          const expected =
            distribution.families.length +
            1 +
            distribution.feetTechniques.rows.length +
            distribution.handsTechniques.rows.length +
            distribution.throwTechniques.rows.length;
          expect(mine, slug).toHaveLength(expected);

          // Every family triple is carried VERBATIM, all three numbers.
          for (const family of distribution.families) {
            const row = mine.find((candidate) => candidate.labelKey === family.labelKey);
            expect(row, `${slug}: ${family.key}`).toBeDefined();
            expect(row!.total).toBe(family.total);
            expect(row!.complete).toBe(family.complete);
            expect(row!.incomplete).toBe(family.incomplete);
          }

          // A count-only row carries NO completion split — null, never zero.
          const lineBreaks = mine.find(
            (row) => row.labelKey === "viz.goalkeeping.lineBreaks"
          );
          expect(lineBreaks, slug).toBeDefined();
          expect(lineBreaks!.total).toBe(distribution.lineBreaks);
          expect(lineBreaks!.complete, "no split exists, so null and not 0").toBeNull();
          expect(lineBreaks!.incomplete).toBeNull();
        }
      }
    }
  });

  it("carries every aerial number the surface displays, on every fixture", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        const rows = aerialTableRows(team);
        for (const keeper of team.records) {
          const mine = rows.filter((row) => row.playerName === keeper.playerName);
          const aerial = keeper.aerial;
          // 3 families + attempted + completed (present on fixtures) + 6 types.
          expect(mine, slug).toHaveLength(aerial.types.length + 2 + aerial.deliveryTypes.length);

          for (const type of aerial.types) {
            const row = mine.find((candidate) => candidate.labelKey === type.labelKey);
            expect(row, `${slug}: ${type.key}`).toBeDefined();
            expect(row!.total).toBe(type.total);
            expect(row!.complete).toBe(type.complete);
          }
          const attempted = mine.find(
            (row) => row.labelKey === "viz.goalkeeping.crossesFaced"
          );
          expect(attempted, slug).toBeDefined();
          expect(attempted!.total).toBe(aerial.crossesFacedAttempted);
        }
      }
    }
  });

  it("carries the goal-prevention headline figures, savePercentage verbatim", () => {
    for (const { slug, bundle } of FIXTURES) {
      const grouping = group(bundle);
      for (const team of [grouping.home, grouping.away]) {
        const rows = preventionHeadlineRows(team);
        expect(rows, slug).toHaveLength(team.recordCount);
        for (const keeper of team.records) {
          const row = rows.find((candidate) => candidate.playerName === keeper.playerName);
          expect(row, slug).toBeDefined();
          expect(row!.attemptsFaced).toBe(keeper.goalPrevention.attemptsFaced);
          expect(row!.totalInterventions).toBe(keeper.goalPrevention.totalInterventions);
          // Contracted, never re-derived.
          expect(row!.savePercentage).toBe(keeper.goalPrevention.savePercentage);
        }
      }
    }
  });

  /*
   * A CLOSED GATE CONTRIBUTES NO ROWS — absent, never em-dashed (ruled decision
   * 3), exactly as it renders no panel. This is the corpus shape, which no
   * fixture can produce, so the table and the surface must agree on real data as
   * well as on the fixtures.
   */
  it("omits gated rows entirely on a corpus-shaped record", () => {
    const { home, away } = sides(m001);
    const base = records(m001)[0];
    const corpusShaped = {
      ...base,
      distribution: {
        ...base.distribution,
        feetTechniques: null,
        handsTechniques: null,
        throwTechniques: null,
      },
      goalPrevention: { ...base.goalPrevention, byBodyType: null },
      aerialControl: { ...base.aerialControl, crossesFacedCompleted: null },
    } as unknown as GoalkeeperRecord;
    const grouping = goalkeepingByTeam([corpusShaped], home, away);
    const team = grouping.home;

    // Four families + lineBreaks, and NOTHING from the three technique groups.
    expect(distributionTableRows(team)).toHaveLength(5);
    // byBodyType is null on 208/208 corpus team-innings: no rows, no table.
    expect(bodyTypeTableRows(team)).toEqual([]);

    const aerial = aerialTableRows(team);
    // 3 families + attempted + 6 delivery types. The completed half is GONE.
    expect(aerial).toHaveLength(10);
    expect(
      aerial.some((row) => row.labelKey === "viz.goalkeeping.crossesFacedCompleted")
    ).toBe(false);
    /*
     * And the surviving half relabels itself, exactly as the panel does: a value
     * labelled as the *attempted half of a pair* with no counterpart reads as a
     * MISSING number rather than an ABSENT one.
     */
    expect(
      aerial.some((row) => row.labelKey === "viz.goalkeeping.crossesFacedAlone")
    ).toBe(true);
  });

  it("keeps both keepers' rows separate for a two-keeper team", () => {
    const { home, away } = sides(m001);
    const first = records(m001)[0];
    const second = {
      ...records(m001)[1],
      teamId: home.teamId,
      playerId: "second-keeper",
      playerName: "Luis MALAGON",
    } as unknown as GoalkeeperRecord;
    const team = goalkeepingByTeam([first, second], home, away).home;

    for (const rows of [distributionTableRows(team), aerialTableRows(team)]) {
      expect(new Set(rows.map((row) => row.playerName)).size).toBe(2);
      // Keys stay unique across the two record sets — nothing is summed or merged.
      expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    }
    expect(preventionHeadlineRows(team)).toHaveLength(2);
  });

  it("survives a team with no records at all", () => {
    const { home, away } = sides(m001);
    const grouping = goalkeepingByTeam([], home, away);
    expect(distributionTableRows(grouping.home)).toEqual([]);
    expect(aerialTableRows(grouping.home)).toEqual([]);
    expect(bodyTypeTableRows(grouping.home)).toEqual([]);
    expect(preventionHeadlineRows(grouping.home)).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchBundle, SetPlaysBlock, TeamSetPlays } from "@/lib/contract/contract-types";
import type { LogSide } from "@/viz/marker-model";
import {
  CORNER_DELIVERY_STYLES,
  CORNER_DELIVERY_TYPES,
  FREE_KICK_PROPERTY,
  FREE_KICK_TYPES,
  PITCH_SIDES,
  cornerDeliveryStyleKey,
  cornerDeliveryTypeKey,
  cornerRows,
  cornerTableRows,
  freeKickTableRows,
  freeKickRows,
  freeKickTypeKey,
  pitchSideKey,
  setPlayTotals,
  setPlayTotalsRows,
} from "@/viz/set-plays-model";

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

function teamInnings(): { slug: string; side: "home" | "away"; team: TeamSetPlays }[] {
  return FIXTURES.flatMap(({ slug, bundle }) =>
    (["home", "away"] as const).map((side) => ({ slug, side, team: bundle.setPlays[side] }))
  );
}

/* ------------------------------------------------------------------------- */

describe("the two FALSE partitions, pinned against the fixtures (Task 3.1)", () => {
  /*
   * THIS TEST IS THE INVERSE OF phases-model's Task 2.1 TEST, AND THAT IS THE
   * POINT. It asserts that the FIXTURES satisfy two relations the CORPUS does
   * not, so the next reader who opens a dev server, sees three tidy fixtures and
   * reaches for a stacked bar finds a red test explaining why.
   *
   *   direct == directOnTarget + directOffTarget
   *       fixtures 6/6 TRUE  ·  corpus 0/208 (160 have on+off == 0, direct > 0)
   *   sum(cornersByDeliveryStyle) == totalCorners
   *       fixtures 6/6 TRUE  ·  corpus 96/208 (112 under, never over)
   *
   * data/fixtures/README.md says why: free-kick and corner breakdowns are
   * Synthetic — "the totals are real; the splits beneath them are synthesised so
   * that they add up to those totals".
   */
  it("the fixtures satisfy `direct == on-target + off-target` on all six team-innings", () => {
    for (const { slug, side, team } of teamInnings()) {
      const fk = team.freeKicks;
      expect(fk.directOnTarget + fk.directOffTarget, `${slug} ${side}`).toBe(fk.direct);
    }
  });

  it("the fixtures satisfy `sum(style) == totalCorners` on all six team-innings", () => {
    for (const { slug, side, team } of teamInnings()) {
      const styleSum = CORNER_DELIVERY_STYLES.reduce(
        (total, code) => total + team.cornersByDeliveryStyle[code],
        0
      );
      expect(styleSum, `${slug} ${side}`).toBe(team.totalCorners);
    }
  });

  /* The corpus-true relations, re-derived here so both halves are visible. */
  it("the fixtures also satisfy the four corpus-TRUE relations", () => {
    for (const { slug, side, team } of teamInnings()) {
      const label = `${slug} ${side}`;
      expect(team.freeKicks.direct + team.freeKicks.indirect, label).toBe(team.totalFreeKicks);
      const typeSum = CORNER_DELIVERY_TYPES.reduce(
        (total, code) =>
          total +
          team.cornersByDeliveryType[
            code === "direct-to-area"
              ? "directToArea"
              : code === "short"
                ? "short"
                : "edgeOfPenaltyArea"
          ].total,
        0
      );
      expect(typeSum, label).toBe(team.totalCorners);
      expect(team.cornersBySide.left + team.cornersBySide.right, label).toBe(
        team.cornersBySide.total
      );
      expect(team.cornersBySide.total, label).toBe(team.totalCorners);
      expect(
        team.totalFreeKicks + team.totalCorners + team.totalThrowIns + team.totalPenalties,
        label
      ).toBe(team.totalSetPlays);
    }
  });
});

describe("frozen enum lists (Task 3.2)", () => {
  it("carries every code in declaration order", () => {
    expect(FREE_KICK_TYPES).toEqual([
      "direct",
      "direct-on-target",
      "direct-off-target",
      "indirect",
    ]);
    expect(CORNER_DELIVERY_TYPES).toEqual(["direct-to-area", "short", "edge-of-penalty-area"]);
    expect(CORNER_DELIVERY_STYLES).toEqual(["inswing", "outswing", "driven", "lofted"]);
    expect(PITCH_SIDES).toEqual(["left", "right"]);
  });

  it("builds enum-code dictionary keys", () => {
    expect(freeKickTypeKey("direct-on-target")).toBe("enums.freeKick.direct-on-target");
    expect(cornerDeliveryTypeKey("edge-of-penalty-area")).toBe(
      "enums.cornerDeliveryType.edge-of-penalty-area"
    );
    expect(cornerDeliveryStyleKey("inswing")).toBe("enums.cornerDeliveryStyle.inswing");
    expect(pitchSideKey("left")).toBe("enums.pitchSide.left");
  });

  it("every free-kick property map member names a real counts property", () => {
    for (const code of FREE_KICK_TYPES) {
      expect(typeof m001.setPlays.home.freeKicks[FREE_KICK_PROPERTY[code]]).toBe("number");
    }
  });
});

describe("setPlayTotals (Task 3.3)", () => {
  it("reads the five contracted totals verbatim, per team", () => {
    for (const { slug, bundle } of FIXTURES) {
      const { home, away } = sides(bundle);
      const totals = setPlayTotals(bundle.setPlays, home, away);
      expect(totals.home.totalSetPlays, slug).toBe(bundle.setPlays.home.totalSetPlays);
      expect(totals.away.totalThrowIns, slug).toBe(bundle.setPlays.away.totalThrowIns);
      expect(totals.home.teamCode, slug).toBe(home.teamCode);
      expect(totals.away.teamCode, slug).toBe(away.teamCode);
    }
  });

  it("pins m001's home totals", () => {
    const { home, away } = sides(m001);
    const totals = setPlayTotals(m001.setPlays, home, away);
    expect(totals.home).toMatchObject({
      totalSetPlays: 36,
      totalFreeKicks: 12,
      totalCorners: 3,
      totalThrowIns: 21,
      totalPenalties: 0,
    });
  });

  it("setPlayTotalsRows carries exactly the displayed numbers", () => {
    const { home, away } = sides(m074);
    const rows = setPlayTotalsRows(setPlayTotals(m074.setPlays, home, away));
    expect(rows).toHaveLength(2);
    expect(rows[0].totalSetPlays).toBe(52);
    expect(rows[1].totalSetPlays).toBe(39);
  });
});

describe("freeKickRows (Task 3.4, ruled decision 6)", () => {
  it("returns four independent counts per team, in frozen order", () => {
    for (const { slug, bundle } of FIXTURES) {
      const { home, away } = sides(bundle);
      const sets = freeKickRows(bundle.setPlays, home, away);
      for (const set of [sets.home, sets.away]) {
        expect(set.rows, slug).toHaveLength(4);
        expect(set.rows.map((row) => row.code)).toEqual([...FREE_KICK_TYPES]);
      }
    }
  });

  it("flags the two direct* rows as contract-subordinate, and nothing else", () => {
    const { home, away } = sides(m001);
    const sets = freeKickRows(m001.setPlays, home, away);
    expect(sets.home.rows.map((row) => row.subordinate)).toEqual([false, true, true, false]);
  });

  it("reads the declared total verbatim and never sums the four rows", () => {
    const { home, away } = sides(m002);
    const sets = freeKickRows(m002.setPlays, home, away);
    expect(sets.away.declaredTotal).toBe(m002.setPlays.away.totalFreeKicks);
    /*
     * m002 away: direct 11, on-target 0, off-target 11, indirect 0, total 11.
     * The naive sum of all four is 22 — double-counting the direct ones, which
     * is precisely what the contract's own description warns about and what
     * AD-5 forbids the App doing at all.
     */
    const naiveSum = sets.away.rows.reduce((total, row) => total + row.count, 0);
    expect(naiveSum).toBe(22);
    expect(sets.away.declaredTotal).toBe(11);
  });

  it("reports zero only when the declared total and every row are zero", () => {
    const { home, away } = sides(m001);
    const empty: SetPlaysBlock = {
      home: {
        ...m001.setPlays.home,
        totalFreeKicks: 0,
        freeKicks: { direct: 0, directOnTarget: 0, directOffTarget: 0, indirect: 0 },
      },
      away: m001.setPlays.away,
    };
    const sets = freeKickRows(empty, home, away);
    expect(sets.home.isZero).toBe(true);
    expect(sets.away.isZero).toBe(false);
  });

  it("freeKickTableRows carries the same four counts", () => {
    const { home, away } = sides(m074);
    const rows = freeKickTableRows(freeKickRows(m074.setPlays, home, away));
    expect(rows).toHaveLength(2);
    expect(rows[0].counts.direct).toBe(12);
    expect(rows[0].counts["direct-on-target"]).toBe(9);
    expect(rows[0].declaredTotal).toBe(13);
  });
});

describe("cornerRows (Tasks 3.5, 3.6, ruled decisions 6 and 8)", () => {
  it("marks side and delivery-type as partitions and style as NOT one", () => {
    for (const { slug, bundle } of FIXTURES) {
      const { home, away } = sides(bundle);
      const groups = cornerRows(bundle.setPlays, home, away);
      for (const team of [groups.home, groups.away]) {
        expect(team.bySide.partition, slug).toBe(true);
        expect(team.byDeliveryType.partition, slug).toBe(true);
        expect(team.byStyle.partition, slug).toBe(false);
      }
    }
  });

  it("reads the side split from the PRECOMPUTED cornersBySide, never by summing", () => {
    const { home, away } = sides(m074);
    const groups = cornerRows(m074.setPlays, home, away);
    const bySide = groups.home.bySide;
    expect(bySide.segments.map((segment) => segment.count)).toEqual([
      m074.setPlays.home.cornersBySide.left,
      m074.setPlays.home.cornersBySide.right,
    ]);
    // m074 home: 12 left / 4 right of 16 corners.
    expect(bySide.segments.map((segment) => segment.count)).toEqual([12, 4]);
  });

  it("the bar denominator is the SUM OF THE SEGMENTS, not the contracted total", () => {
    const { home, away } = sides(m074);
    const groups = cornerRows(m074.setPlays, home, away);
    for (const team of [groups.home, groups.away]) {
      for (const group of [team.bySide, team.byDeliveryType, team.byStyle]) {
        const sum = group.segments.reduce((total, segment) => total + segment.count, 0);
        expect(group.segmentsTotal).toBe(sum);
        if (group.segmentsTotal > 0) {
          const shareSum = group.segments.reduce((total, segment) => total + segment.share, 0);
          expect(shareSum).toBeCloseTo(100, 6);
        }
      }
    }
  });

  it("carries the contracted totalCorners verbatim beside the segments", () => {
    const { home, away } = sides(m002);
    const groups = cornerRows(m002.setPlays, home, away);
    expect(groups.away.byStyle.declaredTotal).toBe(m002.setPlays.away.totalCorners);
    // The fixtures agree, so this flag is false everywhere in the repo — it goes
    // true on 112 of 208 corpus team-innings for the STYLE group.
    expect(groups.away.byStyle.disagreesWithDeclaredTotal).toBe(false);
  });

  it("surfaces a segment/declared-total disagreement rather than normalizing it", () => {
    const { home, away } = sides(m001);
    // The corpus shape the fixtures cannot produce: style counts UNDER the
    // declared total (112/208 team-innings are exactly this).
    const skewed: SetPlaysBlock = {
      home: {
        ...m001.setPlays.home,
        totalCorners: 10,
        cornersByDeliveryStyle: { inswing: 1, outswing: 1, driven: 0, lofted: 0 },
      },
      away: m001.setPlays.away,
    };
    const groups = cornerRows(skewed, home, away);
    expect(groups.home.byStyle.segmentsTotal).toBe(2);
    expect(groups.home.byStyle.declaredTotal).toBe(10);
    expect(groups.home.byStyle.disagreesWithDeclaredTotal).toBe(true);
    // AD-6: neither number is rewritten to agree with the other.
    expect(groups.home.byStyle.segments[0].count).toBe(1);
  });

  it("carries each delivery type's own left/right split", () => {
    const { home, away } = sides(m074);
    const groups = cornerRows(m074.setPlays, home, away);
    expect(groups.home.deliveryTypeSides).toHaveLength(3);
    for (const row of groups.home.deliveryTypeSides) {
      const counts =
        m074.setPlays.home.cornersByDeliveryType[
          row.code === "direct-to-area"
            ? "directToArea"
            : row.code === "short"
              ? "short"
              : "edgeOfPenaltyArea"
        ];
      expect(row.left).toBe(counts.left);
      expect(row.right).toBe(counts.right);
      expect(row.total).toBe(counts.total);
    }
  });

  it("cornerTableRows prints the share for partition groups and null otherwise", () => {
    const { home, away } = sides(m001);
    const rows = cornerTableRows(cornerRows(m001.setPlays, home, away));
    // 2 teams x (2 sides + 3 types + 4 styles) = 18 rows.
    expect(rows).toHaveLength(18);
    const styleRows = rows.filter((row) => row.groupKey.startsWith("corner-style"));
    expect(styleRows).toHaveLength(8);
    for (const row of styleRows) {
      expect(row.share).toBeNull();
    }
    const sideRows = rows.filter((row) => row.groupKey.startsWith("corner-side"));
    for (const row of sideRows) {
      expect(typeof row.share).toBe("number");
    }
  });
});

describe("zero-state guards (Task 3.8)", () => {
  const { home, away } = sides(m001);

  const allZero: TeamSetPlays = {
    totalSetPlays: 0,
    totalFreeKicks: 0,
    totalPenalties: 0,
    totalCorners: 0,
    totalThrowIns: 0,
    cornersBySide: { left: 0, right: 0, total: 0 },
    freeKicks: { direct: 0, directOnTarget: 0, directOffTarget: 0, indirect: 0 },
    cornersByDeliveryType: {
      directToArea: { left: 0, right: 0, total: 0 },
      short: { left: 0, right: 0, total: 0 },
      edgeOfPenaltyArea: { left: 0, right: 0, total: 0 },
    },
    cornersByDeliveryStyle: { inswing: 0, outswing: 0, driven: 0, lofted: 0 },
  };

  it("survives all five totals at zero without throwing or producing NaN", () => {
    const block: SetPlaysBlock = { home: allZero, away: allZero };
    const totals = setPlayTotals(block, home, away);
    expect(totals.home.totalSetPlays).toBe(0);
    const groups = cornerRows(block, home, away);
    for (const group of [
      groups.home.bySide,
      groups.home.byDeliveryType,
      groups.home.byStyle,
    ]) {
      expect(group.isZero).toBe(true);
      expect(group.segmentsTotal).toBe(0);
      expect(group.disagreesWithDeclaredTotal).toBe(false);
      for (const segment of group.segments) {
        // 0, never NaN: a NaN flexGrow collapses the whole bar silently.
        expect(Number.isNaN(segment.share)).toBe(false);
        expect(segment.share).toBe(0);
      }
    }
  });

  /*
   * `totalCorners: 0` with every breakdown at 0 is REACHABLE ON REAL DATA —
   * corpus `total_corners` has a minimum of 0 — so this is a live branch, not a
   * defensive one.
   */
  it("handles totalCorners: 0 while the rest of the team's set plays are non-zero", () => {
    const noCorners: TeamSetPlays = {
      ...m001.setPlays.home,
      totalCorners: 0,
      cornersBySide: { left: 0, right: 0, total: 0 },
      cornersByDeliveryType: allZero.cornersByDeliveryType,
      cornersByDeliveryStyle: allZero.cornersByDeliveryStyle,
    };
    const groups = cornerRows({ home: noCorners, away: m001.setPlays.away }, home, away);
    expect(groups.home.bySide.isZero).toBe(true);
    expect(groups.away.bySide.isZero).toBe(false);
    const freeKicks = freeKickRows({ home: noCorners, away: m001.setPlays.away }, home, away);
    expect(freeKicks.home.isZero).toBe(false);
  });
});

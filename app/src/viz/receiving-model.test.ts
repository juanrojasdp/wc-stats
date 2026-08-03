import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  MatchBundle,
  OfferMovementType,
  PlayerRecord,
} from "@/lib/contract/contract-types";
import {
  OFFER_MOVEMENT_PROPERTY,
  OFFER_MOVEMENT_TYPES,
  movementRows,
  movementSplit,
  movementTotalsRows,
  offerMovementKey,
  offersRows,
  offersSummary,
  offersTotalsRows,
} from "@/viz/receiving-model";

/*
 * Story 2.9 Task 2.9. Fixtures are read with node:fs, not @/lib/build-data —
 * src/viz sits inside the client-import seam, exactly as shot-map-model.test.ts
 * and pass-network-model.test.ts do it.
 */

function readFixture(slug: string): MatchBundle {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "matches", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as MatchBundle;
}

const m001 = readFixture("m001-mexico-south-africa");
const m002 = readFixture("m002-korea-republic-czechia");
const m074 = readFixture("m074-germany-paraguay");
const ALL = [m001, m002, m074];

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

function playersOf(bundle: MatchBundle): PlayerRecord[] {
  const players = bundle.players;
  if (players === null) {
    throw new Error(`fixture ${bundle.matchId} has no players`);
  }
  return players;
}

/*
 * The unrelated halves of a PlayerRecord come from a REAL fixture row rather
 * than being fabricated: this module reads `inPossession` only, and inventing
 * twenty-odd out-of-possession and physical fields would be a second, silent
 * fixture that a contract change could not invalidate.
 */
const TEMPLATE = playersOf(m001)[0];

/**
 * A synthetic row, because NO fixture carries one: 0 of 96 fixture player rows
 * have totalOffers === 0, while 81 of 3,289 corpus rows do (ruled decision 10).
 * Every zero-divisor branch below is otherwise untested while live in real data.
 */
function playerRow(
  teamId: string,
  shirtNumber: number,
  totalOffers: number,
  offersReceived: number,
  counts: Partial<Record<keyof PlayerRecord["inPossession"]["offersByMovementType"], number>> = {}
): PlayerRecord {
  const zeroCounts = {
    inFront: 0,
    inBetween: 0,
    outToIn: 0,
    inToOut: 0,
    inBehind: 0,
    noMovement: 0,
    ...counts,
  };
  return {
    ...TEMPLATE,
    teamId,
    playerId: `${teamId}-${shirtNumber}`,
    playerName: `Player ${shirtNumber}`,
    shirtNumber,
    inPossession: {
      ...TEMPLATE.inPossession,
      totalOffers,
      offersByMovementType: zeroCounts,
      offersReceived,
    },
  };
}

const HOME = { teamId: "home-team", teamCode: "HOM" };
const AWAY = { teamId: "away-team", teamCode: "AWY" };

/* ------------------------------------------------------------------------- */

/*
 * TASK 2.1 — the ruling in ruled decision 14 rests on this, and the story
 * requires the dev to RE-DERIVE it rather than trust the measurement. A
 * proportion bar may only be rendered because the six values are a genuine
 * partition of totalOffers; 1.13's by_phase totals (-48..+314) and Domain C's
 * "never normalize, never pie" phases are the traps this is NOT.
 */
describe("the six-way movement split is a measured PARTITION (ruled decision 14)", () => {
  it("sums to totalOffers on every player row of every fixture", () => {
    let rows = 0;
    for (const bundle of ALL) {
      for (const player of playersOf(bundle)) {
        const { totalOffers, offersByMovementType } = player.inPossession;
        const sum = OFFER_MOVEMENT_TYPES.reduce(
          (total, code) => total + offersByMovementType[OFFER_MOVEMENT_PROPERTY[code]],
          0
        );
        expect(sum, `${bundle.matchId} / ${player.playerId}`).toBe(totalOffers);
        rows += 1;
      }
    }
    // 31 + 31 + 34 — stated so a shrinking fixture cannot silently pass.
    expect(rows).toBe(96);
  });
});

describe("OFFER_MOVEMENT_TYPES / OFFER_MOVEMENT_PROPERTY (ruled decision 16)", () => {
  it("lists the six codes in the schema's declaration order", () => {
    expect(OFFER_MOVEMENT_TYPES).toEqual([
      "in-front",
      "in-between",
      "out-to-in",
      "in-to-out",
      "in-behind",
      "no-movement",
    ]);
  });

  it("INCLUDES no-movement — 24.9% of all corpus offers", () => {
    // The ledger's "the movement map prints exactly FIVE types" constrains the
    // movement PAGE's grid, not Domain G, which is the one source carrying the
    // sixth value. Rendering five would hide a quarter of the data.
    expect(OFFER_MOVEMENT_TYPES).toContain("no-movement");
    expect(OFFER_MOVEMENT_TYPES).toHaveLength(6);
  });

  it("maps every kebab code onto its camelCase counts property", () => {
    expect(OFFER_MOVEMENT_PROPERTY).toEqual({
      "in-front": "inFront",
      "in-between": "inBetween",
      "out-to-in": "outToIn",
      "in-to-out": "inToOut",
      "in-behind": "inBehind",
      "no-movement": "noMovement",
    });
  });

  it("keys locale labels by enum CODE (AD-7)", () => {
    expect(offerMovementKey("no-movement")).toBe("enums.offerMovement.no-movement");
  });
});

/* ------------------------------------------------------------------------- */

describe("offersSummary (Task 2.3, AD-5 roll-up under ruled decision 13)", () => {
  it("reproduces the per-team totals on m001", () => {
    const { home, away } = sides(m001);
    const summary = offersSummary(playersOf(m001), home, away);
    expect(summary.home).toMatchObject({
      teamCode: "MEX",
      offersMade: 390,
      offersReceived: 196,
      playerCount: 16,
    });
    expect(summary.away).toMatchObject({
      teamCode: "RSA",
      offersMade: 396,
      offersReceived: 162,
      playerCount: 15,
    });
    expect(summary.home.receivedPct).toBeCloseTo(50.2564, 4);
    expect(summary.away.receivedPct).toBeCloseTo(40.9091, 4);
  });

  it("resolves the head-to-head leaders (UX-DR7 via resolveLeader)", () => {
    const { home, away } = sides(m001);
    const summary = offersSummary(playersOf(m001), home, away);
    // 390 vs 396 — the away team made more offers…
    expect(summary.leaders.made).toBe("away");
    // …but the home team received more, and converted a higher share.
    expect(summary.leaders.received).toBe("home");
    expect(summary.leaders.receivedPct).toBe("home");
  });

  it("totals every fixture's teams to the sum of their own player rows", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const players = playersOf(bundle);
      const summary = offersSummary(players, home, away);
      for (const [side, ref] of [
        [summary.home, home],
        [summary.away, away],
      ] as const) {
        const mine = players.filter((player) => player.teamId === ref.teamId);
        expect(side.offersMade).toBe(
          mine.reduce((total, player) => total + player.inPossession.totalOffers, 0)
        );
        expect(side.offersReceived).toBe(
          mine.reduce((total, player) => total + player.inPossession.offersReceived, 0)
        );
        expect(side.playerCount).toBe(mine.length);
      }
    }
  });

  it("returns null — never NaN, never 0 — for a team that made no offers", () => {
    const summary = offersSummary(
      [playerRow(HOME.teamId, 7, 0, 0), playerRow(AWAY.teamId, 9, 10, 4)],
      HOME,
      AWAY
    );
    expect(summary.home.receivedPct).toBeNull();
    expect(summary.away.receivedPct).toBeCloseTo(40, 6);
    // No leader may be claimed against an undefined share.
    expect(summary.leaders.receivedPct).toBe("tie");
  });

  it("guards the zero states ruled decision 10 requires", () => {
    for (const players of [[], null]) {
      const summary = offersSummary(players, HOME, AWAY);
      expect(summary.home.offersMade).toBe(0);
      expect(summary.home.receivedPct).toBeNull();
      expect(summary.away.playerCount).toBe(0);
      expect(summary.leaders.made).toBe("tie");
    }
  });

  it("survives a team with no rows at all", () => {
    const summary = offersSummary([playerRow(HOME.teamId, 7, 12, 6)], HOME, AWAY);
    expect(summary.home.offersMade).toBe(12);
    expect(summary.away.playerCount).toBe(0);
    expect(summary.away.receivedPct).toBeNull();
  });

  it("fails LOUD on a teamId matching neither side (resolveSide)", () => {
    expect(() => offersSummary([playerRow("nobody", 7, 1, 1)], HOME, AWAY)).toThrow(
      /receiving-model/
    );
  });
});

/* ------------------------------------------------------------------------- */

describe("offersRows (Task 2.4)", () => {
  it("orders by team then shirt number on every fixture", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const rows = offersRows(playersOf(bundle), home, away);
      expect(rows).toHaveLength(playersOf(bundle).length);
      const homeRows = rows.filter((row) => row.teamCode === home.teamCode);
      const awayRows = rows.filter((row) => row.teamCode === away.teamCode);
      // Home first, contiguously.
      expect(rows.slice(0, homeRows.length).every((row) => row.teamCode === home.teamCode)).toBe(
        true
      );
      for (const group of [homeRows, awayRows]) {
        const shirts = group.map((row) => row.shirtNumber);
        expect(shirts, `${bundle.matchId} / ${group[0]?.teamCode}`).toEqual(
          [...shirts].sort((a, b) => a - b)
        );
      }
    }
  });

  it("carries each player's own three values", () => {
    const { home, away } = sides(m001);
    const players = playersOf(m001);
    const rows = offersRows(players, home, away);
    for (const row of rows) {
      const player = players.find((candidate) => candidate.playerId === row.playerId);
      expect(player).toBeDefined();
      expect(row.offersMade).toBe(player?.inPossession.totalOffers);
      expect(row.offersReceived).toBe(player?.inPossession.offersReceived);
    }
  });

  it("gives a zero-offer player a null share rather than NaN", () => {
    const rows = offersRows([playerRow(HOME.teamId, 7, 0, 0)], HOME, AWAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].receivedPct).toBeNull();
  });

  it("returns [] for an empty or absent slice", () => {
    expect(offersRows([], HOME, AWAY)).toEqual([]);
    expect(offersRows(null, HOME, AWAY)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- */

describe("movementSplit (Task 2.5)", () => {
  it("returns the six categories in frozen order, summing to the team total", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const split = movementSplit(playersOf(bundle), home, away);
      for (const team of [split.home, split.away]) {
        expect(team.categories.map((category) => category.code)).toEqual([
          ...OFFER_MOVEMENT_TYPES,
        ]);
        const counted = team.categories.reduce((total, category) => total + category.count, 0);
        expect(counted, `${bundle.matchId} / ${team.teamCode}`).toBe(team.total);
        expect(team.isZero).toBe(false);
        // Shares are PERCENT POINTS (formatPercent's contract), summing to 100.
        const shares = team.categories.reduce((total, category) => total + category.share, 0);
        expect(shares).toBeCloseTo(100, 6);
      }
    }
  });

  it("reproduces m001 Mexico's measured category totals", () => {
    const { home, away } = sides(m001);
    const split = movementSplit(playersOf(m001), home, away);
    const counts = Object.fromEntries(
      split.home.categories.map((category) => [category.code, category.count])
    );
    expect(counts).toEqual({
      "in-front": 258,
      "in-between": 34,
      "out-to-in": 46,
      "in-to-out": 28,
      "in-behind": 5,
      "no-movement": 19,
    });
    expect(split.home.total).toBe(390);
  });

  it("agrees with offersSummary's offersMade on every fixture (one derivation, two surfaces)", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const players = playersOf(bundle);
      const summary = offersSummary(players, home, away);
      const split = movementSplit(players, home, away);
      expect(split.home.total).toBe(summary.home.offersMade);
      expect(split.away.total).toBe(summary.away.offersMade);
    }
  });

  it("flags the zero line instead of dividing by zero", () => {
    const split = movementSplit([playerRow(HOME.teamId, 7, 0, 0)], HOME, AWAY);
    expect(split.home.total).toBe(0);
    expect(split.home.isZero).toBe(true);
    for (const category of split.home.categories) {
      expect(category.share).toBe(0);
      expect(Number.isNaN(category.share)).toBe(false);
    }
    // A team with no rows at all lands in the same state.
    expect(split.away.isZero).toBe(true);
    expect(split.away.categories).toHaveLength(6);
  });

  it("returns six zeroed categories per side for an empty or absent slice", () => {
    for (const players of [[], null]) {
      const split = movementSplit(players, HOME, AWAY);
      expect(split.home.categories).toHaveLength(6);
      expect(split.home.total).toBe(0);
      expect(split.home.isZero).toBe(true);
    }
  });

  it("fails LOUD on a teamId matching neither side", () => {
    expect(() => movementSplit([playerRow("nobody", 7, 1, 1)], HOME, AWAY)).toThrow(
      /receiving-model/
    );
  });
});

/* ------------------------------------------------------------------------- */

describe("movementRows (Task 2.6)", () => {
  it("carries all six counts per player, in the same default order as offersRows", () => {
    const { home, away } = sides(m074);
    const players = playersOf(m074);
    const offers = offersRows(players, home, away);
    const movement = movementRows(players, home, away);
    expect(movement.map((row) => row.playerId)).toEqual(offers.map((row) => row.playerId));
    for (const row of movement) {
      const player = players.find((candidate) => candidate.playerId === row.playerId);
      const counted = OFFER_MOVEMENT_TYPES.reduce((total, code) => total + row.counts[code], 0);
      expect(counted).toBe(player?.inPossession.totalOffers);
      expect(row.total).toBe(counted);
    }
  });

  it("returns [] for an empty or absent slice", () => {
    expect(movementRows([], HOME, AWAY)).toEqual([]);
    expect(movementRows(null, HOME, AWAY)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- */

/*
 * TASK 2.7 / ruled decision 11 — UX-DR16 requires "the same artifact slice".
 * A per-player table alone does not satisfy that for a team-level tile or bar:
 * a reader would have to sum 16 rows to recover the printed number.
 */
describe("team-totals rows carry exactly what the surface displays (ruled decision 11)", () => {
  it("offersTotalsRows equals the tiles' own values", () => {
    const { home, away } = sides(m001);
    const summary = offersSummary(playersOf(m001), home, away);
    const totals = offersTotalsRows(summary);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({
      teamCode: summary.home.teamCode,
      offersMade: summary.home.offersMade,
      offersReceived: summary.home.offersReceived,
      receivedPct: summary.home.receivedPct,
    });
    expect(totals[1].teamCode).toBe(summary.away.teamCode);
  });

  it("offersTotalsRows equals the sum of the per-player rows it sits beside", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const players = playersOf(bundle);
      const totals = offersTotalsRows(offersSummary(players, home, away));
      const rows = offersRows(players, home, away);
      for (const total of totals) {
        const mine = rows.filter((row) => row.teamCode === total.teamCode);
        expect(total.offersMade).toBe(
          mine.reduce((sum, row) => sum + row.offersMade, 0)
        );
        expect(total.offersReceived).toBe(
          mine.reduce((sum, row) => sum + row.offersReceived, 0)
        );
      }
    }
  });

  it("movementTotalsRows equals the bar's own segment counts", () => {
    const { home, away } = sides(m074);
    const split = movementSplit(playersOf(m074), home, away);
    const totals = movementTotalsRows(split);
    expect(totals).toHaveLength(2);
    for (const [total, team] of [
      [totals[0], split.home],
      [totals[1], split.away],
    ] as const) {
      expect(total.teamCode).toBe(team.teamCode);
      expect(total.total).toBe(team.total);
      for (const category of team.categories) {
        expect(total.counts[category.code]).toBe(category.count);
      }
    }
  });

  it("movementTotalsRows equals the sum of the per-player rows it sits beside", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const players = playersOf(bundle);
      const totals = movementTotalsRows(movementSplit(players, home, away));
      const rows = movementRows(players, home, away);
      for (const total of totals) {
        const mine = rows.filter((row) => row.teamCode === total.teamCode);
        for (const code of OFFER_MOVEMENT_TYPES) {
          expect(total.counts[code]).toBe(
            mine.reduce((sum, row) => sum + row.counts[code], 0)
          );
        }
      }
    }
  });
});

/* ------------------------------------------------------------------------- */

describe("m002 is covered by every entry point (all three fixtures, every time)", () => {
  it("builds all five surfaces without throwing", () => {
    const { home, away } = sides(m002);
    const players = playersOf(m002);
    const summary = offersSummary(players, home, away);
    expect(summary.home.offersMade).toBe(426);
    expect(summary.away.offersMade).toBe(463);
    expect(offersRows(players, home, away)).toHaveLength(31);
    expect(movementRows(players, home, away)).toHaveLength(31);
    const split = movementSplit(players, home, away);
    expect(split.away.total).toBe(463);
    expect(movementTotalsRows(split)).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------------- */

/*
 * DECISION 14'S FALLBACK, implemented at code review rather than merely
 * declared.
 *
 * The six categories are a genuine partition of `totalOffers` on 3,289/3,289
 * corpus player rows and 96/96 fixture rows, which is the ONLY reason a
 * proportion may be drawn at all. Because no shipped input can break it, the
 * mismatch branch is unreachable from any fixture and needs constructed rows —
 * exactly like Task 2.8's `totalOffers: 0` case.
 *
 * Note what the original code did NOT do: `total` was taken from the sum of the
 * six, which guaranteed the bar always filled, so a broken partition would have
 * rendered a silently mis-scaled bar while the adjacent #offers-to-receive
 * section printed a different total for the same quantity.
 */
describe("the partition guard (ruled decision 14, implemented at code review)", () => {
  it("reports NO mismatch when the six sum to totalOffers", () => {
    const players = [
      playerRow("home-team", 7, 10, 4, { inFront: 6, inBehind: 4 }),
      playerRow("away-team", 9, 5, 2, { noMovement: 5 }),
    ];
    const split = movementSplit(players, HOME, AWAY);
    expect(split.home.partitionMismatch).toBe(false);
    expect(split.away.partitionMismatch).toBe(false);
    expect(split.home.total).toBe(10);
  });

  it("flags a mismatch when they do not, per team and independently", () => {
    const players = [
      // 6 + 4 = 10, but the row DECLARES 12 offers: not a partition.
      playerRow("home-team", 7, 12, 4, { inFront: 6, inBehind: 4 }),
      playerRow("away-team", 9, 5, 2, { noMovement: 5 }),
    ];
    const split = movementSplit(players, HOME, AWAY);
    expect(split.home.partitionMismatch).toBe(true);
    expect(split.away.partitionMismatch).toBe(false);
  });

  it("does not read a mismatched zero team as a zero team", () => {
    // No movement counts at all, but 12 declared offers: the surface must not
    // claim "the report records no offers" for a team that made twelve.
    const players = [playerRow("home-team", 7, 12, 4)];
    const split = movementSplit(players, HOME, AWAY);
    expect(split.home.isZero).toBe(false);
    expect(split.home.partitionMismatch).toBe(true);
    // A team with genuinely nothing stays zero and unflagged.
    expect(split.away.isZero).toBe(true);
    expect(split.away.partitionMismatch).toBe(false);
  });

  it("holds across all three fixtures — the partition is real", () => {
    for (const bundle of ALL) {
      const { home, away } = sides(bundle);
      const split = movementSplit(playersOf(bundle), home, away);
      expect(split.home.partitionMismatch).toBe(false);
      expect(split.away.partitionMismatch).toBe(false);
    }
  });
});

const TYPE_GUARD: readonly OfferMovementType[] = OFFER_MOVEMENT_TYPES;
void TYPE_GUARD;

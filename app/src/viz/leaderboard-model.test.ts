import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  Leaderboard,
  LeaderboardRow,
  Leaderboards,
  MetricCode,
} from "@/lib/contract/contract-types";
import {
  ABBREVIATED_METRICS,
  LEADERBOARD_FORMAT,
  LEADERBOARD_UNIT,
  TEASER_LIMIT,
  anyDistinctTeam,
  anyPerMatch,
  leaderboardMetricAbbrKey,
  leaderboardMetricKey,
  leaderboardRows,
  leaderboardTeasers,
  teaserBoard,
  teaserRows,
  type LeaderboardTableRow,
} from "@/viz/leaderboard-model";

/*
 * Task 8.1. Fixtures are read with node:fs, exactly as the sibling viz model
 * tests do — src/viz is inside the client-import seam, so build-data.ts is not
 * importable here and its DATA_ROOT is re-derived rather than shared.
 */
function readLeaderboardsFixture(): Leaderboards {
  const file = path.join(process.cwd(), "..", "data", "fixtures", "index", "leaderboards.json");
  return JSON.parse(readFileSync(file, "utf8")) as Leaderboards;
}

const fixture = readLeaderboardsFixture();
const boards = fixture.boards;

function boardFor(code: MetricCode): Leaderboard {
  const board = boards.find((candidate) => candidate.metricCode === code);
  if (board === undefined) {
    throw new Error(`fixture carries no ${code} board`);
  }
  return board;
}

const possession = boardFor("possession");
const distanceCovered = boardFor("distanceCovered");
const topSpeed = boardFor("topSpeed");

/**
 * The full 32-value MetricCode domain, as a `Record<MetricCode, true>` so a
 * contract enum change is a COMPILE ERROR here rather than a silently
 * uncovered case. This is the same mechanism the registries themselves use
 * (AD-2), applied to the test's own iteration.
 */
const ALL_METRIC_CODES: Record<MetricCode, true> = {
  ballProgressions: true,
  completedLineBreaks: true,
  crosses: true,
  crossesCompleted: true,
  defensiveLineBreaks: true,
  defensivePressures: true,
  distanceCovered: true,
  duelsWonAerial: true,
  duelsWonPhysical: true,
  expectedGoals: true,
  forcedTurnovers: true,
  goals: true,
  highSpeedRuns: true,
  interceptions: true,
  lineBreaksCompleted: true,
  passCompletion: true,
  passes: true,
  passesCompleted: true,
  possession: true,
  possessionRegains: true,
  receptionsInFinalThird: true,
  secondBalls: true,
  shots: true,
  shotsOnTarget: true,
  sprintDistance: true,
  sprints: true,
  stepIns: true,
  switchesOfPlay: true,
  tacklesWon: true,
  takeOns: true,
  topSpeed: true,
  totalDistance: true,
};

const METRIC_CODES = Object.keys(ALL_METRIC_CODES) as MetricCode[];

/** A row shaped like the contract's, for the constructed-tie cases. */
function row(rank: number, entityId: string, overrides: Partial<LeaderboardRow> = {}): LeaderboardRow {
  return {
    rank,
    entity: { id: entityId, name: entityId },
    team: { id: `team-${entityId}`, name: `team-${entityId}` },
    value: 10,
    matchesPlayed: 3,
    perMatch: null,
    ...overrides,
  };
}

function boardWith(rows: LeaderboardRow[]): Leaderboard {
  return {
    metricCode: "topSpeed",
    scope: "player",
    aggregation: "max",
    higherIsBetter: true,
    rows,
  };
}

describe("the fixture this story is built against (Task 1.3)", () => {
  it("carries 3 boards / 32 rows at schemaVersion 4", () => {
    expect(fixture.schemaVersion).toBe(4);
    expect(boards).toHaveLength(3);
    expect(boards.reduce((total, board) => total + board.rows.length, 0)).toBe(32);
  });

  it("carries only 3 of the 32 MetricCode values, so nothing may be driven off 3", () => {
    const distinct = new Set(boards.map((board) => board.metricCode));
    expect(distinct.size).toBe(3);
    expect(METRIC_CODES).toHaveLength(32);
  });
});

describe("leaderboardRows (Task 2.3)", () => {
  it("preserves artifact order verbatim — never re-ranked, never re-sorted (AD-5)", () => {
    /*
     * Asserted as the EMITTED rank sequence against the FILE's, not against a
     * sorted copy: `rank` is pipeline-computed and the schema says verbatim
     * "Never derived from array position by the App (AD-5)". topSpeed is the
     * board that proves it — it carries tie clusters followed by rank SKIPS, so
     * any position-derived rank diverges at the first tie.
     *
     * NO RANK LITERAL IS QUOTED HERE, deliberately. The fixture was regenerated
     * mid-story and this comment kept describing the OLD sequence for a while
     * after the assertion below had been rewritten as a property — a stale
     * rationale outliving the code it explains. The next regeneration must not
     * be able to falsify a comment. See the property assertions below.
     */
    expect(leaderboardRows(topSpeed).map((r) => r.rank)).toEqual(topSpeed.rows.map((r) => r.rank));
    expect(leaderboardRows(topSpeed).map((r) => r.entityId)).toEqual(
      topSpeed.rows.map((r) => r.entity.id)
    );
  });

  it("emits COMPETITION ranks, provably not array positions", () => {
    /*
     * ASSERTED AS A PROPERTY, NOT AS A LITERAL SEQUENCE — and that is a
     * correction made during this story rather than a preference. The first
     * version of this test hardcoded the fixture's rank sequence, and a
     * concurrent pipeline session regenerated `leaderboards.json` mid-story:
     * `topSpeed`'s ranks moved from `…7,7,7,7,7,12…` to `…7,7,7,7,11,12,12…`.
     * The literal broke while nothing about the MODEL had changed, which is a
     * test pinning a fixture fact rather than the behaviour it exists to guard.
     *
     * What must hold at any emission: ranks never decrease, at least one tie
     * exists, and every tie is followed by a SKIP — the signature of competition
     * ranking, and the reason `teaserRows` filters on `rank <= 3` instead of
     * slicing. A positional derivation would give 1..n with no ties at all.
     */
    const ranks = leaderboardRows(topSpeed).map((r) => r.rank);
    expect(ranks).toHaveLength(20);
    // Non-decreasing: the artifact is in rank order.
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    // Genuinely not array position + 1.
    expect(ranks).not.toEqual(ranks.map((_, index) => index + 1));
    // At least one real tie cluster.
    expect(new Set(ranks).size).toBeLessThan(ranks.length);
    // Competition ranking: after a run of `n` equal ranks starting at `r`, the
    // next distinct rank is at least `r + n` — never `r + 1`.
    for (let i = 0; i < ranks.length; i += 1) {
      const run = ranks.filter((rank) => rank === ranks[i]).length;
      const next = ranks.find((rank) => rank > ranks[i]);
      if (next !== undefined) {
        expect(next, `rank ${ranks[i]} appears ${run}x`).toBeGreaterThanOrEqual(ranks[i] + run);
      }
    }
  });

  it("mints keys that are unique across ALL THREE boards, not just within one", () => {
    /*
     * The key is board-qualified (`scope-metricCode-entityId`) precisely
     * because one page renders several boards and a bare entity id repeats
     * across them — the same six team ids appear on both team boards.
     */
    const keys = boards.flatMap((board) => leaderboardRows(board).map((r) => r.key));
    expect(keys).toHaveLength(32);
    expect(new Set(keys).size).toBe(32);
  });

  it("qualifies the key by scope AND metricCode", () => {
    const first = leaderboardRows(possession)[0];
    expect(first.key).toBe(`team-possession-${possession.rows[0].entity.id}`);
    // The same team on the other team board takes a different key.
    const sameTeamElsewhere = leaderboardRows(distanceCovered).find(
      (r) => r.entityId === first.entityId
    );
    expect(sameTeamElsewhere).toBeDefined();
    expect(sameTeamElsewhere?.key).not.toBe(first.key);
  });

  it("preserves a null perMatch as null and NEVER as 0 (2.11a decision 3)", () => {
    /*
     * `?? 0` would sort the nulls into the MIDDLE of the numeric order and
     * claim a rate of zero for a metric that has none. compareNumberNullLast
     * sorts nulls to the array END in both directions; only a real null gets
     * that treatment.
     */
    const rows = leaderboardRows(topSpeed);
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.perMatch === null)).toBe(true);
    expect(rows.some((r) => r.perMatch === 0)).toBe(false);
    // The team boards carry a real perMatch on every row.
    expect(leaderboardRows(possession).every((r) => r.perMatch !== null)).toBe(true);
  });

  it("carries the row's team through, distinct from the entity on a player board", () => {
    const rows = leaderboardRows(topSpeed);
    expect(rows[0].teamId).not.toBe(rows[0].entityId);
    expect(rows[0].teamName).not.toBe("");
    expect(rows[0].entityName).toBe(topSpeed.rows[0].entity.name);
  });

  it("treats [] and null rows as the SAME empty result, without throwing", () => {
    /*
     * The contract states "Empty array and null are distinct states" for the
     * ARTIFACT — and they are, at the shell: `[]` is ready-with-zero-rows and
     * gets a table, `null` is absence. Both reach THIS function as zero rows,
     * because a pure row builder has nothing else to return; the distinction
     * lives in the component that gates on `boards.length`.
     */
    expect(leaderboardRows(boardWith([]))).toEqual([]);
    expect(
      leaderboardRows(boardWith(null as unknown as LeaderboardRow[]))
    ).toEqual([]);
  });
});

describe("teaserRows — rank <= 3, never slice(0, 3) (Task 2.4, ruling 9)", () => {
  it("yields exactly 3 rows on all three fixture boards", () => {
    for (const board of boards) {
      expect(teaserRows(leaderboardRows(board)), board.metricCode).toHaveLength(3);
    }
  });

  it("DIVERGES from slice(0,3) on a tie at rank 3 — the whole reason for the filter", () => {
    /*
     * THE ASSERTION THAT SEPARATES THE TWO FORMS. On the fixtures they agree at
     * exactly three rows, so only a CONSTRUCTED tie can tell them apart.
     *
     * Ranks are competition-ranked, so a three-way tie at rank 3 is four rows
     * at rank <= 3. `slice(0, 3)` would cut one of an equal trio arbitrarily —
     * a derivation AD-5 forbids and a visible lie about the data. The teaser
     * must therefore state its own count rather than hardcode "3".
     */
    const tiedAtThree = leaderboardRows(
      boardWith([row(1, "a"), row(2, "b"), row(3, "c"), row(3, "d"), row(3, "e"), row(6, "f")])
    );
    const teaser = teaserRows(tiedAtThree);
    expect(teaser).toHaveLength(5);
    expect(teaser.map((r) => r.entityId)).toEqual(["a", "b", "c", "d", "e"]);
    // slice(0,3) would have kept "c" and silently dropped its two equals.
    expect(teaser.map((r) => r.entityId)).not.toEqual(
      tiedAtThree.slice(0, 3).map((r) => r.entityId)
    );
  });

  it("yields three rows on a three-way tie at rank 1, where slice(0,3) agrees", () => {
    // The other side of the same coin: agreement here is a coincidence of the
    // shape, not a property, which is why the divergence case above exists.
    const tiedAtOne = leaderboardRows(
      boardWith([row(1, "a"), row(1, "b"), row(1, "c"), row(4, "d")])
    );
    expect(teaserRows(tiedAtOne)).toHaveLength(3);
    expect(teaserRows(tiedAtOne).map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("yields nothing on an empty board rather than throwing", () => {
    expect(teaserRows([])).toEqual([]);
  });
});

describe("teaserBoard — the card is bounded, and says so (2.13 review, ruling A)", () => {
  it("prints every qualifying row and withholds nothing on all three fixture boards", () => {
    for (const board of boards) {
      const teaser = teaserBoard(leaderboardRows(board));
      expect(teaser.shown, board.metricCode).toHaveLength(3);
      expect(teaser.hiddenCount, board.metricCode).toBe(0);
      expect(teaser.hiddenRank, board.metricCode).toBeNull();
    }
  });

  it("caps a degenerate rank-1 tie and NAMES the rank the withheld rows share", () => {
    /*
     * THE REAL SHAPE THE FIXTURE CANNOT REACH. On the real emission
     * `passCompletion/player` puts 51 one-match players at rank 1 with a value
     * of 100 — so the card was a 51-entry list inside a three-up grid. Ruling 9
     * is untouched: `teaserRows` still selects all 51. What is bounded is the
     * CARD, and it states the count it withheld, so nothing is misstated.
     */
    const fiftyOneTied = leaderboardRows(
      boardWith(Array.from({ length: 51 }, (_, index) => row(1, `p${String(index)}`)))
    );
    expect(teaserRows(fiftyOneTied)).toHaveLength(51);

    const teaser = teaserBoard(fiftyOneTied);
    expect(teaser.shown).toHaveLength(TEASER_LIMIT);
    expect(teaser.hiddenCount).toBe(48);
    expect(teaser.hiddenRank).toBe(1);
  });

  it("REFUSES to name a rank the withheld rows do not all share", () => {
    // Withheld rows spanning ranks 2 and 3: claiming either would be exactly
    // the misstatement the disclosure exists to avoid, so it stays null and the
    // call site falls back to the generic "+N más" form.
    const spread = leaderboardRows(
      boardWith([row(1, "a"), row(2, "b"), row(2, "c"), row(2, "d"), row(3, "e")])
    );
    const teaser = teaserBoard(spread);
    expect(teaser.shown).toHaveLength(3);
    expect(teaser.hiddenCount).toBe(2);
    expect(teaser.hiddenRank).toBeNull();
  });

  it("names the rank when every withheld row shares it, even below rank 1", () => {
    const tiedAtThree = leaderboardRows(
      boardWith([row(1, "a"), row(2, "b"), row(3, "c"), row(3, "d"), row(3, "e")])
    );
    const teaser = teaserBoard(tiedAtThree);
    expect(teaser.hiddenCount).toBe(2);
    expect(teaser.hiddenRank).toBe(3);
  });

  it("holds on zero rows and on a board shorter than the limit", () => {
    expect(teaserBoard([])).toEqual({ shown: [], hiddenCount: 0, hiddenRank: null });
    const two = leaderboardRows(boardWith([row(1, "a"), row(2, "b")]));
    expect(teaserBoard(two).shown).toHaveLength(2);
    expect(teaserBoard(two).hiddenCount).toBe(0);
  });
});

describe("leaderboardTeasers — the build-time projection (2.13 review)", () => {
  /*
   * THE PROP THE CLIENT COMPONENT RECEIVES IS SERIALIZED INTO THE EXPORTED
   * HTML, so it must carry the rows the teaser PAINTS and nothing else. Passing
   * the whole artifact inlined all 32 fixture rows to render 9, and the runtime
   * region then fetched the same bytes again; at the 2.19 DATA_ROOT flip that
   * is ~409 KB inlined into the Hub document AND re-downloaded.
   */
  it("carries at most TEASER_LIMIT rows per board, never the whole artifact", () => {
    const projected = leaderboardTeasers(boards);
    expect(projected).toHaveLength(boards.length);
    for (const teaser of projected) {
      expect(teaser.shown.length).toBeLessThanOrEqual(TEASER_LIMIT);
    }
    const projectedRows = projected.reduce((total, teaser) => total + teaser.shown.length, 0);
    const artifactRows = boards.reduce((total, board) => total + board.rows.length, 0);
    expect(projectedRows).toBe(9);
    expect(artifactRows).toBe(32);
    expect(projectedRows).toBeLessThan(artifactRows);
  });

  it("keeps the board identity the card needs to render its own heading", () => {
    const projected = leaderboardTeasers(boards);
    expect(projected.map((teaser) => `${teaser.scope}-${teaser.metricCode}`)).toEqual(
      boards.map((board) => `${board.scope}-${board.metricCode}`)
    );
  });

  it("carries no artifact field the teaser does not paint", () => {
    // `higherIsBetter`, `aggregation` and every non-teaser row are the RUNTIME
    // region's business; a projection that leaked them back would re-open the
    // defect this exists to close.
    const [first] = leaderboardTeasers(boards);
    expect(Object.keys(first ?? {}).sort()).toEqual([
      "hiddenCount",
      "hiddenRank",
      "metricCode",
      "scope",
      "shown",
    ]);
  });
});

describe("the two presence gates (Task 2.7)", () => {
  it("anyDistinctTeam is FALSE on both team boards — entity repeats team on 12/12 rows", () => {
    expect(anyDistinctTeam(leaderboardRows(possession))).toBe(false);
    expect(anyDistinctTeam(leaderboardRows(distanceCovered))).toBe(false);
  });

  it("anyDistinctTeam is TRUE on the player board", () => {
    expect(anyDistinctTeam(leaderboardRows(topSpeed))).toBe(true);
  });

  it("anyPerMatch is FALSE on topSpeed — perMatch is null on 20/20 rows", () => {
    expect(anyPerMatch(leaderboardRows(topSpeed))).toBe(false);
  });

  /*
   * THE SECOND WAY THE COLUMN EARNS NOTHING, and it shipped (2.13 code review).
   * `possession` is an `aggregation: "average"` board, so `perMatch` IS the
   * value on every row — the table rendered two byte-identical columns of
   * "65,5%". A null check cannot see that, and the gate exists for WIDTH, so it
   * was testing the wrong property. Measured on the real emission too: 48/48
   * `possession/team`, 48/48 `passCompletion/team`, 102/102
   * `passCompletion/player`.
   */
  it("anyPerMatch is FALSE on possession — perMatch REPEATS value on 6/6 average rows", () => {
    const rows = leaderboardRows(possession);
    expect(rows.every((r) => r.perMatch === r.value)).toBe(true);
    expect(anyPerMatch(rows)).toBe(false);
  });

  it("anyPerMatch is TRUE on distanceCovered, where the rate genuinely differs", () => {
    const rows = leaderboardRows(distanceCovered);
    expect(rows.some((r) => r.perMatch !== r.value)).toBe(true);
    expect(anyPerMatch(rows)).toBe(true);
  });

  it("keeps the column when only SOME rows duplicate the value", () => {
    // The mixed case the fixture cannot reach: one genuine rate is enough.
    const mixed = leaderboardRows(
      boardWith([row(1, "a", { value: 5, perMatch: 5 }), row(2, "b", { value: 6, perMatch: 3 })])
    );
    expect(anyPerMatch(mixed)).toBe(true);
  });

  it("flips each gate on a single differing row, so neither is all-or-nothing", () => {
    const mostlySame: LeaderboardTableRow[] = leaderboardRows(
      boardWith([
        row(1, "a", { team: { id: "a", name: "a" } }),
        row(2, "b", { team: { id: "b", name: "b" } }),
        row(3, "c", { team: { id: "other", name: "other" }, perMatch: 4 }),
      ])
    );
    expect(anyDistinctTeam(mostlySame)).toBe(true);
    expect(anyPerMatch(mostlySame)).toBe(true);
    expect(anyDistinctTeam(mostlySame.slice(0, 2))).toBe(false);
    expect(anyPerMatch(mostlySame.slice(0, 2))).toBe(false);
  });

  it("returns false on zero rows for both gates", () => {
    expect(anyDistinctTeam([])).toBe(false);
    expect(anyPerMatch([])).toBe(false);
  });
});

describe("the exhaustive registries (Task 2.5, AD-2)", () => {
  it("assigns a unit to every one of the 32 MetricCode values", () => {
    for (const code of METRIC_CODES) {
      expect(LEADERBOARD_UNIT[code], code).toBeDefined();
    }
    expect(Object.keys(LEADERBOARD_UNIT).sort()).toEqual([...METRIC_CODES].sort());
  });

  it("assigns a number format to every one of the 32 MetricCode values", () => {
    for (const code of METRIC_CODES) {
      expect(LEADERBOARD_FORMAT[code], code).toBeDefined();
    }
    expect(Object.keys(LEADERBOARD_FORMAT).sort()).toEqual([...METRIC_CODES].sort());
  });

  it("follows MetricCode's OWN scoping rule: no code carries two units", () => {
    /*
     * The contract's JSDoc rules the assignment, not taste: "'distanceCovered'
     * (team, kilometres) and 'totalDistance' (player, metres) … No code carries
     * two units."
     */
    expect(LEADERBOARD_UNIT.distanceCovered).toBe("km");
    expect(LEADERBOARD_UNIT.sprintDistance).toBe("km");
    expect(LEADERBOARD_UNIT.totalDistance).toBe("m");
    expect(LEADERBOARD_UNIT.topSpeed).toBe("kmh");
    expect(LEADERBOARD_UNIT.possession).toBe("percent");
    expect(LEADERBOARD_UNIT.passCompletion).toBe("percent");
    expect(LEADERBOARD_UNIT.goals).toBe("count");
    expect(LEADERBOARD_UNIT.expectedGoals).toBe("count");
  });

  it("pairs every percent unit with the percent format and vice versa", () => {
    for (const code of METRIC_CODES) {
      expect(LEADERBOARD_UNIT[code] === "percent", code).toBe(
        LEADERBOARD_FORMAT[code] === "percent"
      );
    }
  });

  it("never formats a count with decimals", () => {
    for (const code of METRIC_CODES) {
      if (LEADERBOARD_UNIT[code] === "count") {
        expect(["integer", "decimal2"], code).toContain(LEADERBOARD_FORMAT[code]);
      }
    }
    // xG is the one count-unit metric that is NOT an integer.
    expect(LEADERBOARD_FORMAT.expectedGoals).toBe("decimal2");
    expect(LEADERBOARD_FORMAT.goals).toBe("integer");
  });
});

describe("the key builders (Task 2.6)", () => {
  it("builds enums.leaderboardMetric.<code> for every code", () => {
    for (const code of METRIC_CODES) {
      expect(leaderboardMetricKey(code)).toBe(`enums.leaderboardMetric.${code}`);
    }
  });

  it("returns an abbreviation key for exactly the ABBREVIATED_METRICS, null elsewhere", () => {
    const abbreviated = METRIC_CODES.filter((code) => leaderboardMetricAbbrKey(code) !== null);
    expect(abbreviated.sort()).toEqual(Object.keys(ABBREVIATED_METRICS).sort());
    expect(abbreviated).toHaveLength(2);
    expect(abbreviated.sort()).toEqual(["highSpeedRuns", "topSpeed"]);
  });

  it("builds enums.leaderboardMetricAbbr.<code> for an abbreviated code", () => {
    expect(leaderboardMetricAbbrKey("topSpeed")).toBe("enums.leaderboardMetricAbbr.topSpeed");
    expect(leaderboardMetricAbbrKey("highSpeedRuns")).toBe(
      "enums.leaderboardMetricAbbr.highSpeedRuns"
    );
    expect(leaderboardMetricAbbrKey("goals")).toBeNull();
  });
});

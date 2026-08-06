import { describe, expect, it } from "vitest";

import type {
  Group,
  MatchResultRow,
  Stage,
  StandingsRow,
  Tournament,
} from "@/lib/contract/contract-types";
import {
  GROUPS,
  RESULT_COLUMN_KEYS,
  RESULT_NARROW_COLUMN_KEYS,
  STAGES,
  STANDINGS_COLUMN_KEYS,
  STANDINGS_NARROW_COLUMN_KEYS,
  allResultMatchIds,
  composeHubTitle,
  kickoffSortValue,
  matchHref,
  matchdayRoundLabelKey,
  matchResultLetterKey,
  matchResultWordKey,
  resultRowKey,
  resultsSections,
  scoreline,
  standingsRowKey,
  standingsSections,
  teamHref,
  visibleColumnKeys,
} from "@/lib/hub-model";
import fixture from "../../../data/fixtures/index/tournament.json";

/*
 * The Hub's decision layer, tested where it lives (Task 8). vitest runs
 * `environment: "node"` with no jsdom, so nothing rendered is assertable — every
 * orderable, groupable and key-able decision is pushed into hub-model.ts
 * precisely so this file can hold it.
 *
 * D5: the fixture carries 3 of 104 matches (1 group, 4 standings rows, 2 group
 * results, 1 knockout tie). NOTHING here asserts 104 against it. Totality is
 * proven over SYNTHETIC rows covering all 7 `Stage` values and all 12 `Group`
 * letters, which is exhaustive by construction because both enums are closed.
 */

const TOURNAMENT = fixture as Tournament;

/** A minimal but REAL StandingsRow — never `as unknown as`, which would hide drift. */
function standingsRow(rank: number, teamId: string): StandingsRow {
  return {
    rank,
    team: { id: teamId, name: teamId },
    played: 3,
    won: 1,
    drawn: 1,
    lost: 1,
    goalsFor: 4,
    goalsAgainst: 4,
    goalDifference: 0,
    points: 4,
    form: ["win", "draw", "loss"],
  };
}

/** A minimal but REAL MatchResultRow. `group` is null on every knockout tie. */
function resultRow(input: {
  matchId: string;
  matchNumber: number;
  stage: Stage;
  group: Group | null;
}): MatchResultRow {
  return {
    matchId: input.matchId,
    matchNumber: input.matchNumber,
    stage: input.stage,
    group: input.group,
    matchdayRound: input.stage === "group" ? "group-md1" : input.stage,
    date: "2026-06-11",
    kickoff: "2026-06-11T13:00:00-06:00",
    venue: "Test Stadium",
    homeTeam: { id: "home", name: "Home" },
    awayTeam: { id: "away", name: "Away" },
    score: { home: 1, away: 0 },
    knockoutScore: {
      scoreAfter90: { home: 1, away: 0 },
      scoreAfterET: null,
      shootoutScore: null,
      winnerTeamId: "home",
      decidedBy: "regulation",
    },
  };
}

/** All 7 stages, all 12 groups, one row each — the exhaustive synthetic corpus. */
function syntheticTournament(): Tournament {
  const knockoutStages = STAGES.filter((stage) => stage !== "group");
  return {
    schemaVersion: 4,
    tournamentName: "Synthetic Cup",
    groups: GROUPS.map((group, index) => ({
      group,
      standings: [standingsRow(1, `${group}-first`), standingsRow(2, `${group}-second`)],
      results: [
        resultRow({ matchId: `g-${group}-1`, matchNumber: index * 2 + 1, stage: "group", group }),
        resultRow({ matchId: `g-${group}-2`, matchNumber: index * 2 + 2, stage: "group", group }),
      ],
    })),
    knockoutResults: knockoutStages.map((stage, index) =>
      resultRow({ matchId: `k-${stage}`, matchNumber: 100 + index, stage, group: null })
    ),
    entities: { matches: [], teams: [], players: [] },
  };
}

describe("standingsSections (AC1 — artifact order)", () => {
  it("emits one section per group, in groups[] order, rows verbatim", () => {
    const sections = standingsSections(syntheticTournament());
    expect(sections.map((section) => section.group)).toEqual([...GROUPS]);
    for (const section of sections) {
      expect(section.rows.map((row) => row.rank)).toEqual([1, 2]);
    }
  });

  it("preserves the fixture's rank order without re-sorting", () => {
    const [groupA] = standingsSections(TOURNAMENT);
    expect(groupA.group).toBe("a");
    expect(groupA.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(groupA.rows.map((row) => row.team.id)).toEqual([
      "mexico",
      "south-africa",
      "korea-republic",
      "czechia",
    ]);
  });

  it("does NOT re-order rows that arrive out of ascending rank", () => {
    // AD-5 reserves canonical order to the artifact: whatever the pipeline's
    // FIFA cascade emits is what renders, even if it looks unsorted here.
    const tournament = syntheticTournament();
    tournament.groups[0].standings = [standingsRow(4, "d"), standingsRow(1, "a"), standingsRow(2, "b")];
    const [first] = standingsSections(tournament);
    expect(first.rows.map((row) => row.rank)).toEqual([4, 1, 2]);
  });

  it("gives every section a stable, unique anchor id", () => {
    const ids = standingsSections(syntheticTournament()).map((section) => section.anchorId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("standings-group-a");
  });

  it("tolerates an empty standings array — the zero state, not a dropped section", () => {
    const tournament = syntheticTournament();
    tournament.groups[0].standings = [];
    const sections = standingsSections(tournament);
    expect(sections).toHaveLength(GROUPS.length);
    expect(sections[0].rows).toEqual([]);
  });
});

describe("resultsSections (AC1, AC2 — grouping is total)", () => {
  it("sections per group in groups[] order, then knockout stages by first appearance", () => {
    const sections = resultsSections(syntheticTournament());
    expect(sections).toHaveLength(GROUPS.length + STAGES.length - 1);
    expect(sections.slice(0, GROUPS.length).map((section) => section.heading)).toEqual(
      GROUPS.map((group) => ({ kind: "group", group }))
    );
    expect(sections.slice(GROUPS.length).map((section) => section.heading)).toEqual(
      STAGES.filter((stage) => stage !== "group").map((stage) => ({ kind: "stage", stage }))
    );
  });

  it("drops no row — every result reaches exactly one section", () => {
    const tournament = syntheticTournament();
    const total =
      tournament.groups.reduce((sum, group) => sum + group.results.length, 0) +
      tournament.knockoutResults.length;
    const sections = resultsSections(tournament);
    const emitted = sections.reduce((sum, section) => sum + section.rows.length, 0);
    expect(emitted).toBe(total);
    const ids = sections.flatMap((section) => section.rows.map((row) => row.matchId));
    expect(new Set(ids).size).toBe(total);
  });

  it("preserves knockoutResults[] order WITHIN and ACROSS stage sections", () => {
    /*
     * The schema already guarantees "ordered by stage then match number"
     * (tournament.schema.json:35). Re-sorting it here is exactly the
     * client-side re-ordering AC1/AD-5 forbid, so the section order is
     * FIRST APPEARANCE and never a stage ranking.
     */
    const tournament = syntheticTournament();
    tournament.knockoutResults = [
      resultRow({ matchId: "k-1", matchNumber: 101, stage: "final", group: null }),
      resultRow({ matchId: "k-2", matchNumber: 102, stage: "r32", group: null }),
      resultRow({ matchId: "k-3", matchNumber: 103, stage: "final", group: null }),
    ];
    const knockout = resultsSections(tournament).slice(GROUPS.length);
    expect(knockout.map((section) => section.heading)).toEqual([
      { kind: "stage", stage: "final" },
      { kind: "stage", stage: "r32" },
    ]);
    expect(knockout[0].rows.map((row) => row.matchId)).toEqual(["k-1", "k-3"]);
    expect(knockout[1].rows.map((row) => row.matchId)).toEqual(["k-2"]);
  });

  it("emits no knockout section for a stage with no rows", () => {
    const sections = resultsSections(TOURNAMENT);
    // The fixture carries exactly one knockout tie, in r32.
    const knockout = sections.filter((section) => section.heading.kind === "stage");
    expect(knockout).toHaveLength(1);
    expect(knockout[0].heading).toEqual({ kind: "stage", stage: "r32" });
    expect(knockout[0].anchorId).toBe("results-r32");
  });

  it("keeps a group section whose results array is empty", () => {
    const tournament = syntheticTournament();
    tournament.groups[3].results = [];
    const sections = resultsSections(tournament);
    expect(sections.filter((section) => section.heading.kind === "group")).toHaveLength(
      GROUPS.length
    );
    expect(sections[3].rows).toEqual([]);
  });

  it("gives every section a stable, unique anchor id", () => {
    const ids = resultsSections(syntheticTournament()).map((section) => section.anchorId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("results-group-a");
    expect(ids).toContain("results-third-place");
  });
});

describe("absence states — null, [] AND undefined (Task 8.5)", () => {
  /*
   * The payload reaches these functions through `fetchArtifact<Tournament>`,
   * which `as`-casts unvalidated JSON — so a contract-required array can still
   * be missing at runtime. `[]` and "absent" are distinct states by contract;
   * `undefined` is the third state prior stories forgot, and `.map` of
   * undefined takes the whole route down through the error boundary.
   *
   * The casts below are how a runtime-only shape is expressed in a typed test.
   * They are deliberately NOT `as unknown as Tournament` over a whole
   * constructible object — that would suppress real contract drift, which is a
   * repeat review finding. Each one names exactly the one field being broken.
   */
  it("renders a group whose standings are [] as a section with no rows", () => {
    const tournament = syntheticTournament();
    tournament.groups[0].standings = [];
    expect(standingsSections(tournament)[0].rows).toEqual([]);
  });

  it("survives a MISSING standings array without throwing", () => {
    const tournament = syntheticTournament();
    tournament.groups[0].standings = undefined as unknown as StandingsRow[];
    const sections = standingsSections(tournament);
    expect(sections).toHaveLength(GROUPS.length);
    expect(sections[0].rows).toEqual([]);
  });

  it("survives a NULL standings array without throwing", () => {
    const tournament = syntheticTournament();
    tournament.groups[0].standings = null as unknown as StandingsRow[];
    expect(standingsSections(tournament)[0].rows).toEqual([]);
  });

  it("survives missing groups and missing knockoutResults", () => {
    const tournament = syntheticTournament();
    tournament.groups = undefined as unknown as Tournament["groups"];
    tournament.knockoutResults = undefined as unknown as MatchResultRow[];
    expect(standingsSections(tournament)).toEqual([]);
    expect(resultsSections(tournament)).toEqual([]);
    expect(allResultMatchIds(tournament)).toEqual([]);
  });

  it("survives a missing results array on one group", () => {
    const tournament = syntheticTournament();
    tournament.groups[2].results = undefined as unknown as MatchResultRow[];
    const sections = resultsSections(tournament);
    expect(sections[2].rows).toEqual([]);
    // The other eleven groups are untouched — one bad group does not blank the
    // surface.
    expect(sections[3].rows).toHaveLength(2);
  });
});

describe("bijection between the results listing and the route manifest (AC2)", () => {
  it("the union of group and knockout matchIds equals entities.matches", () => {
    const listed = allResultMatchIds(TOURNAMENT).sort();
    const manifest = TOURNAMENT.entities.matches.map((match) => match.matchId).sort();
    expect(listed).toEqual(manifest);
  });

  it("every listed match therefore has a Match Dashboard href", () => {
    for (const matchId of allResultMatchIds(TOURNAMENT)) {
      expect(matchHref(matchId)).toBe(`/matches/${matchId}/`);
    }
  });
});

describe("row keys (D3 — rank is never an identity)", () => {
  it("keys standings rows on team.id, so tied ranks do not collapse", () => {
    const tied = [standingsRow(7, "alpha"), standingsRow(7, "beta"), standingsRow(7, "gamma")];
    const keys = tied.map(standingsRowKey);
    expect(new Set(keys).size).toBe(3);
    // A rank-derived key would give three identical keys here. Assert the
    // rank is absent from the key at all, not merely that they differ.
    for (const key of keys) {
      expect(key).not.toContain("7");
    }
  });

  it("keys result rows on matchId", () => {
    expect(resultRowKey(resultRow({ matchId: "m074-a-b", matchNumber: 74, stage: "r32", group: null })))
      .toContain("m074-a-b");
  });

  it("keys are stable across a re-sort — they are derived from identity, not position", () => {
    const rows = [standingsRow(1, "a"), standingsRow(2, "b")];
    const before = rows.map(standingsRowKey);
    const after = [...rows].reverse().map(standingsRowKey);
    expect(after).toEqual([...before].reverse());
  });
});

describe("hrefs (D2, AC2)", () => {
  it("carries the trailing slash next.config.ts requires", () => {
    expect(teamHref("mexico")).toBe("/teams/mexico/");
    expect(matchHref("m001-mexico-south-africa")).toBe("/matches/m001-mexico-south-africa/");
  });
});

describe("scoreline", () => {
  it("composes home, separator, away with no hardcoded glyph", () => {
    expect(scoreline({ home: 2, away: 0 }, "–")).toBe("2–0");
  });
});

describe("dictionary key helpers (AD-7 — keyed off the enum, never off a letter)", () => {
  it("keys chip letters and their spoken words off MatchResult", () => {
    expect(matchResultLetterKey("win")).toBe("enums.matchResult.win");
    expect(matchResultWordKey("loss")).toBe("enums.matchResultFull.loss");
  });

  it("keys matchday-round labels off MatchdayRound", () => {
    expect(matchdayRoundLabelKey("group-md3")).toBe("enums.matchdayRound.group-md3");
    expect(matchdayRoundLabelKey("third-place")).toBe("enums.matchdayRound.third-place");
  });
});

describe("visibleColumnKeys (AC4 — the disclosure HIDES, it never removes data)", () => {
  it("shows the full set at >=md regardless of the disclosure", () => {
    expect(visibleColumnKeys(STANDINGS_COLUMN_KEYS, STANDINGS_NARROW_COLUMN_KEYS, false, false)).toEqual([
      ...STANDINGS_COLUMN_KEYS,
    ]);
    expect(visibleColumnKeys(STANDINGS_COLUMN_KEYS, STANDINGS_NARROW_COLUMN_KEYS, false, true)).toEqual([
      ...STANDINGS_COLUMN_KEYS,
    ]);
  });

  it("shows the narrow set below md until the disclosure is expanded", () => {
    expect(visibleColumnKeys(STANDINGS_COLUMN_KEYS, STANDINGS_NARROW_COLUMN_KEYS, true, false)).toEqual([
      ...STANDINGS_NARROW_COLUMN_KEYS,
    ]);
    expect(visibleColumnKeys(STANDINGS_COLUMN_KEYS, STANDINGS_NARROW_COLUMN_KEYS, true, true)).toEqual([
      ...STANDINGS_COLUMN_KEYS,
    ]);
  });

  it("keeps the narrow set in full-set order and as a strict subset", () => {
    for (const [all, narrow] of [
      [STANDINGS_COLUMN_KEYS, STANDINGS_NARROW_COLUMN_KEYS],
      [RESULT_COLUMN_KEYS, RESULT_NARROW_COLUMN_KEYS],
    ] as const) {
      expect(narrow.length).toBeLessThan(all.length);
      for (const key of narrow) {
        expect(all).toContain(key);
      }
      expect([...narrow]).toEqual(all.filter((key) => (narrow as readonly string[]).includes(key)));
    }
  });

  it("always keeps the row-header column visible — a table with no row header is unnamed", () => {
    expect(STANDINGS_NARROW_COLUMN_KEYS).toContain("team");
    expect(RESULT_NARROW_COLUMN_KEYS).toContain("match");
  });
});

describe("kickoffSortValue", () => {
  it("reads VENUE-LOCAL wall-clock minutes, not the instant", () => {
    // 13:00-06:00 is a LATER instant than 16:30-04:00, and an earlier
    // wall clock. The column reads "13:00", so it must sort first.
    expect(kickoffSortValue("2026-06-11T13:00:00-06:00")).toBe(13 * 60);
    expect(kickoffSortValue("2026-06-29T16:30:00-04:00")).toBe(16 * 60 + 30);
    expect(kickoffSortValue("2026-06-11T13:00:00-06:00")).toBeLessThan(
      kickoffSortValue("2026-06-29T16:30:00-04:00") ?? 0
    );
  });

  it("ignores the date, so a Hora sort never becomes a date sort", () => {
    expect(kickoffSortValue("2026-06-11T20:00:00-06:00")).toBe(
      kickoffSortValue("2026-07-19T20:00:00+02:00")
    );
  });

  it("returns null — never 0 — for an unparseable value", () => {
    expect(kickoffSortValue("not-a-datetime")).toBeNull();
    expect(kickoffSortValue("2026-06-11T99:00:00-06:00")).toBeNull();
    expect(kickoffSortValue("")).toBeNull();
  });

  it("keeps midnight distinguishable from absent", () => {
    expect(kickoffSortValue("2026-06-11T00:00:00-06:00")).toBe(0);
  });
});

describe("composeHubTitle", () => {
  it("passes the tournament name through as a proper noun (AD-7)", () => {
    expect(
      composeHubTitle({
        tournamentName: "FIFA World Cup 2026",
        siteName: "WC Stats",
        separator: " · ",
      })
    ).toBe("FIFA World Cup 2026 · WC Stats");
  });
});

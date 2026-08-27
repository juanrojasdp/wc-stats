import { describe, expect, it } from "vitest";

import type { TeamEntity } from "@/lib/contract/contract-types";
import { composeTeamRecord, teamIndexRows } from "@/lib/teams-index";

/*
 * The `/teams` index model (Story 3.9, D5). Pure, `node`-environment, same
 * precedent as `players-index.ts`.
 *
 * `/teams` is a FLAT list of 48 — no disclosure, because 48 rows is not dense —
 * so this module is much smaller than the players one. What it does own is the
 * one composition on the surface: played–won–drawn–lost as a single cell.
 */

function team(teamId: string, name: string, group: string, record: TeamEntity["record"]): TeamEntity {
  return { teamId, name, teamCode: teamId.slice(0, 3), group, record } as TeamEntity;
}

const RECORD = { played: 4, won: 1, drawn: 1, lost: 2, goalsFor: 5, goalsAgainst: 9 };

const FIXTURE: readonly TeamEntity[] = [
  team("brazil", "Brazil", "c", RECORD),
  team("algeria", "Algeria", "j", RECORD),
];

describe("composeTeamRecord", () => {
  it("joins played–won–drawn–lost in that order, with the registered separator", () => {
    expect(composeTeamRecord(RECORD, "-")).toBe("4-1-1-2");
  });

  it("takes the separator as an argument rather than hardcoding a glyph", () => {
    /*
     * The separator is a LOCALE-REGISTERED string (`team.meta.recordSeparator`),
     * so no component and no model hardcodes it. Passing it in is what keeps
     * this module free of `t()` and therefore testable in `node`.
     */
    expect(composeTeamRecord(RECORD, "·")).toBe("4·1·1·2");
  });

  it("renders a goalless, matchless record as zeros and never as an em dash", () => {
    // A team with no matches played is a real state in a partial corpus. It is
    // 0-0-0-0, which is a fact; an em dash would claim the data is absent.
    expect(
      composeTeamRecord({ played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }, "-")
    ).toBe("0-0-0-0");
  });
});

describe("teamIndexRows", () => {
  it("preserves ARTIFACT ORDER, never sorting alphabetically or by group", () => {
    // Brazil before Algeria, because that is the order the artifact gave.
    expect(teamIndexRows(FIXTURE).map((row) => row.teamId)).toEqual(["brazil", "algeria"]);
  });

  it("upper-cases the group letter for display without touching the artifact value", () => {
    /*
     * The artifact stores `group: "j"` lowercase (it is an id). The standings
     * surface renders "J". `/teams` must agree with it — the two surfaces name
     * the same group, and one showing "j" beside the other's "J" is the kind of
     * drift the redundancy in D5 makes visible.
     */
    const [brazil, algeria] = teamIndexRows(FIXTURE);
    expect(brazil.groupLabel).toBe("C");
    expect(algeria.groupLabel).toBe("J");
  });

  it("carries the team name through untranslated (AD-7)", () => {
    expect(teamIndexRows(FIXTURE)[0].name).toBe("Brazil");
  });

  it("returns an empty list for an empty index", () => {
    expect(teamIndexRows([])).toEqual([]);
  });
});

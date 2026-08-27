import { describe, expect, it } from "vitest";

import type { PlayerEntity } from "@/lib/contract/contract-types";
import { filterPlayerGroups, groupPlayersByTeam } from "@/lib/players-index";

/*
 * The `/players` index model (Story 3.9, D4). A `node`-environment test over a
 * PURE module — no React, no DOM, no `t()` — following `hub-model.ts`'s
 * precedent, which is what makes the grouping, ordering and filtering
 * assertable without rendering 48 disclosures.
 *
 * A2: every fixture below is authored here rather than borrowed from the real
 * corpus, so a change in the artifact cannot silently change what these
 * assertions mean.
 */

function player(
  name: string,
  position: PlayerEntity["position"],
  teamId: string,
  teamName: string
): PlayerEntity {
  return {
    playerId: `${name.toLowerCase().replace(/\s+/g, "-")}-${teamId}`,
    name,
    position,
    team: { id: teamId, name: teamName },
  };
}

/*
 * Deliberately NOT in artifact order for teams, NOT in position order within a
 * team, and NOT in name order within a position — so every one of the three
 * ordering rules has something to actually do.
 */
const FIXTURE: readonly PlayerEntity[] = [
  player("Zoe ZAMORA", "mf", "arg", "Argentina"),
  player("Ana ALVAREZ", "fw", "arg", "Argentina"),
  player("Beto BENITEZ", "gk", "arg", "Argentina"),
  player("Carlos DELGADO", "df", "arg", "Argentina"),
  player("Ana ALFARO", "mf", "arg", "Argentina"),
  player("Diego DIAZ", "fw", "bra", "Brazil"),
  player("Elena ESPINOZA", "gk", "bra", "Brazil"),
];

describe("groupPlayersByTeam", () => {
  it("groups by team in ARTIFACT ORDER, never alphabetically", () => {
    /*
     * Argentina precedes Brazil here because it appears first in the array, not
     * because "A" precedes "B". The distinction is invisible on this fixture by
     * design of the next case, which reverses it.
     */
    const groups = groupPlayersByTeam(FIXTURE);
    expect(groups.map((group) => group.teamId)).toEqual(["arg", "bra"]);
  });

  it("REALLY follows the artifact and not the alphabet", () => {
    // The same two teams, artifact order reversed. An alphabetical
    // implementation passes the case above and fails this one.
    const reversed = [...FIXTURE].reverse();
    const groups = groupPlayersByTeam(reversed);
    expect(groups.map((group) => group.teamId)).toEqual(["bra", "arg"]);
  });

  it("orders within a team by POSITION (gk, df, mf, fw), then by name", () => {
    const [argentina] = groupPlayersByTeam(FIXTURE);
    expect(argentina.players.map((entry) => entry.name)).toEqual([
      "Beto BENITEZ", // gk
      "Carlos DELGADO", // df
      "Ana ALFARO", // mf  — ALFARO before ZAMORA
      "Zoe ZAMORA", // mf
      "Ana ALVAREZ", // fw
    ]);
  });

  it("carries the team's name and its own count, for the heading OUTSIDE the disclosure", () => {
    const groups = groupPlayersByTeam(FIXTURE);
    expect(groups[0]).toMatchObject({ teamId: "arg", teamName: "Argentina", count: 5 });
    expect(groups[1]).toMatchObject({ teamId: "bra", teamName: "Brazil", count: 2 });
  });

  it("returns no groups for an empty index rather than one empty group", () => {
    expect(groupPlayersByTeam([])).toEqual([]);
  });
});

describe("filterPlayerGroups", () => {
  const groups = groupPlayersByTeam(FIXTURE);

  it("keeps EVERY group rendered when the filter matches nothing", () => {
    /*
     * 🔴 THE STRUCTURAL PROMISE (EXPERIENCE.md → State Patterns, D4). The filter
     * narrows what is INSIDE the groups; it never collapses the page's
     * structure. A reader who over-types must still see the 48 headings and
     * their counts, or the page appears to have lost its teams.
     */
    const filtered = filterPlayerGroups(groups, "qqqq");
    expect(filtered.groups).toHaveLength(groups.length);
    expect(filtered.groups.every((group) => group.players.length === 0)).toBe(true);
    expect(filtered.total).toBe(0);
  });

  it("filters the WHOLE set, not only what is open", () => {
    // Matches one player in each of the two groups — a filter scoped to a
    // single open disclosure would return one.
    const filtered = filterPlayerGroups(groups, "d");
    expect(filtered.total).toBe(2);
    expect(filtered.groups[0].players.map((entry) => entry.name)).toEqual(["Carlos DELGADO"]);
    expect(filtered.groups[1].players.map((entry) => entry.name)).toEqual(["Diego DIAZ"]);
  });

  it("is ACCENT- and CASE-insensitive", () => {
    const accented = groupPlayersByTeam([player("Ángel ÁVILA", "fw", "esp", "Spain")]);
    expect(filterPlayerGroups(accented, "angel").total).toBe(1);
    expect(filterPlayerGroups(accented, "ÁNGEL").total).toBe(1);
    expect(filterPlayerGroups(accented, "avila").total).toBe(1);
  });

  it("treats a blank or whitespace-only query as no filter at all", () => {
    // Trimmed at the filter, not inside the matcher: "" matching everything is
    // correct substring semantics, and it is the FILTER that should ignore
    // surrounding space — `LeaderboardsRegion`'s ruling, applied here.
    expect(filterPlayerGroups(groups, "").total).toBe(FIXTURE.length);
    expect(filterPlayerGroups(groups, "   ").total).toBe(FIXTURE.length);
  });

  it("counts what it returns, so the live region cannot disagree with the page", () => {
    const filtered = filterPlayerGroups(groups, "an");
    const rendered = filtered.groups.reduce((sum, group) => sum + group.players.length, 0);
    expect(filtered.total).toBe(rendered);
  });

  it("does NOT match on the team name — this is a name filter", () => {
    /*
     * `LeaderboardsRegion`'s filter matches the team name too, because its rows
     * carry a team column a reader can see. These rows are position + name; the
     * team is the GROUP HEADING. Matching a column that is not on the row would
     * return players whose visible text does not contain the query.
     */
    expect(filterPlayerGroups(groups, "Argentina").total).toBe(0);
  });
});

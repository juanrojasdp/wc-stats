import type { TeamEntity, TeamRecord } from "@/lib/contract/contract-types";

/*
 * ═══════════ THE `/teams` INDEX MODEL (Story 3.9, D5) ═══════════
 *
 * Pure, `node`-environment testable, same precedent as `players-index.ts` and
 * `hub-model.ts`. It is deliberately small: `/teams` is a FLAT list of 48 rows —
 * name, group, record — with no disclosure, because 48 rows is not dense and
 * SM-C2's grammar is for surfaces that are.
 *
 * ⚠️ THIS SURFACE IS KNOWINGLY REDUNDANT, AND THAT IS RECORDED AS A COST
 * RATHER THAN DRESSED UP AS A BENEFIT (D5). `/tournament#standings` already
 * carries the same 48 teams with more competitive context — rank, points, goal
 * difference and the form strip. `/teams` exists so that no member of the ruled
 * badge grid resolves to a FRAGMENT while its neighbours resolve to pages, which
 * is a navigation-consistency reason and not an information one. It is not a
 * dense surface and it carries no performance expectation beyond not regressing.
 *
 * The three columns are what `entities.teams[]` actually carries. It has no
 * rank and no points — those are computed per group by the pipeline and live in
 * `groups`, on the standings surface. This index does not go and get them: a
 * partial standings table beside a complete one is worse than an honest short
 * one.
 */

/** One rendered row of `/teams`. */
export interface TeamIndexRow {
  teamId: string;
  name: string;
  /** The artifact's group id, lower-case, as stored. */
  group: string;
  /** The group as the standings surface displays it — upper-case. */
  groupLabel: string;
  record: TeamRecord;
}

/**
 * Played–won–drawn–lost as one cell, in that order.
 *
 * THE SEPARATOR IS PASSED IN, never hardcoded: it is a locale-registered string
 * (`team.meta.recordSeparator`), and taking it as an argument is what keeps this
 * module free of `t()` and therefore testable in the `node` environment.
 *
 * Zeros render as zeros. A team with no matches played is 0-0-0-0, which is a
 * fact about the tournament; an em dash would claim the data is missing.
 */
export function composeTeamRecord(record: TeamRecord, separator: string): string {
  return [record.played, record.won, record.drawn, record.lost].join(separator);
}

/**
 * Project the artifact's teams into rows, IN ARTIFACT ORDER.
 *
 * Artifact order, not alphabetical and not by group, for the reason AD-5 gives
 * everywhere else: the pipeline decides order and the App does not re-derive it.
 * The Hub's standings and results already render this way.
 *
 * The group is upper-cased FOR DISPLAY ONLY — the artifact stores it lower-case
 * as an id, and `/tournament#standings` displays it upper-case. Two surfaces
 * naming the same group must spell it the same way, and this file's whole
 * redundancy (see the header) is what would make a disagreement visible.
 */
export function teamIndexRows(teams: readonly TeamEntity[]): readonly TeamIndexRow[] {
  return teams.map((entry) => ({
    teamId: entry.teamId,
    // Untranslated: a team name is a proper noun, not a label (AD-7).
    name: entry.name,
    group: entry.group,
    groupLabel: entry.group.toUpperCase(),
    record: entry.record,
  }));
}

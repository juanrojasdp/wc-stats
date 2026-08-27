import type { PlayerEntity, Position } from "@/lib/contract/contract-types";
import { compareText, includesText } from "@/lib/format";

/*
 * ═══════════ THE `/players` INDEX MODEL (Story 3.9, D4) ═══════════
 *
 * The grouping, the ordering and the filtering behind `/players`, as a PURE
 * module — no React, no DOM, no `t()`. That is what makes it testable in the
 * `node` environment `vitest.config.ts` defaults to, and it follows
 * `hub-model.ts`'s precedent rather than inventing a second shape.
 *
 * ═══════════ WHAT THE DATA ALLOWS, AND NOTHING MORE ═══════════
 *
 * `entities.players[]` carries exactly four fields: `name`, `playerId`,
 * `position` and `team {id, name}`. No shirt number, no club, no minutes. No
 * index surface may imply data the artifact does not carry, so the rendered row
 * is POSITION + NAME and nothing else — the team is the group heading, and
 * repeating it per row is noise at 390 px.
 *
 * ═══════════ WHY GROUPED BY TEAM, AND NOT THE TWO OBVIOUS ALTERNATIVES ══════
 *
 * Recorded so they are not re-litigated (D4):
 *
 *  · BY POSITION is four buckets of ~312 players. It groups without informing.
 *  · A–Z is 26 buckets, but names arrive as "Brenden AARONSON" — given name
 *    first — so a naive sort orders by GIVEN name, and fixing it needs a surname
 *    key the index does not carry. Splitting on whitespace is not that key:
 *    "Van Dijk" and "De Bruyne" are two tokens of one surname.
 *
 * Grouped by team is 48 buckets of ~26, which is the Hub's shipped SM-C2 idiom
 * applied unchanged — nothing deleted, everything one click away.
 */

/** One team's group: the heading, its count, and its ordered players. */
export interface PlayerTeamGroup {
  teamId: string;
  teamName: string;
  /**
   * The number of players in THIS group as rendered. Held as a field rather
   * than left to `players.length` at the call site because the count is
   * rendered OUTSIDE the disclosure (SM-C2: a reader must know the size of a
   * thing before deciding to open it), while `players` is what goes inside.
   */
  count: number;
  players: readonly PlayerEntity[];
}

/** A filtered view, plus the total the polite live region announces. */
export interface FilteredPlayerGroups {
  groups: readonly PlayerTeamGroup[];
  total: number;
}

/*
 * THE RENDER ORDER OF POSITIONS, goalkeeper outward. It is the order every
 * lineup block in the source reports prints, and the order `es.enums.position`
 * declares.
 *
 * 🔴 `Record<Position, number>` IS THE GUARD, and it is the only one (corrected
 * at code review 2026-08-27). A `Position` added to the contract without a line
 * here is a TYPE error because this is an exhaustive `Record` over the union —
 * an object literal missing a key does not satisfy it.
 *
 * The docblock previously credited a `readonly Position[]` array literal with
 * that property. An array is not a tuple and carries no per-member obligation,
 * so widening the union produced no error there at all; the real guard was the
 * line below it and was undocumented. A dead `positionOrder()` export sat
 * alongside, described as feeding "the column-head expansion and tests" and
 * imported by neither.
 */
const POSITION_RANK: Record<Position, number> = {
  gk: 0,
  df: 1,
  mf: 2,
  fw: 3,
};

/**
 * The sort rank for a position, with a defined answer for a value outside the
 * union.
 *
 * ⚠️ THE UNION IS A COMPILE-TIME PROMISE AND THE PAYLOAD IS NOT CHECKED AGAINST
 * IT. `fetchArtifact` `as`-casts unvalidated JSON, so a contract that widens
 * `Position` before the App rebuilds delivers a string this module has never
 * heard of. A bare `POSITION_RANK[unknown]` is `undefined`, and
 * `undefined - number` is `NaN` — a comparator returning `NaN` leaves the array
 * in an implementation-defined order, SILENTLY, with nothing thrown for an
 * error boundary to catch.
 *
 * Unknown positions sort to the end, together, in name order. That is a visible,
 * explainable result rather than an arbitrary one.
 */
function positionRank(position: Position): number {
  return POSITION_RANK[position] ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Group the index by team, TEAMS IN ARTIFACT ORDER, players within a team by
 * position (gk → df → mf → fw) and then by name.
 *
 * 🔴 ARTIFACT ORDER IS A DECISION, NOT AN ACCIDENT. The pipeline emits teams in
 * an order the tournament itself gives them, and the Hub's standings and results
 * already render in artifact order — AD-5 forbids the App re-deriving what the
 * pipeline computed. Sorting alphabetically here would make `/players` the one
 * surface that disagrees with every other, in a way no test would notice unless
 * it looked, which is why `players-index.test.ts` asserts it against a REVERSED
 * fixture rather than one where the two orders coincide.
 *
 * A `Map` preserves insertion order for string keys, which is exactly the
 * first-appearance semantics wanted here.
 */
export function groupPlayersByTeam(
  players: readonly PlayerEntity[]
): readonly PlayerTeamGroup[] {
  const byTeam = new Map<string, { teamName: string; players: PlayerEntity[] }>();

  for (const entry of players) {
    const existing = byTeam.get(entry.team.id);
    if (existing === undefined) {
      byTeam.set(entry.team.id, { teamName: entry.team.name, players: [entry] });
    } else {
      existing.players.push(entry);
    }
  }

  return [...byTeam].map(([teamId, group]) => {
    /*
     * `compareText` and never a bare `<` or `localeCompare` — `format.ts`
     * declares itself "the ONLY text comparison for sorting", and its collator
     * is base-sensitivity, so accents and case never split two names that
     * should sort together.
     *
     * Sorted on a COPY: `Array.prototype.sort` mutates, and the caller handed us
     * a `readonly` array whose order is the artifact's.
     */
    const ordered = [...group.players].sort((a, b) => {
      const byPosition = positionRank(a.position) - positionRank(b.position);
      return byPosition !== 0 ? byPosition : compareText(a.name, b.name);
    });
    return {
      teamId,
      teamName: group.teamName,
      count: ordered.length,
      players: ordered,
    };
  });
}

/**
 * Narrow every group by a name query, KEEPING EVERY GROUP.
 *
 * 🔴 THE STRUCTURAL PROMISE. A group that matches nothing comes back with an
 * empty `players` array — it is NOT dropped. EXPERIENCE.md → State Patterns
 * rules that the 48 group headings and their counts stay rendered while the
 * filter narrows what is inside them, because a filter that collapses the page's
 * structure makes an over-typed query look like a page that lost its teams.
 *
 * It filters THE WHOLE SET, not only what is open: a disclosure the reader has
 * not touched still reports how many of its players match.
 *
 * `includesText` is the shipped accent- and case-insensitive substring matcher
 * (`format.ts`), which normalizes rather than collates because `Intl` has no
 * substring operation at all. The query is trimmed HERE rather than inside the
 * matcher: "" matching everything is correct substring semantics, and it is the
 * FILTER that should ignore surrounding space — `LeaderboardsRegion`'s ruling.
 *
 * It matches the NAME ONLY. `LeaderboardsRegion` also matches its team column,
 * because its rows carry one a reader can see; these rows are position + name,
 * so matching the group heading would return players whose visible row text does
 * not contain the query.
 */
export function filterPlayerGroups(
  groups: readonly PlayerTeamGroup[],
  query: string
): FilteredPlayerGroups {
  const needle = query.trim();
  if (needle === "") {
    return {
      groups,
      total: groups.reduce((sum, group) => sum + group.players.length, 0),
    };
  }

  /*
   * `count` IS RECOMPUTED, NOT CARRIED THROUGH. It names what is inside this
   * disclosure, and the heading renders it outside the control — so a group
   * still advertising 26 while holding 1 would be the surface lying about its
   * own contents. The GROUP survives the filter (the structural promise above);
   * its count tells the truth about what survived with it.
   */
  const filtered = groups.map((group) => {
    const players = group.players.filter((entry) => includesText(entry.name, needle));
    return { ...group, count: players.length, players };
  });

  return {
    groups: filtered,
    /*
     * Counted from what is RETURNED rather than re-filtered, so the number the
     * live region announces cannot disagree with the number of rows on the page.
     * `players-index.test.ts` asserts that equality directly.
     */
    total: filtered.reduce((sum, group) => sum + group.players.length, 0),
  };
}

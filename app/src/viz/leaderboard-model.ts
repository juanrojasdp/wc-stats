import type { Leaderboard, LeaderboardRow, MetricCode } from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";

/*
 * THE LEADERBOARDS PURE MODEL (Story 2.13, FR-26 / UJ-4).
 *
 * Pure and locale-free like every module under src/viz: dictionary KEYS and raw
 * numbers out, the component resolves them. NOTE WHAT IS ABSENT FROM THE
 * IMPORTS — there is no `t()` and no `@/lib/format`. The ESLint client-import
 * seam bars the first; the second is a DISCIPLINE this directory keeps, and it
 * is exactly why `table-sort.ts` lives in src/lib/ rather than here (2.11c
 * ruling 12). A formatter call in this file would move the one formatting path
 * (AD-7) out of the layer that owns it.
 *
 * WHAT THE ARTIFACT CARRIES, and therefore what this model may assume:
 * a board is `{ metricCode, scope, aggregation, higherIsBetter, rows }` — NO
 * id, NO title, NO unit. Its identity is `metricCode` + `scope`, which is why
 * row keys are board-qualified below. A row is `{ rank, entity, team, value,
 * matchesPlayed, perMatch }`, all six required, with `perMatch`
 * present-and-null rather than omitted. Values carry no units and no display
 * strings: "the App applies the unit and number format from its locale layer,
 * keyed by metricCode" (the schema's own words), which is what the two
 * registries below are.
 */

/**
 * One rendered leaderboard row.
 *
 * `key` is the React key AND `DataTable`'s focus-restore identity
 * (`Row extends { key: string }`), so it must be stable and unique across
 * EVERY table on the page — not merely within one board.
 */
export interface LeaderboardTableRow {
  key: string;
  rank: number;
  entityId: string;
  entityName: string;
  teamId: string;
  teamName: string;
  value: number;
  matchesPlayed: number;
  /** NULL when the metric is not meaningfully rateable (a max such as topSpeed). Never 0. */
  perMatch: number | null;
}

/**
 * Every row of one board, ARTIFACT ORDER VERBATIM — not sorted, not re-ranked.
 *
 * AD-5 reserves canonical order to the artifact ("the App may filter, select,
 * and perform user-initiated re-ordering only — canonical/default order always
 * comes from the artifact"), and `rank` is pipeline-computed: the schema says
 * "Never derived from array position by the App (AD-5)". Ties are real — the
 * fixture's topSpeed board shares rank 7 across five players and rank 16 across
 * three — so array position and rank genuinely disagree.
 *
 * `perMatch` is carried through with `?? null`, NEVER `?? 0` (2.11a decision
 * 3): `compareNumberNullLast` sorts nulls to the array END in both directions,
 * whereas a 0 would sort them into the middle of the order and claim a rate of
 * zero for a metric that has none.
 *
 * A null or empty `rows` yields `[]` rather than throwing. The two are distinct
 * states in the ARTIFACT — the contract says so verbatim — but that distinction
 * is answered by the shell (a zero-board payload gets an empty-state panel),
 * not by a pure row builder, which has nothing else it could return.
 */
export function leaderboardRows(board: Leaderboard): LeaderboardTableRow[] {
  const rows: LeaderboardRow[] | null = board.rows;
  if (rows === null || rows.length === 0) {
    return [];
  }
  return rows.map((row) => ({
    // Board-qualified: one page renders several boards and a bare entity id
    // repeats across them (the same six team ids sit on both team boards).
    key: `${board.scope}-${board.metricCode}-${row.entity.id}`,
    rank: row.rank,
    entityId: row.entity.id,
    entityName: row.entity.name,
    teamId: row.team.id,
    teamName: row.team.name,
    value: row.value,
    matchesPlayed: row.matchesPlayed,
    perMatch: row.perMatch ?? null,
  }));
}

/**
 * The hero-altitude teaser: every row RANKED 3 OR BETTER.
 *
 * NOT `slice(0, 3)`, and the difference is not stylistic. Ranks are competition
 * -ranked, so a tie at rank 3 puts four or more rows at `rank <= 3`; `slice`
 * would cut one of an equal set arbitrarily, which is a derivation AD-5 forbids
 * and a visible misstatement of the data. On all three fixture boards the two
 * forms agree at exactly three rows, so only the reasoning separates them on
 * shipped data — which is why the co-located test asserts the divergence on a
 * CONSTRUCTED tie rather than on the fixture.
 *
 * The caller must therefore render the count it gets and never hardcode three.
 */
export function teaserRows(rows: readonly LeaderboardTableRow[]): LeaderboardTableRow[] {
  return rows.filter((row) => row.rank <= 3);
}

/** How many teaser rows a hero-altitude card prints before it starts counting. */
export const TEASER_LIMIT = 3;

/** A teaser card's rows plus an honest account of what it did not print. */
export interface TeaserBoard {
  shown: LeaderboardTableRow[];
  /** Rows at `rank <= 3` that did not fit. Zero on every well-behaved board. */
  hiddenCount: number;
  /** The rank EVERY hidden row shares, or null when they span more than one. */
  hiddenRank: number | null;
}

/**
 * The teaser card's payload: at most `TEASER_LIMIT` rows, plus the count of
 * qualifying rows it could not print and the rank they are tied at.
 *
 * RULED BY JUAN AT THE 2.13 CODE REVIEW, and it does NOT overturn ruling 9.
 * `teaserRows` keeps `rank <= 3` — the ranking semantics are untouched. What
 * changes is that the CARD stops being unbounded: measured on the real
 * emission, `passCompletion/player` puts 51 one-match players at rank 1 with a
 * value of 100%, so one card in a three-up grid became a 51-entry list, and 36
 * boards produced 166 teaser rows against a design that assumed ~108.
 *
 * AD-5's objection is to ARBITRARY truncation that misstates the data — which
 * is why `slice(0, 3)` alone was rejected and stays rejected. A truncation that
 * STATES ITS OWN COUNT misstates nothing: "+48 empatados en el puesto 1" is a
 * fact about the artifact, and a reader who wants all 51 has the full sortable
 * table directly beneath. The count is composed at the call site because `t()`
 * has no interpolation.
 */
export function teaserBoard(rows: readonly LeaderboardTableRow[]): TeaserBoard {
  const eligible = teaserRows(rows);
  const shown = eligible.slice(0, TEASER_LIMIT);
  const hidden = eligible.slice(TEASER_LIMIT);
  const first = hidden[0];
  return {
    shown,
    hiddenCount: hidden.length,
    // Named only when it is TRUE of every hidden row; a band spanning ranks 1-3
    // has no single rank to name, and claiming one would be the misstatement
    // this whole mechanism exists to avoid.
    hiddenRank:
      first !== undefined && hidden.every((row) => row.rank === first.rank) ? first.rank : null,
  };
}

/** One board's hero-altitude teaser, and NOTHING ELSE from the artifact. */
export interface LeaderboardTeaser extends TeaserBoard {
  metricCode: MetricCode;
  scope: Leaderboard["scope"];
}

/**
 * The ONLY thing the build-time path may hand to the client: at most three rows
 * per board, plus the overflow account.
 *
 * WHY A PROJECTION AND NOT THE ARTIFACT. `LeaderboardsSection` is a "use client"
 * component, so whatever it receives as a prop is serialized into the RSC flight
 * payload embedded in the exported HTML. Passing the whole `Leaderboards` put
 * ALL 32 fixture rows into `out/index.html` to render 9 — and the runtime region
 * then fetched the same bytes again. This file's neighbour states the rule it
 * broke: "Story 1.17 measured the real index at 409,512 B raw, and AD-11 bans
 * inlining a bundle that size into HTML" (`app/src/app/page.tsx`). At the 2.19
 * DATA_ROOT flip the un-projected form would have inlined ~409 KB into the Hub
 * document AND re-downloaded it, on one of the two Lighthouse->=90 routes.
 * Found at the 2.13 code review.
 *
 * The teasers must still be BUILD-TIME markup (AD-11): hero altitude is the
 * first thing a reader meets and has to survive with no JavaScript and before
 * the fetch resolves. A projection keeps that and costs the document only the
 * rows it actually paints.
 */
export function leaderboardTeasers(boards: readonly Leaderboard[]): LeaderboardTeaser[] {
  return boards.map((board) => ({
    metricCode: board.metricCode,
    scope: board.scope,
    ...teaserBoard(leaderboardRows(board)),
  }));
}

/**
 * A board's unit, for composing `enums.unit.*` at the call site.
 *
 * DELIBERATELY NOT `expert-model.ts`'s `FieldUnit`, which has no `km` member:
 * Domain G carries distances in METRES and the team-scope Domain B fields carry
 * them in KILOMETRES, so one shared union would have to admit both and would
 * lose the very distinction MetricCode's scoping rule exists to state.
 */
export type LeaderboardUnit = "count" | "percent" | "km" | "m" | "kmh";

/*
 * THE UNIT ASSIGNMENT IS FIXED BY THE CONTRACT, NOT BY TASTE. MetricCode's own
 * JSDoc rules it: "'distanceCovered' (team, kilometres) and 'totalDistance'
 * (player, metres) … No code carries two units." Everything not named here is a
 * plain count.
 *
 * `Record<MetricCode, …>` and not `Partial<…>`: a contract enum change must be
 * a COMPILE ERROR here rather than a silently missing unit. That is the
 * mechanism AD-2 names and the `Leaderboards` JSDoc points at this file for.
 */
export const LEADERBOARD_UNIT: Record<MetricCode, LeaderboardUnit> = {
  ballProgressions: "count",
  completedLineBreaks: "count",
  crosses: "count",
  crossesCompleted: "count",
  defensiveLineBreaks: "count",
  defensivePressures: "count",
  distanceCovered: "km",
  duelsWonAerial: "count",
  duelsWonPhysical: "count",
  expectedGoals: "count",
  forcedTurnovers: "count",
  goals: "count",
  highSpeedRuns: "count",
  interceptions: "count",
  lineBreaksCompleted: "count",
  passCompletion: "percent",
  passes: "count",
  passesCompleted: "count",
  possession: "percent",
  possessionRegains: "count",
  receptionsInFinalThird: "count",
  secondBalls: "count",
  shots: "count",
  shotsOnTarget: "count",
  sprintDistance: "km",
  sprints: "count",
  stepIns: "count",
  switchesOfPlay: "count",
  tacklesWon: "count",
  takeOns: "count",
  topSpeed: "kmh",
  totalDistance: "m",
};

/** How a board's values are printed. Drives which `@/lib/format` call the component makes. */
export type LeaderboardFormat = "integer" | "decimal1" | "decimal2" | "percent";

/*
 * PRECISION IS METRIC-DEPENDENT, and the schema says so: `x-decimals: 2` on
 * LeaderboardValue is "the widest precision any board uses", never the
 * precision of a given board. Every fixture value is 1 dp and serialises as
 * `315.0` / `34.0`, which `JSON.parse` collapses to an integer — so nothing may
 * rely on a trailing `.0` and every value is formatted with an EXPLICIT
 * fraction-digit count.
 *
 * xG is the one count-unit metric that is not an integer; the app already
 * prints it at two decimals everywhere else.
 */
export const LEADERBOARD_FORMAT: Record<MetricCode, LeaderboardFormat> = {
  ballProgressions: "integer",
  completedLineBreaks: "integer",
  crosses: "integer",
  crossesCompleted: "integer",
  defensiveLineBreaks: "integer",
  defensivePressures: "integer",
  distanceCovered: "decimal1",
  duelsWonAerial: "integer",
  duelsWonPhysical: "integer",
  expectedGoals: "decimal2",
  forcedTurnovers: "integer",
  goals: "integer",
  highSpeedRuns: "integer",
  interceptions: "integer",
  lineBreaksCompleted: "integer",
  passCompletion: "percent",
  passes: "integer",
  passesCompleted: "integer",
  possession: "percent",
  possessionRegains: "integer",
  receptionsInFinalThird: "integer",
  secondBalls: "integer",
  shots: "integer",
  shotsOnTarget: "integer",
  sprintDistance: "decimal1",
  sprints: "integer",
  stepIns: "integer",
  switchesOfPlay: "integer",
  tacklesWon: "integer",
  takeOns: "integer",
  topSpeed: "decimal1",
  totalDistance: "integer",
};

/**
 * Dictionary key for a board's FULL metric label — `enums.leaderboardMetric.<code>`.
 *
 * A new namespace rather than `enums.metric`, which is SEALED: i18n.test.ts
 * pins that key set exactly to `KEY_STAT_FIELDS` (19 Domain B fields) and
 * `tactical-sections.ts`, which owns the list, is do-not-touch. MetricCode is
 * 32 values. This is the shape `expert.field` already established for the same
 * reason.
 *
 * The `as DictionaryKey` cast is the house convention (expert-model.ts states
 * it): DictionaryKey is a literal union and a template-literal expression
 * infers `string`, so the cast defeats tsc and the i18n.test.ts resolution
 * sweep over the builder's FULL domain is the only thing between a typo'd key
 * and a runtime miss.
 */
export function leaderboardMetricKey(code: MetricCode): DictionaryKey {
  return `enums.leaderboardMetric.${code}` as DictionaryKey;
}

/*
 * The metrics with a RULED table abbreviation — and there are exactly two,
 * because this story MINTS NONE. EXPERIENCE.md names "VEL. MÁX." for
 * "Velocidad máxima" as the worked example of the abbreviation rule, and the
 * app already ships both strings as ruled copy: `match.hero.tiles.topSpeed`
 * and `expert.field.highSpeedRuns`. `enums.leaderboardMetricAbbr` reuses them
 * verbatim; i18n.test.ts pins both equalities so a second mint cannot drift in
 * beside them.
 *
 * A `Partial<Record<MetricCode, true>>` rather than a string list, so an entry
 * for a code that does not exist is a compile error — the `TITLED_FIELDS`
 * precedent, and the reason `leaderboardMetricAbbrKey` can be total.
 */
export const ABBREVIATED_METRICS: Partial<Record<MetricCode, true>> = {
  highSpeedRuns: true,
  topSpeed: true,
};

/**
 * `enums.leaderboardMetricAbbr.<code>` for an abbreviated head, else null —
 * the `expertFieldTitleKey` precedent, INVERTED.
 *
 * Inverted because the two namespaces are shaped the other way round from
 * `expert.*`: there, the head text is the abbreviation and `fieldTitle` holds
 * the full term; here, `enums.leaderboardMetric` holds full terms only (it is
 * the label namespace for a whole closed enum) and the abbreviation is the
 * optional overlay. So a non-null return means "use this as `headText` and put
 * the full term in `headTitle`", which is the reverse of the Expert call site.
 */
export function leaderboardMetricAbbrKey(code: MetricCode): DictionaryKey | null {
  return ABBREVIATED_METRICS[code] === true
    ? (`enums.leaderboardMetricAbbr.${code}` as DictionaryKey)
    : null;
}

/**
 * Whether any row's team differs from the entity it ranks.
 *
 * FALSE on a team-scope board, where `team` repeats `entity` on every row —
 * measured true on 12/12 fixture team rows, and the contract says so by
 * construction ("`team` is the row's team — equal to entity on a team-scoped
 * board"). Gate the column away rather than shipping a duplicated one; a column
 * of repeated text costs the same width as a useful one, which is the whole
 * problem at 390px.
 */
export function anyDistinctTeam(rows: readonly LeaderboardTableRow[]): boolean {
  return rows.some((row) => row.teamId !== row.entityId);
}

/**
 * Whether a per-match column would tell the reader anything the value column
 * does not already say.
 *
 * TWO WAYS IT EARNS NO COLUMN, and the Story 2.13 review found the second one
 * shipped:
 *
 *  1. `perMatch` is contract-nullable and null on 20/20 fixture `topSpeed`
 *     rows — a maximum is not meaningfully rateable.
 *  2. On an `aggregation: "average"` board `perMatch` IS the value, so the two
 *     columns render byte-identical strings. Measured: 6/6 fixture
 *     `possession` rows, and 48/48 + 48/48 + 102/102 on the real emission's
 *     three average boards. A null check alone cannot see this.
 *
 * The gate's whole justification is width — "a column of repeated text costs
 * the same width as a useful one, which is the whole problem at 390px" — so
 * testing NULL-NESS rather than USEFULNESS was testing the wrong property, and
 * shipped exactly the duplicated column the gate exists to remove. NEVER render
 * it as a run of em dashes either; the gate removes it, exactly as the shipped
 * `anyExpectedGoals` / `anyPlayerName` / `anyMinute` gates do.
 *
 * Deliberately derived from the ROWS rather than from `board.aggregation`: the
 * artifact's own numbers are the authority on whether two columns differ, and a
 * `sum` board whose entrants all played one match is just as duplicated as an
 * `average` one.
 *
 * Both gates make the column set DYNAMIC, which is precisely why 2.11a decision
 * 2 forbids index-based sort keys — every column below uses a stable string
 * `key`.
 */
export function anyPerMatch(rows: readonly LeaderboardTableRow[]): boolean {
  return rows.some((row) => row.perMatch !== null && row.perMatch !== row.value);
}

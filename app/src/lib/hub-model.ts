import type {
  Group,
  MatchResult,
  MatchResultRow,
  MatchdayRound,
  Stage,
  StandingsRow,
  TeamScore,
  Tournament,
} from "@/lib/contract/contract-types";

/*
 * The Tournament Hub's decision layer, as a PURE module: no React, no DOM, no
 * t(), no fetch. Same discipline as `table-sort.ts` and `match-hero.ts` — the
 * harness has no jsdom, so anything decided inside a component is structurally
 * untestable. Every grouping, ordering, keying and href decision lives here so
 * `hub-model.test.ts` can hold it.
 *
 * SELECTION AND PRESENTATION ONLY (AD-5). Nothing here sorts, ranks, sums or
 * derives: the artifact's order IS the order, `rank` is rendered verbatim, and
 * the FIFA tiebreaker cascade is the pipeline's (ruled D3, and Story 1.17's
 * still-open D1 changes the VALUES in the artifact and nothing in this file).
 */

/*
 * THE FOUR CLOSED VOCABULARIES, AS VALUE LISTS — and the mechanism that keeps
 * them honest.
 *
 * These are derived from `Record<Code, true>` literals, NOT declared as
 * `readonly Code[]`, and the difference is the whole point. An annotation of
 * `readonly Group[]` is satisfied by ANY array of valid groups: a twelve-entry
 * list still type-checks after the contract enum grows to thirteen, so it
 * catches a REMOVED code and never an ADDED one — the opposite of what AD-2
 * needs. A `Record` keyed by the union is exhaustive in the direction that
 * matters: a new code is a missing-property compile error at the literal.
 * (`i18n.test.ts`'s `ALL_METRIC_CODES` already uses this shape; this is the
 * same mechanism, applied where the earlier annotation only claimed it.)
 *
 * That claim is load-bearing beyond tidiness: `hub-model.test.ts` proves the
 * group-by TOTAL by iterating these lists and calls it "exhaustive by
 * construction, both enums being closed" (D5's substitute for asserting 104
 * against a 4-row fixture). A list that can silently fall behind its enum makes
 * that test quietly partial instead of red.
 */
function codeList<Code extends string>(all: Record<Code, true>): readonly Code[] {
  return Object.keys(all) as Code[];
}

/** The closed `Group` vocabulary, in contract order. */
export const GROUPS: readonly Group[] = codeList<Group>({
  a: true,
  b: true,
  c: true,
  d: true,
  e: true,
  f: true,
  g: true,
  h: true,
  i: true,
  j: true,
  k: true,
  l: true,
});

/** The closed `Stage` vocabulary, in the contract's own declaration order. */
export const STAGES: readonly Stage[] = codeList<Stage>({
  group: true,
  r32: true,
  r16: true,
  qf: true,
  sf: true,
  "third-place": true,
  final: true,
});

/** The closed `MatchResult` vocabulary — the chips' key source, never a letter. */
export const MATCH_RESULTS: readonly MatchResult[] = codeList<MatchResult>({
  win: true,
  draw: true,
  loss: true,
});

/** The closed `MatchdayRound` vocabulary, all nine codes. */
export const MATCHDAY_ROUNDS: readonly MatchdayRound[] = codeList<MatchdayRound>({
  "group-md1": true,
  "group-md2": true,
  "group-md3": true,
  r32: true,
  r16: true,
  qf: true,
  sf: true,
  "third-place": true,
  final: true,
});

/**
 * The six MatchdayRound codes that are also Stage codes. Named here so
 * `i18n.test.ts` can pin the two vocabularies EQUAL on them — the restatement
 * in `enums.matchdayRound` is deliberate, and this is what stops it drifting
 * into a second term for the same round.
 */
export type SharedRoundStage = Extract<Stage, MatchdayRound>;

export const SHARED_ROUND_STAGES: readonly SharedRoundStage[] = [
  "r32",
  "r16",
  "qf",
  "sf",
  "third-place",
  "final",
];

/* ------------------------------------------------------------------ anchors */

/*
 * NO `LEADERBOARDS_SLOT_ID` HERE. Task 1.4 asked this story to leave a named
 * anchor for Story 2.13's section, but 2.13 reached `page.tsx` first and
 * renders that anchor itself (`LEADERBOARDS_SECTION_ID`, "lideres"), so the
 * slot is discharged BY the real section — see `page.tsx`. A second const for
 * the same id shipped here with zero consumers and a docblock claiming 2.13
 * read it, which is the dead-key defect this story polices in the locale files,
 * pointed the other way. Removed at code review.
 *
 * (The inconsistency worth knowing: 2.13's slug is SPANISH, against Story 2.18
 * ruled decision 11's "language-neutral English slugs" — filed, not fixed,
 * because interoperating with the shipped anchor beats correcting it here.)
 */

/** The two Hub surfaces' own deep-link anchors (UX-DR18). */
export const STANDINGS_SURFACE_ID = "standings";
export const RESULTS_SURFACE_ID = "results";

/* ------------------------------------------------------------------- hrefs */

/*
 * `next.config.ts` sets `trailingSlash: true`, so a slash-less href is
 * rewritten at request time and a test asserting the slash-less form passes on
 * a document that links nowhere (Story 2.18's static-output patch). Both
 * helpers therefore emit the slash themselves.
 */

/** `/matches/{matchId}/` — the route Story 2.4 shipped; resolves today. */
export function matchHref(matchId: string): string {
  return `/matches/${matchId}/`;
}

/**
 * `/teams/{teamId}/` — DOES NOT RESOLVE UNTIL STORY 2.16 (ruled D2).
 *
 * This is deliberate and it follows the shipped precedent rather than the
 * plain-text one: `MatchHero.tsx` already links this exact non-existent route
 * (Story 2.4 ruled it, UX-DR22), and `LineupsDisclosure.tsx` does the same for
 * `/players/`. The competing precedent (2.8, 2.11c) rules plain text for PLAYER
 * names in EXPERT tables, and its own stated reason — "UX-DR22's cross-link is
 * scoped to LINEUP player names" — does not transfer: AC 2 mandates the
 * standings-to-team link by name. The dangling links are filed in
 * deferred-work.md, not stubbed.
 */
export function teamHref(teamId: string): string {
  return `/teams/${teamId}/`;
}

/* ------------------------------------------------------------ dictionary keys */

/**
 * The chip LETTER, keyed off the `MatchResult` enum — never off the letter.
 *
 * TWO LETTER SYSTEMS COLLIDE HERE and keying off the enum is what keeps them
 * apart. (1) `D` INVERTS ACROSS LOCALES: es `D` is *derrota* (loss), en `D` is
 * *draw*. A key named after the letter would silently flip meaning on the
 * language toggle. (2) chips are `V/E/D` while the standings COLUMNS are
 * `G/E/P`, in the same row, for the same concepts — only `E` coincides.
 * `i18n.test.ts` pins the es-`D`/en-`D` divergence explicitly.
 */
export function matchResultLetterKey(result: MatchResult): `enums.matchResult.${MatchResult}` {
  return `enums.matchResult.${result}`;
}

/** The chip's `sr-only` spoken word, so a row's name is never a bare letter. */
export function matchResultWordKey(result: MatchResult): `enums.matchResultFull.${MatchResult}` {
  return `enums.matchResultFull.${result}`;
}

/**
 * The matchday-round label. `MatchdayRound` is a SEPARATE closed enum from
 * `Stage` — six of its nine codes share a name with a stage, and they are
 * labelled here anyway rather than bridged to `enums.stage`, because a code
 * with no entry of its own renders unlabelled the day the two diverge.
 * `i18n.test.ts` pins the six shared labels equal so they cannot drift.
 */
export function matchdayRoundLabelKey(
  round: MatchdayRound
): `enums.matchdayRound.${MatchdayRound}` {
  return `enums.matchdayRound.${round}`;
}

/** `enums.stage.<code>` — reused verbatim from Story 2.4's helper contract. */
export function stageLabelKey(stage: Stage): `enums.stage.${Stage}` {
  return `enums.stage.${stage}`;
}

/* -------------------------------------------------------------------- rows */

/**
 * `DataTable<Row extends { key: string }>` needs a stable per-row identity for
 * decision 6's focus restore and for React's keyed reorder, so both row models
 * are the contract row PLUS a `key`.
 */
export interface HubStandingsRow extends StandingsRow {
  key: string;
}

export interface HubResultRow extends MatchResultRow {
  key: string;
}

/**
 * NEVER `rank`, never the array index (D3). `rank` is not unique and not
 * contiguous — ties are real, and the shipped `leaderboards.json` fixture
 * proves the pattern (`rank: 7` five times, then a jump to 12).
 */
export function standingsRowKey(row: StandingsRow): string {
  return `standings-${row.team.id}`;
}

export function resultRowKey(row: MatchResultRow): string {
  return `result-${row.matchId}`;
}

/* ---------------------------------------------------------------- sections */

/**
 * THREE ABSENT STATES, NOT TWO. Every array below arrives inside an
 * `as`-cast, unvalidated JSON payload — `fetchArtifact<Tournament>` asserts the
 * shape, it does not check it — so a field the contract declares required can
 * still be `undefined` at runtime (a truncated emission, a schema-version skew
 * the gate let through because the version itself was right). `null` is the
 * shape the contract uses for "the source does not carry this" and `[]` for
 * "carries it, with nothing in it".
 *
 * The `null`-vs-`[]` conflation has been ruled FOUR times in this codebase and
 * still shipped as a live defect; `undefined` is the third state nobody guards.
 * Normalizing all three to `[]` here — at the model boundary, once — is what
 * lets every component downstream treat `rows` as a plain array and render a
 * real zero state instead of throwing on `.map` of undefined.
 *
 * It normalizes for RENDERING only. It never invents a section, never drops
 * one, and never turns an absent group into a present one.
 */
function listOf<Item>(value: readonly Item[] | null | undefined): readonly Item[] {
  return Array.isArray(value) ? value : [];
}

export interface HubStandingsSection {
  /** React key and anchor stem. */
  key: string;
  anchorId: string;
  group: Group;
  rows: HubStandingsRow[];
}

/**
 * A results section is headed either by its GROUP or by its knockout STAGE.
 * `matchdayRound` is a rendered LABEL and never a sectioning key (ruled D10):
 * it carries three group values, so sectioning by it would flatten 72 results
 * across 12 groups and re-section them in an order the artifact does not carry
 * — a derived order AD-5 forbids.
 */
export type HubResultsHeading =
  | { kind: "group"; group: Group }
  | { kind: "stage"; stage: Stage };

export interface HubResultsSection {
  key: string;
  anchorId: string;
  heading: HubResultsHeading;
  rows: HubResultRow[];
}

/**
 * One section per group, in `groups[]` order, each group's rows in its own
 * `standings[]` order — which the schema states is rank order and which this
 * function never re-derives.
 *
 * An EMPTY `standings` array keeps its section: `[]` and "absent" are distinct
 * states by contract, and dropping the section would make a group with no
 * played matches indistinguishable from a group that does not exist.
 */
export function standingsSections(tournament: Tournament): HubStandingsSection[] {
  return listOf(tournament.groups).map((table) => ({
    key: `standings-${table.group}`,
    anchorId: `standings-group-${table.group}`,
    group: table.group,
    rows: listOf(table.standings).map((row) => ({
      ...row,
      /*
       * `form` NORMALIZES TOO, and it was the one array this module's own
       * three-absent-states promise did not keep. It is a nested array inside
       * an `as`-cast payload exactly like the four above, and its consumer is
       * `row.form.map(...)` in the chips column — so an absent or null `form`
       * on ONE standings row threw during render and, with no boundary, took
       * the whole route rather than that row. An empty strip is a truthful
       * rendering of "no matches played yet"; a blank Hub is not.
       *
       * `team` is deliberately NOT defaulted alongside it: a row with no team
       * has no name to print, no id to key on and no `/teams/{id}/` to link to,
       * so inventing an identity would render a plausible-looking row that
       * points nowhere. That case belongs to the error boundary
       * `TournamentHubRegion` now mounts, where it degrades to a named panel.
       */
      form: [...listOf(row.form)],
      key: standingsRowKey(row),
    })),
  }));
}

/**
 * Group sections in `groups[]` order, then one knockout section per `stage` in
 * `knockoutResults[]` FIRST-APPEARANCE order.
 *
 * FIRST APPEARANCE, not a stage ranking, and that is load-bearing: the schema
 * already guarantees `knockoutResults` is "ordered by stage then match number",
 * so ordering the sections by anything else — including by `STAGES` — would be
 * the App re-ordering the artifact, which AC 1 and AD-5 forbid. A stage with no
 * rows produces no section at all, rather than an empty one.
 */
export function resultsSections(tournament: Tournament): HubResultsSection[] {
  const sections: HubResultsSection[] = listOf(tournament.groups).map((table) => ({
    key: `results-${table.group}`,
    anchorId: `results-group-${table.group}`,
    heading: { kind: "group", group: table.group },
    rows: listOf(table.results).map((row) => ({ ...row, key: resultRowKey(row) })),
  }));

  const byStage = new Map<Stage, HubResultsSection>();
  for (const row of listOf(tournament.knockoutResults)) {
    let section = byStage.get(row.stage);
    if (section === undefined) {
      section = {
        key: `results-${row.stage}`,
        anchorId: `results-${row.stage}`,
        heading: { kind: "stage", stage: row.stage },
        rows: [],
      };
      byStage.set(row.stage, section);
      sections.push(section);
    }
    section.rows.push({ ...row, key: resultRowKey(row) });
  }

  return sections;
}

/**
 * Every matchId the results listing reaches, group ties then knockout ties.
 *
 * AR-4 asserts a bijection between this set and `entities.matches`, which is
 * the route manifest `generateStaticParams` reads — so this is AC 2's
 * "all 104 matches are reachable" stated in a form the FIXTURE can carry (D5:
 * the fixture holds 3 of 104, and nothing asserts 104 against it).
 */
export function allResultMatchIds(tournament: Tournament): string[] {
  return [
    ...listOf(tournament.groups).flatMap((table) =>
      listOf(table.results).map((row) => row.matchId)
    ),
    ...listOf(tournament.knockoutResults).map((row) => row.matchId),
  ];
}

/* ------------------------------------------------------------------ display */

/**
 * `"2–0"`. The separator is passed in (`match.hero.scoreSeparator`, the shipped
 * en dash) rather than written here — a pure module never holds user-visible
 * glyphs (AD-7/AD-12).
 *
 * WHICH SCORE THIS IS (Task 2.4b, ruled). `MatchResultRow.score` carries no
 * description in the schema and `TeamScore` says only "a home/away goal pair at
 * one point in a match" — and the one knockout fixture cannot disambiguate,
 * since m074's `score`, `scoreAfter90` and `scoreAfterET` are all 1–1. It is
 * ruled to be the SAME quantity as `MatchMetadata.score` — "the final score as
 * the cover prints it: after extra time when extra time was played, otherwise
 * after 90" — because `MatchResultRow`'s own description says it "carries
 * everything the search result and the <title>/OG string need … so neither has
 * to fetch the Match Bundle", which is only true if the two agree. That is an
 * INFERENCE from the contract, not a statement in it: filed as a contract
 * question for Story 1.17, the artifact's producer.
 *
 * Nothing in this story depends on the answer — the row prints `score`
 * verbatim (AD-5) plus the `decidedBy` suffix, and neither reading changes what
 * renders. A surface that printed BOTH the 90' and the final score would.
 */
export function scoreline(score: TeamScore, separator: string): string {
  return `${score.home}${separator}${score.away}`;
}

/*
 * The wall-clock components of an ISO 8601 datetime — "2026-06-11T13:00:00-06:00".
 *
 * A REGEX, not two `slice`+`Number` reads, and that is a bug fix rather than a
 * style choice: `Number("")` is `0`, so slicing past the end of a short or
 * malformed string produced a confident MIDNIGHT for a value that has no time
 * in it at all. Caught by this module's own "returns null, never 0" test.
 */
const ISO_WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/;
const MINUTES_PER_HOUR = 60;

/**
 * A kickoff column's sort value: minutes since midnight in VENUE-LOCAL
 * wall-clock time, or `null` when the string is not a parseable datetime.
 *
 * SORTS WHAT THE READER SEES. `formatKickoff` renders the wall-clock
 * components as written and never converts to the viewer's timezone, so the
 * sort must read the same components — sorting the underlying INSTANT would
 * order a 13:00 Mexico City kickoff after a 16:30 Boston one, which is correct
 * about time and wrong about the column.
 *
 * The whole ISO string is deliberately NOT the sort value: it leads with the
 * date, so a "Hora" sort would silently become a date-then-time sort inside a
 * section spanning several matchdays.
 *
 * `null`, never 0, for an unparseable value — `table-sort.ts` ranks nulls last
 * in both directions, and 0 would claim midnight (the `?? 0` defect decision 3
 * closed elsewhere).
 */
export function kickoffSortValue(kickoff: string): number | null {
  const match = ISO_WALL_CLOCK.exec(kickoff);
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * MINUTES_PER_HOUR + minute;
}

/**
 * The `<title>`/OG string for `/`, composed OUTSIDE `generateMetadata` because
 * the i18n gate flags any template or concatenation that is the direct value of
 * a `title:` property, even when every fragment is a t() call
 * (`composeMatchTitle`'s precedent).
 *
 * `tournamentName` is passed through untranslated: the contract calls it "a
 * proper noun, not a translated label" (AD-7).
 */
export function composeHubTitle(input: {
  tournamentName: string;
  siteName: string;
  separator: string;
}): string {
  return `${input.tournamentName}${input.separator}${input.siteName}`;
}

/* ------------------------------------------------------------------ columns */

/*
 * THE TWO HUB COLUMN SETS AND THEIR `<md` DEFAULTS (AC 4, Task 6.6).
 *
 * The docs never specify which columns the narrow default shows — EXPERIENCE.md
 * names only "fewer default-visible columns" — so this is ruled here.
 *
 * STANDINGS keeps `rank`, `team`, `played`, `points` and `form`: position and
 * identity, the two numbers a standings reader actually reads (points over
 * matches played), and the form strip, which is the schema's own stated chip
 * source ("The Hub renders result chips straight from it") and therefore AC 3's
 * carrier — hiding it by default would leave the 390 px reference rendering
 * with no result chip on it at all.
 *
 * RESULTS keeps `match` and `date`. The `match` cell already holds two team
 * names and a scoreline, which is most of a 390 px row on its own.
 *
 * BOTH narrow sets keep their ROW-HEADER column, non-negotiably: `<th
 * scope="row">` is what names every other cell in the row, and a table that
 * hides it stops being navigable rather than merely narrower.
 *
 * The disclosure HIDES columns and never re-fetches or removes data (SM-C2);
 * every column stays sortable through the sort menu while hidden (AC 4).
 */

export const STANDINGS_COLUMN_KEYS = [
  "rank",
  "team",
  "played",
  "won",
  "drawn",
  "lost",
  "goalsFor",
  "goalsAgainst",
  "goalDifference",
  "points",
  "form",
] as const;

export const STANDINGS_NARROW_COLUMN_KEYS = ["rank", "team", "played", "points", "form"] as const;

export const RESULT_COLUMN_KEYS = [
  "match",
  "matchNumber",
  "date",
  "kickoff",
  "venue",
  "matchdayRound",
] as const;

export const RESULT_NARROW_COLUMN_KEYS = ["match", "date"] as const;

export type StandingsColumnKey = (typeof STANDINGS_COLUMN_KEYS)[number];
export type ResultColumnKey = (typeof RESULT_COLUMN_KEYS)[number];

/**
 * Which columns render right now. `isNarrow` is the `<md` media query;
 * `expanded` is the "Más columnas" disclosure.
 *
 * At `>=md` the disclosure is irrelevant and the full set always shows — the
 * control does not render there at all, and honouring a stale `expanded` would
 * be the only way this could disagree with what the reader sees.
 */
export function visibleColumnKeys<Key extends string>(
  all: readonly Key[],
  narrow: readonly Key[],
  isNarrow: boolean,
  expanded: boolean
): Key[] {
  if (!isNarrow || expanded) {
    return [...all];
  }
  return all.filter((key) => narrow.includes(key));
}

"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { HubTable } from "@/components/HubTable";
import { ResultChip } from "@/components/ResultChip";
import { RowAnchor } from "@/components/RowAnchor";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { Tournament } from "@/lib/contract/contract-types";
import { formatDate, formatInteger, formatKickoff } from "@/lib/format";
import {
  RESULTS_SURFACE_ID,
  RESULT_COLUMN_KEYS,
  RESULT_NARROW_COLUMN_KEYS,
  STANDINGS_COLUMN_KEYS,
  STANDINGS_NARROW_COLUMN_KEYS,
  STANDINGS_SURFACE_ID,
  kickoffSortValue,
  matchHref,
  matchdayRoundLabelKey,
  resultsSections,
  scoreline,
  stageLabelKey,
  standingsSections,
  teamHref,
  visibleColumnKeys,
  type HubResultRow,
  type HubResultsHeading,
  type HubStandingsRow,
} from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { decidedByCaption } from "@/lib/match-hero";
import type { TableColumn } from "@/lib/table-sort";
import { HASH_PREFIX, useAnchorNonce } from "@/lib/use-anchor-nonce";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { MIN_HIT_PX } from "@/viz/marker-layout";

/*
 * THE TOURNAMENT HUB's two surfaces (Story 2.12): results and standings by
 * stage and group, rendered from `tournament.json` in ARTIFACT ORDER with the
 * pipeline's explicit `rank` printed verbatim (AC 1, AR-5, AD-5).
 *
 * NOTHING HERE SORTS, RANKS, TIE-BREAKS OR AGGREGATES. `rank` is a COLUMN, not
 * an array position; the rows arrive in rank order and are not re-sorted; the
 * FIFA cascade belongs to the pipeline (Story 1.17's D1 is still open, and this
 * surface is insulated from whichever way it is ruled precisely because the
 * value is rendered rather than derived).
 *
 * WHAT THIS FILE DOES NOT OWN: the leaderboards. `EXPERIENCE.md:226` gives them
 * two altitudes on this route and Story 2.13 builds both; this file leaves a
 * named anchor for that section and fetches nothing for it.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const SPACE = " ";
const SUFFIX_OPEN = " (";
const SUFFIX_CLOSE = ")";
const TITLE_OPEN = " (";
const TITLE_CLOSE = ")";

/*
 * THE STRETCHED ROW ANCHOR (ruled D9) NOW LIVES IN `@/components/RowAnchor`.
 *
 * HOISTED BY STORY 2.16 (its ruled D4). The pattern had been minted privately
 * TWICE — here, and again in `PlayerMatchesSection.tsx` for Story 2.15 — and
 * `/teams/{slug}`'s per-match table would have been the third. Story 2.11a
 * decision 1 is binding: "every private copy is deleted". This copy was the one
 * hoisted; `PlayerMatchesSection`'s is filed for Story 2.17 because 2-15 was
 * `in-progress` in a concurrent session when 2.16 ran and its file was untracked
 * in the tree.
 *
 * BEHAVIOUR IS UNCHANGED HERE. The hoisted component carries this copy's exact
 * geometry (`flex-wrap`, `gap-x-1.5`), its trailing-space accessible prefix, its
 * imported `MIN_HIT_PX`, and `prefetch={false}` as the DEFAULT rather than a
 * per-call-site argument.
 *
 * WHY PREFETCH STAYS OFF, measured rather than precautionary: Next prefetches
 * every `<Link>` that enters the viewport, so the Hub fired four route requests
 * on load at FIXTURE scale — 48 standings links plus 104 result links at real
 * scale, re-run on every re-order. Story 2.13 measured `48 → 75` resource
 * entries across one sort pass and `43 → 43` after the fix. `/teams/{id}/` now
 * EXISTS (Story 2.16 built it), but that does not change the arithmetic: the
 * waste was the per-sort re-fire, not the 404, and AC 5 scopes this route to the
 * artifacts it loads.
 *
 * CONSEQUENCES ACCEPTED AND RECORDED, not discovered later:
 *  - text selection inside the row is lost; that is inherent to stretched links;
 *  - every OTHER cell's content sits outside the anchor and contributes nothing
 *    to the link's accessible name, which is why the anchor carries an explicit
 *    `sr-only` prefix — 48 links named only by a team name, or 104 named by one
 *    of two teams, are ambiguous in a screen reader's link list;
 *  - result-row TEAM NAMES ARE NOT LINKS. UX-DR22 scopes team cross-links to the
 *    match header, and linking them here would add a second and third tab stop
 *    per row and nest interactive elements inside a link.
 */

/**
 * `true` below `md`. Reuses the shipped `MD_MEDIA_QUERY` (`(min-width: 48rem)`)
 * — the breakpoint is declared once, in `rem`, and re-declaring it in px here
 * would desynchronise the JS branch from the CSS one for any reader whose root
 * font size is not 16px.
 *
 * `useMediaQuery` is a `useSyncExternalStore`, so the FIRST client render is
 * already at the right breakpoint; an effect-based hook would paint one frame
 * of the wrong column set.
 */
function useIsNarrow(): boolean {
  return !useMediaQuery(MD_MEDIA_QUERY);
}

/* ------------------------------------------- SM-C2 on this route (D15, 5.7) */

/*
 * EVERY SECTION TABLE ON THIS ROUTE SITS BEHIND `ViewDataDisclosure`, and the
 * count of what is behind it sits OUTSIDE (Story 2.19 ruled decision D15).
 *
 * WHY, measured rather than assumed. At the real corpus this route rendered
 * 6,025 DOM nodes, 33 tables and 2,442 cells at 412px with nothing collapsed,
 * and Lighthouse mobile scored 68 against AC 2's floor of 90 — LCP gated on
 * `h2#standings` with 1,802 ms of ELEMENT RENDER DELAY, i.e. the browser
 * building those tables. At the fixture scale Story 2.12 was ruled against, the
 * same surface was three group tables. SM-C2 is the clause for exactly this:
 * "density moved behind disclosure, NEVER DELETED".
 *
 * NOTHING IS DELETED. Every group, every stage, every row and every column is
 * still on this route, one click away, in artifact order, with its sort intact.
 * The headings stay rendered and stay the anchor targets, so the shape of the
 * tournament — twelve groups, nine rounds, how many teams and matches in each —
 * is still readable at a glance without opening anything, which the wall of
 * tables arguably made harder rather than easier.
 *
 * REUSED, NOT RE-MINTED. `ViewDataDisclosure` already owns the control, the
 * lazy mount, the aria-controls-only-while-mounted fix and the disambiguated
 * accessible name; R1's pass matrix took the identical trade earlier in this
 * same story. `TacticalSection` was the other candidate and does not fit: it
 * renders an <h2> section landmark keyed to the `SectionId` union and carries
 * the focus-nonce contract, none of which is true of an <h3> inside an already
 * -landmarked Hub surface.
 */

/**
 * `n <noun>`, singular-aware — the count that renders OUTSIDE each disclosure so
 * a reader knows what is behind it before opening. `PassNetworksSection`'s
 * `countPhrase` idiom, which this story shipped three tasks ago.
 */
function useCountPhrase(): (count: number, one: DictionaryKey, many: DictionaryKey) => string {
  const t = useT();
  const { locale } = useLocale();
  return (count, one, many) => `${formatInteger(count, locale)}${SPACE}${t(count === 1 ? one : many)}`;
}


/* -------------------------------------------------------- standings columns */

function useStandingsColumns(): TableColumn<HubStandingsRow>[] {
  const t = useT();
  const { locale } = useLocale();
  const rowLink = t("hub.standings.rowLink");

  /**
   * Every count column is the same shape, so it is built once. `align:
   * "numeric"` right-aligns in tabular figures; the sort reads the RAW numeric,
   * never the formatted string (2.11a decision 2) — `formatInteger` emits
   * es-CO grouping, and a text sort over "1.024" would be nonsense.
   */
  function countColumn(
    key: (typeof STANDINGS_COLUMN_KEYS)[number],
    valueOf: (row: HubStandingsRow) => number
  ): TableColumn<HubStandingsRow> {
    const headText = t(`hub.standings.column.${key}` as DictionaryKey);
    return {
      key,
      headText,
      // Every one of these heads is a ruled ABBREVIATION (PJ, G, E, P, GF, GC,
      // DG, Pts), so UX-DR17 requires the full term behind it.
      headTitle: t(`hub.standings.columnTitle.${key}` as DictionaryKey),
      render: (row) => formatInteger(valueOf(row), locale),
      align: "numeric",
      sort: { kind: "number", valueOf },
    };
  }

  return [
    {
      /*
       * `rank` IS A COLUMN, NEVER A ROW INDEX (D3). It is rendered as a value,
       * it survives a user re-sort unchanged (the pipeline's number does not
       * renumber because the reader sorted by goals), and it is never a React
       * key: it is neither unique nor contiguous, because ties are real.
       */
      key: "rank",
      headText: t("hub.standings.column.rank"),
      headTitle: t("hub.standings.columnTitle.rank"),
      render: (row) => formatInteger(row.rank, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.rank },
    },
    {
      key: "team",
      headText: t("hub.standings.column.team"),
      // A whole word in both locales — TableColumn's contract is "full term
      // when headText is abbreviated; null otherwise".
      headTitle: null,
      render: (row) => (
        <RowAnchor href={teamHref(row.team.id)} accessiblePrefix={rowLink}>
          {row.team.name}
        </RowAnchor>
      ),
      align: "text",
      /*
       * THE ONE `<th scope="row">` PER ROW, and it sits SECOND — after the
       * `rank` ordinal (Task 3.1b, ruled). The open ledger entry objects to a
       * row header sitting on the THIRD column; here rank-then-team is the
       * universal standings convention and an ordinal is not a competing
       * identity, so the row header is still the first thing in the row that
       * NAMES it. Recorded so it is not re-litigated at review.
       */
      rowHeader: true,
      // Team names are proper nouns (AD-7) and never translated, but they DO
      // collate through Intl.Collator('es', {sensitivity:'base'}) — never
      // localeCompare, never `<`/`>` (2.11a decision 8).
      sort: { kind: "text", valueOf: (row) => row.team.name },
    },
    countColumn("played", (row) => row.played),
    countColumn("won", (row) => row.won),
    countColumn("drawn", (row) => row.drawn),
    countColumn("lost", (row) => row.lost),
    countColumn("goalsFor", (row) => row.goalsFor),
    countColumn("goalsAgainst", (row) => row.goalsAgainst),
    /*
     * `goalDifference` is a SIGNED integer, not a `Count` — the contract names
     * the distinction. `formatInteger` carries the sign through Intl, so a
     * negative renders "-4" in the active locale rather than a hand-built
     * string.
     */
    countColumn("goalDifference", (row) => row.goalDifference),
    countColumn("points", (row) => row.points),
    {
      key: "form",
      headText: t("hub.standings.column.form"),
      headTitle: null,
      /*
       * `form` is `MatchResult[]` in CHRONOLOGICAL order, and the schema names
       * this column the chip source verbatim: "The Hub renders result chips
       * straight from it."
       *
       * The array index is the React key here and only here, deliberately: a
       * form strip has no other identity — the same value can repeat — and the
       * list is positional by definition, so index IS the identity. That is a
       * different situation from a ROW key, which D3 forbids deriving from
       * position.
       */
      render: (row) => (
        <span className="flex items-center gap-1">
          {row.form.map((result, index) => (
            <ResultChip key={`${row.key}-form-${index}`} result={result} />
          ))}
        </span>
      ),
      align: "text",
      /*
       * UNSORTABLE, and that is a real decision: a SEQUENCE has no meaningful
       * order. A `sort: null` head deliberately emits NO `aria-sort` at all —
       * announcing "none" on a head that can never sort claims a capability
       * that does not exist. That is a FILED DEPARTURE in the ledger and this
       * is its first Hub consumer; do not "fix" it back.
       */
      sort: null,
    },
  ];
}

/* ---------------------------------------------------------- results columns */

/**
 * The `decidedBy` suffix on a result row.
 *
 * REUSES `decidedByCaption` (`@/lib/match-hero`) — a pure exhaustive switch
 * with a `never` default and a fail-loud null-`shootoutScore` throw, already
 * pinned by `match-hero.test.ts`. A second switch on `decidedBy` is exactly
 * what Task 2.4 forbids.
 *
 * The VISIBLE forms are Hub-scoped and short, because `match.hero.extraTime`
 * ("Definido en tiempo extra") and `match.hero.shootout` ("Penales:") are
 * hero-sized caption copy that does not fit a 390px table row. The full term
 * rides an `sr-only` span beside the short one, so nothing is lost to a screen
 * reader; the extra-time full form REUSES the shipped hero string rather than
 * minting a second name for it.
 *
 * `winnerTeamId` is deliberately NOT rendered (Task 2.4c, ruled): the
 * shoot-out scoreline already names the winner numerically, and marking a
 * winner in the row would need a visual channel — bold, a colour, an icon —
 * that no spine specifies for this surface and that would compete with the
 * result chips the standings own.
 */
function DecidedBySuffix({ row }: { row: HubResultRow }) {
  const t = useT();
  const caption = decidedByCaption(row.knockoutScore);
  if (caption.kind === "none") {
    return null;
  }
  /*
   * Both halves are hoisted into IDENTIFIERS. `react/jsx-no-literals` bans a
   * template literal as a JSX child even when every fragment is a t() call —
   * the same rule `TacticalLayer.tsx` records for conditional gated props. The
   * leading space on the spoken form is deliberate: see `RowAnchor`.
   */
  if (caption.kind === "extra-time") {
    const short = `${SUFFIX_OPEN}${t("hub.results.extraTimeShort")}${SUFFIX_CLOSE}`;
    const spoken = `${SPACE}${t("match.hero.extraTime")}`;
    return (
      <span className="type-caption text-ink-secondary">
        {short}
        <span className="sr-only">{spoken}</span>
      </span>
    );
  }
  const pens = scoreline(
    { home: caption.home, away: caption.away },
    t("match.hero.scoreSeparator")
  );
  const short = `${SUFFIX_OPEN}${pens}${SPACE}${t("match.meta.penShort")}${SUFFIX_CLOSE}`;
  const spoken = `${SPACE}${t("hub.results.shootoutFull")}`;
  return (
    <span className="type-caption text-ink-secondary">
      {short}
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

function useResultColumns(): TableColumn<HubResultRow>[] {
  const t = useT();
  const { locale } = useLocale();
  const rowLink = t("hub.results.rowLink");
  const scoreSeparator = t("match.hero.scoreSeparator");

  return [
    {
      /*
       * THE ROW HEADER, AND IT IS FIRST IN DOM ORDER. The open ledger entry
       * against `scope="row"` on the third column is discharged here by putting
       * it in column one; the standings table takes the ruled rank-then-team
       * exception and records it separately.
       */
      key: "match",
      headText: t("hub.results.column.match"),
      headTitle: null,
      render: (row) => (
        <RowAnchor href={matchHref(row.matchId)} accessiblePrefix={rowLink}>
          <span>{row.homeTeam.name}</span>
          {/*
           * The scoreline is `score` VERBATIM (AD-5) with the shipped en dash
           * from `match.hero.scoreSeparator` — never a literal glyph, and never
           * recomposed from `knockoutScore`. Which point in the match `score`
           * names is a contract question raised to Story 1.17; nothing here
           * depends on the answer, because the row prints the field rather
           * than deriving anything from it.
           */}
          <span className="type-table-numeric text-ink-primary">
            {scoreline(row.score, scoreSeparator)}
          </span>
          <span>{row.awayTeam.name}</span>
          <DecidedBySuffix row={row} />
        </RowAnchor>
      ),
      align: "text",
      rowHeader: true,
      /*
       * Sorted on the HOME team name: it is the cell's leading token, so a
       * reader sorting "Partido" sees the column order by what they read
       * first. Never on the composed cell string, which would sort "Mexico
       * 2–0 South Africa" as one blob.
       */
      sort: { kind: "text", valueOf: (row) => row.homeTeam.name },
    },
    {
      key: "matchNumber",
      headText: t("hub.results.column.matchNumber"),
      headTitle: t("hub.results.columnTitle.matchNumber"),
      render: (row) => formatInteger(row.matchNumber, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.matchNumber },
    },
    {
      key: "date",
      headText: t("hub.results.column.date"),
      headTitle: null,
      // `Intl` only, never hand-formatted (AD-7 / UX-DR19).
      render: (row) => formatDate(row.date, locale),
      align: "text",
      /*
       * Sorted on the ISO string, not on the rendered date: "21 de julio de
       * 2026" collates alphabetically by month name, which is neither
       * chronological nor stable across the locale toggle. ISO 8601 is
       * lexicographically chronological by construction.
       */
      sort: { kind: "text", valueOf: (row) => row.date },
    },
    {
      key: "kickoff",
      headText: t("hub.results.column.kickoff"),
      /*
       * The full term carries the VENUE-LOCAL clarifier, reusing the shipped
       * `match.hero.localTime` ("hora local") rather than minting a second
       * copy of it. Kickoff is venue-local wall-clock time by contract, and a
       * bare "Hora" invites the reader's own timezone.
       *
       * THE CLARIFIER ALONE, never "Hora (hora local)". `DataTable` composes
       * `<prefix> <headText> (<headTitle>)` and suppresses the parenthetical
       * only when `headText` already CONTAINS `headTitle` — so a headTitle that
       * re-states its own headText spoke the name twice, inside nested
       * parentheses: "Ordenar por Hora (Hora (hora local))". Caught at review;
       * the column reads "Ordenar por Hora (hora local)".
       */
      headTitle: t("match.hero.localTime"),
      render: (row) => formatKickoff(row.kickoff, locale),
      // `clock` is LEFT-aligned tabular figures — the alignment MomentumSection's
      // minute column already uses for exactly this kind of value.
      align: "clock",
      sort: { kind: "number", valueOf: (row) => kickoffSortValue(row.kickoff) },
    },
    {
      key: "venue",
      headText: t("hub.results.column.venue"),
      headTitle: null,
      // A proper noun as printed in the report (AD-7) — never translated.
      render: (row) => row.venue,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.venue },
    },
    {
      key: "matchdayRound",
      headText: t("hub.results.column.matchdayRound"),
      headTitle: null,
      /*
       * `matchdayRound` is a RENDERED LABEL and never a sectioning key (ruled
       * D10). It is the only place the three group matchdays are visible at
       * all, since results are sectioned per group.
       */
      render: (row) => t(matchdayRoundLabelKey(row.matchdayRound)),
      align: "text",
      // The RESOLVED label, so the order follows the EN toggle (2.11a
      // decision 2) — never the raw enum code.
      sort: { kind: "text", valueOf: (row) => t(matchdayRoundLabelKey(row.matchdayRound)) },
    },
  ];
}

/* ------------------------------------------------------------ the surfaces */

/**
 * The per-surface "Más columnas" disclosure (AC 4, Task 6.3b — ruled).
 *
 * PER SURFACE, NOT PER TABLE. The standings surface renders twelve group
 * tables and the results surface up to eighteen sections (twelve groups plus
 * one per knockout stage) — THIRTY tables on the route; a per-table control
 * would put twelve disclosures on one 390px screen for a preference that is
 * obviously global. The SORT MENU stays per table, because sort state is
 * inherently per table — that split is the whole of 6.3b's ruling.
 *
 * SCOPE: both surfaces, not just standings. EXPERIENCE.md's responsive row
 * names "Hub standings/leaderboards" and does not mention results, but AC 4
 * says "Hub tables", and a six-column results table at 390px in English has
 * exactly the problem the clause exists for. Recorded as a ruled extension.
 *
 * Copies `ViewDataDisclosure`'s label-key fix — the key is built into a
 * variable, because `{t(cond ? "a" : "b")}` trips the i18n gate.
 *
 * NO `aria-controls`, RULED AT REVIEW, and this is a real departure from both
 * `ViewDataDisclosure` and `TacticalSection` rather than an omission. Those two
 * mount their region conditionally (`{open ? <div/> : null}`) and point
 * `aria-controls` at it only while it exists, which is what "never dangles"
 * means there. THIS control mounts nothing: the surface's content div is
 * permanent and fully visible in both states, and only the column set inside it
 * narrows. Pointing `aria-controls` at that div asserts the div is collapsed,
 * which is false — a reader would hear "Más columnas, button, collapsed" over
 * twelve fully populated tables.
 *
 * `aria-expanded` STAYS, because it is true about the thing that actually
 * toggles: the hidden columns really are `display: none`. `aria-pressed` was
 * the other candidate and is declined — 2.11a decision 10 and 2.11c ruling 9
 * bar it on this surface, and a button that reveals content is a disclosure
 * before it is a toggle.
 */
function ColumnsDisclosure({
  expanded,
  onToggle,
  surfaceName,
}: {
  expanded: boolean;
  onToggle: () => void;
  surfaceName: string;
}) {
  const t = useT();
  const labelKey: DictionaryKey = expanded ? "hub.columns.fewer" : "hub.columns.more";
  // Disambiguated by its surface, so two disclosures on one route do not share
  // an accessible name. Visible text unchanged, so Label in Name holds.
  const accessibleName = `${t(labelKey)}${TITLE_OPEN}${surfaceName}${TITLE_CLOSE}`;
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={accessibleName}
      onClick={onToggle}
      className="flex min-h-11 items-center underline underline-offset-4 type-title text-ink-primary"
    >
      {t(labelKey)}
    </button>
  );
}

function StandingsSurface({ tournament }: { tournament: Tournament }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const isNarrow = useIsNarrow();
  const columns = useStandingsColumns();
  const sections = standingsSections(tournament);
  const countPhrase = useCountPhrase();
  const anchorNonce = useAnchorNonce();

  const visibleKeys = visibleColumnKeys(
    STANDINGS_COLUMN_KEYS,
    STANDINGS_NARROW_COLUMN_KEYS,
    isNarrow,
    expanded
  );
  const heading = t("hub.standings.heading");
  const groupWord = t("match.hero.group");
  const separator = t("hub.separator");

  return (
    <section aria-labelledby={STANDINGS_SURFACE_ID} className="mt-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* `type-title`, not `type-headline`: the route's <h1> is the headline
            and a section head rendering at the same size erases the outline
            visually. The /about + /glossary pattern is h1 headline -> h2 title. */}
        <h2 id={STANDINGS_SURFACE_ID} className="type-title text-ink-primary">
          {heading}
        </h2>
        {isNarrow && sections.length > 0 ? (
          <ColumnsDisclosure
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            surfaceName={heading}
          />
        ) : null}
      </div>
      {/*
       * SURFACE-LEVEL ZERO STATE. `standingsSections` returns [] for a payload
       * whose `groups` is absent, null or empty — all three normalize at the
       * model boundary — and mapping [] under a permanent <h2> left a heading
       * over nothing, with a live "Más columnas" control that toggled a column
       * set belonging to no table. The per-section copy cannot cover this: it
       * is group-scoped ("Sin posiciones para este grupo") and only renders
       * INSIDE a section that exists.
       */}
      {sections.length === 0 ? (
        <div className="mt-tile-gap">
          <EmptyStatePanel
            headline={t("hub.standings.empty.headline")}
            explanation={t("hub.standings.empty.explanation")}
          />
        </div>
      ) : null}
      <div className="mt-tile-gap grid grid-cols-1 gap-section-gap">
        {sections.map((section) => {
          /*
           * The group LETTER is DATA (the contract enum is lowercase "a".."l")
           * and the uppercase transform lives here, in the presentation layer —
           * the shipped `MatchHero` precedent, which uppercases `teamCode` the
           * same way. "Grupo" reuses `match.hero.group`: one term, one key.
           */
          const groupLabel = `${groupWord}${SPACE}${section.group.toUpperCase()}`;
          /*
           * THE SURFACE-QUALIFIED NAME, and it is what the disclosure and the
           * table BOTH carry (2.19 code review).
           *
           * `groupLabel` alone is "Grupo A" — and `ResultsSurface`'s own section
           * title for the same group is the byte-identical "Grupo A". Task 5.7
           * put a `ViewDataDisclosure` on both, so `/` shipped 24 disclosure
           * buttons carrying 12 PAIRS of identical accessible names
           * ("Ver los datos: Grupo A" twice, for every group), with nothing in
           * either name saying which was standings and which was results.
           *
           * That is WCAG 2.4.6 / 4.1.2, and it is the same defect A23 fixed on
           * /compare in this very story — reintroduced on the Hub by the
           * restructuring. The tables were never ambiguous because `tableName`
           * already qualified them; the CONTROL is what lacked it.
           */
          const surfaceQualifiedLabel = `${t("hub.standings.tableName")}${separator}${groupLabel}`;
          return (
            /*
             * `min-w-0` IS LOAD-BEARING, not tidiness. A grid item defaults to
             * `min-width: auto`, which resolves to its content's min-content
             * width — so an eleven-column table inside it makes the ITEM wider
             * than the viewport, the `overflow-x-auto` wrapper inside never
             * becomes the scroller, and the whole DOCUMENT scrolls sideways.
             * Measured at 390px before this class: body scrollWidth 612 against
             * a 375 clientWidth, a 237px WCAG 1.4.10 reflow failure.
             * EXPERIENCE.md:119 gives data tables an INTERNAL-scroll exception,
             * and this is what keeps the scroll internal.
             */
            <div key={section.key} className="min-w-0">
              <h3 id={section.anchorId} className="type-title text-ink-primary">
                {groupLabel}
              </h3>
              {/*
               * SM-C2's count, outside the disclosure (D15). A group with no
               * rows keeps its table rendered FLAT so its named empty state is
               * the thing the reader sees — hiding an empty panel behind a
               * control labelled "Ver los datos" promises data that is not
               * there.
               */}
              {section.rows.length === 0 ? (
                <div className="mt-tile-gap">
                  <HubTable
                    caption={t("hub.standings.caption")}
                    columns={columns}
                    visibleKeys={visibleKeys}
                    rows={section.rows}
                    tableName={`${t("hub.standings.tableName")}${separator}${groupLabel}`}
                    emptyHeadline={t("hub.standings.empty.headline")}
                    emptyExplanation={t("hub.standings.empty.explanation")}
                    showSortMenu={isNarrow}
                    onRevealColumns={() => setExpanded(true)}
                  />
                </div>
              ) : (
                <>
                  <p className="mt-1 type-caption tabular-nums text-ink-secondary">
                    {countPhrase(
                      section.rows.length,
                      "hub.standings.teamsCountOne",
                      "hub.standings.teamsCount"
                    )}
                  </p>
                  <div className="mt-tile-gap">
                    <ViewDataDisclosure
                      panelTitle={surfaceQualifiedLabel}
                      surface="canvas"
                      openNonce={anchorNonce(section.anchorId)}
                    >
                      <HubTable
                        caption={t("hub.standings.caption")}
                        columns={columns}
                        visibleKeys={visibleKeys}
                        rows={section.rows}
                        // Twelve tables share one polite live region, so each is
                        // named with its own group — an unnamed table in a
                        // multi-table route produces an ambiguous announcement.
                        tableName={`${t("hub.standings.tableName")}${separator}${groupLabel}`}
                        emptyHeadline={t("hub.standings.empty.headline")}
                        emptyExplanation={t("hub.standings.empty.explanation")}
                        // The sort menu is the NARROW-LAYOUT sort control, so it
                        // tracks the breakpoint rather than the hidden-column
                        // count. See the ruling in HubTable.
                        showSortMenu={isNarrow}
                        // Sorting an off-screen column from the menu opens the
                        // disclosure, so the reader can see the column they
                        // sorted by.
                        onRevealColumns={() => setExpanded(true)}
                      />
                    </ViewDataDisclosure>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultsSurface({ tournament }: { tournament: Tournament }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const isNarrow = useIsNarrow();
  const columns = useResultColumns();
  const sections = resultsSections(tournament);
  const countPhrase = useCountPhrase();
  const anchorNonce = useAnchorNonce();

  const visibleKeys = visibleColumnKeys(
    RESULT_COLUMN_KEYS,
    RESULT_NARROW_COLUMN_KEYS,
    isNarrow,
    expanded
  );
  const heading = t("hub.results.heading");
  const groupWord = t("match.hero.group");
  const separator = t("hub.separator");

  /** A section's own heading string — its group letter or its stage label. */
  function headingText(sectionHeading: HubResultsHeading): string {
    if (sectionHeading.kind === "group") {
      return `${groupWord}${SPACE}${sectionHeading.group.toUpperCase()}`;
    }
    // All seven stage labels already ship, ruled, including "Dieciseisavos de
    // final" — none is re-minted here.
    return t(stageLabelKey(sectionHeading.stage));
  }

  return (
    <section aria-labelledby={RESULTS_SURFACE_ID} className="mt-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* h1 headline -> h2 title, the /about + /glossary outline. */}
        <h2 id={RESULTS_SURFACE_ID} className="type-title text-ink-primary">
          {heading}
        </h2>
        {isNarrow && sections.length > 0 ? (
          <ColumnsDisclosure
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            surfaceName={heading}
          />
        ) : null}
      </div>
      {/* Surface-level zero state — see StandingsSurface for the reasoning. */}
      {sections.length === 0 ? (
        <div className="mt-tile-gap">
          <EmptyStatePanel
            headline={t("hub.results.empty.headline")}
            explanation={t("hub.results.empty.explanation")}
          />
        </div>
      ) : null}
      <div className="mt-tile-gap grid grid-cols-1 gap-section-gap">
        {sections.map((section) => {
          const sectionTitle = headingText(section.heading);
          // See StandingsSurface: the disclosure's name must say WHICH surface,
          // because a group's results section and its standings section share a
          // heading exactly (2.19 code review).
          const surfaceQualifiedTitle = `${t("hub.results.tableName")}${separator}${sectionTitle}`;
          return (
            /*
             * `min-w-0` IS LOAD-BEARING, not tidiness. A grid item defaults to
             * `min-width: auto`, which resolves to its content's min-content
             * width — so an eleven-column table inside it makes the ITEM wider
             * than the viewport, the `overflow-x-auto` wrapper inside never
             * becomes the scroller, and the whole DOCUMENT scrolls sideways.
             * Measured at 390px before this class: body scrollWidth 612 against
             * a 375 clientWidth, a 237px WCAG 1.4.10 reflow failure.
             * EXPERIENCE.md:119 gives data tables an INTERNAL-scroll exception,
             * and this is what keeps the scroll internal.
             */
            <div key={section.key} className="min-w-0">
              <h3 id={section.anchorId} className="type-title text-ink-primary">
                {sectionTitle}
              </h3>
              {/* See StandingsSurface for the SM-C2 reasoning and the
                  empty-section carve-out. */}
              {section.rows.length === 0 ? (
                <div className="mt-tile-gap">
                  <HubTable
                    caption={t("hub.results.caption")}
                    columns={columns}
                    visibleKeys={visibleKeys}
                    rows={section.rows}
                    tableName={`${t("hub.results.tableName")}${separator}${sectionTitle}`}
                    emptyHeadline={t("hub.results.empty.headline")}
                    emptyExplanation={t("hub.results.empty.explanation")}
                    showSortMenu={isNarrow}
                    onRevealColumns={() => setExpanded(true)}
                  />
                </div>
              ) : (
                <>
                  <p className="mt-1 type-caption tabular-nums text-ink-secondary">
                    {countPhrase(
                      section.rows.length,
                      "hub.results.matchesCountOne",
                      "hub.results.matchesCount"
                    )}
                  </p>
                  <div className="mt-tile-gap">
                    <ViewDataDisclosure
                      panelTitle={surfaceQualifiedTitle}
                      surface="canvas"
                      openNonce={anchorNonce(section.anchorId)}
                    >
                      <HubTable
                        caption={t("hub.results.caption")}
                        columns={columns}
                        visibleKeys={visibleKeys}
                        rows={section.rows}
                        tableName={`${t("hub.results.tableName")}${separator}${sectionTitle}`}
                        emptyHeadline={t("hub.results.empty.headline")}
                        emptyExplanation={t("hub.results.empty.explanation")}
                        showSortMenu={isNarrow}
                        onRevealColumns={() => setExpanded(true)}
                      />
                    </ViewDataDisclosure>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- shell */

/**
 * The route's `<h1>`.
 *
 * A CLIENT component, and separate from the region below, for two reasons that
 * both matter. (1) It must swap on the language toggle: a server `t()` renders
 * canonical Spanish into the export and never changes again — the house
 * pattern is a thin server page over a client body (`/about`, `/glossary`).
 * (2) It must render in ALL FOUR fetch states, so the page is never a document
 * with no heading while `tournament.json` is in flight or has failed.
 */
export function TournamentHubHeading() {
  const t = useT();
  return <h1 className="type-headline text-ink-primary">{t("hub.title")}</h1>;
}

/*
 * UX-DR18's DEEP LINKS, made reachable (Task 4.1b).
 *
 * Every section anchor on this route — `#standings-group-a`, `#results-r32`,
 * the two surface ids — lives inside the client-fetched region, so it DOES NOT
 * EXIST in the exported HTML the browser resolves the fragment against. The
 * browser tries once, finds nothing, and never retries: a shared `…/#results-r32`
 * link silently landed at the top of the page.
 *
 * The mount-time read is therefore load-bearing, not belt-and-braces, and the
 * `hashchange` subscription then serves in-page anchor navigation. Copied from
 * `ExpertLayer.tsx:239-250` and `TacticalLayer.tsx:121-134`, which solve exactly
 * this problem for exactly this fetch shape.
 *
 * THIS IS THE SCROLL HALF ONLY, and it used to say so because "the Hub's sections
 * do not collapse". Task 5.7 made every populated section collapse behind a
 * `ViewDataDisclosure`, so that sentence is no longer true (2.19 code review):
 * the OPEN half now exists too, as `useAnchorNonce` above feeding
 * `openNonce`. The two are deliberately separate hooks — one moves the viewport,
 * the other opens the control — and a deep link needs both.
 *
 * `scroll-padding-top` on <html> (globals.css) keeps the target clear of the
 * sticky site header.
 *
 * IT IS DERIVED, NOT THE `4.5rem` CONSTANT THIS COMMENT USED TO NAME (ledger
 * `deferred-work.md:4789`, taken by story 3.9). Story 3.10 D9 replaced the
 * literal with `calc(var(--header-h) + var(--spacing-scroll-clearance))`: the
 * bar stopped being 3.5rem when the authorship caption landed, so at any
 * wrapped width the old constant left an anchored heading 46 px UNDER the bar.
 * The conclusion is unchanged and now holds at every width.
 */
function useHashScroll(): void {
  useEffect(() => {
    function scrollFromHash() {
      const id = window.location.hash.replace(HASH_PREFIX, "");
      if (id === "") {
        return;
      }
      document.getElementById(id)?.scrollIntoView();
    }
    scrollFromHash();
    window.addEventListener("hashchange", scrollFromHash);
    return () => window.removeEventListener("hashchange", scrollFromHash);
  }, []);
}

export function TournamentHub({ tournament }: { tournament: Tournament }) {
  useHashScroll();
  return (
    <div>
      <StandingsSurface tournament={tournament} />
      <ResultsSurface tournament={tournament} />
    </div>
  );
}

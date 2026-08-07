"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { TableSortMenu, useTableSort } from "@/components/TableSortMenu";
import { matchHref, stageLabelKey, visibleColumnKeys } from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeMetricLabel,
  formatCount,
  formatProfileValue,
  startedLabelKey,
} from "@/lib/player-profile-format";
import { formatDate } from "@/lib/format";
import type { TableColumn } from "@/lib/table-sort";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { MIN_HIT_PX } from "@/viz/marker-layout";
import { MATCHES_SECTION_ID, type MatchRow } from "@/viz/player-profile-model";

/*
 * The #matches content (Story 2.15, AC 1's closing altitude and AC 3): the FULL
 * per-match table, last on the route, with every row linking to that match.
 *
 * "FULL" IS LITERAL. All fifteen rendered `PlayerMatchRow` fields ship —
 * `matchId` is the link TARGET rather than a column, and the other fifteen are
 * columns. NFR-3/UX-DR17 make the narrow layout a LAYOUT change and never a data
 * removal, so the `<md` set HIDES columns with `display: none` and the sort menu
 * still offers every one of them.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const SPACE = " ";
const CAPTION_SEPARATOR = " — ";

/*
 * THE STRETCHED ROW ANCHOR — Story 2.12's shipped pattern (`TournamentHub.tsx`),
 * reused verbatim rather than re-derived, on this route's second surface for it.
 *
 * ONE ANCHOR PER ROW, NOT ONE PER CELL (ruled D2). Thirteen per-cell links were
 * rejected on four independent grounds: 2.13 ruling 3 puts a table CELL on
 * different footing from a lineup name and 2.11b ruled Expert cells plain text;
 * WCAG 2.4.4 (thirteen links per row, same href, different visible text);
 * keyboard cost (8 rows x 13 anchors is ~104 tab stops in one table with no
 * bypass); and `text-accent-cyan` is BOTH the house link colour and
 * `DataTable`'s active-sort head cue, so thirteen cyan cells per row would erase
 * the sort cue. `after:absolute after:inset-0` over a `<tr className="relative">`
 * makes the WHOLE ROW the target, which is what AC 3's "tapping any value"
 * actually asks for.
 *
 * THE OPEN LEDGER ITEM THIS STORY OWNS — "the row-link focus ring paints on the
 * ANCHOR's box, not on the row" — IS ADDRESSED, not restated. The ring is moved
 * off the anchor's own box and onto the `<tr>` via `focus-within`, so a keyboard
 * user sees the ROW they are about to activate rather than a ring around the
 * date cell. `rowClass` below carries it; `outline-none` on the anchor is safe
 * ONLY because the row paints a ring in its place, which is the one condition
 * that makes suppressing a focus indicator legal.
 */
const ROW_ANCHOR_CLASS =
  "flex min-w-0 items-center after:absolute after:inset-0 hover:underline focus-visible:outline-none";

const ROW_CLASS =
  "relative focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-ring";

function RowAnchor({
  href,
  accessiblePrefix,
  children,
}: {
  href: string;
  accessiblePrefix: string;
  children: ReactNode;
}) {
  /*
   * THE TRAILING SPACE IS DELIBERATE (2.12's finding): the accessible-name
   * algorithm inserts a space between element children, but the DOM text is
   * concatenated raw, so the name read out of the live DOM was
   * "Ver el partidoFase de grupos". An explicit separator makes it true in every
   * engine rather than true in the spec.
   */
  const prefix = `${accessiblePrefix}${SPACE}`;
  return (
    <Link
      href={href}
      /*
       * NO PREFETCH. Next prefetches every `<Link>` entering the viewport, so an
       * 8-row table would fire eight route requests on load and re-fire them on
       * every re-order. Seven of eight 404 on the fixture tree by construction
       * (see the section docblock), and even at real data the reader has asked
       * for none of them.
       */
      prefetch={false}
      className={ROW_ANCHOR_CLASS}
      style={{ minHeight: MIN_HIT_PX }}
    >
      <span className="sr-only">{prefix}</span>
      {children}
    </Link>
  );
}

/** `true` below `md`. Reuses the shipped rem-declared breakpoint, never a px copy. */
function useIsNarrow(): boolean {
  return !useMediaQuery(MD_MEDIA_QUERY);
}

/*
 * THE `<md` COLUMN SET (UX-DR17), ruled here because nothing upstream specifies
 * it. It keeps the ROW-HEADER column non-negotiably — `<th scope="row">` is what
 * names every other cell in the row, and a table that hides it stops being
 * navigable rather than merely narrower — plus the four numbers a per-match
 * reader reads first: minutes, goals, distance and top speed.
 *
 * Hidden means `display: none`, NOT removed from the column list: `sortRows`
 * resolves the active `columnKey` against the list `DataTable` is given, so
 * filtering hidden columns out makes the rows silently un-sort the instant a
 * reader picks one from the menu — verbatim the open ledger defect, reached by
 * the exact route UX-DR17 requires.
 */
const MATCH_COLUMN_KEYS = [
  "date",
  "opponent",
  "stage",
  "started",
  "minutesPlayed",
  "goals",
  "attemptsAtGoal",
  "passesAttempted",
  "passesCompleted",
  "passCompletion",
  "ballProgressions",
  "duelsWonAerial",
  "duelsWonPhysical",
  "totalDistance",
  "topSpeed",
] as const;

const MATCH_NARROW_COLUMN_KEYS = [
  "date",
  "opponent",
  "minutesPlayed",
  "goals",
  "totalDistance",
  "topSpeed",
] as const;

const HIDDEN_COLUMN_CLASS = "hidden";

export function PlayerMatchesSection({ rows }: { rows: readonly MatchRow[] }) {
  const t = useT();
  const { locale } = useLocale();
  const isNarrow = useIsNarrow();
  const [expanded, setExpanded] = useState(false);

  const title = t("player.sections.matches.title");
  const tableName = t("player.tableName.matches");
  const rowLink = t("hub.results.rowLink");
  const metresLabel = t("enums.unit.m");
  const kmhLabel = t("enums.unit.kmh");

  /** A count column — the shape fifteen of these share. */
  function countColumn(
    key: (typeof MATCH_COLUMN_KEYS)[number],
    headText: string,
    valueOf: (row: MatchRow) => number
  ): TableColumn<MatchRow> {
    return {
      key,
      headText,
      headTitle: null,
      render: (row) => formatProfileValue(valueOf(row), "integer", locale),
      align: "numeric",
      sort: { kind: "number", valueOf },
    };
  }

  const columns: TableColumn<MatchRow>[] = [
    {
      key: "date",
      headText: t("player.column.date"),
      headTitle: null,
      /*
       * THE ROW HEADER CARRIES THE ANCHOR (D2). `#expert` is the target: all
       * sixteen fields in this row are Domain G PER-PLAYER fields, and the
       * Expert Layer's per-player table is the only Match Dashboard surface
       * carrying this player's own numbers — `#shot-maps` would land the reader
       * on a TEAM-level map that does not show the number they tapped.
       *
       * THE TRAILING SLASH BEFORE `#` IS MANDATORY. `trailingSlash: true`
       * rewrites a slash-less href at request time and the fragment is lost;
       * `matchHref` emits the slash, which is why it is called rather than
       * interpolated.
       *
       * `#expert` is deliberately NOT a `SectionId` —`TacticalLayer`'s
       * `sectionIdFromHash` returns null for it BY DESIGN and `ExpertLayer` owns
       * its own listener, which is WHOLE-STRING equality on
       * `window.location.hash === "#expert"`. Anything finer ("#expert-content")
       * is silently ignored.
       */
      render: (row) => (
        <RowAnchor href={`${matchHref(row.matchId)}#expert`} accessiblePrefix={rowLink}>
          <span className="tabular-nums">{formatDate(row.date, locale)}</span>
        </RowAnchor>
      ),
      align: "text",
      rowHeader: true,
      /* The ISO string, which is lexicographically chronological — never the
       * RENDERED "11 de junio de 2026", which collates by first digit. */
      sort: { kind: "text", valueOf: (row) => row.date },
    },
    {
      key: "opponent",
      headText: t("player.column.opponent"),
      headTitle: null,
      /*
       * PLAIN TEXT, not a second link. The row is already one link; a nested
       * `/teams/{id}/` anchor inside it would be an interactive element inside a
       * link, which is invalid, and would add a second tab stop per row.
       */
      render: (row) => row.opponent.name,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.opponent.name },
    },
    {
      key: "stage",
      headText: t("player.column.stage"),
      headTitle: null,
      render: (row) => t(stageLabelKey(row.stage)),
      align: "text",
      /* The RESOLVED label, so the order follows the language toggle. */
      sort: { kind: "text", valueOf: (row) => t(stageLabelKey(row.stage)) },
    },
    {
      key: "started",
      headText: t("player.column.started"),
      headTitle: null,
      /* A boolean is never printed raw — it goes through a ruled label pair. */
      render: (row) => t(startedLabelKey(row.started)),
      align: "text",
      sort: { kind: "text", valueOf: (row) => t(startedLabelKey(row.started)) },
    },
    countColumn("minutesPlayed", t("player.column.minutesPlayed"), (row) => row.minutesPlayed),
    countColumn("goals", t("enums.leaderboardMetric.goals"), (row) => row.goals),
    /*
     * `attemptsAtGoal` and `passesAttempted` ARE NOT `MetricCode`s (Story 1.18),
     * so their labels come from `expert.field.*` — reused, never minted.
     */
    countColumn("attemptsAtGoal", t("expert.field.attemptsAtGoal"), (row) => row.attemptsAtGoal),
    countColumn(
      "passesAttempted",
      t("expert.field.passesAttempted"),
      (row) => row.passesAttempted
    ),
    countColumn(
      "passesCompleted",
      t("enums.leaderboardMetric.passesCompleted"),
      (row) => row.passesCompleted
    ),
    {
      key: "passCompletion",
      headText: t("enums.leaderboardMetric.passCompletion"),
      headTitle: null,
      /*
       * `0,0 %` PRINTS VERBATIM (ruled D4b). 17 players and 52 emitted rows
       * carry it, meaning "attempted no passes" rather than "completed none of
       * many" — and the DISAMBIGUATION IS THE ADJACENT COLUMN: `passesAttempted`
       * renders in the same row, so the honest reading is available without
       * minting an interpretive gloss. (At Hero and aggregate altitude it is not
       * adjacent; that ambiguity is filed rather than papered over.)
       */
      render: (row) => formatProfileValue(row.passCompletion, "percent", locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.passCompletion },
    },
    countColumn(
      "ballProgressions",
      t("enums.leaderboardMetric.ballProgressions"),
      (row) => row.ballProgressions
    ),
    countColumn(
      "duelsWonAerial",
      t("expert.field.duelsWonAerial"),
      (row) => row.duelsWonAerial
    ),
    countColumn(
      "duelsWonPhysical",
      t("expert.field.duelsWonPhysical"),
      (row) => row.duelsWonPhysical
    ),
    {
      key: "totalDistance",
      /*
       * METRES on a player profile, always. `distanceCovered` is the team-scope
       * KILOMETRES field and the two must never cross (Story 1.10: "convert
       * explicitly and once"). The unit rides the HEAD here — this table is not
       * transposed, so 2.13's head-side rule applies unchanged.
       */
      headText: composeMetricLabel(
        t("enums.leaderboardMetric.totalDistance"),
        metresLabel
      ),
      headTitle: null,
      /* 1 dp, NOT the leaderboards' "integer": 2,937 of 3,288 real match rows
       * are fractional, and rounding a precomputed value breaches AR-5. */
      render: (row) => formatProfileValue(row.totalDistance, "decimal1", locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.totalDistance },
    },
    {
      key: "topSpeed",
      headText: composeMetricLabel(t("enums.leaderboardMetric.topSpeed"), kmhLabel),
      headTitle: t("enums.leaderboardMetric.topSpeed"),
      render: (row) => formatProfileValue(row.topSpeed, "decimal1", locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.topSpeed },
    },
  ];

  /* Hoisted into a variable — `{t(cond ? "a" : "b")}` trips the i18n gate. */
  const columnsLabelKey: DictionaryKey = expanded ? "hub.columns.fewer" : "hub.columns.more";

  /*
   * Hoisted for the same reason: `caption` is a gated prop name and the gate
   * fires on a template literal there even when every fragment is a t() call.
   */
  const matchesCaption = `${title}${CAPTION_SEPARATOR}${t(
    "player.caption.matches"
  )}${CAPTION_SEPARATOR}${t("player.caption.matchesLink")}`;

  const visibleKeys: readonly string[] = visibleColumnKeys(
    MATCH_COLUMN_KEYS,
    MATCH_NARROW_COLUMN_KEYS,
    isNarrow,
    expanded
  );
  const hiddenKeys = new Set(
    columns.filter((column) => !visibleKeys.includes(column.key)).map((column) => column.key)
  );
  const renderedColumns = columns.map((column) =>
    hiddenKeys.has(column.key)
      ? { ...column, cellClass: cn(column.cellClass, HIDDEN_COLUMN_CLASS) }
      : column
  );

  const controller = useTableSort({
    columns: renderedColumns as readonly TableColumn<never>[],
    tableName,
  });

  /* Sorting a hidden column REVEALS it — otherwise the rows re-order with no
   * visible cause on the narrowest layout the site supports. */
  const menuController = {
    ...controller,
    sortByColumn: (columnKey: string) => {
      if (hiddenKeys.has(columnKey)) {
        setExpanded(true);
      }
      controller.sortByColumn(columnKey);
    },
  };

  /*
   * `matches: []` IS AN EMPTINESS BRANCH, NOT A SHAPE BRANCH (ruled D8). 209
   * players (16.7%) never appeared; UX-DR13 gives that slot an `EmptyStatePanel`
   * — "never a silent absence, never layout collapse". A zero-row table would
   * also present fifteen live sort controls over an empty `<tbody>`, which is
   * the open ledger defect `HubTable` closes the same way.
   */
  if (rows.length === 0) {
    return (
      <section id={MATCHES_SECTION_ID} className="mt-layer-gap">
        <h2 className="type-title text-ink-primary">{title}</h2>
        <div className="mt-3">
          {/* Dedicated copy — `useEmptyHeadline()` says "para este partido",
           * which is false on a profile. See TrendsSection for the full note. */}
          <EmptyStatePanel
            headline={t("player.empty.matchesHeadline")}
            explanation={t("player.empty.matchesExplanation")}
          />
        </div>
      </section>
    );
  }

  return (
    <section id={MATCHES_SECTION_ID} className="mt-layer-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>

      {isNarrow ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          {/*
           * `hub.columns.more` / `hub.columns.fewer` REUSED, not minted (D12) —
           * this is the same control the Hub ships, doing the same thing.
           *
           * NO `aria-controls`: this button mounts nothing. The table div is
           * permanent and fully visible in both states and only the column set
           * inside it narrows, so pointing `aria-controls` at it would assert
           * the table is collapsed. `aria-expanded` STAYS, because it is true
           * about the thing that toggles — the hidden columns really are
           * `display: none`. (TournamentHub's ruling, same control.)
           */}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-11 items-center underline underline-offset-4 type-caption text-ink-primary"
          >
            {t(columnsLabelKey)}
          </button>
          <TableSortMenu
            columns={columns}
            controller={menuController}
            tableName={tableName}
          />
        </div>
      ) : null}

      {/*
       * THE CALLER'S SCROLLPORT. `DataTable` renders none and must not — its
       * sticky mode resolves against the nearest scrolling ancestor, and the one
       * departure 2.11a declared was a sticky rule inside a height-UNBOUNDED
       * ancestor that computed correctly and silently did nothing. Fifteen
       * columns overflow every viewport the site supports, so the table scrolls
       * inside its own container and never the page (UX-DR16's data-table
       * exception). `min-w-0` is what stops a flex ancestor handing this div its
       * content width instead of its available width.
       */}
      <div className="mt-3 w-full min-w-0 overflow-x-auto">
        <DataTable
          caption={matchesCaption}
          columns={renderedColumns}
          rows={rows}
          surface="canvas"
          tableName={tableName}
          sortState={controller.sortState}
          onSortChange={controller.setSortState}
          /* D9's containing block: the anchor's `after:inset-0` resolves against
           * the nearest positioned ancestor. Without `relative` the pseudo-
           * element would cover the page. */
          rowClass={ROW_CLASS}
        />
      </div>
    </section>
  );
}

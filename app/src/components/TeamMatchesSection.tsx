"use client";

import { useState } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { ResultChip } from "@/components/ResultChip";
import { RowAnchor } from "@/components/RowAnchor";
import { TableSortMenu, useTableSort } from "@/components/TableSortMenu";
import { formatDate } from "@/lib/format";
import {
  matchHref,
  matchResultWordKey,
  stageLabelKey,
  visibleColumnKeys,
} from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import {
  formatExpectedGoals,
  formatKilometres,
  formatRateValue,
  formatTeamCount,
} from "@/lib/team-profile-format";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { TEAM_MATCHES_SECTION_ID, type TeamMatchRow } from "@/viz/team-profile-model";

/*
 * The #matches content (Story 2.16, AC 1's closing altitude): the FULL per-match
 * breakdown, last on the route, with every row linking to that Match Dashboard.
 *
 * "FULL" IS LITERAL. All fourteen rendered fields ship — `matchId` is the link
 * TARGET rather than a column. NFR-3/UX-DR17 make the narrow layout a LAYOUT
 * change and never a data removal, so the `<md` set HIDES columns with
 * `display: none` and the sort menu still offers every one of them.
 *
 * THE ANCHOR IS `#key-stats`, AND IT DELIBERATELY DIFFERS FROM `/players`.
 * Story 2.15 ships `#expert` because a player row's payload is Domain G. A team
 * row's payload — possession, expectedGoals, shots, shotsOnTarget,
 * passCompletion, distanceCovered — is Domain B, so it anchors to the stable
 * `#key-stats` section (navigating to an anchor auto-expands its section). Only
 * 2.15's one-link-per-row REASONING is inherited, not its anchor.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";
const SCORE_SEPARATOR = "-";

/** `true` below `md`. Reuses the shipped rem-declared breakpoint, never a px copy. */
function useIsNarrow(): boolean {
  return !useMediaQuery(MD_MEDIA_QUERY);
}

/*
 * THE `<md` COLUMN SET (UX-DR17). It keeps the ROW-HEADER column
 * non-negotiably — `<th scope="row">` is what names every other cell in the row,
 * and a table that hides it stops being navigable rather than merely narrower —
 * plus the four things a per-match reader reads first: the opponent, the result,
 * the score and possession.
 *
 * Hidden means `display: none`, NOT removed from the column list: `sortRows`
 * resolves the active `columnKey` against the list `DataTable` is given, so
 * filtering hidden columns out makes the rows silently un-sort the instant a
 * reader picks one from the menu.
 */
const MATCH_COLUMN_KEYS = [
  "date",
  "opponent",
  "stage",
  "venue",
  "result",
  "score",
  "formation",
  "possession",
  "expectedGoals",
  "shots",
  "shotsOnTarget",
  "passCompletion",
  "distanceCovered",
] as const;

const MATCH_NARROW_COLUMN_KEYS = ["date", "opponent", "result", "score", "possession"] as const;

/* The same set as a `ReadonlySet<string>`, for membership tests against a
 * `SortState.columnKey` — a plain `string` that the `as const` tuple's own
 * `.includes` will not accept. */
const MATCH_NARROW_COLUMN_KEY_SET: ReadonlySet<string> = new Set(MATCH_NARROW_COLUMN_KEYS);

const HIDDEN_COLUMN_CLASS = "hidden";

export function TeamMatchesSection({ rows }: { rows: readonly TeamMatchRow[] }) {
  const t = useT();
  const { locale } = useLocale();
  const isNarrow = useIsNarrow();
  const [expanded, setExpanded] = useState(false);

  const title = t("team.sections.matches.title");
  const tableName = t("team.tableName.matches");
  const rowLink = t("hub.results.rowLink");

  /** A count column — the shape three of these share. */
  function countColumn(
    key: (typeof MATCH_COLUMN_KEYS)[number],
    headText: string,
    valueOf: (row: TeamMatchRow) => number
  ): TableColumn<TeamMatchRow> {
    return {
      key,
      headText,
      headTitle: null,
      render: (row) => formatTeamCount(valueOf(row), locale),
      align: "numeric",
      sort: { kind: "number", valueOf },
    };
  }

  const columns: TableColumn<TeamMatchRow>[] = [
    {
      key: "date",
      headText: t("team.column.date"),
      headTitle: null,
      /*
       * THE ROW HEADER CARRIES THE ANCHOR, one per row (D4). The hoisted
       * `RowAnchor` supplies `prefetch={false}` by default and the native focus
       * ring on its own box — ruled Q2, taken by Juan.
       *
       * THE TRAILING SLASH BEFORE `#` IS MANDATORY. `trailingSlash: true`
       * rewrites a slash-less href at request time and the fragment is LOST;
       * `matchHref` emits the slash, which is why it is called rather than
       * interpolated.
       */
      render: (row) => (
        <RowAnchor href={`${matchHref(row.matchId)}#key-stats`} accessiblePrefix={rowLink}>
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
      headText: t("team.column.opponent"),
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
      headText: t("team.column.stage"),
      headTitle: null,
      render: (row) => t(stageLabelKey(row.stage)),
      align: "text",
      /* The RESOLVED label, so the order follows the language toggle. */
      sort: { kind: "text", valueOf: (row) => t(stageLabelKey(row.stage)) },
    },
    {
      key: "venue",
      headText: t("team.column.venue"),
      headTitle: null,
      /* A boolean is never printed raw — it goes through a ruled label pair. */
      render: (row) => t(row.isHome ? "team.venue.home" : "team.venue.away"),
      align: "text",
      sort: {
        kind: "text",
        valueOf: (row) => t(row.isHome ? "team.venue.home" : "team.venue.away"),
      },
    },
    {
      key: "result",
      headText: t("team.column.result"),
      headTitle: null,
      /*
       * THE RESULT CHIP (D3), reused exactly as shipped — fill plus letter,
       * non-interactive, letters keyed off the enum rather than the letter (es
       * `D` is derrota, en `D` is draw).
       *
       * THE FOUR SHOOTOUT MATCHES READ `draw` AND ARE NOT ANNOTATED (Story 1.18
       * R4, ruled Q3 by Juan: no new copy). `result` follows `metadata.score`,
       * so a team that advanced on penalties shows a draw chip on that row;
       * progression is carried only by `record.furthestStage` on the Hero.
       */
      render: (row) => <ResultChip result={row.result} />,
      align: "text",
      /*
       * SORTED ON THE SPOKEN WORD, not the enum and not the letter. `t()` of the
       * full word re-orders under the EN toggle, which is the sort contract's
       * rule for any column whose rendered value is locale-resolved.
       */
      /* THROUGH THE SHIPPED BUILDER, never a hand-interpolated template (code
       * review 2026-08-07). `matchResultWordKey` is exported from `hub-model.ts`
       * and pinned by `hub-model.test.ts`; the `stage` column two rows above
       * already calls `stageLabelKey` from the same module, so interpolating
       * here was inconsistent inside one array literal and skipped the one
       * builder that keeps the key and the enum from drifting apart. */
      sort: { kind: "text", valueOf: (row) => t(matchResultWordKey(row.result)) },
    },
    {
      key: "score",
      headText: t("team.column.score"),
      headTitle: null,
      /*
       * SELECTED, NEVER DERIVED. `goalsFor` and `goalsAgainst` are contracted
       * per-row fields; the separator is a presentation glyph and the pair is
       * never summed into a goal difference here (the record's own
       * `goalDifference` ships signed and is the Hero's).
       */
      render: (row) =>
        `${formatTeamCount(row.goalsFor, locale)}${SCORE_SEPARATOR}${formatTeamCount(
          row.goalsAgainst,
          locale
        )}`,
      align: "numeric",
      /* Ordered by goals FOR — the only single number a score column can sort
       * on without inventing a composite the artifact does not carry. */
      sort: { kind: "number", valueOf: (row) => row.goalsFor },
    },
    {
      key: "formation",
      headText: t("team.column.formation"),
      headTitle: null,
      /* Locale-neutral data: a notation, never translated. */
      render: (row) => row.formation,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.formation },
    },
    {
      key: "possession",
      /*
       * REUSED from `enums.leaderboardMetric`, which already carries all six of
       * this table's Domain B metric terms. Minting `team.column.*` twins would
       * be a second home for each term — 2.18's prohibition — for no gain.
       */
      headText: t("enums.leaderboardMetric.possession"),
      headTitle: null,
      render: (row) => formatRateValue(row.possession, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.possession },
    },
    {
      key: "expectedGoals",
      headText: t("enums.leaderboardMetric.expectedGoals"),
      headTitle: null,
      /* 2 dp: the artifact ships xG at two decimals and rounding a precomputed
       * value breaches AR-5. `formatExpectedGoals`, NOT `formatKilometres` —
       * xG is dimensionless and the kilometres formatter's own docblock forbids
       * crossing scopes (code review 2026-08-07). */
      render: (row) => formatExpectedGoals(row.expectedGoals, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.expectedGoals },
    },
    countColumn("shots", t("enums.leaderboardMetric.shots"), (row) => row.shots),
    countColumn(
      "shotsOnTarget",
      t("enums.leaderboardMetric.shotsOnTarget"),
      (row) => row.shotsOnTarget
    ),
    {
      key: "passCompletion",
      headText: t("enums.leaderboardMetric.passCompletion"),
      headTitle: null,
      render: (row) => formatRateValue(row.passCompletion, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.passCompletion },
    },
    {
      key: "distanceCovered",
      /*
       * KILOMETRES on a team profile, always. `totalDistance` is the
       * player-scope METRES field and the two must never cross (Story 1.10:
       * "convert explicitly and once"). The unit rides the HEAD — this table is
       * not transposed, so 2.13's head-side rule applies unchanged.
       */
      headText: `${t("enums.leaderboardMetric.distanceCovered")} (${t("enums.unit.km")})`,
      headTitle: t("enums.leaderboardMetric.distanceCovered"),
      render: (row) => formatKilometres(row.distanceCovered, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.distanceCovered },
    },
  ];

  /* Hoisted into a variable — `{t(cond ? "a" : "b")}` trips the i18n gate. */
  const columnsLabelKey: DictionaryKey = expanded ? "hub.columns.fewer" : "hub.columns.more";

  /*
   * Hoisted for the same reason: `caption` is a gated prop name and the gate
   * fires on a template literal there even when every fragment is a t() call.
   *
   * THE CAPTION STATES THE CHRONOLOGICAL DEFAULT, which is how UX-DR12's "default
   * sort is stated" obligation is discharged — never by a sorted-on-mount column.
   * `DataTable` has no `defaultSort` prop and one must not be added: every table
   * mounts at `null`, which IS the artifact order (AD-5). The caption never
   * mutates.
   */
  /*
   * THE SCORE COLUMN'S SORT KEY IS DISCLOSED HERE, IN THE CAPTION (code review
   * 2026-08-07). "Marcador" renders `2-0` but sorts on `goalsFor` alone, so 2-0
   * and 2-3 tie arbitrarily and nothing on screen or in the announcement said
   * so. The caption is the ruled slot for sort semantics — UX-DR12 obligation 1
   * discharges "default sort is stated" through the caption and never through a
   * sorted-on-mount column — and it is the ONLY correct slot here: obligation 11
   * bans pre-composing a parenthetical into `headTitle`, which would render as
   * "Ordenar por Marcador (…)" through `composeHeadAccessibleName`.
   */
  const caption = `${title}${CAPTION_SEPARATOR}${t("team.caption.matches")}${CAPTION_SEPARATOR}${t(
    "team.caption.matchesLink"
  )}${CAPTION_SEPARATOR}${t("team.caption.matchesScoreSort")}`;

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
   * AN EMPTINESS BRANCH, NEVER A SHAPE BRANCH (ruled D9). `matches[]` runs 3-16
   * rows across the real corpus so this cannot fire there, but UX-DR13 gives an
   * empty slot an `EmptyStatePanel` rather than a silent absence, and a zero-row
   * table would present thirteen live sort controls over an empty `<tbody>`.
   */
  if (rows.length === 0) {
    return (
      <section id={TEAM_MATCHES_SECTION_ID} className="mt-section-gap">
        <h2 className="type-title text-ink-primary">{title}</h2>
        <div className="mt-3">
          <EmptyStatePanel
            headline={t("team.empty.matchesHeadline")}
            explanation={t("team.empty.matchesExplanation")}
          />
        </div>
      </section>
    );
  }

  return (
    <section id={TEAM_MATCHES_SECTION_ID} className="mt-section-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>

      {isNarrow ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          {/*
           * `hub.columns.more` / `hub.columns.fewer` REUSED, not minted — the
           * same control the Hub and `/players` ship, doing the same thing.
           *
           * NO `aria-controls`: this button mounts nothing. The table div is
           * permanent and fully visible in both states and only the column set
           * inside it narrows. `aria-expanded` STAYS, because it is true about
           * the thing that toggles — the hidden columns really are
           * `display: none`.
           */}
          <button
            type="button"
            aria-expanded={expanded}
            /*
             * COLLAPSING CLEARS A SORT THAT IS ABOUT TO GO INVISIBLE (code
             * review 2026-08-07). Sorting a hidden column through the menu
             * reveals it (`menuController.sortByColumn` below); pressing "Menos
             * columnas" afterwards hid it again while the rows stayed ordered
             * by it — no `aria-sort` on screen, no visible cue, and on the
             * narrowest layout the site supports.
             *
             * `useTableSort`'s own backstop cannot catch this: it fires when a
             * column LEAVES THE MODEL, and this table hides with `display: none`
             * and keeps every column in the list precisely so the sort menu can
             * offer all thirteen. So the toggle owns it, and `clearSort()`
             * ANNOUNCES the reversion rather than dropping it silently — the
             * exact defect 2.11b ledgered.
             */
            onClick={() => {
              if (
                expanded &&
                controller.sortState !== null &&
                !MATCH_NARROW_COLUMN_KEY_SET.has(controller.sortState.columnKey)
              ) {
                controller.clearSort();
              }
              setExpanded(!expanded);
            }}
            className="flex min-h-11 items-center underline underline-offset-4 type-caption text-ink-primary"
          >
            {t(columnsLabelKey)}
          </button>
          <TableSortMenu columns={columns} controller={menuController} tableName={tableName} />
        </div>
      ) : null}

      {/*
       * THE CALLER'S SCROLLPORT. `DataTable` renders none and must not — its
       * sticky mode resolves against the nearest scrolling ancestor, and 2.11a's
       * one declared departure was a sticky rule inside a height-UNBOUNDED
       * ancestor that computed correctly and silently did nothing. Sticky is
       * OPT-IN and is deliberately not used here. Thirteen columns overflow every
       * viewport the site supports, so the table scrolls inside its own container
       * and never the page (UX-DR16's data-table exception). `min-w-0` is what
       * stops a flex ancestor handing this div its content width.
       */}
      <div className="mt-3 w-full min-w-0 overflow-x-auto">
        <DataTable
          caption={caption}
          columns={renderedColumns}
          rows={rows}
          surface="canvas"
          tableName={tableName}
          sortState={controller.sortState}
          onSortChange={controller.setSortState}
          /* The anchor's `after:inset-0` resolves against the nearest positioned
           * ancestor. Without `relative` the pseudo-element would cover the page. */
          rowClass="relative"
        />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";

import { HubTable } from "@/components/HubTable";
import { RowAnchor } from "@/components/RowAnchor";
import { STAGES, stageLabelKey, visibleColumnKeys } from "@/lib/hub-model";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeMetricLabel,
  formatProfileValue,
  startedLabelKey,
} from "@/lib/player-profile-format";
import { formatDate } from "@/lib/format";
import type { TableColumn } from "@/lib/table-sort";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import {
  MATCHES_SECTION_ID,
  matchAnchorHref,
  type MatchRow,
} from "@/viz/player-profile-model";

/*
 * The #matches content (Story 2.15, AC 1's closing altitude and AC 3): the FULL
 * per-match table, last on the route, with every row linking to that match.
 *
 * "FULL" IS LITERAL. All fifteen rendered `PlayerMatchRow` fields ship —
 * `matchId` is the link TARGET rather than a column, and the other fifteen are
 * columns. NFR-3/UX-DR17 make the narrow layout a LAYOUT change and never a data
 * removal, so the `<md` set HIDES columns with `display: none` and the sort menu
 * still offers every one of them.
 *
 * THE TABLE IS `HubTable`, NOT A PRIVATE RESTATEMENT OF IT (code review
 * 2026-08-07). This file previously re-derived `HubTable`'s whole `<md`
 * disclosure — `HIDDEN_COLUMN_CLASS`, `hiddenKeys`, `renderedColumns` and the
 * reveal-on-sort `menuController` — line for line, because the one thing it
 * needed that `HubTable` does not offer was a row-level focus ring, and
 * `HubTable` hardcodes `rowClass="relative"`. Ruling Q2 below removed that need,
 * and with it the fork: Story 2.11a decision 1 is binding, "every private copy
 * is deleted".
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

/*
 * THE STRETCHED ROW ANCHOR is `@/components/RowAnchor`, imported (Story 2.16's
 * hoist, ruled D4). This file held the second private copy that hoist names.
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
 * THE FOCUS RING PAINTS ON THE ANCHOR'S OWN BOX. This story first ruled the
 * opposite — the ring moved onto the `<tr>` via `focus-within`, with
 * `outline-none` suppressing the anchor's — and that ruling is OVERTURNED at
 * code review in favour of Story 2.16 Q2, taken by Juan, for two reasons beyond
 * consistency. `outline-none` is a house prohibition that has already cost two
 * review patches. And `:focus-within` matches on ANY descendant `:focus`,
 * including the focus a mouse click puts on the anchor — so the row painted a
 * persistent 2px ring for pointer users, which the anchor's `:focus-visible`
 * ring never did and which no ruled visual state covers. The open ledger item is
 * therefore RESTATED to 2.16's ruling rather than closed on this story's.
 */

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
 * Hidden means `display: none`, NOT removed from the column list, and that rule
 * lives in `HubTable` with the ledger defect it closes.
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

  /** A count column — the shape eight of these share. */
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
       * rewrites a slash-less href at request time and the fragment is lost.
       * `matchAnchorHref` composes it from `matchHref` and is unit-tested for
       * exactly that slash, because nothing in the exported HTML can pin it —
       * this table is client-rendered, so the static-output suite never sees it.
       *
       * `#expert` is deliberately NOT a `SectionId` —`TacticalLayer`'s
       * `sectionIdFromHash` returns null for it BY DESIGN and `ExpertLayer` owns
       * its own listener, which is WHOLE-STRING equality on
       * `window.location.hash === "#expert"`. Anything finer ("#expert-content")
       * is silently ignored.
       */
      render: (row) => (
        <RowAnchor href={matchAnchorHref(row.matchId)} accessiblePrefix={rowLink}>
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
      /*
       * SORTS THE TOURNAMENT ORDER, NOT THE LABEL (code review 2026-08-07). An
       * earlier draft sorted the resolved string "so the order follows the
       * language toggle", which produced `Cuartos | Dieciseisavos | Fase de
       * grupos | Final | Octavos | Semifinal | Tercer puesto` — alphabetical,
       * and meaningless in both locales. `Stage` is an ORDERED enum and `STAGES`
       * is its shipped declaration order, so the index is the only ordering the
       * column can honestly offer; being language-independent is correct here
       * rather than a regression.
       */
      sort: { kind: "number", valueOf: (row) => STAGES.indexOf(row.stage) },
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
      /*
       * `null`, matching `totalDistance` above: `headTitle` is the FULL term for
       * an ABBREVIATED head (`table-sort.ts`), and this head is already the full
       * term plus its unit. A `headTitle` that is a strict substring of its own
       * `headText` puts a native tooltip on the `<th>` repeating a shortened
       * form of what is already visible.
       */
      headTitle: null,
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

  return (
    <section id={MATCHES_SECTION_ID} className="mt-layer-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>

      {isNarrow ? (
        <div className="mt-3">
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
           *
           * NO `aria-label` disambiguator, unlike the Hub's: that route carries
           * two disclosures and needs them told apart. This route carries one.
           */}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-11 items-center underline underline-offset-4 type-caption text-ink-primary"
          >
            {t(columnsLabelKey)}
          </button>
        </div>
      ) : null}

      {/*
       * `min-w-0` IS LOAD-BEARING and belongs on THIS div, not inside `HubTable`
       * — the Hub puts it in exactly the same place. A block whose min-width
       * resolves to its content makes a fifteen-column table wider than the
       * viewport, the `overflow-x-auto` wrapper inside `HubTable` never becomes
       * the scroller, and the whole DOCUMENT scrolls sideways (WCAG 1.4.10).
       * EXPERIENCE.md gives data tables an INTERNAL-scroll exception, and this
       * class is what keeps the scroll internal.
       */}
      <div className="mt-3 min-w-0">
        <HubTable
          caption={matchesCaption}
          columns={columns}
          visibleKeys={visibleKeys}
          rows={rows}
          tableName={tableName}
          /*
           * `matches: []` IS AN EMPTINESS BRANCH, NOT A SHAPE BRANCH (ruled D8).
           * 209 players (16.7%) never appeared; UX-DR13 gives that slot an
           * `EmptyStatePanel` — "never a silent absence, never layout collapse"
           * — and `HubTable` renders it in place of fifteen live sort controls
           * over an empty `<tbody>`.
           *
           * Dedicated copy, not `useEmptyHeadline()`, which says "para este
           * partido" — false on a profile. See `TrendsSection` for the note.
           */
          emptyHeadline={t("player.empty.matchesHeadline")}
          emptyExplanation={t("player.empty.matchesExplanation")}
          // The sort menu is the NARROW-LAYOUT sort control, so it tracks the
          // breakpoint rather than the hidden-column count. See HubTable.
          showSortMenu={isNarrow}
          // Sorting an off-screen column from the menu opens the disclosure, so
          // the reader can see the column they sorted by.
          onRevealColumns={() => setExpanded(true)}
        />
      </div>
    </section>
  );
}

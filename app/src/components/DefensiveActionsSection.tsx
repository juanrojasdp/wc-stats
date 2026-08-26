"use client";

import { DataTable } from "@/components/DataTable";
import {
  DOT_SEPARATOR,
  PitchPanel,
  type PitchPanelLegendEntry,
  type PitchPanelSide,
} from "@/components/PitchPanel";
import type { DefensiveActions } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { clockSortValue, markRowHeader, type TableColumn } from "@/lib/table-sort";
import {
  anyContestType,
  anyMinute,
  anyPlayerName,
  defensiveFigureCount,
  defensiveLegend,
  defensiveMarkers,
  defensiveRows,
  type DefensiveLogRow,
} from "@/viz/defensive-actions-model";

/*
 * The #defensive-actions content (Story 2.9 Task 6.1) — the ONE real pitch map
 * this story ships, and the third consumer of PitchPanel.
 *
 * The two receiving sections are NOT maps and go through none of this: Story
 * 1.13 measured `ReceivingEvent` unfulfillable in all eight required fields, so
 * they read Domain G aggregates and live on cards instead.
 *
 * Props are narrow and explicit, never the whole bundle.
 */

interface SideRef {
  teamId: string;
  /** Uppercased — the on-pitch direct label. */
  teamCode: string;
  /** Display name, used in the figure summary; the on-pitch label is the code. */
  name: string;
}

export interface DefensiveActionsSectionProps {
  defensiveActions: DefensiveActions;
  home: SideRef;
  away: SideRef;
  /**
   * `#defensive-actions-table`'s nonce (Story 3.8, D4).
   *
   * On the shipped corpus `events.defensiveActions` is null on 104/104 matches,
   * so TacticalLayer renders the whole SECTION's empty state above this
   * component and this prop is never read there. D6's section-level scroll lands
   * the fragment on that empty state, which is why no extra anchor is needed on
   * this route; the fixture is what exercises the panel.
   */
  tableNonce: number;
}

/*
 * The -on-pitch variants, NOT --viz-team-a/-b (ruled decision 8): these hues
 * are painted on the theme-invariant pitch, where the light-canvas variants
 * fall far below the 3:1 non-text floor. Measured for this story:
 * 9.56:1 and 7.26:1 vs --pitch-surface, 8.46 / 6.43 vs --pitch-stripe (the
 * stripe figure is not in DESIGN; measured here because markers land on it).
 */
const ACCENT_VAR = { a: "--viz-team-a-on-pitch", b: "--viz-team-b-on-pitch" } as const;

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

export function DefensiveActionsSection({
  defensiveActions,
  home,
  away,
  tableNonce,
}: DefensiveActionsSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("viz.defensiveActions.title");

  /*
   * t() has no interpolation and no plural machinery, so counters pick a
   * singular or plural key at the call site. Copied rather than shared, by the
   * current convention.
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * Built EAGERLY, outside the lazily-mounted disclosure (ruled decision 10):
   * a bad teamId names itself on load, not when a reader opens the table.
   * There is exactly ONE error boundary for all eleven Tactical sections, so a
   * throw here replaces the whole layer — which is precisely why the model
   * guards `null` and `[]` and fails loud only on a genuinely impossible id.
   */
  const markers = defensiveMarkers(
    defensiveActions,
    { ...home, colorVar: ACCENT_VAR.a },
    { ...away, colorVar: ACCENT_VAR.b }
  );
  const rows: DefensiveLogRow[] = defensiveRows(defensiveActions, home, away);
  /*
   * THE FD-1 WHOLE-COLUMN GATE, applied to all three absent-on-corpus fields
   * (ruled at code review, extending decision 20). `contestType` is null on
   * 20,169/20,169 corpus events and `playerName` / `at` have no carrier at all,
   * so each of these columns would otherwise ship as a full column of em
   * dashes — the exact condition decision 20 removes the contest column for.
   * Today's fixtures populate player and minute on 100% of rows, so nothing
   * visibly changes until the 2.19 cutover.
   */
  const showContestType = anyContestType(rows);
  const showPlayer = anyPlayerName(rows);
  const showMinute = anyMinute(rows);

  function side(ref: SideRef, accent: "a" | "b", mine: typeof markers.home): PitchPanelSide {
    const counts = defensiveFigureCount(mine);
    /*
     * The chip carries the TOTAL and nothing else — a DECLARED reading of
     * ruled decision 5's "any count chip enumerates only the types actually
     * present, never a fixed four". Enumerating the present types beside a
     * legend that deliberately refuses to distinguish them (decision 19: one
     * shape, one colour per team, so forced-turnover and possession-regain are
     * visually identical) would re-introduce exactly the distinction the map
     * does not draw. The per-type breakdown reaches the reader through three
     * non-visual carriers instead: each marker's accessible name, its popover,
     * and the log table's action-type column.
     */
    const phrase = countPhrase(
      counts.total,
      "viz.defensiveActions.actionsOne",
      "viz.defensiveActions.actions"
    );
    return {
      teamCode: ref.teamCode,
      accent,
      markers: mine,
      metaLine: phrase,
      figureSummary: `${t("viz.defensiveActions.figurePrefix")} ${ref.name}, ${phrase}`,
      zeroLine: t("viz.defensiveActions.zero"),
    };
  }

  /*
   * ONE ENTRY PER TEAM (ruled decision 19). A per-type legend would claim a
   * distinction the map does not draw; a side that drew nothing is dropped by
   * the model, because a swatch for an absent mark is its own small lie.
   */
  const legendNoun = t("viz.defensiveActions.legendNoun");
  const legend: PitchPanelLegendEntry[] = defensiveLegend([
    {
      colorVar: ACCENT_VAR.a,
      label: `${home.teamCode}${DOT_SEPARATOR}${legendNoun}`,
      markerCount: markers.home.length,
    },
    {
      colorVar: ACCENT_VAR.b,
      label: `${away.teamCode}${DOT_SEPARATOR}${legendNoun}`,
      markerCount: markers.away.length,
    },
  ]);

  const unknown = t("viz.table.unknown");

  /*
   * THE COLUMN SET IS DYNAMIC — three presence gates, preserved exactly as they
   * shipped. That is precisely why every sort key is a stable string and never
   * a column index: `showMinute` closing shifts every later column by one.
   */
  const columns: TableColumn<DefensiveLogRow>[] = [
    {
      key: "team",
      headText: t("viz.table.team"),
      headTitle: null,
      render: (row) => row.teamCode,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.teamCode },
    },
    ...(showPlayer
      ? [
          {
            key: "player",
            headText: t("viz.table.player"),
            headTitle: null,
            render: (row: DefensiveLogRow) => row.playerName ?? unknown,
            align: "text" as const,
            sort: { kind: "text" as const, valueOf: (row: DefensiveLogRow) => row.playerName },
          },
        ]
      : []),
    ...(showMinute
      ? [
          {
            key: "minute",
            headText: t("viz.table.minute"),
            headTitle: null,
            render: (row: DefensiveLogRow) => row.minuteLabel ?? unknown,
            align: "numeric" as const,
            sort: {
              kind: "number" as const,
              // NULL, never 0 — Story 2.9's review fixed this model's `?? 0`
              // with a docblock naming Story 2.11 as the owner of the sort that
              // would otherwise have read every clock-less row as minute 0.
              valueOf: (row: DefensiveLogRow) => clockSortValue(row.minute, row.stoppageMinute),
            },
          },
        ]
      : []),
    {
      key: "x",
      headText: t("viz.table.x"),
      headTitle: null,
      render: (row) => formatDecimal(row.x, locale, 2),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.x },
    },
    {
      key: "y",
      headText: t("viz.table.y"),
      headTitle: null,
      render: (row) => formatDecimal(row.y, locale, 2),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.y },
    },
    {
      key: "actionType",
      headText: t("viz.table.actionType"),
      headTitle: null,
      render: (row) => t(row.actionTypeKey),
      align: "text",
      // The RESOLVED label, so the order follows the EN toggle.
      sort: { kind: "text", valueOf: (row) => t(row.actionTypeKey) },
    },
    /*
     * A WHOLE-COLUMN decision on the FD-1 precedent (ruled decision 20): on
     * corpus-real data `contest_type` is null on 20,169/20,169, so a per-cell
     * em dash would ship a column of 20,169 em dashes. The column is absent
     * entirely unless some row carries a value.
     */
    ...(showContestType
      ? [
          {
            key: "contestType",
            headText: t("viz.table.contestType"),
            headTitle: null,
            render: (row: DefensiveLogRow) =>
              row.contestTypeKey === null ? unknown : t(row.contestTypeKey),
            align: "text" as const,
            sort: {
              kind: "text" as const,
              valueOf: (row: DefensiveLogRow) =>
                row.contestTypeKey === null ? null : t(row.contestTypeKey),
            },
          },
        ]
      : []),
  ];

  /*
   * THE ROW HEADER, chosen rather than hard-coded (ledger A17/L1877, Story 2.19
   * Task 6.9). Before this the log's every body cell was a `<td>`, so a screen
   * reader read the values of a row and never said whose recovery it was.
   *
   * `markRowHeader` and not `rowHeader: true` on the player column, because that
   * column is GATED: `anyPlayerName(rows)` drops it entirely when the report
   * named nobody, and a hard-coded flag on a conditionally-spread column would
   * leave exactly those matches — the ones with least context — with no row
   * header at all. The preference degrades player -> minute -> team.
   */
  const columnsWithRowHeader = markRowHeader(columns, ["player", "minute", "team"]);

  /*
   * THE CAPTION MUST STATE THE ORDER THE TABLE ACTUALLY HAS.
   *
   * REVIEW PATCH: this shipped `viz.table.caption` unconditionally — literally
   * "Ordenado por minuto." — justified by "these rows carry a real clock in the
   * contract". The contract declares one; the corpus carries none. With every
   * `at` absent, `orderByMinute` sorts all rows last and stably, so the real
   * order is home block then away block in artifact order, above a minute
   * column that is now gated away entirely. The caption asserted an ordering
   * the table did not have — the same false claim the two receiving tables
   * minted their own caption keys to avoid.
   *
   * IT STILL STATES THE DEFAULT ORDER AND NEVER MUTATES (Story 2.11a decision
   * 7). Sorting is user-initiated re-ordering laid over that order; a caption
   * that rewrote itself on every sort would destroy the one durable statement
   * of canonical order, and would fight this very conditional.
   */
  const orderKey: DictionaryKey = showMinute
    ? "viz.table.caption"
    : "viz.defensiveActions.tableCaptionNoClock";
  const caption = `${title}${CAPTION_SEPARATOR}${t(orderKey)}`;

  const dataTable = <DataTable caption={caption} tableName={caption} columns={columnsWithRowHeader} rows={rows} surface="pitch" />;

  /*
   * NO `selection` (ruled decision 18): pinning exists to isolate a node's
   * RELATIONSHIPS, and this map has no edges and no relationships, so there is
   * nothing to isolate. With `selection` absent PitchPanel is byte-identical to
   * its pre-2.8 behaviour — no aria-pressed, no dimming, no selection ring.
   *
   * NO `underlay`, and NO `extent`: there is no extent prop at all. PitchPanel
   * pools one internally from BOTH sides' markers, and defensive-action x spans
   * 8.3–64.3 on every fixture, so `pitchExtentFor` returns {xMin: 0} on its own
   * and the full pitch — halfway line, centre circle, centre spot — arrives for
   * free (ruled decision 9).
   */
  return (
    <PitchPanel
      anchorId="defensive-actions-table"
      openNonce={tableNonce}
      title={title}
      sides={[side(home, "a", markers.home), side(away, "b", markers.away)]}
      legend={legend}
      dataTable={dataTable}
    />
  );
}

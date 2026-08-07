"use client";

import { DataTable } from "@/components/DataTable";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeMetricLabel,
  formatProfileValue,
  profileUnitKey,
} from "@/lib/player-profile-format";
import type { TableColumn } from "@/lib/table-sort";
import { leaderboardMetricKey } from "@/viz/leaderboard-model";
import { AGGREGATES_SECTION_ID, type AggregateRow } from "@/viz/player-profile-model";

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

/*
 * The #aggregates content (Story 2.15, AC 1): ALL EIGHTEEN aggregates, in
 * artifact order.
 *
 * All eighteen, not the Hero's four. SM-C2 puts depth behind disclosure and
 * forbids deleting it to tidy a hero; the Hero SELECTS four (which AD-5 permits
 * in as many words) and this table is where the rest live.
 *
 * THE TABLE IS TRANSPOSED, WHICH IS WHY THE UNIT RIDES THE ROW HEADER (ruled
 * D5). Story 2.13/2.11b ruled "the unit goes in the COLUMN HEAD, never
 * per-cell", and that rule presumes one metric per column. Here eighteen metrics
 * spanning Count, Metres, KmPerHour and Percentage share ONE value column, so
 * there is no head that could carry a unit — the metric label in the row-header
 * cell is the only per-metric label on the surface. Composed as a STRING
 * (`composeMetricLabel`), because `{t(a)} ({t(b)})` in JSX emits " (" as a
 * literal child and fails the i18n gate.
 *
 * NO `perNinety` COLUMN (ruled D3). The corpus maximum is 104,139.0 —
 * `stewart-ross-sco`, `totalDistance`, 1,157.1 m over ONE minute — and 62
 * players sit on 1-14 minutes, so an unsuppressed rate column puts a six-digit
 * number beside a four-digit one. A minutes floor would be a product rule this
 * story does not have. The field stays in the artifact, untouched.
 *
 * NO `aggregation` COLUMN either, and that one is a correctness point rather
 * than a layout one. Story 1.18: the same word "average" means a WEIGHTED
 * arithmetic on a player profile and an UNWEIGHTED mean on a team profile, "and
 * both are correct" — so it is not a safe basis for a user-facing "how this was
 * computed" label on a surface that will soon sit beside team profiles.
 */
export function PlayerAggregatesSection({ rows }: { rows: readonly AggregateRow[] }) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("player.sections.aggregates.title");
  /*
   * `${title} — ${order}`, the composition all 27 shipped captions use. Hoisted
   * because `caption` is a gated prop name and the gate fires on a template
   * literal there even when every fragment is a t() call.
   */
  const aggregatesCaption = `${title}${CAPTION_SEPARATOR}${t("player.caption.aggregates")}`;

  const columns: TableColumn<AggregateRow>[] = [
    {
      key: "metric",
      headText: t("player.column.metric"),
      headTitle: null,
      render: (row) => {
        const unitKey = profileUnitKey(row.unit);
        return composeMetricLabel(
          t(leaderboardMetricKey(row.metricCode)),
          unitKey === null ? null : t(unitKey)
        );
      },
      align: "text",
      rowHeader: true,
      /*
       * Sorts the RESOLVED label, not the metric code — sorting on the raw code
       * would order by "enums.leaderboardMetric.ballProgressions" and would not
       * re-order under the EN toggle (2.11a decision 2).
       */
      sort: {
        kind: "text",
        valueOf: (row) => t(leaderboardMetricKey(row.metricCode)),
      },
    },
    {
      key: "value",
      headText: t("player.column.value"),
      headTitle: null,
      render: (row) => formatProfileValue(row.value, row.format, locale),
      align: "numeric",
      /*
       * The RAW numeric, never the formatted string: `formatProfileValue` emits
       * es-CO grouping, and a text sort over "47.274,9" is nonsense. `?? null`
       * is unnecessary here — `value` is contract-non-nullable and the model has
       * already thrown on a non-finite one.
       */
      sort: { kind: "number", valueOf: (row) => row.value },
    },
  ];

  return (
    <section id={AGGREGATES_SECTION_ID} className="mt-layer-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>
      <div className="mt-3 w-full min-w-0 overflow-x-auto">
        <DataTable
          /*
           * The caption STATES THE DEFAULT ORDER AND NEVER MUTATES (2.11a
           * decision 7). There is no `defaultSort`: the table mounts with
           * `sortState === null`, which IS the artifact's order, and AD-5
           * reserves canonical order to the artifact.
           */
          caption={aggregatesCaption}
          columns={columns}
          rows={rows}
          surface="canvas"
          /*
           * `tableName` is MANDATORY once a route carries more than one table —
           * this one carries three, plus the trends alternative — because ONE
           * live region serves them all and cannot otherwise say which moved.
           */
          tableName={t("player.tableName.aggregates")}
        />
      </div>
    </section>
  );
}

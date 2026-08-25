"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeMetricLabel,
  composeTrendFigureSummary,
  formatCount,
  formatProfileValue,
  formatTrendPointLabel,
  profileUnitKey,
  trendAxisWidth,
} from "@/lib/player-profile-format";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import { leaderboardMetricKey } from "@/viz/leaderboard-model";
import {
  TRENDS_SECTION_ID,
  TREND_CHART_HEIGHT_CLASS,
  trendAxis,
  type TrendSeriesModel,
} from "@/viz/player-profile-model";

/*
 * The #trends content (Story 2.15, AC 1's middle altitude): one chart, a metric
 * selector, and the data-table alternative.
 *
 * ONE CHART PLUS A SELECTOR, NOT SIX CHARTS (ruled D6). The artifact carries six
 * series; rendering them simultaneously would put six `ResponsiveContainer`s —
 * six recharts instances and six figure landmarks — on one route, for a reader
 * who reads one metric at a time. The default is the artifact's FIRST series,
 * which is its canonical order (AR-5), never an "most interesting" pick.
 *
 * THE SELECTOR IS `ToggleGroup`, THE ONLY VENDORED SELECTOR. `src/components/ui/`
 * holds exactly seven files and there is no `tabs`, no `select` and no `slider`
 * among them; vendoring an eighth primitive for one control was rejected. Radix
 * gives `type="single"` groups RADIO-GROUP semantics (`role="radiogroup"` /
 * `role="radio"` + `aria-checked`), NOT tablist/`aria-selected`.
 */

function ChartFallback() {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div
        aria-busy="true"
        className={cn("w-full rounded-md skeleton", TREND_CHART_HEIGHT_CLASS)}
      />
    </div>
  );
}

/* `@/components/Charts` — the ONE lazy boundary (ruled D1). */
const TrendChart = dynamic(
  () => import("@/components/Charts").then((module) => module.TrendChart),
  { ssr: false, loading: () => <ChartFallback /> }
);

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

/** One row of the data alternative: a match, with ALL SIX series' values. */
interface TrendTableRow {
  key: string;
  matchId: string;
  date: string;
  opponentName: string;
  /*
   * `| undefined` EXPLICITLY, never `| null`. A missing series value here means
   * "this row was never given one", which is `undefined`; `null` is the shape
   * the CONTRACT uses for "the source does not carry this", and no value in
   * `trends[]` is contract-nullable. Keeping them distinct is what lets the
   * render branch below narrow to `number` without an assertion.
   */
  values: Record<string, number | undefined>;
}

export function TrendsSection({ series }: { series: readonly TrendSeriesModel[] }) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("player.sections.trends.title");

  /*
   * Ephemeral component state (AD-10): not the URL, not localStorage, not a
   * store. The selector is a view control over data already in hand.
   *
   * Defaulted to the artifact's FIRST series. `series[0]` can be undefined only
   * on a truncated payload, which the model has already normalized to `[]` — the
   * empty branch below catches that before this value is read.
   */
  const [selected, setSelected] = useState<string>(series[0]?.metricCode ?? "");
  const active = series.find((entry) => entry.metricCode === selected) ?? series[0];

  /*
   * EMPTINESS, NOT SHAPE (ruled D8). `series.length === 0` would be a shape
   * branch and never happens — the artifact is total, all six series always
   * present. What DOES happen, for 209 zero-appearance players (16.7%), is that
   * every series carries `points: []`. That is UX-DR13's slot: an
   * `EmptyStatePanel` occupying the missing content's space, "never a silent
   * absence, never layout collapse".
   */
  const hasPoints = series.some((entry) => entry.points.length > 0);

  if (active === undefined || !hasPoints) {
    return (
      <section id={TRENDS_SECTION_ID} className="mt-section-gap">
        <h2 className="type-title text-ink-primary">{title}</h2>
        <div className="mt-3">
          {/*
           * DEDICATED COPY, not `useEmptyHeadline()` — and that is a fix rather
           * than a preference. That helper composes "Sin datos de {sección} PARA
           * ESTE PARTIDO", which is false on a route that is not a match. The
           * Hub hit the same wall and answered it the same way, with its own
           * headline/explanation pair.
           */}
          <EmptyStatePanel
            headline={t("player.empty.trendsHeadline")}
            explanation={t("player.empty.trendsExplanation")}
          />
        </div>
      </section>
    );
  }

  /*
   * Re-bound after the guard so the closures below capture a NON-NULLABLE value
   * without a `!` assertion — `formatValue` is passed into recharts and is
   * evaluated long after this render's narrowing would otherwise apply.
   */
  const activeSeries = active;
  const unitKey = profileUnitKey(activeSeries.unit);
  const metricLabel = composeMetricLabel(
    t(leaderboardMetricKey(activeSeries.metricCode)),
    unitKey === null ? null : t(unitKey)
  );

  /*
   * TICKS PER METRIC FAMILY (D6). The six series span four unit types, so one
   * generator cannot serve them: `percentTicks` for `passCompletion`,
   * `countTicks` for the three counts, and the decimal-aware generator for
   * `topSpeed` (km/h) and `totalDistance` (metres) — a count-floored axis
   * compresses a real 32,0-33,0 km/h series onto one or two ticks.
   */
  const values = activeSeries.points.map((point) => point.value);
  const axis = trendAxis(activeSeries.unit, values);

  const formatValue = (value: number): string =>
    formatProfileValue(value, activeSeries.format, locale);

  const tickLabels = axis.ticks.map(formatValue);
  const points = activeSeries.points.map((point) => ({
    label: formatTrendPointLabel(point.date, locale),
    value: point.value,
  }));

  /*
   * t() has no interpolation and no plural machinery, so a counter picks its
   * key at the call site — and the key is hoisted into a VARIABLE because
   * `{t(cond ? "a" : "b")}` trips the i18n gate (ViewDataDisclosure's patch).
   */
  const matchCount = activeSeries.points.length;
  const matchNounKey: DictionaryKey = matchCount === 1 ? "player.matchOne" : "player.matchMany";
  const figureSummary = composeTrendFigureSummary({
    metricLabel,
    matchCount: `${formatCount(matchCount, locale)} ${t(matchNounKey)}`,
    firstLabel: points[0]?.label ?? "",
    lastLabel: points[points.length - 1]?.label ?? "",
  });

  /* ------------------------------- The table -------------------------------- */

  /*
   * THE DATA ALTERNATIVE CARRIES ALL SIX SERIES, not just the charted one
   * (NFR-2: the text alternative renders the same artifact slice — and the
   * artifact slice here is `trends[]`, all of it). A reader who cannot see the
   * chart would otherwise have to operate the selector six times to reach what a
   * sighted reader can switch between freely.
   *
   * Built EAGERLY, outside the disclosure: a bad value must fail on load.
   */
  /*
   * Hoisted: `caption` is one of the sixteen gated prop names, and the gate
   * fires on a template literal there even when every fragment is a t() call.
   */
  const trendsCaption = `${title}${CAPTION_SEPARATOR}${t(
    "player.caption.trends"
  )}${CAPTION_SEPARATOR}${t("player.caption.trendsNote")}`;

  const matchOrder: TrendTableRow[] = [];
  const byMatch = new Map<string, TrendTableRow>();
  for (const entry of series) {
    for (const point of entry.points) {
      let row = byMatch.get(point.matchId);
      if (row === undefined) {
        row = {
          key: point.matchId,
          matchId: point.matchId,
          date: point.date,
          opponentName: point.opponent.name,
          values: {},
        };
        byMatch.set(point.matchId, row);
        matchOrder.push(row);
      }
      row.values[entry.metricCode] = point.value;
    }
  }

  const columns: TableColumn<TrendTableRow>[] = [
    {
      key: "date",
      headText: t("player.column.date"),
      headTitle: null,
      render: (row) => formatTrendPointLabel(row.date, locale),
      align: "text",
      rowHeader: true,
      /* Sorts the ISO string, which is lexicographically chronological — never
       * the RENDERED "11 jun", which collates 11 before 5. */
      sort: { kind: "text", valueOf: (row) => row.date },
    },
    {
      key: "opponent",
      headText: t("player.column.opponent"),
      headTitle: null,
      render: (row) => row.opponentName,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.opponentName },
    },
    ...series.map((entry): TableColumn<TrendTableRow> => {
      const entryUnitKey = profileUnitKey(entry.unit);
      return {
        key: entry.metricCode,
        headText: composeMetricLabel(
          t(leaderboardMetricKey(entry.metricCode)),
          entryUnitKey === null ? null : t(entryUnitKey)
        ),
        headTitle: null,
        /*
         * A SAFETY NET, NOT A DESIGN CHOICE — and it is unreachable on a valid
         * artifact. Checked across all 1,248 real profiles: every series carries
         * exactly one point per match row, 0 exceptions, and the model already
         * THROWS on a point whose matchId is absent from `matches[]`. But the
         * payload is an `as`-cast, so a truncated series would otherwise index
         * to `undefined` and reach `formatProfileValue`, which throws inside a
         * lazily-mounted disclosure — the deferred throw the eager-build rule
         * exists to prevent. `viz.table.unknown` is the ruled glyph for "some
         * rows absent" (convention 3); D8's "no em dash, ever" governs values
         * the contract declares non-nullable, which every value here is.
         */
        render: (row) => {
          const value = row.values[entry.metricCode];
          return value === undefined
            ? t("viz.table.unknown")
            : formatProfileValue(value, entry.format, locale);
        },
        align: "numeric",
        /* `?? null`, NEVER `?? 0` — a 0 would claim a real measurement and sort
         * a missing value ahead of every present one. */
        sort: { kind: "number", valueOf: (row) => row.values[entry.metricCode] ?? null },
      };
    }),
  ];

  return (
    <section id={TRENDS_SECTION_ID} className="mt-section-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>

      {/*
       * The four non-negotiables at every shipped ToggleGroup call site:
       * `type="single"` with a controlled value; the EMPTY-STRING GUARD (Radix
       * emits "" when the active segment is re-clicked, and the active option
       * must not be deselectable); an `aria-label` from a locale key, never a
       * literal; and `min-h-11 min-w-11` on each ITEM — UX-DR15 is >=44x44 and
       * `min-h-11` alone is height only.
       */}
      <ToggleGroup
        type="single"
        value={selected}
        onValueChange={(value) => {
          if (value !== "") {
            setSelected(value);
          }
        }}
        aria-label={t("player.trendSelector")}
        className="mt-3 flex-wrap rounded-full border border-hairline p-0.5"
      >
        {series.map((entry) => (
          <ToggleGroupItem
            key={entry.key}
            value={entry.metricCode}
            /*
             * `whitespace-normal` overrides the vendored Toggle base's
             * `whitespace-nowrap` (Story 2.19 Task 6.2). The group already
             * wraps; the ES metric label "Progresiones de balón" is 199 px on
             * one line and was the last thing holding `/players/{slug}` at a
             * 221 px document width under a 195 px viewport.
             */
            className="min-h-11 max-w-full min-w-11 whitespace-normal rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
          >
            {t(leaderboardMetricKey(entry.metricCode))}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Unnamed <figure>: the chart is already role="img" with the summary. */}
      <figure className="mt-tile-gap min-w-0">
        <p className="type-stat-label text-ink-secondary">{metricLabel}</p>
        <div className="mt-1 rounded-lg bg-surface-raised p-tile-gap">
          <TrendChart
            points={points}
            ticks={axis.ticks}
            axisMin={axis.min}
            axisMax={axis.max}
            formatValue={formatValue}
            axisWidth={trendAxisWidth(tickLabels)}
            axisPointLabel={t("player.axis.match")}
            axisValueLabel={metricLabel}
            figureSummary={figureSummary}
            heightClass={TREND_CHART_HEIGHT_CLASS}
          />
        </div>
        <div className="mt-tile-gap">
          <ViewDataDisclosure
            panelTitle={title}
            surface="canvas"
            trailing={<p className="type-caption text-ink-secondary">{t("viz.attribution")}</p>}
          >
            {/*
             * `DataTable` renders NO scroll container and must not; the caller
             * supplies the width-bounded scrollport. Eight columns of numerics
             * overflow 320 px, and `min-w-0` on the flex ancestor is what stops
             * the page itself scrolling sideways instead (2.13 shipped a WCAG
             * 1.4.10 failure from exactly this and fixed it the same way).
             */}
            <div className="w-full min-w-0 overflow-x-auto">
              <DataTable
                caption={trendsCaption}
                columns={columns}
                rows={matchOrder}
                surface="canvas"
                tableName={t("player.tableName.trends")}
              />
            </div>
          </ViewDataDisclosure>
        </div>
      </figure>
    </section>
  );
}

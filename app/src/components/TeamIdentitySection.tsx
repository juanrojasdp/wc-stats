"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { DictionaryKey } from "@/lib/i18n";
import type { TableColumn } from "@/lib/table-sort";
import {
  composeRateFigureSummary,
  formatMetres,
  formatRateTick,
  formatRateValue,
} from "@/lib/team-profile-format";
import { cn } from "@/lib/utils";
import { distributionChartHeightClass } from "@/viz/phases-model";
import {
  IDENTITY_SECTION_ID,
  SHAPE_MEASURES,
  shapeMeasureKey,
  type CategoryRow,
  type IdentityChartModels,
  type RateChartModel,
  type ShapeRow,
  type ShapeTableModel,
} from "@/viz/team-profile-model";

/*
 * The #tactical-identity content (Story 2.16, AC 1 and AC 2): the team's
 * tournament-wide identity as four single-series rate charts plus the eighteen
 * `shapeByPhase` metre values as two tables.
 *
 * A PLAIN `<section>`, NOT A COLLAPSIBLE SHELL. `TacticalSection` is
 * do-not-touch and its `id` prop is typed to the closed eleven-member
 * `SectionId`; widening that union was rejected outright, and
 * `ViewDataDisclosure` is the viz-ALTERNATIVE control rather than a section
 * shell. The anchor is a stable English id and a deep-link target (UX-DR18).
 *
 * EVERY CHART IS SINGLE-SERIES ON `--viz-single` (ruled D1, UX-DR11). The
 * artifact carries no opponent series at all, so there is no Team B to give a
 * second channel to — that pass-through belongs to Story 2.17, the genuine first
 * two-team surface, and is routed there with evidence rather than absorbed here.
 *
 * SEVEN VALUES APPEAR TWICE ON THIS PAGE AND THAT IS DELIBERATE (D11,
 * inherited). The nine out-of-possession rates, the four press rates and the
 * three block levels overlap by seven: Mexico's `phasesOutOfPossession.highBlock`
 * is 4.0 and `defensiveBlockDistribution.high` is 4.0, the same number from the
 * same contract fields under two separate contracted enum values. Nothing is
 * recomputed and nothing is deduped; `deferred-work.md` names Story 2.16 as the
 * owner of that ruling.
 *
 * NONE OF THE FOUR IS A PARTITION (D10). Grouped, independent bars only — never
 * a stacked 100% bar, never a pie, never a "remainder" segment.
 * `defensiveBlockDistribution` sums to 46.4 on Mexico; the phase rates are
 * independent rates whose corpus sums run 84-149 in possession and 73-97 out of
 * it. `viz.phases.note` and `viz.pressing.note` say exactly that and are REUSED
 * rather than re-minted.
 */

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

/*
 * ONE HANDLE PER HEIGHT, NOT ONE PER MODULE (PhasesSection's ruling). A
 * `dynamic()` call bakes its `loading` fallback in at declaration time and
 * cannot vary it per instance, so a single shared handle rendered at four
 * different category counts would show three of them the wrong-sized skeleton —
 * a CLS hit against the very budget the code-split protects.
 *
 * ALL FOUR NAME `@/components/Charts`, THE ONE LAZY BOUNDARY, and they share one
 * chunk group because `next/dynamic` dedupes on the IMPORT SPECIFIER. A chart
 * reached by any other specifier mints a fresh chunk group and a fresh ~300 kB
 * recharts vendor copy — the exact defect `Charts.tsx` exists to remove, and the
 * measured baseline is exactly ONE vendor chunk.
 *
 * `CategoryBarChart` IS `SpeedZoneChart` GENERALIZED (ruled D2). The rename was
 * CONDITIONAL on `ProfileCharts.tsx` being clean: at Task 1.3
 * `2-15-player-profile` was `in-progress` in a concurrent session with that file
 * untracked, so the charts were first consumed under the old name. Once 2-15
 * reached `review` and the file was committed and clean, D2 was applied as
 * originally ruled.
 *
 * THE WIDE CATEGORY AXIS IS NOT COSMETIC. The shipped 62 px axis was sized for
 * "Zona 1" … "Zona 5"; these labels are the seventeen Spanish phase names.
 * Measured on `/teams/mexico/` before the fix: "Salida de balón sin presión" and
 * "Salida de balón con presión" OVERLAPPED vertically, "Progresión" clipped to
 * "rogresión", "Contraataque" to "traataque", and recharts' default tick broke
 * words mid-character ("Salidadebalónsinpresión"). The chart now renders the
 * same wrapping tick `DistributionChart` uses, off the same pure `wrapAxisLabel`
 * model.
 */
const IN_POSSESSION_HEIGHT = distributionChartHeightClass(8);
const OUT_OF_POSSESSION_HEIGHT = distributionChartHeightClass(9);
const BLOCKS_HEIGHT = distributionChartHeightClass(3);
const PRESS_HEIGHT = distributionChartHeightClass(4);

/**
 * The lazy fallback. It needs `aria-busy` AND AN EXPLICIT HEIGHT CLASS: the
 * `skeleton` utility supplies no dimensions, so an unsized fallback collapses to
 * ~0 px and the chart then mounts at full height.
 */
function ChartFallback({ heightClass }: { heightClass: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", heightClass)} />
    </div>
  );
}

function categoryChart(heightClass: string) {
  return dynamic(() => import("@/components/Charts").then((module) => module.CategoryBarChart), {
    // Legal by AR-11: this region is already client-only, so no markup for it
    // exists in `out/` and there is no server render to skip.
    ssr: false,
    loading: () => <ChartFallback heightClass={heightClass} />,
  });
}

const InPossessionChart = categoryChart(IN_POSSESSION_HEIGHT);
const OutOfPossessionChart = categoryChart(OUT_OF_POSSESSION_HEIGHT);
const BlocksChart = categoryChart(BLOCKS_HEIGHT);
const PressChart = categoryChart(PRESS_HEIGHT);

export interface TeamIdentitySectionProps {
  charts: IdentityChartModels;
  shape: ShapeTableModel;
  teamName: string;
}

export function TeamIdentitySection({ charts, shape, teamName }: TeamIdentitySectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("team.sections.identity.title");

  /*
   * REUSED, NEVER RE-MINTED. `viz.phases.*` and `viz.pressing.*` already carry
   * every one of these terms for the Match Dashboard's identical Domain C block,
   * and 2.18's prohibition plus `i18n.test.ts`'s duplicate-value gate both make
   * a second home for one term a defect rather than a convenience.
   */
  const axisValueLabel = t("viz.phases.axisRate");
  const axisCategoryLabel = t("viz.phases.axisPhase");
  const phasesNote = t("viz.phases.note");
  const pressingNote = t("viz.pressing.note");
  const rateTableCaption = t("viz.phases.tableCaption");
  const metreLabel = t("enums.unit.m");

  function formatTick(value: number): string {
    return formatRateTick(value, locale);
  }

  /* ------------------------------ The rate charts --------------------------- */

  /**
   * One chart's data-table alternative: category name plus its one rate.
   *
   * THE CATEGORY HEAD IS PER-FAMILY, NOT SHARED (code review 2026-08-07, R-D3
   * ruled by Juan). This was one array reused by all four rate tables with
   * `viz.table.phase` ("Fase") as its head — but only two of the four have
   * phases in their rows; the other two carry defensive blocks and press types,
   * and the shape tables below carried shape PANELS under the same word. That is
   * the one-term-two-meanings collision this story mints `stage: "Etapa"` to
   * avoid, applied to a column that did not need it and skipped on four that
   * did. The two phase tables still pass `viz.table.phase`: the term is already
   * right for them, and a twin key holding "Fase" would be a second home for one
   * term (2.18's prohibition).
   */
  function rateColumnsFor(categoryHeadKey: DictionaryKey): TableColumn<CategoryRow>[] {
    return [
    {
      key: "category",
      headText: t(categoryHeadKey),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      /* The RESOLVED name, so the order follows the EN toggle. Sorting on
       * `labelKey` would order by "enums.*" and never re-sort. */
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    {
      key: "value",
      headText: axisValueLabel,
      headTitle: null,
      /* ONE DECIMAL, deliberately more precise than the chart's axis:
       * `Percentage` is declared with "x-decimals": 1, so whole points would
       * discard contracted precision (AR-5). */
      render: (row) => formatRateValue(row.value, locale),
      align: "numeric",
      /* The RAW rate, never the rendered "23,2%" — "9,0" and "47,0" collate
       * wrongly as text under es-CO commas. */
      sort: { kind: "number", valueOf: (row) => row.value },
    },
    ];
  }

  function rateBlock(input: {
    model: RateChartModel;
    Chart: ReturnType<typeof categoryChart>;
    headingKey: DictionaryKey;
    note: string;
    figurePrefixKey: DictionaryKey;
    tableNameKey: DictionaryKey;
    categoryHeadKey: DictionaryKey;
  }) {
    const { model, Chart, headingKey, note, figurePrefixKey, tableNameKey, categoryHeadKey } =
      input;
    const heading = t(headingKey);
    const tableName = t(tableNameKey);
    /*
     * HOISTED INTO IDENTIFIERS. A template literal inside a gated prop
     * (`figureSummary`, `caption`, `tableName`) trips the i18n rule EVEN WHEN
     * every fragment is a t() call, and t() itself has no interpolation.
     */
    const headline = `${t(figurePrefixKey)} ${heading}`;
    const figureSummary = composeRateFigureSummary({ headline, entityName: teamName, note });
    const caption = `${heading}${CAPTION_SEPARATOR}${rateTableCaption}`;
    return (
      <div className="flex flex-col gap-1">
        <p className="type-stat-label text-ink-secondary">{heading}</p>
        {/*
         * THE NOTE IS NOT RENDERED HERE — it is rendered ONCE PER FAMILY by the
         * caller (code review 2026-08-07). D10's fix was right that the
         * independent-rates sentence must be VISIBLE and not only inside
         * `figureSummary`, but it was applied per-CHART: `rateBlock` runs four
         * times against two distinct notes, so the page carried each sentence
         * twice as a pair of identical paragraphs. It still rides
         * `figureSummary` below, which is the figure's accessible name.
         */}
        {/*
         * NO SECOND `role` AND NO SECOND `aria-label` AT THIS CALL SITE. The
         * chart component already supplies `role="img"` and takes its accessible
         * name from `figureSummary`; naming it again here would give the reader
         * two competing accessible names.
         */}
        <Chart
          points={model.rows.map((row) => ({ label: t(row.labelKey), value: row.value }))}
          ticks={model.ticks}
          axisMax={model.axisMax}
          formatValue={formatTick}
          axisValueLabel={axisValueLabel}
          axisCategoryLabel={axisCategoryLabel}
          figureSummary={figureSummary}
          heightClass={model.heightClass}
          categoryAxisWidth={model.categoryAxisWidth}
        />
        {/*
         * NFR-2's TEXT ALTERNATIVE OF RECORD, one per chart, `surface="canvas"`
         * every time — `"pitch"` is the default and computes 1.10:1 on a
         * `--surface-raised` card, an invisible control.
         */}
        <ViewDataDisclosure panelTitle={heading} surface="canvas">
          <DataTable
            caption={caption}
            columns={rateColumnsFor(categoryHeadKey)}
            rows={model.rows}
            surface="canvas"
            tableName={tableName}
          />
        </ViewDataDisclosure>
      </div>
    );
  }

  /* ----------------------------- The shape tables --------------------------- */

  /*
   * `shapeByPhase` RENDERS AS TABLES, NOT CHARTS (ruled D13). Eighteen values
   * across 2 states x 3 panels x 3 measures cannot be charted by anything here:
   * the single-series bar chart takes ONE series and `DistributionChart` at most
   * two, but three measures need three; `--viz-single` is ONE colour, so three
   * measures could not be distinguished on one plot even if a chart accepted
   * them; and 6 panels x 1 measure is a `categoryCount` of 6, which
   * `distributionChartHeightClass` throws on outright.
   *
   * NO `ViewDataDisclosure` HERE — a table is not a viz and needs no alternative
   * to itself.
   *
   * THE VOCABULARY IS MINTED BY THIS STORY (R1 option A, taken by Juan). Four of
   * the six panel labels and `teamWidth` had no copy in either locale and no UX
   * document authorized any wording; CS-2 filed the minting to 2.19, but 2.19
   * has not run and this is the first surface that can render the values. Every
   * minted string ships flagged PROPOSED in the locale files.
   */
  const shapeColumns: TableColumn<ShapeRow>[] = [
    {
      key: "panel",
      /* "Panel", NOT "Fase" (code review 2026-08-07, R-D3). These rows are
       * shape PANELS — `buildUpLow`, `midBlock` and the rest — and the previous
       * head borrowed the phase term for them, putting two meanings on one word
       * within a single screen. */
      headText: t("team.column.categoryPanel"),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      rowHeader: true,
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    ...SHAPE_MEASURES.map<TableColumn<ShapeRow>>((measure) => ({
      key: measure,
      /*
       * THE UNIT RIDES THE COLUMN HEAD, never the cell (2.13/2.11b's rule). It
       * applies cleanly because these tables are NOT transposed: one measure per
       * column, all three in metres.
       *
       * NOT PRE-COMPOSED INTO `headTitle`. `composeHeadAccessibleName` has an
       * unguarded reverse direction and pre-composing yields
       * "Ordenar por Hora (Hora (hora local))".
       */
      headText: `${t(shapeMeasureKey(measure))} (${metreLabel})`,
      headTitle: t(shapeMeasureKey(measure)),
      render: (row) => formatMetres(row[measure], locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row[measure] },
    })),
  ];

  /*
   * The possession-state headings REUSE `viz.phases.*` rather than minting a
   * `team.shape.state.*` pair: "En posesión" already has exactly one home, and a
   * second would be caught by the duplicate-value gate.
   *
   * The caption itself IS minted — it must state the artifact order for a table
   * whose default sort is `null`, and `viz.phases.tableCaption` says "por fase"
   * which is false of a table whose rows are shape PANELS.
   */
  const shapeInCaption = `${t("viz.phases.inPossession")}${CAPTION_SEPARATOR}${t(
    "team.caption.shape"
  )}`;
  const shapeOutCaption = `${t("viz.phases.outOfPossession")}${CAPTION_SEPARATOR}${t(
    "team.caption.shape"
  )}`;

  /*
   * NO TOP MARGIN ON THE SECTION — the region wrapper already supplies the ONE
   * `layer-gap` the hero→body boundary gets (code review 2026-08-07). Route
   * Composition rules `layer-gap` (64px) at that boundary and `section-gap`
   * (48px) within the layer; this section and the wrapper both carried
   * `mt-layer-gap`, so the boundary rendered at 128px and every body gap at 64px.
   */
  return (
    <section id={IDENTITY_SECTION_ID}>
      <h2 className="type-title text-ink-primary">{title}</h2>

      <div className="mt-3 flex flex-col gap-section-gap">
        {/*
         * ONE NOTE PER FAMILY, ABOVE THE PAIR IT GOVERNS (code review
         * 2026-08-07). `es.ts` calls this "THE SINGLE MOST IMPORTANT SENTENCE ON
         * THIS SURFACE": the eight and nine values are INDEPENDENT RATES —
         * corpus in-possession sums run 84-149 and equal 100 on five of 208
         * team-innings, out-of-possession 73-97 and equal 100 on ZERO. Without
         * it a reader reasonably assumes the bars partition the match.
         *
         * There are TWO notes and FOUR charts, so rendering it inside
         * `rateBlock` printed each sentence twice. The two phase charts share
         * `viz.phases.note`; the blocks and press charts share
         * `viz.pressing.note`. Grouping the pairs is also what the sentence
         * means — it is true of the family, not of one chart.
         */}
        <div className="flex flex-col gap-section-gap">
          <p className="type-caption text-ink-secondary">{phasesNote}</p>
          {rateBlock({
            model: charts.inPossession,
            Chart: InPossessionChart,
            headingKey: "viz.phases.inPossession",
            note: phasesNote,
            figurePrefixKey: "viz.phases.figurePrefix",
            tableNameKey: "team.tableName.inPossession",
            /* These rows ARE phases — `viz.table.phase` is already the right
             * term and a twin key would be a second home for it. */
            categoryHeadKey: "viz.table.phase",
          })}
          {rateBlock({
            model: charts.outOfPossession,
            Chart: OutOfPossessionChart,
            headingKey: "viz.phases.outOfPossession",
            note: phasesNote,
            figurePrefixKey: "viz.phases.figurePrefix",
            tableNameKey: "team.tableName.outOfPossession",
            categoryHeadKey: "viz.table.phase",
          })}
        </div>
        <div className="flex flex-col gap-section-gap">
          <p className="type-caption text-ink-secondary">{pressingNote}</p>
          {rateBlock({
            model: charts.blocks,
            Chart: BlocksChart,
            headingKey: "viz.pressing.blocks",
            note: pressingNote,
            figurePrefixKey: "viz.pressing.figurePrefix",
            tableNameKey: "team.tableName.blocks",
            /* Block LEVELS, not phases (R-D3). */
            categoryHeadKey: "team.column.categoryBlock",
          })}
          {rateBlock({
            model: charts.press,
            Chart: PressChart,
            headingKey: "viz.pressing.pressRates",
            note: pressingNote,
            figurePrefixKey: "viz.pressing.figurePrefix",
            tableNameKey: "team.tableName.press",
            /* Press TYPES, not phases (R-D3). */
            categoryHeadKey: "team.column.categoryPress",
          })}
        </div>

        <div className="flex flex-col gap-tile-gap">
          <h3 className="type-stat-label text-ink-secondary">{t("team.shape.title")}</h3>
          {/*
           * `viz.pressing.metreNote` IS DELIBERATELY NOT REUSED. Its shipped text
           * — "El informe no define a qué fase del juego corresponden estas
           * distancias." — is FALSE on this surface: CS-2 established the
           * opposite, and the report prints three NAMED panels per state. The two
           * glossary definitions that make the same false claim are corrected in
           * the same story (R1's rider).
           */}
          <p className="type-caption text-ink-secondary">{t("team.shape.note")}</p>
          {/* The caller supplies the scrollport; `DataTable` renders none and
           * still must not. `min-w-0` stops a flex ancestor handing this div its
           * content width instead of its available width. */}
          <div className="w-full min-w-0 overflow-x-auto">
            <DataTable
              caption={shapeInCaption}
              columns={shapeColumns}
              rows={shape.inPossession}
              surface="canvas"
              tableName={t("team.tableName.shapeInPossession")}
            />
          </div>
          <div className="w-full min-w-0 overflow-x-auto">
            <DataTable
              caption={shapeOutCaption}
              columns={shapeColumns}
              rows={shape.outOfPossession}
              surface="canvas"
              tableName={t("team.tableName.shapeOutOfPossession")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

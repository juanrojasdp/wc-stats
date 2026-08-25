"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { TacticalIdentityBlock } from "@/lib/contract/contract-types";
import { formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  BLOCK_LEVELS,
  PRESS_PHASES,
  blockRows,
  distributionChartHeightClass,
  percentAxisMax,
  percentTicks,
  pressRows,
  rowsPeak,
  type PhaseRow,
} from "@/viz/phases-model";

import type { ChartSeries } from "@/components/TacticalCharts";

/*
 * The #pressing content (Story 2.10, Task 7.2): the four PRESS RATES, the three
 * DEFENSIVE BLOCK heights, and the four METRE values (ruled decision 4).
 *
 * WHY THE PRESS RATES ARE HERE AS WELL AS IN #phases. Seven of the nine
 * out-of-possession rates appear in both sections, deliberately. This section's
 * SHIPPED, FROZEN copy promises them: tactical.sections.pressing reads "Presión
 * y bloques defensivos" / "Altura de la línea defensiva e INTENSIDAD DE LA
 * PRESIÓN." — and that summary is also the <lg COLLAPSED-SHELL copy
 * (key-match-dashboard-mobile.html:350-353), so a phone reader hunting press
 * intensity opens #pressing, and with a blocks-only section would find neither
 * the press rates nor any hint they live elsewhere.
 *
 * The duplication rides the argument the contract already makes for the blocks
 * — DefensiveBlockDistribution's $comment names this story by name: "They are
 * surfaced again here because Story 2.10's #pressing section renders block
 * height as its own concept." Pressing intensity is its own concept on the same
 * footing. The source keeps `high-press` and `high-block` as SEPARATE enum
 * values, so no reading collapses them.
 *
 * NOTHING HERE IS A PARTITION either — same corpus measurements as #phases.
 */

/*
 * Category counts come from the FROZEN ENUM LISTS, not from literals: the press
 * subset and BLOCK_LEVELS are the same arrays `pressRows` / `blockRows`
 * iterate, so a contract enum change moves the height with it — and if it moves
 * outside the supported set, `distributionChartHeightClass`'s exhaustive throw
 * finally fires instead of being bypassed by a hardcoded 4.
 */
const PRESS_HEIGHT = distributionChartHeightClass(PRESS_PHASES.length as 3 | 4 | 8 | 9);
const BLOCK_HEIGHT = distributionChartHeightClass(BLOCK_LEVELS.length as 3 | 4 | 8 | 9);

function ChartFallback({ heightClass }: { heightClass: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", heightClass)} />
    </div>
  );
}

/*
 * ONE HANDLE PER HEIGHT, NOT ONE PER MODULE. A `dynamic()` call bakes its
 * `loading` fallback in at declaration time and cannot vary it per instance, so
 * a single shared handle rendered at two different category counts necessarily
 * shows one of them the wrong-sized skeleton — here a 182 px fallback in front
 * of the 152 px three-category blocks chart. That is a CLS hit against the very
 * budget the code-split protects. Both handles share one chunk: `next/dynamic`
 * dedupes on the import specifier, so this costs nothing at the network layer.
 */
function distributionChart(heightClass: string) {
  return dynamic(
    /*
     * `@/components/Charts`, the ONE lazy boundary (Story 2.15 ruled D1). Both
     * handles below keep their own `loading` fallback and still share one chunk
     * group — `next/dynamic` dedupes on the SPECIFIER — which is now the app's
     * single group rather than one of two.
     */
    () => import("@/components/Charts").then((module) => module.DistributionChart),
    { ssr: false, loading: () => <ChartFallback heightClass={heightClass} /> }
  );
}

const PressChart = distributionChart(PRESS_HEIGHT);
const BlockChart = distributionChart(BLOCK_HEIGHT);

const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";

interface SideRef {
  teamId: string;
  teamCode: string;
  name: string;
}

export interface PressingSectionProps {
  tacticalIdentity: TacticalIdentityBlock;
  home: SideRef;
  away: SideRef;
}

export function PressingSection({ tacticalIdentity, home, away }: PressingSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("tactical.sections.pressing.title");

  // Eager, outside the disclosure (ruled decision 18).
  const press = pressRows(tacticalIdentity);
  const blocks = blockRows(tacticalIdentity);

  const axisValueLabel = t("viz.pressing.axisRate");
  const axisCategoryLabel = t("viz.pressing.axisPhase");
  const figurePrefix = t("viz.pressing.figurePrefix");
  const note = t("viz.pressing.note");

  function formatValue(value: number): string {
    return formatPercent(value, locale, 0);
  }

  function chartFor(
    rows: PhaseRow[],
    groupLabel: string,
    heightClass: string,
    DistributionChart: typeof PressChart
  ) {
    const peak = rowsPeak(rows);
    const homeSeries: ChartSeries = {
      teamCode: home.teamCode,
      values: rows.map((row) => row.home),
    };
    const awaySeries: ChartSeries = {
      teamCode: away.teamCode,
      values: rows.map((row) => row.away),
    };
    const figureSummary =
      `${figurePrefix} ${groupLabel}${CLAUSE_SEPARATOR}` +
      `${home.name} ${VALUE_SEPARATOR} ${away.name}${CLAUSE_SEPARATOR}${note}`;
    return (
      <div className="flex flex-col gap-1">
        <p className="type-stat-label text-ink-secondary">{groupLabel}</p>
        <DistributionChart
          categoryLabels={rows.map((row) => t(row.labelKey))}
          home={homeSeries}
          away={awaySeries}
          ticks={percentTicks(peak)}
          axisMax={percentAxisMax(peak)}
          axisValueLabel={axisValueLabel}
          axisCategoryLabel={axisCategoryLabel}
          formatValue={formatValue}
          figureSummary={figureSummary}
          heightClass={heightClass}
        />
      </div>
    );
  }

  /* ------------------------------- The tables -------------------------------- */

  /*
   * The rate tables share a shape — label, home, away — differing only in the
   * first column's head and in the value formatter. Built from one factory so
   * the two can never drift apart. (A third, the metre table, was retired with
   * `PossessionSplitMetres` in change-set CS-2; re-presenting the 18 real
   * `shapeByPhase` values is filed to 2.19 and needs six panel labels that exist
   * in neither locale.)
   */
  function labelledPairColumns<Row extends { labelKey: DictionaryKey; home: number; away: number }>(
    labelHead: string,
    format: (value: number) => string
  ): TableColumn<Row>[] {
    return [
      {
        key: "label",
        headText: labelHead,
        headTitle: null,
        render: (row) => t(row.labelKey),
        align: "text",
        // The RESOLVED label, so the order follows the EN toggle.
        sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
      },
      {
        key: "home",
        headText: home.teamCode,
        headTitle: home.name,
        render: (row) => format(row.home),
        align: "numeric",
        // The RAW value, never the formatted string: "9,0" and "47,0" collate
        // in the wrong order as text under es-CO comma decimals.
        sort: { kind: "number", valueOf: (row) => row.home },
      },
      {
        key: "away",
        headText: away.teamCode,
        headTitle: away.name,
        render: (row) => format(row.away),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.away },
      },
    ];
  }

  /*
   * ONE DECIMAL IN THE TABLE, deliberately more precise than the chart's axis.
   * AC 1 requires "exact percentages and values are reachable via each chart's
   * data table", and `Percentage` is declared with "x-decimals": 1 — so rounding
   * to whole points here would discard contracted precision. Invisible today
   * (every fixture value is an integer) and first visible at the 2.19 real-data
   * cutover: the fixture-vs-corpus trap this story is built around. The axis
   * ticks stay at 0 decimals; they are integers by construction.
   */
  const rateColumns = labelledPairColumns<PhaseRow>(t("viz.table.phase"), (value) =>
    formatPercent(value, locale, 1)
  );

  const pressCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.pressing.pressRates")}` +
    `${CAPTION_SEPARATOR}${t("viz.pressing.tableCaption")}`;
  const blockCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.pressing.blocks")}` +
    `${CAPTION_SEPARATOR}${t("viz.pressing.tableCaption")}`;

  function rateTable(caption: string, rows: PhaseRow[]) {
    return (
      <DataTable
        caption={caption}
        tableName={caption}
        columns={rateColumns}
        rows={rows}
        surface="canvas"
      />
    );
  }

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      {rateTable(pressCaption, press)}
      {rateTable(blockCaption, blocks)}
    </div>
  );

  return (
    <div className="flex flex-col gap-tile-gap">
      <p className="type-stat-label text-ink-secondary">{note}</p>
      {/* Press FIRST, matching the section title's own word order. */}
      {/* Each handle carries a skeleton fallback at ITS OWN height — see above. */}
      {chartFor(press, t("viz.pressing.pressRates"), PRESS_HEIGHT, PressChart)}
      {chartFor(blocks, t("viz.pressing.blocks"), BLOCK_HEIGHT, BlockChart)}
      <ViewDataDisclosure
        panelTitle={title}
        surface="canvas"
        trailing={<p className="type-caption text-ink-secondary">{t("viz.attribution")}</p>}
      >
        {dataTable}
      </ViewDataDisclosure>
    </div>
  );
}

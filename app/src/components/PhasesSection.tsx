"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { TacticalIdentityBlock } from "@/lib/contract/contract-types";
import { formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  IN_POSSESSION_PHASES,
  OUT_OF_POSSESSION_PHASES,
  distributionChartHeightClass,
  percentAxisMax,
  percentTicks,
  phaseRows,
  rowsPeak,
  type PhaseRow,
} from "@/viz/phases-model";

/*
 * The #phases content (Story 2.10, Task 7.1) — the Phases of Play page,
 * verbatim: all EIGHT in-possession and NINE out-of-possession rates, both
 * teams, as two comparative distributions (ruled decision 4).
 *
 * THE SUBTITLE IS THE MOST IMPORTANT SENTENCE ON THIS SURFACE. These are
 * INDEPENDENT PER-PHASE RATES, not a partition: corpus in-possession sums run
 * 84-149 (median 107) and equal 100 on five of 208 team-innings;
 * out-of-possession 73-97 and equal 100 on ZERO. Nothing here normalizes,
 * stacks, or pies them — `InPossessionPhase`'s own description forbids it,
 * contract/README.md logged decision 5 forbids it, and the Story 2.3 sign-off
 * names this story: "renderers in 2.10/2.16 must never sum, normalize, or pie
 * these".
 *
 * TacticalSection owns the section <h2> and its anchor-focus contract. This
 * component renders NO HEADING AT ALL — a subtitle <p> instead, following
 * MomentumSection's ruling that a sentence which is not a section name must not
 * enter the page outline.
 */

/*
 * TYPE-ONLY IMPORT. A value import from TacticalCharts creates a static
 * module-graph edge into the very module next/dynamic exists to defer, linking
 * recharts back onto the critical path and quietly defeating the code-split.
 * Both height classes come from the PURE model instead.
 */
import type { ChartSeries } from "@/components/TacticalCharts";

/*
 * Category counts come from the FROZEN ENUM LISTS, not from a literal written
 * here: `IN_POSSESSION_PHASES` is the same array `phaseRows` iterates, so if the
 * contract enum ever gains a member the height follows it — and if it moves
 * outside the supported set, `distributionChartHeightClass`'s exhaustive throw
 * finally fires instead of being bypassed by a hardcoded 8.
 */
const IN_POSSESSION_HEIGHT = distributionChartHeightClass(
  IN_POSSESSION_PHASES.length as 3 | 4 | 8 | 9
);
const OUT_OF_POSSESSION_HEIGHT = distributionChartHeightClass(
  OUT_OF_POSSESSION_PHASES.length as 3 | 4 | 8 | 9
);

/*
 * The skeleton fallback is AT THE CHART'S EXACT HEIGHT. The `skeleton` utility
 * sets background, radius and pulse only and supplies NO DIMENSIONS, so an
 * unsized fallback collapses to ~0 px and the chart then mounts at full height
 * — a CLS hit against the very budget the code-split protects, and one that
 * would also break the #phases deep link, because TacticalLayer scrolls on
 * mount, before the dynamic chunk resolves.
 */
function ChartFallback({ heightClass }: { heightClass: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", heightClass)} />
    </div>
  );
}

/*
 * TacticalCharts has NO DEFAULT EXPORT, so `dynamic(() => import(...))` alone
 * would resolve to a module object rather than a component.
 *
 * ONE HANDLE PER HEIGHT, NOT ONE PER MODULE. A `dynamic()` call bakes its
 * `loading` fallback in at declaration time and cannot vary it per instance, so
 * a single shared handle rendered at two different category counts necessarily
 * shows one of them the wrong-sized skeleton — here a 302 px fallback in front
 * of the 332 px nine-category chart. That is a CLS hit against the very budget
 * the code-split protects, and it lands hardest on the #phases deep link, where
 * TacticalLayer scrolls on mount BEFORE the chunk resolves. Both handles share
 * one chunk: `next/dynamic` dedupes on the import specifier, so this costs
 * nothing at the network layer.
 */
function distributionChart(heightClass: string) {
  return dynamic(
    () => import("@/components/TacticalCharts").then((module) => module.DistributionChart),
    {
      // Legal by AR-11: TacticalLayer is already client-only, so no Tactical
      // markup exists in out/ and there is no server render to skip.
      ssr: false,
      loading: () => <ChartFallback heightClass={heightClass} />,
    }
  );
}

const InPossessionChart = distributionChart(IN_POSSESSION_HEIGHT);
const OutOfPossessionChart = distributionChart(OUT_OF_POSSESSION_HEIGHT);

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";

interface SideRef {
  teamId: string;
  teamCode: string;
  name: string;
}

export interface PhasesSectionProps {
  tacticalIdentity: TacticalIdentityBlock;
  home: SideRef;
  away: SideRef;
}

export function PhasesSection({ tacticalIdentity, home, away }: PhasesSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("tactical.sections.phases.title");

  // Built EAGERLY, outside the lazily-mounted disclosure, following every
  // shipped section (ruled decision 18).
  const sets = phaseRows(tacticalIdentity);

  const axisValueLabel = t("viz.phases.axisRate");
  const axisCategoryLabel = t("viz.phases.axisPhase");
  const figurePrefix = t("viz.phases.figurePrefix");

  function formatValue(value: number): string {
    return formatPercent(value, locale, 0);
  }

  function chartFor(rows: PhaseRow[], stateKey: "inPossession" | "outOfPossession") {
    const peak = rowsPeak(rows);
    const ticks = percentTicks(peak);
    const stateLabel =
      stateKey === "inPossession" ? t("viz.phases.inPossession") : t("viz.phases.outOfPossession");
    const homeSeries: ChartSeries = {
      teamCode: home.teamCode,
      values: rows.map((row) => row.home),
    };
    const awaySeries: ChartSeries = {
      teamCode: away.teamCode,
      values: rows.map((row) => row.away),
    };
    /*
     * Hoisted into an identifier: a template literal inside a gated prop trips
     * the i18n rule EVEN WHEN every fragment is a t() call.
     */
    const figureSummary =
      `${figurePrefix} ${stateLabel}${CLAUSE_SEPARATOR}` +
      `${home.name} ${VALUE_SEPARATOR} ${away.name}${CLAUSE_SEPARATOR}${t("viz.phases.note")}`;
    const inPossession = stateKey === "inPossession";
    const heightClass = inPossession ? IN_POSSESSION_HEIGHT : OUT_OF_POSSESSION_HEIGHT;
    // Each handle carries a skeleton fallback at ITS OWN height — see above.
    const DistributionChart = inPossession ? InPossessionChart : OutOfPossessionChart;
    return (
      <div className="flex flex-col gap-1">
        <p className="type-stat-label text-ink-secondary">{stateLabel}</p>
        <DistributionChart
          categoryLabels={rows.map((row) => t(row.labelKey))}
          home={homeSeries}
          away={awaySeries}
          ticks={ticks}
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

  /* ------------------------------- The table -------------------------------- */

  const columns: TableColumn<PhaseRow>[] = [
    {
      key: "phase",
      headText: t("viz.table.phase"),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      // The RESOLVED phase name, so the order follows the EN toggle. Sorting on
      // `labelKey` would order by "viz.phases.*" and never re-sort.
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    {
      key: "home",
      headText: home.teamCode,
      headTitle: home.name,
      /*
       * ONE DECIMAL, deliberately more precise than the chart's axis. AC 1
       * requires "exact percentages and values are reachable via each chart's
       * data table", and `Percentage` is declared with "x-decimals": 1 — so
       * whole points would discard contracted precision. Invisible today (every
       * fixture value is an integer), first visible at the 2.19 cutover.
       */
      render: (row) => formatPercent(row.home, locale, 1),
      align: "numeric",
      /*
       * The RAW rate, not the rendered "43 %" string. These are INDEPENDENT
       * per-phase rates and nothing here sums or normalizes them (the surface's
       * whole subtitle exists to say so) — but each column is legitimately
       * ordered on its own values.
       */
      sort: { kind: "number", valueOf: (row) => row.home },
    },
    {
      key: "away",
      headText: away.teamCode,
      headTitle: away.name,
      render: (row) => formatPercent(row.away, locale, 1),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.away },
    },
  ];

  const inCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.phases.inPossession")}` +
    `${CAPTION_SEPARATOR}${t("viz.phases.tableCaption")}`;
  const outCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.phases.outOfPossession")}` +
    `${CAPTION_SEPARATOR}${t("viz.phases.tableCaption")}`;

  function tableFor(caption: string, rows: PhaseRow[]) {
    return <DataTable caption={caption} columns={columns} rows={rows} surface="canvas" />;
  }

  /*
   * NO TOTAL ROW, deliberately, and this is the one place a reader might expect
   * one: a column footer adding the eight in-possession rates would assert
   * exactly the partition this whole surface exists to deny.
   */
  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      {tableFor(inCaption, sets.inPossession)}
      {tableFor(outCaption, sets.outOfPossession)}
    </div>
  );

  return (
    <div className="flex flex-col gap-tile-gap">
      <p className="type-stat-label text-ink-secondary">{t("viz.phases.note")}</p>
      {/*
       * Ruled decision 17's EXCEPTION: a DistributionChart is category x 2
       * TEAMS IN ONE CHART, not two per-team cards, so the two charts stack
       * vertically at EVERY width and the teams are two series inside each.
       * They are never two columns of a responsive grid.
       */}
      {chartFor(sets.inPossession, "inPossession")}
      {chartFor(sets.outOfPossession, "outOfPossession")}
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

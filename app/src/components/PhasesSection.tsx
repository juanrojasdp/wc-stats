"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { TacticalIdentityBlock } from "@/lib/contract/contract-types";
import { formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
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

const IN_POSSESSION_HEIGHT = distributionChartHeightClass(8);
const OUT_OF_POSSESSION_HEIGHT = distributionChartHeightClass(9);

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
 * would resolve to a module object rather than a component. Declared ONCE here
 * and rendered twice.
 */
const DistributionChart = dynamic(
  () => import("@/components/TacticalCharts").then((module) => module.DistributionChart),
  {
    // Legal by AR-11: TacticalLayer is already client-only, so no Tactical
    // markup exists in out/ and there is no server render to skip.
    ssr: false,
    loading: () => <ChartFallback heightClass={IN_POSSESSION_HEIGHT} />,
  }
);

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

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: { key: string; label: string; numeric: boolean }[];
  children: ReactNode;
}) {
  /*
   * Canvas ink, following MomentumSection — --ink-on-pitch computes 1.09:1 on
   * the white card. NO overflow-x-auto of its own: ViewDataDisclosure's region
   * already applies it and a second one nests scroll containers.
   *
   * A private copy per section is the CURRENT CONVENTION (PassNetworksSection
   * says so explicitly); DataTable is deliberately not extracted here.
   *
   * NOT SORTABLE in this story. ==> 2.11 PLUG-IN POINT: UX-DR12's sort contract
   * — aria-sort, Intl.Collator('es', {sensitivity:'base'}) and a stated default
   * sort — attaches to these <th> elements and sorts the model's row arrays.
   * ONE cross-table contract, built once in 2.11.
   */
  return (
    <table className="w-full border-collapse text-left">
      <caption className="mb-2 text-left type-caption text-ink-secondary">{caption}</caption>
      <thead>
        <tr className="border-b border-hairline">
          {headers.map((header) => (
            <th
              key={header.key}
              scope="col"
              className={cn(
                "px-2 py-1.5 type-stat-label text-ink-secondary",
                header.numeric ? "text-right" : "text-left"
              )}
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
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
    const heightClass =
      stateKey === "inPossession" ? IN_POSSESSION_HEIGHT : OUT_OF_POSSESSION_HEIGHT;
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

  const headers = [
    { key: "phase", label: t("viz.table.phase"), numeric: false },
    { key: "home", label: home.teamCode, numeric: true },
    { key: "away", label: away.teamCode, numeric: true },
  ];

  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-primary";
  const textCell = "px-2 py-1.5 type-caption text-ink-primary";
  const rowClass = "border-b border-hairline";

  const inCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.phases.inPossession")}` +
    `${CAPTION_SEPARATOR}${t("viz.phases.tableCaption")}`;
  const outCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.phases.outOfPossession")}` +
    `${CAPTION_SEPARATOR}${t("viz.phases.tableCaption")}`;

  function tableFor(caption: string, rows: PhaseRow[]) {
    return (
      <DataTable caption={caption} headers={headers}>
        {rows.map((row) => (
          <tr key={row.key} className={rowClass}>
            <td className={textCell}>{t(row.labelKey)}</td>
            <td className={numericCell}>{formatPercent(row.home, locale, 0)}</td>
            <td className={numericCell}>{formatPercent(row.away, locale, 0)}</td>
          </tr>
        ))}
      </DataTable>
    );
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

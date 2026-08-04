"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { TacticalIdentityBlock } from "@/lib/contract/contract-types";
import { formatDecimal, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
  blockRows,
  distributionChartHeightClass,
  metreRows,
  percentAxisMax,
  percentTicks,
  pressRows,
  rowsPeak,
  type MetreRow,
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

const PRESS_HEIGHT = distributionChartHeightClass(4);
const BLOCK_HEIGHT = distributionChartHeightClass(3);

function ChartFallback({ heightClass }: { heightClass: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", heightClass)} />
    </div>
  );
}

const DistributionChart = dynamic(
  () => import("@/components/TacticalCharts").then((module) => module.DistributionChart),
  { ssr: false, loading: () => <ChartFallback heightClass={PRESS_HEIGHT} /> }
);

const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";
const UNIT_SEPARATOR = " ";

/*
 * Theme-aware canvas accents: these are cards on --surface-raised, never the
 * pitch. The -on-pitch variants would put #f2f5f7 ink at 1.09:1 on the white
 * card. Measured on --surface-raised: team A 13.56 dark / 4.99 light, team B
 * 10.30 / 5.36 — both clear 4.5:1 in both themes.
 */
const ACCENT_CLASS = { a: "text-viz-team-a", b: "text-viz-team-b" } as const;

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

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: { key: string; label: string; numeric: boolean }[];
  children: ReactNode;
}) {
  // Private copy per section, the current convention. Not sortable — 2.11 owns
  // aria-sort and the collator sort. No overflow-x-auto: the disclosure has one.
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

export function PressingSection({ tacticalIdentity, home, away }: PressingSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("tactical.sections.pressing.title");

  // Eager, outside the disclosure (ruled decision 18).
  const press = pressRows(tacticalIdentity);
  const blocks = blockRows(tacticalIdentity);
  const metres = metreRows(tacticalIdentity);

  const axisValueLabel = t("viz.pressing.axisRate");
  const axisCategoryLabel = t("viz.pressing.axisPhase");
  const figurePrefix = t("viz.pressing.figurePrefix");
  const note = t("viz.pressing.note");
  const metreUnit = t("enums.unit.m");

  function formatValue(value: number): string {
    return formatPercent(value, locale, 0);
  }

  function chartFor(rows: PhaseRow[], groupLabel: string, heightClass: string) {
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

  /* -------------------------------- The metres ------------------------------- */

  /**
   * One team's four distances.
   *
   * RULED DECISION 11, MADE TRUE RATHER THAN ASSERTED: this is TWO PER-TEAM
   * BLOCKS in decision 17's grid, never a mirrored or centred-label tile pair.
   * #pressing's metre values are the one place this story would otherwise build
   * the very head-to-head stat-tile shape decision 11 rests on not existing —
   * and with it would come the expectation of UX-DR7's ▲ «líder» treatment on
   * "longitud del equipo 47 m vs 36 m", an editorial judgement the source does
   * not make. NO LEADER TREATMENT ANYWHERE IN THIS STORY: `resolveLeader` is
   * neither imported nor re-implemented here, and the departure is filed for UX
   * sign-off.
   */
  function metreBlock(ref: SideRef, accent: "a" | "b", read: (row: MetreRow) => number) {
    const figureSummary = `${figurePrefix} ${t("viz.pressing.metres")}${CLAUSE_SEPARATOR}${ref.name}`;
    return (
      <figure
        role="figure"
        aria-label={figureSummary}
        className="min-w-0 rounded-md bg-surface-raised p-tile-gap"
      >
        {/* A team code is a LABEL, never a heading. */}
        <span className={cn("type-label-caps", ACCENT_CLASS[accent])}>{ref.teamCode}</span>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
          {metres.map((row) => (
            <div key={row.key} className="contents">
              <dt className="type-caption text-ink-secondary">{t(row.labelKey)}</dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatDecimal(read(row), locale, 1)}
                {UNIT_SEPARATOR}
                {metreUnit}
              </dd>
            </div>
          ))}
        </dl>
      </figure>
    );
  }

  /* ------------------------------- The tables -------------------------------- */

  const rateHeaders = [
    { key: "phase", label: t("viz.table.phase"), numeric: false },
    { key: "home", label: home.teamCode, numeric: true },
    { key: "away", label: away.teamCode, numeric: true },
  ];
  const metreHeaders = [
    { key: "measure", label: t("viz.table.measure"), numeric: false },
    { key: "home", label: home.teamCode, numeric: true },
    { key: "away", label: away.teamCode, numeric: true },
  ];

  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-primary";
  const textCell = "px-2 py-1.5 type-caption text-ink-primary";
  const rowClass = "border-b border-hairline";

  const pressCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.pressing.pressRates")}` +
    `${CAPTION_SEPARATOR}${t("viz.pressing.tableCaption")}`;
  const blockCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.pressing.blocks")}` +
    `${CAPTION_SEPARATOR}${t("viz.pressing.tableCaption")}`;
  const metreCaption =
    `${title}${CAPTION_SEPARATOR}${t("viz.pressing.metreTableCaption")}`;

  function rateTable(caption: string, rows: PhaseRow[]) {
    return (
      <DataTable caption={caption} headers={rateHeaders}>
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

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      {rateTable(pressCaption, press)}
      {rateTable(blockCaption, blocks)}
      <DataTable caption={metreCaption} headers={metreHeaders}>
        {metres.map((row) => (
          <tr key={row.key} className={rowClass}>
            <td className={textCell}>{t(row.labelKey)}</td>
            <td className={numericCell}>{formatDecimal(row.home, locale, 1)}</td>
            <td className={numericCell}>{formatDecimal(row.away, locale, 1)}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );

  return (
    <div className="flex flex-col gap-tile-gap">
      <p className="type-stat-label text-ink-secondary">{note}</p>
      {/* Press FIRST, matching the section title's own word order. */}
      {chartFor(press, t("viz.pressing.pressRates"), PRESS_HEIGHT)}
      {chartFor(blocks, t("viz.pressing.blocks"), BLOCK_HEIGHT)}
      <div className="flex flex-col gap-1">
        <p className="type-stat-label text-ink-secondary">{t("viz.pressing.metres")}</p>
        {/*
         * RULED DECISION 5. These four numbers are the ONLY part of Domain C
         * with no real counterpart: the corpus prints three panels per
         * possession state with three measures each (including team_width,
         * which the contract does not model), and m001's staged line_height of
         * 19/39/54 matches neither the fixture's single 44.4 nor any mean of
         * them. They render because they are required, contracted fields and
         * the App's job is to render what the bundle carries — with NO invented
         * aggregation and no copy claiming which phase they describe. Story
         * 1.16 owns the aggregation rule.
         */}
        <p className="type-caption text-ink-secondary">{t("viz.pressing.metreNote")}</p>
        {/* Ruled decision 17: stacked at <md, both visible, no tabs. */}
        <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">
          {metreBlock(home, "a", (row) => row.home)}
          {metreBlock(away, "b", (row) => row.away)}
        </div>
      </div>
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

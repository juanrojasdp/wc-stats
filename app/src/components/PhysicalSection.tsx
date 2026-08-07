"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { ProfileStatTiles, type ProfileStatTile } from "@/components/ProfileStatTiles";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeMetricLabel,
  composeZoneFigureSummary,
  formatCount,
  formatProfileValue,
  speedZoneBandKey,
  speedZoneLabelKey,
} from "@/lib/player-profile-format";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  PHYSICAL_SECTION_ID,
  speedZoneAxis,
  speedZoneChartHeightClass,
  type PhysicalModel,
  type SpeedZoneRow,
} from "@/viz/player-profile-model";

/*
 * The #physical content (Story 2.15, AC 2): the five speed bands as a chart,
 * `highSpeedRuns` / `sprints` / `topSpeed` as three tiles, and the data-table
 * alternative behind "Ver los datos".
 *
 * It owns the locale and the format layer; `SpeedZoneChart` owns recharts and
 * receives resolved strings.
 *
 * NO EMPTY STATE HERE, and that is ruled (D8). A keeper who never played has a
 * physical block of real zeros, not a missing one — `ExpertLayer` governs: "NO
 * PRESENCE GATE AND NO EM DASH, ever. Domain G has zero nullable leaves … a zero
 * is a real, dense measurement … Print it." `EmptyStatePanel` is for a section
 * the artifact does not carry, which this never is.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

const ZONE_COUNT = 5;
const ZONE_HEIGHT = speedZoneChartHeightClass(ZONE_COUNT);

/*
 * The skeleton is AT THE CHART'S EXACT HEIGHT, from the SAME pure function the
 * chart uses. The `skeleton` utility supplies no dimensions of its own, so an
 * unsized fallback collapses to ~0 px and the chart then mounts at full height —
 * a CLS hit against the budget the code-split protects.
 */
function ChartFallback() {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", ZONE_HEIGHT)} />
    </div>
  );
}

/*
 * `@/components/Charts` — the ONE lazy boundary (ruled D1). Pointing this at
 * `@/components/ProfileCharts` would mint a THIRD async chunk group and with it
 * a third ~300 kB recharts vendor copy, which is the duplication AC 6 removes.
 */
const SpeedZoneChart = dynamic(
  () => import("@/components/Charts").then((module) => module.SpeedZoneChart),
  { ssr: false, loading: () => <ChartFallback /> }
);

export function PhysicalSection({ physical }: { physical: PhysicalModel }) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("player.sections.physical.title");
  const metresLabel = t("enums.unit.m");
  const axisValueLabel = composeMetricLabel(t("player.axis.distance"), metresLabel);
  const axisCategoryLabel = t("player.axis.speedZone");

  // Built EAGERLY, outside the lazily-mounted disclosure (2.11b): a value that
  // would throw in the format layer must fail on load, not on expand.
  const axis = speedZoneAxis(physical.zones.map((zone) => zone.metres));
  const points = physical.zones.map((zone) => ({
    label: t(speedZoneLabelKey(zone.zone)),
    value: zone.metres,
  }));

  function formatMetres(value: number): string {
    return formatProfileValue(value, "decimal1", locale);
  }

  /*
   * `${title} — ${order}`, the composition all 27 shipped captions use. Hoisted
   * because `caption` is a gated prop name and the gate fires on a template
   * literal there even when every fragment is a t() call.
   *
   * PREFIXED BY THE SECTION TITLE for the shipped reason: this table lives
   * inside a disclosure, far from the `<h2>` that names it, and a reader
   * listing the page's tables gets the order statement attached to a surface
   * rather than floating free. It is also what keeps every rendered `<caption>`
   * on the site distinct, which `i18n.test.ts` pins.
   */
  const physicalCaption = `${title}${CAPTION_SEPARATOR}${t("player.caption.physical")}`;

  const figureSummary = composeZoneFigureSummary({
    title,
    bandCount: `${formatCount(ZONE_COUNT, locale)} ${t("player.zonesNoun")}`,
    unitLabel: metresLabel,
  });

  /*
   * The three tiles beside the chart (D7). `topSpeed` and the two run counts
   * come from `physical{}`, which is this section's source — the aggregates
   * table reads `aggregates[]` for the same two metrics and BOTH render. The
   * artifact repeats them on purpose; deduping would be a client-side edit of a
   * verbatim surface (AR-5).
   *
   * Every label REUSES a shipped key (D12): `expert.field.highSpeedRuns` and
   * `expert.field.sprints` already ship, and `enums.leaderboardMetric.topSpeed`
   * is the term the Hero tile and the leaderboards already use.
   */
  const tiles: ProfileStatTile[] = [
    {
      key: "physical-highSpeedRuns",
      labelNode: t("expert.field.highSpeedRuns"),
      value: formatProfileValue(physical.highSpeedRuns, "integer", locale),
    },
    {
      key: "physical-sprints",
      labelNode: t("expert.field.sprints"),
      value: formatProfileValue(physical.sprints, "integer", locale),
    },
    {
      key: "physical-topSpeed",
      labelNode: composeMetricLabel(
        t("enums.leaderboardMetric.topSpeed"),
        t("enums.unit.kmh")
      ),
      value: formatProfileValue(physical.topSpeed, "decimal1", locale),
      wide: true,
    },
  ];

  /*
   * The data-table alternative renders THE SAME ARTIFACT SLICE the chart does
   * (NFR-2): five bands, five distances. It carries the BAND DESCRIPTOR as a
   * `headTitle`-style second column rather than folding it into the zone label —
   * the axis has no room for "Zona 1 (0-7 km/h)" at 320 px, and the descriptor
   * is the only place the reader learns what a zone IS.
   *
   * NO ZONE-SUM ROW, ever (D7): |totalDistance − Σ zones| ≤ 0.35 m, so a derived
   * total would both violate AD-5 and disagree with the aggregates table.
   */
  const columns: TableColumn<SpeedZoneRow>[] = [
    {
      key: "zone",
      headText: t("player.column.speedZone"),
      headTitle: null,
      render: (row) => t(speedZoneLabelKey(row.zone)),
      align: "text",
      rowHeader: true,
      sort: { kind: "number", valueOf: (row) => row.zone },
    },
    {
      key: "band",
      headText: t("player.column.speedBand"),
      headTitle: null,
      render: (row) => t(speedZoneBandKey(row.zone)),
      align: "text",
      sort: { kind: "text", valueOf: (row) => t(speedZoneBandKey(row.zone)) },
    },
    {
      key: "metres",
      headText: composeMetricLabel(t("player.axis.distance"), metresLabel),
      headTitle: null,
      render: (row) => formatMetres(row.metres),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.metres },
    },
  ];

  return (
    <section id={PHYSICAL_SECTION_ID} className="mt-layer-gap">
      <h2 className="type-title text-ink-primary">{title}</h2>
      {/*
       * An UNNAMED <figure> grouping the chart with its data alternative. It
       * carries no role and no aria-label on purpose: `SpeedZoneChart` is
       * already `role="img"` with the localized summary, and a named figure
       * around a named img gives the reader two competing accessible names
       * (`InvolvementChart`'s ruling).
       */}
      <figure className="mt-3 min-w-0">
        <div className="rounded-lg bg-surface-raised p-tile-gap">
          <SpeedZoneChart
            points={points}
            ticks={axis.ticks}
            axisMax={axis.max}
            formatValue={formatMetres}
            axisValueLabel={axisValueLabel}
            axisCategoryLabel={axisCategoryLabel}
            figureSummary={figureSummary}
            heightClass={ZONE_HEIGHT}
          />
        </div>
        <ProfileStatTiles tiles={tiles} />
        <div className="mt-tile-gap">
          {/*
           * `surface="canvas"`, never the default `"pitch"`. On a
           * --surface-raised card the on-pitch ink computes 1.10:1 — an
           * invisible control, which is the contrast trap this prop exists for.
           *
           * The attribution rides `trailing` so it sits BESIDE the control and
           * survives a screenshot taken with the table closed (UX-DR21).
           */}
          <ViewDataDisclosure
            panelTitle={title}
            surface="canvas"
            trailing={<p className="type-caption text-ink-secondary">{t("viz.attribution")}</p>}
          >
            <DataTable
              caption={physicalCaption}
              columns={columns}
              rows={physical.zones}
              surface="canvas"
              tableName={t("player.tableName.physical")}
            />
          </ViewDataDisclosure>
        </div>
      </figure>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { GlossaryTerm } from "@/components/GlossaryTerm";
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
 * It owns the locale and the format layer; `CategoryBarChart` owns recharts and
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
const CategoryBarChart = dynamic(
  () => import("@/components/Charts").then((module) => module.CategoryBarChart),
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
   * EVERY LABEL COMES FROM `enums.leaderboardMetric.*`, THE FULL-TERM
   * NAMESPACE — and that is a correction to D12's reuse table rather than a
   * departure from it. That table names `expert.field.highSpeedRuns` as the
   * shipped term, but its actual value is "CARR. ALTA VEL.": the ABBREVIATION,
   * which the Expert Layer can use because a `<th>` carries the full term in
   * `headTitle`. A TILE HAS NO SUCH SLOT, so an abbreviation there is an
   * all-caps string with nothing behind it — exactly what UX-DR17/UX-DR19
   * require the full term for. `enums.leaderboardMetric.highSpeedRuns` is
   * "Carreras a alta velocidad", equally shipped and equally a reuse.
   * (`sprints` is "Sprints" in both namespaces; it takes the same one for
   * uniformity.) Caught in the browser, not by a test.
   */
  const tiles: ProfileStatTile[] = [
    {
      key: "physical-highSpeedRuns",
      /*
       * GLOSSARY-MARKED (Task 10.7, UX-DR20). The tile label is the ONE place on
       * this route where a term can carry a popover: D5 makes the tile itself a
       * non-target whose only focusable child may be a `GlossaryTerm`, and the
       * competing hosts are all barred — a sortable column head cannot nest a
       * focusable trigger inside its `<button aria-expanded>` (2.13), and the
       * chart's axis titles are SVG `<text>` that no popover can attach to.
       *
       * `high-speed-run` and `sprint` are both real `GLOSSARY_TERMS` ids. The
       * section's `<h2>` ("Perfil físico") matches no row of the policy table,
       * so it carries NO mark — a dotted underline with no popover behind it is
       * the broken promise 2.5 decision 8 rules against.
       *
       * A `<div>`, not a `<span>`: decision 9 forbids portalling
       * `Popover.Content`, so the panel mounts as a DOM sibling of its trigger,
       * and `div` inside `span` is an invalid content model that React's
       * validateDOMNesting does NOT warn about.
       *
       * NO `normal-case` (code review 2026-08-07). Both marked labels carried it
       * and the third tile — a plain string — did not, so one row read "Carreras
       * a alta velocidad", "Sprints", "VELOCIDAD MÁXIMA (KM/H)". `type-stat-label`
       * sets `text-transform: uppercase` and every shipped tile on the site
       * takes it; the override was incidental to the glossary markup, not a
       * ruling, so it goes rather than spreading to the third tile.
       */
      labelNode: (
        <div className="inline-flex items-center gap-1">
          <GlossaryTerm termId="high-speed-run">
            {t("enums.leaderboardMetric.highSpeedRuns")}
          </GlossaryTerm>
        </div>
      ),
      value: formatProfileValue(physical.highSpeedRuns, "integer", locale),
    },
    {
      key: "physical-sprints",
      /*
       * No `termLang`. `sprint` is policy `jargon` — the English term stays in
       * both dictionaries — so it is not "in a different language from the
       * surrounding copy" in EN, and a hardcoded `lang="en"` would assert a
       * language change that does not occur there. `StoryStatTiles`' xG call
       * site (also `jargon`) omits it for the same reason.
       */
      labelNode: (
        <div className="inline-flex items-center gap-1">
          <GlossaryTerm termId="sprint">{t("enums.leaderboardMetric.sprints")}</GlossaryTerm>
        </div>
      ),
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
      /*
       * SORTS THE ZONE, NOT THE BAND STRING (code review 2026-08-07). The
       * descriptors are numeric RANGES rendered as text — "0-7 km/h", "7-15
       * km/h", "15-20 km/h", "20-25 km/h", "25 km/h o más" — and
       * `Intl.Collator("es")` orders them `0-7 | 15-20 | 20-25 | 25 km/h o más |
       * 7-15`, putting zone 5 between zones 1 and 2. The bands are 1:1 with the
       * zones and strictly increasing, so the zone index IS the band order; this
       * is the same trap the per-match date column documents twice, reached from
       * the other side.
       */
      sort: { kind: "number", valueOf: (row) => row.zone },
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
    /*
     * NO TOP MARGIN — `PlayerProfileRegion`'s wrapper already supplies the ONE
     * `layer-gap` the hero→body boundary gets (code review 2026-08-07). Route
     * Composition rules `layer-gap` (64px) at that boundary and `section-gap`
     * (48px) within the layer; the wrapper and every section carried
     * `mt-layer-gap`, so the boundary rendered at 128px and each body gap at
     * 64px. Applied to `/players` and `/teams` in one edit so the two profile
     * routes keep an identical vertical rhythm.
     */
    <section id={PHYSICAL_SECTION_ID}>
      <h2 className="type-title text-ink-primary">{title}</h2>
      {/*
       * An UNNAMED <figure> grouping the chart with its data alternative. It
       * carries no role and no aria-label on purpose: `CategoryBarChart` is
       * already `role="img"` with the localized summary, and a named figure
       * around a named img gives the reader two competing accessible names
       * (`InvolvementChart`'s ruling).
       */}
      <figure className="mt-3 min-w-0">
        <div className="rounded-lg bg-surface-raised p-tile-gap">
          <CategoryBarChart
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

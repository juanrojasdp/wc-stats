"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { composeCompareFigureSummary } from "@/lib/compare-format";
import type { MatchBundle, PlayerProfile, TeamProfile } from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-provider";
import { formatLeaderboardValue } from "@/lib/leaderboard-format";
import { speedZoneLabelKey } from "@/lib/player-profile-format";
import type { TableColumn } from "@/lib/table-sort";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  COMPARE_CHARTS_SECTION_ID,
  compareBarChartHeightClass,
  matchChartModel,
  playerChartModel,
  teamChartModel,
} from "@/viz/compare-model";
import { distributionChartHeightClass } from "@/viz/phases-model";

/*
 * ═══════════ `/compare`'s VIZ SECTION (Story 2.17, AC 4; D5, D6, D13) ═══════
 *
 * ONE CHART PER ENTITY, ON IDENTICAL SCALES. `EXPERIENCE.md:78`: "each viz
 * rendered PER ENTITY with identical scales/axes so sides are comparable." Two
 * charts, never one chart with two series — and the shared domain, computed once
 * in `viz/compare-model.ts` over BOTH sides' values, is what makes them
 * comparable at all. Every `axisMax` below is that one number.
 *
 * 🔴 SIDE A IS `--viz-team-a`, SIDE B IS `--viz-team-b` + THE HATCH (ruled D5/D4).
 * NOT `--viz-single`: `globals.css:68` declares that alias as `var(--viz-team-a)`,
 * and its own safety argument — "safe because single-entity charts have no second
 * series" — fails the moment two single-entity charts sit side by side under one
 * comparison. `--viz-single` does not appear on this route.
 *
 * EXCEPT FOR `type=matches`, WHERE THE ACCENTS MEAN HOME AND AWAY (D5's
 * corollary). A match chart is inherently two-series and the home/away pair
 * already owns those two accents inside it, so side A/B identity is carried by
 * the header's accent top border and the sticky mini-header ONLY. That is
 * `DESIGN.md:260`'s "one color means one thing per visualization" held exactly,
 * and `DESIGN.md:338`'s "the accent border is the only entity color" held exactly.
 *
 * ═══════════ THE LAZY BOUNDARY IS `@/components/Charts` AND NOTHING ELSE ═════
 *
 * `next/dynamic` dedupes on the IMPORT SPECIFIER, so both handles below point at
 * the one barrel. A `dynamic()` call naming `@/components/CompareCharts` directly
 * would mint a fresh chunk group and a fresh ~370 kB recharts vendor copy — the
 * precise defect that barrel exists to remove. Only `import type` crosses into a
 * chart module from here; a VALUE import would re-link recharts onto the critical
 * path, which is Story 2.6 decision 21's measured defect.
 *
 * ═══════════ EVERY CAPTION AND TABLE NAME CARRIES ITS SIDE'S ENTITY ═════════
 *
 * Two figures render at once and they are the SAME figure of two different
 * entities, so a caption built from copy alone would be byte-identical twice on
 * one page — exactly what `i18n.test.ts`'s composed-caption inventory exists to
 * prevent, and what would make the route's single polite sort announcement unable
 * to say which table moved. The entity NAME is the disambiguator, prefixed to
 * both; it is artifact data, so it needs no key and translates nowhere (FR-30).
 */

/** Composition glyph, hoisted: a bare literal in JSX trips the i18n gate. */
const CAPTION_SEPARATOR = " — ";

function ChartFallback({ heightClass }: { heightClass: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      {/*
       * `aria-busy` AND an explicit height from the SAME pure function the chart
       * uses — the `skeleton` utility supplies no dimensions, so an unsized
       * fallback collapses to ~0 px and costs a CLS hit against the very budget
       * the code-split protects.
       */}
      <div aria-busy="true" className={cn("w-full rounded-md skeleton", heightClass)} />
    </div>
  );
}

const CompareBarChart = dynamic(
  () => import("@/components/Charts").then((module) => module.CompareBarChart),
  { ssr: false, loading: () => <ChartFallback heightClass={compareBarChartHeightClass(5)} /> }
);

const DistributionChart = dynamic(
  () => import("@/components/Charts").then((module) => module.DistributionChart),
  { ssr: false, loading: () => <ChartFallback heightClass={distributionChartHeightClass(4)} /> }
);

interface SideRef {
  id: string;
  name: string;
  detail: string | null;
  code: string | null;
}

type ComparePair =
  | { type: "players"; a: PlayerProfile; b: PlayerProfile }
  | { type: "teams"; a: TeamProfile; b: TeamProfile }
  | { type: "matches"; a: MatchBundle; b: MatchBundle };

/** One row of a chart's data-table alternative. `second` is null single-series. */
interface ChartTableRow {
  key: string;
  category: string;
  first: number;
  second: number | null;
}

type FigureRefs = RefObject<(HTMLElement | null)[]>;

/**
 * The `<md` sticky mini-header (UX-DR17, ruled D13).
 *
 * NET-NEW MACHINERY: `IntersectionObserver` was zero-occurrence in `app/src`
 * before this story, and no measurement for this header is given anywhere in the
 * UX docs. Every number is ruled here.
 *
 * · `sticky top-14 z-30`. `SiteHeader` is `sticky top-0 z-40` at `h-14`, so this
 *   nests UNDER it in both offset and stacking rather than competing with it.
 * · VISIBILITY IS CSS (`md:hidden`), NOT JS. `hidden` is `display: none`, which
 *   removes the element from the ACCESSIBILITY TREE — so exactly one header is
 *   exposed at any width and there are never two competing names. That is the
 *   reasoning `HeaderSearch.tsx:60-72` already ships.
 * · THE OBSERVER IS GATED on `useMediaQuery(MD_MEDIA_QUERY) === false`, so it does
 *   no work at `≥md`. `useMediaQuery` is permitted HERE, unlike in `HeaderSearch`:
 *   this region mounts only after the client fetch resolves, so its first render
 *   IS a client render and there is no server markup for a breakpoint branch to
 *   mismatch (the `TacticalLayer.tsx:47-56` precedent, stated in place).
 * · THE CHANGE IS ANNOUNCED POLITELY AND FOCUS IS NEVER MOVED — moving focus on
 *   scroll would fight the reader's own gesture.
 *
 * ⚠️ VERIFY IT LIVE. `deferred-work.md:1134-1152` records twenty-two sticky
 * headers that shipped green and SILENTLY DID NOT STICK: a sticky child of a
 * non-scrolling ancestor never offsets. `getComputedStyle(el).position` is
 * asserted in the browser pass, not in a test.
 */
function StickyMiniHeader({ names, activeIndex }: { names: readonly string[]; activeIndex: number }) {
  const t = useT();
  const current = names[activeIndex] ?? names[0] ?? "";
  return (
    <div
      /*
       * `data-compare-showing` pairs with `data-compare-side` on the figures and
       * exists for the BROWSER PASS, which is this component's only verification:
       * the observer cannot be unit-tested (no global jsdom, and jsdom implements
       * no `IntersectionObserver`), so the one way to check that it tracks the
       * right figure is to read the decision off the DOM while scrolling.
       * `deferred-work.md:1134-1152` is the standing lesson — twenty-two sticky
       * headers shipped green and silently did not stick.
       */
      data-compare-showing={activeIndex}
      className="sticky top-14 z-30 mb-tile-gap bg-surface-base py-2 md:hidden"
    >
      <p className="type-label-caps text-ink-secondary">{t("compare.miniHeader.showing")}</p>
      <p className="type-body text-ink-primary">{current}</p>
      {/* Its own polite region, so the static "En pantalla" label is not re-read
          every time the name behind it changes. */}
      <span aria-live="polite" className="sr-only">
        {current}
      </span>
    </div>
  );
}

/**
 * One side's figure: the chart, its data-table alternative, and nothing else.
 *
 * `max-md:scroll-mt-28` IS THE `scroll-padding-top` HALF OF D13. `globals.css`
 * already sets `scroll-padding-top: 4.5rem` (72 px) on the scroll container,
 * which clears the 56 px site header — but NOT that header PLUS this route's
 * ~48 px mini-header. 112 px does, and it is scoped to `<md` because that is the
 * only width the mini-header exists at. A LOCAL `scroll-mt` rather than a global
 * change: `scroll-padding-top` is one value for the whole document and five other
 * routes depend on the shipped one.
 */
function CompareFigure({
  side,
  entityName,
  children,
  tableCaption,
  tableName,
  columns,
  rows,
  nodeRef,
}: {
  side: "a" | "b";
  entityName: string;
  children: ReactNode;
  tableCaption: string;
  tableName: string;
  columns: TableColumn<ChartTableRow>[];
  rows: ChartTableRow[];
  nodeRef: (node: HTMLElement | null) => void;
}) {
  return (
    <div ref={nodeRef} className="min-w-0 max-md:scroll-mt-28" data-compare-side={side}>
      {/* Unnamed <figure>: the chart inside is already role="img" with its own
          summary, and a named figure around a named img would give the reader
          two competing accessible names. */}
      <figure className="min-w-0">
        <p className="type-stat-label text-ink-secondary">{entityName}</p>
        <div className="mt-1 rounded-lg bg-surface-raised p-tile-gap">{children}</div>
        <div className="mt-tile-gap">
          {/*
           * `surface="canvas"` ON EVERY USE. The default `"pitch"` keeps
           * `text-ink-on-pitch`, a theme-invariant near-white that computes
           * 1.10:1 on a `--surface-raised` card — an invisible control.
           */}
          <ViewDataDisclosure panelTitle={entityName} surface="canvas">
            {/*
             * `DataTable` renders NO scroll container and must not; the caller
             * supplies the width-bounded scrollport, and `min-w-0` on the
             * ancestor is what stops the PAGE scrolling sideways instead (2.13
             * shipped a WCAG 1.4.10 failure from exactly this).
             */}
            <div className="w-full min-w-0 overflow-x-auto">
              <DataTable
                caption={tableCaption}
                columns={columns}
                rows={rows}
                surface="canvas"
                tableName={tableName}
              />
            </div>
          </ViewDataDisclosure>
        </div>
      </figure>
    </div>
  );
}

export function CompareChartsSection({
  pair,
  refA,
  refB,
  locale,
}: {
  pair: ComparePair;
  refA: SideRef;
  refB: SideRef;
  locale: "es" | "en";
}) {
  const t = useT();

  const isNarrow = useMediaQuery(MD_MEDIA_QUERY) === false;
  const [activeIndex, setActiveIndex] = useState(0);
  const figureRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!isNarrow || typeof IntersectionObserver !== "function") {
      return;
    }
    const nodes = figureRefs.current.filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) {
      return;
    }
    /*
     * TOPMOST STILL-INTERSECTING WINS, decided over a PERSISTENT visibility map
     * rather than over the callback's `entries`.
     *
     * 🔴 THE `entries` ARGUMENT IS ONLY WHAT CHANGED, AND READING IT ALONE IS THE
     * BUG THIS SHAPE EXISTS TO AVOID (found in the browser, not in a test — the
     * header stuck correctly and simply never renamed itself). A scroll that
     * moves figure B across a threshold delivers ONE entry, for B; a decision
     * made from that call can only ever see B, so whichever figure last happened
     * to cross a threshold won, regardless of what was actually on screen. The
     * `Set` below remembers every figure's current state across callbacks, so the
     * decision is always made over BOTH.
     *
     * `rootMargin`'s top inset is the two sticky headers together (56 + 48 px),
     * so a figure scrolled BEHIND them stops counting as on screen — which is the
     * whole question the mini-header answers. Given that, "topmost of what
     * remains" is the figure the reader's eye is on, and it is deterministic:
     * `intersectionRatio` ties whenever both figures are fully visible at once,
     * which at 390 px they are at the bottom of the page.
     */
    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visible.add(node);
          } else {
            visible.delete(node);
          }
        }
        let best = -1;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const node of visible) {
          const top = node.getBoundingClientRect().top;
          const index = nodes.indexOf(node);
          if (index >= 0 && top < bestTop) {
            best = index;
            bestTop = top;
          }
        }
        if (best >= 0) {
          setActiveIndex(best);
        }
      },
      { rootMargin: "-104px 0px 0px 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    for (const node of nodes) {
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
    };
  }, [isNarrow, pair]);

  let figures: ReactNode;
  if (pair.type === "players") {
    figures = (
      <PlayerFigures
        model={playerChartModel(pair.a, pair.b)}
        refA={refA}
        refB={refB}
        locale={locale}
        figureRefs={figureRefs}
      />
    );
  } else if (pair.type === "teams") {
    figures = (
      <TeamFigures
        model={teamChartModel(pair.a, pair.b)}
        refA={refA}
        refB={refB}
        locale={locale}
        figureRefs={figureRefs}
      />
    );
  } else {
    figures = (
      <MatchFigures
        model={matchChartModel(pair.a, pair.b)}
        bundleA={pair.a}
        bundleB={pair.b}
        refA={refA}
        refB={refB}
        locale={locale}
        figureRefs={figureRefs}
      />
    );
  }

  return (
    <section id={COMPARE_CHARTS_SECTION_ID} className="mt-section-gap">
      <h2 className="type-title text-ink-primary">{t("compare.section.charts")}</h2>
      <StickyMiniHeader names={[refA.name, refB.name]} activeIndex={activeIndex} />
      {/*
       * TWO COLUMNS AT `≥md`, STACKED BELOW IT (AC 4). The `md`→`lg` band is
       * unspecified in the UX docs — `EXPERIENCE.md:125-134`'s responsive table
       * has only `≥lg` and `<md` columns — and it is RULED HERE that the
       * two-column layout begins at `md`, with the stacked treatment and the
       * sticky mini-header applying below it. One threshold, not two, which is
       * where every other breakpoint decision in this app sits.
       */}
      <div className="mt-tile-gap grid gap-tile-gap md:grid-cols-2">{figures}</div>
    </section>
  );
}

/* --------------------------- The three figure sets ------------------------- */

/** The two columns every single-series alternative table carries. */
function singleSeriesColumns(
  categoryHead: string,
  valueHead: string,
  format: (value: number) => string
): TableColumn<ChartTableRow>[] {
  return [
    {
      key: "category",
      headText: categoryHead,
      headTitle: null,
      render: (row) => row.category,
      align: "text",
      rowHeader: true,
      sort: { kind: "text", valueOf: (row) => row.category },
    },
    {
      key: "value",
      headText: valueHead,
      headTitle: null,
      render: (row) => format(row.first),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.first },
    },
  ];
}

/**
 * `type=players` — the five speed bands, one chart per player.
 *
 * METRES, ZERO-BASED, ON A DOMAIN SPANNING BOTH PLAYERS. The physical block is
 * the one part of a player profile that is a flat category set of a single unit,
 * which is what a shared axis needs; the eighteen aggregates span four unit
 * families and belong in the mirrored rows above, where each row carries its own.
 */
function PlayerFigures({
  model,
  refA,
  refB,
  locale,
  figureRefs,
}: {
  model: ReturnType<typeof playerChartModel>;
  refA: SideRef;
  refB: SideRef;
  locale: "es" | "en";
  figureRefs: FigureRefs;
}) {
  const t = useT();
  const title = t("player.sections.physical.title");
  const unitLabel = t("enums.unit.m");
  const format = (value: number): string => formatLeaderboardValue(value, "integer", locale);
  const categories = model.zones.map((zone) => t(speedZoneLabelKey(zone)));
  const categoryHead = t("player.column.speedZone");
  const valueHead = t("player.column.value");

  return (
    <>
      {[
        { side: "a" as const, ref: refA, values: model.a },
        { side: "b" as const, ref: refB, values: model.b },
      ].map((entry, index) => (
        <CompareFigure
          key={entry.ref.id}
          side={entry.side}
          entityName={entry.ref.name}
          tableCaption={`${entry.ref.name}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
            "player.caption.physical"
          )}`}
          tableName={`${entry.ref.name}${CAPTION_SEPARATOR}${t("player.tableName.physical")}`}
          columns={singleSeriesColumns(categoryHead, valueHead, format)}
          rows={categories.map((category, position) => ({
            key: `${entry.side}-${position}`,
            category,
            first: entry.values[position] ?? 0,
            second: null,
          }))}
          nodeRef={(node) => {
            figureRefs.current[index] = node;
          }}
        >
          <CompareBarChart
            points={categories.map((label, position) => ({
              label,
              value: entry.values[position] ?? 0,
            }))}
            ticks={model.axis.ticks}
            /* THE SHARED MAXIMUM — identical on both sides, which is the whole
               reason the model computes it over both. */
            axisMax={model.axis.max}
            formatValue={format}
            axisValueLabel={unitLabel}
            axisCategoryLabel={categoryHead}
            figureSummary={composeCompareFigureSummary({
              title,
              entityName: entry.ref.name,
              unitLabel,
            })}
            heightClass={compareBarChartHeightClass(5)}
            colorVar={entry.side === "a" ? "--viz-team-a" : "--viz-team-b"}
            hatch={entry.side === "b"}
            seriesCode={entry.ref.code ?? entry.ref.name}
          />
        </CompareFigure>
      ))}
    </>
  );
}

/**
 * `type=teams` — the eight in-possession phase rates, one chart per team.
 *
 * THE RATES DO NOT SUM TO 100 and nothing here stacks them: corpus in-possession
 * sums run 84-149. `viz.phases.note` is the sentence that says so and it is
 * reused verbatim rather than restated.
 */
function TeamFigures({
  model,
  refA,
  refB,
  locale,
  figureRefs,
}: {
  model: ReturnType<typeof teamChartModel>;
  refA: SideRef;
  refB: SideRef;
  locale: "es" | "en";
  figureRefs: FigureRefs;
}) {
  const t = useT();
  const title = t("viz.phases.inPossession");
  const format = (value: number): string => formatLeaderboardValue(value, "percent", locale);
  const categories = model.phaseLabelKeys.map((key) => t(key));
  const categoryHead = t("viz.phases.axisPhase");
  const valueHead = t("viz.phases.axisRate");

  return (
    <>
      {[
        { side: "a" as const, ref: refA, values: model.a },
        { side: "b" as const, ref: refB, values: model.b },
      ].map((entry, index) => (
        <CompareFigure
          key={entry.ref.id}
          side={entry.side}
          entityName={entry.ref.name}
          tableCaption={`${entry.ref.name}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
            "viz.phases.tableCaption"
          )}`}
          tableName={`${entry.ref.name}${CAPTION_SEPARATOR}${t("team.tableName.inPossession")}`}
          columns={singleSeriesColumns(categoryHead, valueHead, format)}
          rows={categories.map((category, position) => ({
            key: `${entry.side}-${position}`,
            category,
            first: entry.values[position] ?? 0,
            second: null,
          }))}
          nodeRef={(node) => {
            figureRefs.current[index] = node;
          }}
        >
          <CompareBarChart
            points={categories.map((label, position) => ({
              label,
              value: entry.values[position] ?? 0,
            }))}
            ticks={model.axis.ticks}
            axisMax={model.axis.max}
            formatValue={format}
            axisValueLabel={valueHead}
            axisCategoryLabel={categoryHead}
            figureSummary={composeCompareFigureSummary({
              title,
              entityName: entry.ref.name,
              unitLabel: null,
            })}
            heightClass={compareBarChartHeightClass(8)}
            colorVar={entry.side === "a" ? "--viz-team-a" : "--viz-team-b"}
            hatch={entry.side === "b"}
            seriesCode={entry.ref.code ?? entry.ref.name}
          />
        </CompareFigure>
      ))}
    </>
  );
}

/**
 * `type=matches` — each side is a whole match, drawn as its OWN two-team
 * distribution (R1, option A).
 *
 * 🔴 THE SHIPPED `DistributionChart`, NOT A NEW ONE. This is the surface the
 * ledger's `seriesLabelIndex` owner line was waiting for — "the first successor
 * story to reuse `DistributionChart`" — and the reuse is total: the two accents,
 * the hatch, the direct series labels and the wrapped category ticks all arrive
 * with it. Only the SHARED AXIS is this route's contribution, and it spans ALL
 * FOUR series so the two blocks are readable against each other.
 */
function MatchFigures({
  model,
  bundleA,
  bundleB,
  refA,
  refB,
  locale,
  figureRefs,
}: {
  model: ReturnType<typeof matchChartModel>;
  bundleA: MatchBundle;
  bundleB: MatchBundle;
  refA: SideRef;
  refB: SideRef;
  locale: "es" | "en";
  figureRefs: FigureRefs;
}) {
  const t = useT();
  const title = t("tactical.sections.key-stats.title");
  const format = (value: number): string => formatLeaderboardValue(value, "integer", locale);
  const categories = model.fields.map((field) => t(`enums.metric.${field}` as DictionaryKey));
  const categoryHead = t("player.column.metric");
  const valueHead = t("player.column.value");

  const sides = [
    { side: "a" as const, ref: refA, bundle: bundleA, home: model.aHome, away: model.aAway },
    { side: "b" as const, ref: refB, bundle: bundleB, home: model.bHome, away: model.bAway },
  ];

  return (
    <>
      {sides.map((entry, index) => {
        const homeTeam = entry.bundle.metadata.homeTeam;
        const awayTeam = entry.bundle.metadata.awayTeam;
        return (
          <CompareFigure
            key={entry.ref.id}
            side={entry.side}
            entityName={entry.ref.name}
            tableCaption={`${entry.ref.name}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
              "player.caption.aggregates"
            )}`}
            tableName={`${entry.ref.name}${CAPTION_SEPARATOR}${title}`}
            columns={[
              {
                key: "category",
                headText: categoryHead,
                headTitle: null,
                render: (row) => row.category,
                align: "text",
                rowHeader: true,
                sort: { kind: "text", valueOf: (row) => row.category },
              },
              {
                /* The team CODE heads the column and the full name rides
                   `headTitle` — UX-DR17's rule for every ruled abbreviation. */
                key: "home",
                headText: homeTeam.teamCode,
                headTitle: homeTeam.name,
                render: (row) => format(row.first),
                align: "numeric",
                sort: { kind: "number", valueOf: (row) => row.first },
              },
              {
                key: "away",
                headText: awayTeam.teamCode,
                headTitle: awayTeam.name,
                render: (row) => format(row.second ?? 0),
                align: "numeric",
                sort: { kind: "number", valueOf: (row) => row.second },
              },
            ]}
            rows={categories.map((category, position) => ({
              key: `${entry.side}-${position}`,
              category,
              first: entry.home[position] ?? 0,
              second: entry.away[position] ?? 0,
            }))}
            nodeRef={(node) => {
              figureRefs.current[index] = node;
            }}
          >
            <DistributionChart
              categoryLabels={categories}
              home={{ teamCode: homeTeam.teamCode, values: entry.home }}
              away={{ teamCode: awayTeam.teamCode, values: entry.away }}
              ticks={model.axis.ticks}
              axisMax={model.axis.max}
              axisValueLabel={valueHead}
              axisCategoryLabel={categoryHead}
              formatValue={format}
              figureSummary={composeCompareFigureSummary({
                title,
                entityName: entry.ref.name,
                unitLabel: null,
              })}
              heightClass={distributionChartHeightClass(4)}
            />
          </CompareFigure>
        );
      })}
    </>
  );
}

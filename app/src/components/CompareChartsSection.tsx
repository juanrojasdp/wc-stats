"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import {
  composeCompareFigureSummary,
  composeSideHeading,
  displayTeamCode,
} from "@/lib/compare-format";
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

/**
 * The two category counts this route mounts the compare bar at: five speed zones
 * for `type=players`, eight in-possession phases for `type=teams`.
 *
 * Named constants because each count is used TWICE — once for the lazy
 * boundary's fallback height and once for the chart's own — and the shipped code
 * hard-coded them separately.
 */
const PLAYER_ZONE_COUNT = 5;
const TEAM_PHASE_COUNT = 8;

/**
 * 🔴 ONE LAZY HANDLE PER MOUNTED HEIGHT, because `next/dynamic`'s `loading` takes
 * NO PROPS (code review 2026-08-07).
 *
 * The shipped code declared a single handle whose fallback was pinned to
 * `compareBarChartHeightClass(5)` — correct for `PlayerFigures`, 106 px short for
 * `TeamFigures`, which mounts at `(8)`. Every `type=teams` comparison therefore
 * jumped ~110 px per chart, TWICE, the instant the chunk resolved: the exact CLS
 * defect the "fallback and chart call the same height function" rule exists to
 * prevent, reintroduced by the one call site that could not pass an argument.
 *
 * BOTH HANDLES POINT AT THE SAME IMPORT SPECIFIER, so `next/dynamic` still
 * dedupes them into ONE async chunk group and the export keeps exactly one
 * recharts vendor copy — the property `Charts.tsx` exists to hold and
 * `static-output.test.ts` counts. Two handles cost two module-scope objects and
 * nothing at the network layer; `PhasesSection` already ships five for the same
 * reason.
 */
function lazyCompareBarChart(categoryCount: 5 | 8) {
  return dynamic(() => import("@/components/Charts").then((module) => module.CompareBarChart), {
    ssr: false,
    loading: () => <ChartFallback heightClass={compareBarChartHeightClass(categoryCount)} />,
  });
}

const PlayerCompareBarChart = lazyCompareBarChart(PLAYER_ZONE_COUNT);
const TeamCompareBarChart = lazyCompareBarChart(TEAM_PHASE_COUNT);

const DistributionChart = dynamic(
  () => import("@/components/Charts").then((module) => module.DistributionChart),
  { ssr: false, loading: () => <ChartFallback heightClass={distributionChartHeightClass(4)} /> }
);

/*
 * ═══ A23 / L4089: TWO ENTITIES WITH ONE DISPLAY NAME ═══ Story 2.19 Task 6.12.
 *
 * CONFIRMED REACHABLE AT REAL DATA. The 1,248-name corpus carries `Emiliano
 * MARTINEZ` TWICE - `martinez-emiliano-arg` (Argentina, gk) and
 * `martinez-emiliano-uru` (Uruguay, mf). Comparing the two produced SIX
 * byte-identical captions and TWO byte-identical figure headings on one route:
 * a screen reader listing this page's tables heard the same name six times and
 * could not tell which side it was on, and the distinct ids that make the URL
 * unambiguous are nowhere in the accessible names.
 *
 * The disambiguator is the side's `detail` line, which for a player IS the team
 * name - `search-model.ts:52` already documents this exact pair as the reason
 * `detail` exists at all. Reusing `composeSideHeading` rather than minting a
 * second composition keeps the caption identity and the side's own <h2>
 * agreeing, which is what a reader cross-referencing them needs.
 *
 * DISTINCT IDS ARE STILL NOT DISTINCT NAMES: this makes the NAMES distinct,
 * which is the thing the caption inventory is about. Where an entity genuinely
 * has no detail (`null`), `composeSideHeading` returns the bare name and nothing
 * is claimed that is not known.
 */
function sideIdentity(ref: SideRef): string {
  return composeSideHeading(ref.name, ref.detail);
}

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
 * · `sticky top-[var(--header-h)] z-30`. `SiteHeader` is `sticky top-0 z-40`,
 *   so this nests UNDER it in both offset and stacking rather than competing.
 *
 *   ✅ FIXED IN STORY 3.10 (D9) — IT WAS `top-14`, AND THAT LITERAL WAS THE
 *   DEFECT. 56 px stopped matching the site header when the authorship caption
 *   landed (62 px one row, 118 px wrapped), and this mini-header was the
 *   worst-affected of the seven consumers: measured at 320 px it sat at top:56
 *   and was ~54 px tall, so 56+54=110 < 118 and it was ENTIRELY BEHIND the site
 *   header — invisible on exactly the `<md` widths it is the ruled D13 /
 *   UX-DR17 affordance FOR.
 *
 *   `--header-h` is declared on `html` and switched by breakpoint, so this
 *   offset now tracks the bar and cannot drift from it again. Re-measured after
 *   the nav landed (headless Chromium, built export): the header is ONE ROW at
 *   62 px at BOTH 320 and 390 in both locales — UX-DR24 replaced three row
 *   elements with one trigger and took the wrap threshold from ~341/337 down to
 *   215/211 — so this bar clears it with room at every shipped width, and the
 *   118 px case survives only below ~215 px, where the token follows it.
 *
 *   The old comment recorded an unreconciled 341-vs-337 disagreement between
 *   the caption spec and commit d3c103c. It is MOOT rather than resolved: both
 *   numbers described the pre-nav four-element row, which no longer exists.
 *   Do not re-derive these offsets from 56, and re-measure this bar rather than
 *   trusting the "~48 px" the scroll-mt figure was built on — the ledger
 *   measured 54. Added by the 2026-08-26 code review, which found this file
 *   carrying stale numbers and no breadcrumb while `globals.css` and
 *   `SiteHeader.tsx` both carried warnings.
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
/**
 * The two sticky bars' combined height, in CSS px, READ FROM THE STYLESHEET.
 *
 * 🔴 NOT A LITERAL (Story 3.10 D9). This was `-104px`, meaning "56 header + 48
 * mini" — both halves hardcoded, and the first half wrong at every width where
 * the header wraps. An IntersectionObserver inset that under-states the bars
 * counts a figure as on-screen while it is hidden behind them, which is the one
 * question the mini-header exists to answer.
 *
 * `--header-h` is declared on `html` and switched by breakpoint, so reading it
 * from the computed style gets the value that is ACTUALLY in force at this
 * width — the same number `scroll-padding-top` and this bar's `top` are using.
 * Falls back to the wrapped height, which is the SAFE direction: over-stating
 * the inset makes a figure stop counting slightly early, while under-stating it
 * reports a figure the reader cannot see.
 */
function stickyInsetPx(): number {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return read("--header-h", 118) + read("--spacing-compare-mini-h", 48);
}

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
      /*
       * `top-[var(--header-h)]`, NOT `top-14` (Story 3.10 D9). The literal
       * 56 px stopped matching the site header when the authorship caption
       * landed, and this bar was the worst-affected consumer: at 320 px it sat
       * at top:56 and was ~54 px tall, so 56+54=110 < the 118 px bar and it was
       * ENTIRELY behind the header — invisible on exactly the `<md` widths it is
       * the ruled D13 / UX-DR17 affordance FOR. The token tracks the bar now, so
       * this offset cannot drift from it again.
       */
      className="sticky top-[var(--header-h)] z-30 mb-tile-gap bg-surface-base py-2 md:hidden"
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
 * THE `scroll-mt` IS THE `scroll-padding-top` HALF OF D13, AND IT IS DERIVED NOW.
 * `globals.css` sets `scroll-padding-top: calc(var(--header-h) + clearance)`,
 * which clears the site header at every width — but NOT that header PLUS this
 * route's mini-header. So this adds the mini-header's own token on top, scoped
 * to `<md` because that is the only width the mini-header exists at. A LOCAL
 * `scroll-mt` rather than a global change: `scroll-padding-top` is one value for
 * the whole document and five other routes depend on it.
 *
 * It was `scroll-mt-28` — 112 px, meaning "56 header + 48 mini", with the first
 * half wrong at every width the header wrapped. Both halves are tokens now.
 *
 * ⚠️ BOTH HALVES OF THAT ARITHMETIC ARE NOW STALE (2026-08-26 code review). The
 * site header is 62 px one-row and 118 px wrapped since the authorship caption,
 * and the "~48 px" mini-header above was measured at 54. So 112 needs to be 116
 * at one row and 172 wrapped, and neither figure should be re-derived from the
 * old constants. The fix is the `--header-h` property filed in
 * `deferred-work.md` and owned by story 3-10; see the docblock at the top of
 * this file for the full measurement.
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
    /*
     * `scroll-mt` is the `scroll-padding-top` half of D13, and it must clear
     * BOTH sticky bars: the site header (`--header-h`) and this mini-header on
     * top of it. `28` was 112 px against a 56 px header — a literal that is
     * wrong at every width the header wraps. Derived now, from the same token.
     */
    <div
      ref={nodeRef}
      className="min-w-0 max-md:scroll-mt-[calc(var(--header-h)+var(--spacing-compare-mini-h))]"
      data-compare-side={side}
    >
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
      { rootMargin: `-${stickyInsetPx()}px 0px 0px 0px`, threshold: [0, 0.25, 0.5, 0.75, 1] }
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
      {/*
        A23 again, and this is the pair the mini-header exists FOR: with
        `Emiliano MARTINEZ` on both sides the header renamed itself between two
        byte-identical strings, so the one control that says WHICH side you are
        looking at said nothing. `sideIdentity` appends the disambiguating
        detail line — the same identity the captions and the side headings
        carry, so the three agree.
      */}
      <StickyMiniHeader
        names={[sideIdentity(refA), sideIdentity(refB)]}
        activeIndex={activeIndex}
      />
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
          entityName={sideIdentity(entry.ref)}
          tableCaption={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
            "player.caption.physical"
          )}`}
          tableName={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${t("player.tableName.physical")}`}
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
          <PlayerCompareBarChart
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
              entityName: sideIdentity(entry.ref),
              unitLabel,
            })}
            heightClass={compareBarChartHeightClass(PLAYER_ZONE_COUNT)}
            colorVar={entry.side === "a" ? "--viz-team-a" : "--viz-team-b"}
            hatch={entry.side === "b"}
            seriesCode={entry.ref.code}
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
          entityName={sideIdentity(entry.ref)}
          tableCaption={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
            "viz.phases.tableCaption"
          )}`}
          tableName={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${t("team.tableName.inPossession")}`}
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
          <TeamCompareBarChart
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
              entityName: sideIdentity(entry.ref),
              unitLabel: null,
            })}
            heightClass={compareBarChartHeightClass(TEAM_PHASE_COUNT)}
            colorVar={entry.side === "a" ? "--viz-team-a" : "--viz-team-b"}
            hatch={entry.side === "b"}
            seriesCode={entry.ref.code}
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
            entityName={sideIdentity(entry.ref)}
            tableCaption={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${title}${CAPTION_SEPARATOR}${t(
              "player.caption.aggregates"
            )}`}
            tableName={`${sideIdentity(entry.ref)}${CAPTION_SEPARATOR}${title}`}
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
                headText: displayTeamCode(homeTeam.teamCode),
                headTitle: homeTeam.name,
                render: (row) => format(row.first),
                align: "numeric",
                sort: { kind: "number", valueOf: (row) => row.first },
              },
              {
                key: "away",
                headText: displayTeamCode(awayTeam.teamCode),
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
              home={{ teamCode: displayTeamCode(homeTeam.teamCode), values: entry.home }}
              away={{ teamCode: displayTeamCode(awayTeam.teamCode), values: entry.away }}
              ticks={model.axis.ticks}
              axisMax={model.axis.max}
              axisValueLabel={valueHead}
              axisCategoryLabel={categoryHead}
              formatValue={format}
              figureSummary={composeCompareFigureSummary({
                title,
                entityName: sideIdentity(entry.ref),
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

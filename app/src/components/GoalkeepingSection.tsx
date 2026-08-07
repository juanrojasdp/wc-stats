"use client";

import dynamic from "next/dynamic";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { Goalkeeping } from "@/lib/contract/contract-types";
import { formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  INVOLVEMENT_CHART_HEIGHT_CLASS,
  aerialTableRows,
  bodyTypeTableRows,
  countAxisMax,
  countTicks,
  distributionTableRows,
  goalkeepingByTeam,
  involvementPeak,
  involvementSummaryRows,
  involvementTicks,
  involvementTimelineRows,
  preventionHeadlineRows,
  type CompletionRow,
  type CountRow,
  type GatedRows,
  type GoalkeeperBlock,
  type GoalkeepingTeamBlock,
  type InvolvementSummaryRow,
  type InvolvementTimelineRow,
  type KeeperBreakdownRow,
  type PreventionHeadlineRow,
} from "@/viz/goalkeeping-model";

/*
 * The #goalkeeping content (Story 2.10, Task 7.4).
 *
 * ONE BLOCK PER TEAM, NOT PER GOALKEEPER (ruled decision 2, overturning the
 * epic's "each goalkeeper's ..." clause). Story 1.9 verified over 104 reports /
 * 936 goalkeeping pages that all four page families are titled {team}, that NO
 * KEEPER NAME APPEARS ON ANY OF THEM, and that 7 of 208 team-innings used two
 * keepers while still printing one team-level block each. The keeper names ride
 * as CONTEXT.
 *
 * Where a team has two records, BOTH render, stacked and each labelled by its
 * keeper — never summed. AD-5 forbids the App summing, and adding two keepers'
 * save percentages would be arithmetic nonsense.
 *
 * FIVE PANELS ARE PRESENCE-GATED (ruled decision 3): feet/hands/throw
 * techniques, intervention body type, and the completed half of the
 * crosses-faced pair are null on 208/208 corpus team-innings and populated on
 * 6/6 fixture keepers. A closed gate OMITS its panel entirely — never a row of
 * em dashes — and the block says ONCE that it did, because silent absence at
 * panel granularity is the one thing FR-22 forbids. The section a dev builds is
 * NOT the section that ships at the 2.19 cutover, and nothing else on screen
 * would explain the difference.
 */

function ChartFallback() {
  return (
    <div className="rounded-lg bg-surface-raised p-tile-gap">
      <div
        aria-busy="true"
        className={cn("w-full rounded-md skeleton", INVOLVEMENT_CHART_HEIGHT_CLASS)}
      />
    </div>
  );
}

/*
 * TacticalCharts has no default export, so the named export is selected in the
 * import promise. Only the TYPE crosses back the other way — a value import
 * would re-link recharts onto the critical path.
 */
/*
 * `@/components/Charts`, the ONE lazy boundary (Story 2.15 ruled D1) — never
 * `@/components/TacticalCharts` directly. `next/dynamic` mints one async chunk
 * group per distinct import specifier, and a second specifier means a second
 * ~300 kB recharts vendor copy. The `loading` fallback and `ssr: false` are
 * unchanged.
 */
const InvolvementChart = dynamic(
  () => import("@/components/Charts").then((module) => module.InvolvementChart),
  { ssr: false, loading: () => <ChartFallback /> }
);

const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";
const NAME_SEPARATOR = ", ";
const DENOMINATOR_SPACE = " ";

const ACCENT_CLASS = { a: "text-viz-team-a", b: "text-viz-team-b" } as const;

interface SideRef {
  teamId: string;
  teamCode: string;
  name: string;
}

export interface GoalkeepingSectionProps {
  goalkeeping: Goalkeeping;
  home: SideRef;
  away: SideRef;
}

/** The goal-prevention breakdown, flattened per keeper for its own table. */
interface PreventionTableRow {
  key: string;
  teamCode: string;
  playerName: string;
  labelKey: DictionaryKey;
  count: number;
}

export function GoalkeepingSection({ goalkeeping, home, away }: GoalkeepingSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("tactical.sections.goalkeeping.title");

  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * Eager, outside the disclosure (ruled decision 18): a stray teamId names
   * itself on load, and there is exactly ONE error boundary for all eleven
   * Tactical sections.
   */
  const grouping = goalkeepingByTeam(goalkeeping, home, away);

  const denominatorPrefix = t("viz.goalkeeping.denominatorPrefix");

  /* -------------------------------- Panels ---------------------------------- */

  function valueList(rows: { key: string; labelKey: DictionaryKey; count: number }[]) {
    return (
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <dt className="type-caption text-ink-secondary">{t(row.labelKey)}</dt>
            <dd className="type-caption tabular-nums text-ink-primary">
              {formatInteger(row.count, locale)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  function completionList(rows: CompletionRow[]) {
    const totalLabel = t("viz.table.total");
    const completeLabel = t("viz.table.complete");
    const incompleteLabel = t("viz.table.incomplete");
    return (
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <dt className="type-caption text-ink-secondary">{t(row.labelKey)}</dt>
            <dd className="type-caption tabular-nums text-ink-primary">
              {/*
               * THE TOTAL IS LABELLED TOO. It previously led the line as a bare
               * figure while both its siblings carried labels, so it read as a
               * number of unstated meaning sitting next to two explained ones.
               * `viz.table.total` already exists and is used as a column head
               * for exactly this quantity.
               */}
              {totalLabel}
              {DENOMINATOR_SPACE}
              {formatInteger(row.total, locale)}
              {VALUE_SEPARATOR}
              {completeLabel}
              {DENOMINATOR_SPACE}
              {formatInteger(row.complete, locale)}
              {VALUE_SEPARATOR}
              {incompleteLabel}
              {DENOMINATOR_SPACE}
              {formatInteger(row.incomplete, locale)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  /**
   * A GATED panel: rendered only when its data is non-null, OMITTED ENTIRELY
   * when it is absent. Never a row of em dashes.
   */
  function gatedPanel(gate: GatedRows, groupLabel: string) {
    if (!gate.present) {
      return null;
    }
    return (
      <div className="mt-2">
        <span className="type-stat-label text-ink-secondary">{groupLabel}</span>
        {valueList(gate.rows as { key: string; labelKey: DictionaryKey; count: number }[])}
      </div>
    );
  }

  /** A labelled breakdown that states ITS OWN denominator (decision 13). */
  function denominatorLabel(groupLabel: string, denominator: number): string {
    return `${groupLabel}${DENOMINATOR_SPACE}${denominatorPrefix}${DENOMINATOR_SPACE}${formatInteger(
      denominator,
      locale
    )}`;
  }

  function keeperPanels(keeper: GoalkeeperBlock, accent: "a" | "b", teamName: string) {
    const prevention = keeper.goalPrevention;
    const aerial = keeper.aerial;
    const points = keeper.involvement;
    const peak = involvementPeak(points);

    const involvementPhrase = countPhrase(
      keeper.totalInvolvements,
      "viz.goalkeeping.involvementsOne",
      "viz.goalkeeping.involvementsMany"
    );
    /*
     * THE CHART'S OWN NAME CARRIES NO TOTAL (ruled decision 14, verbatim: "No
     * copy, caption, `figureSummary` or table footer may state or imply that the
     * timeline adds up to it").
     *
     * `involvementPhrase` used to sit in this string, which is the accessible
     * name of the element wrapping the timeline — so a screen-reader user was
     * told the chart IS "47 participaciones" while the plotted slots run 0..5
     * short on real data (exactly 0 on only 59 of 208 team-innings, and exact on
     * all six fixture keepers, so the gap is invisible in dev). The headline
     * below still prints the total verbatim, which is what decision 14 requires;
     * what it forbids is attaching that number to the chart.
     */
    const chartSummary =
      `${t("viz.goalkeeping.figurePrefix")} ${keeper.playerName}${CLAUSE_SEPARATOR}` +
      `${teamName}${CLAUSE_SEPARATOR}${t("viz.goalkeeping.involvementAxisNote")}`;

    function formatSlot(index: number): string {
      const point = points[index];
      return point === undefined ? "" : formatInteger(point.minute, locale);
    }
    function formatCount(value: number): string {
      return formatInteger(value, locale);
    }

    return (
      <div key={keeper.key} className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {/* The keeper name is CONTEXT, and plain text — never a link:
              /players/{slug} does not exist, so a link 404s in the static
              export. UX-DR22's cross-link rule is scoped to lineup names. */}
          <span className="type-caption text-ink-primary">{keeper.playerName}</span>
          {/*
           * `totalInvolvements` PRINTED VERBATIM (ruled decision 14). Measured
           * over 208 team-innings, totalInvolvements − Σ(timeline) runs 0..5
           * and is exactly 0 on only 59 — while all six fixture keepers sum
           * precisely. No copy here or in the tables states or implies that the
           * chart below adds up to this number, and the timeline is NEVER
           * summed (AD-5 forbids it independently).
           */}
          <span className="type-caption tabular-nums text-ink-secondary">
            {involvementPhrase}
          </span>
        </div>

        {points.length === 0 ? (
          /*
           * THIS KEEPER HAS NO PLOTTED SLOTS — which is NOT "the match listed no
           * goalkeeper". `viz.goalkeeping.zeroAll` ("El informe no lista arqueros
           * para este partido.") used to render here, inside a block that has
           * just printed this keeper's name and involvement count and is about to
           * print their distribution, save percentage and aerial numbers: a
           * sentence flatly contradicted by everything around it. That string is
           * correct only at section level, where it still lives.
           */
          <p className="type-caption text-ink-secondary">
            {t("viz.goalkeeping.zeroTimeline")}
          </p>
        ) : (
          <>
            <InvolvementChart
              points={points}
              tickIndices={involvementTicks(points)}
              formatSlot={formatSlot}
              countTicks={countTicks(peak)}
              countAxisMax={countAxisMax(peak)}
              formatCount={formatCount}
              axisSlotLabel={t("viz.goalkeeping.axisSlot")}
              axisCountLabel={t("viz.goalkeeping.axisInvolvements")}
              accent={accent}
              figureSummary={chartSummary}
              heightClass={INVOLVEMENT_CHART_HEIGHT_CLASS}
            />
            {/*
             * THE AXIS SAYS WHAT IT IS, ONCE (ruled decision 7). The x axis
             * plots the report's SLOTS IN ORDER; a stoppage slot carries the
             * preceding regulation minute, so labels can repeat. An unexplained
             * axis whose labels repeat is what this sentence prevents — and the
             * fixtures, with 19 or 25 evenly-spaced unique minutes, would never
             * have shown the need.
             */}
            <p className="type-caption text-ink-secondary">
              {t("viz.goalkeeping.involvementAxisNote")}
            </p>
          </>
        )}

        <div>
          <span className="type-stat-label text-ink-secondary">
            {t("viz.goalkeeping.distribution")}
          </span>
          {completionList(keeper.distribution.families)}
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <div className="contents">
              <dt className="type-caption text-ink-secondary">
                {t("viz.goalkeeping.lineBreaks")}
              </dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(keeper.distribution.lineBreaks, locale)}
              </dd>
            </div>
          </dl>
          {/*
           * QUALIFIED HEADINGS, not a bare repeat of the family names. These
           * three panels previously reused `enums.distributionType.*` — the very
           * labels `completionList` has just printed as family rows above, with
           * DIFFERENT numbers — so the reader met "Saque con el pie 24 ·
           * Completados 20 · Incompletos 4" and then a second "Saque con el pie"
           * heading over six technique counts. Minted under EXPERIENCE.md:278's
           * procedure for terms discovered during content work.
           */}
          {gatedPanel(
            keeper.distribution.feetTechniques,
            t("viz.goalkeeping.feetTechniques")
          )}
          {gatedPanel(
            keeper.distribution.handsTechniques,
            t("viz.goalkeeping.handsTechniques")
          )}
          {gatedPanel(
            keeper.distribution.throwTechniques,
            t("viz.goalkeeping.throwTechniques")
          )}
        </div>

        <div>
          <span className="type-stat-label text-ink-secondary">
            {t("viz.goalkeeping.goalPrevention")}
          </span>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <div className="contents">
              <dt className="type-caption text-ink-secondary">
                {t("viz.goalkeeping.attemptsFaced")}
              </dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(prevention.attemptsFaced, locale)}
              </dd>
            </div>
            <div className="contents">
              <dt className="type-caption text-ink-secondary">
                {t("viz.goalkeeping.savePercentage")}
              </dt>
              {/* Contracted field, read VERBATIM — never re-derived. */}
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatPercent(prevention.savePercentage, locale, 1)}
              </dd>
            </div>
            <div className="contents">
              <dt className="type-caption text-ink-secondary">
                {t("viz.goalkeeping.interventions")}
              </dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(prevention.totalInterventions, locale)}
              </dd>
            </div>
          </dl>
          {/*
           * RULED DECISION 13: the two breakdowns have DIFFERENT denominators —
           * byInterventionType sums to attemptsFaced, byBodyType to
           * totalInterventions — and the contract requires each panel to be
           * labelled with its OWN total rather than implying a shared one. Note
           * that byBodyType is decision 3's gated panel, so on real data only
           * the intervention-type breakdown ever renders: the mislabelling risk
           * is live only on the fixtures, where it is fully exercised.
           */}
          <div className="mt-2">
            <span className="type-stat-label text-ink-secondary">
              {denominatorLabel(
                t("viz.goalkeeping.byInterventionType"),
                prevention.interventionDenominator
              )}
            </span>
            {valueList(prevention.byInterventionType)}
          </div>
          {prevention.byBodyType.present ? (
            <div className="mt-2">
              <span className="type-stat-label text-ink-secondary">
                {denominatorLabel(
                  t("viz.goalkeeping.byBodyType"),
                  prevention.bodyTypeDenominator
                )}
              </span>
              {valueList(prevention.byBodyType.rows as CountRow[])}
            </div>
          ) : null}
        </div>

        <div>
          <span className="type-stat-label text-ink-secondary">{t("viz.goalkeeping.aerial")}</span>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <div className="contents">
              <dt className="type-caption text-ink-secondary">
                {t("viz.goalkeeping.aerialInterventions")}
              </dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(aerial.totalInterventions, locale)}
              </dd>
            </div>
            <div className="contents">
              {/*
               * DECISION 3'S FIRST NAMED CONSEQUENCE: once its counterpart is
               * gated away, `crossesFacedAttempted` renders ALONE — and a value
               * labelled as the *attempted half of a pair* with no counterpart
               * reads as a MISSING number rather than an ABSENT one. So it gets
               * its own label for that state.
               */}
              <dt className="type-caption text-ink-secondary">
                {aerial.crossesFacedCompleted === null
                  ? t("viz.goalkeeping.crossesFacedAlone")
                  : t("viz.goalkeeping.crossesFaced")}
              </dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(aerial.crossesFacedAttempted, locale)}
              </dd>
            </div>
            {aerial.crossesFacedCompleted === null ? null : (
              <div className="contents">
                <dt className="type-caption text-ink-secondary">
                  {t("viz.goalkeeping.crossesFacedCompleted")}
                </dt>
                <dd className="type-caption tabular-nums text-ink-primary">
                  {formatInteger(aerial.crossesFacedCompleted, locale)}
                </dd>
              </div>
            )}
          </dl>
          {completionList(aerial.types)}
          <div className="mt-2">
            <span className="type-stat-label text-ink-secondary">
              {denominatorLabel(t("viz.goalkeeping.deliveryTypes"), aerial.deliveryTypesTotal)}
            </span>
            {valueList(aerial.deliveryTypes)}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- Team block -------------------------------- */

  function teamBlock(ref: SideRef, accent: "a" | "b", team: GoalkeepingTeamBlock) {
    const keeperLabel =
      team.recordCount === 1 ? t("viz.goalkeeping.keeperOne") : t("viz.goalkeeping.keeperMany");
    const names = team.keeperNames.join(NAME_SEPARATOR);
    const figureSummary =
      team.recordCount === 0
        ? `${t("viz.goalkeeping.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${t(
            "viz.goalkeeping.zeroRecord"
          )}`
        : `${t("viz.goalkeeping.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${keeperLabel}${CLAUSE_SEPARATOR}${names}`;

    return (
      <figure
        role="figure"
        aria-label={figureSummary}
        className="min-w-0 rounded-md bg-surface-raised p-tile-gap"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={cn("type-label-caps", ACCENT_CLASS[accent])}>{ref.teamCode}</span>
          {team.recordCount > 0 ? (
            <span className="type-caption text-ink-secondary">{names}</span>
          ) : null}
        </div>
        {team.recordCount === 0 ? (
          /*
           * "NO RECORD FOR THIS TEAM" IS NOT "THIS KEEPER DID NOTHING", and
           * this is the exact defect Story 2.9's own review patched.
           * `sectionDataState` returns `ready` whenever goalkeeping !== null, so
           * a bundle with records for ONE team leaves the other team's block to
           * this component — and the natural implementation renders it with
           * zeros ("0 intervenciones · 0 atajadas · 0%"), A POSITIVE CLAIM THAT
           * THE REPORT RECORDED ZERO when the truth is that no record exists.
           */
          <p className="mt-2 type-caption text-ink-secondary">
            {t("viz.goalkeeping.zeroRecord")}
          </p>
        ) : (
          <>
            {/*
             * A CLOSED GATE MUST SAY SO — ONE ruled sentence, ONCE per team
             * block, naming why (ruled decision 3). The two precedents this
             * mechanism copies (`showXg`, `anyContestType`) hide a COLUMN
             * INSIDE A TABLE, costing a reader one field; this hides FIVE WHOLE
             * PANELS, all five populated on 6/6 fixture keepers and null on
             * 208/208 corpus ones. Neither five rows of em dashes (rightly
             * banned) nor silence.
             */}
            {team.anyGateClosed ? (
              <p className="mt-2 type-caption text-ink-secondary">
                {t("viz.goalkeeping.gateNote")}
              </p>
            ) : null}
            {/*
             * BOTH records render for a two-keeper team, stacked and each
             * labelled by its keeper. Real on 7 of 208 corpus team-innings and
             * on zero fixtures. NOTHING IS SUMMED ACROSS THEM.
             */}
            {team.records.map((keeper) => keeperPanels(keeper, accent, ref.name))}
          </>
        )}
      </figure>
    );
  }

  /* ------------------------------- The tables -------------------------------- */

  /** Team + keeper, the two columns all three tables open with. */
  function identityColumns<Row extends { teamCode: string; playerName: string }>(): TableColumn<
    Row
  >[] {
    return [
      {
        key: "team",
        headText: t("viz.table.team"),
        headTitle: null,
        render: (row) => row.teamCode,
        align: "text",
        sort: { kind: "text", valueOf: (row) => row.teamCode },
      },
      {
        key: "keeper",
        headText: t("viz.table.keeper"),
        headTitle: null,
        /* The keeper name is CONTEXT, and plain text — never a link:
           /players/{slug} does not exist, so a link 404s in the static
           export. UX-DR22's cross-link rule is scoped to lineup names. */
        render: (row) => row.playerName,
        align: "text",
        sort: { kind: "text", valueOf: (row) => row.playerName },
      },
    ];
  }

  function countColumn<Row>(
    key: string,
    headText: string,
    read: (row: Row) => number
  ): TableColumn<Row> {
    return {
      key,
      headText,
      headTitle: null,
      render: (row) => formatInteger(read(row), locale),
      align: "numeric",
      sort: { kind: "number", valueOf: read },
    };
  }

  const summaryColumns: TableColumn<InvolvementSummaryRow>[] = [
    ...identityColumns<InvolvementSummaryRow>(),
    countColumn("total", t("viz.goalkeeping.involvementTitle"), (row) => row.totalInvolvements),
    /*
     * A COUNT OF SLOTS, not a slot index — a different quantity from the
     * timeline table's `slot` column below, which both used to label
     * `viz.table.slot` ("Intervalo"). The two tables sit one above the other in
     * one disclosure, and ruled decision 14 split them precisely because the
     * figure the report PRINTS and the slots it PLOTS are different things.
     */
    countColumn("slots", t("viz.table.slotCount"), (row) => row.sampleCount),
  ];

  const timelineColumns: TableColumn<InvolvementTimelineRow>[] = [
    ...identityColumns<InvolvementTimelineRow>(),
    /*
     * THE SLOT INDEX COLUMN, and it is now load-bearing twice over: on real
     * data many slots share a minute (the corpus draws 95-145 slots against a
     * 0-120 minute with no stoppage field), so it is the only column that can
     * restore the plotted order once a reader has sorted by minute.
     */
    countColumn("slot", t("viz.table.slot"), (row) => row.index),
    countColumn("minute", t("viz.table.minute"), (row) => row.minute),
    countColumn("involvements", t("viz.goalkeeping.involvementTitle"), (row) => row.involvements),
  ];

  const preventionColumns: TableColumn<PreventionTableRow>[] = [
    ...identityColumns<PreventionTableRow>(),
    {
      key: "category",
      headText: t("viz.table.category"),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      // The RESOLVED category, so the order follows the EN toggle.
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    countColumn("count", t("viz.table.count"), (row) => row.count),
  ];

  /*
   * DECISION 14'S TWO TABLES, NOT ONE. A single table reading "Total: 47" above
   * a column of per-slot counts that sum to 44 is the single most likely place
   * a reader adds a column, and the mismatch then reads as the app dropping
   * data. Story 1.9 chose visibility over silence and the ledger's rule is "do
   * not resolve it by making the numbers agree" — which forbids fixing the
   * numbers, NOT disclosing the gap. So one caption names what the report
   * PRINTS and the other what it PLOTS.
   *
   * The timeline caption is minted here rather than reusing viz.table.caption,
   * whose value is literally "Ordenado por minuto." — false on this table too:
   * the order is SAMPLE INDEX, the minutes are not unique, and nothing in the
   * contract guarantees the array is minute-sorted.
   */
  /*
   * A BREAKDOWN TABLE'S COLUMNS. `complete` / `incomplete` are null for any
   * quantity that carries no completion split (a technique count, lineBreaks, a
   * delivery type), and null means NO SUCH SPLIT EXISTS — never "the report
   * recorded zero". An em dash says so, the same treatment the set-plays table
   * gives a non-partition group's share. Sorting on a null puts the row at the
   * END in both directions, which the shared table already guarantees.
   */
  function breakdownColumns(): TableColumn<KeeperBreakdownRow>[] {
    return [
      ...identityColumns<KeeperBreakdownRow>(),
      {
        key: "category",
        headText: t("viz.table.category"),
        headTitle: null,
        render: (row) => t(row.labelKey),
        align: "text",
        // The RESOLVED category, so the order follows the EN toggle.
        sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
      },
      countColumn("total", t("viz.table.total"), (row) => row.total),
      {
        key: "complete",
        headText: t("viz.table.complete"),
        headTitle: null,
        render: (row) =>
          row.complete === null ? emDash : formatInteger(row.complete, locale),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.complete },
      },
      {
        key: "incomplete",
        headText: t("viz.table.incomplete"),
        headTitle: null,
        render: (row) =>
          row.incomplete === null ? emDash : formatInteger(row.incomplete, locale),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.incomplete },
      },
    ];
  }

  const headlineColumns: TableColumn<PreventionHeadlineRow>[] = [
    ...identityColumns<PreventionHeadlineRow>(),
    countColumn("attempts", t("viz.goalkeeping.attemptsFaced"), (row) => row.attemptsFaced),
    {
      key: "save",
      headText: t("viz.goalkeeping.savePercentage"),
      headTitle: null,
      // Contracted field, read VERBATIM — never re-derived.
      render: (row) => formatPercent(row.savePercentage, locale, 1),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.savePercentage },
    },
    countColumn(
      "interventions",
      t("viz.goalkeeping.interventions"),
      (row) => row.totalInterventions
    ),
  ];

  const summaryCaption = `${title}${CAPTION_SEPARATOR}${t("viz.goalkeeping.summaryCaption")}`;
  const timelineCaption = `${title}${CAPTION_SEPARATOR}${t("viz.goalkeeping.timelineCaption")}`;
  const preventionCaption = `${title}${CAPTION_SEPARATOR}${t("viz.goalkeeping.preventionCaption")}`;
  /*
   * The two captions minted for these tables in Task 8.4 and then left with zero
   * call sites, which is what identified the missing tables as dropped work.
   */
  const distributionCaption = `${title}${CAPTION_SEPARATOR}${t(
    "viz.goalkeeping.distributionCaption"
  )}`;
  const aerialCaption = `${title}${CAPTION_SEPARATOR}${t("viz.goalkeeping.aerialCaption")}`;
  /*
   * Each of these names ITS OWN denominator (ruled decision 13). The contract is
   * explicit: "An App rendering the two panels side by side must label them with
   * their own totals rather than implying a shared one."
   */
  const headlineCaption = `${title}${CAPTION_SEPARATOR}${t(
    "viz.goalkeeping.headlineCaption"
  )}`;
  const bodyTypeCaption = `${title}${CAPTION_SEPARATOR}${t(
    "viz.goalkeeping.bodyTypeCaption"
  )}`;
  const emDash = t("viz.table.unknown");

  const teams = [grouping.home, grouping.away];
  const summaryRows = teams.flatMap((team) => involvementSummaryRows(team));
  const timelineRows = teams.flatMap((team) => involvementTimelineRows(team));
  const preventionRows: PreventionTableRow[] = teams.flatMap((team) =>
    team.records.flatMap((keeper) =>
      keeper.goalPrevention.byInterventionType.map((row) => ({
        key: `${keeper.key}-${row.key}`,
        teamCode: team.teamCode,
        playerName: keeper.playerName,
        labelKey: row.labelKey,
        count: row.count,
      }))
    )
  );

  const distributionTable = teams.flatMap((team) => distributionTableRows(team));
  const aerialTable = teams.flatMap((team) => aerialTableRows(team));
  const headlineRows = teams.flatMap((team) => preventionHeadlineRows(team));
  /*
   * The GATED body-type breakdown, appended to the intervention rows but kept in
   * its OWN table below, because decision 13 forbids implying a shared total:
   * byInterventionType sums to attemptsFaced, byBodyType to totalInterventions.
   * Empty on real data (null on 208/208), populated on every fixture.
   */
  const bodyTypeRows = teams.flatMap((team) => bodyTypeTableRows(team));

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      <DataTable
        caption={summaryCaption}
        columns={summaryColumns}
        rows={summaryRows}
        surface="canvas"
      />
      <DataTable
        caption={timelineCaption}
        columns={timelineColumns}
        rows={timelineRows}
        surface="canvas"
      />
      {/*
       * DECISION 19'S REMAINING TABLES. Without these the surface printed ~30
       * numbers and the disclosure carried a fraction of them — a UX-DR16 /
       * ARCHITECTURE-SPINE.md:140 gap, and below EXPERIENCE.md:113's floor that
       * every viz has a data-table alternative.
       */}
      <DataTable
        caption={distributionCaption}
        columns={breakdownColumns()}
        rows={distributionTable}
        surface="canvas"
      />
      <DataTable
        caption={headlineCaption}
        columns={headlineColumns}
        rows={headlineRows}
        surface="canvas"
      />
      <DataTable
        caption={preventionCaption}
        columns={preventionColumns}
        rows={preventionRows}
        surface="canvas"
      />
      {/*
       * Its own table with its own caption naming its own denominator — never
       * folded in above (ruled decision 13). Absent entirely on corpus data.
       */}
      {bodyTypeRows.length === 0 ? null : (
        <DataTable
          caption={bodyTypeCaption}
          columns={breakdownColumns()}
          rows={bodyTypeRows}
          surface="canvas"
        />
      )}
      <DataTable
        caption={aerialCaption}
        columns={breakdownColumns()}
        rows={aerialTable}
        surface="canvas"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-tile-gap">
      {/*
       * `goalkeeping: []` IS `ready`, NEVER `empty` — the schema says so
       * verbatim ("An empty array means the pages were present and listed no
       * goalkeeper; null means there was nothing to read. The App renders those
       * two states differently, so they must never be collapsed."). So this
       * component owns the zero-content view; EmptyStatePanel belongs to the
       * `null` branch and TacticalLayer renders it above here.
       */}
      {grouping.isEmptyArray ? (
        <p className="type-caption text-ink-secondary">{t("viz.goalkeeping.zeroAll")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">
          {teamBlock(home, "a", grouping.home)}
          {teamBlock(away, "b", grouping.away)}
        </div>
      )}
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

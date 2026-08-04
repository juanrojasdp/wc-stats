"use client";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { Players } from "@/lib/contract/contract-types";
import { formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  OFFER_MOVEMENT_TYPES,
  movementRows,
  movementSplit,
  movementTotalsRows,
  offerMovementKey,
  type MovementRow,
  type MovementTeamSplit,
  type MovementTotalsRow,
} from "@/viz/receiving-model";

/*
 * The #movement-to-receive content (Story 2.9 Task 6.3).
 *
 * THIS IS NOT A MAP EITHER, and the source page is not even a scatter: the
 * corpus's "Movement to Receive" panel carries ZERO markers — it is a
 * three-thirds bar chart. With `ReceivingEvent` unfulfillable in all eight
 * required fields (Story 1.13), there is no per-event movement data of any
 * kind, so this surface renders Domain G's six-way per-player split, summed to
 * a team proportion.
 *
 * THE PROPORTION IS LEGITIMATE FOR ONE MEASURED REASON: the six values are a
 * genuine PARTITION of totalOffers — sum == total on 3,289/3,289 corpus player
 * rows, delta histogram exactly {0: 3289}, re-derived over all three fixtures
 * in receiving-model.test.ts. This is deliberately unlike two ledgered traps:
 * 1.13's by_phase totals are INDEPENDENT rates (−48..+314), and Domain C's
 * phases carry a "never normalize, never pie" $comment. If the partition ever
 * fails, this surface must fall back to six paired absolute values and never a
 * normalized bar.
 */

interface SideRef {
  teamId: string;
  teamCode: string;
  name: string;
}

export interface MovementToReceiveSectionProps {
  players: Players;
  home: SideRef;
  away: SideRef;
}

/*
 * Theme-aware canvas variants (ruled decision 21): these are cards on
 * --surface-raised, not the pitch. `--viz-team-a/-b` fill the bar itself and
 * tint the team code; the -on-pitch variants belong to #defensive-actions.
 */
const ACCENT_CLASS = { a: "text-viz-team-a", b: "text-viz-team-b" } as const;
const ACCENT_VAR = { a: "--viz-team-a", b: "--viz-team-b" } as const;

const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";

/**
 * Minimum rendered width for any NON-ZERO segment (ruled decision 15).
 *
 * The two smallest corpus categories are `out-to-in` at 2.3% and `in-to-out` at
 * 3.1% of all offers, which at 320 CSS px on a ~296 px bar are ~7–9 px. A label
 * cannot go inside them (DESIGN.md:303 sets a hard 11 px type floor) and a
 * sub-pixel segment would vanish entirely. CONSEQUENCE, recorded rather than
 * hidden: the bar is therefore NOT pixel-proportional at the extremes — which
 * is why the labelled value list beneath it, not the bar, is the surface that
 * states the numbers.
 */
const MIN_SEGMENT_PX = 6;
/** Bar height: comfortably above a hairline, well below a tap target. */
const BAR_HEIGHT_PX = 16;

export function MovementToReceiveSection({ players, home, away }: MovementToReceiveSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("viz.movement.title");

  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  // Built EAGERLY (ruled decision 10) — see receiving-model's docblocks.
  const split = movementSplit(players, home, away);
  const rows = movementRows(players, home, away);
  const totals = movementTotalsRows(split);

  function teamBlock(ref: SideRef, accent: "a" | "b", team: MovementTeamSplit) {
    const totalPhrase = countPhrase(team.total, "viz.movement.offersOne", "viz.movement.offers");
    /*
     * Ruled decision 22: each team block is its own role="figure" with a
     * one-sentence localized summary. The summary names the team, its total and
     * the largest category — the one fact a reader takes from the bar.
     */
    const largest = team.categories.reduce(
      (best, category) => (category.count > best.count ? category : best),
      team.categories[0]
    );
    const figureSummary = team.isZero
      ? `${t("viz.movement.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${t("viz.movement.zero")}`
      : `${t("viz.movement.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}${totalPhrase}` +
        `${CLAUSE_SEPARATOR}${t(offerMovementKey(largest.code))} ${formatPercent(
          largest.share,
          locale,
          1
        )}`;
    const accentClass = ACCENT_CLASS[accent];
    return (
      <figure
        role="figure"
        aria-label={figureSummary}
        className="min-w-0 rounded-md bg-surface-raised p-tile-gap"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {/* A label, never a heading (MomentumSection's ruling). */}
          <span className={cn("type-label-caps", accentClass)}>{ref.teamCode}</span>
          <span className="type-caption tabular-nums text-ink-secondary">{totalPhrase}</span>
        </div>
        {team.isZero ? (
          // The slice is PRESENT and lists nothing — a fact about the match, not
          // a missing section. Never an EmptyStatePanel (that is the `null`
          // branch, rendered by TacticalLayer above this component).
          <p className="mt-2 type-caption text-ink-secondary">{t("viz.movement.zero")}</p>
        ) : (
          <>
            {/*
             * ONE BAR PER TEAM, filled in that team's own accent, segmented in
             * the frozen order with --border-hairline separators (ruled
             * decision 15). NO second hue and NO chart library: there is no
             * six-value categorical ramp in DESIGN.md — --heat-* and
             * --edge-weight-* are five-stop and ON-PITCH ONLY (heat-5 computes
             * 1.12:1 on the light card, which is where this lives) — and using
             * the two team accents for categories would breach DESIGN.md:260's
             * "a chart never mixes team encoding with outcome encoding".
             *
             * aria-hidden: the value list below IS the text alternative, and
             * the figure's own summary carries the headline. recharts is
             * installed but deliberately unused here.
             */}
            {/*
             * DECISION 14'S FALLBACK, implemented at code review: when the six
             * categories do not sum to sum(totalOffers) the bar is DROPPED and
             * only the labelled value list renders — six paired absolute values,
             * never a normalized bar over a non-partition. A proportion is
             * legitimate here for exactly one reason (the partition holds on
             * 3,289/3,289 corpus rows); when that reason stops being true, the
             * proportion stops being drawn.
             */}
            {team.partitionMismatch ? null : (
            <div
              aria-hidden="true"
              className="mt-2 flex w-full overflow-hidden rounded-sm"
              style={{ height: BAR_HEIGHT_PX }}
            >
              {/*
               * INDEX PARITY WITH THE VALUE LIST IS THE POINT.
               *
               * REVIEW PATCH: this used to `.filter(count > 0)` before mapping,
               * so a single zero category shifted every later segment by one
               * against the <dl> below. Every segment is painted the same
               * accent and carries no in-segment label, so decision 15's stated
               * mechanism — "categories carried by order" — is the ONLY link
               * between a segment and its name, and the frozen order puts the
               * two smallest corpus categories (out-to-in 2.3%, in-to-out 3.1%)
               * in the middle where a shift is least detectable.
               *
               * All six now render in order. A zero category collapses to zero
               * width and takes no separator, so it is invisible without
               * displacing anything; the MIN_SEGMENT_PX floor applies only to
               * categories that actually have a count.
               */}
              {team.categories.map((category, index) => {
                const isEmpty = category.count === 0;
                const isFirstDrawn = team.categories.every(
                  (other, position) => position >= index || other.count === 0
                );
                return (
                  <div
                    key={category.code}
                    className={cn(
                      "h-full",
                      !isEmpty && !isFirstDrawn ? "border-l border-hairline" : null
                    )}
                    style={{
                      flexGrow: category.share,
                      flexBasis: 0,
                      minWidth: isEmpty ? 0 : MIN_SEGMENT_PX,
                      backgroundColor: `var(${ACCENT_VAR[accent]})`,
                    }}
                  />
                );
              })}
            </div>
            )}
            {/*
             * The labelled value list: category name + count + share, in the
             * frozen order. Category identity is carried HERE, never by hue and
             * never by an in-segment label — at 320 px the two smallest
             * categories are ~7–9 px wide, far below DESIGN's 11 px type floor.
             */}
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
              {team.categories.map((category) => (
                <div key={category.code} className="contents">
                  <dt className="type-caption text-ink-secondary">
                    {t(offerMovementKey(category.code))}
                  </dt>
                  <dd className="type-caption tabular-nums text-ink-primary">
                    {formatInteger(category.count, locale)}
                    {VALUE_SEPARATOR}
                    {formatPercent(category.share, locale, 1)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </figure>
    );
  }

  /* ------------------------------- The tables ------------------------------- */

  /*
   * THE SIX GENERATED COLUMNS — the exact case ruled decision 2 forbids
   * `keyof Row` for. Their values live two levels down in a nested `counts`
   * record, so the sort key must be a GETTER; a field-name API could not reach
   * them at all, and an index-based one would break the moment a column set
   * changes.
   *
   * The frozen order comes from OFFER_MOVEMENT_TYPES, unchanged.
   */
  function movementColumns<Row extends { counts: MovementRow["counts"] }>(): TableColumn<Row>[] {
    return OFFER_MOVEMENT_TYPES.map((code) => ({
      key: code,
      headText: t(offerMovementKey(code)),
      headTitle: null,
      render: (row: Row) => formatInteger(row.counts[code], locale),
      align: "numeric" as const,
      sort: { kind: "number" as const, valueOf: (row: Row) => row.counts[code] },
    }));
  }

  function teamColumn<Row extends { teamCode: string }>(): TableColumn<Row> {
    return {
      key: "team",
      headText: t("viz.table.team"),
      headTitle: null,
      render: (row) => row.teamCode,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.teamCode },
    };
  }

  function totalColumn<Row extends { total: number }>(): TableColumn<Row> {
    return {
      key: "total",
      headText: t("viz.table.total"),
      headTitle: null,
      render: (row) => formatInteger(row.total, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.total },
    };
  }

  const totalsColumns: TableColumn<MovementTotalsRow>[] = [
    teamColumn<MovementTotalsRow>(),
    ...movementColumns<MovementTotalsRow>(),
    totalColumn<MovementTotalsRow>(),
  ];

  const playerColumns: TableColumn<MovementRow>[] = [
    teamColumn<MovementRow>(),
    {
      key: "shirt",
      headText: t("viz.table.shirt"),
      headTitle: null,
      render: (row) => formatInteger(row.shirtNumber, locale),
      align: "numeric",
      sort: { kind: "number", valueOf: (row) => row.shirtNumber },
    },
    {
      key: "player",
      headText: t("viz.table.player"),
      headTitle: null,
      /* Plain text, never a link: /players/{slug} does not exist. */
      render: (row) => row.playerName,
      align: "text",
      sort: { kind: "text", valueOf: (row) => row.playerName },
    },
    ...movementColumns<MovementRow>(),
    totalColumn<MovementRow>(),
  ];

  /*
   * BOTH tables (ruled decision 11): the team-totals table carries EXACTLY the
   * counts the bar's segments display, and the per-player table is the
   * breakdown. Each caption states its own content and order.
   */
  // Hoisted: a template literal in the gated `caption` prop is a gate error
  // even when every fragment is a t() call.
  const totalsCaption = `${title}${CAPTION_SEPARATOR}${t("viz.movement.totalsCaption")}`;
  const playersCaption = `${title}${CAPTION_SEPARATOR}${t("viz.movement.tableCaption")}`;

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      <DataTable
        caption={totalsCaption}
        columns={totalsColumns}
        rows={totals}
        surface="canvas"
      />
      <DataTable caption={playersCaption} columns={playerColumns} rows={rows} surface="canvas" />
    </div>
  );

  /*
   * REVIEW PATCH: `barNote` ("Cada barra reparte los ofrecimientos del equipo
   * entre los seis tipos de desmarque.") rendered unconditionally, describing a
   * bar that is not drawn when both teams are at zero or when the partition
   * fails. It is shown only when at least one bar actually renders.
   */
  const anyBar =
    (!split.home.isZero && !split.home.partitionMismatch) ||
    (!split.away.isZero && !split.away.partitionMismatch);

  return (
    <div className="flex flex-col gap-tile-gap">
      {anyBar ? (
        <p className="type-stat-label text-ink-secondary">{t("viz.movement.barNote")}</p>
      ) : null}
      {/* Ruled decision 17: stacked at <md, both visible, no tabs. */}
      <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">
        {teamBlock(home, "a", split.home)}
        {teamBlock(away, "b", split.away)}
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

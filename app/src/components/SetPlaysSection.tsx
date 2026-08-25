"use client";

import { DataTable } from "@/components/DataTable";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import type { SetPlaysBlock } from "@/lib/contract/contract-types";
import { formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import type { TableColumn } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  cornerRows,
  cornerTableRows,
  freeKickRows,
  freeKickTableRows,
  setPlayTotals,
  setPlayTotalsRows,
  type CornerTableRow,
  type FreeKickRowSet,
  type FreeKickTableRow,
  type SetPlayGroup,
  type SetPlayTotals,
  type SetPlayTotalsRow,
  type TeamCornerGroups,
} from "@/viz/set-plays-model";

/*
 * The #set-plays content (Story 2.10, Task 7.3). NO CHART LIBRARY AT ALL:
 * EXPERIENCE.md:224-225 names no chart for set plays ("Counts by type/side/
 * style"), so this ships as per-team blocks of tiles, value lists and two CSS
 * segmented bars.
 *
 * TWO OF THE FOUR OBVIOUS PARTITIONS ARE FALSE ON REAL DATA AND TRUE IN THE
 * FIXTURES (ruled decision 6), which is why the model carries an explicit
 * `partition` flag per group and this component never decides by reading a
 * variable name:
 *
 *   direct == directOnTarget + directOffTarget      corpus 0/208, fixtures 6/6
 *   sum(cornersByDeliveryStyle) == totalCorners     corpus 96/208, fixtures 6/6
 *
 * So the four free-kick values render as FLAT SIBLINGS — no stack, no segmented
 * bar, and NO INDENTATION OR OTHER CONTAINMENT CUE. Indentation is the most
 * conventional visual assertion of containment there is and would smuggle back
 * exactly the claim decision 6 bans: on 160/208 corpus team-innings the surface
 * would otherwise read "Tiro libre directo 7 / ⤷ Al arco 0 / ⤷ Desviado 0",
 * which a reader parses as a rendering bug rather than a property of the source
 * — and which is INVISIBLE IN DEV, because the fixtures satisfy the relation.
 *
 * The one TRUE free-kick partition (direct + indirect == totalFreeKicks,
 * 208/208) is deliberately not drawn as a bar either: a segmented bar over
 * {direct, indirect} sitting beside two non-exhaustive subdivisions of one of
 * its own segments is unreadable regardless of which geometry is correct.
 */

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";
const CLAUSE_SEPARATOR = ", ";
const VALUE_SEPARATOR = " · ";

const ACCENT_CLASS = { a: "text-viz-team-a", b: "text-viz-team-b" } as const;
const ACCENT_VAR = { a: "--viz-team-a", b: "--viz-team-b" } as const;

/**
 * Minimum rendered width for any NON-ZERO segment (ruled decision 8, 2.9's
 * treatment).
 *
 * A single corner out of nineteen is 5.3%, which at 320 CSS px on a ~296 px bar
 * is ~16 px — but m001 away has ONE corner in total, and a type carrying 1 of
 * 16 (m074 home) lands near 6 px. A label cannot go inside them (DESIGN.md:303
 * sets a hard 11 px type floor) and a sub-pixel segment vanishes entirely.
 *
 * CONSEQUENCE, RECORDED RATHER THAN HIDDEN: the bar is therefore NOT
 * pixel-proportional at the extremes — which is why the labelled value list
 * beneath it, not the bar, is the surface that states the numbers.
 */
const MIN_SEGMENT_PX = 6;
const BAR_HEIGHT_PX = 16;

interface SideRef {
  teamId: string;
  teamCode: string;
  name: string;
}

export interface SetPlaysSectionProps {
  setPlays: SetPlaysBlock;
  home: SideRef;
  away: SideRef;
}

/**
 * The per-type left/right rows, FLATTENED to carry their own team code.
 *
 * The shipped shape was `{ row, teamCode }`, which has no top-level `key` — and
 * the shared table needs one per row for React reconciliation and for decision
 * 6's `data-row-key`. The model's own key is already unique across both teams
 * (`corner-type-sides-${teamId}-${code}`), so flattening adds nothing but the
 * team code and changes no rendered value.
 */
interface CornerTypeSideTableRow {
  key: string;
  teamCode: string;
  labelKey: DictionaryKey;
  left: number;
  right: number;
  total: number;
}

export function SetPlaysSection({ setPlays, home, away }: SetPlaysSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("tactical.sections.set-plays.title");

  /*
   * `countPhrase` is NOT exported from anywhere — it is a private four-line
   * function redeclared identically in six shipped sections. Copied, not
   * imported, and deliberately not extracted: t() has no interpolation and no
   * plural machinery, so "1 tiros de esquina" needs a two-key choice at the
   * call site.
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  // Eager, outside the disclosure (ruled decision 18).
  const totals = setPlayTotals(setPlays, home, away);
  const freeKicks = freeKickRows(setPlays, home, away);
  const corners = cornerRows(setPlays, home, away);

  const declaredTotalLabel = t("viz.setPlays.declaredTotal");

  /* ------------------------------ The bar grammar ---------------------------- */

  /**
   * One horizontal bar per team, filled in that team's own accent, segmented in
   * the frozen order with border-hairline separators, plus a labelled value
   * list beneath it as the TEXT ALTERNATIVE (the bar itself aria-hidden).
   *
   * This is MovementToReceiveSection's shipped grammar, COPIED rather than
   * imported — that module is private and 2.9's own note rules against
   * cross-importing private section internals.
   *
   * NO SECOND HUE: DESIGN.md publishes exactly two ramps, both five-stop and
   * ON-PITCH ONLY (--heat-5 computes 1.12:1 on the light card, which is where
   * this lives), and its one categorical palette is scoped to shot outcomes by
   * name. Category identity is carried by ORDER + a DIRECT TEXT LABEL + the
   * value, never by hue.
   *
   * UX-DR11 SCOPE NOTE: decision 10's SVG <pattern> rules chart MARKS. These
   * segments are CSS flex elements and an SVG pattern is unavailable to them;
   * they discharge UX-DR11 through per-team block placement plus the direct
   * team-code label instead. Stated here so nobody later reads the unpatterned
   * Team B fill as an omission.
   */
  function segmentedBar(group: SetPlayGroup, accent: "a" | "b", groupLabel: string) {
    if (!group.partition) {
      throw new Error(
        `SetPlaysSection: refusing to draw part-of-whole geometry over the non-partition group ${group.key}`
      );
    }
    return (
      <div className="mt-2 flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="type-stat-label text-ink-secondary">{groupLabel}</span>
          <span className="type-caption tabular-nums text-ink-secondary">
            {declaredTotalLabel}
            {VALUE_SEPARATOR}
            {formatInteger(group.declaredTotal, locale)}
          </span>
        </div>
        {group.isZero ? (
          <p className="type-caption text-ink-secondary">{t("viz.setPlays.zeroCorners")}</p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="flex w-full overflow-hidden rounded-sm"
              style={{ height: BAR_HEIGHT_PX }}
            >
              {/*
               * INDEX PARITY WITH THE VALUE LIST IS THE POINT: every segment is
               * painted the same accent and carries no in-segment label, so
               * ORDER is the only link between a segment and its name. A zero
               * category collapses to zero width and takes no separator, so it
               * is invisible without displacing anything.
               */}
              {group.segments.map((segment, index) => {
                const isEmpty = segment.count === 0;
                const isFirstDrawn = group.segments.every(
                  (other, position) => position >= index || other.count === 0
                );
                return (
                  <div
                    key={segment.key}
                    className={cn(
                      "h-full",
                      !isEmpty && !isFirstDrawn ? "border-l border-hairline" : null
                    )}
                    style={{
                      flexGrow: segment.share,
                      flexBasis: 0,
                      minWidth: isEmpty ? 0 : MIN_SEGMENT_PX,
                      backgroundColor: `var(${ACCENT_VAR[accent]})`,
                    }}
                  />
                );
              })}
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
              {group.segments.map((segment) => (
                <div key={segment.key} className="contents">
                  <dt className="type-caption text-ink-secondary">{t(segment.labelKey)}</dt>
                  <dd className="type-caption tabular-nums text-ink-primary">
                    {formatInteger(segment.count, locale)}
                    {VALUE_SEPARATOR}
                    {formatPercent(segment.share, locale, 1)}
                  </dd>
                </div>
              ))}
            </dl>
            {/*
             * THE BAR'S DENOMINATOR IS THE SUM OF ITS OWN SEGMENTS, never
             * `totalCorners` — a SEPARATE contracted field. When the two
             * disagree the surface SHOWS BOTH and normalizes neither (AD-6).
             * False on all six fixture team-innings; true on 112 of 208 corpus
             * ones for the STYLE group, which is why it is never drawn as a bar
             * at all.
             */}
            {/*
             * A PARTITION'S MISMATCH NEEDS ITS OWN SENTENCE, not the
             * non-partition disclaimer. `segmentedBar` is only ever called with
             * corner SIDE and corner TYPE, both of which hold 208/208 on the
             * corpus — so telling the reader "recuento independiente" here would
             * deny exactly the part-of-whole relation the bar is drawing. What
             * decision 8 actually requires when segments and `totalCorners`
             * disagree is to SHOW BOTH AND NORMALIZE NEITHER (AD-6), which is a
             * statement about the source disagreeing with itself, not about the
             * categories being independent. Unreachable on the fixtures (false
             * 6/6), live on corpus data.
             */}
            {group.disagreesWithDeclaredTotal ? (
              <p className="type-caption text-ink-secondary">
                {t("viz.setPlays.cornerMismatchNote")}
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  /** A flat, unindented value list. The ONLY treatment a non-partition gets. */
  function flatCounts(
    entries: { key: string; labelKey: DictionaryKey; count: number }[],
    groupLabel: string,
    note: string | null
  ) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        <span className="type-stat-label text-ink-secondary">{groupLabel}</span>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
          {entries.map((entry) => (
            <div key={entry.key} className="contents">
              {/*
               * NO INDENT, NO NESTING GLYPH, NO INSET — see the module docblock.
               * The two direct* rows are flagged `subordinate` in the model as
               * DATA (the contract claims they are subdivisions); that flag must
               * never become a containment cue, because the claim is false on
               * 208/208 corpus team-innings.
               */}
              <dt className="type-caption text-ink-secondary">{t(entry.labelKey)}</dt>
              <dd className="type-caption tabular-nums text-ink-primary">
                {formatInteger(entry.count, locale)}
              </dd>
            </div>
          ))}
        </dl>
        {note === null ? null : <p className="type-caption text-ink-secondary">{note}</p>}
      </div>
    );
  }

  /* ------------------------------- Team block -------------------------------- */

  function teamBlock(
    ref: SideRef,
    accent: "a" | "b",
    teamTotals: SetPlayTotals,
    teamFreeKicks: FreeKickRowSet,
    teamCorners: TeamCornerGroups
  ) {
    const totalPhrase = countPhrase(
      teamTotals.totalSetPlays,
      "viz.setPlays.setPlaysOne",
      "viz.setPlays.setPlaysMany"
    );
    const cornerPhrase = countPhrase(
      teamTotals.totalCorners,
      "viz.setPlays.cornersOne",
      "viz.setPlays.cornersMany"
    );
    const figureSummary =
      `${t("viz.setPlays.figurePrefix")} ${ref.name}${CLAUSE_SEPARATOR}` +
      `${totalPhrase}${CLAUSE_SEPARATOR}${cornerPhrase}`;
    const isZero =
      teamTotals.totalSetPlays === 0 &&
      teamTotals.totalFreeKicks === 0 &&
      teamTotals.totalCorners === 0 &&
      teamTotals.totalThrowIns === 0 &&
      teamTotals.totalPenalties === 0;

    const totalRows: { key: string; labelKey: DictionaryKey; count: number }[] = [
      { key: "sp", labelKey: "viz.setPlays.totalSetPlays", count: teamTotals.totalSetPlays },
      { key: "fk", labelKey: "viz.setPlays.freeKicks", count: teamTotals.totalFreeKicks },
      { key: "ck", labelKey: "viz.setPlays.corners", count: teamTotals.totalCorners },
      { key: "ti", labelKey: "viz.setPlays.throwIns", count: teamTotals.totalThrowIns },
      { key: "pk", labelKey: "viz.setPlays.penalties", count: teamTotals.totalPenalties },
    ];

    return (
      <figure
        role="figure"
        aria-label={figureSummary}
        className="min-w-0 rounded-md bg-surface-raised p-tile-gap"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {/* A team code is a LABEL, never a heading. */}
          <span className={cn("type-label-caps", ACCENT_CLASS[accent])}>{ref.teamCode}</span>
          <span className="type-caption tabular-nums text-ink-secondary">{totalPhrase}</span>
        </div>
        {isZero ? (
          /*
           * The slice is PRESENT and lists nothing — a fact about the match, not
           * a missing section. Never an EmptyStatePanel: that is the `null`
           * branch, and TacticalLayer renders it above this component.
           */
          <p className="mt-2 type-caption text-ink-secondary">{t("viz.setPlays.zero")}</p>
        ) : (
          <>
            {flatCounts(totalRows, t("viz.setPlays.totals"), null)}
            {flatCounts(
              teamFreeKicks.rows.map((row) => ({
                key: row.key,
                labelKey: row.labelKey,
                count: row.count,
              })),
              t("viz.setPlays.freeKicks"),
              t("viz.setPlays.freeKickNote")
            )}
            {segmentedBar(teamCorners.bySide, accent, t("viz.setPlays.cornerSide"))}
            {segmentedBar(teamCorners.byDeliveryType, accent, t("viz.setPlays.cornerType"))}
            {/*
             * STYLE IS NOT A PARTITION (96/208 corpus team-innings) — four
             * independent labelled counts, same rule as the free kicks.
             */}
            {flatCounts(
              teamCorners.byStyle.segments.map((segment) => ({
                key: segment.key,
                labelKey: segment.labelKey,
                count: segment.count,
              })),
              t("viz.setPlays.cornerStyle"),
              t("viz.setPlays.cornerStyleNote")
            )}
          </>
        )}
      </figure>
    );
  }

  /* ------------------------------- The tables -------------------------------- */

  const emDash = t("viz.table.unknown");

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

  /** A plain integer column reading one field. */
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

  const totalsColumns: TableColumn<SetPlayTotalsRow>[] = [
    teamColumn<SetPlayTotalsRow>(),
    countColumn("sp", t("viz.setPlays.totalSetPlays"), (row) => row.totalSetPlays),
    countColumn("fk", t("viz.setPlays.freeKicks"), (row) => row.totalFreeKicks),
    countColumn("ck", t("viz.setPlays.corners"), (row) => row.totalCorners),
    countColumn("ti", t("viz.setPlays.throwIns"), (row) => row.totalThrowIns),
    countColumn("pk", t("viz.setPlays.penalties"), (row) => row.totalPenalties),
  ];

  const freeKickColumns: TableColumn<FreeKickTableRow>[] = [
    teamColumn<FreeKickTableRow>(),
    // Generated from the model's own row definitions — a nested `counts` read,
    // so the sort key is a getter (decision 2).
    ...freeKicks.home.rows.map((definition) =>
      countColumn<FreeKickTableRow>(
        definition.code,
        t(definition.labelKey),
        (row) => row.counts[definition.code]
      )
    ),
    /*
     * The DECLARED total, read verbatim — never the sum of the four columns
     * beside it, which double-counts the direct free kicks.
     */
    countColumn("total", t("viz.table.total"), (row) => row.declaredTotal),
  ];

  const cornerColumns: TableColumn<CornerTableRow>[] = [
    teamColumn<CornerTableRow>(),
    {
      key: "category",
      headText: t("viz.table.category"),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      // The RESOLVED category name, so the order follows the EN toggle.
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    countColumn("count", t("viz.table.count"), (row) => row.count),
    {
      key: "share",
      headText: t("viz.table.share"),
      headTitle: null,
      /*
       * The share is GEOMETRY AND IT IS ALSO PRINTED on the surface, so
       * decision 19 requires it here too. A non-partition group has no
       * share anywhere — an em dash, not a computed number.
       */
      render: (row) => (row.share === null ? emDash : formatPercent(row.share, locale, 1)),
      align: "numeric",
      // NULL, never the em dash: a share-less group sorts to the END of the
      // array rather than collating on "—".
      sort: { kind: "number", valueOf: (row) => row.share },
    },
  ];

  const typeSideColumns: TableColumn<CornerTypeSideTableRow>[] = [
    teamColumn<CornerTypeSideTableRow>(),
    {
      key: "type",
      headText: t("viz.setPlays.cornerType"),
      headTitle: null,
      render: (row) => t(row.labelKey),
      align: "text",
      sort: { kind: "text", valueOf: (row) => t(row.labelKey) },
    },
    countColumn("left", t("viz.table.left"), (row) => row.left),
    countColumn("right", t("viz.table.right"), (row) => row.right),
    countColumn("total", t("viz.table.total"), (row) => row.total),
  ];

  const totalsCaption = `${title}${CAPTION_SEPARATOR}${t("viz.setPlays.totalsCaption")}`;
  const freeKickCaption = `${title}${CAPTION_SEPARATOR}${t("viz.setPlays.freeKickCaption")}`;
  const cornerCaption = `${title}${CAPTION_SEPARATOR}${t("viz.setPlays.cornerCaption")}`;
  /*
   * ITS OWN CAPTION. Decision 19 requires each caption to state its own content
   * and its own order, and the two tables are different slices: the one above is
   * counts and shares by side, type and style; this one is the LEFT/RIGHT split
   * within each delivery type. Reusing `cornerCaption` for both left two
   * adjacent <caption> elements reading identically, which makes the tables
   * indistinguishable in a screen reader's table list — the same defect the 2.7
   * review patched once already for the disclosure controls.
   */
  const cornerTypeSideCaption = `${title}${CAPTION_SEPARATOR}${t(
    "viz.setPlays.cornerTypeSideCaption"
  )}`;

  const totalsTableRows = setPlayTotalsRows(totals);
  const freeKickRowsForTable = freeKickTableRows(freeKicks);
  const cornerRowsForTable = cornerTableRows(corners);
  const typeSideRows: CornerTypeSideTableRow[] = [
    ...corners.home.deliveryTypeSides.map((row) => ({
      ...row,
      teamCode: corners.home.bySide.teamCode,
    })),
    ...corners.away.deliveryTypeSides.map((row) => ({
      ...row,
      teamCode: corners.away.bySide.teamCode,
    })),
  ];

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      <DataTable
        caption={totalsCaption}
        tableName={totalsCaption}
        columns={totalsColumns}
        rows={totalsTableRows}
        surface="canvas"
      />
      <DataTable
        caption={freeKickCaption}
        tableName={freeKickCaption}
        columns={freeKickColumns}
        rows={freeKickRowsForTable}
        surface="canvas"
      />
      <DataTable
        caption={cornerCaption}
        tableName={cornerCaption}
        columns={cornerColumns}
        rows={cornerRowsForTable}
        surface="canvas"
      />
      <DataTable
        caption={cornerTypeSideCaption}
        tableName={cornerTypeSideCaption}
        columns={typeSideColumns}
        rows={typeSideRows}
        surface="canvas"
      />
    </div>
  );

  const anyBar = !corners.home.bySide.isZero || !corners.away.bySide.isZero;

  return (
    <div className="flex flex-col gap-tile-gap">
      {anyBar ? (
        <p className="type-stat-label text-ink-secondary">{t("viz.setPlays.barNote")}</p>
      ) : null}
      {/* Ruled decision 17: stacked at <md, both visible, no tabs. */}
      <div className="grid grid-cols-1 gap-tile-gap md:grid-cols-2">
        {teamBlock(home, "a", totals.home, freeKicks.home, corners.home)}
        {teamBlock(away, "b", totals.away, freeKicks.away, corners.away)}
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

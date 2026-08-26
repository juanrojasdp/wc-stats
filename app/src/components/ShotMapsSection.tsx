"use client";

import { DataTable } from "@/components/DataTable";
import { EmptyStatePanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import { DOT_SEPARATOR, PitchPanel, type PitchPanelLegendEntry, type PitchPanelSide } from "@/components/PitchPanel";
import type { Crosses, Shots } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { clockSortValue, type TableColumn } from "@/lib/table-sort";
import {
  CROSS_COMPLETED_SHAPE,
  crossFigureCounts,
  crossLogRows,
  crossMarkers,
  type CrossLogRow,
} from "@/viz/cross-map-model";
import { panelDataState, type PitchMarker } from "@/viz/marker-model";
import {
  SHOT_OUTCOMES,
  SHOT_OUTCOME_ENCODING,
  anyExpectedGoals,
  hasExcludedOwnGoals,
  shotFigureCounts,
  shotLogRows,
  shotMarkers,
  shotOutcomeKey,
  type ShotLogRow,
} from "@/viz/shot-map-model";

/*
 * The #shot-maps content (Task 8): TWO panel slots — the shot map, then the
 * cross map (ruled decision 1: the cross map lives inside #shot-maps, so the
 * registry stays at eleven sections and 2.8-2.10 keep iterating the order
 * Story 2.5 declared complete).
 *
 * Props are narrow and explicit, never the whole bundle (Story 2.5 Task 5.1
 * precedent). `teamXg` is passed pre-extracted rather than handing down
 * keyStatistics, so this component can never reach for a Domain B field it has
 * no business rendering.
 */

interface SideRef {
  teamId: string;
  /** Uppercased — the on-pitch direct label. */
  teamCode: string;
  /**
   * The team's display name, used in the figure summary ("Mapa de tiros:
   * México, 16 tiros, 2 goles") while the on-pitch label is the code. Both come
   * from metadata.{home,away}Team and are locale-neutral proper nouns that pass
   * through untranslated (AD-7).
   */
  name: string;
}

export interface ShotMapsSectionProps {
  shots: Shots;
  crosses: Crosses;
  home: SideRef;
  away: SideRef;
  /** keyStatistics[side].expectedGoals, verbatim — a real artifact total. */
  teamXg: { home: number; away: number };
  /**
   * `#shot-maps-shots`' nonce (Story 3.8, D4). REQUIRED, not optional: the layer
   * is the only caller, and a forgotten nonce is exactly the silent no-op this
   * story exists to remove — a compile error is the cheapest place to catch it.
   */
  shotsNonce: number;
  /** `#shot-maps-crosses`' nonce. The other half of L1886's disambiguation. */
  crossesNonce: number;
}

/*
 * The accent each side carries: Team A = home, Team B = away.
 *
 * The -on-pitch variants, NOT --viz-team-a/-b: these hues are painted on the
 * theme-invariant pitch, where the light-canvas variants compute 2.44:1 and
 * 2.28:1 against a 3:1 floor (Story 2.7 code review). The canvas tokens keep
 * their light variants for Key Statistics and the stat tiles.
 */
const ACCENT_VAR = { a: "--viz-team-a-on-pitch", b: "--viz-team-b-on-pitch" } as const;

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

export function ShotMapsSection({
  shots,
  crosses,
  home,
  away,
  teamXg,
  shotsNonce,
  crossesNonce,
}: ShotMapsSectionProps) {
  const t = useT();
  const { locale } = useLocale();
  const emptyHeadline = useEmptyHeadline();

  const shotTitle = t("viz.shotMap.title");
  const crossTitle = t("viz.crossMap.title");

  /*
   * t() has no interpolation and a template literal in a gated prop is a lint
   * error, so every composed string is built into an identifier first.
   * Counters pick a singular or plural key rather than always taking the
   * plural: "1 goles" is a visible copy defect, and m074 Paraguay's map has
   * exactly one goal marker.
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  function shotSide(side: SideRef, accent: "a" | "b", xg: number): PitchPanelSide {
    const markers = shotMarkers(shots ?? [], side.teamId);
    const counts = shotFigureCounts(markers);
    const metaLine = `${t("viz.shotMap.xg")} ${formatDecimal(xg, locale, 2)}${DOT_SEPARATOR}${countPhrase(
      counts.shots,
      "viz.shotMap.shotsOne",
      "viz.shotMap.shots"
    )}`;
    /*
     * Counts come from shotFigureCounts — the marks THIS PANEL DREW — never
     * from keyStatistics.goals (ruled decision 12). m074's Germany has
     * goals: 1 and zero goal markers, so the keyStatistics reading would put
     * "1 gol" over a map with no green marker.
     */
    const figureSummary = `${t("viz.shotMap.figurePrefix")} ${side.name}, ${countPhrase(
      counts.shots,
      "viz.shotMap.shotsOne",
      "viz.shotMap.shots"
    )}, ${countPhrase(counts.goals, "viz.shotMap.goalsOne", "viz.shotMap.goals")}`;
    return {
      teamCode: side.teamCode,
      accent,
      markers,
      metaLine,
      figureSummary,
      zeroLine: t("viz.shotMap.zero"),
    };
  }

  function crossSide(side: SideRef, accent: "a" | "b"): PitchPanelSide {
    const markers: PitchMarker[] = crossMarkers(crosses ?? [], side.teamId, ACCENT_VAR[accent]);
    const counts = crossFigureCounts(markers);
    const metaLine = `${countPhrase(
      counts.crosses,
      "viz.crossMap.crossesOne",
      "viz.crossMap.crosses"
    )}${DOT_SEPARATOR}${countPhrase(
      counts.completed,
      "viz.crossMap.completedCountOne",
      "viz.crossMap.completedCount"
    )}`;
    const figureSummary = `${t("viz.crossMap.figurePrefix")} ${side.name}, ${countPhrase(
      counts.crosses,
      "viz.crossMap.crossesOne",
      "viz.crossMap.crosses"
    )}, ${countPhrase(
      counts.completed,
      "viz.crossMap.completedCountOne",
      "viz.crossMap.completedCount"
    )}`;
    return {
      teamCode: side.teamCode,
      accent,
      markers,
      metaLine,
      figureSummary,
      zeroLine: t("viz.crossMap.zero"),
    };
  }

  const shotLegend: PitchPanelLegendEntry[] = SHOT_OUTCOMES.map((outcome) => ({
    shape: SHOT_OUTCOME_ENCODING[outcome].shape,
    colorVar: SHOT_OUTCOME_ENCODING[outcome].colorVar,
    label: t(shotOutcomeKey(outcome)),
  }));

  /*
   * The cross legend carries both states for BOTH teams. Completion is dual
   * encoded by fill while the hue is the acting team's accent (ruled decision
   * 4), so a two-entry legend could only show one team's colour — and a
   * swatch painted in a hue no marker uses is its own small lie.
   */
  const crossLegend: PitchPanelLegendEntry[] = [home, away].flatMap((side, index) => {
    const accent = ACCENT_VAR[index === 0 ? "a" : "b"];
    return [
      {
        shape: CROSS_COMPLETED_SHAPE.completed,
        colorVar: accent,
        label: `${side.teamCode}${DOT_SEPARATOR}${t("viz.crossMap.completed")}`,
      },
      {
        shape: CROSS_COMPLETED_SHAPE.attempted,
        colorVar: accent,
        label: `${side.teamCode}${DOT_SEPARATOR}${t("viz.crossMap.attempted")}`,
      },
    ];
  });

  /*
   * Log rows are built EAGERLY, not inside the lazily-mounted disclosure: this
   * is where Task 8.5's guarantee lives. A shot or cross whose teamId matches
   * neither side throws from resolveSide, naming the offending id, on load —
   * a silent drop is exactly the class of finding prior reviews flagged on
   * groupScorers and composeMatchTitle. TacticalErrorBoundary contains it.
   *
   * Team A = home = --viz-team-a, Team B = away = --viz-team-b. UX-DR11 is
   * satisfied here by DIRECT LABELLING rather than by a second visual channel:
   * the two teams are never in one chart (separate half-pitches at >=md, a team
   * selector at <md), so hue is never the sole distinguisher and Team B needs
   * no dashed or patterned treatment.
   */
  const shotRows: ShotLogRow[] = shots === null ? [] : shotLogRows(shots, home, away);
  const crossRows: CrossLogRow[] = crosses === null ? [] : crossLogRows(crosses, home, away);
  const showXg = anyExpectedGoals(shotRows);

  const unknown = t("viz.table.unknown");
  const ownGoalLabel = t("match.hero.ownGoal");

  /*
   * SHARED COLUMNS, built once and spread into both logs. The two tables agree
   * on their first five columns by construction rather than by two lists that a
   * later edit could drift apart.
   *
   * Every `sort.valueOf` returns the RENDERED SEMANTIC value, never the raw
   * model field: the minute column sorts on the (minute, stoppage) stamp rather
   * than the "45+2′" label, and the outcome/delivery columns sort on the
   * RESOLVED dictionary string so the order follows the EN toggle. Sorting on
   * the raw key would order by "enums.shotOutcome.blocked".
   */
  function logColumns<Row extends {
    teamCode: string;
    playerName: string | null;
    minuteLabel: string | null;
    minute: number | null;
    stoppageMinute: number | null;
    x: number;
    y: number;
  }>(): TableColumn<Row>[] {
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
        key: "player",
        headText: t("viz.table.player"),
        headTitle: null,
        // Plain text, never a link: /players/{slug} does not exist.
        render: (row) => row.playerName ?? unknown,
        align: "text",
        /*
         * THE ROW HEADER (ledger A17/L1877, Story 2.19 Task 6.9). Both shot-map
         * logs were rows of bare `<td>`s, so a screen reader read eight values
         * per row and never said WHOSE shot it was. Unlike the two gated logs
         * this column is unconditional here, so it is marked in place rather
         * than through `markRowHeader`.
         */
        rowHeader: true,
        // NULL, not the em dash: an unnamed player sorts to the END of the
        // array in both directions rather than collating on "—".
        sort: { kind: "text", valueOf: (row) => row.playerName },
      },
      {
        key: "minute",
        headText: t("viz.table.minute"),
        headTitle: null,
        render: (row) => row.minuteLabel ?? unknown,
        align: "numeric",
        sort: {
          kind: "number",
          valueOf: (row) => clockSortValue(row.minute, row.stoppageMinute),
        },
      },
      {
        key: "x",
        headText: t("viz.table.x"),
        headTitle: null,
        render: (row) => formatDecimal(row.x, locale, 2),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.x },
      },
      {
        key: "y",
        headText: t("viz.table.y"),
        headTitle: null,
        render: (row) => formatDecimal(row.y, locale, 2),
        align: "numeric",
        sort: { kind: "number", valueOf: (row) => row.y },
      },
    ];
  }

  /** The outcome label, own-goal suffix included — rendered AND sorted on. */
  function outcomeText(row: ShotLogRow): string {
    // The suffix is how a reader reconciles an 8-row Paraguay log against 7
    // Paraguay markers.
    return row.ownGoal ? `${t(row.outcomeKey)} ${ownGoalLabel}` : t(row.outcomeKey);
  }

  const shotColumns: TableColumn<ShotLogRow>[] = [
    ...logColumns<ShotLogRow>(),
    {
      key: "outcome",
      headText: t("viz.table.outcome"),
      headTitle: null,
      render: outcomeText,
      align: "text",
      sort: { kind: "text", valueOf: outcomeText },
    },
    // FD-1: omitted entirely while every value is null. The column set is
    // therefore DYNAMIC, which is why sort keys are stable strings, never
    // indices.
    ...(showXg
      ? [
          {
            key: "xg",
            headText: t("viz.table.xg"),
            /*
             * REVIEW PATCH (Story 2.11a code review): this was
             * `t("viz.shotMap.xg")`, which resolves to "xG" — byte-identical to
             * headText — so the head rendered `title="xG"` over visible text
             * "xG": a native tooltip carrying nothing, which did not exist
             * before the retrofit. The contract is explicit that headTitle is
             * the "full term when headText is abbreviated; null otherwise".
             * The real expansion exists only as `match.hero.xgExpansion`, and
             * reaching across namespaces for it is not this story's call —
             * term expansion in the tactical layer belongs to Story 2.18's
             * glossary, which this story's scope boundaries route away.
             */
            headTitle: null,
            render: (row: ShotLogRow) =>
              row.expectedGoals === null ? unknown : formatDecimal(row.expectedGoals, locale, 2),
            align: "numeric" as const,
            sort: {
              kind: "number" as const,
              valueOf: (row: ShotLogRow) => row.expectedGoals,
            },
          },
        ]
      : []),
  ];

  const crossColumns: TableColumn<CrossLogRow>[] = [
    ...logColumns<CrossLogRow>(),
    {
      key: "delivery",
      headText: t("viz.table.delivery"),
      headTitle: null,
      render: (row) => t(row.deliveryKey),
      align: "text",
      sort: { kind: "text", valueOf: (row) => t(row.deliveryKey) },
    },
    {
      key: "completed",
      headText: t("viz.table.completed"),
      headTitle: null,
      render: (row) => (row.completed ? t("viz.table.yes") : t("viz.table.no")),
      align: "text",
      sort: {
        kind: "text",
        valueOf: (row) => (row.completed ? t("viz.table.yes") : t("viz.table.no")),
      },
    },
  ];

  /*
   * Each table's caption and each disclosure control name themselves after
   * their own panel. Two panels on one page previously shipped two identical
   * "Ver los datos" buttons and two identical "Ordenado por minuto." captions,
   * so a reader listing the page's tables or buttons got two indistinguishable
   * entries with nothing separating shots from crosses.
   */
  const shotCaption = `${shotTitle}${CAPTION_SEPARATOR}${t("viz.table.caption")}`;
  const crossCaption = `${crossTitle}${CAPTION_SEPARATOR}${t("viz.table.caption")}`;

  /*
   * `tableName` IS THE CAPTION (2.19 code review, and Task 6.16's own ruling).
   *
   * 6.16 ruled that a table's announcement identifier is its `<caption>`, and
   * justified that by the caption inventory in `i18n.test.ts` pinning caption
   * uniqueness site-wide. These two tables passed their section TITLES instead —
   * strings the inventory does not pin — so they were the two call sites the
   * ruling's own guarantee did not actually reach.
   */
  const shotTable = (
    <DataTable
      caption={shotCaption}
      tableName={shotCaption}
      columns={shotColumns}
      rows={shotRows}
      surface="pitch"
    />
  );

  const crossTable = (
    <DataTable
      caption={crossCaption}
      tableName={crossCaption}
      columns={crossColumns}
      rows={crossRows}
      surface="pitch"
    />
  );

  /*
   * Each slot branches on ITS OWN table's state (ruled decision 2): "absent"
   * renders an EmptyStatePanel naming that PANEL, so a crosses-less report
   * reads "Sin datos de Mapa de centros para este partido." while the shot map
   * renders normally. "zero" and "ready" both render the PitchPanel — the
   * per-side zero case is the panel's own zero line.
   */
  const shotState = panelDataState(shots);
  const crossState = panelDataState(crosses);

  const ownGoalsExcluded =
    shots !== null &&
    (hasExcludedOwnGoals(shots, home.teamId) || hasExcludedOwnGoals(shots, away.teamId));

  return (
    <div>
      {/*
       * THE ANCHOR ID RIDES BOTH ARMS OF EACH TERNARY, AND ONLY ONE AT A TIME
       * (Story 3.8, D10.2).
       *
       * On the SHIPPED CORPUS `events.crosses` is null on 104/104 matches, so
       * the arm a real reader's `#shot-maps-crosses` reaches is the
       * EmptyStatePanel, not the PitchPanel. A link that lands on a named
       * absence — "Sin datos de Mapa de centros para este partido." — is honest;
       * one that lands at the top of the section because its target does not
       * exist is not. That absence is ruled FR-22 behaviour, not a defect: do
       * not "fix" it by inventing a panel.
       *
       * The wrapper carries the id ONLY in the absent arm, because the PitchPanel
       * in the other arm already emits it via `anchorId`. Emitting both would
       * duplicate a DOM id — silently legal, and it breaks `getElementById` in
       * the one way nothing in this suite catches.
       */}
      {shotState === "absent" ? (
        <div id="shot-maps-shots" tabIndex={-1}>
          <EmptyStatePanel
            headline={emptyHeadline(shotTitle)}
            explanation={t("tactical.empty.explanation")}
          />
        </div>
      ) : (
        <PitchPanel
          anchorId="shot-maps-shots"
          openNonce={shotsNonce}
          title={shotTitle}
          sides={[shotSide(home, "a", teamXg.home), shotSide(away, "b", teamXg.away)]}
          legend={shotLegend}
          note={ownGoalsExcluded ? t("viz.shotMap.ownGoalsExcluded") : null}
          dataTable={shotTable}
        />
      )}
      <div className="mt-section-gap">
        {crossState === "absent" ? (
          <div id="shot-maps-crosses" tabIndex={-1}>
            <EmptyStatePanel
              headline={emptyHeadline(crossTitle)}
              explanation={t("tactical.empty.explanation")}
            />
          </div>
        ) : (
          <PitchPanel
            anchorId="shot-maps-crosses"
            openNonce={crossesNonce}
            title={crossTitle}
            sides={[crossSide(home, "a"), crossSide(away, "b")]}
            legend={crossLegend}
            dataTable={crossTable}
          />
        )}
      </div>
    </div>
  );
}

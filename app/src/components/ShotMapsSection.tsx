"use client";

import type { ReactNode } from "react";

import { EmptyStatePanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import { DOT_SEPARATOR, PitchPanel, type PitchPanelLegendEntry, type PitchPanelSide } from "@/components/PitchPanel";
import type { Crosses, Shots } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
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
}

/** The accent each side carries: Team A = home, Team B = away. */
const ACCENT_VAR = { a: "--viz-team-a", b: "--viz-team-b" } as const;

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: { key: string; label: string; numeric: boolean }[];
  children: ReactNode;
}) {
  return (
    // {components.data-table}: hairline row dividers, NO zebra striping.
    <table className="w-full border-collapse text-left">
      <caption className="mb-2 text-left type-caption text-ink-secondary">{caption}</caption>
      <thead>
        <tr className="border-b border-pitch-line/40">
          {headers.map((header) => (
            <th
              key={header.key}
              scope="col"
              className={`px-2 py-1.5 type-stat-label text-ink-secondary ${
                header.numeric ? "text-right" : "text-left"
              }`}
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

export function ShotMapsSection({ shots, crosses, home, away, teamXg }: ShotMapsSectionProps) {
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
    )}${DOT_SEPARATOR}${formatInteger(counts.completed, locale)} ${t("viz.crossMap.completedCount")}`;
    const figureSummary = `${t("viz.crossMap.figurePrefix")} ${side.name}, ${countPhrase(
      counts.crosses,
      "viz.crossMap.crossesOne",
      "viz.crossMap.crosses"
    )}, ${formatInteger(counts.completed, locale)} ${t("viz.crossMap.completedCount")}`;
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

  const shotHeaders = [
    { key: "team", label: t("viz.table.team"), numeric: false },
    { key: "player", label: t("viz.table.player"), numeric: false },
    { key: "minute", label: t("viz.table.minute"), numeric: true },
    { key: "x", label: t("viz.table.x"), numeric: true },
    { key: "y", label: t("viz.table.y"), numeric: true },
    { key: "outcome", label: t("viz.table.outcome"), numeric: false },
    // FD-1: omitted entirely while every value is null.
    ...(showXg ? [{ key: "xg", label: t("viz.table.xg"), numeric: true }] : []),
  ];

  const crossHeaders = [
    { key: "team", label: t("viz.table.team"), numeric: false },
    { key: "player", label: t("viz.table.player"), numeric: false },
    { key: "minute", label: t("viz.table.minute"), numeric: true },
    { key: "x", label: t("viz.table.x"), numeric: true },
    { key: "y", label: t("viz.table.y"), numeric: true },
    { key: "delivery", label: t("viz.table.delivery"), numeric: false },
    { key: "completed", label: t("viz.table.completed"), numeric: false },
  ];

  const unknown = t("viz.table.unknown");
  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-primary";
  const textCell = "px-2 py-1.5 type-caption text-ink-primary";
  const rowClass = "border-b border-pitch-line/40";

  /*
   * Not sortable in this story: Story 2.11 owns aria-sort, the collator sort
   * and the Expert-layer instance of these same logs. It plugs in at the <th>
   * elements in DataTable and at the row arrays built here.
   */
  const shotTable = (
    <DataTable caption={t("viz.table.caption")} headers={shotHeaders}>
      {shotRows.map((row) => (
        <tr key={row.key} className={rowClass}>
          <td className={textCell}>{row.teamCode}</td>
          <td className={textCell}>{row.playerName ?? unknown}</td>
          <td className={numericCell}>{row.minuteLabel ?? unknown}</td>
          <td className={numericCell}>{formatDecimal(row.x, locale, 2)}</td>
          <td className={numericCell}>{formatDecimal(row.y, locale, 2)}</td>
          <td className={textCell}>
            {/* The suffix is how a reader reconciles an 8-row Paraguay log
                against 7 Paraguay markers. */}
            {row.ownGoal ? `${t(row.outcomeKey)} ${t("match.hero.ownGoal")}` : t(row.outcomeKey)}
          </td>
          {showXg ? (
            <td className={numericCell}>
              {row.expectedGoals === null ? unknown : formatDecimal(row.expectedGoals, locale, 2)}
            </td>
          ) : null}
        </tr>
      ))}
    </DataTable>
  );

  const crossTable = (
    <DataTable caption={t("viz.table.caption")} headers={crossHeaders}>
      {crossRows.map((row) => (
        <tr key={row.key} className={rowClass}>
          <td className={textCell}>{row.teamCode}</td>
          <td className={textCell}>{row.playerName ?? unknown}</td>
          <td className={numericCell}>{row.minuteLabel ?? unknown}</td>
          <td className={numericCell}>{formatDecimal(row.x, locale, 2)}</td>
          <td className={numericCell}>{formatDecimal(row.y, locale, 2)}</td>
          <td className={textCell}>{t(row.deliveryKey)}</td>
          <td className={textCell}>{row.completed ? t("viz.table.yes") : t("viz.table.no")}</td>
        </tr>
      ))}
    </DataTable>
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
      {shotState === "absent" ? (
        <EmptyStatePanel
          headline={emptyHeadline(shotTitle)}
          explanation={t("tactical.empty.explanation")}
        />
      ) : (
        <PitchPanel
          title={shotTitle}
          sides={[shotSide(home, "a", teamXg.home), shotSide(away, "b", teamXg.away)]}
          legend={shotLegend}
          note={ownGoalsExcluded ? t("viz.shotMap.ownGoalsExcluded") : null}
          dataTable={shotTable}
        />
      )}
      <div className="mt-section-gap">
        {crossState === "absent" ? (
          <EmptyStatePanel
            headline={emptyHeadline(crossTitle)}
            explanation={t("tactical.empty.explanation")}
          />
        ) : (
          <PitchPanel
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

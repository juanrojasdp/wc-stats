"use client";

import type { ReactNode } from "react";

import {
  DOT_SEPARATOR,
  PitchPanel,
  type PitchPanelLegendEntry,
  type PitchPanelSide,
} from "@/components/PitchPanel";
import type { DefensiveActions } from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";
import {
  anyContestType,
  defensiveFigureCount,
  defensiveLegend,
  defensiveMarkers,
  defensiveRows,
  type DefensiveLogRow,
} from "@/viz/defensive-actions-model";

/*
 * The #defensive-actions content (Story 2.9 Task 6.1) — the ONE real pitch map
 * this story ships, and the third consumer of PitchPanel.
 *
 * The two receiving sections are NOT maps and go through none of this: Story
 * 1.13 measured `ReceivingEvent` unfulfillable in all eight required fields, so
 * they read Domain G aggregates and live on cards instead.
 *
 * Props are narrow and explicit, never the whole bundle.
 */

interface SideRef {
  teamId: string;
  /** Uppercased — the on-pitch direct label. */
  teamCode: string;
  /** Display name, used in the figure summary; the on-pitch label is the code. */
  name: string;
}

export interface DefensiveActionsSectionProps {
  defensiveActions: DefensiveActions;
  home: SideRef;
  away: SideRef;
}

/*
 * The -on-pitch variants, NOT --viz-team-a/-b (ruled decision 8): these hues
 * are painted on the theme-invariant pitch, where the light-canvas variants
 * fall far below the 3:1 non-text floor. Measured for this story:
 * 9.56:1 and 7.26:1 vs --pitch-surface, 8.46 / 6.43 vs --pitch-stripe (the
 * stripe figure is not in DESIGN; measured here because markers land on it).
 */
const ACCENT_VAR = { a: "--viz-team-a-on-pitch", b: "--viz-team-b-on-pitch" } as const;

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";

function DataTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: { key: string; label: string; numeric: boolean }[];
  children: ReactNode;
}) {
  /*
   * A fourth private copy of the helper is the CURRENT CONVENTION
   * (PassNetworksSection says so explicitly). Refactoring DataTable out of
   * ShotMapsSection is Story 2.11's call, not this story's.
   *
   * On-pitch ink, because this table renders inside the panel on
   * --pitch-surface: the hairline and the canvas ink are invisible there.
   */
  return (
    <table className="w-full border-collapse text-left">
      <caption className="mb-2 text-left type-caption text-ink-on-pitch-secondary">{caption}</caption>
      <thead>
        <tr className="border-b border-pitch-line/40">
          {headers.map((header) => (
            <th
              key={header.key}
              scope="col"
              className={cn(
                "px-2 py-1.5 type-stat-label text-ink-on-pitch-secondary",
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

export function DefensiveActionsSection({
  defensiveActions,
  home,
  away,
}: DefensiveActionsSectionProps) {
  const t = useT();
  const { locale } = useLocale();

  const title = t("viz.defensiveActions.title");

  /*
   * t() has no interpolation and no plural machinery, so counters pick a
   * singular or plural key at the call site. Copied rather than shared, by the
   * current convention.
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * Built EAGERLY, outside the lazily-mounted disclosure (ruled decision 10):
   * a bad teamId names itself on load, not when a reader opens the table.
   * There is exactly ONE error boundary for all eleven Tactical sections, so a
   * throw here replaces the whole layer — which is precisely why the model
   * guards `null` and `[]` and fails loud only on a genuinely impossible id.
   */
  const markers = defensiveMarkers(
    defensiveActions,
    { ...home, colorVar: ACCENT_VAR.a },
    { ...away, colorVar: ACCENT_VAR.b }
  );
  const rows: DefensiveLogRow[] = defensiveRows(defensiveActions, home, away);
  const showContestType = anyContestType(rows);

  function side(ref: SideRef, accent: "a" | "b", mine: typeof markers.home): PitchPanelSide {
    const counts = defensiveFigureCount(mine);
    /*
     * The chip carries the TOTAL and nothing else — a DECLARED reading of
     * ruled decision 5's "any count chip enumerates only the types actually
     * present, never a fixed four". Enumerating the present types beside a
     * legend that deliberately refuses to distinguish them (decision 19: one
     * shape, one colour per team, so forced-turnover and possession-regain are
     * visually identical) would re-introduce exactly the distinction the map
     * does not draw. The per-type breakdown reaches the reader through three
     * non-visual carriers instead: each marker's accessible name, its popover,
     * and the log table's action-type column.
     */
    const phrase = countPhrase(
      counts.total,
      "viz.defensiveActions.actionsOne",
      "viz.defensiveActions.actions"
    );
    return {
      teamCode: ref.teamCode,
      accent,
      markers: mine,
      metaLine: phrase,
      figureSummary: `${t("viz.defensiveActions.figurePrefix")} ${ref.name}, ${phrase}`,
      zeroLine: t("viz.defensiveActions.zero"),
    };
  }

  /*
   * ONE ENTRY PER TEAM (ruled decision 19). A per-type legend would claim a
   * distinction the map does not draw; a side that drew nothing is dropped by
   * the model, because a swatch for an absent mark is its own small lie.
   */
  const legendNoun = t("viz.defensiveActions.legendNoun");
  const legend: PitchPanelLegendEntry[] = defensiveLegend([
    {
      colorVar: ACCENT_VAR.a,
      label: `${home.teamCode}${DOT_SEPARATOR}${legendNoun}`,
      markerCount: markers.home.length,
    },
    {
      colorVar: ACCENT_VAR.b,
      label: `${away.teamCode}${DOT_SEPARATOR}${legendNoun}`,
      markerCount: markers.away.length,
    },
  ]);

  const headers = [
    { key: "team", label: t("viz.table.team"), numeric: false },
    { key: "player", label: t("viz.table.player"), numeric: false },
    { key: "minute", label: t("viz.table.minute"), numeric: true },
    { key: "x", label: t("viz.table.x"), numeric: true },
    { key: "y", label: t("viz.table.y"), numeric: true },
    { key: "actionType", label: t("viz.table.actionType"), numeric: false },
    /*
     * A WHOLE-COLUMN decision on the FD-1 precedent (ruled decision 20): on
     * corpus-real data `contest_type` is null on 20,169/20,169, so a per-cell
     * em dash would ship a column of 20,169 em dashes. The column is absent
     * entirely unless some row carries a value.
     */
    ...(showContestType ? [{ key: "contestType", label: t("viz.table.contestType"), numeric: false }] : []),
  ];

  const unknown = t("viz.table.unknown");
  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-on-pitch";
  const textCell = "px-2 py-1.5 type-caption text-ink-on-pitch";

  /*
   * viz.table.caption ("Ordenado por minuto.") is legitimate HERE — unlike the
   * two receiving tables, these rows carry a real clock in the contract — and
   * the caption names its own panel so a reader listing the page's tables gets
   * distinguishable entries.
   *
   * Not sortable in this story: Story 2.11 owns aria-sort, the
   * Intl.Collator('es') sort and the Expert-layer instance of this same log. It
   * plugs in at the <th> elements above and at the row array below.
   */
  const caption = `${title}${CAPTION_SEPARATOR}${t("viz.table.caption")}`;

  const dataTable = (
    <DataTable caption={caption} headers={headers}>
      {rows.map((row) => (
        <tr key={row.key} className="border-b border-pitch-line/40">
          <td className={textCell}>{row.teamCode}</td>
          <td className={textCell}>{row.playerName ?? unknown}</td>
          <td className={numericCell}>{row.minuteLabel ?? unknown}</td>
          <td className={numericCell}>{formatDecimal(row.x, locale, 2)}</td>
          <td className={numericCell}>{formatDecimal(row.y, locale, 2)}</td>
          <td className={textCell}>{t(row.actionTypeKey)}</td>
          {showContestType ? (
            <td className={textCell}>
              {row.contestTypeKey === null ? unknown : t(row.contestTypeKey)}
            </td>
          ) : null}
        </tr>
      ))}
    </DataTable>
  );

  /*
   * NO `selection` (ruled decision 18): pinning exists to isolate a node's
   * RELATIONSHIPS, and this map has no edges and no relationships, so there is
   * nothing to isolate. With `selection` absent PitchPanel is byte-identical to
   * its pre-2.8 behaviour — no aria-pressed, no dimming, no selection ring.
   *
   * NO `underlay`, and NO `extent`: there is no extent prop at all. PitchPanel
   * pools one internally from BOTH sides' markers, and defensive-action x spans
   * 8.3–64.3 on every fixture, so `pitchExtentFor` returns {xMin: 0} on its own
   * and the full pitch — halfway line, centre circle, centre spot — arrives for
   * free (ruled decision 9).
   */
  return (
    <PitchPanel
      title={title}
      sides={[side(home, "a", markers.home), side(away, "b", markers.away)]}
      legend={legend}
      dataTable={dataTable}
    />
  );
}

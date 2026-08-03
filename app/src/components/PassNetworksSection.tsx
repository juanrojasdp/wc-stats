"use client";

import { useState, type ReactNode } from "react";

import { EmptyStatePanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import {
  DOT_SEPARATOR,
  PitchPanel,
  type PitchPanelLegendEntry,
  type PitchPanelSide,
} from "@/components/PitchPanel";
import type {
  PassNetworkEdgeTable,
  PassNetworkNodeTable,
} from "@/lib/contract/contract-types";
import { formatDecimal, formatInteger } from "@/lib/format";
import type { DictionaryKey } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-provider";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { PitchMarker } from "@/viz/marker-model";
import {
  EDGE_DIM_OPACITY,
  EDGE_STROKE_PX,
  EDGE_WEIGHT_VARS,
  dimmedNodeKeys,
  edgeWeightThresholds,
  incidentEdgeKeys,
  involvementDomain,
  nodeKey,
  passEdgeRows,
  passNetworkEdgeGeometry,
  passNetworkFigureCounts,
  passNetworkMarkers,
  passNodeRows,
  playerIdFromNodeKey,
  quintileBands,
  teamIdOfPlayer,
  visibleEdgeGeometry,
  type PassEdgeSegment,
} from "@/viz/pass-network-model";
import type { Projection } from "@/viz/pitch-geometry";

/*
 * The #pass-networks content (Task 5). One PitchPanel, two role="figure"
 * pitches — the second consumer of Story 2.7's reusable panel rather than a
 * second pitch renderer.
 *
 * The split of labour is ruled (decision 1): NODES are PitchMarkers, so they
 * inherit the shared per-panel extent, the Voronoi hit cells, the >=44 px
 * floor, clustering, the popover, roving tabindex, the focus ring and the
 * role="figure" wrapper for free. EDGES ride the panel's `underlay` seam, which
 * renders inside the aria-hidden decorative group beneath both the hit layer
 * and the marker layer — so they are aria-hidden, non-interactive and painted
 * under the nodes, all of which is correct.
 *
 * The pitch is FULL here without anyone asking for it: every team-inning has
 * nodes behind halfway (fixture x spans 20.21-79.71), so pitchExtentFor returns
 * {xMin: 0} on its own and brings the halfway line, centre circle and centre
 * spot with it. No extent is passed and none should be.
 */

interface SideRef {
  teamId: string;
  /** Uppercased — the on-pitch direct label. */
  teamCode: string;
  /** The display name, used in the figure summary (AD-7: untranslated). */
  name: string;
}

export interface PassNetworksSectionProps {
  nodes: PassNetworkNodeTable;
  edges: PassNetworkEdgeTable;
  home: SideRef;
  away: SideRef;
}

/*
 * The -on-pitch accents, never --viz-team-a/-b: those carry .light overrides
 * (#4d7c0f / #0e7490) that compute 2.44:1 and 2.28:1 on the theme-invariant
 * green against a 3:1 floor. A theme-invariant surface may only carry
 * theme-invariant ink (Story 2.7 code review).
 */
const ACCENT_VAR = { a: "--viz-team-a-on-pitch", b: "--viz-team-b-on-pitch" } as const;

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const CAPTION_SEPARATOR = " — ";
const RANGE_SEPARATOR = "–";
/** Joins the two panel notes into `PitchPanelProps.note`, which takes one string. */
const NOTE_SEPARATOR = " ";

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
    /*
     * {components.data-table}: row dividers, NO zebra striping, --pitch-line/40
     * rather than --border-hairline because this table renders inside the panel
     * on the deep-green pitch. Private and duplicated from ShotMapsSection by
     * the current convention — refactoring that component is out of scope here.
     */
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

export function PassNetworksSection({ nodes, edges, home, away }: PassNetworksSectionProps) {
  const t = useT();
  const { locale } = useLocale();
  const emptyHeadline = useEmptyHeadline();

  /*
   * State, ALL owned here (ruled decision 5). PitchPanel reports activations
   * and renders state; it cannot own this, because the consumer is the only
   * thing that can dim edges drawn in its own underlay.
   *
   * Keyed on a stable `playerId`, never an array index — that is the direct
   * lesson of Story 2.7's stale-index defect, where a leftover index read
   * `undefined` out of a width-derived array, passed an `!== null` guard and
   * threw the whole Tactical section into the error boundary.
   */
  const [isolated, setIsolated] = useState<string | null>(null);
  const [showAllPasses, setShowAllPasses] = useState(false);
  /*
   * A second subscription alongside PitchPanel's own costs nothing and cannot
   * desync: the hook caches one MediaQueryList per query, so both read the same
   * object. getServerSnapshot returns false, so the first client render is <md
   * and the toggle mounts then unmounts once at >=md — shipped 2.7 behaviour.
   */
  const isMd = useMediaQuery(MD_MEDIA_QUERY);

  const title = t("viz.passNetwork.title");

  /*
   * t() has no interpolation and a template literal in a gated prop is a lint
   * error, so every composed string becomes an identifier first. Counters pick
   * a singular or plural key: "1 conexiones" is a visible copy defect, and a
   * degree-1 node is common.
   */
  function countPhrase(count: number, one: DictionaryKey, many: DictionaryKey): string {
    return `${formatInteger(count, locale)} ${t(count === 1 ? one : many)}`;
  }

  /*
   * Decision 13: `null` on EITHER table means the whole section is absent, and
   * TacticalLayer renders that empty state ABOVE this component — so this
   * branch is unreachable through the app. It reads the field anyway for the
   * same reason sectionDataState does: the bundle is unvalidated `as`-cast
   * JSON, and rendering a crash instead of an absence is strictly worse.
   */
  if (nodes === null || edges === null) {
    return (
      <EmptyStatePanel headline={emptyHeadline(title)} explanation={t("tactical.empty.explanation")} />
    );
  }

  /*
   * Both pooled across BOTH sides, for the same reason the pitch extent is: two
   * side-by-side panels on different scales with no axis are unfalsifiable by
   * eye (UX-DR23's "identical scales per side").
   */
  const domain = involvementDomain(nodes);
  const thresholds = edgeWeightThresholds(edges);

  /** The marker's middle accessible-name clause — its name/role/VALUE triple. */
  function valuePhrase({
    involvement,
    degree,
  }: {
    involvement: number | null;
    degree: number;
  }): string {
    const connections = countPhrase(
      degree,
      "viz.passNetwork.connectionsCountOne",
      "viz.passNetwork.connectionsCount"
    );
    if (involvement === null) {
      // The source could not fill `involvement`; report only what is real
      // rather than speaking a placeholder glyph.
      return connections;
    }
    const passes = countPhrase(involvement, "viz.passNetwork.passesOne", "viz.passNetwork.passes");
    return `${passes} ${t("viz.passNetwork.nameJoin")} ${connections}`;
  }

  const sideRefs: [SideRef, SideRef] = [home, away];
  const accents = ["a", "b"] as const;

  const markersBySide = sideRefs.map((side, index) =>
    passNetworkMarkers(nodes, edges, side.teamId, ACCENT_VAR[accents[index]], domain, valuePhrase)
  );
  const geometryBySide = sideRefs.map((side) =>
    passNetworkEdgeGeometry(nodes, edges, side.teamId, thresholds)
  );

  /** <md declutter: hide the lowest weight quintile behind the toggle. */
  const hideLowestQuintile = !isMd && !showAllPasses;

  /*
   * Resolved ONCE and reused by the underlay, the counts and the legend, so all
   * three describe the same ink (2.8 code review, ruled by Juan). Counting the
   * unfiltered geometry made the meta line and the role="figure" label
   * over-report at the <md default — m001 announced "20 conexiones" with 16
   * lines drawn, South Africa 33 vs 25, m074 Paraguay 21 vs 15 — and the legend
   * kept advertising a stop-1 band with nothing in it. Task 2.10's "counted
   * from the marks actually drawn" is read literally: the counts move when
   * "Mostrar todos los pases" flips, which is the disclosure working, and the
   * full numbers are always in the data table (SM-C2).
   */
  const visibleBySide = geometryBySide.map((geometry) =>
    visibleEdgeGeometry(geometry, thresholds, hideLowestQuintile)
  );

  function panelSide(index: number): PitchPanelSide {
    const side = sideRefs[index];
    const markers: PitchMarker[] = markersBySide[index];
    // Counts come from the marks THIS PANEL DREW, never from keyStatistics.
    const counts = passNetworkFigureCounts(markers, visibleBySide[index]);
    const players = countPhrase(
      counts.players,
      "viz.passNetwork.playersOne",
      "viz.passNetwork.players"
    );
    const connections = countPhrase(
      counts.connections,
      "viz.passNetwork.connectionsCountOne",
      "viz.passNetwork.connectionsCount"
    );
    const metaLine = `${players}${DOT_SEPARATOR}${connections}`;
    const figureSummary = `${t("viz.passNetwork.figurePrefix")} ${side.name}, ${players}, ${connections}`;
    return {
      teamCode: side.teamCode,
      accent: accents[index],
      markers,
      metaLine,
      figureSummary,
      zeroLine: t("viz.passNetwork.zero"),
    };
  }

  const isolatedTeamId = teamIdOfPlayer(nodes, isolated);
  const isolatedEdgeKeys = isolated === null ? new Set<string>() : incidentEdgeKeys(edges, isolated);

  /*
   * NODE dimming is a PitchPanel concern, not the underlay's: nodes are markers
   * rendered in a different <g> from the underlay, so the closure cannot reach
   * them. Both sides are asked, and the one the isolated player is not on
   * returns an empty set (decision 15) — dimming a whole second team because a
   * player on the first was pinned communicates nothing and destroys the
   * comparison the two-figure panel exists for.
   */
  const dimmedKeys = new Set<string>([
    ...dimmedNodeKeys(nodes, edges, home.teamId, isolated),
    ...dimmedNodeKeys(nodes, edges, away.teamId, isolated),
  ]);

  function edgeOpacity(segment: PassEdgeSegment, sideTeamId: string): number | undefined {
    if (isolated === null || isolatedTeamId !== sideTeamId) {
      return undefined;
    }
    return isolatedEdgeKeys.has(segment.key) ? undefined : EDGE_DIM_OPACITY;
  }

  function underlay(projection: Projection, _size: unknown, sideIndex: number): ReactNode {
    const sideTeamId = sideRefs[sideIndex]?.teamId;
    const geometry = visibleBySide[sideIndex];
    if (sideTeamId === undefined || geometry === undefined) {
      // `array[i] ?? null`, never a bare `!== null`: any read of a width-derived
      // array by stored index must survive a reflow that shortened it.
      return null;
    }
    return (
      <g fill="none" strokeLinecap="round">
        {geometry.map((segment) => {
          const from = projection(segment.x1, segment.y1);
          const to = projection(segment.x2, segment.y2);
          return (
            <line
              key={segment.key}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              /*
               * Absolute CSS px, NOT viewBox-scaled: the panel renders
               * width={W} height={H} viewBox="0 0 W H", so one unit is one px.
               * No vector-effect, no scaling with container width.
               */
              stroke={`var(${EDGE_WEIGHT_VARS[segment.stop - 1]})`}
              strokeWidth={EDGE_STROKE_PX[segment.stop - 1]}
              opacity={edgeOpacity(segment, sideTeamId)}
            />
          );
        })}
      </g>
    );
  }

  /*
   * Five labelled bands rather than the mockup's two-word unlabelled gradient
   * ("menos pases … más pases") — a DECLARED DEVIATION. Stating the numbers is
   * what makes a ramp whose adjacent stops separate by only ~1.3:1 legible at
   * all, and the width half of the dual encoding is only readable against a
   * stated range. No team swatches: the two per-figure team-code labels
   * discharge UX-DR11 directly, so hue never carries the team distinction.
   */
  const volumes = edges.map((edge) => edge.volume).filter((volume) => Number.isFinite(volume));
  /*
   * NO legend when there are no edges (2.8 review). quintileBands([], 0, 0)
   * returned a single band {from: 0, to: 0} and rendered one swatch labelled
   * "0" — a weight the contract forbids (PassNetworkEdge.volume is
   * `minimum: 1`), asserted on a panel that drew no lines at all.
   * `passNetworkEdges: []` is an explicitly supported ready state.
   *
   * And the stop-1 band is dropped whenever it is being hidden, so the legend
   * never explains ink that is not on the pitch (ruled decision 3 of the
   * review). The toggle restores band and edges together.
   */
  const legendBands =
    volumes.length === 0
      ? []
      : quintileBands(thresholds, Math.min(...volumes), Math.max(...volumes)).filter(
          (band) => !(hideLowestQuintile && thresholds.length > 0 && band.stop === 1)
        );
  const legend: PitchPanelLegendEntry[] = legendBands.map((band) => {
    const from = formatInteger(band.from, locale);
    const to = formatInteger(band.to, locale);
    return {
      kind: "stroke" as const,
      colorVar: EDGE_WEIGHT_VARS[band.stop - 1],
      widthPx: EDGE_STROKE_PX[band.stop - 1],
      label: band.from === band.to ? from : `${from}${RANGE_SEPARATOR}${to}`,
    };
  });

  // `{t(cond ? "a" : "b")}` fails the i18n gate; the key is hoisted.
  const toggleKey: DictionaryKey = showAllPasses
    ? "viz.passNetwork.showLess"
    : "viz.passNetwork.showAll";
  const controls =
    isMd || thresholds.length === 0 ? null : (
      <button
        type="button"
        onClick={() => setShowAllPasses((previous) => !previous)}
        className={cn(
          "min-h-11 rounded-sm px-2 type-caption text-ink-on-pitch underline underline-offset-2",
          showAllPasses && "text-ink-on-pitch-secondary"
        )}
      >
        {t(toggleKey)}
      </button>
    );

  /*
   * Rows are built EAGERLY, not inside the lazily-mounted disclosure, so an
   * unresolvable teamId or a node-less edge endpoint throws on LOAD rather than
   * when a reader opens the table — inside TacticalErrorBoundary, which
   * contains it (the ShotMapsSection precedent).
   */
  const nodeRows = passNodeRows(nodes, home, away);
  const edgeRows = passEdgeRows(edges, nodes, home, away);

  const unknown = t("viz.table.unknown");
  const numericCell = "px-2 py-1.5 text-right type-table-numeric text-ink-on-pitch";
  const textCell = "px-2 py-1.5 type-caption text-ink-on-pitch";
  const rowClass = "border-b border-pitch-line/40";

  const nodeHeaders = [
    { key: "team", label: t("viz.table.team"), numeric: false },
    { key: "shirt", label: t("viz.table.shirt"), numeric: true },
    { key: "player", label: t("viz.table.player"), numeric: false },
    { key: "x", label: t("viz.table.x"), numeric: true },
    { key: "y", label: t("viz.table.y"), numeric: true },
    { key: "involvement", label: t("viz.table.involvement"), numeric: true },
  ];

  const edgeHeaders = [
    { key: "team", label: t("viz.table.team"), numeric: false },
    { key: "from", label: t("viz.table.from"), numeric: false },
    { key: "to", label: t("viz.table.to"), numeric: false },
    { key: "passes", label: t("viz.table.passes"), numeric: true },
  ];

  /*
   * TWO tables in the ONE disclosure region, because the figure encodes two
   * things and UX-DR16 demands the same numbers for both: the node table is the
   * x/y/involvement alternative, the edge table is EXPERIENCE's "full
   * pass-matrix edges in table form". An 11x11 grid is explicitly not what the
   * contract asks for and would be ~121 cells of which ~20 are non-empty.
   *
   * Each caption names its own table AND its own real order — two identical
   * captions on one page was patched in the 2.7 review precisely because a
   * reader listing the page's tables got two indistinguishable entries.
   *
   * NOT sortable in this story: Story 2.11 owns aria-sort, the Intl.Collator
   * sort and the Expert-layer instance of these same tables. UX-DR16's floor —
   * a reachable data table carrying the same numbers — is met in full here.
   */
  /*
   * BOTH channels are named. nodeNote alone explained node size and left the
   * five legend bands as bare integers with no unit anywhere on the panel —
   * and every swatch is aria-hidden, so a screen reader heard five naked
   * numbers (2.8 review).
   */
  const panelNote = `${t("viz.passNetwork.nodeNote")}${NOTE_SEPARATOR}${t("viz.passNetwork.edgeNote")}`;

  const nodeCaption = `${title}${CAPTION_SEPARATOR}${t("viz.table.captionNodes")}`;
  const edgeCaption = `${title}${CAPTION_SEPARATOR}${t("viz.table.captionEdges")}`;

  const dataTable = (
    <div className="flex flex-col gap-tile-gap">
      <DataTable caption={nodeCaption} headers={nodeHeaders}>
        {nodeRows.map((row) => (
          <tr key={row.key} className={rowClass}>
            <td className={textCell}>{row.teamCode}</td>
            <td className={numericCell}>
              {row.shirtNumber === null ? unknown : formatInteger(row.shirtNumber, locale)}
            </td>
            {/* Plain text, never a link: /players/{slug} does not exist, and
                UX-DR22's cross-link is scoped to LINEUP player names. */}
            <td className={textCell}>{row.playerName ?? unknown}</td>
            <td className={numericCell}>
              {row.x === null ? unknown : formatDecimal(row.x, locale, 2)}
            </td>
            <td className={numericCell}>
              {row.y === null ? unknown : formatDecimal(row.y, locale, 2)}
            </td>
            <td className={numericCell}>
              {row.involvement === null ? unknown : formatInteger(row.involvement, locale)}
            </td>
          </tr>
        ))}
      </DataTable>
      <DataTable caption={edgeCaption} headers={edgeHeaders}>
        {edgeRows.map((row) => (
          <tr key={row.key} className={rowClass}>
            <td className={textCell}>{row.teamCode}</td>
            <td className={textCell}>{row.fromName ?? unknown}</td>
            <td className={textCell}>{row.toName ?? unknown}</td>
            <td className={numericCell}>
              {row.volume === null ? unknown : formatInteger(row.volume, locale)}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );

  return (
    <PitchPanel
      title={title}
      sides={[panelSide(0), panelSide(1)]}
      legend={legend}
      note={panelNote}
      dataTable={dataTable}
      underlay={underlay}
      controls={controls}
      selection={{
        selectedKey: isolated === null ? null : nodeKey(isolated),
        dimmedKeys,
        /*
         * A second activation of the same node clears — the toggle half of
         * "tap/Enter toggles isolation" — and isolation is PINNED-ONLY: focus
         * never sets it, because announcing aria-pressed="true" on mere focus
         * would report a state the reader has not set.
         */
        onToggle: (markerKey) => {
          const playerId = playerIdFromNodeKey(markerKey);
          if (playerId === null) {
            return;
          }
          setIsolated((previous) => (previous === playerId ? null : playerId));
        },
        onClear: () => setIsolated(null),
      }}
    />
  );
}

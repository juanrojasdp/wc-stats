"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ViewDataDisclosure } from "@/components/ViewDataDisclosure";
import { formatDecimal, formatInteger } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n-provider";
import { useElementWidth } from "@/lib/use-element-width";
import { MD_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { clusterCentroid, clusterMarkers, hitCells } from "@/viz/marker-layout";
import {
  GOAL_RING_STROKE_PX,
  HOLLOW_STROKE_PX,
  MARKER_RADIUS_PX,
  SQUARE_SIDE_PX,
  type MarkerShape,
  type MarkerValue,
  type PitchMarker,
} from "@/viz/marker-model";
import {
  panelSize,
  pitchExtentFor,
  pitchMarkings,
  project,
  type PitchExtent,
  type PitchOrientation,
  type Projection,
  type Size,
} from "@/viz/pitch-geometry";

/*
 * The reusable pitch panel (Task 6) — the story's reuse deliverable. Stories
 * 2.8 (pass network) and 2.9 (receiving / defensive-action maps) build on this,
 * so every shot- or cross-specific decision is kept OUT of it: this component
 * knows about markers, clusters, hit cells, popovers and keyboard roving, and
 * nothing about outcomes, own goals or delivery types.
 *
 * Every string crossing the props boundary is ALREADY RESOLVED, the same reason
 * EmptyStatePanel takes resolved headline/explanation: `label`, `caption`,
 * `text`, `description` and `title` are gated prop names, so a literal there is
 * a lint error and a t() call at the call site is the only clean path.
 */

/** DESIGN: pitch drawings keep an internal padding of at least {spacing.tile-gap}. */
const PAD_PX = 12;

/** First-paint width before ResizeObserver reports; a typical <md content box. */
const FALLBACK_WIDTH_PX = 320;

/** Popover box width, used to clamp it inside the panel without measuring. */
const POPOVER_WIDTH_PX = 224;

/** Gap between a cluster centroid and its popover. */
const POPOVER_OFFSET_PX = 12;

/**
 * Floor for the popover's clamped height: one 44px row plus its chrome stays
 * usable even when the centroid sits hard against the edge it opens toward.
 */
const POPOVER_MIN_HEIGHT_PX = 96;

// Separator glyphs are module consts, never bare JSX literals (i18n gate).
const DOT_SEPARATOR = " · ";
const ROW_SEPARATOR = ": ";
const NAME_SEPARATOR = ", ";

export interface PitchPanelSide {
  /** Uppercased team code — the direct label (UX-DR11). */
  teamCode: string;
  /** Team A = home (--viz-team-a), Team B = away (--viz-team-b). */
  accent: "a" | "b";
  /** `[]` renders the pitch plus a zero-content line, never an empty state. */
  markers: PitchMarker[];
  /** Already-resolved chip text, e.g. "xG 1,78 · 16 tiros". */
  metaLine: string;
  /** Already-resolved one-sentence figure aria-label. */
  figureSummary: string;
  /** Already-resolved copy for markers.length === 0. */
  zeroLine: string;
}

export interface PitchPanelLegendEntry {
  shape: MarkerShape;
  colorVar: string;
  label: string;
}

export interface PitchPanelProps {
  /** Resolved; rendered as <h3>. */
  title: string;
  sides: [PitchPanelSide, PitchPanelSide];
  legend: PitchPanelLegendEntry[];
  /** e.g. the own-goals-excluded line. */
  note?: string | null;
  /** The "Ver los datos" region content. */
  dataTable: ReactNode;
  /** One-line forward seam for Story 2.8's pass-network edges. Unused here. */
  underlay?: (projection: Projection, size: Size) => ReactNode;
}

/** Which popover is open, panel-wide: UX-DR15 bans a stack deeper than one. */
interface OpenPopover {
  sideIndex: number;
  clusterIndex: number;
  /** The marker that opened it — focus returns here on Esc. */
  markerIndex: number;
  /** `hover` is the aria-hidden visual panel; `dialog` is the real cluster list. */
  mode: "hover" | "dialog";
}

/**
 * ONE glyph renderer for both the on-pitch markers and the legend swatches.
 * The mockup hand-writes the swatch SVG a second time, and that is exactly how
 * a legend drifts out of sync with the map it explains.
 *
 * Drawn around the origin so the caller positions it with a translate.
 */
export function MarkerShapeGlyph({
  shape,
  colorVar,
  radius = MARKER_RADIUS_PX,
}: {
  shape: MarkerShape;
  colorVar: string;
  radius?: number;
}) {
  const color = `var(${colorVar})`;
  const scale = radius / MARKER_RADIUS_PX;
  const side = SQUARE_SIDE_PX * scale;
  const hollowStroke = HOLLOW_STROKE_PX * scale;
  switch (shape) {
    case "circle-filled-ring":
      return (
        <circle
          r={radius}
          fill={color}
          /*
           * --ink-on-pitch, not --ink-primary: the ring is drawn on the
           * theme-invariant pitch, and the light canvas ink computed 1.45:1
           * there, erasing the one mark that distinguishes a goal. Deliberately
           * NOT --focus-ring-on-pitch, which must keep meaning "focus" alone —
           * a focused goal marker would otherwise be indistinguishable.
           */
          stroke="var(--ink-on-pitch)"
          strokeWidth={GOAL_RING_STROKE_PX * scale}
        />
      );
    case "circle-filled":
      return <circle r={radius} fill={color} />;
    case "circle-hollow":
      // Inset by half the stroke so the drawn edge lands on the nominal radius.
      return (
        <circle r={radius - hollowStroke / 2} fill="none" stroke={color} strokeWidth={hollowStroke} />
      );
    case "square-filled":
      return <rect x={-side / 2} y={-side / 2} width={side} height={side} fill={color} />;
    case "square-hollow": {
      const inner = side - hollowStroke;
      return (
        <rect
          x={-inner / 2}
          y={-inner / 2}
          width={inner}
          height={inner}
          fill="none"
          stroke={color}
          strokeWidth={hollowStroke}
        />
      );
    }
    default: {
      // Markers come from viz models over generated unions, but those models
      // read `as`-cast bundle data — an unmapped shape must name itself rather
      // than render an invisible marker.
      const unexpected: never = shape;
      throw new Error(`PitchPanel: unknown marker shape ${JSON.stringify(unexpected)}`);
    }
  }
}

/** The layout a side's markers resolve to at the measured width. */
interface FigureLayout {
  size: Size;
  projection: Projection;
  points: { cx: number; cy: number }[];
  clusters: number[][];
  centroids: { cx: number; cy: number }[];
  cells: (string | null)[];
  /** marker index -> cluster index. */
  clusterOfMarker: number[];
}

function PitchDrawing({
  orientation,
  layout,
  extentIsFull,
  underlay,
}: {
  orientation: PitchOrientation;
  layout: FigureLayout;
  extentIsFull: boolean;
  underlay?: (projection: Projection, size: Size) => ReactNode;
}) {
  const markings = useMemo(
    () =>
      pitchMarkings(
        orientation,
        { xMin: extentIsFull ? 0 : 50 },
        layout.size,
        PAD_PX
      ),
    [orientation, extentIsFull, layout.size]
  );
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={layout.size.width}
        height={layout.size.height}
        fill="var(--pitch-surface)"
      />
      {markings.stripes.map((stripe, index) => (
        <rect key={index} {...stripe} fill="var(--pitch-stripe)" />
      ))}
      <g fill="none" stroke="var(--pitch-line)" strokeWidth={1.5}>
        <rect {...markings.boundary} />
        <rect {...markings.penaltyArea} />
        <rect {...markings.sixYardBox} />
        <path d={markings.penaltyArc} />
        {markings.centreCircle === null ? null : <path d={markings.centreCircle} />}
        {markings.halfwayLine === null ? null : <line {...markings.halfwayLine} />}
        <rect {...markings.goal} />
      </g>
      <circle {...markings.penaltySpot} fill="var(--pitch-line)" />
      {markings.centreSpot === null ? null : (
        <circle {...markings.centreSpot} fill="var(--pitch-line)" />
      )}
      {underlay?.(layout.projection, layout.size)}
    </g>
  );
}

function DetailRows({ marker }: { marker: PitchMarker }) {
  const t = useT();
  const { locale } = useLocale();

  function renderValue(value: MarkerValue): string {
    switch (value.kind) {
      case "text":
        return value.value;
      case "key":
        return t(value.value);
      case "number":
        // @/lib/format is the only formatting path and it needs the locale,
        // which only this component has — the same split as KEY_STAT_FORMAT.
        return value.digits === 0
          ? formatInteger(value.value, locale)
          : formatDecimal(value.value, locale, value.digits);
      default: {
        const unexpected: never = value;
        throw new Error(`PitchPanel: unknown marker value ${JSON.stringify(unexpected)}`);
      }
    }
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      {marker.detail.map((row) => (
        <div key={row.labelKey} className="contents">
          <dt className="type-caption text-ink-secondary">
            {t(row.labelKey)}
            {ROW_SEPARATOR}
          </dt>
          <dd className="type-caption text-ink-primary">{renderValue(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function PitchFigure({
  side,
  sideIndex,
  orientation,
  extent,
  open,
  onOpen,
  onClose,
  underlay,
}: {
  side: PitchPanelSide;
  sideIndex: number;
  orientation: PitchOrientation;
  /**
   * Computed ONCE per panel from both sides' markers, never per side. A
   * per-side extent let one team's long-range attempt flip that side alone to a
   * full pitch, so the two figures rendered at different metres-per-pixel and
   * different heights, side by side, with no axis to reveal it — in a component
   * whose whole purpose is comparing the two teams. Amends Task 2.4 / ruled
   * decision 3 from "per panel side" to "per panel" (Story 2.7 code review).
   */
  extent: PitchExtent;
  open: OpenPopover | null;
  onOpen: (next: OpenPopover) => void;
  onClose: () => void;
  underlay?: (projection: Projection, size: Size) => ReactNode;
}) {
  const t = useT();
  const [measureRef, width] = useElementWidth(FALLBACK_WIDTH_PX);
  const [activeMarker, setActiveMarker] = useState(0);
  /** Which member of a cluster is drawn on top / described by the popover. */
  const [frontOfCluster, setFrontOfCluster] = useState<Record<number, number>>({});
  const markerRefs = useRef<(SVGGElement | null)[]>([]);
  const listRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const figureRef = useRef<HTMLElement | null>(null);
  const dialogId = useId();

  const markers = side.markers;

  /*
   * Everything geometric recomputes together, keyed on the measured width, the
   * orientation, the extent and the markers themselves (Task 5.3). At most ~120
   * markers per panel (m074's 72 crosses is the fixture worst case), so no
   * virtualization and no throttling beyond what ResizeObserver already gives.
   */
  const layout = useMemo<FigureLayout>(() => {
    const size = panelSize(orientation, extent, width);
    const projection = project(orientation, extent, size, PAD_PX);
    const points = markers.map((marker) => projection(marker.x, marker.y));
    const clusters = clusterMarkers(points);
    const centroids = clusters.map((cluster) => clusterCentroid(points, cluster));
    /*
     * Cells are seeded on the MARKERS, not on the cluster centroids, so the
     * partition is by nearest MARKER exactly as AC 3 words it. Seeding on
     * centroids looked equivalent and is not: a single-link cluster can chain
     * arbitrarily far, putting its own outlying member closer to a neighbouring
     * cluster's centroid than to its own — a click dead-centre on a marker then
     * opened a popover that did not contain it. Reproduced on all three
     * fixtures at 320/386/527/768 px (12 cases, incl. m074 Germany's crosses at
     * the shipped >=lg width), which is why this is per-marker now.
     *
     * The cluster is still the hit UNIT: every cell dispatches through
     * clusterOfMarker, so a cluster's effective target is the union of its
     * members' cells — a superset of the old single centroid cell, so the
     * >=44px floor is not weakened by the change.
     */
    const cells = hitCells(points, [0, 0, size.width, size.height]);
    const clusterOfMarker: number[] = new Array(markers.length).fill(0);
    clusters.forEach((cluster, clusterIndex) => {
      for (const markerIndex of cluster) {
        clusterOfMarker[markerIndex] = clusterIndex;
      }
    });
    return { size, projection, points, clusters, centroids, cells, clusterOfMarker };
  }, [orientation, extent, width, markers]);

  /*
   * Clamped at READ time rather than synced in an effect: a shorter marker list
   * must not leave the roving index pointing past the end, and deriving it here
   * avoids the cascading render an effect-with-setState would cost.
   */
  const activeIndex = activeMarker < markers.length ? activeMarker : 0;

  /**
   * The cluster member currently on top. Verified against the cluster's own
   * membership because a resize re-clusters, and a stored index from the
   * previous layout may no longer belong to this cluster — and against the
   * cluster's EXISTENCE, because the cluster count itself shrinks as the panel
   * widens (the story's own measurement: 12 cells at 1920px, 4 at 386px).
   */
  function frontOf(clusterIndex: number): number | null {
    const cluster = layout.clusters[clusterIndex];
    if (cluster === undefined) {
      return null;
    }
    const stored = frontOfCluster[clusterIndex];
    return stored !== undefined && cluster.includes(stored) ? stored : cluster[0];
  }

  const isOpenHere = open !== null && open.sideIndex === sideIndex;

  const focusMarker = useCallback((index: number) => {
    setActiveMarker(index);
    markerRefs.current[index]?.focus();
  }, []);

  function openClusterOf(markerIndex: number, mode: OpenPopover["mode"]) {
    const clusterIndex = layout.clusterOfMarker[markerIndex];
    setFrontOfCluster((previous) => ({ ...previous, [clusterIndex]: markerIndex }));
    onOpen({ sideIndex, clusterIndex, markerIndex, mode });
  }

  function onMarkerKeyDown(event: React.KeyboardEvent, index: number) {
    // No wrap: Home/End are the ends, and arrowing past the last marker must
    // not silently restart the match.
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusMarker(Math.min(index + 1, markers.length - 1));
        return;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusMarker(Math.max(index - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        focusMarker(0);
        return;
      case "End":
        event.preventDefault();
        focusMarker(markers.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        openClusterOf(index, layout.clusters[layout.clusterOfMarker[index]].length > 1 ? "dialog" : "hover");
        return;
      case "Escape":
        if (isOpenHere) {
          event.preventDefault();
          onClose();
        }
        return;
      default:
    }
  }

  /** Pointer entry point: a click always resolves through the cell layer. */
  function onCellActivate(clusterIndex: number) {
    const cluster = layout.clusters[clusterIndex];
    const front = frontOf(clusterIndex);
    if (cluster === undefined || front === null) {
      return;
    }
    const isRepeat =
      isOpenHere && open !== null && open.clusterIndex === clusterIndex && open.mode !== "hover";
    if (isRepeat && cluster.length > 1) {
      // Repeat click cycles the stack's z-order — the only thing that gives a
      // mouse user access to a marker hidden under another.
      const position = cluster.indexOf(front);
      const next = cluster[(position + 1) % cluster.length];
      setFrontOfCluster((previous) => ({ ...previous, [clusterIndex]: next }));
      onOpen({ sideIndex, clusterIndex, markerIndex: next, mode: "dialog" });
      return;
    }
    onOpen({
      sideIndex,
      clusterIndex,
      markerIndex: front,
      mode: cluster.length > 1 ? "dialog" : "hover",
    });
  }

  const accentVar = side.accent === "a" ? "--viz-team-a" : "--viz-team-b";

  /*
   * Draw order: the cluster's front marker renders last so it sits on top.
   * Positions are untouched — z-order is the only thing cycling (AR-6).
   *
   * Derived through frontOf(), which validates membership against the CURRENT
   * layout. Reading Object.values(frontOfCluster) raw — as this did — hoisted
   * marker indices left over from a previous clustering, so after a resize the
   * marker drawn on top was not the one the popover described.
   */
  const drawOrder = useMemo(() => {
    const order = markers.map((_, index) => index);
    const fronts = new Set(
      layout.clusters.map((cluster) => {
        const stored = frontOfCluster[layout.clusters.indexOf(cluster)];
        return stored !== undefined && cluster.includes(stored) ? stored : cluster[0];
      })
    );
    return order.sort((a, b) => Number(fronts.has(a)) - Number(fronts.has(b)));
  }, [markers, frontOfCluster, layout]);

  function markerName(marker: PitchMarker): string {
    /*
     * Distinct SPOKEN keys, not the table's em-dash placeholder. An em dash is
     * a typographic mark: most screen readers announce it as nothing, so
     * "Tiro de —, —, bloqueado" degraded to "Tiro de, , bloqueado".
     */
    const subject = marker.subjectName ?? t("viz.marker.unknownPlayer");
    const minute =
      marker.minuteLabel === null
        ? t("viz.marker.unknownMinute")
        : `${t(marker.minutePrefixKey)} ${marker.minuteLabel}`;
    return `${t(marker.namePrefixKey)} ${subject}${NAME_SEPARATOR}${minute}${NAME_SEPARATOR}${t(
      marker.qualifierKey
    )}`;
  }

  /*
   * `?? null` is load-bearing, not defensive noise: layout.clusters[i] yields
   * `undefined` for an index left over from a previous, denser clustering, and
   * `undefined !== null` passed the render guard below — so openCluster.map()
   * threw and took the whole Tactical section down through the error boundary.
   * Opening a popover and then narrowing the window was enough to trigger it.
   */
  const openCluster = isOpenHere && open !== null ? (layout.clusters[open.clusterIndex] ?? null) : null;
  const openCentroid =
    isOpenHere && open !== null ? (layout.centroids[open.clusterIndex] ?? null) : null;

  return (
    <figure
      ref={figureRef}
      role="figure"
      aria-label={side.figureSummary}
      className="min-w-0"
      /*
       * Leaving the figure entirely closes the focus-driven popover. Scoped to
       * the `hover` variant and to a relatedTarget outside this figure, so
       * arrowing marker-to-marker and opening the cluster dialog (whose list
       * lives inside the figure) both keep it open.
       */
      onBlur={(event) => {
        if (!isOpenHere || open === null || open.mode !== "hover") {
          return;
        }
        const next = event.relatedTarget as Node | null;
        if (next !== null && figureRef.current?.contains(next) === true) {
          return;
        }
        onClose();
      }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="type-label-caps" style={{ color: `var(${accentVar})` }}>
          {side.teamCode}
        </span>
        <span className="type-caption tabular-nums text-ink-on-pitch">{side.metaLine}</span>
      </div>
      <div ref={measureRef} className="relative">
        <svg
          width={layout.size.width}
          height={layout.size.height}
          viewBox={`0 0 ${layout.size.width} ${layout.size.height}`}
          className="block h-auto w-full"
        >
          {/*
           * Ruled decision 8: the ROOT svg is deliberately NOT aria-hidden. AC
           * 3's literal wording describes an impossible element — an
           * aria-hidden subtree containing tabbable descendants is an axe
           * aria-hidden-focus violation and would hide the markers from exactly
           * the users the clause exists for. Decorative subtrees are hidden;
           * the marker group is exposed.
           */}
          <g aria-hidden="true">
            <PitchDrawing
              orientation={orientation}
              layout={layout}
              extentIsFull={extent.xMin === 0}
              underlay={underlay}
            />
          </g>
          {/*
           * Pointer-only hit layer: one transparent Voronoi cell per MARKER
           * (nearest-marker partition, AC 3), each dispatching to its marker's
           * cluster so the cluster stays the hit unit.
           */}
          <g aria-hidden="true">
            {layout.cells.map((cell, markerIndex) => {
              const clusterIndex = layout.clusterOfMarker[markerIndex];
              return cell === null ? null : (
                <path
                  key={markerIndex}
                  d={cell}
                  fill="transparent"
                  pointerEvents="all"
                  className="cursor-pointer"
                  onClick={() => onCellActivate(clusterIndex)}
                  onPointerEnter={(event) => {
                    // Guarded to a real mouse so a touch does not fire
                    // hover-then-tap and flicker the popover.
                    if (event.pointerType !== "mouse") {
                      return;
                    }
                    /*
                     * Never let a hover demote an open cluster DIALOG: it would
                     * unmount the dialog out from under the reader's focused
                     * list item and drop focus to <body>. The dialog is
                     * dismissed deliberately (Esc, outside pointer-down), never
                     * by the mouse wandering across the pitch.
                     */
                    if (open !== null && open.mode === "dialog") {
                      return;
                    }
                    const front = frontOf(clusterIndex);
                    if (front === null) {
                      return;
                    }
                    onOpen({ sideIndex, clusterIndex, markerIndex: front, mode: "hover" });
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "mouse") {
                      return;
                    }
                    if (isOpenHere && open !== null && open.mode === "hover") {
                      onClose();
                    }
                  }}
                />
              );
            })}
          </g>
          {/*
           * Keyboard-only targets. pointer-events="none" guarantees a click
           * always resolves through the cell layer, so pointer and keyboard can
           * never disagree about which cluster was hit.
           */}
          <g pointerEvents="none">
            {drawOrder.map((index) => {
              const marker = markers[index];
              const point = layout.points[index];
              const cluster = layout.clusters[layout.clusterOfMarker[index]];
              const inMultiCluster = cluster.length > 1;
              return (
                <g
                  key={marker.key}
                  ref={(node) => {
                    markerRefs.current[index] = node;
                  }}
                  role="button"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-label={markerName(marker)}
                  /*
                   * aria-haspopup/aria-expanded ONLY on markers that open a real
                   * dialog. A single marker's popover is aria-hidden (its
                   * content is already this marker's accessible name), and
                   * advertising expanded state for content assistive tech
                   * cannot reach is worse than saying nothing.
                   */
                  aria-haspopup={inMultiCluster ? "dialog" : undefined}
                  aria-expanded={
                    inMultiCluster
                      ? isOpenHere &&
                        open !== null &&
                        open.mode === "dialog" &&
                        open.clusterIndex === layout.clusterOfMarker[index]
                      : undefined
                  }
                  aria-controls={
                    inMultiCluster &&
                    isOpenHere &&
                    open !== null &&
                    open.mode === "dialog" &&
                    open.clusterIndex === layout.clusterOfMarker[index]
                      ? dialogId
                      : undefined
                  }
                  className="focus-on-pitch"
                  transform={`translate(${point.cx} ${point.cy})`}
                  onKeyDown={(event) => onMarkerKeyDown(event, index)}
                  /*
                   * AC 3 lists FOCUS beside tap and hover as a trigger, and the
                   * popover follows focus for two reasons: a sighted keyboard
                   * reader arrowing through 16 markers otherwise saw nothing
                   * until they pressed Enter on each one, and an already-open
                   * popover used to stay anchored to the marker it was opened
                   * from while focus roved away — describing one marker while
                   * the ring sat on another. Opening on focus fixes both, and
                   * amends ruled decision 9: the single-marker panel is still
                   * aria-hidden (its content IS this marker's accessible name),
                   * it simply now follows focus as well as the mouse.
                   */
                  onFocus={() => {
                    setActiveMarker(index);
                    openClusterOf(index, "hover");
                  }}
                >
                  <MarkerShapeGlyph shape={marker.shape} colorVar={marker.colorVar} />
                </g>
              );
            })}
          </g>
        </svg>

        {openCluster !== null && openCentroid !== null && open !== null ? (
          <ClusterPopover
            id={dialogId}
            mode={open.mode}
            markers={openCluster.map((index) => markers[index])}
            memberIndices={openCluster}
            frontIndex={frontOf(open.clusterIndex) ?? openCluster[0]}
            initialIndex={open.markerIndex}
            centroid={openCentroid}
            size={layout.size}
            listRefs={listRefs}
            onFront={(markerIndex) =>
              setFrontOfCluster((previous) => ({ ...previous, [open.clusterIndex]: markerIndex }))
            }
            onDismiss={() => {
              onClose();
              focusMarker(open.markerIndex);
            }}
            markerName={markerName}
          />
        ) : null}
      </div>
      {markers.length === 0 ? (
        // `[]` means "the page was present and listed nothing" — a fact about
        // the match, not a missing section (Story 2.5's null-vs-[] rule).
        <p className="mt-2 type-caption text-ink-on-pitch-secondary">{side.zeroLine}</p>
      ) : null}
    </figure>
  );
}

function ClusterPopover({
  id,
  mode,
  markers,
  memberIndices,
  frontIndex,
  initialIndex,
  centroid,
  size,
  listRefs,
  onFront,
  onDismiss,
  markerName,
}: {
  id: string;
  mode: OpenPopover["mode"];
  markers: PitchMarker[];
  memberIndices: number[];
  frontIndex: number;
  initialIndex: number;
  centroid: { cx: number; cy: number };
  size: Size;
  listRefs: React.RefObject<(HTMLButtonElement | null)[]>;
  onFront: (markerIndex: number) => void;
  onDismiss: () => void;
  markerName: (marker: PitchMarker) => string;
}) {
  const t = useT();
  const isDialog = mode === "dialog" && markers.length > 1;
  const initialPosition = Math.max(0, memberIndices.indexOf(initialIndex));
  const [focusedPosition, setFocusedPosition] = useState<number | null>(null);
  /*
   * Clamped at READ time rather than synced in an effect (the same posture the
   * marker roving index uses): a cluster can shrink under an open popover.
   */
  const rovingPosition =
    focusedPosition !== null && focusedPosition < markers.length ? focusedPosition : initialPosition;
  const setRovingPosition = setFocusedPosition;

  useEffect(() => {
    if (!isDialog) {
      return;
    }
    // Opening from a marker puts focus on THAT marker's own list item.
    listRefs.current[initialPosition]?.focus();
  }, [isDialog, initialPosition, listRefs]);

  /*
   * Hand-positioned inside the panel's own containing block and clamped so it
   * never leaves the box. No positioning library and no Radix Popover:
   * anchoring to an SVG child through collision machinery built for DOM
   * triggers costs more than it saves, and the wrapper is already `relative`.
   */
  const left = Math.max(0, Math.min(centroid.cx - POPOVER_WIDTH_PX / 2, size.width - POPOVER_WIDTH_PX));
  const placeAbove = centroid.cy > size.height / 2;
  /*
   * The clamp bounds BOTH axes. Width was bounded and height was not, so a
   * dense cluster — m074's Germany crosses collapse to ~26 members at the <md
   * fallback width — rendered a >1000px popover inside a ~250px panel with no
   * way to reach its lower half. maxHeight is the space actually available on
   * the chosen side, and the list scrolls inside it rather than the page.
   */
  const available = placeAbove
    ? centroid.cy - POPOVER_OFFSET_PX
    : size.height - centroid.cy - POPOVER_OFFSET_PX;
  const maxHeight = Math.max(POPOVER_MIN_HEIGHT_PX, available);
  const style = placeAbove
    ? { left, bottom: size.height - centroid.cy + POPOVER_OFFSET_PX, maxHeight }
    : { left, top: centroid.cy + POPOVER_OFFSET_PX, maxHeight };

  const className =
    "absolute z-10 flex w-56 max-w-full flex-col rounded-sm bg-surface-overlay p-3 shadow-overlay";

  if (!isDialog) {
    const front = markers[Math.max(0, memberIndices.indexOf(frontIndex))] ?? markers[0];
    return (
      // aria-hidden BECAUSE its content is already the focused marker's
      // accessible name — announcing it twice is noise, and it needs no focus
      // move (ruled decision 9).
      <div aria-hidden="true" className={className} style={style}>
        <DetailRows marker={front} />
      </div>
    );
  }

  const countLabel = `${t("viz.cluster.countBefore")} ${markers.length} ${t("viz.cluster.countAfter")}`;

  return (
    <div
      id={id}
      role="dialog"
      aria-label={t("viz.cluster.dialogLabel")}
      className={className}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          // UX-DR15: Esc closes the topmost, and focus returns to the marker
          // that opened it.
          onDismiss();
        }
      }}
    >
      <p className="mb-2 shrink-0 type-caption text-ink-secondary">{countLabel}</p>
      {/* Scrolls inside its own box, never the page (UX-DR16's exception). */}
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain">
        {markers.map((marker, position) => (
          <li key={marker.key}>
            <button
              type="button"
              ref={(node) => {
                listRefs.current[position] = node;
              }}
              /*
               * Roving tabindex follows the LAST focused item, not the one the
               * dialog opened on: freezing it at initialPosition meant tabbing
               * out of the list and back returned to the original item rather
               * than where the reader actually was.
               */
              tabIndex={position === rovingPosition ? 0 : -1}
              className="flex min-h-11 w-full shrink-0 flex-col items-start rounded-sm px-2 py-1 text-left"
              onFocus={() => {
                setRovingPosition(position);
                onFront(memberIndices[position]);
              }}
              onClick={() => onFront(memberIndices[position])}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const delta = event.key === "ArrowDown" ? 1 : -1;
                  const next = Math.min(Math.max(position + delta, 0), markers.length - 1);
                  listRefs.current[next]?.focus();
                }
              }}
            >
              <span className="sr-only">{markerName(marker)}</span>
              <span aria-hidden="true" className="w-full">
                <DetailRows marker={marker} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PitchPanel({ title, sides, legend, note, dataTable, underlay }: PitchPanelProps) {
  const t = useT();
  /*
   * Ruled decision 6: the side-by-side / tabs split lands at `md`, not `lg`.
   * EXPERIENCE's Responsive table names only >=lg and <md and leaves md-lg
   * undefined; two half pitches fit comfortably at 768px inside the route's
   * max-w-6xl, and MD_MEDIA_QUERY already exists for Key Statistics. One
   * breakpoint constant, one behaviour — and never re-derived in px (the 2.5
   * review patched exactly that desync).
   */
  const isMd = useMediaQuery(MD_MEDIA_QUERY);
  const [selectedCode, setSelectedCode] = useState(sides[0].teamCode);
  const [open, setOpen] = useState<OpenPopover | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = Math.max(
    0,
    sides.findIndex((side) => side.teamCode === selectedCode)
  );

  /*
   * ONE extent for the whole panel, computed from BOTH sides' markers, so the
   * two half pitches always share a scale. Computing it per side let a single
   * event at x < 50 widen one team's frame to a full pitch while its neighbour
   * stayed a half pitch — two different metres-per-pixel and two different
   * heights, side by side, with no axis to make the divergence visible. The
   * cost is the reverse: one team's outlier widens both maps. That is the
   * correct trade for a panel whose purpose is comparison (Story 2.7 code
   * review; amends Task 2.4 / ruled decision 3 from "per panel side").
   */
  const extent = useMemo(
    () => pitchExtentFor([...sides[0].markers, ...sides[1].markers]),
    [sides]
  );

  const closePopover = useCallback(() => setOpen(null), []);

  /*
   * Outside pointer-down dismisses. Without it a cluster dialog opened by click
   * had no dismissal path but Esc — and on touch, where a tap opens the
   * single-marker panel and markers are pointer-events:none so a tap never
   * focuses one, a popover could be left pinned over the pitch with no way to
   * close it at all. Pointer-down (not click) so it fires before focus moves.
   */
  useEffect(() => {
    if (open === null) {
      return;
    }
    function onDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target !== null && panelRef.current?.contains(target) === true) {
        return;
      }
      setOpen(null);
    }
    document.addEventListener("pointerdown", onDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", onDocumentPointerDown);
  }, [open]);

  const visible = isMd ? [0, 1] : [selectedIndex];
  /*
   * Derived, not synced in an effect: a resize across `md` unmounts one figure,
   * and a popover anchored to a figure that is no longer on screen must not
   * render. Filtering here also means it cannot resurrect when the reader
   * switches back — the team selector clears it outright as well.
   */
  const visibleOpen = open !== null && visible.includes(open.sideIndex) ? open : null;

  return (
    <section>
      <h3 className="type-title text-ink-primary">{title}</h3>
      {/*
       * {components.pitch-panel}: the deep-green pitch surface IS the panel
       * container. The hairline edge is dark-theme only — DESIGN Elevation: the
       * green-vs-charcoal edge computes 1.55:1, while in light the canvas is
       * the edge at 11.35:1. Implemented in CSS, never by reading the theme in
       * React; the transparent border keeps the box identical across themes so
       * a theme swap never shifts layout. Flat: no shadow.
       */}
      <div
        ref={panelRef}
        className="mt-2 rounded-lg border border-transparent bg-pitch-surface p-tile-gap dark:border-hairline"
      >
        {isMd ? null : (
          <ToggleGroup
            type="single"
            value={selectedCode}
            onValueChange={(value) => {
              // Radix reports "" when the active segment is re-clicked; the
              // active team cannot be deselected.
              if (value !== "") {
                setSelectedCode(value);
                // Never carry a popover across a team switch.
                setOpen(null);
              }
            }}
            aria-label={t("viz.teamSelector")}
            className="mb-tile-gap rounded-full border border-hairline p-0.5"
          >
            {sides.map((side) => (
              <ToggleGroupItem
                key={side.teamCode}
                value={side.teamCode}
                className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-on-pitch-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
              >
                {side.teamCode}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="grid grid-cols-1 gap-gutter-desktop md:grid-cols-2">
          {visible.map((sideIndex) => (
            <PitchFigure
              key={sides[sideIndex].teamCode}
              side={sides[sideIndex]}
              sideIndex={sideIndex}
              orientation={isMd ? "horizontal" : "vertical"}
              extent={extent}
              open={visibleOpen}
              onOpen={setOpen}
              onClose={closePopover}
              underlay={underlay}
            />
          ))}
        </div>
        <div className="mt-tile-gap flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legend.map((entry) => (
            <span key={entry.label} className="flex items-center gap-1.5 type-caption text-ink-on-pitch">
              <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
                <g transform="translate(7 7)">
                  <MarkerShapeGlyph shape={entry.shape} colorVar={entry.colorVar} radius={4.6} />
                </g>
              </svg>
              {entry.label}
            </span>
          ))}
        </div>
        {note ? <p className="mt-2 type-caption text-ink-on-pitch-secondary">{note}</p> : null}
        <div className="mt-tile-gap border-t border-pitch-line/40 pt-2.5">
          {/*
           * ONE "Ver los datos" per PANEL, not per side (Task 7.3): the table
           * carries a Team column and covers both teams, matching the mockup's
           * single panel-foot beneath the two half pitches.
           *
           * The attribution caption rides the trigger's row and is PERMANENT:
           * never conditional, never behind the disclosure — it must survive a
           * screenshot (UX-DR21, UJ-2 step 5).
           */}
          <ViewDataDisclosure
            panelTitle={title}
            trailing={
              <span className="type-caption text-ink-on-pitch-secondary">{t("viz.attribution")}</span>
            }
          >
            {dataTable}
          </ViewDataDisclosure>
        </div>
      </div>
    </section>
  );
}

export { DOT_SEPARATOR };

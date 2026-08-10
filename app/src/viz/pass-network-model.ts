import type { PassNetworkEdge, PassNetworkNode } from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import {
  resolveSide,
  sideRank,
  type LogSide,
  type MarkerDetailRow,
  type MarkerValue,
  type PitchMarker,
} from "@/viz/marker-model";

/*
 * PassNetworkNode / PassNetworkEdge -> markers, edge geometry, encoding and
 * table rows (Task 2). Pure and locale-free: this module returns dictionary
 * KEYS and RAW numbers, and PassNetworksSection resolves them. A t() call here
 * is an ESLint error — src/viz is inside the client-import seam — and the split
 * is the only reason any of this is testable in a node-only harness.
 *
 * DEFENSIVE BY MANDATE (Task 2.13). All seven PassNetworkNode fields and all
 * four PassNetworkEdge fields are `required` in the schema, but Story 1.14 has
 * never probed the "Passing Networks {team}" page and three of the four Domain
 * D families probed so far had unfulfillable required per-row fields (1.11's
 * CrossEvent, 1.13's ReceivingEvent — whose probe overturned the epic's premise
 * entirely). The fixtures' coordinates are handcrafted. The bundle reaches this
 * code as an unvalidated `as`-cast, so every field is read through a guard.
 *
 * Two things fail LOUD rather than degrading, because neither has an honest
 * placeholder: a node whose coordinate is unreadable (it cannot be placed, and
 * a NaN translate paints an invisible marker), and an edge endpoint with no
 * node (it cannot be drawn, and a silent drop is exactly the class of finding
 * prior reviews flagged — the resolveSide precedent). Everything a reader can
 * be told "unknown" about instead degrades to viz.table.unknown.
 */

/** Ramp colour vars in stop order, index-aligned to EDGE_STROKE_PX. */
export const EDGE_WEIGHT_VARS: readonly string[] = Object.freeze([
  "--edge-weight-1",
  "--edge-weight-2",
  "--edge-weight-3",
  "--edge-weight-4",
  "--edge-weight-5",
]);

/*
 * Stroke widths in stop order, CSS px (the desktop mockup's ratios).
 *
 * NOT decoration. Measured for this story against --pitch-surface #0b3d2e: all
 * five stops clear the 3:1 non-text floor (3.83 / 5.06 / 6.60 / 8.55 / 10.77:1)
 * but ADJACENT stops separate from each other by only 1.32 / 1.31 / 1.29 /
 * 1.26:1 — colour alone cannot distinguish neighbouring bands, so DESIGN's
 * "stroke width rising in parallel" IS the encoding (UX-DR10).
 *
 * Absolute px, never viewBox-scaled: PitchPanel renders width={W} height={H}
 * viewBox="0 0 W H", so one unit is one px by construction. No
 * vector-effect="non-scaling-stroke", no scaling with container width.
 */
export const EDGE_STROKE_PX: readonly number[] = Object.freeze([1.2, 1.8, 2.5, 3.4, 4.5]);

/** Node radius range, CSS px. Sqrt scale — area-proportional for a circle. */
export const NODE_RADIUS_MIN_PX = 5;
export const NODE_RADIUS_MAX_PX = 10;
/** Degenerate domain (min === max, or an unreadable involvement). */
export const NODE_RADIUS_MID_PX = 7.5;

/*
 * NODE_DIM_OPACITY, SELECTION_RING_OFFSET_PX and SELECTION_RING_STROKE_PX used
 * to live here and now live in marker-model.ts (2.8 code review): they are
 * panel-generic, and PitchPanel importing them from a story-specific model
 * inverted the layering its own header promises. EDGE_DIM_OPACITY stays — edges
 * are drawn by this story's underlay, not by the panel.
 */

/*
 * Edges at 0.25 -> stop 1 1.42:1, stop 5 2.01:1. Deliberately below 3:1, and a
 * RECORDED EXCEPTION rather than an oversight: in the isolated state the
 * information identifying the state is WHICH edges belong to the selected
 * player, and those render at full ramp contrast (3.83-10.77:1). The
 * de-emphasized remainder is context, reachable by clearing isolation (one
 * keystroke) and in full in the data table — SM-C2's "one toggle away, never
 * deleted". Raising the alpha does not fix it: at 0.40 stop 5 reaches 3.02:1
 * while stop 1 is still at 1.75:1, so no single alpha both dims and holds the
 * floor across the ramp.
 */
export const EDGE_DIM_OPACITY = 0.25;

/** Quintile count — the ramp and the split are the SAME partition. */
const STOP_COUNT = 5;

const UNKNOWN: MarkerValue = { kind: "key", value: "viz.table.unknown" };

/** A number that survived the `as`-cast, or null. */
function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A non-empty string that survived the `as`-cast, or null. */
function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: number | null): MarkerValue {
  return value === null ? UNKNOWN : { kind: "number", value, digits: 0 };
}

const NODE_KEY_PREFIX = "node-";

/** The marker key AND the identity `selection` matches on — never an index. */
export function nodeKey(playerId: string): string {
  return `${NODE_KEY_PREFIX}${playerId}`;
}

/**
 * The inverse, so isolation state stores a `playerId` rather than re-deriving
 * one by string surgery at the call site. A marker key that is not a node key
 * yields null instead of a plausible-looking slice.
 */
export function playerIdFromNodeKey(key: string): string | null {
  return key.startsWith(NODE_KEY_PREFIX) ? key.slice(NODE_KEY_PREFIX.length) : null;
}

/**
 * The four nearest-rank quintile thresholds over the POOLED volumes of a whole
 * panel (both sides), t_k = V[ceil(k * 0.2 * n) - 1].
 *
 * Pooled for the same reason the pitch extent is: two side-by-side panels on
 * different scales with no axis are unfalsifiable by eye (UX-DR23's "identical
 * scales per side").
 *
 * Returns [] when fewer than two distinct volumes exist — the split is then
 * undefined, every edge renders at stop 1, and the <md hiding is disabled
 * (hiding 100% of the edges is not a declutter).
 */
export function edgeWeightThresholds(edges: readonly PassNetworkEdge[]): number[] {
  const volumes = edges
    .map((edge) => finiteOrNull(edge.volume))
    .filter((volume): volume is number => volume !== null)
    .sort((a, b) => a - b);
  if (new Set(volumes).size < 2) {
    return [];
  }
  const thresholds: number[] = [];
  for (let k = 1; k < STOP_COUNT; k += 1) {
    const rank = Math.ceil((k * volumes.length) / STOP_COUNT);
    thresholds.push(volumes[Math.min(volumes.length, Math.max(1, rank)) - 1]);
  }
  return thresholds;
}

export type EdgeStop = 1 | 2 | 3 | 4 | 5;

/**
 * `1 + count(t => volume > t)`, so `volume <= t1` <=> stop 1 <=> "the lowest
 * weight quintile" — AC 2's clause and the 5-stop ramp are one partition, not
 * two competing ones. Ties land in the lower stop consistently.
 */
export function edgeStop(volume: number | null, thresholds: readonly number[]): EdgeStop {
  const value = finiteOrNull(volume);
  if (value === null) {
    return 1;
  }
  let stop = 1;
  for (const threshold of thresholds) {
    if (value > threshold) {
      stop += 1;
    }
  }
  return Math.min(stop, STOP_COUNT) as EdgeStop;
}

export interface InvolvementDomain {
  min: number;
  max: number;
}

/** Pooled across BOTH sides — the same comparability grammar as the extent. */
export function involvementDomain(nodes: readonly PassNetworkNode[]): InvolvementDomain {
  const values = nodes
    .map((node) => finiteOrNull(node.involvement))
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Sqrt scale into [5, 10] CSS px — area-proportional, the correct perceptual
 * mapping for a circle.
 *
 * `involvement` is a CONTRACT FIELD precisely because AD-5 forbids deriving it,
 * and it must never be recomputed from the edge table: it counts all passes the
 * player was involved in, while the edge table charts only the matrix's own
 * connections. The fixtures guarantee one direction only (involvement >=
 * incident sum) and 38 of 66 nodes strictly exceed it.
 */
export function involvementRadius(
  involvement: number | null,
  domain: InvolvementDomain
): number {
  const value = finiteOrNull(involvement);
  const span = domain.max - domain.min;
  if (value === null || !(span > 0)) {
    // Degenerate domain, or a field the source could not fill: one honest
    // midpoint radius. Never a divide by zero, never a throw.
    return NODE_RADIUS_MID_PX;
  }
  const t = Math.min(1, Math.max(0, (value - domain.min) / span));
  return NODE_RADIUS_MIN_PX + (NODE_RADIUS_MAX_PX - NODE_RADIUS_MIN_PX) * Math.sqrt(t);
}

/** The two counters the accessible name's value clause reports. */
export interface PassNetworkNameParts {
  involvement: number | null;
  degree: number;
}

/**
 * One marker per node of `teamId`, sorted by shirt number ascending.
 *
 * That sort IS the arrow-key roving order: PitchPanel roves by array index, and
 * "ordered by match minute" has no analogue for a node, so shirt order is the
 * one a reader can predict — the fixtures' own node order is not sorted
 * (Paraguay's first node is #12).
 *
 * `valuePhrase` is supplied by the component because the phrase needs t() and
 * the locale formatter, which src/viz may not touch. It fills the marker's
 * MIDDLE accessible-name clause positionally (Task 2.6): markerName() always
 * renders three clauses and renders `minuteLabel: null` as "minuto
 * desconocido", which would be a lie about a node that has no clock.
 */
export function passNetworkMarkers(
  nodes: readonly PassNetworkNode[],
  edges: readonly PassNetworkEdge[],
  teamId: string,
  accentVar: string,
  domain: InvolvementDomain,
  valuePhrase: (parts: PassNetworkNameParts) => string
): PitchMarker[] {
  const mine = nodes.filter((node) => node.teamId === teamId);
  const sorted = [...mine].sort((a, b) => {
    const shirtA = finiteOrNull(a.shirtNumber);
    const shirtB = finiteOrNull(b.shirtNumber);
    if (shirtA !== shirtB) {
      // A nullish shirt sorts LAST rather than silently to the front as 0.
      if (shirtA === null) {
        return 1;
      }
      if (shirtB === null) {
        return -1;
      }
      return shirtA - shirtB;
    }
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
  return sorted.map((node) => {
    const x = finiteOrNull(node.x);
    const y = finiteOrNull(node.y);
    if (x === null || y === null) {
      throw new Error(
        `pass-network-model: node ${JSON.stringify(node.playerId)} has no usable position ` +
          `(x ${JSON.stringify(node.x)}, y ${JSON.stringify(node.y)})`
      );
    }
    const involvement = finiteOrNull(node.involvement);
    const degree = nodeDegree(edges, node.playerId);
    return {
      key: nodeKey(node.playerId),
      x,
      y,
      shape: "circle-filled",
      colorVar: accentVar,
      radius: involvementRadius(involvement, domain),
      namePrefixKey: "viz.passNetwork.markerPrefix" as DictionaryKey,
      minutePrefixKey: "viz.passNetwork.involvementPrefix" as DictionaryKey,
      subjectName: textOrNull(node.playerName),
      /*
       * The DEGREE belongs in the name, not only in `detail`: markerName()
       * never reads detail, the detail panel is aria-hidden (2.7 ruled decision
       * 9), and edges are aria-hidden by construction — so for a singleton node
       * a count that lives only in detail is inaudible. This is the sole
       * non-visual handle on isolation scope. NEVER null.
       */
      minuteLabel: valuePhrase({ involvement, degree }),
      qualifierKey: "viz.passNetwork.nodeRole" as DictionaryKey,
      detail: nodeDetail(node, degree),
    };
  });
}

function nodeDetail(node: PassNetworkNode, degree: number): MarkerDetailRow[] {
  return [
    { labelKey: "viz.table.shirt", value: numberValue(finiteOrNull(node.shirtNumber)) },
    { labelKey: "viz.table.involvement", value: numberValue(finiteOrNull(node.involvement)) },
    // Degree is a within-match, single-surface derivation over one bundle:
    // inside AD-5's carve-out, and it is NOT node size.
    { labelKey: "viz.table.connections", value: { kind: "number", value: degree, digits: 0 } },
  ];
}

/** Stable, unique per DIRECTED edge — a reciprocal pair yields two keys. */
function edgeKey(index: number): string {
  return `edge-${index}`;
}

export interface PassEdgeSegment {
  key: string;
  /** AD-6 0-100 endpoints, VERBATIM from the two nodes — never adjusted. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /**
   * `null` when the source could not fill it — NOT coerced to 0 (2.8 code
   * review). Coercing produced an edge drawn at stop 1 while
   * `edgeWeightThresholds` had excluded that same edge from the split, so the
   * figure showed a weight the legend did not cover and the table read "—" for
   * the identical row. An unreadable volume now renders at stop 1 honestly and
   * degrades to viz.table.unknown in the table (Task 2.13).
   */
  volume: number | null;
  stop: EdgeStop;
  fromPlayerId: string;
  toPlayerId: string;
}

function positionOf(
  index: Map<string, PassNetworkNode>,
  playerId: string,
  role: string
): { x: number; y: number } {
  const node = index.get(playerId);
  const x = node === undefined ? null : finiteOrNull(node.x);
  const y = node === undefined ? null : finiteOrNull(node.y);
  if (x === null || y === null) {
    /*
     * Fail LOUD naming the offending id and the table, the resolveSide
     * precedent: an edge whose endpoint has no node cannot be drawn, and a
     * silent drop would publish a network missing connections nobody can see is
     * missing. TacticalErrorBoundary contains the blast radius.
     */
    throw new Error(
      `pass-network-model: edge ${role} playerId ${JSON.stringify(playerId)} has no node ` +
        `in passNetworkNodes`
    );
  }
  return { x, y };
}

function nodeIndex(nodes: readonly PassNetworkNode[]): Map<string, PassNetworkNode> {
  const index = new Map<string, PassNetworkNode>();
  for (const node of nodes) {
    /*
     * Duplicate ids fail LOUD (2.8 code review). The schema does not guarantee
     * playerId uniqueness and Story 1.14 has never run, so a last-wins Map
     * would silently give every edge the LAST duplicate's coordinates while
     * `nodeKey(playerId)` handed React two markers with the same key — one node
     * drawn, one dropped, and no way to see which.
     */
    if (index.has(node.playerId)) {
      throw new Error(
        `pass-network-model: duplicate playerId ${JSON.stringify(node.playerId)} in ` +
          `passNetworkNodes`
      );
    }
    index.set(node.playerId, node);
  }
  return index;
}

/**
 * One straight segment per edge of `teamId`, between two projected node
 * positions. That is the WHOLE geometry: positions are extracted, never derived
 * (AD-3), so there is no force-directed layout and d3-force stays uninstalled.
 */
export function passNetworkEdgeGeometry(
  nodes: readonly PassNetworkNode[],
  edges: readonly PassNetworkEdge[],
  teamId: string,
  thresholds: readonly number[]
): PassEdgeSegment[] {
  /*
   * No nodes at all is the ZERO STATE, not a data defect (ruled decision 13:
   * `[]` means the page was present and listed nothing => draw the pitch plus a
   * zero-content line). Before this guard every endpoint was unresolvable, so
   * `passNetworkNodes: []` with a populated edge table — which
   * `sectionDataState` admits as "ready", because it gates on `!== null` only —
   * threw on load and took ALL ELEVEN Tactical sections down through the
   * whole-layer error boundary. The dangling-endpoint rule below still applies
   * to a network that HAS nodes.
   */
  if (nodes.length === 0) {
    return [];
  }
  const index = nodeIndex(nodes);
  return edges
    .map((edge, position) => ({ edge, position }))
    .filter(({ edge }) => edge.teamId === teamId)
    .map(({ edge, position }) => {
      const from = positionOf(index, edge.fromPlayerId, "from");
      const to = positionOf(index, edge.toPlayerId, "to");
      assertEndpointsOnTeam(index, edge, teamId);
      const volume = finiteOrNull(edge.volume);
      return {
        key: edgeKey(position),
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        volume,
        stop: edgeStop(volume, thresholds),
        fromPlayerId: edge.fromPlayerId,
        toPlayerId: edge.toPlayerId,
      };
    });
}

/**
 * An edge's endpoints must belong to the edge's own team (2.8 code review).
 *
 * `positionOf` looks up the WHOLE node index, so before this check an edge
 * carrying team A's `teamId` but team B's endpoints resolved happily and drew a
 * segment on team A's figure using team B's coordinate frame — two pitches are
 * two figures, never one pitch (AR-6). The same defect leaked into
 * `nodeDegree` / `incidentPlayerIds` / `incidentEdgeKeys`, which key on
 * playerId alone; failing here, on the eagerly-built geometry for both sides,
 * stops all of it before anything renders. All three fixtures carry zero
 * cross-team edges and the schema forbids none, so no fixture test can see it.
 */
function assertEndpointsOnTeam(
  index: Map<string, PassNetworkNode>,
  edge: PassNetworkEdge,
  teamId: string
): void {
  for (const [role, playerId] of [
    ["from", edge.fromPlayerId],
    ["to", edge.toPlayerId],
  ] as const) {
    const nodeTeamId = index.get(playerId)?.teamId;
    if (nodeTeamId !== teamId) {
      throw new Error(
        `pass-network-model: edge ${role} playerId ${JSON.stringify(playerId)} belongs to team ` +
          `${JSON.stringify(nodeTeamId)} but the edge is on team ${JSON.stringify(teamId)}`
      );
    }
  }
}

/**
 * The <md declutter: drop the lowest weight quintile — which IS the ramp's
 * stop-1 band — behind the "Mostrar todos los pases" toggle. Data one toggle
 * away, never deleted (SM-C2, UX-DR17).
 *
 * With an undefined split (fewer than two distinct volumes) NOTHING is hidden:
 * every edge would be stop 1, and hiding all of them is not a declutter.
 */
export function visibleEdgeGeometry(
  geometry: readonly PassEdgeSegment[],
  thresholds: readonly number[],
  hideLowestQuintile: boolean
): PassEdgeSegment[] {
  if (!hideLowestQuintile || thresholds.length === 0) {
    return [...geometry];
  }
  return geometry.filter((segment) => segment.stop > 1);
}

/** Edge keys touching `playerId` — what stays at full ramp contrast. */
export function incidentEdgeKeys(
  edges: readonly PassNetworkEdge[],
  playerId: string
): Set<string> {
  const keys = new Set<string>();
  edges.forEach((edge, position) => {
    if (edge.fromPlayerId === playerId || edge.toPlayerId === playerId) {
      keys.add(edgeKey(position));
    }
  });
  return keys;
}

/** The isolated player's neighbours — this is what drives NODE dimming. */
export function incidentPlayerIds(
  edges: readonly PassNetworkEdge[],
  playerId: string
): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.fromPlayerId === playerId) {
      ids.add(edge.toPlayerId);
    }
    if (edge.toPlayerId === playerId) {
      ids.add(edge.fromPlayerId);
    }
  }
  ids.delete(playerId);
  return ids;
}

/** How many edges touch this player. A degree-0 node is legal and real. */
export function nodeDegree(edges: readonly PassNetworkEdge[], playerId: string): number {
  return edges.filter((edge) => edge.fromPlayerId === playerId || edge.toPlayerId === playerId)
    .length;
}

/** Which side a pinned playerId belongs to — null when it is on neither. */
export function teamIdOfPlayer(
  nodes: readonly PassNetworkNode[],
  playerId: string | null
): string | null {
  if (playerId === null) {
    return null;
  }
  return nodes.find((node) => node.playerId === playerId)?.teamId ?? null;
}

/**
 * Marker keys to render at NODE_DIM_OPACITY for one figure.
 *
 * Scoped to the isolated player's OWN side (ruled decision 15): dimming a whole
 * second team because a player on the first was pinned communicates nothing and
 * destroys the comparison the two-figure panel exists for.
 */
export function dimmedNodeKeys(
  nodes: readonly PassNetworkNode[],
  edges: readonly PassNetworkEdge[],
  teamId: string,
  isolatedPlayerId: string | null
): ReadonlySet<string> {
  if (isolatedPlayerId === null || teamIdOfPlayer(nodes, isolatedPlayerId) !== teamId) {
    return new Set<string>();
  }
  const neighbours = incidentPlayerIds(edges, isolatedPlayerId);
  const dimmed = new Set<string>();
  for (const node of nodes) {
    if (
      node.teamId === teamId &&
      node.playerId !== isolatedPlayerId &&
      !neighbours.has(node.playerId)
    ) {
      dimmed.add(nodeKey(node.playerId));
    }
  }
  return dimmed;
}

/** Counts for the panel chip and the figure summary — the marks THIS PANEL DREW. */
export function passNetworkFigureCounts(
  markers: readonly PitchMarker[],
  geometry: readonly PassEdgeSegment[]
): { players: number; connections: number } {
  return { players: markers.length, connections: geometry.length };
}

export interface QuintileBand {
  stop: EdgeStop;
  from: number;
  to: number;
}

/**
 * The legend's ranges, so it STATES THE NUMBERS instead of showing a bare
 * gradient — what makes a ramp whose adjacent stops differ by ~1.3:1 legible at
 * all. `volume` is an integer with minimum 1 in the contract, so band edges are
 * integer-contiguous.
 *
 * An empty band (a tie collapsed a stop, leaving from > to) is DROPPED rather
 * than labelled with an impossible range; with no thresholds at all a single
 * band covers the whole domain and the legend renders one entry, not five.
 */
export function quintileBands(
  thresholds: readonly number[],
  min: number,
  max: number
): QuintileBand[] {
  if (thresholds.length === 0) {
    return [{ stop: 1, from: min, to: max }];
  }
  const edges = [min - 1, ...thresholds, max];
  const bands: QuintileBand[] = [];
  for (let stop = 1; stop <= STOP_COUNT; stop += 1) {
    const from = edges[stop - 1] + 1;
    const to = edges[stop];
    if (from <= to) {
      bands.push({ stop: stop as EdgeStop, from, to });
    }
  }
  return bands;
}

export interface PassNodeRow {
  key: string;
  teamCode: string;
  shirtNumber: number | null;
  playerName: string | null;
  x: number | null;
  y: number | null;
  involvement: number | null;
}

export interface PassEdgeRow {
  key: string;
  teamCode: string;
  fromName: string | null;
  toName: string | null;
  volume: number | null;
}

/**
 * The node table: the x / y / involvement alternative to the figure (UX-DR16).
 * Stated default order — side (home first) then shirt ascending — which the
 * caption must name.
 */
export function passNodeRows(
  nodes: readonly PassNetworkNode[],
  home: LogSide,
  away: LogSide
): PassNodeRow[] {
  const decorated = nodes.map((node) => ({
    node,
    side: resolveSide(node.teamId, home, away, "pass-network-model"),
  }));
  return [...decorated]
    .sort((a, b) => {
      const bySide = sideRank(a.node.teamId, home) - sideRank(b.node.teamId, home);
      if (bySide !== 0) {
        return bySide;
      }
      const shirtA = finiteOrNull(a.node.shirtNumber);
      const shirtB = finiteOrNull(b.node.shirtNumber);
      if (shirtA !== shirtB) {
        if (shirtA === null) {
          return 1;
        }
        if (shirtB === null) {
          return -1;
        }
        return shirtA - shirtB;
      }
      return a.node.playerId < b.node.playerId ? -1 : a.node.playerId > b.node.playerId ? 1 : 0;
    })
    .map(({ node, side }) => ({
      key: `node-row-${node.playerId}`,
      teamCode: side.teamCode,
      shirtNumber: finiteOrNull(node.shirtNumber),
      playerName: textOrNull(node.playerName),
      x: finiteOrNull(node.x),
      y: finiteOrNull(node.y),
      involvement: finiteOrNull(node.involvement),
    }));
}

/**
 * A playerId → display-name index, for the matrix table when there are no nodes
 * to resolve names from (Story 2.19 R1).
 *
 * The node table carries `playerName` on every node, so with nodes present the
 * edge table resolves names for free. With `passNetworkNodes: null` — which is
 * the shape on 104/104 real matches — the edges carry ids and nothing else, and
 * an id is not a name a reader can use.
 *
 * `metadata.lineups` is the source because it is REQUIRED on the bundle where
 * `players` is nullable, and because it is already what the Hero's lineup
 * disclosure reads. Measured over the whole corpus before choosing it: both
 * `metadata.lineups` and `players[]` resolve **47,194 of 47,194** edge endpoints
 * across all 104 matches, with zero gaps in either. The required one wins.
 *
 * Deliberately takes the two already-flattened entry lists rather than the
 * `MatchLineups` object: this module is inside the client-import seam and pure,
 * and keeping the contract shape at the call site is what lets the caller feed
 * it `players[]` instead if that ever becomes the better source.
 */
export function rosterIndex(
  entries: readonly { playerId: string; name: string }[]
): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    const name = textOrNull(entry.name);
    if (name !== null && !index.has(entry.playerId)) {
      index.set(entry.playerId, name);
    }
  }
  return index;
}

/**
 * The matrix table WITHOUT a node table beside it (Story 2.19 R1, ruled D7).
 *
 * Same rows, same order and the same `PassEdgeRow` shape as `passEdgeRows`, but
 * names come from the roster rather than from the node index — because in this
 * branch there are no nodes at all.
 *
 * IT DOES NOT THROW ON AN UNRESOLVED ENDPOINT, and that is the one deliberate
 * difference. `passEdgeRows` fails loud because its rows sit beside a FIGURE
 * that cannot draw an edge whose endpoint has no position, and a silent drop
 * would publish a network missing connections nobody can see are missing. Here
 * there is no figure and no geometry: an unresolvable name is a missing NAME,
 * which `PassEdgeRow.fromName: string | null` already models and the table
 * already renders as the ruled unknown glyph. Throwing would take the whole
 * section — the only surface this data has — into the error boundary over a
 * cell.
 */
export function passMatrixRows(
  edges: readonly PassNetworkEdge[],
  roster: ReadonlyMap<string, string>,
  home: LogSide,
  away: LogSide
): PassEdgeRow[] {
  const decorated = edges.map((edge, position) => ({
    edge,
    position,
    side: resolveSide(edge.teamId, home, away, "pass-network-model"),
  }));
  return [...decorated]
    .sort((a, b) => compareEdgeRows(a, b, home))
    .map(({ edge, position, side }) => ({
      key: `edge-row-${position}`,
      teamCode: side.teamCode,
      fromName: roster.get(edge.fromPlayerId) ?? null,
      toName: roster.get(edge.toPlayerId) ?? null,
      volume: finiteOrNull(edge.volume),
    }));
}

/**
 * The stated default order, shared by both row builders so the two branches
 * cannot drift: side (home first), then volume DESCENDING, then fromPlayerId,
 * then toPlayerId, then emission position for total stability.
 */
function compareEdgeRows(
  a: { edge: PassNetworkEdge; position: number },
  b: { edge: PassNetworkEdge; position: number },
  home: LogSide
): number {
  const bySide = sideRank(a.edge.teamId, home) - sideRank(b.edge.teamId, home);
  if (bySide !== 0) {
    return bySide;
  }
  const byVolume = (finiteOrNull(b.edge.volume) ?? 0) - (finiteOrNull(a.edge.volume) ?? 0);
  if (byVolume !== 0) {
    return byVolume;
  }
  if (a.edge.fromPlayerId !== b.edge.fromPlayerId) {
    return a.edge.fromPlayerId < b.edge.fromPlayerId ? -1 : 1;
  }
  if (a.edge.toPlayerId !== b.edge.toPlayerId) {
    return a.edge.toPlayerId < b.edge.toPlayerId ? -1 : 1;
  }
  return a.position - b.position;
}

/**
 * The edge table: EXPERIENCE's "full pass-matrix edges in table form". An 11x11
 * grid is explicitly not what the contract asks for.
 *
 * Stated default order — side, then volume DESCENDING, then fromPlayerId, then
 * toPlayerId for total stability.
 */
export function passEdgeRows(
  edges: readonly PassNetworkEdge[],
  nodes: readonly PassNetworkNode[],
  home: LogSide,
  away: LogSide
): PassEdgeRow[] {
  // The zero state, matching the geometry: with no nodes there is no network to
  // tabulate, and every endpoint would otherwise be unresolvable (decision 13).
  if (nodes.length === 0) {
    return [];
  }
  const index = nodeIndex(nodes);
  const decorated = edges.map((edge, position) => ({
    edge,
    position,
    side: resolveSide(edge.teamId, home, away, "pass-network-model"),
  }));
  return [...decorated]
    .sort((a, b) => compareEdgeRows(a, b, home))
    .map(({ edge, position, side }) => {
      // Same fail-loud rule the geometry uses: an endpoint with no node is a
      // data defect, and the table must not quietly print a blank for it.
      positionOf(index, edge.fromPlayerId, "from");
      positionOf(index, edge.toPlayerId, "to");
      return {
        key: `edge-row-${position}`,
        teamCode: side.teamCode,
        fromName: textOrNull(index.get(edge.fromPlayerId)?.playerName),
        toName: textOrNull(index.get(edge.toPlayerId)?.playerName),
        volume: finiteOrNull(edge.volume),
      };
    });
}

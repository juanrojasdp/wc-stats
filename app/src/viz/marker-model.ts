import type { DictionaryKey } from "@/lib/i18n";

/*
 * The shared, viz-agnostic marker shape that PitchPanel consumes and that
 * Stories 2.8 / 2.9 will also produce (Task 4.1).
 *
 * Locale-free by construction: models return dictionary KEYS and RAW values,
 * components resolve them. Same contract as tactical-sections.ts (Story 2.5
 * Task 1.5) — and the only reason any of this is testable in a node-only
 * harness. A `t()` call in this file would also be an ESLint error: src/viz
 * joined the client-import seam in Task 1.3.
 */

/** UX-DR10's shape half of the dual encoding. Colour alone is never enough. */
export type MarkerShape =
  | "circle-filled-ring"
  | "circle-filled"
  | "circle-hollow"
  | "square-filled"
  | "square-hollow";

/**
 * A popover / accessible-name field. Numbers carry their format tag; the
 * component is the only thing that may call @/lib/format, because only it has
 * the locale (identical split to Story 2.5's KEY_STAT_FORMAT).
 *
 * There is deliberately no "absent" kind: an unknown value is
 * `{ kind: "key", value: "viz.table.unknown" }`, so the em-dash placeholder is
 * a locale entry like every other user-facing string.
 */
export type MarkerValue =
  | { kind: "text"; value: string }
  | { kind: "key"; value: DictionaryKey }
  | { kind: "number"; value: number; digits: 0 | 1 | 2 };

export interface MarkerDetailRow {
  labelKey: DictionaryKey;
  value: MarkerValue;
}

export interface PitchMarker {
  /**
   * Stable React key AND the identity `selection` matches on — never an array
   * index. A stored index into a width-derived array reads `undefined` after a
   * reflow and passes an `!== null` guard (Story 2.7's stale-index defect);
   * a stable identity sidesteps that whole class. Shots and crosses key on
   * `${kind}-${artifactIndex}` into the ARTIFACT array, which is data, not
   * layout; pass-network nodes key on the playerId itself.
   */
  key: string;
  /** AD-6 0-100, VERBATIM from the artifact — never adjusted, never clamped. */
  x: number;
  y: number;
  shape: MarkerShape;
  /**
   * Absent ⇒ MARKER_RADIUS_PX. Set only by size-encoding vizzes (Story 2.8's
   * pass-network nodes, sized by the contract's `involvement` field).
   */
  radius?: number;
  /** A CSS custom property NAME, e.g. "--shot-goal" — never a resolved colour. */
  colorVar: string;
  /**
   * Accessible name pieces, composed by the component in locale order:
   * `${t(namePrefixKey)} ${subjectName}, ${t(minutePrefixKey)} ${minuteLabel}, ${t(qualifierKey)}`
   * -> es "Tiro de Brian GUTIERREZ, minuto 3′, bloqueado". The xG clause the
   * spec's example shows is OMITTED while expectedGoals is null (FD-1).
   */
  namePrefixKey: DictionaryKey;
  /**
   * The minute lead-in, carried by the MARKER rather than hardcoded in the
   * panel. PitchPanel used `viz.shotMap.minutePrefix` for every marker it drew,
   * including crosses — which made a component that documents itself as knowing
   * "nothing about outcomes, own goals or delivery types" announce every future
   * 2.8/2.9 marker through the shot map's namespace.
   */
  minutePrefixKey: DictionaryKey;
  /** null -> the component renders the spoken viz.marker.unknownPlayer. */
  subjectName: string | null;
  minuteLabel: string | null;
  /** Outcome (shots) / completion state (crosses). */
  qualifierKey: DictionaryKey;
  /** Popover rows, in display order. */
  detail: MarkerDetailRow[];
}

/*
 * Marker geometry, uniform per FD-1 (per-shot xG does not exist in the source
 * PDFs, so there is nothing to size by). DESIGN allows ~8-14 px marks; a 6 px
 * radius lands at 12 px across and the square at 11 px, which reads as the same
 * visual weight.
 */
export const MARKER_RADIUS_PX = 6;
export const SQUARE_SIDE_PX = 11;
export const HOLLOW_STROKE_PX = 2;
export const GOAL_RING_STROKE_PX = 1.5;

/*
 * Selection rendering, PANEL-GENERIC (2.8 code review).
 *
 * These three live here rather than in a viz model because a selection ring and
 * a dim opacity are not pass-network concepts — PitchPanel renders both for any
 * consumer that passes `selection`, and 2.9 will be the second. Importing them
 * from pass-network-model inverted the layering the panel's own header
 * promises ("every shot- or cross-specific decision is kept OUT of it").
 *
 * The ring sits OUTSIDE the glyph, offset from `marker.radius ?? MARKER_RADIUS_PX`,
 * and is distinguished from the focus indicator by geometry: focus stays the
 * browser's rectangular outline, selection is this circle.
 */
export const SELECTION_RING_OFFSET_PX = 3;
export const SELECTION_RING_STROKE_PX = 2;

/*
 * Dimmed marker opacity, measured by alpha-blending over --pitch-surface
 * #0b3d2e: team A 4.02:1, team B 3.34:1 — both clear of the 3:1 non-text floor,
 * which they MUST be because dimmed markers stay focusable, tabbable, hittable
 * interactive targets. 0.45 would drop team B to 2.73:1 and fail.
 */
export const NODE_DIM_OPACITY = 0.55;

/**
 * Which state a whole event table is in, for the panel-level branch (Task 8.2).
 *
 * `null` and `[]` are DIFFERENT states in this contract, verbatim from the
 * EventTables $comment: "An empty array means zero events of that kind; null
 * means the report does not carry that data at all." `.length === 0` is never
 * the absence trigger — a side with zero markers still draws its pitch
 * (Task 6.11), because "the page was present and listed nothing" is a fact
 * about the match, not a missing section.
 */
export type PanelDataState = "absent" | "zero" | "ready";

export function panelDataState<T>(table: readonly T[] | null): PanelDataState {
  if (table === null) {
    return "absent";
  }
  return table.length === 0 ? "zero" : "ready";
}

/** The two sides a log table partitions across, resolved by the caller. */
export interface LogSide {
  teamId: string;
  /** Already uppercased by the caller — a code, not a translated label. */
  teamCode: string;
}

/**
 * Resolve an event's acting team, or throw naming the offending id.
 *
 * This is where Task 8.5's guarantee actually lives: a silent drop is exactly
 * the class of finding prior reviews flagged on groupScorers and
 * composeMatchTitle. ShotMapsSection builds both log tables eagerly, so every
 * row passes through here on load — not only when a reader opens the
 * disclosure. TacticalErrorBoundary contains the blast radius.
 */
export function resolveSide(teamId: string, home: LogSide, away: LogSide, table: string): LogSide {
  if (teamId === home.teamId) {
    return home;
  }
  if (teamId === away.teamId) {
    return away;
  }
  throw new Error(
    `${table}: event teamId ${JSON.stringify(teamId)} matches neither ` +
      `${JSON.stringify(home.teamId)} nor ${JSON.stringify(away.teamId)}`
  );
}

/** Rank used to break a minute tie home-before-away in both log tables. */
export function sideRank(teamId: string, home: LogSide): number {
  return teamId === home.teamId ? 0 : 1;
}

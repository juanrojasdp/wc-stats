import type { CrossDeliveryType, CrossEvent } from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { formatGoalMinute } from "@/lib/match-hero";
import { orderByMinute } from "@/viz/marker-layout";
import {
  resolveSide,
  sideRank,
  type LogSide,
  type MarkerDetailRow,
  type MarkerShape,
  type MarkerValue,
  type PitchMarker,
} from "@/viz/marker-model";

/*
 * CrossEvent -> marker / log row (Task 4.4). Pure and locale-free.
 *
 * DEFENSIVE BY MANDATE. CrossEvent's playerId / playerName / at / deliveryType
 * are `required` in the schema but UNFULFILLABLE from the source page: the
 * crosses section prints per-player delivery AGGREGATES with no per-event rows
 * and no ordinal glyphs, so Story 1.11 stages `delivery_type: null` and 1.16's
 * emission is blocked pending an AD-14 decision that will likely make them
 * nullable (deferred-work.md -> "Filed by Story 1.11 implementation"). The
 * fixtures' per-event values are HANDCRAFTED SAMPLES, not extractable data, and
 * the bundle reaches this code as an unvalidated `as`-cast. So every one of
 * those four fields is read through a nullish guard: never `undefined.minute`,
 * never a formatter throw, never a silently dropped row.
 */

/** Completion state — a two-value outcome the five shot hues do not model. */
export type CrossCompletionState = "completed" | "attempted";

/**
 * Ruled decision 4: crosses carry the ACTING TEAM's accent, with completion
 * dual-encoded by fill. Borrowing two shot-outcome hues would put one hex on
 * two meanings inside a single section where both panels are often on screen at
 * once — the exact collision DESIGN's "hex values are unique per meaning" rule
 * exists to prevent. The source's own legend (orange = attempted, blue =
 * completed, per Story 1.11's corpus finding) is honoured in STRUCTURE — two
 * values, dual-encoded — not in hue.
 *
 * The shape half is static; the colour half is per side, so the encoding is a
 * function of the accent var rather than a frozen table. Both are exported: the
 * `Record` keeps the two states exhaustive at compile time either way.
 */
export const CROSS_COMPLETED_SHAPE: Record<CrossCompletionState, MarkerShape> = {
  completed: "circle-filled",
  attempted: "circle-hollow",
};

export function crossCompletedEncoding(
  accentVar: string
): Record<CrossCompletionState, { shape: MarkerShape; colorVar: string }> {
  return {
    completed: { shape: CROSS_COMPLETED_SHAPE.completed, colorVar: accentVar },
    attempted: { shape: CROSS_COMPLETED_SHAPE.attempted, colorVar: accentVar },
  };
}

/** The six CrossDeliveryType codes, in the contract's own order. */
export const CROSS_DELIVERY_TYPES: readonly CrossDeliveryType[] = [
  "inswing",
  "outswing",
  "driven",
  "lofted",
  "cutback",
  "push-cross",
];

/** Dictionary key for a delivery-type label — `enums.crossDelivery.<code>`. */
export function crossDeliveryKey(deliveryType: CrossDeliveryType): DictionaryKey {
  return `enums.crossDelivery.${deliveryType}` as DictionaryKey;
}

const UNKNOWN: MarkerValue = { kind: "key", value: "viz.table.unknown" };

function completionState(cross: CrossEvent): CrossCompletionState {
  return cross.completed === true ? "completed" : "attempted";
}

function completionKey(cross: CrossEvent): DictionaryKey {
  return completionState(cross) === "completed" ? "viz.crossMap.completed" : "viz.crossMap.attempted";
}

/** The delivery key, or the placeholder key when the field is absent. */
function deliveryKeyOrPlaceholder(cross: CrossEvent): DictionaryKey {
  const deliveryType = cross.deliveryType;
  if (deliveryType == null) {
    return "viz.table.unknown";
  }
  if (!CROSS_DELIVERY_TYPES.includes(deliveryType)) {
    // An out-of-union value names itself rather than rendering a raw code.
    throw new Error(`cross-map-model: unknown CrossDeliveryType ${JSON.stringify(deliveryType)}`);
  }
  return crossDeliveryKey(deliveryType);
}

function crossDetail(cross: CrossEvent): MarkerDetailRow[] {
  return [
    {
      labelKey: "viz.table.player",
      value: cross.playerName == null ? UNKNOWN : { kind: "text", value: cross.playerName },
    },
    {
      labelKey: "viz.table.minute",
      value: cross.at == null ? UNKNOWN : { kind: "text", value: formatGoalMinute(cross.at) },
    },
    { labelKey: "viz.table.delivery", value: { kind: "key", value: deliveryKeyOrPlaceholder(cross) } },
    {
      labelKey: "viz.table.completed",
      value: { kind: "key", value: cross.completed === true ? "viz.table.yes" : "viz.table.no" },
    },
  ];
}

/** One team's crosses, ordered by minute, in that team's accent. */
export function crossMarkers(
  crosses: readonly CrossEvent[],
  teamId: string,
  accentVar: string
): PitchMarker[] {
  const encoding = crossCompletedEncoding(accentVar);
  const mine = crosses
    .map((cross, index) => ({ cross, index }))
    .filter(({ cross }) => cross.teamId === teamId);
  return orderByMinute(mine.map(({ cross, index }) => ({ cross, index, at: cross.at }))).map(
    ({ cross, index }) => {
      const state = encoding[completionState(cross)];
      return {
        key: `cross-${index}`,
        x: cross.x,
        y: cross.y,
        shape: state.shape,
        colorVar: state.colorVar,
        namePrefixKey: "viz.crossMap.markerPrefix" as DictionaryKey,
        subjectName: cross.playerName ?? null,
        minuteLabel: cross.at == null ? null : formatGoalMinute(cross.at),
        qualifierKey: completionKey(cross),
        detail: crossDetail(cross),
      };
    }
  );
}

/** Counts for the panel chip — again, the marks this panel drew. */
export function crossFigureCounts(markers: readonly PitchMarker[]): {
  crosses: number;
  completed: number;
} {
  return {
    crosses: markers.length,
    completed: markers.filter((marker) => marker.qualifierKey === "viz.crossMap.completed").length,
  };
}

export interface CrossLogRow {
  key: string;
  teamCode: string;
  playerName: string | null;
  minuteLabel: string | null;
  minute: number | null;
  stoppageMinute: number | null;
  x: number;
  y: number;
  /** Either an `enums.crossDelivery.*` key or `viz.table.unknown`. */
  deliveryKey: DictionaryKey;
  completed: boolean;
}

/** Both teams' crosses, ordered by minute then home before away. */
export function crossLogRows(
  crosses: readonly CrossEvent[],
  home: LogSide,
  away: LogSide
): CrossLogRow[] {
  const decorated = crosses.map((cross, index) => ({
    cross,
    index,
    side: resolveSide(cross.teamId, home, away, "cross-map-model"),
  }));
  const bySide = [...decorated].sort(
    (a, b) => sideRank(a.cross.teamId, home) - sideRank(b.cross.teamId, home)
  );
  return orderByMinute(bySide.map((entry) => ({ ...entry, at: entry.cross.at }))).map(
    ({ cross, index, side }) => ({
      key: `cross-row-${index}`,
      teamCode: side.teamCode,
      playerName: cross.playerName ?? null,
      minuteLabel: cross.at == null ? null : formatGoalMinute(cross.at),
      minute: cross.at?.minute ?? null,
      stoppageMinute: cross.at?.stoppageMinute ?? null,
      x: cross.x,
      y: cross.y,
      deliveryKey: deliveryKeyOrPlaceholder(cross),
      completed: cross.completed === true,
    })
  );
}

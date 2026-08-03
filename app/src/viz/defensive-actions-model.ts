import type {
  DefensiveActionEvent,
  DefensiveActionType,
  PossessionContestType,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { formatGoalMinute } from "@/lib/match-hero";
import { orderByMinute } from "@/viz/marker-layout";
import {
  resolveSide,
  sideRank,
  type LogSide,
  type MarkerDetailRow,
  type MarkerShape,
  type PitchMarker,
} from "@/viz/marker-model";

/*
 * `#defensive-actions` — the ONE real pitch map Story 2.9 ships. Pure and
 * locale-free like every module under src/viz.
 *
 * BUILT TO THE CORPUS-REAL FIELD SET, NOT THE FIXTURE'S (ruled decision 5).
 * The fixtures are actively misleading here and will train a reader of this
 * file into a defect. Measured across all three of them: `at` and `playerName`
 * are populated on 100% of rows, and block + possession-contest account for
 * 44 / 47 / 55% of markers. The CORPUS says otherwise:
 *
 *   - `contest_type` is null on 20,169 / 20,169 events;
 *   - `playerId`, `playerName` and `at` have NO CARRIER AT ALL — all three are
 *     under an open AD-14 emission blocker;
 *   - `block` and `possession-contest` are AGGREGATE PANELS with no
 *     coordinates anywhere in the corpus, so only `forced-turnover` and
 *     `possession-regain` can ever be plotted.
 *
 * Three consequences are encoded below rather than left to a comment:
 *   1. NO static encoding table over the enum. The 2.7 SHOT_OUTCOME_ENCODING
 *      pattern would assert a visual treatment for two values that can never
 *      appear. (The ban is on encoding tables only — the frozen ORDERED CODE
 *      LIST below is required, for labelling and sort order.)
 *   2. NO feature depends on player identity or the clock: no grouping by
 *      player, no minute filter, no "top actor" line. `orderByMinute` already
 *      sorts clock-less rows last and stably, and must stay correct when EVERY
 *      `at` is absent.
 *   3. Any count chip enumerates ONLY the types actually present, never a
 *      fixed four.
 */

/**
 * The four DefensiveActionType codes in the schema's declaration order — the
 * label and sort order, NOT an encoding (ruled decisions 5 and 16). Typed over
 * the generated union so a contract enum change is a compile error.
 */
export const DEFENSIVE_ACTION_TYPES: readonly DefensiveActionType[] = [
  "forced-turnover",
  "possession-regain",
  "block",
  "possession-contest",
];

/** Dictionary key for an action-type label — `enums.defensiveAction.<code>` (AD-7). */
export function defensiveActionKey(code: DefensiveActionType): DictionaryKey {
  return `enums.defensiveAction.${code}` as DictionaryKey;
}

/** Dictionary key for a contest-type label — `enums.possessionContest.<code>`. */
export function possessionContestKey(code: PossessionContestType): DictionaryKey {
  return `enums.possessionContest.${code}` as DictionaryKey;
}

/** The one shape this family draws (ruled decision 6). */
const DEFENSIVE_SHAPE: MarkerShape = "triangle-filled";

/** A side plus the `-on-pitch` accent its markers take (ruled decision 8). */
export interface DefensiveSide extends LogSide {
  /** A CSS custom property NAME — always a `-on-pitch` variant on the pitch. */
  colorVar: string;
}

/**
 * `at` is typed non-nullable in the contract but has NO CARRIER in the corpus,
 * and bundles reach the App as `as`-cast unvalidated JSON. Read it defensively
 * everywhere: a `formatGoalMinute(null)` would throw and take all eleven
 * Tactical sections down through the single shared error boundary.
 */
function minuteLabelOf(event: DefensiveActionEvent): string | null {
  return event.at == null ? null : formatGoalMinute(event.at);
}

/** Same reasoning for the player name: declared `string`, absent in the corpus. */
function playerNameOf(event: DefensiveActionEvent): string | null {
  const name = event.playerName;
  return name == null || name === "" ? null : name;
}

/**
 * The UX-DR9 popover rows, in display order: team, player, minute, action
 * type, contest type.
 *
 * Player and minute use the em-dash placeholder (`viz.table.unknown`) — the
 * popover is a VISUAL surface, so the dash is right there, unlike the spoken
 * accessible name, which uses words.
 *
 * THE CONTEST-TYPE ROW IS OMITTED ENTIRELY when null (ruled decision 20). On
 * corpus-real data that means the popover shows team + action type + two em
 * dashes — the complete, correct popover, asserted verbatim in a test so
 * nobody later reads it as a bug.
 */
function defensiveDetail(event: DefensiveActionEvent, teamCode: string): MarkerDetailRow[] {
  const playerName = playerNameOf(event);
  const minuteLabel = minuteLabelOf(event);
  const rows: MarkerDetailRow[] = [
    { labelKey: "viz.table.team", value: { kind: "text", value: teamCode } },
    {
      labelKey: "viz.table.player",
      value:
        playerName === null
          ? { kind: "key", value: "viz.table.unknown" }
          : { kind: "text", value: playerName },
    },
    {
      labelKey: "viz.table.minute",
      value:
        minuteLabel === null
          ? { kind: "key", value: "viz.table.unknown" }
          : { kind: "text", value: minuteLabel },
    },
    {
      labelKey: "viz.table.actionType",
      value: { kind: "key", value: defensiveActionKey(event.actionType) },
    },
  ];
  if (event.contestType !== null && event.contestType !== undefined) {
    rows.push({
      labelKey: "viz.table.contestType",
      value: { kind: "key", value: possessionContestKey(event.contestType) },
    });
  }
  return rows;
}

/**
 * Both teams' markers, partitioned by acting team and ordered by minute.
 *
 * Partitioning through `resolveSide` rather than a per-team filter is
 * deliberate: a stray `teamId` NAMES ITSELF instead of vanishing from both
 * figures. The section builds these eagerly on load, so the throw lands inside
 * TacticalErrorBoundary at mount rather than when a reader opens something.
 *
 * `null` and `[]` both return two empty arrays. `sectionDataState` gates on
 * `!== null` ONLY, so `[]` reaches this module as "ready" and every entry point
 * must survive it (ruled decision 10 — one boundary wraps all eleven sections,
 * and Story 2.8 already took them all down exactly this way once).
 *
 * `x`/`y` are copied VERBATIM: never clamped, never adjusted (AR-6/AD-6). The
 * key indexes the ARTIFACT array — data, not layout — so it survives a reflow.
 */
export function defensiveMarkers(
  events: readonly DefensiveActionEvent[] | null,
  home: DefensiveSide,
  away: DefensiveSide
): { home: PitchMarker[]; away: PitchMarker[] } {
  const buckets: { home: PitchMarker[]; away: PitchMarker[] } = { home: [], away: [] };
  if (events === null || events.length === 0) {
    return buckets;
  }
  const decorated = events.map((event, index) => ({
    event,
    index,
    side: resolveSide(event.teamId, home, away, "defensive-actions-model"),
  }));
  for (const entry of orderByMinute(decorated.map((item) => ({ ...item, at: item.event.at })))) {
    const { event, index, side } = entry;
    const colorVar = side.teamId === home.teamId ? home.colorVar : away.colorVar;
    const marker: PitchMarker = {
      key: `defensive-${index}`,
      x: event.x,
      y: event.y,
      shape: DEFENSIVE_SHAPE,
      colorVar,
      /*
       * The three-clause accessible name (PitchPanel's `markerName` contract):
       * "Acción defensiva de <player>, minuto <clock>, <action type>". Unlike
       * Story 2.8, these events DO carry a real clock in the contract, so the
       * middle clause is used for its actual purpose — no positional overload.
       *
       * `qualifierKey` is the action type's ONLY visual-free carrier under
       * ruled decision 19: the map draws one shape in one colour per team, so
       * the type reaches the reader here, in the popover, and in the log
       * column — three non-visual channels, none of which over-claims.
       */
      namePrefixKey: "viz.defensiveActions.markerPrefix" as DictionaryKey,
      minutePrefixKey: "viz.defensiveActions.minutePrefix" as DictionaryKey,
      subjectName: playerNameOf(event),
      minuteLabel: minuteLabelOf(event),
      qualifierKey: defensiveActionKey(event.actionType),
      detail: defensiveDetail(event, side.teamCode),
    };
    if (side.teamId === home.teamId) {
      buckets.home.push(marker);
    } else {
      buckets.away.push(marker);
    }
  }
  return buckets;
}

/** One legend row — structurally a PitchPanel `kind: "mark"` entry. */
export interface DefensiveLegendEntry {
  kind: "mark";
  shape: MarkerShape;
  colorVar: string;
  label: string;
}

/** What the caller knows about a side before the legend is built. */
export interface DefensiveLegendSide {
  colorVar: string;
  /** Already-resolved: team code + the section's noun. */
  label: string;
  markerCount: number;
}

/**
 * ONE ENTRY PER TEAM — never one per action type (ruled decision 19).
 *
 * Decision 6 adds exactly one shape and decision 8 rules team-only colour, so
 * `forced-turnover` and `possession-regain` are VISUALLY IDENTICAL on the map.
 * A per-type legend would therefore claim a distinction the map does not draw
 * — the same class of lie decision 5 exists to prevent, inverted. Compare the
 * shipped cross legend, where shape genuinely carries completion inside the
 * team accent.
 *
 * A side that drew nothing is dropped: a swatch for a mark no figure contains
 * is its own small lie.
 */
export function defensiveLegend(
  sides: readonly DefensiveLegendSide[]
): DefensiveLegendEntry[] {
  return sides
    .filter((side) => side.markerCount > 0)
    .map((side) => ({
      kind: "mark" as const,
      shape: DEFENSIVE_SHAPE,
      colorVar: side.colorVar,
      label: side.label,
    }));
}

/** One row of the "Ver los datos" log. */
export interface DefensiveLogRow {
  key: string;
  teamCode: string;
  playerName: string | null;
  minuteLabel: string | null;
  minute: number;
  stoppageMinute: number;
  x: number;
  y: number;
  actionTypeKey: DictionaryKey;
  /** null ⇒ this row has no contest type; see `anyContestType` for the column. */
  contestTypeKey: DictionaryKey | null;
}

/**
 * Every event from both teams, ordered by minute then home before away.
 *
 * The pre-sort by side is what gives the tiebreak: both sorts are stable, so
 * ordering by side first and by minute second leaves minute major, side minor,
 * artifact order last — the shipped `shotLogRows` shape, and
 * `orderByMinute` is imported rather than re-implemented so the roving order
 * and the table's default sort can never disagree.
 */
export function defensiveRows(
  events: readonly DefensiveActionEvent[] | null,
  home: LogSide,
  away: LogSide
): DefensiveLogRow[] {
  if (events === null || events.length === 0) {
    return [];
  }
  const decorated = events.map((event, index) => ({
    event,
    index,
    side: resolveSide(event.teamId, home, away, "defensive-actions-model"),
  }));
  const bySide = [...decorated].sort(
    (a, b) => sideRank(a.event.teamId, home) - sideRank(b.event.teamId, home)
  );
  return orderByMinute(bySide.map((entry) => ({ ...entry, at: entry.event.at }))).map(
    ({ event, index, side }) => ({
      key: `defensive-row-${index}`,
      teamCode: side.teamCode,
      playerName: playerNameOf(event),
      minuteLabel: minuteLabelOf(event),
      minute: event.at?.minute ?? 0,
      stoppageMinute: event.at?.stoppageMinute ?? 0,
      x: event.x,
      y: event.y,
      actionTypeKey: defensiveActionKey(event.actionType),
      contestTypeKey:
        event.contestType === null || event.contestType === undefined
          ? null
          : possessionContestKey(event.contestType),
    })
  );
}

/**
 * Does the log need a contest-type column at all?
 *
 * A WHOLE-COLUMN decision on the FD-1 precedent (ruled decision 20): the
 * shipped `showXg` gate omits a column whose every value is null. On
 * corpus-real data `contest_type` is null on 20,169 / 20,169, so a per-cell em
 * dash would ship a column of 20,169 em dashes.
 */
export function anyContestType(rows: readonly { contestTypeKey: DictionaryKey | null }[]): boolean {
  return rows.some((row) => row.contestTypeKey !== null);
}

/**
 * Counts for the panel's chip and the figure summary.
 *
 * `byType` enumerates ONLY the types actually present, in the frozen order —
 * never a fixed four (ruled decision 5). Two of the four can never be plotted,
 * so a chip listing all four would advertise categories the map cannot contain.
 */
export function defensiveFigureCount(markers: readonly PitchMarker[]): {
  total: number;
  byType: { code: DefensiveActionType; count: number }[];
} {
  const counts = new Map<DefensiveActionType, number>();
  for (const marker of markers) {
    for (const code of DEFENSIVE_ACTION_TYPES) {
      if (marker.qualifierKey === defensiveActionKey(code)) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }
  }
  return {
    total: markers.length,
    byType: DEFENSIVE_ACTION_TYPES.filter((code) => (counts.get(code) ?? 0) > 0).map((code) => ({
      code,
      count: counts.get(code) ?? 0,
    })),
  };
}

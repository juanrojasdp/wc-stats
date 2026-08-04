import type { ShotEvent, ShotOutcome } from "@/lib/contract/contract-types";
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
 * ShotEvent -> marker / log row (Task 4.3). Pure and locale-free.
 */

/**
 * UX-DR10's five-outcome encoding: colour token AND shape, verbatim from
 * DESIGN's table. A `Record` over the GENERATED union, so a contract enum
 * change is a compile error here rather than a silently unstyled marker.
 *
 * CS-1-proof by construction: this maps `ShotOutcome` — the stable five-value
 * marker enum — and never `ShotOutcomeDetail`, whose 22->24 extension is CS-1's
 * payload. AD-14 decision CR-2 makes `outcome` authoritative for marker
 * encoding ("the App treats outcome as authoritative, never derived from
 * outcomeDetail"), so the detail labels belong to Stories 2.11 / 2.13 / 2.18.
 */
export const SHOT_OUTCOME_ENCODING: Record<
  ShotOutcome,
  { shape: MarkerShape; colorVar: string }
> = {
  goal: { shape: "circle-filled-ring", colorVar: "--shot-goal" },
  "on-target": { shape: "circle-filled", colorVar: "--shot-on-target" },
  "off-target": { shape: "circle-hollow", colorVar: "--shot-off-target" },
  blocked: { shape: "square-filled", colorVar: "--shot-blocked" },
  incomplete: { shape: "square-hollow", colorVar: "--shot-incomplete" },
};

/** The five ShotOutcome codes, in DESIGN's legend order. */
export const SHOT_OUTCOMES: readonly ShotOutcome[] = [
  "goal",
  "on-target",
  "off-target",
  "blocked",
  "incomplete",
];

/** Dictionary key for an outcome label — `enums.shotOutcome.<code>` (AD-7). */
export function shotOutcomeKey(outcome: ShotOutcome): DictionaryKey {
  return `enums.shotOutcome.${outcome}` as DictionaryKey;
}

function shotDetail(shot: ShotEvent): MarkerDetailRow[] {
  const rows: MarkerDetailRow[] = [
    {
      labelKey: "viz.table.player",
      value:
        shot.playerName == null
          ? { kind: "key", value: "viz.table.unknown" }
          : { kind: "text", value: shot.playerName },
    },
    {
      labelKey: "viz.table.minute",
      value:
        shot.at == null
          ? { kind: "key", value: "viz.table.unknown" }
          : { kind: "text", value: formatGoalMinute(shot.at) },
    },
    { labelKey: "viz.table.outcome", value: { kind: "key", value: shotOutcomeKey(shot.outcome) } },
  ];
  /*
   * FD-1: the xG row is OMITTED while expectedGoals is null — not rendered
   * empty and not rendered as an em-dash, because a dash implies a value the
   * source never had. The nullable slot stays as the forward-compatible landing
   * zone, so this branch is live code the moment per-shot xG ever exists.
   */
  if (shot.expectedGoals !== null && shot.expectedGoals !== undefined) {
    rows.push({
      labelKey: "viz.shotMap.xg",
      value: { kind: "number", value: shot.expectedGoals, digits: 2 },
    });
  }
  return rows;
}

/**
 * One team's plotted attempts, ordered by minute.
 *
 * Own goals are DROPPED (AR-6: "present in log and scorer list — excluded from
 * shot-map rendering"). `events.shootoutAttempts` is not read by this module at
 * all: it is a different table by AR-6, and the ShotEvent $comment says so
 * outright — "Shoot-out attempts never appear here … Story 2.7 never plots
 * them." m074 carries nine of them as the proof fixture.
 */
export function shotMarkers(shots: readonly ShotEvent[], teamId: string): PitchMarker[] {
  const mine = shots
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => shot.teamId === teamId && shot.ownGoal !== true);
  return orderByMinute(mine.map(({ shot, index }) => ({ ...shot, at: shot.at, __index: index })))
    .map(({ __index, ...shot }) => {
      const encoding = SHOT_OUTCOME_ENCODING[shot.outcome];
      if (encoding === undefined) {
        // Bundles are `as`-cast unvalidated JSON; an out-of-union outcome must
        // name itself rather than render an invisible marker.
        throw new Error(`shot-map-model: unknown ShotOutcome ${JSON.stringify(shot.outcome)}`);
      }
      return {
        key: `shot-${__index}`,
        x: shot.x,
        y: shot.y,
        shape: encoding.shape,
        colorVar: encoding.colorVar,
        namePrefixKey: "viz.shotMap.markerPrefix" as DictionaryKey,
        minutePrefixKey: "viz.shotMap.minutePrefix" as DictionaryKey,
        subjectName: shot.playerName ?? null,
        minuteLabel: shot.at == null ? null : formatGoalMinute(shot.at),
        qualifierKey: shotOutcomeKey(shot.outcome),
        detail: shotDetail(shot),
      };
    });
}

/** Does this team have an own goal that the map excludes? Drives Task 8.7's note. */
export function hasExcludedOwnGoals(shots: readonly ShotEvent[], teamId: string): boolean {
  return shots.some((shot) => shot.teamId === teamId && shot.ownGoal === true);
}

/**
 * Counts for the figure summary and the panel chip.
 *
 * Deliberately counts the MARKS THIS PANEL DREW, never keyStatistics[side]:
 * m074's Germany has `goals: 1` (the benefiting-team scoreline value for
 * GOMEZ's own goal) and ZERO goal markers on its map, so an aria-label reading
 * "1 gol" over a map with no green marker is exactly the quiet lie FR-22 exists
 * to prevent. The figure summary describes the figure. (Team xG IS read from
 * keyStatistics — that is a real artifact total.)
 */
export function shotFigureCounts(markers: readonly PitchMarker[]): {
  shots: number;
  goals: number;
} {
  const goalKey = shotOutcomeKey("goal");
  return {
    shots: markers.length,
    goals: markers.filter((marker) => marker.qualifierKey === goalKey).length,
  };
}

export interface ShotLogRow {
  key: string;
  teamCode: string;
  playerName: string | null;
  minuteLabel: string | null;
  /*
   * NULL when the attempt carries no clock — never 0.
   *
   * STORY 2.11a DECISION 3, which CLOSES the ledger's "dead fields carrying a
   * defaulting decision" item. These were `shot.at?.minute ?? 0`, which stamped
   * minute 0 on every clock-less row while `minuteLabel` stayed null and
   * `orderByMinute` sorted the row LAST — so the row claimed the earliest
   * possible clock and the earliest position disagreed. Nothing read them until
   * the shared sortable table arrived; an `aria-sort` over `.minute` would have
   * ordered every clock-less attempt FIRST, silently, and pinned green by
   * fixtures that populate `at` on 100% of rows.
   *
   * `CrossLogRow` already used `?? null` and `DefensiveLogRow` was fixed by
   * Story 2.9's code review; this makes all THREE log row models agree on one
   * null contract, asserted across the three in shot-map-model.test.ts.
   */
  minute: number | null;
  stoppageMinute: number | null;
  x: number;
  y: number;
  outcomeKey: DictionaryKey;
  /** Own goals stay in the log; the table suffixes them so an 8-row log against 7 markers reconciles. */
  ownGoal: boolean;
  expectedGoals: number | null;
}

/**
 * Every attempt from both teams, INCLUDING own goals (AR-6 verbatim), ordered
 * by minute then home before away.
 *
 * The pre-sort by side is what gives the home-before-away tiebreak: both sorts
 * are stable, so ordering by side first and by minute second leaves minute
 * major, side minor, artifact order last.
 */
export function shotLogRows(
  shots: readonly ShotEvent[],
  home: LogSide,
  away: LogSide
): ShotLogRow[] {
  const decorated = shots.map((shot, index) => ({
    shot,
    index,
    side: resolveSide(shot.teamId, home, away, "shot-map-model"),
  }));
  const bySide = [...decorated].sort(
    (a, b) => sideRank(a.shot.teamId, home) - sideRank(b.shot.teamId, home)
  );
  return orderByMinute(bySide.map((entry) => ({ ...entry, at: entry.shot.at }))).map(
    ({ shot, index, side }) => ({
      key: `shot-row-${index}`,
      teamCode: side.teamCode,
      playerName: shot.playerName ?? null,
      minuteLabel: shot.at == null ? null : formatGoalMinute(shot.at),
      minute: shot.at?.minute ?? null,
      stoppageMinute: shot.at?.stoppageMinute ?? null,
      x: shot.x,
      y: shot.y,
      outcomeKey: shotOutcomeKey(shot.outcome),
      ownGoal: shot.ownGoal === true,
      expectedGoals: shot.expectedGoals ?? null,
    })
  );
}

/**
 * Does the log need an xG column at all? FD-1: the column is omitted entirely
 * while every value is null — an all-empty column is noise — and appears the
 * moment one row carries a value.
 */
export function anyExpectedGoals(rows: readonly { expectedGoals: number | null }[]): boolean {
  return rows.some((row) => row.expectedGoals !== null);
}

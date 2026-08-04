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

/*
 * The frozen ordered code lists (ruled decision 16), each DERIVED FROM A RECORD
 * KEYED BY THE GENERATED UNION rather than written as a bare array.
 *
 * REVIEW PATCH: the bare `readonly T[]` form the story asked for does NOT
 * deliver the compile-error guarantee its docblock claimed. An array literal
 * stays assignable however many members the contract enum gains, so widening
 * `DefensiveActionType` would compile silently — and the i18n exhaustiveness
 * suite compares locale keys against this very array, so it would not catch the
 * gap either. Keying a record by the union makes a contract change a COMPILE
 * ERROR here, which is what decision 16 actually wants.
 *
 * `Object.keys` returns non-numeric string keys in insertion order, so the
 * schema's declaration order is preserved.
 */
const DEFENSIVE_ACTION_ORDER: Record<DefensiveActionType, true> = {
  "forced-turnover": true,
  "possession-regain": true,
  block: true,
  "possession-contest": true,
};

/**
 * The four DefensiveActionType codes in the schema's declaration order — the
 * label and sort order, NOT an encoding (ruled decisions 5 and 16).
 */
export const DEFENSIVE_ACTION_TYPES: readonly DefensiveActionType[] = Object.keys(
  DEFENSIVE_ACTION_ORDER
) as DefensiveActionType[];

const POSSESSION_CONTEST_ORDER: Record<PossessionContestType, true> = {
  pass: true,
  "attempt-at-goal": true,
  cross: true,
  clearance: true,
  "physical-duel": true,
  "aerial-duel": true,
};

/**
 * The six PossessionContestType codes in the schema's declaration order.
 *
 * REVIEW PATCH: previously hand-copied into `i18n.test.ts` while its two
 * siblings were imported, so a seventh contest code would have needed two files
 * edited to be caught and the label-resolution loop would never have visited
 * it. Exported here so the suite is driven by the union everywhere.
 */
export const POSSESSION_CONTEST_TYPES: readonly PossessionContestType[] = Object.keys(
  POSSESSION_CONTEST_ORDER
) as PossessionContestType[];

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
 * `x`/`y` must be finite, and this fails LOUD AT LOAD if they are not.
 *
 * REVIEW PATCH: `x` and `y` were the only fields in this module read without a
 * guard, while `at`, `playerName` and `contestType` were all read defensively
 * for the same stated reason — bundles reach the App as `as`-cast unvalidated
 * JSON. An absent coordinate reached `formatDecimal(row.x, …)`, whose
 * `assertFinite` throws; and because the log table lives inside the lazily
 * mounted `ViewDataDisclosure`, that throw fired when a READER OPENED "Ver los
 * datos" — the deferred throw the eager-build convention (ruled decision 10)
 * exists to prevent, taking all eleven Tactical sections down with it.
 *
 * Throwing here instead puts the failure at mount, inside the boundary, naming
 * itself — exactly what `resolveSide` already does for a stray `teamId`. The
 * values themselves are still passed through VERBATIM: this validates, it never
 * clamps or adjusts (AR-6 / AD-6).
 */
function assertPlottable(event: DefensiveActionEvent, index: number, table: string): void {
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) {
    throw new Error(
      `${table}: defensive action at artifact index ${index} has a non-finite coordinate ` +
        `(x=${JSON.stringify(event.x)}, y=${JSON.stringify(event.y)})`
    );
  }
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
  const decorated = events.map((event, index) => {
    assertPlottable(event, index, "defensive-actions-model");
    return {
      event,
      index,
      side: resolveSide(event.teamId, home, away, "defensive-actions-model"),
    };
  });
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
       * "Acción defensiva de <player>, minuto <clock>, <action type>".
       *
       * REVIEW PATCH — THE ORIGINAL JUSTIFICATION HERE WAS FALSE and is
       * corrected rather than quietly dropped. It read: "Unlike Story 2.8,
       * these events DO carry a real clock in the contract, so the middle
       * clause is used for its actual purpose — no positional overload." The
       * contract DECLARES a clock; the corpus carries none — `at` has no
       * carrier at all, which is precisely why `minuteLabelOf` above exists.
       *
       * The measured consequence, ruled and accepted rather than hidden: on
       * corpus-real data `subjectName` and `minuteLabel` are both null on every
       * row, so all ~97 markers per side announce the SAME sentence
       * ("Acción defensiva de jugador desconocido, minuto desconocido, <type>")
       * and a keyboard reader roving the tabindex cannot tell one triangle from
       * another. Story 2.8's positional overload is still declined — it would
       * repeat the naming drift the ledger already routes for a rename, and a
       * disambiguator is a UX call this story does not have. Filed to the
       * ledger against Story 1.16, whose emission decides whether these fields
       * ever get a carrier.
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
  /*
   * NULL when the event carries no clock — never 0.
   *
   * REVIEW PATCH: these were `event.at?.minute ?? 0`, which stamped minute 0 on
   * every clock-less row while `minuteLabel` stayed null and `orderByMinute`
   * sorted the row LAST. On corpus-real data, where `at` has no carrier at all,
   * that meant every row claimed minute 0.
   *
   * STORY 2.11a HAS NOW LANDED and the sort this anticipated is live: the
   * shared DataTable's clock column reads these two fields through
   * `clockSortValue`, which returns `null` — not 0 — for an absent clock, so a
   * clock-less row sorts to the END of the array in both directions, agreeing
   * with `orderByMinute`. 2.11a also closed the same `?? 0` in `ShotLogRow`,
   * so all three log row models now share one null contract.
   */
  minute: number | null;
  stoppageMinute: number | null;
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
  const decorated = events.map((event, index) => {
    assertPlottable(event, index, "defensive-actions-model");
    return {
      event,
      index,
      side: resolveSide(event.teamId, home, away, "defensive-actions-model"),
    };
  });
  const bySide = [...decorated].sort(
    (a, b) => sideRank(a.event.teamId, home) - sideRank(b.event.teamId, home)
  );
  return orderByMinute(bySide.map((entry) => ({ ...entry, at: entry.event.at }))).map(
    ({ event, index, side }) => ({
      key: `defensive-row-${index}`,
      teamCode: side.teamCode,
      playerName: playerNameOf(event),
      minuteLabel: minuteLabelOf(event),
      minute: event.at?.minute ?? null,
      stoppageMinute: event.at?.stoppageMinute ?? null,
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
 * Does the log need a player column at all?
 *
 * REVIEW PATCH (ruled): the FD-1 whole-column gate now covers all three
 * absent-on-corpus fields, not just `contestType`. `playerId`, `playerName` and
 * `at` have NO CARRIER AT ALL in the corpus by the same measurement that
 * justified decision 20 — so on real data these columns were in exactly the
 * condition decision 20 removes the contest column for, and shipped 2 × 20,169
 * em-dash cells. The fixtures populate both on 100% of rows, so nothing visibly
 * changes until the 2.19 cutover.
 */
export function anyPlayerName(rows: readonly { playerName: string | null }[]): boolean {
  return rows.some((row) => row.playerName !== null);
}

/** Does the log need a minute column at all? See `anyPlayerName`. */
export function anyMinute(rows: readonly { minuteLabel: string | null }[]): boolean {
  return rows.some((row) => row.minuteLabel !== null);
}

/**
 * The count for the panel's chip and the figure summary — THE TOTAL, and
 * nothing else.
 *
 * RULED at code review, as an amendment to decision 5's "any count chip
 * enumerates only the types actually present". Decision 19 deliberately refuses
 * to distinguish `forced-turnover` from `possession-regain` on the map — one
 * shape, one colour per team — so a chip enumerating them beside that legend
 * would re-introduce exactly the distinction the map does not draw. The
 * coherence with decision 19 wins; the per-type breakdown still reaches the
 * reader through three non-visual carriers (the marker's accessible name, the
 * popover, and the log table's action-type column).
 *
 * The `byType` field this function used to return is DELETED with that ruling:
 * it had no consumer in the render path, and rebuilding four template-literal
 * keys per marker per render (~776 discarded allocations at corpus density) to
 * recover an enum code `PitchMarker` had already discarded went with it.
 */
export function defensiveFigureCount(markers: readonly PitchMarker[]): { total: number } {
  return { total: markers.length };
}

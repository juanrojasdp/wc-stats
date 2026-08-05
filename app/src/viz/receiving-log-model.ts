import type { DictionaryKey } from "@/lib/i18n";
import type {
  OfferMovementType,
  ReceivingEvent,
  ReceivingEventType,
} from "@/lib/contract/contract-types";
import { formatGoalMinute } from "@/lib/match-hero";
import { orderByMinute } from "@/viz/marker-layout";
import { resolveSide, sideRank, type LogSide } from "@/viz/marker-model";
import { offerMovementKey } from "@/viz/receiving-model";

/*
 * THE RECEIVING LOG — the one table Story 2.11c renders, and the app's FIRST
 * AND ONLY reader of `bundle.events.receiving`.
 *
 * WHY THIS IS A NEW MODULE AND NOT PART OF `receiving-model.ts` (ruled decision
 * 5). That module is the DOMAIN G AGGREGATE model behind #offers-to-receive and
 * #movement-to-receive, and its docblock bans exactly what this file does in so
 * many words — "built from Domain G — NOT from `events.receiving` (Story 2.9
 * ruled decision 2)" — along with two hard bans that still hold: those
 * aggregates are never rendered as events and never placed on a pitch. Nothing
 * here touches that. `offerMovementKey` is IMPORTED from it; nothing is added
 * to it.
 *
 * FIXTURE-ONLY TODAY, AND THAT IS THE DESIGN, NOT A GAP. Story 1.13 measured
 * `ReceivingEvent` unfulfillable across 104 reports / 416 pages, so on
 * corpus-real data `events.receiving` is null and `anyReceivingEvents` removes
 * the whole log — the FD-1 shape the shipped `anyExpectedGoals`,
 * `anyContestType`, `anyPlayerName` and `anyMinute` gates already use (ruled
 * decision 4). The fixtures ship 270 events (m001 87, m002 87, m074 96) with all
 * eight fields non-null on 270/270, so every column below has a source in the
 * data the app serves today. The accurate phrase is "unpopulatable on corpus
 * data; fixture-only today" — never "unbuildable".
 *
 * TWO ENUMS, BOTH RENDERED (ruling 3). The event carries two candidates for
 * "type": the discriminator `type: "offer" | "movement"`, which names the two
 * SECTIONS the one array feeds, and `movementType`, the finer six-value
 * classification. The log merges both sections into one table, so without the
 * discriminator a reader could not tell an offer row from a movement row on any
 * of the 270 — the table would be actively misleading. `movementType` reuses the
 * shipped `enums.offerMovement` labels; only the two-value discriminator
 * namespace is new.
 *
 * Pure and locale-free like every module under src/viz: dictionary KEYS and raw
 * numbers out, components resolve them. A `t()` call here is an ESLint error
 * (the client-import seam), and `@/lib/format` is kept out by the same
 * discipline.
 */

/*
 * The two ReceivingEventType codes, DERIVED FROM A RECORD KEYED BY THE GENERATED
 * UNION rather than written as a bare array — the `OFFER_MOVEMENT_ORDER`
 * pattern, and for its stated reason: an array literal stays assignable however
 * many members the contract enum gains, so a widened `ReceivingEventType` would
 * compile silently, and `i18n.test.ts` compares the locale namespace against
 * this very list, so the gap would slip past both. Keying a record by the union
 * makes a contract change a COMPILE ERROR here.
 *
 * `Object.keys` returns non-numeric string keys in insertion order, so the
 * schema's declaration order is preserved.
 */
const RECEIVING_EVENT_ORDER: Record<ReceivingEventType, true> = {
  offer: true,
  movement: true,
};

/** The two ReceivingEventType codes in the schema's declaration order. */
export const RECEIVING_EVENT_TYPES: readonly ReceivingEventType[] = Object.keys(
  RECEIVING_EVENT_ORDER
) as ReceivingEventType[];

/** Dictionary key for the discriminator — `enums.receivingEventType.<code>` (AD-7). */
export function receivingEventTypeKey(type: ReceivingEventType): DictionaryKey {
  return `enums.receivingEventType.${type}` as DictionaryKey;
}

/**
 * One row of the receiving log.
 *
 * THE FIRST SEVEN FIELD NAMES ARE A STRUCTURAL CONTRACT, not a style choice.
 * `ShotLogRow`, `CrossLogRow` and `DefensiveLogRow` already share them, and
 * they are what lets this model reuse `anyPlayerName` and `anyMinute` from
 * `defensive-actions-model.ts` UNMODIFIED — both are declared with structural
 * parameters (`readonly { playerName: string | null }[]` and
 * `readonly { minuteLabel: string | null }[]`), so renaming a field here would
 * silently cost two presence gates.
 */
export interface ReceivingLogRow {
  key: string;
  teamCode: string;
  playerName: string | null;
  minuteLabel: string | null;
  /** NULL when the event carries no clock — never 0. The 2.11a decision-3 contract. */
  minute: number | null;
  stoppageMinute: number | null;
  x: number;
  y: number;
  /** `enums.receivingEventType.<offer|movement>` — the discriminator (ruling 3). */
  eventTypeKey: DictionaryKey;
  /** null ⇒ the report did not classify this event; see `anyMovementType`. */
  movementTypeKey: DictionaryKey | null;
}

/**
 * `x`/`y` must be finite, and this fails LOUD AT MODEL ENTRY if they are not.
 *
 * The defensive log's own `assertPlottable`, copied verbatim with only the
 * table string changed, and for the reason 2.9's review found the hard way: an
 * absent coordinate reaching `formatDecimal`'s `assertFinite` throws INSIDE the
 * table, so the failure fires when a reader opens it — far from its cause. This
 * log's rows are built eagerly at mount, inside the Expert Layer's sibling
 * error boundary, so a bad coordinate names itself immediately, exactly as
 * `resolveSide` already does for a stray `teamId`.
 *
 * The values themselves pass through VERBATIM: this validates, it never clamps
 * or adjusts (AR-6 / AD-6).
 */
function assertPlottable(event: ReceivingEvent, index: number, table: string): void {
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) {
    throw new Error(
      `${table}: receiving event at artifact index ${index} has a non-finite coordinate ` +
        `(x=${JSON.stringify(event.x)}, y=${JSON.stringify(event.y)})`
    );
  }
}

/**
 * `playerName` is `required` with `minLength: 1` in the schema, but the bundle
 * arrives as `as`-cast unvalidated JSON — so absent AND empty-string both mean
 * "no name", matching `playerNameOf` in `defensive-actions-model.ts`.
 */
function playerNameOf(event: ReceivingEvent): string | null {
  const name = event.playerName;
  return name == null || name === "" ? null : name;
}

/**
 * The movement classification's key, or null when the report did not classify
 * this event.
 *
 * `offerMovementKey` is REUSED rather than restated: `i18n.test.ts` pins
 * `enums.offerMovement`'s key set to `OFFER_MOVEMENT_TYPES` exactly, so minting
 * a seventh set here would turn a green suite red.
 */
function movementTypeKeyOf(event: ReceivingEvent): DictionaryKey | null {
  const movementType: OfferMovementType | null | undefined = event.movementType;
  return movementType == null ? null : offerMovementKey(movementType);
}

/**
 * Every receiving event of both teams, ordered by minute then home before away.
 *
 * The pre-sort by side is what gives the tiebreak: both sorts are stable, so
 * ordering by side first and by minute second leaves minute major, side minor,
 * artifact order last — the shipped `defensiveRows` / `shotLogRows` shape. And
 * `orderByMinute` is IMPORTED rather than re-implemented, so this table's
 * default order can never disagree with the one every other log states.
 *
 * `null` and `[]` both return `[]` (ruling 10): the schema states verbatim that
 * "Empty array and null are distinct states", so `[]` reaches this module as
 * "ready with zero rows" and every entry point must survive it.
 *
 * Partitioning through `resolveSide` rather than a per-team filter is
 * deliberate: a stray `teamId` NAMES ITSELF instead of vanishing from the log.
 * Note the schema `$comment` on this type — `teamId` is the RECEIVING player's
 * team.
 *
 * The key indexes the ARTIFACT array — data, not layout — and is what
 * `DataTable` uses as both the React key and the focus-restore identity.
 */
export function receivingLogRows(
  events: readonly ReceivingEvent[] | null,
  home: LogSide,
  away: LogSide
): ReceivingLogRow[] {
  if (events === null || events.length === 0) {
    return [];
  }
  const decorated = events.map((event, index) => {
    assertPlottable(event, index, "receiving-log-model");
    return {
      event,
      index,
      side: resolveSide(event.teamId, home, away, "receiving-log-model"),
    };
  });
  const bySide = [...decorated].sort(
    (a, b) => sideRank(a.event.teamId, home) - sideRank(b.event.teamId, home)
  );
  return orderByMinute(bySide.map((entry) => ({ ...entry, at: entry.event.at }))).map(
    ({ event, index, side }) => ({
      key: `receiving-row-${index}`,
      teamCode: side.teamCode,
      playerName: playerNameOf(event),
      minuteLabel: event.at == null ? null : formatGoalMinute(event.at),
      // `?? null`, never `?? 0` — 2.11a decision 3. A fabricated 0 would claim
      // minute 0 for a clock-less row while `orderByMinute` sorted it last.
      minute: event.at?.minute ?? null,
      stoppageMinute: event.at?.stoppageMinute ?? null,
      x: event.x,
      y: event.y,
      eventTypeKey: receivingEventTypeKey(event.type),
      movementTypeKey: movementTypeKeyOf(event),
    })
  );
}

/**
 * Does this bundle carry a receiving event table at all? FD-1 applied to the
 * whole log: it renders on fixtures (270 events) and SELF-REMOVES on corpus
 * data, where `events.receiving` is null.
 */
export function anyReceivingEvents(events: readonly ReceivingEvent[] | null): boolean {
  return events !== null && events.length > 0;
}

/** Does the log need a movement-type column? `movementType` is contract-nullable. */
export function anyMovementType(
  rows: readonly { movementTypeKey: DictionaryKey | null }[]
): boolean {
  return rows.some((row) => row.movementTypeKey !== null);
}

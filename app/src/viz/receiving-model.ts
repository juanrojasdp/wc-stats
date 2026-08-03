import type {
  OfferMovementCounts,
  OfferMovementType,
  PlayerRecord,
} from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
import { resolveLeader, type TileLeader } from "@/lib/match-hero";
import { resolveSide, type LogSide } from "@/viz/marker-model";

/*
 * The two RECEIVING surfaces (#offers-to-receive, #movement-to-receive), built
 * from Domain G — NOT from `events.receiving` (Story 2.9 ruled decision 2).
 *
 * WHY THIS MODULE READS `bundle.players` AND NOT AN EVENT TABLE. Story 1.13
 * measured `ReceivingEvent` unfulfillable in EVERY ONE of its eight required
 * fields over 104 reports / 416 pages, so `events.receiving` can only ever be
 * null: there is no receiving marker to draw and none may be fabricated. What
 * IS real is `players[].inPossession` — `totalOffers`, `offersReceived` and the
 * six-value `offersByMovementType` split, all three `required` in the contract,
 * extracted by Story 1.10, and unlike the event table they survive the 2.19
 * real-data cutover.
 *
 * TWO HARD BANS, both from the ledger and neither negotiable: these are
 * WHOLE-MATCH PER-PLAYER AGGREGATES with no clock, no coordinates and no
 * per-event identity. They are never rendered as events, and never placed on a
 * pitch — DESIGN.md:355 names "snap-to-zone" as a prohibited transformation and
 * AD-8 forbids inventing per-event structure the source lacks.
 *
 * Pure and locale-free like every module under src/viz: dictionary KEYS and raw
 * numbers out, components resolve them. A `t()` call here is also an ESLint
 * error (the client-import seam).
 */

/**
 * The six OfferMovementType codes in the SCHEMA'S DECLARATION ORDER — the
 * frozen order the proportion bar's segments, its value list and the movement
 * table's columns all follow (ruled decisions 15 and 16).
 *
 * `no-movement` is INCLUDED. The ledger's note that "the movement map prints
 * exactly FIVE types" constrains the movement PAGE's grid, not Domain G, which
 * is the one source carrying the sixth value — and it is 24.9% of all corpus
 * offers. Rendering five would hide a quarter of the data.
 *
 * DERIVED FROM A RECORD KEYED BY THE GENERATED UNION, so a contract enum change
 * is a compile error here rather than a silently missing segment.
 *
 * REVIEW PATCH: this was a bare `readonly OfferMovementType[]` literal, which
 * does NOT deliver that guarantee — an array stays assignable however many
 * members the union gains, and the i18n exhaustiveness suite compares locale
 * keys against this very array, so a widened enum would have slipped past both.
 * `Object.keys` preserves insertion order for non-numeric string keys, so the
 * schema's declaration order is intact.
 */
const OFFER_MOVEMENT_ORDER: Record<OfferMovementType, true> = {
  "in-front": true,
  "in-between": true,
  "out-to-in": true,
  "in-to-out": true,
  "in-behind": true,
  "no-movement": true,
};

export const OFFER_MOVEMENT_TYPES: readonly OfferMovementType[] = Object.keys(
  OFFER_MOVEMENT_ORDER
) as OfferMovementType[];

/**
 * Kebab enum code -> camelCase counts property. Mandatory rather than
 * cosmetic: `OfferMovementCounts`'s properties are camelCase while
 * `OfferMovementType`'s codes are kebab, and AD-7 keys locale labels by ENUM
 * CODE. A `Record` over the generated union on both sides, so either half
 * changing is a compile error.
 */
export const OFFER_MOVEMENT_PROPERTY: Record<OfferMovementType, keyof OfferMovementCounts> = {
  "in-front": "inFront",
  "in-between": "inBetween",
  "out-to-in": "outToIn",
  "in-to-out": "inToOut",
  "in-behind": "inBehind",
  "no-movement": "noMovement",
};

/** Dictionary key for a movement label — `enums.offerMovement.<code>` (AD-7). */
export function offerMovementKey(code: OfferMovementType): DictionaryKey {
  return `enums.offerMovement.${code}` as DictionaryKey;
}

/** Percent points (formatPercent's contract: 62 → "62%"), or null. */
function sharePct(part: number, whole: number): number | null {
  // NEVER NaN and never a bare 0: "no offers were made" and "none of the
  // offers were received" are different facts, and 81 of 3,289 corpus player
  // rows sit in the first state (0 of 96 fixture rows do — hence the
  // constructed test input Task 2.8 requires).
  return whole === 0 ? null : (part / whole) * 100;
}

/**
 * Leader between two possibly-undefined shares.
 *
 * `resolveLeader` is the ruled UX-DR7 determination and is imported, never
 * re-implemented — but it takes two numbers, and coercing a null share to 0
 * would claim a team "leads" against a value that does not exist. `"tie"` is
 * this codebase's no-leader state (no accent, no glyph, no spoken word), which
 * is exactly right here.
 */
function resolveShareLeader(home: number | null, away: number | null): TileLeader {
  if (home === null || away === null) {
    return "tie";
  }
  return resolveLeader(home, away);
}

/** One team's offers headline — the values the tiles print. */
export interface OffersTeamSummary {
  teamId: string;
  teamCode: string;
  offersMade: number;
  offersReceived: number;
  /** Percent points, or null when `offersMade === 0`. */
  receivedPct: number | null;
  playerCount: number;
}

export interface OffersSummary {
  home: OffersTeamSummary;
  away: OffersTeamSummary;
  /** UX-DR7 head-to-head leaders, one per displayed pair (ruled decision 23). */
  leaders: { made: TileLeader; received: TileLeader; receivedPct: TileLeader };
}

/**
 * Partition the player rows across the two sides, failing loud on a stray
 * teamId.
 *
 * `resolveSide` is the one place that decision lives, exactly as both log
 * tables use it: a silent drop would under-count a team total that this
 * module then prints as the team's own headline. Callers run this EAGERLY on
 * load (never inside a lazily-mounted disclosure), so a bad id names itself
 * immediately — TacticalErrorBoundary contains the blast radius.
 *
 * `null` and `[]` both yield two empty buckets rather than throwing: `players`
 * is `PlayerRecords | null` and `sectionDataState` gates on `!== null` only, so
 * `[]` reaches this module as "ready" and every entry point must survive it
 * (ruled decision 10 — there is exactly ONE error boundary for all eleven
 * Tactical sections).
 */
function partition(
  players: readonly PlayerRecord[] | null,
  home: LogSide,
  away: LogSide
): { home: PlayerRecord[]; away: PlayerRecord[] } {
  const buckets: { home: PlayerRecord[]; away: PlayerRecord[] } = { home: [], away: [] };
  if (players === null || players.length === 0) {
    return buckets;
  }
  for (const player of players) {
    const side = resolveSide(player.teamId, home, away, "receiving-model");
    if (side.teamId === home.teamId) {
      buckets.home.push(player);
    } else {
      buckets.away.push(player);
    }
  }
  return buckets;
}

/** Team rows in the tables' default order: shirt number ascending. */
function byShirt(players: readonly PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((a, b) => a.shirtNumber - b.shirtNumber);
}

function summariseTeam(players: readonly PlayerRecord[], side: LogSide): OffersTeamSummary {
  let offersMade = 0;
  let offersReceived = 0;
  for (const player of players) {
    offersMade += player.inPossession.totalOffers;
    offersReceived += player.inPossession.offersReceived;
  }
  return {
    teamId: side.teamId,
    teamCode: side.teamCode,
    offersMade,
    offersReceived,
    receivedPct: sharePct(offersReceived, offersMade),
    playerCount: players.length,
  };
}

/**
 * The two teams' offers headline.
 *
 * AD-5 SINGLE-SURFACE CARVE-OUT, invoked deliberately and with all three of its
 * conditions holding: the roll-up is WITHIN-MATCH from ONE bundle; it appears
 * on exactly one surface (see the declared reading below); and it is never
 * Hero-critical — the Hero is build-time from `storyStats` (AD-11). A fourth
 * constraint is self-imposed rather than AD-5 text: it derives over this
 * bundle's own values without rewriting any of them (AD-6 bans
 * re-normalisation).
 *
 * DECLARED READING of "exactly one surface" (ruled decision 13, stated here so
 * a reviewer can disagree with it rather than discover it): the roll-up is
 * computed ONCE, in this function, and consumed by two sections of ONE page.
 * "Exactly one surface" is read as one rendered surface — the match dashboard —
 * not one section. It must not be repeated in the Hero, in profiles, in
 * comparison, or in any artifact.
 *
 * The evidence that makes this more than a legal reading: measured over all 104
 * staged records, the per-team roll-up reproduces the receiving page's OWN
 * PRINTED HEADLINE exactly — offers made min 69 / median 333 / max 634 and
 * received 20 / 119.5 / 247, identical to
 * `domains.receiving.offers.*.total_offers_made` / `.total_offers_received`,
 * which Story 1.13 proved reconciles on 208/208 team-innings.
 *
 * BINDING FORWARD: if Story 1.16 ever emits a team-level offers block, the App
 * switches to reading it verbatim and THIS DERIVATION IS DELETED.
 */
export function offersSummary(
  players: readonly PlayerRecord[] | null,
  home: LogSide,
  away: LogSide
): OffersSummary {
  const buckets = partition(players, home, away);
  const homeSummary = summariseTeam(buckets.home, home);
  const awaySummary = summariseTeam(buckets.away, away);
  return {
    home: homeSummary,
    away: awaySummary,
    leaders: {
      made: resolveLeader(homeSummary.offersMade, awaySummary.offersMade),
      received: resolveLeader(homeSummary.offersReceived, awaySummary.offersReceived),
      receivedPct: resolveShareLeader(homeSummary.receivedPct, awaySummary.receivedPct),
    },
  };
}

/** One player's row in the offers table. */
export interface OffersRow {
  key: string;
  playerId: string;
  playerName: string;
  shirtNumber: number;
  teamCode: string;
  offersMade: number;
  offersReceived: number;
  /** Percent points, or null when this player made no offers. */
  receivedPct: number | null;
}

/**
 * Every player's offers, HOME TEAM FIRST then by shirt number.
 *
 * That order is stated in the table's own caption key — `viz.table.caption` is
 * literally "Ordenado por minuto." and would be a false claim on rows that
 * carry no clock at all.
 */
export function offersRows(
  players: readonly PlayerRecord[] | null,
  home: LogSide,
  away: LogSide
): OffersRow[] {
  const buckets = partition(players, home, away);
  return [
    ...byShirt(buckets.home).map((player) => offersRow(player, home.teamCode)),
    ...byShirt(buckets.away).map((player) => offersRow(player, away.teamCode)),
  ];
}

function offersRow(player: PlayerRecord, teamCode: string): OffersRow {
  const { totalOffers, offersReceived } = player.inPossession;
  return {
    key: `offers-${player.playerId}`,
    playerId: player.playerId,
    playerName: player.playerName,
    shirtNumber: player.shirtNumber,
    teamCode,
    offersMade: totalOffers,
    offersReceived,
    receivedPct: sharePct(offersReceived, totalOffers),
  };
}

/** One segment of the proportion bar, and one entry of its value list. */
export interface MovementCategory {
  code: OfferMovementType;
  count: number;
  /** Percent points of the team's own total; 0 for every category when total is 0. */
  share: number;
}

export interface MovementTeamSplit {
  teamId: string;
  teamCode: string;
  total: number;
  /** The team made no offers at all — the component renders its zero line, not a bar. */
  isZero: boolean;
  /**
   * The six categories do NOT sum to `sum(totalOffers)` for this team.
   *
   * Decision 14's declared fallback, implemented rather than assumed: when this
   * is true the component renders the labelled value list WITHOUT the bar,
   * because a proportion is only legitimate over a genuine partition. Measured
   * 0 mismatches on 3,289/3,289 corpus player rows and 96/96 fixture rows, so
   * this branch is unreachable from any shipped input — which is exactly why it
   * needs a constructed test rather than a fixture one.
   */
  partitionMismatch: boolean;
  /** Always six entries, in OFFER_MOVEMENT_TYPES order. */
  categories: MovementCategory[];
}

export interface MovementSplit {
  home: MovementTeamSplit;
  away: MovementTeamSplit;
}

function splitTeam(players: readonly PlayerRecord[], side: LogSide): MovementTeamSplit {
  const counts = new Map<OfferMovementType, number>(
    OFFER_MOVEMENT_TYPES.map((code) => [code, 0])
  );
  let total = 0;
  let declaredTotal = 0;
  for (const player of players) {
    const movement = player.inPossession.offersByMovementType;
    for (const code of OFFER_MOVEMENT_TYPES) {
      const value = movement[OFFER_MOVEMENT_PROPERTY[code]];
      counts.set(code, (counts.get(code) ?? 0) + value);
      total += value;
    }
    declaredTotal += player.inPossession.totalOffers;
  }
  /*
   * `total` is the SUM OF THE SIX CATEGORIES, so the rendered shares always sum
   * to 100%. `declaredTotal` is the independent `sum(totalOffers)` — the same
   * quantity `offersSummary` prints one section above on the same page.
   *
   * REVIEW PATCH — THE ORIGINAL REASONING HERE WAS BACKWARDS and is replaced.
   * It argued that taking `total` from the six was safer because "a bar whose
   * segments do not fill it is the visible failure; a silently mis-scaled bar
   * is not". But taking it from the six is precisely what GUARANTEES the bar
   * always fills, so a broken partition would have been the silent option, not
   * the visible one — and the two sections would have printed two different
   * totals for "ofrecimientos" side by side with nothing flagging it.
   *
   * Decision 14's declared fallback is now real: the two derivations are
   * compared, and `partitionMismatch` makes the component drop the bar and keep
   * the labelled value list — six paired absolute values, never a normalized
   * bar over a non-partition. Measured 0 mismatches on 3,289/3,289 corpus rows
   * and 96/96 fixture rows; the branch exists for the day that stops holding.
   */
  return {
    teamId: side.teamId,
    teamCode: side.teamCode,
    total,
    isZero: total === 0 && declaredTotal === 0,
    partitionMismatch: total !== declaredTotal,
    categories: OFFER_MOVEMENT_TYPES.map((code) => {
      const count = counts.get(code) ?? 0;
      return { code, count, share: total === 0 ? 0 : (count / total) * 100 };
    }),
  };
}

/**
 * The six-way movement split per team, as a PROPORTION.
 *
 * A proportion is legitimate here for one measured reason and no other: the six
 * values are a genuine PARTITION of `totalOffers` — `sum(offersByMovementType)
 * === totalOffers` on 3,289/3,289 corpus player rows. This is deliberately
 * unlike two ledgered traps: Story 1.13's `by_phase` totals are INDEPENDENT
 * rates rather than slices (−48..+314), and Domain C's phases carry a "never
 * normalize, never pie" $comment.
 *
 * If the partition ever fails, `partitionMismatch` goes true on that team and
 * the surface falls back to six paired absolute values with no normalized bar.
 * That fallback is IMPLEMENTED, not merely declared (see `splitTeam`).
 */
export function movementSplit(
  players: readonly PlayerRecord[] | null,
  home: LogSide,
  away: LogSide
): MovementSplit {
  const buckets = partition(players, home, away);
  return {
    home: splitTeam(buckets.home, home),
    away: splitTeam(buckets.away, away),
  };
}

/** One player's row in the movement table — six columns plus their total. */
export interface MovementRow {
  key: string;
  playerId: string;
  playerName: string;
  shirtNumber: number;
  teamCode: string;
  counts: Record<OfferMovementType, number>;
  total: number;
}

/** Every player's six-way split, in the same order `offersRows` uses. */
export function movementRows(
  players: readonly PlayerRecord[] | null,
  home: LogSide,
  away: LogSide
): MovementRow[] {
  const buckets = partition(players, home, away);
  return [
    ...byShirt(buckets.home).map((player) => movementRow(player, home.teamCode)),
    ...byShirt(buckets.away).map((player) => movementRow(player, away.teamCode)),
  ];
}

function movementRow(player: PlayerRecord, teamCode: string): MovementRow {
  const movement = player.inPossession.offersByMovementType;
  const counts = {} as Record<OfferMovementType, number>;
  let total = 0;
  for (const code of OFFER_MOVEMENT_TYPES) {
    const value = movement[OFFER_MOVEMENT_PROPERTY[code]];
    counts[code] = value;
    total += value;
  }
  return {
    key: `movement-${player.playerId}`,
    playerId: player.playerId,
    playerName: player.playerName,
    shirtNumber: player.shirtNumber,
    teamCode,
    counts,
    total,
  };
}

/*
 * TEAM-TOTALS ROWS (ruled decision 11). UX-DR16 and ARCHITECTURE-SPINE.md:140
 * require "a reachable data table rendering the same artifact slice". A
 * per-player table alone does NOT satisfy that for a team-level tile or bar — a
 * reader would have to sum 16 rows to recover the printed number. Each
 * disclosure therefore carries BOTH: these totals, carrying exactly the values
 * the tiles and the bar display, and the per-player breakdown.
 */

export interface OffersTotalsRow {
  key: string;
  teamCode: string;
  offersMade: number;
  offersReceived: number;
  receivedPct: number | null;
  playerCount: number;
}

export function offersTotalsRows(summary: OffersSummary): OffersTotalsRow[] {
  return [summary.home, summary.away].map((team) => ({
    key: `offers-total-${team.teamId}`,
    teamCode: team.teamCode,
    offersMade: team.offersMade,
    offersReceived: team.offersReceived,
    receivedPct: team.receivedPct,
    playerCount: team.playerCount,
  }));
}

export interface MovementTotalsRow {
  key: string;
  teamCode: string;
  counts: Record<OfferMovementType, number>;
  total: number;
}

export function movementTotalsRows(split: MovementSplit): MovementTotalsRow[] {
  return [split.home, split.away].map((team) => {
    const counts = {} as Record<OfferMovementType, number>;
    for (const category of team.categories) {
      counts[category.code] = category.count;
    }
    return { key: `movement-total-${team.teamId}`, teamCode: team.teamCode, counts, total: team.total };
  });
}

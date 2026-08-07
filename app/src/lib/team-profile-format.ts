import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/*
 * `/teams/{slug}`'s number, unit and label composition (Story 2.16, AD-7).
 *
 * IT LIVES IN src/lib/ AND NOT IN src/viz/ for the reason `player-profile-format.ts`,
 * `leaderboard-format.ts` and `table-sort.ts` do: it imports `@/lib/format`,
 * which `src/viz/**` keeps out by design discipline so the pure models stay
 * locale-free.
 *
 * IT IS NOT IN ANY COMPONENT, which is 2.11c's precedent rather than a
 * preference: pulling shared logic through a `"use client"` module makes the
 * suite import React (and transitively radix) under `environment: "node"` —
 * green today, opaque the day anything in that chain touches `window` at module
 * scope.
 *
 * NOTHING HERE RESOLVES COPY. Every function takes already-resolved strings; the
 * SECTION owns `t()`.
 *
 * `@/lib/format` THROWS on non-finite input by design. That is why
 * `team-profile-model.ts` guards every leaf at model entry and builds every row
 * set EAGERLY: a bad value must fail on LOAD, inside `TacticalErrorBoundary`,
 * rather than when a reader opens "Ver los datos" (Story 2.9's review finding).
 */

/** Composition glyphs are module consts — several call sites are gated props. */
const CLAUSE_SEPARATOR = ", ";
const SPACE = " ";

/* -------------------------------- The numbers ------------------------------ */

/*
 * TWO PRECISIONS FOR ONE FAMILY, matching the shipped tactical sections exactly
 * (`PhasesSection.tsx:148` and `:218`, `PressingSection.tsx:125` and `:220`):
 * AXIS TICKS AT 0 dp so a five-tick axis does not read as a wall of decimals,
 * TABLE VALUES AT 1 dp because that is the artifact's own precision and
 * rounding a precomputed value breaches AR-5.
 */

/** A rate on a chart AXIS — whole percentage points. */
export function formatRateTick(value: number, locale: Locale): string {
  return formatPercent(value, locale, 0);
}

/** A rate in a TABLE or a tile — 1 dp, the artifact's own precision. */
export function formatRateValue(value: number, locale: Locale): string {
  return formatPercent(value, locale, 1);
}

/**
 * A `shapeByPhase` distance — METRES at 1 dp.
 *
 * The unit rides the COLUMN HEAD, never the cell (2.13/2.11b's rule, which
 * applies cleanly here because these tables are NOT transposed: one measure per
 * column, three columns).
 */
export function formatMetres(value: number, locale: Locale): string {
  return formatDecimal(value, locale, 1);
}

/**
 * `matches[].distanceCovered` — KILOMETRES at 2 dp (D12).
 *
 * THE TEAM-SCOPE FIELD, AND IT MUST NEVER CROSS THE PLAYER-SCOPE ONE.
 * `distanceCovered` is kilometres on a team row; `totalDistance` is METRES on a
 * player row. Story 1.10 rules the boundary: "convert explicitly and once". A
 * team match reads ~107 km; a player match reads ~10,000 m.
 */
export function formatKilometres(value: number, locale: Locale): string {
  return formatDecimal(value, locale, 2);
}

/**
 * `matches[].expectedGoals` — a DIMENSIONLESS xG value at 2 dp.
 *
 * IT HAS ITS OWN FUNCTION BECAUSE IT IS NOT A DISTANCE (code review
 * 2026-08-07). The xG column rendered through `formatKilometres`, which is
 * numerically identical today — both want 2 dp — and wrong in the one way this
 * module exists to prevent: the docblock directly above declares kilometres
 * "THE TEAM-SCOPE FIELD, AND IT MUST NEVER CROSS THE PLAYER-SCOPE ONE", and its
 * call site was crossing it into a quantity that is not measured in anything.
 * The coupling was silent and would have bitten the day either precision moved:
 * a unit suffix on kilometres, or FIFA's xG precision changing, would have
 * dragged the other column with it.
 *
 * 2 dp is the artifact's own precision; rounding a precomputed value breaches
 * AR-5. xG is FIFA's published value, used as-is and never recomputed.
 */
export function formatExpectedGoals(value: number, locale: Locale): string {
  return formatDecimal(value, locale, 2);
}

/** Counts — goals, shots, matches, points. 0 dp with locale grouping. */
export function formatTeamCount(value: number, locale: Locale): string {
  return formatInteger(value, locale);
}

/**
 * `record.goalDifference`, which SHIPS SIGNED and is never recomputed.
 *
 * D12: "Do not compute `goalsFor - goalsAgainst`." The contract emits the field
 * and `Intl` renders a negative with the locale's own minus sign; no `+` is
 * prepended, because DESIGN.md specifies no such treatment and inventing one
 * would make this the only signed figure on the site that carries a plus.
 */
export function formatGoalDifference(value: number, locale: Locale): string {
  return formatInteger(value, locale);
}

/**
 * `pressingIntensity` — a COUNT-VALUED MEAN at 1 dp, and NEVER A PERCENTAGE
 * (D12).
 *
 * The contract calls it "Mean defensive pressures applied per match" with
 * `x-decimals: 1`. Mexico is 213.0. A `%` here would be a category error, and
 * `possession` sitting in the adjacent tile — which IS a percentage — is exactly
 * how that mistake would go unnoticed.
 */
export function formatPressingIntensity(value: number, locale: Locale): string {
  return formatDecimal(value, locale, 1);
}

/* -------------------------------- The labels ------------------------------- */

/**
 * `"Grupo A"` — the group word plus the UPPERCASED contract letter.
 *
 * The letter is DATA (the enum is lowercase `"a"`..`"l"`) and the uppercase
 * transform belongs in the presentation layer — `TournamentHub.tsx:572`'s
 * shipped ruling, and `MatchHero`'s treatment of `teamCode` before it. The word
 * reuses `match.hero.group`: one term, one key.
 */
export function composeGroupLabel(groupWord: string, group: string): string {
  return `${groupWord}${SPACE}${group.toUpperCase()}`;
}

/**
 * The W-D-L triple as ONE string — `"4-0-1"`.
 *
 * A SINGLE TILE VALUE rather than three, because `ProfileStatTiles` takes one
 * pre-formatted `value` per tile and a record read as three separate tiles loses
 * the ordering that makes it a record.
 *
 * SELECTED, NEVER DERIVED. `record.won`, `.drawn` and `.lost` are contracted
 * fields; nothing here counts `matches[]` to reach them.
 */
export function composeRecordTriple(input: {
  won: string;
  drawn: string;
  lost: string;
  separator: string;
}): string {
  const { won, drawn, lost, separator } = input;
  return `${won}${separator}${drawn}${separator}${lost}`;
}

/** `"10-3"` — goals for and against, on the same terms as the record triple. */
export function composeGoalPair(input: {
  goalsFor: string;
  goalsAgainst: string;
  separator: string;
}): string {
  const { goalsFor, goalsAgainst, separator } = input;
  return `${goalsFor}${separator}${goalsAgainst}`;
}

/**
 * A rate figure's one-sentence `aria-label` (NFR-2 / UX-DR16).
 *
 * Composed from already-resolved fragments: t() has no interpolation, and
 * `aria-label` is one of the sixteen gated prop names, so every piece arrives as
 * an identifier.
 *
 * IT NAMES THE FIGURE RATHER THAN RECITING IT. A screen-reader user's route to
 * the numbers is the `ViewDataDisclosure` data-table alternative directly
 * beneath, which carries every category; a summary that read nine figures aloud
 * would duplicate that badly and still not be sortable.
 *
 * The chart component supplies `role="img"` and takes this as its accessible
 * name — so the call site adds NO second `role` and NO second `aria-label`.
 */
export function composeRateFigureSummary(input: {
  headline: string;
  entityName: string;
  note: string;
}): string {
  const { headline, entityName, note } = input;
  return `${headline}${CLAUSE_SEPARATOR}${entityName}${CLAUSE_SEPARATOR}${note}`;
}

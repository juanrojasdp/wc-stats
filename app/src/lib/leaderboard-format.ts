import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import type { DictionaryKey, Locale } from "@/lib/i18n";
import type { LeaderboardFormat, LeaderboardUnit } from "@/viz/leaderboard-model";

/*
 * The leaderboards' number and unit resolution (Story 2.13, AD-7).
 *
 * IT LIVES IN src/lib/ AND NOT IN src/viz/ for the reason `table-sort.ts` does:
 * it imports `@/lib/format`, which src/viz/** keeps out by design discipline so
 * the pure models stay locale-free.
 *
 * IT IS NOT IN EITHER COMPONENT, and that is the 2.11c precedent rather than a
 * preference. That story's review moved `LOG_LINKS` out of a "use client"
 * module for exactly this reason: pulling shared logic through a component
 * makes the test suite import React (and, transitively, radix) under
 * `environment: "node"` — green today, opaque the day anything in that chain
 * touches `window` at module scope. Both components import from here instead,
 * and this file imports neither of them.
 */

/** Non-breaking space: a value must never wrap away from its unit. */
export const NBSP = " ";

/**
 * One leaderboard value, formatted for display. NEVER carries its unit — the
 * caller composes that, because the unit's POSITION differs by altitude
 * (ruling 6): value-side in a teaser row, head-side in a table column.
 *
 * The fraction-digit count is always EXPLICIT. Precision is metric-dependent
 * and every fixture value is serialized at 1 dp (`315.0`, `34.0`), which
 * `JSON.parse` collapses to an integer — so nothing may rely on a trailing
 * `.0`, and `x-decimals: 2` on the contract is the widest any board uses, not
 * this board's.
 */
export function formatLeaderboardValue(
  value: number,
  format: LeaderboardFormat,
  locale: Locale
): string {
  if (format === "percent") {
    /*
     * `formatPercent` appends "%" ITSELF with no space before it — a
     * deliberate, logged product choice against RAE spacing (UX-DR19). Do not
     * add one, and do not give a percent metric a unit key as well.
     */
    return formatPercent(value, locale, 1);
  }
  if (format === "integer") {
    return formatInteger(value, locale);
  }
  if (format === "decimal1") {
    return formatDecimal(value, locale, 1);
  }
  if (format === "decimal2") {
    return formatDecimal(value, locale, 2);
  }
  /*
   * A fifth LeaderboardFormat member would otherwise fall through and render
   * with some arbitrary precision that nothing on screen would flag —
   * `ExpertLayer`'s `never` discipline, which its own review added after
   * exactly that fallthrough shipped.
   */
  const unexpected: never = format;
  throw new Error(`Unhandled LeaderboardFormat: ${String(unexpected)}`);
}

/**
 * How a PER-MATCH rate is printed.
 *
 * A rate is fractional even when its metric is a whole count — four goals over
 * three matches is 1,3 and rounding that to "1" would misstate the artifact's
 * own number. Percent metrics keep their percent form, since an average of
 * percentages is still a percentage.
 */
export function perMatchFormat(format: LeaderboardFormat): LeaderboardFormat {
  return format === "percent" ? "percent" : "decimal1";
}

/**
 * The `enums.unit.*` key for a board's unit, or null when it takes none.
 *
 * `enums.unit` has exactly three members — km, m, kmh. A count carries no unit
 * at all, and a percent carries its sign inside the formatted value, so both
 * return null and the caller composes nothing.
 */
export function leaderboardUnitKey(unit: LeaderboardUnit): DictionaryKey | null {
  if (unit === "km") {
    return "enums.unit.km";
  }
  if (unit === "m") {
    return "enums.unit.m";
  }
  if (unit === "kmh") {
    return "enums.unit.kmh";
  }
  if (unit === "count" || unit === "percent") {
    return null;
  }
  const unexpected: never = unit;
  throw new Error(`Unhandled LeaderboardUnit: ${String(unexpected)}`);
}

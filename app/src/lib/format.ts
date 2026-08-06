import type { Locale } from "@/lib/i18n";

/*
 * The ONLY formatting path (AD-7, UX-DR19). Artifacts carry raw numerics,
 * ISO 8601 strings and enum codes; everything user-visible goes through the
 * `Intl` helpers below with `es-CO` / `en`. No other module may format.
 */

const NUMBER_LOCALE: Record<Locale, string> = { es: "es-CO", en: "en" };

const decimalFormatters = new Map<string, Intl.NumberFormat>();

function decimalFormatter(locale: Locale, fractionDigits: number): Intl.NumberFormat {
  const cacheKey = `${locale}:${fractionDigits}`;
  let formatter = decimalFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    decimalFormatters.set(cacheKey, formatter);
  }
  return formatter;
}

/*
 * Nullable artifact fields (e.g. per-shot xG) must be handled by the caller
 * BEFORE formatting — a null reaching Intl would coerce to 0 and NaN/Infinity
 * would render literally, all silent wrong output where the contract demands
 * an explicit empty state.
 */
function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`format: non-finite value ${value} — handle null/absent fields before formatting`);
  }
}

/** Fixed-precision decimal — es-CO comma decimals: xG 1.24 → "1,24". */
export function formatDecimal(value: number, locale: Locale, fractionDigits = 2): string {
  assertFinite(value);
  return decimalFormatter(locale, fractionDigits).format(value);
}

/** Integer with locale grouping. */
export function formatInteger(value: number, locale: Locale): string {
  assertFinite(value);
  return decimalFormatter(locale, 0).format(value);
}

/**
 * Percent from percent points (62 → "62%"). NO space before "%" in Spanish —
 * a deliberate, logged product choice against RAE spacing (UX-DR19), which is
 * why the sign is joined here instead of using Intl's percent style.
 */
export function formatPercent(value: number, locale: Locale, fractionDigits = 0): string {
  return `${formatDecimal(value, locale, fractionDigits)}%`;
}

// Lookahead anchor: the date must be the whole string or be followed by a
// time part — "2026-07-219" must not pass as "2026-07-21".
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?=T|$)/;

/*
 * Date.UTC silently rolls out-of-range components over (month 13 → January
 * next year), which would render a plausible but WRONG date. Reject instead:
 * a malformed artifact must fail loudly, never display.
 */
function utcDateFrom(year: string, month: string, day: string, source: string): Date {
  const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (utcDate.getUTCMonth() !== Number(month) - 1 || utcDate.getUTCDate() !== Number(day)) {
    throw new Error(`format: "${source}" is not a real calendar date`);
  }
  return utcDate;
}

/**
 * Full date from an ISO 8601 string — es: "21 de julio de 2026" (lowercase
 * month), en: "July 21, 2026". Only the date part is read; formatting happens
 * in UTC so no host-timezone shift can move the day.
 */
export function formatDate(iso: string, locale: Locale): string {
  const match = DATE_ONLY.exec(iso);
  if (!match) {
    throw new Error(`format: "${iso}" is not an ISO 8601 date`);
  }
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(NUMBER_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcDateFrom(year, month, day, iso));
}

// A numeric offset is REQUIRED. `Z` is deliberately rejected: the contract
// defines kickoff as venue-local time with the venue's UTC offset, and no
// 2026 venue is at UTC — a `Z` timestamp can only be a pipeline bug emitting
// UTC, which must fail loudly instead of rendering a wrong "local" time.
const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:\d{2})$/;

/**
 * Kickoff time in VENUE-LOCAL wall-clock time (UX-DR19). The artifact's ISO
 * 8601 string already carries the venue's local time plus its UTC offset, so
 * the wall-clock components are read as written (never converted to the
 * viewer's timezone) and formatted via Intl in UTC to keep them fixed.
 */
export function formatKickoff(isoWithOffset: string, locale: Locale): string {
  const match = ISO_WITH_OFFSET.exec(isoWithOffset);
  if (!match) {
    throw new Error(`format: "${isoWithOffset}" is not an ISO 8601 datetime with a UTC offset`);
  }
  const [, year, month, day, hour, minute] = match;
  utcDateFrom(year, month, day, isoWithOffset);
  if (Number(hour) > 23 || Number(minute) > 59) {
    throw new Error(`format: "${isoWithOffset}" has an out-of-range time`);
  }
  const wallClock = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  );
  return new Intl.DateTimeFormat(NUMBER_LOCALE[locale], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(wallClock);
}

const collators: Record<Locale, Intl.Collator> = {
  // Base sensitivity: accents and case never split a match ("Á" sorts with "a").
  es: new Intl.Collator("es", { sensitivity: "base" }),
  en: new Intl.Collator("en", { sensitivity: "base" }),
};

/** The ONLY text comparison for sorting — never default string compare. */
export function compareText(a: string, b: string, locale: Locale = "es"): number {
  return collators[locale].compare(a, b);
}

/** Accent- and case-insensitive equality for text matching. */
export function textEquals(a: string, b: string, locale: Locale = "es"): boolean {
  return collators[locale].compare(a, b) === 0;
}

/**
 * Accent- and case-insensitive SUBSTRING match — the filter counterpart to
 * `textEquals` (Story 2.13, FR-26's client-side filtering).
 *
 * NOT built on `Intl.Collator`, and it cannot be: the collators above give
 * whole-string equality, and `Intl` has no substring operation of any kind. So
 * this normalizes rather than collates — NFD-decompose, strip the combining
 * diacritics, lowercase, then `String.includes`.
 *
 * It lives HERE rather than beside its one caller because this module's header
 * declares itself the only text-comparison path; a second normalization home is
 * precisely the drift that declaration exists to prevent. Locale-independent by
 * construction, so it takes no `Locale` — Unicode decomposition is the same in
 * both dictionaries, and a per-locale needle would silently change what a
 * reader's keystrokes match when they toggle language mid-filter.
 */
export function includesText(haystack: string, needle: string): boolean {
  return foldForSearch(haystack).includes(foldForSearch(needle));
}

/*
 * The `u` flag is required for \p{...}; without it this is a literal-brace
 * pattern that silently matches nothing and folds no accents at all.
 *
 * NAMED FOR WHAT IT ACTUALLY MATCHES (Story 2.13 code review). `\p{Diacritic}`
 * is NOT the combining-mark class: it also covers SPACING characters that are
 * not marks — `^` U+005E, backtick U+0060, `¨`, `¯`, `´` — which are therefore
 * stripped from names as well as from the needle. The earlier name asserted a
 * property the pattern does not have.
 *
 * KNOWN GAP, deliberately not closed here: NFD only decomposes what HAS a
 * decomposition, so non-decomposing letters — `ø`, `ł`, `đ`, `ı` — fold to
 * themselves and a reader typing "o" will not match "Ø". No name in either
 * shipped artifact is affected. Closing it needs a transliteration table, which
 * is a bigger decision than a filter helper should take on its own.
 */
const DIACRITICS = /\p{Diacritic}/gu;

function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

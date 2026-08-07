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

/**
 * COMPACT NUMERIC date from an ISO 8601 string — es-CO: "11/6", en: "06/11".
 *
 * ADDED BY STORY 2.15 for a chart AXIS, which is the one place `formatDate`'s
 * full form cannot go. A trend chart plots up to 8 matches on a categorical x
 * axis, and recharts renders an axis tick as ONE `<text>` with NO WRAPPING and
 * no truncation: "11 de junio de 2026" is ~19 characters per tick against a
 * ~220 px plot at 320 px, so eight of them collide into illegibility.
 *
 * NUMERIC RATHER THAN AN ABBREVIATED MONTH NAME, and that is measured rather
 * than aesthetic. `{day: "numeric", month: "short"}` gives "Jun 11" in EN but
 * "11 de jun" in es-CO — Spanish inserts the preposition — so the locale that
 * decides the geometry would be NINE characters wide, and stripping that "de "
 * would mean hand-editing Intl output. This request is at most FIVE characters
 * in either dictionary and is still locale-ORDERED by Intl (day-first in es,
 * month-first in en) rather than by a hardcoded pattern.
 *
 * `2-digit` IS A REQUEST, NOT A GUARANTEE, and es-CO declines it: it renders its
 * own short form ("11/6", "5/7") while en zero-pads ("06/11"). That is correct
 * per-locale behaviour and is why nothing downstream may assume a fixed width —
 * the axis reserves space from the LONGEST FORMATTED tick, never from a count.
 *
 * The full date and the opponent both remain reachable: the chart's data-table
 * alternative and the per-match table directly below it carry them.
 *
 * IT LIVES HERE, not beside its caller, because this module's header declares
 * itself the ONLY formatting path (AD-7) — a second `Intl.DateTimeFormat` in a
 * viz module is precisely the drift that declaration exists to prevent.
 *
 * Same contract as `formatDate` in every other respect: the same anchored
 * `DATE_ONLY` read, the same `utcDateFrom` rejection of a rolled-over calendar
 * date, and the same UTC formatting so no host timezone can move the day.
 */
export function formatDateShort(iso: string, locale: Locale): string {
  const match = DATE_ONLY.exec(iso);
  if (!match) {
    throw new Error(`format: "${iso}" is not an ISO 8601 date`);
  }
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat(NUMBER_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
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

/**
 * The fold itself, EXPORTED for its second consumer (Story 2.14).
 *
 * `includesText` above answers "does it match" and throws the arithmetic away.
 * The header typeahead needs the arithmetic: it highlights the matched
 * substring, so it must locate the needle INSIDE the folded haystack and then
 * slice the ORIGINAL string at those indices. Only the fold can give it an
 * index domain that lines up with what it searched.
 *
 * THE CALLER OWNS THE 1:1 QUESTION, and it is not answered here. Folding is
 * length-preserving for every accented form the corpus contains (all three of
 * them — `ü`, `ô`, `ç` — decompose to base + combining mark, and only the mark
 * is dropped), but it is NOT length-preserving in general: the spacing
 * diacritics named above are DELETED outright, so `"a^b"` (3) folds to `"ab"`
 * (2) and any index computed on the folded form points at the wrong character
 * of the original. `format.test.ts` pins both halves of that property;
 * `search-model.ts` guards on it before it slices.
 *
 * Prefer `includesText` whenever a boolean is enough — it keeps the fold in one
 * place and cannot get the index arithmetic wrong by construction.
 */
export function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

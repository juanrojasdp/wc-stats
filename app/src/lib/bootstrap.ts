import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { STORAGE_KEYS } from "@/lib/storage";

/*
 * Pre-paint bootstrap (AD-12): pre-rendered HTML is Spanish with dark
 * canonical via :root; ONE inline script — rendered as the first element in
 * <body>, ahead of any content paint (layout.tsx documents why it is not a
 * <head> child) — corrects <html lang>, the locale class and the theme class
 * before first paint. Each of the two resolves the same way: a persisted
 * preference if there is one, otherwise what the browser itself asks for
 * (navigator.language for the locale, prefers-color-scheme for the theme),
 * otherwise the canonical es/dark. The script is a checked-in
 * ES5 literal, deliberately NOT built from Function.prototype.toString():
 * build transforms (coverage instrumentation, refresh wrappers, downlevel
 * helpers) may rewrite the pure functions' bodies, and anything they inject
 * would ship into the pre-paint script sight-unseen. Drift between the
 * literal and the exported pure functions is caught by bootstrap.test.ts,
 * which evaluates the script against a stubbed document/localStorage/
 * matchMedia/navigator and cross-checks the full input matrix against the
 * functions.
 */

export type Theme = "dark" | "light";

/**
 * Persisted override → prefers-color-scheme → dark canonical (AD-12).
 * `prefersDark` is null when matchMedia is unavailable or throws — only then
 * does the canonical-dark default decide.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean | null): Theme {
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  if (prefersDark === false) {
    return "light";
  }
  return "dark";
}

/**
 * Persisted override → navigator.language's primary subtag → canonical es
 * (FR-37). Only the PRIMARY subtag is read: `en`, `en-GB` and `en-US` all
 * resolve to `en`. This is a two-locale product, so a reader whose browser
 * asks for neither Spanish nor English gets the canonical, not a guess —
 * `fr-FR` resolves to `es`, deliberately.
 *
 * `preferred` is guarded by `typeof` AND truthiness, not against `null`: it
 * crosses an untyped boundary (the ES5 literal reads whatever `navigator`
 * hands it), and folding `null`, `undefined` and `""` into one path is the
 * property the bootstrap cross-check matrix exists to protect. The `typeof`
 * half is a code-review amendment to D3 (2026-08-26): a truthy NON-STRING —
 * what an anti-fingerprinting extension or a shimmed `navigator` can return —
 * would otherwise throw out of `.toLowerCase()`, and in the ES5 literal that
 * throw escapes the script entirely, costing the visitor the THEME class too
 * (locale is resolved first). Both copies carry the same guard, so D4's
 * "same algorithm, same shape" still holds.
 *
 * `fallback` is what a reader who asks for neither locale gets. It is
 * defaulted, so `preferred` stays REQUIRED and D2's typecheck gate is intact;
 * the provider passes its `initialLocale` so that prop is honoured rather than
 * silently overridden. The ES5 literal has no `initialLocale` to pass and so
 * hardcodes the same `es` this default resolves to — the drift matrix calls
 * the two-argument form and therefore still cross-checks them exactly.
 *
 * A detected locale is a guess, never a choice — nothing here persists it;
 * only the toggle writes storage (AD-10).
 */
export function resolveLocale(
  stored: string | null,
  preferred: string | null,
  fallback: Locale = DEFAULT_LOCALE
): Locale {
  if (stored === "es" || stored === "en") {
    return stored;
  }
  const primary =
    typeof preferred === "string" && preferred ? preferred.toLowerCase().split("-")[0] : null;
  if (primary === "en") {
    return "en";
  }
  return fallback;
}

const LOCALE_CLASS_PREFIX = "locale-";

/** The <html> locale class the bootstrap script and the providers share. */
export function localeClass(locale: Locale): string {
  return LOCALE_CLASS_PREFIX + locale;
}

/*
 * Storage reads are try/catch (private mode / disabled storage reads as
 * absent), the navigator read is try/catch for the same reason (an absent or
 * throwing `navigator` reads as "no preference"), and classList add/remove
 * preserves the next/font variable classes already on <html>.
 *
 * `language()` reads `window.navigator`, never a bare `navigator`: the test
 * evaluates this literal as `new Function("window", "document", …)` under
 * vitest's node environment, where Node 24 exposes a REAL global `navigator`
 * carrying the host machine's locale. A bare read would reach past the stub
 * and make the matrix green for the wrong reason on any given machine.
 *
 * WHAT ACTUALLY CATCHES A BARE READ (corrected 2026-08-26 — the original note
 * here, and Task 4.1, both named the wrong case): NOT the no-navigator world.
 * A bare read there reaches Node's real global and returns the host locale,
 * which on a Spanish machine resolves `es` — exactly what that world expects,
 * so it stays GREEN under a violation. What catches it is the drift matrix's
 * `languages` axis spanning BOTH English and non-English tags: the host's one
 * fixed locale must disagree with at least one of those rows whatever it is,
 * so a bare read goes red on every machine. Keep both kinds of tag on that
 * axis — that span, not the no-navigator case, is the guard.
 */
export const bootstrapScript = `(function () {
  var resolveTheme = function (stored, prefersDark) {
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    if (prefersDark === false) {
      return "light";
    }
    return "dark";
  };
  var resolveLocale = function (stored, preferred) {
    if (stored === "es" || stored === "en") {
      return stored;
    }
    var primary =
      typeof preferred === "string" && preferred ? preferred.toLowerCase().split("-")[0] : null;
    if (primary === "en") {
      return "en";
    }
    return "es";
  };
  var read = function (key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  };
  var language = function () {
    try {
      return window.navigator.language || null;
    } catch (error) {
      return null;
    }
  };
  var prefersDark = null;
  try {
    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (error) {
    prefersDark = null;
  }
  var locale = resolveLocale(read(${JSON.stringify(STORAGE_KEYS.locale)}), language());
  var theme = resolveTheme(read(${JSON.stringify(STORAGE_KEYS.theme)}), prefersDark);
  var root = document.documentElement;
  root.lang = locale;
  root.classList.remove(${JSON.stringify(localeClass("es"))}, ${JSON.stringify(localeClass("en"))}, "dark", "light");
  root.classList.add(${JSON.stringify(LOCALE_CLASS_PREFIX)} + locale, theme);
})();`;

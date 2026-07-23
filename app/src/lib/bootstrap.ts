import type { Locale } from "@/lib/i18n";
import { STORAGE_KEYS } from "@/lib/storage";

/*
 * Pre-paint bootstrap (AD-12): pre-rendered HTML is Spanish with dark
 * canonical via :root; ONE inline script — rendered as the first element in
 * <body>, ahead of any content paint (layout.tsx documents why it is not a
 * <head> child) — corrects <html lang>, the locale class and the theme class
 * from persisted preferences before first paint. The script is a checked-in
 * ES5 literal, deliberately NOT built from Function.prototype.toString():
 * build transforms (coverage instrumentation, refresh wrappers, downlevel
 * helpers) may rewrite the pure functions' bodies, and anything they inject
 * would ship into the pre-paint script sight-unseen. Drift between the
 * literal and the exported pure functions is caught by bootstrap.test.ts,
 * which evaluates the script against stubbed document/localStorage/matchMedia
 * and cross-checks the full input matrix against the functions.
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

/** Persisted valid locale → it; anything else → canonical es. */
export function resolveLocale(stored: string | null): Locale {
  if (stored === "es" || stored === "en") {
    return stored;
  }
  return "es";
}

const LOCALE_CLASS_PREFIX = "locale-";

/** The <html> locale class the bootstrap script and the providers share. */
export function localeClass(locale: Locale): string {
  return LOCALE_CLASS_PREFIX + locale;
}

/*
 * Storage reads are try/catch (private mode / disabled storage reads as
 * absent) and classList add/remove preserves the next/font variable classes
 * already on <html>.
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
  var resolveLocale = function (stored) {
    if (stored === "es" || stored === "en") {
      return stored;
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
  var prefersDark = null;
  try {
    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (error) {
    prefersDark = null;
  }
  var locale = resolveLocale(read(${JSON.stringify(STORAGE_KEYS.locale)}));
  var theme = resolveTheme(read(${JSON.stringify(STORAGE_KEYS.theme)}), prefersDark);
  var root = document.documentElement;
  root.lang = locale;
  root.classList.remove(${JSON.stringify(localeClass("es"))}, ${JSON.stringify(localeClass("en"))}, "dark", "light");
  root.classList.add(${JSON.stringify(LOCALE_CLASS_PREFIX)} + locale, theme);
})();`;

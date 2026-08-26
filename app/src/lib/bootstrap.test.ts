import { describe, expect, it } from "vitest";

import { bootstrapScript, localeClass, resolveLocale, resolveTheme } from "@/lib/bootstrap";
import { STORAGE_KEYS } from "@/lib/storage";

/*
 * The inline script is evaluated as a string against stubbed document/
 * localStorage/matchMedia/navigator, then compared against the exported pure
 * functions across the full input matrix — proving the pre-paint script and
 * the tested logic agree (Story 2.2 Task 1/10; the navigator dimension is
 * Story 3.5).
 *
 * EVERY case states the language tag it assumes, including the ones that
 * expect Spanish. Under vitest's node environment Node 24 exposes a REAL
 * global `navigator` carrying this machine's locale, so a case that left the
 * tag ambient would be green for a reason that changes with the machine.
 */

interface BootstrapWorld {
  stored?: Partial<Record<string, string>>;
  storageThrows?: boolean;
  prefersDark?: boolean;
  matchMediaThrows?: boolean;
  initialClasses?: string[];
  /**
   * The tag `window.navigator.language` reports. Leaving it `undefined` omits
   * `navigator` from the window stub ENTIRELY — the third world, and the only
   * one that would crash if the literal read a bare `navigator` instead of
   * `window.navigator` (it would reach Node's real global instead).
   */
  language?: string;
  /** `window.navigator` throws on access — proves `language()`'s catch. */
  navigatorThrows?: boolean;
}

function runBootstrapScript({
  stored = {},
  storageThrows = false,
  prefersDark = false,
  matchMediaThrows = false,
  initialClasses = [],
  language,
  navigatorThrows = false,
}: BootstrapWorld) {
  const classes = new Set(initialClasses);
  const documentStub = {
    documentElement: {
      lang: "es",
      classList: {
        add: (...names: string[]) => names.forEach((name) => classes.add(name)),
        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      },
    },
  };
  const windowStub: Record<string, unknown> = {
    localStorage: {
      getItem: (key: string): string | null => {
        if (storageThrows) {
          throw new Error("storage disabled");
        }
        return stored[key] ?? null;
      },
    },
    matchMedia: (query: string) => {
      if (matchMediaThrows) {
        throw new Error("matchMedia unavailable");
      }
      return { matches: query === "(prefers-color-scheme: dark)" && prefersDark };
    },
  };
  if (navigatorThrows) {
    Object.defineProperty(windowStub, "navigator", {
      get: () => {
        throw new Error("navigator unavailable");
      },
    });
  } else if (language !== undefined) {
    windowStub.navigator = { language };
  }
  new Function("window", "document", bootstrapScript)(windowStub, documentStub);
  return { lang: documentStub.documentElement.lang, classes };
}

describe("resolveTheme (persisted override → prefers-color-scheme → dark canonical)", () => {
  it("persisted override wins over the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows prefers-color-scheme when nothing valid is stored", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("solarized", false)).toBe("light");
  });

  it("defaults to canonical dark when the preference is unknowable", () => {
    expect(resolveTheme(null, null)).toBe("dark");
    expect(resolveTheme("garbage", null)).toBe("dark");
  });
});

describe("resolveLocale (persisted → navigator.language primary subtag → es)", () => {
  it("accepts the two valid locales, whatever the browser asks for", () => {
    expect(resolveLocale("es", null)).toBe("es");
    expect(resolveLocale("en", null)).toBe("en");
  });

  it("reads ONLY the primary subtag, case-insensitively", () => {
    for (const tag of ["en", "en-GB", "en-US", "EN-US", "en-us", "en-Latn-US"]) {
      expect(resolveLocale(null, tag), tag).toBe("en");
    }
  });

  it("gives a non-Spanish non-English reader the canonical, not a guess", () => {
    for (const tag of ["es", "es-CO", "es-419", "fr", "fr-FR", "de-DE", "pt-BR", "zh-CN"]) {
      expect(resolveLocale(null, tag), tag).toBe("es");
    }
  });

  /*
   * `enm` (Middle English) is the case a `startsWith("en")` implementation
   * would get wrong. It is here to pin the algorithm, not the tag.
   */
  it("matches the subtag exactly rather than by prefix", () => {
    expect(resolveLocale(null, "enm")).toBe("es");
    expect(resolveLocale(null, "eng-GB")).toBe("es");
  });

  it("treats an absent, empty or unparseable preference as no preference", () => {
    expect(resolveLocale(null, null)).toBe("es");
    expect(resolveLocale(null, "")).toBe("es");
    expect(resolveLocale(null, "garbage")).toBe("es");
    expect(resolveLocale(null, "-")).toBe("es");
  });

  /*
   * A persisted value is a CHOICE and a detected tag is a GUESS, so the
   * choice wins in BOTH directions — including the direction that costs the
   * detected locale its win.
   */
  it("lets a stored choice beat a detected guess, both ways round", () => {
    expect(resolveLocale("es", "en-US")).toBe("es");
    expect(resolveLocale("en", "es-CO")).toBe("en");
  });

  it("falls through to detection when the stored value is not a valid locale", () => {
    expect(resolveLocale("fr", "en-GB")).toBe("en");
    expect(resolveLocale("garbage", "en-US")).toBe("en");
    expect(resolveLocale("", "en")).toBe("en");
    expect(resolveLocale("fr", "fr-FR")).toBe("es");
  });
});

describe("inline bootstrap script", () => {
  it("applies stored preferences before paint", () => {
    const { lang, classes } = runBootstrapScript({
      stored: { [STORAGE_KEYS.locale]: "en", [STORAGE_KEYS.theme]: "light" },
      prefersDark: true,
      // Both preferences are stated AGAINST the browser: the stored choices
      // must win over `es-CO` and over `prefers-color-scheme: dark` alike.
      language: "es-CO",
    });
    expect(lang).toBe("en");
    expect(classes.has(localeClass("en"))).toBe(true);
    expect(classes.has("light")).toBe(true);
    expect(classes.has("dark")).toBe(false);
  });

  /*
   * The window stub omits `navigator` entirely here — the "no navigator at
   * all" world, stated rather than inherited. It is still Spanish, and for
   * the reason the name gives: nothing to detect, so the canonical decides.
   */
  it("first-time visitor with no navigator: Spanish, theme from prefers-color-scheme", () => {
    const dark = runBootstrapScript({ prefersDark: true });
    expect(dark.lang).toBe("es");
    expect(dark.classes.has(localeClass("es"))).toBe(true);
    expect(dark.classes.has("dark")).toBe(true);

    const light = runBootstrapScript({ prefersDark: false });
    expect(light.classes.has("light")).toBe(true);
    expect(light.classes.has("dark")).toBe(false);
  });

  /*
   * FR-37, the whole point of Story 3.5: the same empty storage as above, but
   * a browser that asks for English gets English before first paint — no
   * toggle, no round trip.
   */
  it("first-time visitor whose browser asks for English: English before paint", () => {
    for (const tag of ["en-US", "en-GB", "en"]) {
      const { lang, classes } = runBootstrapScript({ language: tag, prefersDark: true });
      expect(lang, tag).toBe("en");
      expect(classes.has(localeClass("en")), tag).toBe(true);
      expect(classes.has(localeClass("es")), tag).toBe(false);
    }

    const french = runBootstrapScript({ language: "fr-FR", prefersDark: true });
    expect(french.lang).toBe("es");
    expect(french.classes.has(localeClass("es"))).toBe(true);
  });

  /*
   * Private mode. Storage throwing costs the reader a persisted choice, but
   * it must NOT cost them detection: the theme falls to the dark canonical
   * because matchMedia is gone too, while the locale still follows the
   * browser. Detection is the layer BELOW storage, not beside it.
   */
  it("storage and matchMedia throwing still detects the locale, theme dark", () => {
    const { lang, classes } = runBootstrapScript({
      storageThrows: true,
      matchMediaThrows: true,
      language: "en-US",
    });
    expect(lang).toBe("en");
    expect(classes.has("dark")).toBe(true);
    expect(classes.has(localeClass("en"))).toBe(true);
  });

  it("navigator itself throwing still yields the es/dark canonical", () => {
    const { lang, classes } = runBootstrapScript({
      storageThrows: true,
      matchMediaThrows: true,
      navigatorThrows: true,
    });
    expect(lang).toBe("es");
    expect(classes.has("dark")).toBe(true);
    expect(classes.has(localeClass("es"))).toBe(true);
  });

  it("preserves the next/font variable classes on <html>", () => {
    const { classes } = runBootstrapScript({ initialClasses: ["__variable_abc", "__variable_def"] });
    expect(classes.has("__variable_abc")).toBe(true);
    expect(classes.has("__variable_def")).toBe(true);
  });

  /*
   * THE DRIFT TEST. The expectation is computed by calling the exported
   * functions, not by restating their rules — so this catches the literal and
   * the functions disagreeing, which is the epic's risk #1 and the thing a
   * second hand-written implementation here would NOT catch.
   *
   * `undefined` in `languages` means "no navigator on the window at all",
   * which the pure function sees as `null`.
   */
  it("agrees with the exported pure functions across the input matrix", () => {
    const storedThemes = [undefined, "dark", "light", "garbage"];
    const storedLocales = [undefined, "es", "en", "garbage"];
    const languages = [undefined, "en-US", "es-CO", "fr-FR", ""];
    const preferences: Array<{ prefersDark: boolean; matchMediaThrows: boolean }> = [
      { prefersDark: true, matchMediaThrows: false },
      { prefersDark: false, matchMediaThrows: false },
      { prefersDark: false, matchMediaThrows: true },
    ];
    let combinations = 0;
    for (const theme of storedThemes) {
      for (const locale of storedLocales) {
        for (const language of languages) {
          for (const preference of preferences) {
            const stored: Partial<Record<string, string>> = {};
            if (theme !== undefined) stored[STORAGE_KEYS.theme] = theme;
            if (locale !== undefined) stored[STORAGE_KEYS.locale] = locale;
            const { lang, classes } = runBootstrapScript({ stored, language, ...preference });
            const expectedTheme = resolveTheme(
              theme ?? null,
              preference.matchMediaThrows ? null : preference.prefersDark
            );
            const expectedLocale = resolveLocale(locale ?? null, language ?? null);
            const world = `theme=${theme} locale=${locale} language=${language}`;
            expect(lang, world).toBe(expectedLocale);
            expect(classes.has(expectedTheme), world).toBe(true);
            expect(classes.has(expectedTheme === "dark" ? "light" : "dark"), world).toBe(false);
            expect(classes.has(localeClass(expectedLocale)), world).toBe(true);
            combinations += 1;
          }
        }
      }
    }
    // The loop must actually have run the matrix it claims: a mis-typed axis
    // that silently collapsed to one value would otherwise pass.
    expect(combinations).toBe(4 * 4 * 5 * 3);
  });
});

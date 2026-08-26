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
   * `navigator` from the window stub ENTIRELY — the third world.
   *
   * It does NOT, however, catch a bare-`navigator` read (corrected 2026-08-26;
   * the note here used to claim it was "the only one that would crash", then
   * contradict itself in its own parenthetical). Inside
   * `new Function("window", "document", …)` the scope chain falls through to
   * the global, and Node 24 exposes a real `navigator` carrying the host
   * machine's locale — so a bare read returns e.g. `es-CO` and resolves `es`,
   * which is exactly what this world expects. It stays green under the
   * violation. What catches a bare read is the drift matrix's `languages`
   * axis spanning both English and non-English tags; see the note above
   * `bootstrapScript` in bootstrap.ts.
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
    /*
     * `en_US` — the underscore form some Android WebView and Electron builds
     * emit — is Spanish, BY RULING (D4: split on `-`, nothing else). Pinned
     * here rather than left unstated (code review 2026-08-26) so the next
     * reader sees a decision instead of an oversight: without this line the
     * behaviour is indistinguishable from nobody having considered it. If the
     * ruling is ever revisited, this is the assertion to change.
     */
    expect(resolveLocale(null, "en_US"), "underscore form is es by D4").toBe("es");
  });

  /*
   * A truthy NON-STRING reaching the pure function. It cannot arrive through
   * the type system — this is the untyped ES5 boundary's shape, asserted on
   * the TS copy so both carry the same guard (D3, amended 2026-08-26).
   */
  it("treats a truthy non-string preference as no preference, rather than throwing", () => {
    expect(resolveLocale(null, ["en-US"] as unknown as string)).toBe("es");
    expect(resolveLocale(null, 42 as unknown as string)).toBe("es");
    expect(resolveLocale("en", {} as unknown as string)).toBe("en");
  });

  /*
   * The third tier. `fallback` defaults to DEFAULT_LOCALE, and the provider
   * passes its `initialLocale` so a caller that names a locale is honoured
   * when nothing is stored and nothing English is detected.
   */
  it("returns the caller's fallback when nothing is stored and nothing is detected", () => {
    expect(resolveLocale(null, "fr-FR", "en")).toBe("en");
    expect(resolveLocale(null, null, "en")).toBe("en");
    expect(resolveLocale(null, "fr-FR")).toBe("es");
    // A stored choice and a detected tag both still outrank it.
    expect(resolveLocale("es", null, "en")).toBe("es");
    expect(resolveLocale(null, "en-GB", "es")).toBe("en");
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

  /*
   * THE THEME IS THE WITNESS, and it is the whole point of this case (code
   * review 2026-08-26). This test used to set storageThrows AND
   * matchMediaThrows too and assert es/dark — the canonical, which is equally
   * what you get if the catch never runs, if `language()` returns garbage, or
   * if `resolveLocale` ignores its second argument entirely. It could not
   * distinguish "the catch works" from "everything collapsed to the default".
   * Here storage and matchMedia both WORK and prefersDark is false, so `light`
   * on <html> proves the script ran to completion — i.e. survived the throw —
   * rather than never having applied anything.
   */
  it("navigator throwing costs the locale but not the rest of the script", () => {
    const { lang, classes } = runBootstrapScript({
      navigatorThrows: true,
      prefersDark: false,
    });
    expect(lang).toBe("es");
    expect(classes.has(localeClass("es"))).toBe(true);
    expect(classes.has("light"), "the theme still resolved, so the script survived").toBe(true);
    expect(classes.has("dark")).toBe(false);
  });

  /*
   * A truthy NON-STRING tag. Anti-fingerprinting extensions and shimmed
   * navigators return arrays and proxies here; `language()`'s try/catch wraps
   * only the READ, so before the code-review amendment to D3 this threw out of
   * `.toLowerCase()` inside `resolveLocale` — which runs AFTER `language()`
   * returns and BEFORE the theme is resolved, so the escape cost the visitor
   * `<html lang>`, the locale class AND their theme. Same witness as above.
   */
  it("a non-string navigator.language costs neither the script nor the theme", () => {
    const { lang, classes } = runBootstrapScript({
      language: ["en-US"] as unknown as string,
      prefersDark: false,
    });
    expect(lang).toBe("es");
    expect(classes.has(localeClass("es"))).toBe(true);
    expect(classes.has("light"), "the theme still resolved, so the script survived").toBe(true);
  });

  /*
   * The navigator-throws world crossed against the pure function, which the
   * matrix axis cannot express (its values are tags, not access behaviours).
   * Without this the literal's `language()` catch is never cross-checked.
   */
  it("agrees with the pure function when navigator throws", () => {
    for (const stored of [undefined, "es", "en", "garbage"]) {
      const world = `stored=${stored}`;
      const { lang } = runBootstrapScript({
        stored: stored === undefined ? {} : { [STORAGE_KEYS.locale]: stored },
        navigatorThrows: true,
      });
      expect(lang, world).toBe(resolveLocale(stored ?? null, null));
    }
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
    /*
     * `EN-US` and `enm` are load-bearing, not padding (code review
     * 2026-08-26). The original axis was `[undefined, "en-US", "es-CO",
     * "fr-FR", ""]`, in which EVERY uppercase character sat in a region
     * subtag and no value distinguished prefix-matching from exact-matching.
     * A literal that alone dropped `.toLowerCase()`, or alone switched to
     * `indexOf("en") === 0`, produced identical output on all five values and
     * the matrix stayed green — while the pure-function tests that DO pin
     * those two behaviours never look at the literal. `EN-US` catches a lost
     * `toLowerCase` (primary subtag `EN`); `enm` catches a prefix match.
     */
    const languages = [undefined, "en-US", "EN-US", "es-CO", "fr-FR", "enm", ""];
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
    expect(combinations).toBe(4 * 4 * 7 * 3);
  });
});

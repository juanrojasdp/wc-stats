import { describe, expect, it } from "vitest";

import { bootstrapScript, localeClass, resolveLocale, resolveTheme } from "@/lib/bootstrap";
import { STORAGE_KEYS } from "@/lib/storage";

/*
 * The inline script is evaluated as a string against stubbed document/
 * localStorage/matchMedia, then compared against the exported pure functions
 * across the full input matrix — proving the pre-paint script and the tested
 * logic agree (Story 2.2 Task 1/10).
 */

interface BootstrapWorld {
  stored?: Partial<Record<string, string>>;
  storageThrows?: boolean;
  prefersDark?: boolean;
  matchMediaThrows?: boolean;
  initialClasses?: string[];
}

function runBootstrapScript({
  stored = {},
  storageThrows = false,
  prefersDark = false,
  matchMediaThrows = false,
  initialClasses = [],
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
  const windowStub = {
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

describe("resolveLocale (persisted → es)", () => {
  it("accepts the two valid locales", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("en")).toBe("en");
  });

  it("falls back to es for absent or garbage values", () => {
    expect(resolveLocale(null)).toBe("es");
    expect(resolveLocale("fr")).toBe("es");
    expect(resolveLocale("")).toBe("es");
  });
});

describe("inline bootstrap script", () => {
  it("applies stored preferences before paint", () => {
    const { lang, classes } = runBootstrapScript({
      stored: { [STORAGE_KEYS.locale]: "en", [STORAGE_KEYS.theme]: "light" },
      prefersDark: true,
    });
    expect(lang).toBe("en");
    expect(classes.has(localeClass("en"))).toBe(true);
    expect(classes.has("light")).toBe(true);
    expect(classes.has("dark")).toBe(false);
  });

  it("first-time visitor: Spanish, theme from prefers-color-scheme", () => {
    const dark = runBootstrapScript({ prefersDark: true });
    expect(dark.lang).toBe("es");
    expect(dark.classes.has(localeClass("es"))).toBe(true);
    expect(dark.classes.has("dark")).toBe(true);

    const light = runBootstrapScript({ prefersDark: false });
    expect(light.classes.has("light")).toBe(true);
    expect(light.classes.has("dark")).toBe(false);
  });

  it("storage and matchMedia throwing still yields the es/dark canonical", () => {
    const { lang, classes } = runBootstrapScript({ storageThrows: true, matchMediaThrows: true });
    expect(lang).toBe("es");
    expect(classes.has("dark")).toBe(true);
    expect(classes.has(localeClass("es"))).toBe(true);
  });

  it("preserves the next/font variable classes on <html>", () => {
    const { classes } = runBootstrapScript({ initialClasses: ["__variable_abc", "__variable_def"] });
    expect(classes.has("__variable_abc")).toBe(true);
    expect(classes.has("__variable_def")).toBe(true);
  });

  it("agrees with the exported pure functions across the input matrix", () => {
    const storedThemes = [undefined, "dark", "light", "garbage"];
    const storedLocales = [undefined, "es", "en", "garbage"];
    const preferences: Array<{ prefersDark: boolean; matchMediaThrows: boolean }> = [
      { prefersDark: true, matchMediaThrows: false },
      { prefersDark: false, matchMediaThrows: false },
      { prefersDark: false, matchMediaThrows: true },
    ];
    for (const theme of storedThemes) {
      for (const locale of storedLocales) {
        for (const preference of preferences) {
          const stored: Partial<Record<string, string>> = {};
          if (theme !== undefined) stored[STORAGE_KEYS.theme] = theme;
          if (locale !== undefined) stored[STORAGE_KEYS.locale] = locale;
          const { lang, classes } = runBootstrapScript({ stored, ...preference });
          const expectedTheme = resolveTheme(
            theme ?? null,
            preference.matchMediaThrows ? null : preference.prefersDark
          );
          const expectedLocale = resolveLocale(locale ?? null);
          expect(lang).toBe(expectedLocale);
          expect(classes.has(expectedTheme)).toBe(true);
          expect(classes.has(expectedTheme === "dark" ? "light" : "dark")).toBe(false);
          expect(classes.has(localeClass(expectedLocale))).toBe(true);
        }
      }
    }
  });
});

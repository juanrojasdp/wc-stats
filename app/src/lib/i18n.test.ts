import { afterEach, describe, expect, it, vi } from "vitest";

import { en } from "@/locales/en";
import { es } from "@/locales/es";
import { t } from "@/lib/i18n";

describe("t()", () => {
  it("defaults to the canonical Spanish dictionary", () => {
    expect(t("app.scaffold.heading")).toBe(es.app.scaffold.heading);
  });

  it("resolves the active locale's value", () => {
    expect(t("app.scaffold.heading", "en")).toBe(en.app.scaffold.heading);
    expect(t("app.scaffold.heading", "es")).not.toBe(t("app.scaffold.heading", "en"));
  });

  it("throws on a key that does not resolve to a string", () => {
    // Bypasses the compile-time key type to exercise the runtime guard.
    expect(() => t("app.missing" as Parameters<typeof t>[0])).toThrow(/did not resolve/);
  });
});

/*
 * Story 2.2 Task 4 decision: once locale persistence ships, a throwing t()
 * would turn a stale key into an uncaught page crash. In production an
 * unresolvable key falls back (es value, else the key itself) with a
 * console.error; dev and test keep the throw so regressions stay loud.
 */
describe("t() production fallback policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the key with a console.error instead of throwing in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(t("app.missing" as Parameters<typeof t>[0])).toBe("app.missing");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toMatch(/did not resolve/);
  });

  it("falls back to the canonical es value when a non-es lookup misses", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // en is type-mirrored, so a real miss cannot exist in a compiling tree;
    // simulate the untyped boundary by breaking the leaf at runtime.
    const enScaffold = en.app.scaffold as Record<string, unknown>;
    const original = enScaffold.heading;
    enScaffold.heading = undefined;
    try {
      expect(t("app.scaffold.heading", "en")).toBe(es.app.scaffold.heading);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      enScaffold.heading = original;
    }
  });

  it("returns the raw key when the key misses in both locales, logging it once", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // The stale-persisted-key scenario: absent from en AND from the es
    // fallback — the raw dot-path is the last resort.
    const key = "app.missing.everywhere" as Parameters<typeof t>[0];
    expect(t(key, "en")).toBe("app.missing.everywhere");
    expect(consoleError).toHaveBeenCalledTimes(1);
    // Re-resolving the same miss (e.g. a list re-render) must not re-log.
    expect(t(key, "en")).toBe("app.missing.everywhere");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("keeps throwing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => t("app.missing" as Parameters<typeof t>[0])).toThrow(/did not resolve/);
  });
});

describe("dictionary mirroring (AD-12)", () => {
  // The real enforcement is the compile error on `en: Dictionary`; this
  // runtime sweep is a belt-and-braces regression net for the same property.
  function keyShape(node: unknown, prefix = ""): string[] {
    if (typeof node === "string") {
      return [prefix];
    }
    if (typeof node === "object" && node !== null) {
      return Object.entries(node).flatMap(([key, value]) =>
        keyShape(value, prefix ? `${prefix}.${key}` : key)
      );
    }
    throw new Error(`unexpected dictionary leaf at "${prefix}"`);
  }

  it("en mirrors the exact key shape of es", () => {
    expect(keyShape(en).sort()).toEqual(keyShape(es).sort());
  });

  it("dictionaries contain only non-empty string leaves", () => {
    for (const dictionary of [es, en]) {
      for (const key of keyShape(dictionary)) {
        expect(t(key as Parameters<typeof t>[0], dictionary === es ? "es" : "en")).not.toBe("");
      }
    }
  });
});

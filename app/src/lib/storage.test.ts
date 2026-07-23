import { afterEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from "@/lib/storage";

/*
 * Round-trip coverage for the persistence semantics hardened in the 2.1
 * review: localStorage is authoritative (including null for an absent key);
 * the in-memory map substitutes ONLY while localStorage throws.
 */

function workingLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function throwingLocalStorage() {
  const deny = () => {
    throw new Error("storage disabled");
  };
  return { getItem: deny, setItem: deny, removeItem: deny };
}

function stubWindow(localStorage: unknown) {
  vi.stubGlobal("window", { localStorage });
}

afterEach(() => {
  // Clear both layers so the module-level memory fallback never leaks state
  // between tests: with working storage, removeStorage empties both.
  stubWindow(workingLocalStorage());
  removeStorage(STORAGE_KEYS.locale);
  removeStorage(STORAGE_KEYS.theme);
  vi.unstubAllGlobals();
});

describe("storage round-trip", () => {
  it("persists a toggle choice and reads it back", () => {
    stubWindow(workingLocalStorage());
    writeStorage(STORAGE_KEYS.theme, "light");
    expect(readStorage(STORAGE_KEYS.theme)).toBe("light");
  });

  it("readStorage returns null after removeStorage — no resurrection", () => {
    stubWindow(workingLocalStorage());
    writeStorage(STORAGE_KEYS.locale, "en");
    removeStorage(STORAGE_KEYS.locale);
    expect(readStorage(STORAGE_KEYS.locale)).toBeNull();
  });

  it("memory fallback serves the session while localStorage throws", () => {
    stubWindow(throwingLocalStorage());
    writeStorage(STORAGE_KEYS.theme, "light");
    expect(readStorage(STORAGE_KEYS.theme)).toBe("light");
  });

  it("a working localStorage answer is authoritative over stale memory", () => {
    stubWindow(throwingLocalStorage());
    writeStorage(STORAGE_KEYS.theme, "light");
    // Storage recovers (e.g. quota freed) but holds nothing: null must win
    // over the stale in-memory copy.
    stubWindow(workingLocalStorage());
    expect(readStorage(STORAGE_KEYS.theme)).toBeNull();
  });
});

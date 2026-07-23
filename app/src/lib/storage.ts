/*
 * localStorage wrapper (AD-10). Key names are reserved here for Story 2.2's
 * toggle/persistence wiring. Storage can be absent or throwing (private
 * browsing, quota, disabled) — every access is try/catch with an in-memory
 * fallback so the app never crashes over persistence.
 */

export const STORAGE_KEYS = {
  locale: "wcstats.locale",
  theme: "wcstats.theme",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const memoryFallback = new Map<string, string>();

/*
 * The in-memory map substitutes ONLY when localStorage itself is unavailable
 * (throws). When localStorage works, its answer is authoritative — including
 * `null` for an absent key: a key deleted in another tab or via "clear site
 * data" must read as gone, never resurrect from a stale in-memory copy.
 */
export function readStorage(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export function writeStorage(key: StorageKey, value: string): void {
  try {
    window.localStorage.setItem(key, value);
    memoryFallback.delete(key);
  } catch {
    memoryFallback.set(key, value);
  }
}

export function removeStorage(key: StorageKey): void {
  memoryFallback.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing persisted to remove
  }
}

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

export function readStorage(key: StorageKey): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch {
    // fall through to the in-memory copy
  }
  return memoryFallback.get(key) ?? null;
}

export function writeStorage(key: StorageKey, value: string): void {
  memoryFallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // in-memory copy already updated
  }
}

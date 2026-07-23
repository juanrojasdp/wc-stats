import { es, type Dictionary } from "@/locales/es";
import { en } from "@/locales/en";

export type Locale = "es" | "en";

export const DEFAULT_LOCALE: Locale = "es";

const dictionaries: Record<Locale, Dictionary> = { es, en };

/*
 * Statically-typed dot paths into the dictionary: every string leaf of the
 * canonical `es` shape is addressable, and nothing else is. A typo'd or
 * removed key is a compile error at the call site.
 */
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];

export type DictionaryKey = DotPaths<Dictionary>;

function lookup(key: DictionaryKey, locale: Locale): string | null {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) {
    node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === "string" ? node : null;
}

/**
 * The ONLY read path into the dictionaries (AD-12). Server components and
 * metadata call it directly (pre-rendered HTML is Spanish); client components
 * bind the active locale through `useT()` in i18n-provider.tsx — a direct
 * import from src/components/** is an ESLint error (client-import seam,
 * Story 2.2 Task 4).
 *
 * Unresolvable keys (only reachable through the untyped boundary, e.g. stale
 * persisted state) throw in dev/test so regressions stay loud; in production
 * they fall back — canonical es value, else the key itself — with a
 * console.error, because a wrong-language string beats an uncaught crash
 * (Story 2.2 Task 4 decision).
 */
// A stale key can sit in a rendered list and re-resolve on every render;
// report each (locale, key) miss once instead of flooding the console.
const reportedMissing = new Set<string>();

export function t(key: DictionaryKey, locale: Locale = DEFAULT_LOCALE): string {
  const resolved = lookup(key, locale);
  if (resolved !== null) {
    return resolved;
  }
  const message = `i18n: key "${key}" did not resolve to a string in locale "${locale}"`;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
  const reportKey = `${locale}:${key}`;
  if (!reportedMissing.has(reportKey)) {
    reportedMissing.add(reportKey);
    console.error(message);
  }
  const fallback = locale === DEFAULT_LOCALE ? null : lookup(key, DEFAULT_LOCALE);
  return fallback ?? key;
}

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

/**
 * The ONLY read path into the dictionaries (AD-12). Server components and
 * metadata call it directly (pre-rendered HTML is Spanish); client components
 * bind the active locale through `useT()` in i18n-provider.tsx.
 */
export function t(key: DictionaryKey, locale: Locale = DEFAULT_LOCALE): string {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) {
    node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== "string") {
    // Unreachable for a well-typed key; guards the untyped boundary (e.g. a
    // stale key arriving from persisted state).
    throw new Error(`i18n: key "${key}" did not resolve to a string in locale "${locale}"`);
  }
  return node;
}

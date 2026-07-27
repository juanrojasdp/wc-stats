"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Viewport state as an external store, NOT an effect + useState (Task 4.2).
 * getSnapshot reads `.matches` synchronously, so the FIRST client render is
 * already at the right breakpoint; an effect-based hook renders one frame at
 * the wrong one — eleven collapsed shells flashing on a desktop.
 *
 * The Tactical Layer mounts only after the client fetch resolves, so its first
 * render is a client render and there is no server markup to mismatch.
 * getServerSnapshot returns false anyway (mobile-first) for any caller that
 * does pre-render.
 */

/*
 * Breakpoints are declared in `rem`, matching Tailwind 4's own defaults
 * (--breakpoint-md: 48rem, --breakpoint-lg: 64rem), which globals.css does not
 * override. Hardcoding them in `px` desynchronises the JS branch from the CSS
 * one for any reader whose root font size is not 16px: between the two
 * thresholds the component would filter rows for one layout while the
 * stylesheet painted the other. That reader — the one running a larger default
 * font — is exactly who the min-h-11 and 200%-zoom discipline exists for.
 */

/** `lg` — the disclosure breakpoint (UX-DR6: expanded at ≥lg). */
export const LG_MEDIA_QUERY = "(min-width: 64rem)";

/** `md` — the Key Statistics layout breakpoint (ruled decision 4). */
export const MD_MEDIA_QUERY = "(min-width: 48rem)";

/*
 * matchMedia is guarded the way bootstrap.ts guards it: a browser that throws
 * here must degrade to the mobile-first default, never take the page down.
 *
 * Cached per query because getSnapshot runs on EVERY render and on every store
 * notification; minting a fresh live MediaQueryList each time is pure churn,
 * and it also means subscribe() and getSnapshot() observe the same object.
 */
const MEDIA_QUERY_LISTS = new Map<string, MediaQueryList | null>();

function mediaQueryList(query: string): MediaQueryList | null {
  const cached = MEDIA_QUERY_LISTS.get(query);
  if (cached !== undefined) {
    return cached;
  }
  let list: MediaQueryList | null;
  try {
    list = window.matchMedia(query);
  } catch {
    list = null;
  }
  MEDIA_QUERY_LISTS.set(query, list);
  return list;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = mediaQueryList(query);
      if (list === null) {
        return () => {};
      }
      /*
       * Guarded for the same reason matchMedia is, and it is a real gap rather
       * than a theoretical one: Safari ≤13 and older Android WebViews expose
       * only the deprecated addListener, so an unguarded addEventListener
       * throws during commit — taking the page down in precisely the browser
       * the mobile-first fallback above exists to serve.
       */
      try {
        list.addEventListener("change", onStoreChange);
        return () => list.removeEventListener("change", onStoreChange);
      } catch {
        return () => {};
      }
    },
    [query]
  );

  // Returns a primitive, so React's Object.is check needs no memoized snapshot.
  const getSnapshot = useCallback(() => mediaQueryList(query)?.matches ?? false, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

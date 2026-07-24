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

/** `lg` — the disclosure breakpoint (UX-DR6: expanded at ≥lg). */
export const LG_MEDIA_QUERY = "(min-width: 1024px)";

/** `md` — the Key Statistics layout breakpoint (ruled decision 4). */
export const MD_MEDIA_QUERY = "(min-width: 768px)";

// matchMedia is guarded the way bootstrap.ts guards it: a browser that throws
// here must degrade to the mobile-first default, never take the page down.
function mediaQueryList(query: string): MediaQueryList | null {
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = mediaQueryList(query);
      if (list === null) {
        return () => {};
      }
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  // Returns a primitive, so React's Object.is check needs no memoized snapshot.
  const getSnapshot = useCallback(() => mediaQueryList(query)?.matches ?? false, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

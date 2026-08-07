"use client";

import { useSyncExternalStore } from "react";

/*
 * THE QUERY STRING AS AN EXTERNAL STORE (Story 2.17, ruled D1).
 *
 * `/compare` is the first route in this app to read a query parameter at all:
 * `useSearchParams`, `useRouter`, `usePathname`, `history.pushState` and
 * `Suspense` are all zero-occurrence in `src/` before this file. The mechanism
 * is therefore ruled here rather than inherited.
 *
 * 🔴 NOT `useSearchParams()`. Under `output: "export"` an unwrapped
 * `useSearchParams()` throws `BailoutToCSRError` (E394) during prerender and
 * `next build` FAILS with "useSearchParams() should be wrapped in a suspense
 * boundary at page /compare". Wrapping it builds, but React then serialises the
 * boundary's FALLBACK into `out/compare/index.html` for that whole subtree — so
 * the exported document would lose the real route shell. This codebase has zero
 * `<Suspense>` anywhere, so there is no fallback a11y precedent to copy either.
 *
 * This hook is shaped exactly like `use-media-query.ts`, for the reason that
 * file states in place: getSnapshot reads the live value synchronously, so the
 * FIRST client render after hydration is already at the right query string. An
 * effect-based hook would render one frame at the wrong one — here that frame
 * is the picker-first empty state flashing over a pasted comparison URL.
 */

/**
 * Subscribers to same-document URL writes.
 *
 * 🔴 THIS SET IS WHY THE HOOK WORKS AT ALL. `history.replaceState` does NOT fire
 * `popstate` — that event is reserved for user-driven history traversal. A
 * `popstate`-only subscription would therefore see the reader's Back button but
 * never this route's own picks, swaps and type changes, which is every write the
 * page actually makes.
 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  /*
   * Guarded the way `use-media-query.ts:66-80` guards its listener, and for the
   * same real gap rather than a theoretical one: older Android WebViews throw on
   * an unguarded addEventListener during commit, taking the page down. If it
   * throws, our own writes still notify through the set above — the reader loses
   * Back-button tracking, not the page.
   */
  try {
    window.addEventListener("popstate", onStoreChange);
  } catch {
    /* Degrade to notifier-only; never take the page down. */
  }
  return () => {
    listeners.delete(onStoreChange);
    try {
      window.removeEventListener("popstate", onStoreChange);
    } catch {
      /* Symmetric with the add guard: teardown must never throw either. */
    }
  };
}

/*
 * Returns a PRIMITIVE, so React's `Object.is` check needs no memoized snapshot —
 * the same reason `use-media-query.ts:82` states for returning `.matches`
 * directly. Returning a parsed object here would mint a fresh identity on every
 * render and loop `useSyncExternalStore` forever.
 */
function getSnapshot(): string {
  return window.location.search;
}

/*
 * The empty query is the honest pre-render answer: there is no server, and
 * `out/compare/index.html` is one document served for every query string. It
 * renders the picker-first empty state, which is exactly what the static
 * document should contain.
 */
function getServerSnapshot(): string {
  return "";
}

/** The live `window.location.search`, re-read on `popstate` and on our own writes. */
export function useUrlQuery(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Replace the current query string in place and notify subscribers.
 *
 * `replaceState` rather than `pushState`: picking, swapping and switching type
 * are refinements of one comparison, not separate destinations, so they must not
 * each cost a Back press to escape.
 *
 * 🔴 RE-ENTRY GUARDED, AND THE GUARD IS LOAD-BEARING. This function notifies the
 * very subscription that renders the component that called it. AC 5's
 * invalid-param cleanup writes during a render pass that detected a bad slug —
 * without the equality check below, that write re-renders, re-detects, re-writes
 * and the page spins forever.
 *
 * Lives here rather than in `compare-url.ts` so that module stays pure and
 * node-testable; every `window` touch on this route is in this file.
 */
export function replaceUrlQuery(search: string): void {
  const next = search.startsWith("?") || search === "" ? search : `?${search}`;
  if (window.location.search === next) {
    return;
  }
  const url = `${window.location.pathname}${next}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
  for (const listener of listeners) {
    listener();
  }
}

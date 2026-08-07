// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { replaceUrlQuery, useUrlQuery } from "@/lib/use-url-query";

/*
 * The query-string store (ruled D1). jsdom supplies `window.location.search` and
 * a working `history.replaceState` natively, which is a large part of why D1
 * chose this mechanism over `useSearchParams`: that one would need an App Router
 * context this project has no precedent for faking, and `vi.mock` has zero
 * occurrences in this repo by policy.
 *
 * 🔴 RTL AUTO-CLEANUP DOES NOT RUN — `vitest.config.ts` has no `globals: true`,
 * so @testing-library/react never registers its own `afterEach(cleanup)`. The
 * explicit call below is mandatory; without it the mounted hooks leak forward
 * and stay subscribed, and a later test sees another test's notifications.
 */

/** Put the document back on a known URL without leaving history entries behind. */
function setSearch(search: string): void {
  window.history.replaceState(null, "", `/compare/${search}`);
}

beforeEach(() => {
  setSearch("");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setSearch("");
});

describe("useUrlQuery", () => {
  /*
   * THE POINT OF THE WHOLE MECHANISM. A mount-effect hook would return "" here
   * and correct itself one frame later — which on this route means the
   * picker-first empty state flashing over a pasted comparison URL (AC 6).
   */
  it("returns the live query string on the FIRST render, not one frame late", () => {
    setSearch("?type=teams&a=mexico&b=argentina");
    const { result } = renderHook(() => useUrlQuery());
    expect(result.current).toBe("?type=teams&a=mexico&b=argentina");
  });

  it("returns the empty string when there is no query", () => {
    const { result } = renderHook(() => useUrlQuery());
    expect(result.current).toBe("");
  });

  /* The reader's Back button — the one write `popstate` does cover. */
  it("re-reads on popstate", () => {
    const { result } = renderHook(() => useUrlQuery());
    expect(result.current).toBe("");
    act(() => {
      setSearch("?type=players&a=solo");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toBe("?type=players&a=solo");
  });

  /*
   * 🔴 THE REASON THE NOTIFIER SET EXISTS. `history.replaceState` does NOT fire
   * `popstate`, so a popstate-only subscription would see the Back button but
   * never this route's own picks, swaps and type changes — i.e. every write the
   * page actually makes. If this test fails, the picker updates the URL and the
   * comparison below it does not move.
   */
  it("re-reads on our own replaceState write, which fires no popstate", () => {
    const { result } = renderHook(() => useUrlQuery());
    act(() => {
      replaceUrlQuery("?type=matches&a=m074-germany-paraguay");
    });
    expect(result.current).toBe("?type=matches&a=m074-germany-paraguay");
    expect(window.location.search).toBe("?type=matches&a=m074-germany-paraguay");
  });

  it("stops notifying once unmounted", () => {
    const { result, unmount } = renderHook(() => useUrlQuery());
    unmount();
    act(() => {
      replaceUrlQuery("?type=teams&a=mexico");
    });
    expect(result.current).toBe("");
  });
});

describe("replaceUrlQuery", () => {
  it("writes the query and leaves the path alone", () => {
    replaceUrlQuery("?type=teams&a=mexico");
    expect(window.location.pathname).toBe("/compare/");
    expect(window.location.search).toBe("?type=teams&a=mexico");
  });

  it("accepts a query string with or without the leading question mark", () => {
    replaceUrlQuery("type=teams&a=mexico");
    expect(window.location.search).toBe("?type=teams&a=mexico");
  });

  /*
   * 🔴 THE RE-ENTRY GUARD (AC 5). The invalid-param cleanup writes DURING the
   * render pass that detected the bad slug, and this function notifies the very
   * subscription that renders that component. Without the equality check the
   * sequence is write → notify → render → detect → write, forever.
   *
   * Asserted on `replaceState` itself rather than on a render count:
   * `useSyncExternalStore` already dedupes by `Object.is` over the returned
   * primitive, so a render-count probe would pass even with the guard removed
   * and would prove nothing.
   */
  it("does not write again when the query is already what we would write", () => {
    setSearch("?type=teams&a=mexico");
    const spy = vi.spyOn(window.history, "replaceState");
    replaceUrlQuery("?type=teams&a=mexico");
    expect(spy).not.toHaveBeenCalled();
  });

  it("does write when the query genuinely differs", () => {
    setSearch("?type=teams&a=mexico");
    const spy = vi.spyOn(window.history, "replaceState");
    replaceUrlQuery("?type=teams&a=argentina");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  /* Clearing back to the picker-first empty state is a legal write, not a no-op. */
  it("can clear the query entirely", () => {
    setSearch("?type=teams&a=mexico");
    replaceUrlQuery("");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/compare/");
  });

  /*
   * `replaceState` rather than `pushState`: picking, swapping and switching type
   * are refinements of ONE comparison, not separate destinations, so they must
   * not each cost a Back press to escape.
   */
  it("replaces rather than pushes, so history does not grow", () => {
    const before = window.history.length;
    replaceUrlQuery("?type=teams&a=mexico");
    replaceUrlQuery("?type=teams&a=argentina");
    expect(window.history.length).toBe(before);
  });
});

// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { anchorNonce, stripHashPrefix, useAnchorHit } from "@/lib/use-anchor-nonce";

/*
 * ═══ THE DEEP-LINK SIGNAL, PINNED IN ISOLATION (3.8 code review) ═══
 *
 * Story 3.8 extracted this hook out of `TournamentHub` and shipped it with NO test
 * file of its own, while its own docblock calls it "the one subtle thing in this
 * codebase that has already been got wrong once" — and D3's stated reason for
 * moving it into `lib/` was that a pure module is testable without the component
 * graph. Its only coverage was indirect, through `MatchDeepLink.test.tsx`, whose
 * own comments concede that jsdom fires a `hashchange` where a real browser fires
 * none — i.e. the harness deviates from reality on precisely the case the hook
 * exists for.
 *
 * Every guard in the capture-phase click listener is load-bearing, and every one
 * of them is exercised here ONE AT A TIME. A guard that stops firing is a reader
 * whose closed disclosure re-opens itself behind them.
 */

const PATH = "/matches/m001";

function setPath(hash: string): void {
  window.history.replaceState(null, "", `${PATH}${hash}`);
}

/** An in-page anchor, in the document, naming the fragment the page is already on. */
function sameFragmentLink(hash: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `${PATH}${hash}`;
  document.body.appendChild(link);
  return link;
}

/**
 * jsdom performs the navigation for a real click and logs "Not implemented" for a
 * cross-origin one. A BUBBLE-phase cancel stops that without hiding anything from
 * the hook: capture always precedes bubble, so the listener under test has already
 * run and has already seen `defaultPrevented === false`.
 */
function withNavigationCancelled(run: () => void): void {
  const cancel = (event: Event) => event.preventDefault();
  document.addEventListener("click", cancel);
  try {
    run();
  } finally {
    document.removeEventListener("click", cancel);
  }
}

beforeEach(() => {
  setPath("");
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  setPath("");
});

describe("stripHashPrefix — the ONE stripping rule (code review)", () => {
  it("removes a LEADING # only, never one further in", () => {
    /*
     * The bug this replaced: `hash.replace("#", "")` removes the FIRST `#`
     * anywhere, so the two modules that parse this route's fragments disagreed on
     * any string carrying a second one.
     */
    expect(stripHashPrefix("#shot-maps-shots")).toBe("shot-maps-shots");
    expect(stripHashPrefix("shot-maps-shots")).toBe("shot-maps-shots");
    expect(stripHashPrefix("")).toBe("");
    expect(stripHashPrefix("#a#b"), "only the leading # is stripped").toBe("a#b");
    expect(stripHashPrefix("a#b"), "no leading # means no change").toBe("a#b");
  });
});

describe("useAnchorHit — reading the fragment", () => {
  it("reads the fragment at MOUNT, because the target did not exist at navigation", () => {
    setPath("#shot-maps-shots");
    const { result } = renderHook(() => useAnchorHit());
    expect(result.current?.id).toBe("shot-maps-shots");
    expect(result.current?.nonce).toBe(1);
  });

  it("reports NO hit when there is no fragment at all", () => {
    const { result } = renderHook(() => useAnchorHit());
    expect(result.current).toBeNull();
  });

  it("mints a FRESH OBJECT per read, which is what makes a re-click observable", () => {
    /*
     * Load-bearing, and the hook's docblock says so: a same-fragment re-click
     * produces a new `hit` with the SAME id, so an identity comparison downstream
     * re-fires where an `id` comparison would not. Do not memoise on `id`.
     */
    setPath("#shot-maps-shots");
    const { result } = renderHook(() => useAnchorHit());
    const first = result.current;
    const link = sameFragmentLink("#shot-maps-shots");
    withNavigationCancelled(() => {
      act(() => {
        link.click();
      });
    });
    expect(result.current).not.toBe(first);
    expect(result.current?.id).toBe("shot-maps-shots");
    expect(result.current?.nonce).toBe((first?.nonce ?? 0) + 1);
  });

  it("follows a hashchange to a new fragment", () => {
    setPath("#shot-maps-shots");
    const { result } = renderHook(() => useAnchorHit());
    act(() => {
      setPath("#defensive-actions-table");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current?.id).toBe("defensive-actions-table");
  });
});

describe("useAnchorHit — the capture-phase click guards", () => {
  /** Renders the hook on `hash`, clicks `link` with `init`, returns the nonce delta. */
  function nonceDeltaFor(hash: string, buildLink: () => HTMLAnchorElement, init: MouseEventInit) {
    setPath(hash);
    const { result } = renderHook(() => useAnchorHit());
    const before = result.current?.nonce ?? 0;
    const link = buildLink();
    withNavigationCancelled(() => {
      act(() => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
      });
    });
    return (result.current?.nonce ?? 0) - before;
  }

  it("fires for a plain primary click on the SAME fragment", () => {
    // The baseline every guard below is measured against.
    expect(
      nonceDeltaFor("#shot-maps-shots", () => sameFragmentLink("#shot-maps-shots"), { button: 0 })
    ).toBe(1);
  });

  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
  ])("does NOT fire for a %s click — that opens a new tab, not this one", (_label, modifier) => {
    /*
     * CODE REVIEW. Without this guard a Ctrl-click opened a new tab AND re-opened,
     * in the tab the reader was still looking at, a disclosure they had closed.
     */
    expect(
      nonceDeltaFor("#shot-maps-shots", () => sameFragmentLink("#shot-maps-shots"), {
        button: 0,
        ...modifier,
      })
    ).toBe(0);
  });

  it("does NOT fire for a non-primary button (middle-click opens a new tab too)", () => {
    expect(
      nonceDeltaFor("#shot-maps-shots", () => sameFragmentLink("#shot-maps-shots"), { button: 1 })
    ).toBe(0);
  });

  it("does NOT fire when the navigation was already cancelled upstream", () => {
    /*
     * Registered on document CAPTURE before the hook's own listener, so it runs
     * first and the hook sees `defaultPrevented === true`. A handler that has
     * cancelled the navigation has cancelled the thing this listener observes.
     */
    setPath("#shot-maps-shots");
    const cancelFirst = (event: Event) => event.preventDefault();
    document.addEventListener("click", cancelFirst, true);
    try {
      const { result } = renderHook(() => useAnchorHit());
      const before = result.current?.nonce ?? 0;
      const link = sameFragmentLink("#shot-maps-shots");
      act(() => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      });
      expect(result.current?.nonce ?? 0).toBe(before);
    } finally {
      document.removeEventListener("click", cancelFirst, true);
    }
  });

  it("does NOT fire for a DIFFERENT fragment — hashchange owns that case", () => {
    expect(
      nonceDeltaFor("#shot-maps-shots", () => sameFragmentLink("#shot-maps-crosses"), { button: 0 })
    ).toBe(0);
  });

  it("does NOT fire for a link with no fragment at all", () => {
    expect(
      nonceDeltaFor("#shot-maps-shots", () => sameFragmentLink(""), { button: 0 })
    ).toBe(0);
  });

  it("does NOT fire for a link on a DIFFERENT route", () => {
    expect(
      nonceDeltaFor("#shot-maps-shots", () => {
        const link = document.createElement("a");
        link.href = `/matches/m002#shot-maps-shots`;
        document.body.appendChild(link);
        return link;
      }, { button: 0 })
    ).toBe(0);
  });

  it("does NOT fire for a CROSS-ORIGIN link whose path and fragment coincide", () => {
    /*
     * CODE REVIEW. `pathname` and `hash` can both match on another origin, and a
     * click leaving the site is not an in-page navigation.
     */
    expect(
      nonceDeltaFor("#shot-maps-shots", () => {
        const link = document.createElement("a");
        link.href = `https://elsewhere.example.com${PATH}#shot-maps-shots`;
        document.body.appendChild(link);
        return link;
      }, { button: 0 })
    ).toBe(0);
  });

  it("finds the anchor from a click on a child of it", () => {
    // `closest("a[href]")` — readers click the label, not the <a> box.
    setPath("#shot-maps-shots");
    const { result } = renderHook(() => useAnchorHit());
    const before = result.current?.nonce ?? 0;
    const link = sameFragmentLink("#shot-maps-shots");
    const inner = document.createElement("span");
    link.appendChild(inner);
    withNavigationCancelled(() => {
      act(() => {
        inner.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      });
    });
    expect(result.current?.nonce ?? 0).toBe(before + 1);
  });

  it("removes BOTH listeners on unmount", () => {
    setPath("#shot-maps-shots");
    const { result, unmount } = renderHook(() => useAnchorHit());
    const before = result.current?.nonce ?? 0;
    unmount();
    const link = sameFragmentLink("#shot-maps-shots");
    withNavigationCancelled(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current?.nonce ?? 0).toBe(before);
  });
});

describe("anchorNonce — the per-anchor lookup", () => {
  it("returns the hit's nonce for the addressed anchor and 0 for every other", () => {
    const hit = { id: "shot-maps-shots", nonce: 4 };
    expect(anchorNonce(hit, "shot-maps-shots")).toBe(4);
    expect(anchorNonce(hit, "shot-maps-crosses")).toBe(0);
  });

  it("returns 0 for a null hit — which openNonce reads as never", () => {
    expect(anchorNonce(null, "shot-maps-shots")).toBe(0);
  });
});

// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NEAR_VIEWPORT_MARGIN, useInView } from "@/lib/use-in-view";

/*
 * Story 2.19 Task 5.8. The viewport gate keeps an already-code-split chart off
 * the arrival critical path — 370 kB of recharts on the Match Dashboard, for a
 * figure whose top edge is 600 px below the fold.
 *
 * THE TEST THAT MATTERS MOST IS THE FIRST ONE. jsdom implements no
 * `IntersectionObserver`, so if this gate failed CLOSED every existing render
 * test of every gated chart would still pass — they render the fallback and
 * assert nothing about it — while the real page shipped a permanently blank
 * figure to any browser without the API. It fails OPEN, and this pins that.
 */

/*
 * The i18n gate (`react/jsx-no-literals`) bans bare string children in JSX
 * everywhere, tests included — hoisting them into consts is the shipped idiom.
 */
const CONTENT = "content";
const PLACEHOLDER = "placeholder";

function Gated() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="gate">
      {inView ? <span>{CONTENT}</span> : <span>{PLACEHOLDER}</span>}
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useInView", () => {
  it("opens IMMEDIATELY when the environment has no IntersectionObserver", () => {
    expect(typeof IntersectionObserver).not.toBe("function");
    render(<Gated />);
    expect(screen.getByText(CONTENT)).toBeDefined();
  });

  it("holds the placeholder until the observer reports an intersection", () => {
    const observed: Element[] = [];
    let fire: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        fire = callback;
      }
      observe(node: Element) {
        observed.push(node);
      }
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    render(<Gated />);
    expect(screen.getByText(PLACEHOLDER)).toBeDefined();
    expect(observed).toHaveLength(1);

    // A callback that reports nothing intersecting must not open the gate.
    act(() => fire?.([{ isIntersecting: false }]));
    expect(screen.getByText(PLACEHOLDER)).toBeDefined();
  });

  it("latches open and disconnects — a chart scrolled past is not unmounted", () => {
    let fire: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        fire = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    render(<Gated />);
    act(() => fire?.([{ isIntersecting: true }]));
    expect(screen.getByText(CONTENT)).toBeDefined();
    expect(disconnect).toHaveBeenCalled();

    // Reporting "gone" afterwards must NOT close it: unmounting a figure the
    // reader has scrolled past destroys its cursor state and re-pays the mount.
    act(() => fire?.([{ isIntersecting: false }]));
    expect(screen.getByText(CONTENT)).toBeDefined();
  });

  it("passes the rootMargin through, so the chunk lands before the reader does", () => {
    const seen: (IntersectionObserverInit | undefined)[] = [];
    class FakeObserver {
      constructor(_callback: unknown, options?: IntersectionObserverInit) {
        seen.push(options);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    render(<Gated />);
    expect(seen[0]?.rootMargin).toBe(NEAR_VIEWPORT_MARGIN);
    // A zero margin would load the chart only once it is already on screen,
    // which is a visible pop rather than a deferral.
    expect(Number.parseInt(NEAR_VIEWPORT_MARGIN, 10)).toBeGreaterThan(0);
  });
});

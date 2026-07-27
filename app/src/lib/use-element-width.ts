"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * Measured layout for the pitch panels (Story 2.7 Task 5).
 *
 * Why measured rather than a scaling viewBox (ruled decision 5): the >=44 px
 * hit floor (UX-DR15) and the marker radius are CSS-px obligations. A viewBox
 * that scales with its container makes 1 unit != 1 px at an unknown ratio, so a
 * 44-unit threshold silently becomes 31 px on a 288 px-wide phone — in exactly
 * the viewport the floor exists to protect. Measuring once and doing all layout
 * arithmetic in px makes the floor exact at every width, and keeps markers a
 * constant legible size instead of shrinking on the smallest screens. The SVG
 * therefore renders width={W} height={H} viewBox="0 0 W H": one unit is one px,
 * by construction.
 *
 * ResizeObserver is baseline in every supported evergreen browser, and it is
 * still guarded — the same posture use-media-query.ts takes with matchMedia. A
 * browser that throws here must degrade to the fallback width, never blank the
 * route.
 */

/**
 * Observe an element's content-box width in CSS px.
 *
 * Returns a callback ref and the current width. The ref is a callback rather
 * than an object ref because the observed node mounts and unmounts with the
 * `<md` team selector and with TacticalSection's lazy content — an effect keyed
 * on a `.current` that React never re-renders for would observe nothing.
 */
export function useElementWidth(
  fallbackPx: number
): [(node: HTMLElement | null) => void, number] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(fallbackPx);

  useEffect(() => {
    if (node === null) {
      return;
    }

    // Measure synchronously on mount so the first paint is already close;
    // clientWidth is the content box, matching what the observer reports.
    function measure(target: HTMLElement) {
      const next = target.clientWidth;
      if (next > 0) {
        setWidth(next);
      }
    }
    measure(node);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    let observer: ResizeObserver | null = null;
    try {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const contentBox = entry.contentBoxSize?.[0];
          const next = contentBox ? contentBox.inlineSize : entry.contentRect.width;
          if (next > 0) {
            setWidth(next);
          }
        }
      });
      observer.observe(node);
    } catch {
      observer = null;
    }

    return () => {
      try {
        observer?.disconnect();
      } catch {
        // A disconnect that throws must not take the unmount down with it.
      }
    };
  }, [node]);

  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);
  return [ref, width];
}

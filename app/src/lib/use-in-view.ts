"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * "Has this element come near the viewport yet?" — the gate that keeps an
 * ALREADY-CODE-SPLIT chart off the arrival critical path (Story 2.19 Task 5.8,
 * ruled D15).
 *
 * WHY IT EXISTS, measured rather than assumed. Every chart in this app is
 * already behind `next/dynamic` (Story 2.15 D1 collapsed them onto one barrel
 * so there is exactly one recharts chunk). `next/dynamic` defers the DOWNLOAD,
 * not the MOUNT: a section that is expanded on arrival mounts its chart in the
 * first client render, so the chunk is requested immediately and the browser
 * parses it before the reader has scrolled anywhere near it. On the Match
 * Dashboard at 412 px that is 370 kB of recharts, raw, for a figure whose top
 * edge sits at y=1421 under an 823 px viewport — measured, not estimated, and
 * it is a large share of the 1,141 ms of script evaluation ledger L1504 names.
 *
 * ONE-WAY, DELIBERATELY. It latches `true` and disconnects: a chart that has
 * been seen once stays mounted, because unmounting a figure the reader has
 * scrolled past would destroy its cursor state and re-run the whole mount cost
 * on the way back up.
 *
 * NO `IntersectionObserver` MEANS "IN VIEW". jsdom implements none
 * (`CompareChartsSection.tsx:289` already guards on exactly this), so under
 * test — and in any browser without it — the gate opens immediately and the
 * component behaves as it did before this hook existed. A gate that fails
 * CLOSED here would hide charts from every unit test and from any reader whose
 * browser lacks the API, which is the wrong direction to fail in.
 */

/**
 * How far ahead of the viewport a chart starts loading. Generous on purpose:
 * the point is that the chunk is fetched and parsed off the arrival critical
 * path, not that it is fetched as late as possible — a reader who scrolls to
 * the figure should find it already there.
 */
export const NEAR_VIEWPORT_MARGIN = "400px";

/**
 * Returns `[ref, inView]`. Attach `ref` to the element whose visibility gates
 * the work; `inView` latches `true` once it comes within `rootMargin`.
 *
 * A CALLBACK REF, not a `RefObject`: the observed element is usually a
 * placeholder that is REPLACED by the real content, and a callback ref is the
 * only form that is notified when the node it was given goes away.
 */
export function useInView<T extends Element>(
  rootMargin: string = NEAR_VIEWPORT_MARGIN
): readonly [(node: T | null) => void, boolean] {
  const [inView, setInView] = useState(false);
  const disconnect = useRef<(() => void) | null>(null);

  const ref = useCallback(
    (node: T | null) => {
      disconnect.current?.();
      disconnect.current = null;
      if (node === null || inView) {
        return;
      }
      if (typeof IntersectionObserver !== "function") {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
            disconnect.current = null;
          }
        },
        { rootMargin }
      );
      observer.observe(node);
      disconnect.current = () => observer.disconnect();
    },
    [inView, rootMargin]
  );

  // The node may be unmounted without the callback ref firing with `null` —
  // React does call it, but an unmount of the whole tree during a navigation
  // races with it. Cheap insurance; an already-disconnected observer is inert.
  useEffect(() => () => disconnect.current?.(), []);

  return [ref, inView] as const;
}

"use client";

import { useId, useState, type ReactNode } from "react";

import type { DictionaryKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

/** Separator glyphs are module consts, never bare JSX literals (i18n gate). */
const LABEL_SEPARATOR = ": ";

/*
 * The data-table alternative every pitch panel carries (Task 7, UX-DR9 /
 * NFR-2): a disclosure revealing the equivalent real <table>. The table itself
 * is the caller's — this component owns only the control, the region and the
 * lazy mount.
 *
 * Mirrors KeyStatisticsSection's disclosure exactly, including the two things
 * prior reviews patched:
 *   - the label key is built in a VARIABLE, because {t(cond ? "a" : "b")} trips
 *     the i18n gate;
 *   - aria-controls is set ONLY while the region is mounted, because a static
 *     one dangles in the collapsed default state. That has been patched twice
 *     already (TacticalSection, KeyStatisticsSection) — this is not the third.
 */
export function ViewDataDisclosure({
  children,
  trailing,
  panelTitle,
  surface = "pitch",
  openNonce = 0,
}: {
  children: ReactNode;
  /**
   * Which canvas this disclosure sits on (Story 2.6 ruled decision 11).
   *
   * `"pitch"` (the default, so the one pre-existing call site is untouched)
   * keeps `text-ink-on-pitch` — theme-invariant near-white, correct on the
   * deep-green pitch and justified in the class comment below.
   *
   * `"canvas"` is for a THEME-AWARE surface: the Momentum Timeline's
   * --surface-raised card, where that same near-white #f2f5f7 on #ffffff
   * computes 1.10:1 — an invisible control. It swaps the ink to
   * --ink-primary and changes nothing else; the underline stays, because the
   * control must still read as interactive without a second hue.
   *
   * A private copy of this component was the rejected alternative: it exists
   * precisely so the aria-controls-only-while-mounted fix below is not
   * re-broken a third time.
   */
  surface?: "pitch" | "canvas";
  /**
   * The owning panel's already-resolved title. It does NOT change the visible
   * label — every panel still reads "Ver los datos", which is the one canonical
   * control string — but it disambiguates the ACCESSIBLE name, so a reader
   * listing the page's buttons gets "Ver los datos: Mapa de tiros" and
   * "Ver los datos: Mapa de centros" instead of the same string twice.
   */
  panelTitle: string;
  /**
   * Content sharing the trigger's row — the pitch panel's permanent attribution
   * caption. It sits beside the control rather than inside the region on
   * purpose: the caption must survive a screenshot taken with the table closed
   * (UX-DR21).
   */
  trailing?: ReactNode;
  /**
   * Increments when the CALLER wants this region opened; `0`/absent = never.
   *
   * Story 2.19's D15 puts the Tournament Hub's 21 section tables behind this
   * control (SM-C2), and that route ships UX-DR18 deep links straight at those
   * sections — `.../#standings-group-a`. A disclosure that a shared link cannot
   * open is exactly the defect ledger L1553/L1886 files against the match route,
   * and this story is not allowed to MINT a new instance of it while
   * re-deferring the old one.
   *
   * A NONCE and not a `defaultOpen` boolean, on `TacticalSection.focusNonce`'s
   * established idiom: the hash can only be read in an effect (reading
   * `window.location` during render is a hydration mismatch), and a nonce lets
   * a SECOND in-page navigation to the same anchor re-open a region the reader
   * has since closed. A boolean prop could not, because its value would not
   * change.
   */
  openNonce?: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const regionId = useId();

  /*
   * ADJUSTED DURING RENDER, not in an effect — React's documented
   * "adjusting state when a prop changes" pattern
   * (react.dev/learn/you-might-not-need-an-effect). An effect would re-render
   * the closed region first and the open one second, which is a visible flash
   * on the Hub's twenty-one sections; it is also what
   * `react-hooks/set-state-in-effect` exists to reject, and this file is
   * compiled under `--max-warnings 0`.
   */
  const [seenNonce, setSeenNonce] = useState(0);
  if (openNonce !== seenNonce) {
    setSeenNonce(openNonce);
    if (openNonce > 0) {
      setOpen(true);
    }
  }

  const labelKey: DictionaryKey = open ? "viz.hideData" : "viz.viewData";
  // Built into an identifier: t() has no interpolation and aria-label is gated.
  const accessibleName = `${t(labelKey)}${LABEL_SEPARATOR}${panelTitle}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          aria-label={accessibleName}
          onClick={() => setOpen((value) => !value)}
          /*
           * On-pitch ink: this control sits on the theme-invariant pitch, where
           * the light --accent-cyan computes 2.28:1. Underlined so the control
           * still reads as interactive without a second hue on the green.
           */
          className={cn(
            "flex min-h-11 items-center underline underline-offset-4 type-title",
            surface === "canvas" ? "text-ink-primary" : "text-ink-on-pitch"
          )}
        >
          {t(labelKey)}
        </button>
        {trailing}
      </div>
      {open ? (
        /*
         * Wide at 390px: the table scrolls INSIDE its own container, never the
         * page (UX-DR16's data-table exception).
         */
        <div id={regionId} className="mt-tile-gap w-full overflow-x-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
}

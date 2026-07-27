"use client";

import { useId, useState, type ReactNode } from "react";

import type { DictionaryKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-provider";

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
}: {
  children: ReactNode;
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
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const regionId = useId();
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
          className="flex min-h-11 items-center underline underline-offset-4 type-title text-ink-on-pitch"
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

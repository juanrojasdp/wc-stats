"use client";

import { useId, useState, type ReactNode } from "react";

import type { DictionaryKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-provider";

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
}: {
  children: ReactNode;
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 items-center type-title text-accent-cyan"
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

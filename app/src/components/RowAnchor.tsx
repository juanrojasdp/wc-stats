"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { MIN_HIT_PX } from "@/viz/marker-layout";
import { cn } from "@/lib/utils";

/*
 * THE STRETCHED ROW ANCHOR, hoisted (Story 2.16, ruled D4).
 *
 * IT EXISTED TWICE PRIVATELY before this file: `TournamentHub.tsx` minted it for
 * Story 2.12's standings and results rows, and `PlayerMatchesSection.tsx` copied
 * it for Story 2.15's per-match table. Story 2.11a decision 1 is binding —
 * "every private copy is deleted" — and this route would have been the third, so
 * the pattern is hoisted here instead.
 *
 * ONLY `TournamentHub`'s COPY WAS REPOINTED, and that is a coordination outcome
 * rather than a preference. Story 2.16's D4 makes the hoist conditional on
 * `git status --porcelain`: at Task 1.3 `2-15-player-profile` was `in-progress`
 * in a concurrent session and `PlayerMatchesSection.tsx` was untracked in the
 * tree, so touching it would have been a merge collision on a file another
 * session is actively writing. The remaining copy is FILED for Story 2.17 rather
 * than left undisclosed.
 *
 * ONE ANCHOR PER ROW, NEVER ONE PER CELL. Story 2.15's D2 reversed a draft on
 * exactly this and the four grounds all still hold: 2.13 ruling 3 puts a table
 * CELL on different footing from a lineup name; WCAG 2.4.4 (thirteen links per
 * row, same href, different visible text); the keyboard cost (~104 tab stops in
 * one table with no bypass); and `text-accent-cyan` is BOTH the house link
 * colour and `DataTable`'s active-sort head cue, so per-cell links would erase
 * the sort cue outright.
 *
 * `after:absolute after:inset-0` over a `<tr className="relative">` makes the
 * WHOLE ROW the target. The `relative` is the CALLER's job and is not optional:
 * the pseudo-element resolves against the nearest positioned ancestor, so
 * without it the overlay covers the page.
 *
 * THE FOCUS RING IS THE ANCHOR'S OWN BOX, and that is ruled (Story 2.16 Q2,
 * taken by Juan). The ring outlines the anchor (measured 165×44) rather than the
 * row (1104×57). A row-wide `tr:has(a:focus-visible)` treatment either paints a
 * second indicator alongside the native one or requires suppressing the native
 * ring with `outline-none` — a house prohibition that has already cost two
 * review patches — and DESIGN.md specifies no row-focus treatment to copy. The
 * anchor ring is visible, unobscured, and meets WCAG 2.4.7 / 2.4.11 in both
 * themes, so NO `outline-none` appears in this file.
 *
 * `MIN_HIT_PX` is IMPORTED, never re-declared, so UX-DR15's 44 px floor has one
 * definition in the codebase.
 */

/** The separator glyph is a module const — bare JSX literals trip the i18n gate. */
const SPACE = " ";

/**
 * The base geometry every consumer shares. `flex-wrap` and the inline gap come
 * from `TournamentHub`'s standings rows, where a team cell carries a crest code
 * and a name that must wrap together at 320 px.
 */
const ROW_ANCHOR_CLASS =
  "flex min-w-0 flex-wrap items-center gap-x-1.5 after:absolute after:inset-0 hover:underline";

export interface RowAnchorProps {
  href: string;
  /**
   * The `sr-only` prefix naming what the row links to ("Ver el partido").
   *
   * A SPAN RATHER THAN AN `aria-label`, for two reasons that both matter:
   * `aria-label` is one of the sixteen gated prop names, and it would REPLACE
   * the visible cell text in the accessible name rather than prefix it, costing
   * WCAG 2.5.3 Label in Name.
   */
  accessiblePrefix: string;
  /**
   * Defaults to `false`. Next prefetches every `<Link>` entering the viewport,
   * so an 8-row table fires eight route requests on load and re-fires them on
   * every re-order — measured by Story 2.13 as `48 → 75` resource entries across
   * one sort pass. Every shipped consumer wants it off; the prop exists so a
   * future caller must opt IN explicitly rather than inherit Next's default by
   * omission.
   */
  prefetch?: boolean;
  children: ReactNode;
  /** Extra classes, merged after the base geometry. */
  className?: string;
}

export function RowAnchor({
  href,
  accessiblePrefix,
  prefetch = false,
  children,
  className,
}: RowAnchorProps) {
  /*
   * THE TRAILING SPACE IS DELIBERATE (Story 2.12's finding, re-confirmed by
   * 2.15). The accessible-name algorithm inserts a space between element
   * children, but the DOM text is concatenated raw — so the name read back out
   * of the live DOM was "Ver el equipoMexico", and whether a reader hears
   * "equipo Mexico" or "equipoMexico" would depend on the engine implementing
   * that clause. An explicit separator makes it true in every engine rather than
   * true in the spec.
   */
  const prefix = `${accessiblePrefix}${SPACE}`;
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(ROW_ANCHOR_CLASS, className)}
      style={{ minHeight: MIN_HIT_PX }}
    >
      <span className="sr-only">{prefix}</span>
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

/*
 * ═══════════ THE FEATURE BADGE (Story 3.9, D1; DESIGN.md → Components) ══════
 *
 * One card in the landing page's badge grid: a label, a supporting line, and
 * nothing else. Eight of them render on `/` — the emphasised *Comparar* in
 * zone 2 and the remaining seven in zone 3's grid.
 *
 * ═══════════ IT IS A LINK, AND THE WHOLE CARD IS THE LINK ═══════════
 *
 * A real `<a href>` via `next/link`, so middle-click and open-in-new-tab work
 * and no badge is a JavaScript-only affordance (D1). The whole card is the
 * target, which buys the three things the contract asks for at once:
 *
 *   · ONE TAB STOP per badge — a card with a separately focusable title and
 *     "read more" is two stops to one destination, and eight of those is
 *     sixteen stops through a page with eight ideas on it.
 *   · ONE ACCESSIBLE NAME, and it is the VISIBLE LABEL (WCAG 2.5.3, Label in
 *     Name). No `aria-label` narrows it or extends it — a speech-input user
 *     saying "Comparar" must activate the control that reads "Comparar".
 *   · The supporting line is inside the same anchor, so it is announced as part
 *     of the link rather than orphaned beside it. It is NOT folded into the
 *     accessible name by `aria-label`: that would break Label in Name in the
 *     other direction.
 *
 * 🔴 `href` MUST END IN A SLASH. `next.config.ts` sets `trailingSlash: true`, so
 * a slash-less href is a 301 hop on the static export — on every click, from the
 * site's entry page. The one fragment href in the set is `/tournament/#results`:
 * the slash goes BEFORE the `#`.
 *
 * ═══════════ EMPHASIS IS SIZE, POSITION AND SURFACE — NEVER COLOUR ══════════
 *
 * WCAG 1.4.1 (Use of Colour): the emphasised variant must not encode its
 * "featured" meaning in hue alone, or a screen-reader user and a monochrome
 * reader both lose it. So `emphasised` changes:
 *
 *   · POSITION — it is in zone 2, on its own row above the grid (the caller's
 *     job, not this component's);
 *   · SIZE — a larger label and more padding;
 *   · SURFACE — a 2 px top border.
 *
 * Render the page in greyscale and the emphasis survives. Nothing here carries
 * a "featured" meaning that is announced only visually, which is why there is no
 * `aria-*` badge on it either: the reader is not missing anything that needs
 * describing.
 */
export function FeatureBadge({
  href,
  label,
  support,
  emphasised = false,
}: {
  href: string;
  /**
   * The visible label AND the accessible name. Already resolved by the caller —
   * `label` is a gated prop name under `src/components/**`, so the caller passes
   * a `useT()` result rather than a key, exactly as `EmptyStatePanel`'s
   * `headline` does.
   */
  label: string;
  /** The supporting line under the label. One sentence; numbers carry it. */
  support: string;
  /** Zone 2's single badge. See the colour-independence note above. */
  emphasised?: boolean;
}) {
  return (
    <Link
      href={href}
      /*
       * PREFETCH LEFT AT ITS DEFAULT, deliberately, and this is the one place on
       * the site where that is right. `LeaderboardsRegion` turns prefetch OFF
       * for its teaser links because those are build-time markup that would fire
       * dozens of requests on page load before the reader has done anything.
       * These eight are the landing page's ENTIRE purpose — the reader is here
       * to pick one — and eight prefetches of eight small documents is the case
       * the default exists for. `/` itself fetches no artifact (D5b), so there
       * is nothing for them to contend with.
       */
      className={cn(
        /*
         * `min-h-11` is the ≥44 px target UX-DR15 requires; the padding takes it
         * well past that. `block` and not `flex`: the two lines stack, and a
         * flex column here would add nothing but a second way to be wrong.
         */
        "block min-h-11 rounded-md border border-hairline bg-surface-raised",
        "hover:border-ink-secondary focus-visible:border-ink-secondary",
        emphasised ? "border-t-2 border-t-ink-primary p-5" : "p-4"
      )}
    >
      <span
        className={cn(
          "block text-ink-primary",
          emphasised ? "type-headline" : "type-title"
        )}
      >
        {label}
      </span>
      <span className="mt-1 block type-caption text-ink-secondary">{support}</span>
    </Link>
  );
}

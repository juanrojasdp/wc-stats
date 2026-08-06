"use client";

import type { MatchResult } from "@/lib/contract/contract-types";
import { matchResultLetterKey, matchResultWordKey } from "@/lib/hub-model";
import { useT } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

/*
 * The result chip (Story 2.12, AC 3) — DESIGN's {components.result-chip}, and
 * the FIRST consumer of the four `--result-*` tokens, which have shipped in
 * globals.css since Story 2.1 with zero call sites. No colour is invented here.
 *
 * ALWAYS FILL + LETTER, NEVER COLOUR-ONLY (UX-DR7 family, UX-DR19, and
 * DESIGN.md:290 verbatim). The letter is the redundant channel that makes the
 * chip readable to a reader who cannot separate the three hues; it is not
 * decoration and it is never conditional.
 *
 * NON-INTERACTIVE, and that is load-bearing rather than incidental
 * (EXPERIENCE.md:82): "the row, not the chip, is the link target". The chip
 * sits INSIDE a row whose row-header cell carries a stretched anchor, so a
 * `tabIndex`, a handler or a `<button>` here would mint a second tab stop per
 * row and nest an interactive element inside a link. A plain `<span>` is the
 * whole component.
 *
 * THE LETTER IS KEYED OFF THE `MatchResult` ENUM, NEVER OFF THE LETTER ITSELF.
 * es `D` is *derrota* (loss) and en `D` is *draw* — a shared letter-named key
 * would silently invert every loss into a draw on the language toggle.
 * `i18n.test.ts` pins that divergence.
 */

/**
 * Fill per outcome, both themes. The token pairs are defined twice in
 * globals.css (`:root, .dark` and the light block) and the utility resolves
 * whichever is active, so this map is theme-blind by construction.
 *
 * Ink is `--result-chip-ink`, which INVERTS between themes (#0E1114 dark /
 * #FFFFFF light). Published ratios: 10.68 / 6.35 / 6.66 dark and
 * 5.36 / 5.61 / 5.55 light (DESIGN.md:290) — all six clear 4.5:1, and both
 * halves were re-measured in the browser at this story's Task 9.1.
 */
const FILL: Record<MatchResult, string> = {
  win: "bg-result-win",
  draw: "bg-result-draw",
  loss: "bg-result-loss",
};

export function ResultChip({ result }: { result: MatchResult }) {
  const t = useT();
  return (
    /*
     * The 20px pill is a size, not a hit target: UX-DR15's 44px floor applies
     * to CONTROLS, and this is static content inside a row whose own anchor
     * carries the floor. `leading-none` keeps the letter optically centred at
     * 11px inside a 20px circle.
     */
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full type-label-caps leading-none text-result-chip-ink",
        FILL[result]
      )}
    >
      {/*
       * The letter is the VISUAL redundancy channel and is hidden from the
       * accessibility tree; the word beside it is what is spoken. Leaving both
       * exposed would read "V Victoria" on every one of a form strip's three
       * chips, and a bare letter alone would make the row's accessible name
       * "México V V V" — which is why Task 5.4 requires the spoken form.
       */}
      <span aria-hidden="true">{t(matchResultLetterKey(result))}</span>
      <span className="sr-only">{t(matchResultWordKey(result))}</span>
    </span>
  );
}

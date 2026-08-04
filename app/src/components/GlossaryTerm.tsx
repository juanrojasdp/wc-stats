"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GLOSSARY_GLOSS_KEY,
  glossaryDefinitionKey,
  glossaryTermEnKey,
  glossaryTermEsKey,
  type GlossaryTermId,
} from "@/lib/glossary";
import { useLocale, useT } from "@/lib/i18n-provider";
import { useGlossaryPopover } from "@/lib/use-glossary-popover";

/*
 * A marked glossary term and its definition popover (Story 2.18, AC 2) — the
 * project's FIRST WCAG 1.4.13 surface. `PitchPanel`'s cluster popover is not a
 * precedent: its hover variant is aria-hidden and deliberately unhoverable,
 * while this one contains a Tab-reachable link and must therefore be a real
 * focusable region that survives the pointer leaving the trigger.
 *
 * PROP NAMES ARE CONSTRAINED BY THE GATE, not by taste. `title`, `tooltip`,
 * `label`, `description`, `caption`, `heading`, `text` and `message` are all on
 * the sixteen-name no-restricted-syntax list, and the rule fires on JSX
 * ATTRIBUTES — so a component whose props are named from that set cannot be
 * called with a literal anywhere, and reads as a gate violation waiting to
 * happen. `termId` / `termLang` / `children` are deliberate.
 *
 * The state machine (hover intent, single-open, the two auto-focus contracts)
 * lives in useGlossaryPopover; everything here is markup.
 */

export function GlossaryTerm({
  termId,
  termLang,
  children,
}: {
  termId: GlossaryTermId;
  /**
   * Set when the marked surface word is NOT in the active locale's language —
   * "Línea de momentum" carries an English noun inside Spanish copy, and an
   * unmarked one is read by a Spanish TTS voice as Spanish (decision 13).
   */
  termLang?: "es" | "en";
  /** The exact substring lifted from the copy; falls back to the ruled term. */
  children?: ReactNode;
}) {
  const t = useT();
  const { locale } = useLocale();
  const popover = useGlossaryPopover();
  const contentRef = useRef<HTMLDivElement>(null);

  const esTerm = t(glossaryTermEsKey(termId));
  const enTerm = t(glossaryTermEnKey(termId));
  const activeTerm = locale === "es" ? esTerm : enTerm;
  const counterpartTerm = locale === "es" ? enTerm : esTerm;
  const counterpartLang = locale === "es" ? "en" : "es";
  const counterpartPrefixKey = locale === "es" ? "glossaryPage.enPrefix" : "glossaryPage.esPrefix";

  /*
   * Decision 13: where the two terms are IDENTICAL — the jargon and tooltip
   * rows xG, sprint and momentum — "momentum — en: momentum" is a tautology
   * wearing a lang span that asserts a language change that does not occur. The
   * ruled gloss renders in its place where the table gives one (xG → goles
   * esperados); where it gives none, nothing renders.
   */
  const identical = esTerm === enTerm;
  const glossKey = GLOSSARY_GLOSS_KEY[termId];
  const gloss = identical && glossKey !== undefined ? t(glossKey) : null;

  return (
    <Popover open={popover.open} onOpenChange={popover.onOpenChange} modal={false}>
      <PopoverTrigger asChild>
        {/*
         * The TERM itself is the trigger, never the containing tile
         * (review-accessibility.md §3: "A non-focusable tap target is a 2.1.1
         * fail"). `inline` with no clipping padding, so the hit area is exactly
         * the word inside its line box — the 44px rule cannot apply to a word
         * in running text, and that reading is declared in the Dev Record with
         * the measured numbers rather than assumed. No outline-none: focus
         * comes from the global :focus-visible --ring treatment.
         */}
        <button
          type="button"
          lang={termLang}
          onClick={popover.onTriggerClick}
          onFocus={popover.onTriggerFocus}
          /*
           * Without this the panel a Tab opened stayed open forever once the
           * user tabbed past its link — nothing but Esc or an outside click
           * closed it, so it sat over the content they had moved on to.
           */
          onBlur={popover.onTriggerBlur}
          onPointerEnter={popover.triggerHover.onPointerEnter}
          onPointerLeave={popover.triggerHover.onPointerLeave}
          className="inline cursor-help text-left underline decoration-accent-cyan decoration-dotted underline-offset-2"
        >
          {children ?? activeTerm}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        onPointerEnter={popover.panelHover.onPointerEnter}
        onPointerLeave={popover.panelHover.onPointerLeave}
        onFocusCapture={popover.onPanelFocusCapture}
        onBlurCapture={popover.onPanelBlurCapture}
        /*
         * A HOVER-opened popover that steals focus is a defect: focus enters
         * this panel only by Tab.
         */
        onOpenAutoFocus={(event) => event.preventDefault()}
        /*
         * NOT OPTIONAL. PopoverContentNonModal's default onCloseAutoFocus calls
         * triggerRef.focus() on EVERY close, so a hover elsewhere that times
         * out would yank a keyboard user's focus across the page. Returning
         * focus to the trigger is correct ONLY when focus is inside the panel.
         * (onEscapeKeyDown has no focus semantics — the contract does not
         * belong there.)
         */
        onCloseAutoFocus={(event) => {
          const focusHere =
            popover.focusInsidePanel() ||
            contentRef.current?.contains(document.activeElement) === true;
          if (!focusHere) {
            event.preventDefault();
          }
          /*
           * MUST run after the contract above has read the flag, and must run
           * on EVERY close. Removing a focused node does not fire focusout, so
           * onBlurCapture never sees the panel go away — leaving "focus is
           * inside the panel" latched true for the rest of the instance's life.
           * The next close then took the focus-return branch and yanked focus
           * across the page from wherever the user actually was, which is the
           * exact failure this handler exists to prevent.
           */
          popover.notePanelClosed();
        }}
      >
        {/*
         * asChild wrapping a <span>: PopoverContentImpl sets aria-labelledby
         * ONLY when a Title is present, so a plain styled span would give
         * role="dialog" with no accessible name (an axe aria-dialog-name
         * failure) — but the default Title renders Primitive.h2, and an <h2>
         * inside a match route's section would corrupt the heading outline.
         */}
        <PopoverTitle asChild>
          <span className="type-title text-ink-primary" lang={termLang}>
            {activeTerm}
          </span>
        </PopoverTitle>
        {identical ? null : (
          // Diego's bridge (review-i18n.md §5): a bilingual reader must be able
          // to map the two terms without flipping the entire interface.
          <span className="inline-flex flex-wrap items-baseline gap-1 type-caption text-ink-secondary">
            <span>{t(counterpartPrefixKey)}</span>
            <span lang={counterpartLang}>{counterpartTerm}</span>
          </span>
        )}
        {gloss === null ? null : (
          <span className="type-caption text-ink-secondary">{gloss}</span>
        )}
        {/*
         * NEVER text-ink-muted: it computes 3.30:1 on --surface-overlay, below
         * the 4.5:1 text floor (review-accessibility.md §1).
         */}
        <span className="type-body text-ink-primary">{t(glossaryDefinitionKey(termId))}</span>
        <Link
          href={`/glossary/#${termId}`}
          className="type-caption text-accent-cyan hover:underline"
        >
          {t("glossaryPage.seeMore")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

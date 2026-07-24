"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * One Tactical section shell (Task 3, UX-DR6/UX-DR18). A native
 * <button aria-expanded aria-controls> wrapped by the <h2> — the standard
 * accordion structure, not a vendored Accordion (ruled decision 6): Radix owns
 * its own mount/unmount and animation and would have to be defeated both for
 * the always-expanded ≥lg case and for lazy mounting.
 *
 * Lazy mount, NOT `hidden`: UX-DR6 says expansion lazy-mounts the content, and
 * the pitch panels 2.7-2.9 will mount d3 — nine hidden vizzes is a bill this
 * page must not pay. This is the deliberate opposite of LineupsDisclosure
 * (2.4), which keeps its content in the DOM for crawlable player links.
 *
 * No animation: motion is decorative product-wide and prefers-reduced-motion
 * kills all of it globally, so a transition that only exists for
 * non-reduced-motion users is not worth having.
 */

// aria-hidden glyph — a module const so it is never a literal JSX child (gate).
const CHEVRON = "▸";

export function TacticalSection({
  id,
  title,
  summary,
  collapsible,
  open,
  onToggle,
  focusNonce,
  focusScroll,
  className,
  children,
}: {
  id: string;
  title: string;
  /** Rendered ONLY in the collapsible (<lg) presentation — the desktop mockup shows no summary lines. */
  summary: string | null;
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  /** Increments when the layer wants focus moved into this section; 0 = never. */
  focusNonce: number;
  /** Anchor navigation also scrolls the section into view before focusing. */
  focusScroll: boolean;
  className?: string;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /*
   * Ruled decision 7: focus goes to the revealed content REGION, not the
   * heading. The heading sits inside the always-visible trigger, so focusing
   * it would not move focus into what was revealed; the region carries
   * role="region" + aria-labelledby the heading, so the announcement still
   * names the section.
   *
   * Driven by an explicit nonce from the layer rather than by `open`, so this
   * fires on a user toggle and on anchor auto-expand and NEVER on the ≥lg
   * initial render or on a viewport change that opens every section.
   */
  useEffect(() => {
    if (focusNonce === 0) {
      return;
    }
    if (focusScroll) {
      sectionRef.current?.scrollIntoView();
    }
    // preventScroll only when scrollIntoView already positioned the section:
    // the browser's own focus scroll would otherwise pull the heading off
    // the top of the viewport.
    contentRef.current?.focus({ preventScroll: focusScroll });
  }, [focusNonce, focusScroll]);

  const headingId = `${id}-heading`;
  const contentId = `${id}-content`;
  const summaryId = `${id}-summary`;
  const showSummary = collapsible && summary !== null;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={headingId}
      className={cn("border-t border-hairline pt-5", className)}
    >
      {collapsible ? (
        <>
          <h2 id={headingId} className="type-headline text-ink-primary">
            {/*
             * min-h-11 (≥44px) on the trigger ITSELF, not on a wrapper — the
             * 2.4 review patched exactly that mistake. No outline-none: the
             * global :focus-visible --ring rule is the only focus indicator.
             */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={contentId}
              aria-describedby={showSummary ? summaryId : undefined}
              onClick={onToggle}
              className="flex min-h-11 w-full items-center justify-between gap-tile-gap text-left"
            >
              {title}
              <span
                aria-hidden="true"
                className={cn("type-body text-ink-secondary", open && "rotate-90")}
              >
                {CHEVRON}
              </span>
            </button>
          </h2>
          {showSummary ? (
            <p id={summaryId} className="mt-1 type-body text-ink-secondary">
              {summary}
            </p>
          ) : null}
        </>
      ) : (
        <h2 id={headingId} className="type-headline text-ink-primary">
          {title}
        </h2>
      )}

      {/*
       * Rendered whenever the section is open, INCLUDING for always-expanded
       * sections, so anchor navigation always has a focus target. No
       * scroll-mt-*: the scroll-padding-top on the scrollport (Task 8) covers
       * both fragment navigation and scrollIntoView().
       */}
      {open ? (
        <div
          ref={contentRef}
          id={contentId}
          role="region"
          aria-labelledby={headingId}
          tabIndex={-1}
          className="mt-4"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

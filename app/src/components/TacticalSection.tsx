"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { SectionId } from "@/lib/tactical-sections";
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
  /** The registry union, not `string` — a wrong id must not reach the DOM. */
  id: SectionId;
  /**
   * `ReactNode`, not `string` (Story 2.18 ruled decision 6): a glossary term
   * inside a heading is a focusable popover trigger, which cannot be a plain
   * string. ONLY the two never-collapsible sections may pass a node here — for
   * the other nine `{title}` renders inside the accordion <button> below, and a
   * node containing a trigger would nest interactive content inside a button.
   * The layer enforces that partition; this type cannot.
   */
  title: ReactNode;
  /**
   * The one-line section summary, rendered in the collapsible presentation at
   * EVERY width (the 2.5 review's decision D1 overturned the original
   * "<lg only" reading; the docblock said otherwise until Story 2.18).
   *
   * `ReactNode` for the same reason as `title` — this is where the nine
   * collapsible sections mark their glossary term, outside the trigger.
   */
  summary: ReactNode | null;
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  /*
   * AC 1 and UX-DR6 both say "focus to revealed heading", and that is what
   * this does — matching LineupsDisclosure on the same route, so the page has
   * ONE focus contract rather than two. (The story's ruled decision 7 argued
   * for the content region instead, on the grounds that the heading sits
   * inside the always-visible trigger; the 2.5 review overturned it in favour
   * of the AC's own words. The heading placement is what lets a screen-reader
   * user read forward into what was revealed.)
   *
   * Driven by an explicit nonce from the layer rather than by `open`, so this
   * fires on a user toggle and on anchor auto-expand and NEVER on the initial
   * render or on a viewport change that opens every section.
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
    headingRef.current?.focus({ preventScroll: focusScroll });
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
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="type-headline text-ink-primary"
          >
            {/*
             * min-h-11 (≥44px) on the trigger ITSELF, not on a wrapper — the
             * 2.4 review patched exactly that mistake. No outline-none: the
             * global :focus-visible --ring rule is the only focus indicator.
             */}
            <button
              type="button"
              aria-expanded={open}
              /*
               * Only while the target actually exists. The content is lazily
               * mounted (UX-DR6), so a static aria-controls would point at an
               * absent id in the collapsed state — which is the DEFAULT state
               * below lg — leaving assistive tech a "jump to controlled
               * element" affordance with nowhere to go.
               */
              aria-controls={open ? contentId : undefined}
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
          {/*
           * A <div>, not a <p> (Story 2.18): the summary is where the nine
           * collapsible sections mark their glossary term, and the term's
           * popover panel is a non-portalled Radix <div> that renders as a DOM
           * sibling of its trigger — inside this element. A <div> descendant of
           * a <p> is an invalid content model and trips React's dev-time
           * nesting validation, which would put a console error on every match
           * route. Block-level either way, so the layout and the
           * aria-describedby target are unchanged.
           */}
          {showSummary ? (
            <div id={summaryId} className="mt-1 type-body text-ink-secondary">
              {summary}
            </div>
          ) : null}
        </>
      ) : (
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="type-headline text-ink-primary"
        >
          {title}
        </h2>
      )}

      {/*
       * A plain wrapper, deliberately: the <section> above already carries
       * aria-labelledby and is therefore a NAMED region landmark. Giving this
       * div role="region" with the same aria-labelledby produced a second
       * landmark of identical name inside the first — 22 landmarks for 11
       * sections, and axe's landmark-unique fires on every one. Focus is
       * handled at the heading (see above), so it needs no tabIndex either.
       * The id survives because the trigger's aria-controls points at it.
       */}
      {open ? (
        <div id={contentId} className="mt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

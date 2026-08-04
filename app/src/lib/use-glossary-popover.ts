"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * The glossary popover's open-state machine (Story 2.18, ruled decision 9).
 *
 * WHY IT LIVES IN src/lib RATHER THAN IN glossary-marking.tsx (declared
 * departure from Task 3.4's file placement, same public surface): the marking
 * helpers import GlossaryTerm, and GlossaryTerm needs this hook — putting the
 * hook beside the helpers makes those two modules import each other. src/lib
 * already houses a client hook for exactly this reason (use-media-query.ts).
 *
 * WHAT RADIX DOES NOT DO. Radix Popover has no hover trigger and no hover
 * intent; `Popover.Trigger` composes its own `onOpenToggle` into onClick
 * unconditionally, so a mouse user who hovers (open) and then clicks gets a
 * toggle to CLOSED, and on touch the pointerenter-then-click sequence
 * double-flips. This hook owns every state transition; the trigger's click is
 * intercepted with preventDefault(), which is what makes Radix skip its own
 * composed handler (composeEventHandlers checks defaultPrevented).
 *
 * WCAG 1.4.13 — the panel is HOVERABLE and PERSISTENT. It closes only when the
 * pointer has left BOTH the trigger and the panel and stayed out past the grace
 * timer, or on Esc, or on an outside click. A pointer travelling from the term
 * to the "see in the glossary" link must not close it, and that trip crosses a
 * gap the popper's side offset creates.
 */

/*
 * The grace window a pointer has to cross from the trigger to the panel. Short
 * enough that a deliberate mouse-away feels immediate, long enough to survive
 * the sideOffset gap at a normal pointer speed.
 */
const CLOSE_GRACE_MS = 180;

/*
 * PAGE-WIDE SINGLE OPEN (UX-DR15 bans an overlay stack deeper than one), held
 * in a module-scope Set of close callbacks rather than a new React Context —
 * "do not add a new Context" is a standing rule, and @/lib/i18n.ts's
 * `reportedMissing` is the shipped precedent for module-scope state of exactly
 * this shape. Opening runs every OTHER registered closer first.
 */
const openPopoverClosers = new Set<() => void>();

export interface GlossaryPopoverHandlers {
  onPointerEnter: (event: { pointerType: string }) => void;
  onPointerLeave: (event: { pointerType: string }) => void;
}

export interface GlossaryPopover {
  open: boolean;
  /** Radix `onOpenChange` — the dismissal paths (Esc, outside click) land here. */
  onOpenChange: (next: boolean) => void;
  /** Intercepts Radix's built-in click toggle; a click never closes the panel. */
  onTriggerClick: (event: { preventDefault: () => void }) => void;
  onTriggerFocus: () => void;
  triggerHover: GlossaryPopoverHandlers;
  panelHover: GlossaryPopoverHandlers;
  /** True while focus sits inside the panel — the onCloseAutoFocus contract. */
  focusInsidePanel: () => boolean;
  onPanelFocusCapture: () => void;
  onPanelBlurCapture: () => void;
}

/*
 * How long a deliberate dismissal suppresses the trigger's focus-to-open.
 *
 * WHY THIS EXISTS — a defect found by driving the real popover, not by reading
 * the code. Esc pressed with focus INSIDE the panel must close it and return
 * focus to the trigger (the onCloseAutoFocus contract). But returning focus to
 * the trigger fires the trigger's `focus` handler, which opens the popover —
 * so Esc closed and instantly re-opened it, and a keyboard user could never
 * dismiss the panel at all. The dismissal therefore suppresses exactly the
 * focus event it causes.
 *
 * Short, and cleared by any explicit re-open (hover or click), so a genuine
 * Tab-away-and-back is never swallowed for longer than the return trip.
 */
const DISMISS_FOCUS_SUPPRESSION_MS = 150;

export function useGlossaryPopover(): GlossaryPopover {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const pointerOnTrigger = useRef(false);
  const pointerOnPanel = useRef(false);
  const focusInPanel = useRef(false);
  const suppressFocusOpen = useRef(false);
  const suppressTimer = useRef<number | null>(null);
  // The closer this instance registered, so `openNow` can skip itself.
  const selfCloser = useRef<(() => void) | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    const closer = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      setOpen(false);
    };
    selfCloser.current = closer;
    openPopoverClosers.add(closer);
    return () => {
      openPopoverClosers.delete(closer);
      closer();
      if (suppressTimer.current !== null) {
        window.clearTimeout(suppressTimer.current);
        suppressTimer.current = null;
      }
    };
  }, []);

  const clearSuppression = useCallback(() => {
    suppressFocusOpen.current = false;
    if (suppressTimer.current !== null) {
      window.clearTimeout(suppressTimer.current);
      suppressTimer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    cancelTimer();
    clearSuppression();
    for (const other of openPopoverClosers) {
      if (other !== selfCloser.current) {
        other();
      }
    }
    setOpen(true);
  }, [cancelTimer, clearSuppression]);

  /** A DELIBERATE dismissal — Esc or an outside click. See the constant above. */
  const dismiss = useCallback(() => {
    cancelTimer();
    suppressFocusOpen.current = true;
    if (suppressTimer.current !== null) {
      window.clearTimeout(suppressTimer.current);
    }
    suppressTimer.current = window.setTimeout(() => {
      suppressFocusOpen.current = false;
      suppressTimer.current = null;
    }, DISMISS_FOCUS_SUPPRESSION_MS);
    setOpen(false);
  }, [cancelTimer]);

  const scheduleClose = useCallback(() => {
    cancelTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      // Re-read at fire time: the pointer may have arrived on the panel while
      // the timer was running, which is the whole point of the grace window.
      if (!pointerOnTrigger.current && !pointerOnPanel.current) {
        setOpen(false);
      }
    }, CLOSE_GRACE_MS);
  }, [cancelTimer]);

  /*
   * Mouse-only, matching PitchPanel's shipped rule: on touch, `pointerenter`
   * fires immediately before `click`, so an unguarded hover open would be
   * toggled by the click that follows and the panel would flicker.
   */
  const triggerHover: GlossaryPopoverHandlers = {
    onPointerEnter: (event) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      // An explicit hover is a fresh intent: it clears any dismissal
      // suppression left over from an Esc a moment earlier.
      pointerOnTrigger.current = true;
      openNow();
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      pointerOnTrigger.current = false;
      scheduleClose();
    },
  };

  const panelHover: GlossaryPopoverHandlers = {
    onPointerEnter: (event) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      pointerOnPanel.current = true;
      cancelTimer();
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      pointerOnPanel.current = false;
      scheduleClose();
    },
  };

  return {
    open,
    onOpenChange: (next) => {
      if (next) {
        openNow();
        return;
      }
      // Esc and outside-click arrive here. Both are deliberate dismissals, so
      // they bypass the grace timer entirely — and both suppress the
      // focus-to-open they may themselves cause.
      pointerOnTrigger.current = false;
      pointerOnPanel.current = false;
      dismiss();
    },
    onTriggerClick: (event) => {
      // Suppresses Radix's composed onOpenToggle (see the docblock): a click
      // after a hover must not close what the hover opened.
      event.preventDefault();
      openNow();
    },
    onTriggerFocus: () => {
      /*
       * The focus that a dismissal itself causes must not re-open the panel.
       * Radix's onCloseAutoFocus returns focus to the trigger when focus was
       * inside the panel, so an unguarded handler here made Esc a no-op: it
       * closed and instantly re-opened. Found by driving the real popover.
       */
      if (suppressFocusOpen.current) {
        return;
      }
      openNow();
    },
    triggerHover,
    panelHover,
    focusInsidePanel: () => focusInPanel.current,
    onPanelFocusCapture: () => {
      focusInPanel.current = true;
    },
    onPanelBlurCapture: () => {
      focusInPanel.current = false;
    },
  };
}

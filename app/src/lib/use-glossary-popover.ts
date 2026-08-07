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
 *
 * 🔴 THE REGISTRY IS NOW PAGE-WIDE IN FACT, NOT ONLY IN NAME (Story 2.14 Task
 * 7.7). It was module-PRIVATE, so "page-wide" meant "every glossary popover" and
 * nothing else. Glossary popovers ship on /glossary, on every match route and on
 * the Hub — the same four routes the global header search now covers — so
 * opening a popover and then typing in the header produced exactly the 2-deep
 * overlay stack UX-DR15 forbids and this Set exists to prevent.
 *
 * The fix is to EXPORT a registration API, not to add a second registry: two
 * registries cannot see each other, which is the same defect with more moving
 * parts. Any overlay that opens on this page registers here.
 */
const openPopoverClosers = new Set<() => void>();

/**
 * Join the page-wide single-open registry. Returns the unregister function, so
 * the caller can hand it straight to a `useEffect` cleanup.
 *
 * The closer MUST be idempotent and safe to call when already closed: every
 * other overlay's open path calls it, at any time, including while this one is
 * already shut.
 */
export function registerOverlayCloser(closer: () => void): () => void {
  openPopoverClosers.add(closer);
  return () => {
    openPopoverClosers.delete(closer);
  };
}

/**
 * Close every registered overlay EXCEPT `self`. Call this from an open path,
 * before opening — that ordering is what keeps the stack at depth 1.
 *
 * `self` is the caller's own registered closer, compared by identity: passing
 * it is what stops an overlay from closing itself on the way open. A caller
 * with nothing registered passes `null`.
 */
export function closeOtherOverlays(self: (() => void) | null): void {
  for (const other of openPopoverClosers) {
    if (other !== self) {
      other();
    }
  }
}

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
  onTriggerBlur: () => void;
  /** True while focus sits inside the panel — the onCloseAutoFocus contract. */
  focusInsidePanel: () => boolean;
  onPanelFocusCapture: () => void;
  onPanelBlurCapture: () => void;
  /**
   * Called at the END of onCloseAutoFocus, after the focus-return contract has
   * been evaluated. Clears the panel-scoped interaction state that the DOM
   * cannot clear for us: removing a focused node does NOT fire focusout, so
   * without this the "focus is inside the panel" flag survives the panel and
   * the NEXT close steals focus from wherever the user actually is.
   */
  notePanelClosed: () => void;
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
  const focusOnTrigger = useRef(false);
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
      /*
       * The panel unmounts UNDER the cursor, so no pointerleave and no focusout
       * ever fire for it. Left set, these refs make scheduleClose's fire-time
       * re-check permanently false and the popover sticks open the next time it
       * is used. onOpenChange(false) already resets them; this path is the one
       * that did not.
       */
      pointerOnPanel.current = false;
      focusInPanel.current = false;
      setOpen(false);
    };
    selfCloser.current = closer;
    const unregister = registerOverlayCloser(closer);
    return () => {
      unregister();
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
    closeOtherOverlays(selfCloser.current);
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

  /*
   * The grace-window close, used by BOTH the pointer and the focus paths.
   *
   * FOUR holds, not two. The pointer pair is the hover-intent half; the focus
   * pair is what stops a stray mouse movement from closing the panel out from
   * under a KEYBOARD user. Without the focus holds, this sequence broke AC 2:
   * Tab to the trigger (opens), Tab to the "see in the glossary" link, then let
   * the mouse cross the term and leave — 180 ms later the panel unmounted while
   * the link held focus, onCloseAutoFocus took its focus-return branch, and the
   * trigger's own focus handler re-opened the panel. The keyboard user lost
   * both the link and their place, which is a 1.4.13 "persistent" failure.
   */
  const scheduleClose = useCallback(() => {
    cancelTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      // Re-read at fire time: the pointer may have arrived on the panel, or
      // focus may have entered it, while the timer was running — which is the
      // whole point of the grace window.
      if (
        !pointerOnTrigger.current &&
        !pointerOnPanel.current &&
        !focusOnTrigger.current &&
        !focusInPanel.current
      ) {
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
      // Recorded BEFORE the suppression check: focus really is on the trigger
      // either way, and scheduleClose must not close a panel whose trigger the
      // user is sitting on just because the dismissal suppressed the re-open.
      focusOnTrigger.current = true;
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
    /*
     * CLOSE ON FOCUS-OUT. Without this the panel opened by a Tab onto the term
     * stayed open forever once the user tabbed past the link — nothing in the
     * hook closed it but Esc or an outside click, so it sat over the content
     * the user had moved on to. The grace timer re-checks all four holds, so
     * Tab from the trigger INTO the panel does not trip it.
     */
    onTriggerBlur: () => {
      focusOnTrigger.current = false;
      scheduleClose();
    },
    triggerHover,
    panelHover,
    focusInsidePanel: () => focusInPanel.current,
    onPanelFocusCapture: () => {
      focusInPanel.current = true;
      cancelTimer();
    },
    onPanelBlurCapture: () => {
      focusInPanel.current = false;
      scheduleClose();
    },
    notePanelClosed: () => {
      focusInPanel.current = false;
      pointerOnPanel.current = false;
    },
  };
}

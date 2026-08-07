"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Vendored Radix Dialog reconciled to tokens (Story 2.14, Task 6), on the exact
 * pattern `ui/popover.tsx` and `ui/dropdown-menu.tsx` established: no
 * outline-none (focus comes from the global :focus-visible 2px solid --ring
 * treatment in globals.css), border-hairline as the only divider weight,
 * data-slot attributes, cn().
 *
 * NO NEW RUNTIME DEPENDENCY: radix-ui@1.6.5 is already installed and
 * @radix-ui/react-dialog is already in its tree — the same footing on which
 * Popover, DropdownMenu and ToggleGroup ship. Story 2.2's boundary is "add no
 * new runtime dependencies", and this adds none. (`cmdk`, which shadcn's
 * `Command` wraps and which UX-DR5 names, IS a new dependency and is verified
 * absent from both package.json and node_modules — hence ruling 2's hand-rolled
 * combobox. This file is the one primitive that hand-rolling still needs.)
 *
 * VENDORED RATHER THAN IMPORTED INLINE. Every Radix primitive in this tree lives
 * under components/ui with this header; an inline `import { Dialog } from
 * "radix-ui"` inside HeaderSearch would be the first departure, and it is not
 * worth taking for one consumer.
 *
 * BEHAVIOUR-FREE BY DESIGN, following Popover. What the sheet contains, when it
 * opens and what Escape means are call-site policy (HeaderSearch), because
 * ruling 3's "Escape closes EVERYTHING in one press" is a decision about the
 * whole overlay stack rather than about this primitive.
 *
 * WHAT RADIX OWNS HERE, and why the sheet takes it rather than hand-rolling:
 * the focus trap, Escape-to-close, focus-return-to-trigger, `aria-modal`, and
 * marking the rest of the document inert. All four are things UX-DR15 and the
 * Accessibility Floor require and none are things this story should re-derive.
 */

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/*
 * THE Z-VALUE IS RULED HERE AND STATED, because no z-scale is ruled anywhere
 * (Story 2.2's open item 3) and the only values in the tree are the header's
 * z-40, the focused skip link's z-50 and the overlays' z-10.
 *
 * z-50, deliberately ABOVE the header. The sheet is a full-width overlay that
 * must escape an `h-14 sticky z-40` bar; at z-10 the header would paint over
 * the panel it opened. It shares a level with the skip link, and that is safe by
 * construction rather than by luck: the dialog is MODAL, so Radix marks the rest
 * of the document inert and traps focus — the skip link cannot be focused while
 * the sheet is open, so the two can never contend for the same paint.
 *
 * IT PORTALS, unlike `popover.tsx` and like `dropdown-menu.tsx`. Popover's file
 * records why it must not (a portal breaks the Tab path to its inline link); a
 * modal dialog has the opposite requirement — it must escape every ancestor
 * stacking context and every `overflow` clip, and Radix owns the focus path
 * inside it.
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-50 bg-surface-base/80", className)}
      {...props}
    />
  )
}

/**
 * The panel itself — FULL-WIDTH and top-anchored, not centred.
 *
 * It descends from the header it replaces, so it starts at the top edge and
 * spans the viewport: a centred card would leave the reader's typing hand and
 * their eye in two different places on a phone, and the control it stands in for
 * lives at the top of the screen.
 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // `max-h-dvh` + `overflow-y-auto` so a full result list on a short
          // landscape phone scrolls inside the panel rather than off it.
          "fixed inset-x-0 top-0 z-50 flex max-h-dvh w-full flex-col gap-tile-gap overflow-y-auto",
          "border-b border-hairline bg-surface-overlay p-gutter-mobile shadow-overlay",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/*
 * `Dialog.Title` is MANDATORY, not optional decoration: DialogContent sets
 * `aria-labelledby` only when a Title is present, so a panel without one gets
 * `role="dialog"` with no accessible name — an axe `aria-dialog-name` failure,
 * and Radix logs a console error for it, which would breach Task 11.7's
 * zero-console bar on its own.
 *
 * Rendered `asChild` at the call site where an <h2> would corrupt a route's
 * heading outline — the reason `popover.tsx` records for its own Title.
 */
function DialogTitle({ ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" {...props} />
}

function DialogDescription({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" {...props} />
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
}

"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Vendored Radix Popover reconciled to tokens (Story 2.18, ruled decision 9),
 * on the 2.1 button/card/toggle pattern: no outline-none (focus comes from the
 * global :focus-visible 2px solid --ring treatment), border-hairline as the only
 * divider weight, data-slot attributes, cn().
 *
 * NO NEW RUNTIME DEPENDENCY: radix-ui@1.6.5 is already installed and
 * @radix-ui/react-popover is already in its tree.
 *
 * THIS FILE IS DELIBERATELY BEHAVIOUR-FREE. The clauses decision 9 rules —
 * controlled open state, modal={false}, onOpenAutoFocus/onCloseAutoFocus, and
 * intercepting Trigger's built-in click toggle — live at the CALL SITE
 * (glossary-marking.tsx), because each is a policy about hover intent and focus
 * that the eleven consumers of a shared primitive must be able to see.
 *
 * THE ONE THING THIS FILE ENFORCES IS THE ABSENCE OF A PORTAL. Popover.Content
 * renders INLINE, as a DOM sibling of the anchor. With a portal the content
 * mounts at the end of <body>, so (a) Tab from an inline trigger goes to the
 * next in-page focusable and NEVER reaches the panel's link, and (b) that Tab
 * fires a focusin outside the portalled layer, which DismissableLayer's
 * onFocusOutside treats as a dismissal — the Tab that was supposed to reach the
 * link closes the popover instead. AC 2's "Tab-reachable glossary link" is
 * unachievable any other way without hand-writing a Tab interception.
 */

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

/*
 * `Popover.Title` is rendered with `asChild` at the call site so the accessible
 * name is set WITHOUT emitting a heading: PopoverContentImpl sets
 * aria-labelledby only when a Title is present (a plain styled <span> gives
 * role="dialog" with no name, an axe aria-dialog-name failure), but the default
 * Title renders Primitive.h2, and an <h2> inside a match route's section would
 * corrupt the heading outline.
 */
function PopoverTitle({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Title>) {
  return <PopoverPrimitive.Title data-slot="popover-title" {...props} />
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Content
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      className={cn(
        /*
         * `max-w-full` is what makes the 320px clamp pass; the height clamp is
         * the 2.7-review finding the hand-rolled PitchPanel popover took (a
         * >1000px popover inside a ~250px panel). z-10 matches the one shipped
         * overlay on this route.
         */
        "z-10 flex w-56 max-w-full flex-col gap-1 overflow-y-auto rounded-sm border border-hairline bg-surface-overlay p-3 shadow-overlay",
        "max-h-[60vh]",
        /*
         * TYPOGRAPHY RESET, and it belongs HERE rather than at a call site
         * precisely BECAUSE there is no portal: the panel is a DOM child of
         * whatever marked the term, so it inherits that element's text
         * treatment. The Hero's xG trigger sits inside `type-stat-label
         * text-center`, which is uppercase, centred and tracked at 0.08em — so
         * the definition, the counterpart subtitle and the link all rendered
         * centred and letter-spaced, unlike every other popover on the site.
         * `type-body`/`type-caption` set neither property, so nothing else
         * resets it. Every future marked surface gets this for free.
         */
        "text-left normal-case tracking-normal",
        className
      )}
      {...props}
    />
  )
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTitle, PopoverTrigger }

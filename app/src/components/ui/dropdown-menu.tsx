"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Vendored Radix DropdownMenu reconciled to tokens (Story 2.12), on the exact
 * pattern `ui/popover.tsx` established: no outline-none (focus comes from the
 * global :focus-visible 2px solid --ring treatment in globals.css),
 * border-hairline as the only divider weight, data-slot attributes, cn().
 *
 * NO NEW RUNTIME DEPENDENCY: radix-ui@^1.6.5 is already installed and
 * @radix-ui/react-dropdown-menu is already in its tree — the same footing on
 * which Popover and ToggleGroup ship.
 *
 * EXPERIENCE.md names this component by name: "On `<md` Hub tables the sort
 * menu is a shadcn DropdownMenu listing all columns and mirroring `aria-sort`."
 * Story 2.11a PARKED that clause explicitly ("scoped to Hub tables — not this
 * story"), so this is the first and only consumer.
 *
 * UNLIKE POPOVER, THIS ONE PORTALS. Popover's file documents why it must not:
 * its panel holds a Tab-reachable glossary link, and a portal breaks that Tab
 * path. A menu has no such requirement — Radix owns roving focus inside it,
 * returns focus to the trigger on close, and closes on Esc — so portalling is
 * the safer default here: it keeps the panel out of any `overflow-x-auto` table
 * wrapper that would otherwise clip it.
 *
 * BEHAVIOUR-FREE BY DESIGN, again following Popover. What the menu contains,
 * what an item does and how it is named are call-site policy (TableSortMenu),
 * because the sort cycle is a contract the whole codebase shares.
 */

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          /*
           * `max-w-[calc(100vw-2rem)]` is what makes the 320px clamp pass — a
           * menu listing eleven standings columns is wider than the viewport
           * otherwise. The height clamp mirrors Popover's, which took the 2.7
           * review's finding about a >1000px panel inside a ~250px container.
           * z-10 matches the one shipped overlay level on these routes.
           */
          "z-10 flex max-h-[60vh] w-56 max-w-[calc(100vw-2rem)] flex-col gap-0.5 overflow-y-auto rounded-sm border border-hairline bg-surface-overlay p-1 shadow-overlay",
          // Same typography reset as Popover: the menu inherits from whatever
          // marked it up, and the Hub's controls sit inside uppercase,
          // letter-spaced label rows.
          "text-left normal-case tracking-normal",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        /*
         * `min-h-11` is UX-DR15's 44px floor on the ITEM ITSELF, not on a
         * wrapper — the same placement Story 2.4's patch put it in on
         * DataTable's header buttons. MIN_HIT_PX is not imported here because
         * that const lives in src/viz/ and this is a vendored primitive
         * directory; the call site owns the numeric floor, this owns the class.
         *
         * `data-highlighted` is Radix's keyboard/pointer focus state — the menu
         * moves a roving highlight rather than DOM focus, so :focus-visible
         * alone would leave arrow-key navigation with no visible indicator.
         */
        "flex min-h-11 cursor-default items-center justify-between gap-2 rounded-sm px-3 type-body text-ink-primary",
        "data-[highlighted]:bg-surface-raised data-[disabled]:text-ink-secondary data-[disabled]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-hairline", className)}
      {...props}
    />
  )
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger }

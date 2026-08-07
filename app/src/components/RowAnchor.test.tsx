// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RowAnchor } from "@/components/RowAnchor";
import { MIN_HIT_PX } from "@/viz/marker-layout";

/*
 * `RowAnchor`'s co-located suite (added at code review 2026-08-07, R-D2).
 *
 * WHY IT EXISTS: TWO CONTRADICTORY RULINGS SHIPPED, AND NOTHING ASSERTED EITHER.
 *
 * Story 2.15 first shipped a ROW-WIDE focus treatment on `/players` —
 * `focus-within:outline` on the `<tr>` with `focus-visible:outline-none`
 * suppressing the anchor's own ring. Story 2.16 then hoisted this component and
 * ruled the opposite (Q2, taken by Juan): the ANCHOR-BOX ring, with no
 * `outline-none` anywhere. Both rulings were live in the tree at once, in
 * ledger entries four hundred lines apart, and 2.15's code review has since
 * overturned its own treatment in favour of the anchor-box ring for the same
 * two reasons Q2 gives — `outline-none` is a house prohibition that has already
 * cost two review patches, and `:focus-within` matches on ANY descendant
 * `:focus`, painting a persistent ring for pointer users.
 *
 * The routes now agree. What was missing is the thing that keeps them agreeing:
 * NO TEST COVERED THE FOCUS TREATMENT ON EITHER ROUTE, so the pending 2.17
 * repoint of `PlayerMatchesSection`'s remaining private copy could have silently
 * reverted it in whichever direction, with a green suite either way.
 *
 * THE SOURCE-TEXT ASSERTION IS DELIBERATE AND IS THE LOAD-BEARING ONE. jsdom
 * computes no `:focus-visible` styles and Tailwind's variants never run here, so
 * a render assertion cannot observe the ring at all. What CAN be pinned is the
 * ruling's operative clause — that the file contains no outline suppression —
 * and that is precisely the edit a careless repoint would make.
 */

/*
 * COMMENTS STRIPPED BEFORE ASSERTING, and the first draft of this file proved
 * why: `RowAnchor.tsx`'s own docblock states the ruling in prose — "so NO
 * `outline-none` appears in this file" — so a raw-text assertion matched the
 * sentence explaining the rule rather than a violation of it, and went red on
 * correct code. Only executable text can be evidence here.
 */
/* Hoisted: bare JSX string literals trip `react/jsx-no-literals`, and the
 * i18n seam applies to `.test.tsx` with no exemption. */
const CELL_TEXT = "Mexico";

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const ROW_ANCHOR_CODE = withoutComments(
  readFileSync(path.join(process.cwd(), "src", "components", "RowAnchor.tsx"), "utf8")
);

/*
 * EXPLICIT, not inherited. `@testing-library/react` registers its own
 * `afterEach(cleanup)` only when a global `afterEach` exists, and this project
 * runs vitest without globals — so without this the DOM leaks between cases and
 * `getByRole("link")` throws "found multiple elements" on the second render.
 * `HeaderSearch.test.tsx` calls it explicitly for the same reason.
 */
afterEach(() => {
  cleanup();
});

describe("RowAnchor — the ruled focus treatment (Story 2.16 Q2)", () => {
  /*
   * THE RULING, AS A GATE. `outline-none` in any Tailwind form — bare,
   * `focus:`, or `focus-visible:` — suppresses the native ring the ruling keeps.
   * A reintroduction here would silently remove the visible focus indicator from
   * every linked table row on the site, on a route with no axe coverage
   * (2.19 owns it) and no live screen reader in this harness.
   */
  it("suppresses no native focus ring anywhere in the file", () => {
    expect(ROW_ANCHOR_CODE).not.toContain("outline-none");
    expect(ROW_ANCHOR_CODE).not.toContain("outline-0");
    expect(ROW_ANCHOR_CODE).not.toContain("focus:outline-hidden");
    expect(ROW_ANCHOR_CODE).not.toContain("outline-hidden");
  });

  /*
   * AND NO ROW-WIDE TREATMENT EITHER — the other half of the ruling. Either of
   * these would paint a second indicator alongside the native one, which is the
   * outcome Q2 rejected.
   */
  it("paints no row-wide indicator alongside the anchor's own", () => {
    expect(ROW_ANCHOR_CODE).not.toContain("focus-within:");
    expect(ROW_ANCHOR_CODE).not.toContain("group-focus");
  });

  it("stretches over the whole row without becoming the row's own focus target", () => {
    render(
      <RowAnchor href="/matches/m001-mexico-south-africa/#key-stats" accessiblePrefix="Ver el partido">
        {CELL_TEXT}
      </RowAnchor>
    );
    const link = screen.getByRole("link");
    /* The stretched overlay (D4): the ROW is the hit area, resolved against the
     * caller's `<tr className="relative">`. */
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    /* The anchor itself stays a normal focusable link — no tabIndex games. */
    expect(link.getAttribute("tabindex")).toBeNull();
  });

  /*
   * UX-DR15's 44 px FLOOR, THROUGH THE ONE SHARED CONSTANT. `MIN_HIT_PX` is
   * imported rather than re-declared so the floor has a single definition; this
   * pins that the component actually applies it, which the measured 165×44 /
   * 51×44 anchor boxes in the story's browser pass depend on.
   */
  it("applies the shared minimum hit height rather than a local literal", () => {
    render(
      <RowAnchor href="/teams/mexico/" accessiblePrefix="Ver el equipo">
        {CELL_TEXT}
      </RowAnchor>
    );
    const link = screen.getByRole("link");
    expect(link.style.minHeight).toBe(`${String(MIN_HIT_PX)}px`);
    expect(MIN_HIT_PX).toBeGreaterThanOrEqual(44);
  });

  /*
   * PREFETCH IS OFF BY DEFAULT and a caller must opt IN. Next prefetches every
   * `<Link>` entering the viewport, so an 8-row table fires eight route requests
   * on load and re-fires on every re-order — Story 2.13 measured 48 → 75
   * resource entries across one sort pass, and Story 2.16 measured `MatchHero`'s
   * two defaulted links costing seven `/teams/` requests on a single match page.
   */
  it("defaults prefetch off so a table cannot inherit Next's default by omission", () => {
    render(
      <RowAnchor href="/teams/mexico/" accessiblePrefix="Ver el equipo">
        {CELL_TEXT}
      </RowAnchor>
    );
    /* next/link renders no `prefetch` attribute; the guarantee that matters is
     * the signature's default, asserted here against the source so a change to
     * `prefetch = true` cannot pass unnoticed. */
    expect(ROW_ANCHOR_CODE).toContain("prefetch = false");
  });

  /*
   * THE TRAILING SPACE IN THE SR-ONLY PREFIX (Story 2.12's finding). The
   * accessible-name algorithm inserts a space between element children, but the
   * DOM text is concatenated raw — the live name read back was "Ver el
   * equipoMexico". An explicit separator makes it true in every engine.
   */
  it("separates the sr-only prefix from the cell text in the DOM, not just in the spec", () => {
    render(
      <RowAnchor href="/teams/mexico/" accessiblePrefix="Ver el equipo">
        {CELL_TEXT}
      </RowAnchor>
    );
    expect(screen.getByRole("link").textContent).toBe("Ver el equipo Mexico");
  });
});

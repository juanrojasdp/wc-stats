"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { HeaderSearch, SearchField, useSearchIndex } from "@/components/HeaderSearch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocale, useT } from "@/lib/i18n-provider";
import { availableDestinations, currentDestinationKey } from "@/lib/nav-destinations";
import { useTheme } from "@/lib/theme-provider";
import { closeOtherOverlays, registerOverlayCloser } from "@/lib/use-glossary-popover";

/*
 * ══════════════ THE NAVIGATION MENU (Story 3.10, UX-DR24) ═══════════════════
 *
 * UX-DR24 RE-RULES UX-DR4's "no primary nav", and this file implements that
 * contract rather than re-deriving it. The shape, the breakpoint, the modality,
 * the keyboard model and the accessible-name source are all settled there
 * (EXPERIENCE.md → Navigation / Responsive; DESIGN.md → Components,
 * Layout & Spacing). Where an older acceptance criterion disagrees, the contract
 * wins.
 *
 * TWO PRESENTATIONS, ONE DESTINATION TABLE:
 *   · `≥xl` — the destinations inline in the header row, plain tab stops in
 *     reading order, beside the search and the language/theme controls.
 *   · `<xl` — ONE trigger opening a modal sheet that holds all three: the
 *     search, the destinations, and the language/theme controls.
 *
 * 🔴 THE TRIGGER REPLACES THREE CONTROLS; IT DOES NOT JOIN THEM. That is the
 * whole width argument, and it is why "just add a hamburger next to the existing
 * controls" is not a smaller version of this change but the opposite of it.
 * Story 2.19 measured the header row's min-content at 237 CSS px; story 3.6's
 * authorship caption widened the identity block 76 → 127 px and moved the wrap
 * threshold to ~354, so the row already wraps on every phone. A FIFTH element
 * would push that to ~406. Below `xl` this row is wordmark + one 44 px trigger,
 * whose min-content is BELOW 237 — so the 320 px row gets easier, not harder.
 *
 * ⚠️ THE THRESHOLD IS `xl` (80rem), MEASURED, AND `lg` IS CLOSED. Nine Spanish
 * destinations alongside identity + search + ES|EN + theme measure ~1,060–1,080
 * px; usable measure is the viewport minus two 24 px gutters, so 976 px at `lg`
 * against 1,232 px at `xl`. `lg` fails, and it fails INVISIBLY, because
 * `HeaderSearch` ships `min-w-0 flex-1` and the input collapses silently rather
 * than the row overflowing. The mockup's frame-C note still says `lg`; that note
 * is stale and the spine supersedes it. This file introduces the first `xl:`
 * variant in `app/src` — nothing else keys off it.
 *
 * ══════════════ WHICH PRESENTATION RENDERS IS CSS (ruling 4, D3) ════════════
 *
 * Both are in the markup on every route. `xl:hidden` hides the trigger at `≥xl`;
 * `hidden xl:flex` hides the inline links below it. A JS media query CHOOSING
 * which markup to emit would emit the narrow form on the server — `SiteHeader`
 * is pre-rendered into 1,406 HTML files — and hydrate wide. `hidden` is
 * `display:none`, which removes the subtree from the ACCESSIBILITY TREE, so
 * exactly one nav is exposed at any width and there are never two competing sets
 * of links.
 *
 * 🔴 CONSEQUENCE, OWNED: the destination names appear TWICE in every route's
 * DOM. So NO `id` ON ANY NAV LINK — duplicated ids would be a duplicate-id
 * defect on 1,406 routes. `aria-current` duplicating is harmless; an id is not.
 *
 * ══════════════ THE SHEET IS MODAL, AND GEOMETRY IS NOT MODALITY (D4) ═══════
 *
 * Built on the vendored `ui/dialog.tsx`, the same primitive Story 2.14's search
 * sheet took. From Radix, and NOT re-derived here: the focus trap,
 * Escape-to-close, focus-return-to-trigger, `aria-modal`, and marking the rest
 * of the document inert. `DialogOverlay` supplies the scrim and `DialogContent`'s
 * geometry is ALREADY the ruled one — full-width, top-anchored, content-driven
 * height, `max-h-dvh overflow-y-auto`. The primitive needs no change; the width
 * is capped at THIS call site.
 *
 * A sheet that leaves the page behind it operable while looking dismissible is a
 * 2.1.2 / 2.4.3 defect; a sheet that inerts without a scrim looks broken. Both
 * halves come free. Do not hand-roll either.
 *
 * ══════════════ NOT A `role="menu"` (D5) ═══════════════════════════════════
 *
 * These are links to pages, not commands. `role="menu"` would impose
 * arrow-key-only navigation and break the reading-order tab model UX-DR15 rules.
 * The sheet is a labelled region containing a `<nav>` landmark over a `<ul>` of
 * links; the inline links are plain tab stops. No roving tabindex, no menu
 * semantics, no arrow-key contract to document.
 *
 * ══════════════ ONE DEEP-LINK MECHANISM, NOT TWO (D2, AC 2) ═════════════════
 *
 * No destination points into a match route — the only fragment in the table is
 * `#results`, and it hangs off the Tournament Hub. So this file imports NOTHING
 * from story 3.8's `match-anchors.ts` / `use-anchor-nonce.ts` and adds no
 * `hashchange` handling. That is not an omission; it is AC 2 holding, and
 * `nav-destinations.test.ts` pins it so a later editor who adds a match deep
 * link is told, at that moment, to route it through 3.8's nonce path.
 */

/**
 * The trigger's glyph. Three rules, `aria-hidden` — the accessible name is on
 * the button and comes from a locale key, never from the icon.
 */
function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

/**
 * The `ES|EN` toggle and the theme toggle, moved here from `SiteHeader` verbatim
 * — same classes, same `aria-label`s, same `aria-pressed` / `data-state`
 * semantics.
 *
 * 🔴 ONE DEFINITION, TWO CALL SITES. They render inline at `≥xl` and inside the
 * sheet below it. Writing them twice would be two copies of a control whose
 * on-state styling, hit size and accessible names are all ruled — exactly the
 * drift `SearchField` exists to prevent for the search.
 */
function LocaleAndThemeControls() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      <ToggleGroup
        type="single"
        value={locale}
        onValueChange={(value) => {
          // Radix reports "" when the active segment is re-clicked; the active
          // language cannot be deselected.
          if (value === "es" || value === "en") {
            setLocale(value);
          }
        }}
        aria-label={t("chrome.languageToggle.label")}
        className="rounded-full border border-hairline p-0.5"
      >
        <ToggleGroupItem
          value="es"
          aria-label={t("chrome.languageToggle.esFull")}
          className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
        >
          {t("chrome.languageToggle.es")}
        </ToggleGroupItem>
        <ToggleGroupItem
          value="en"
          aria-label={t("chrome.languageToggle.enFull")}
          className="min-h-11 min-w-11 rounded-full px-3 type-label-caps text-ink-secondary data-[state=on]:bg-accent-lime data-[state=on]:text-ink-on-lime data-[state=on]:hover:bg-accent-lime data-[state=on]:hover:text-ink-on-lime"
        >
          {t("chrome.languageToggle.en")}
        </ToggleGroupItem>
      </ToggleGroup>
      {/*
       * Stable accessible name + `aria-pressed` (Story 2.2's review decision):
       * the name never changes; pressed says whether the light theme is active.
       * The on-state accent fill is muted — quiet chrome, and a permanently
       * highlighted button would misread as "active tool".
       */}
      <Toggle
        pressed={!isDark}
        onPressedChange={(pressed) => setTheme(pressed ? "light" : "dark")}
        aria-label={t("chrome.themeToggle.label")}
        className="min-h-11 min-w-11 text-ink-secondary data-[state=on]:bg-transparent data-[state=on]:text-ink-secondary"
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </Toggle>
    </>
  );
}

/**
 * The destination list, rendered by BOTH presentations so they cannot drift.
 *
 * `variant` changes only how the CURRENT route is marked and how the list is
 * laid out. Which destinations render, in what order, and what they are called
 * is `nav-destinations.ts` in both cases.
 */
function DestinationList({ variant }: { variant: "inline" | "sheet" }) {
  const t = useT();
  const pathname = usePathname();
  const currentKey = currentDestinationKey(pathname);
  const isSheet = variant === "sheet";

  return (
    <ul className={isSheet ? "flex flex-col" : "flex items-center gap-tile-gap"}>
      {availableDestinations().map((destination) => {
        const isCurrent = destination.key === currentKey;
        return (
          <li key={destination.key} className={isSheet ? "border-b border-hairline" : undefined}>
            <Link
              href={destination.href}
              /*
               * 🔴 NEVER AN `id` HERE (D3). Both presentations ship in every
               * route's DOM, so an id would be duplicated on 1,406 pages.
               */
              aria-current={isCurrent ? "page" : undefined}
              /*
               * 🔴 ONE COLOUR FOR BOTH STATES (2026-08-26 code review).
               * DESIGN.md rules `link-color: {colors.ink-primary}` for this
               * component, says it again in prose for both presentations
               * ("nav links are {colors.ink-primary}", "Inline links at `≥xl`
               * use the same type and color"), and the mockup agrees. Shipping
               * non-current links in `ink-secondary` added a SECOND, unruled
               * colour axis on top of the ruled cues below. Current-vs-not is
               * carried by the underline, the lime marker and the weight — not
               * by dimming everything else.
               */
              className={
                isSheet
                  ? [
                      "flex min-h-11 items-center gap-2 type-body text-ink-primary",
                      isCurrent ? "font-semibold" : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : [
                      "flex min-h-11 items-center whitespace-nowrap type-body text-ink-primary",
                      isCurrent ? "underline underline-offset-[5px]" : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ")
              }
            >
              {/*
               * 🔴 THE CURRENT ROUTE IS NOT MARKED BY COLOUR ALONE (1.4.1). In
               * the sheet a lime marker carries it AND the weight changes; in
               * the inline row it is underlined. `aria-current` carries it for
               * assistive technology in both.
               */}
              {isSheet ? (
                <span
                  aria-hidden="true"
                  className={[
                    "h-4 w-0.5 shrink-0 rounded-full",
                    isCurrent ? "bg-accent-lime" : "bg-transparent",
                  ].join(" ")}
                />
              ) : null}
              {t(destination.labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SiteNav() {
  const t = useT();
  const { locale } = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetId = useId();
  const pathname = usePathname();

  /*
   * The sheet's OWN search state, separate from the inline combobox's. Two
   * presentations, two live regions, two announcement strings — and
   * `loadTournamentIndex()` dedupes the fetch at module level, so the second
   * hook costs no second REQUEST. (It does not dedupe the corpus BUILD; see the
   * docblock on `useSearchIndex` for what that costs and why it is accepted.)
   */
  const { corpus, status, engage, announce, announcement, resetAnnouncement } = useSearchIndex();

  /*
   * Live mirrors, so the effects below can read current values without taking
   * them as dependencies — the `xl` listener and the overlay-registry closer
   * are both registered once and must not be torn down and rebuilt on every
   * state change.
   *
   * Written in an effect, not during render: `react-hooks/refs` forbids the
   * latter, and it is right to — a ref written during render is not reverted if
   * React discards the render.
   */
  const sheetOpenRef = useRef(sheetOpen);
  const resetAnnouncementRef = useRef(resetAnnouncement);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
    resetAnnouncementRef.current = resetAnnouncement;
  });

  /** The inline row, so the `≥xl` auto-close has somewhere to put focus. */
  const inlineNavRef = useRef<HTMLElement | null>(null);

  /*
   * 🔴 THE ONE CLOSE PATH — EVERY DISMISSAL GOES THROUGH IT (2026-08-26 code
   * review). This used to be a bare `setSheetOpen(false)`, and two of the three
   * close paths (this registry closer and the `xl` sync below) therefore skipped
   * the `resetAnnouncement()` that `handleOpenChange` performs — while the
   * comment there asserted the reset happens on BOTH edges. Type in the sheet's
   * search, then cross to `≥xl` or open a glossary popover inside the 400 ms
   * settle window, and the pending timer fired against a torn-down region. The
   * reset lives here now, so the invariant holds however the sheet closes.
   */
  const closeSheet = useRef(() => {
    resetAnnouncementRef.current();
    setSheetOpen(false);
  });

  useEffect(() => {
    return registerOverlayCloser(closeSheet.current);
  }, []);

  /*
   * 🔴 A DESTINATION CLOSES THE SHEET, AND NOTHING ELSE WILL DO IT
   * (2026-08-26 code review). `SiteHeader` lives in the ROOT LAYOUT, so a client
   * navigation does not unmount this component; the `<Link>` click happens
   * INSIDE the dialog, so Radix's outside-pointer-down dismissal never fires;
   * and Radix has no notion of a route. Every other close path is Escape, the
   * close button, the `xl` sync or the overlay registry — none of which a tap on
   * *Glosario* reaches. Shipped, that meant the route changed BEHIND a still-open
   * modal that Radix keeps inert and body-scroll-locked: the reader saw the menu
   * they had just used, not the page they had just chosen, on every viewport
   * below `xl`. Tapping the CURRENT destination was worse — it navigates
   * nowhere, so the sheet simply stayed up with no feedback at all.
   *
   * Keyed on `pathname` rather than on the click, so it also covers Back/Forward
   * and any future programmatic navigation. The ref guard keeps it from firing
   * on mount, where there is nothing to close and `resetAnnouncement` would run
   * for no reason.
   */
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) {
      return;
    }
    lastPathname.current = pathname;
    if (sheetOpenRef.current) {
      closeSheet.current();
    }
  }, [pathname]);

  /*
   * 🔴 CLOSE THE SHEET AT `xl` — THE CSS COLLAPSE CANNOT DO IT (D7).
   *
   * `xl:hidden` governs the TRIGGER, which is a child of this component.
   * `DialogContent` is not: it PORTALS to `document.body`, so it sits outside
   * every ancestor this component can style. Drag a window wider, or rotate a
   * phone to landscape, with the sheet open, and the result is a modal overlay
   * covering the desktop layout whose trigger is no longer rendered —
   * unreachable except by Escape.
   *
   * THIS IS NOT THE `useMediaQuery` BRANCH RULING 4 BARS. That ruling is about
   * choosing WHICH PRESENTATION TO RENDER, where a JS breakpoint emits narrow
   * markup on the server and hydrates wide. Nothing here renders anything: it is
   * a one-way dismissal of an already-open overlay, it runs only in an effect,
   * and its server output is identical either way.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    // 80rem is Tailwind's `xl`. Kept as a literal because the collapse it
    // mirrors is a literal `xl:` variant in the class strings below.
    const wide = window.matchMedia("(min-width: 80rem)");
    const sync = () => {
      if (!wide.matches) {
        return;
      }
      const wasOpen = sheetOpenRef.current;
      closeSheet.current();
      if (!wasOpen) {
        return;
      }
      /*
       * 🔴 TAKE FOCUS DELIBERATELY, BECAUSE RADIX CANNOT (2026-08-26 code
       * review). Radix's `onCloseAutoFocus` calls `.focus()` on the trigger —
       * but at this exact instant the trigger's ancestor matches `xl:hidden`,
       * i.e. `display:none`, so the call is a NO-OP and focus resets to
       * `<body>`. A keyboard reader who opened the sheet at 1000 px and then
       * rotated a tablet or dragged past 1280 px lost their place entirely: the
       * next Tab restarted from the top of the document (WCAG 2.4.3). Task
       * 9.8's keyboard walk covered Escape, which returns focus correctly, and
       * never the resize-close.
       *
       * Two frames, because the first is Radix's own restore attempt — we only
       * act if it landed nowhere, so the ordinary Escape path is untouched. The
       * first inline destination is the right target: at `≥xl` it is what the
       * trigger just became.
       */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (active && active !== document.body) {
            return;
          }
          inlineNavRef.current?.querySelector<HTMLElement>("a")?.focus();
        });
      });
    };
    sync();
    wide.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
    };
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        // Depth 1, page-wide: close anything else open before opening.
        closeOtherOverlays(closeSheet.current);
        engage();
      }
      /*
       * Reset on BOTH edges (Task 4.6), and it is load-bearing rather than
       * tidiness: the sheet's live region MOUNTS WITH THE SHEET, and "a live
       * region that mounts already-populated does not announce reliably" is
       * stated verbatim in four files in this tree. A count queued 400 ms ago
       * must not land in the panel the reader just opened.
       */
      resetAnnouncement();
      setSheetOpen(next);
    },
    [engage, resetAnnouncement]
  );

  return (
    <>
      {/*
       * `≥xl`: the destinations inline, then the search, then the language and
       * theme controls. DOM order IS visual order IS reading order — the row
       * reads identity → destinations → search → ES|EN → theme, which is Story
       * 2.2's shipped order with the destinations inserted after the identity
       * block.
       */}
      <nav
        ref={inlineNavRef}
        data-slot="site-nav-inline"
        aria-label={t("nav.landmark")}
        className="hidden xl:flex"
      >
        <DestinationList variant="inline" />
      </nav>
      <HeaderSearch />
      <div className="hidden items-center gap-tile-gap xl:flex">
        <LocaleAndThemeControls />
      </div>

      {/*
       * `<xl`: one trigger, one sheet, three controls behind it.
       *
       * 🔴 A `<nav>`, NOT A BARE `<div>` (2026-08-26 code review, ruled by Juan).
       * The inline landmark above is `display:none` at every width this branch
       * renders at, and the sheet's landmark exists only while the sheet is
       * OPEN — so a screen-reader reader rotoring by landmark on a phone found a
       * `banner` and a `main` and NO `navigation`, on all 1,406 routes. Below
       * `xl` this trigger IS the navigation, so it belongs inside the landmark
       * that says so. Costs nothing visually; the two `<nav>`s can never both be
       * exposed, since this one is `xl:hidden` and the other is `hidden xl:flex`.
       *
       * 🔴 `ml-auto` IS LOAD-BEARING (2026-08-26 code review). The header row is
       * a plain `flex flex-wrap items-center` with no `justify-between`, and its
       * only growing child WAS the search slot — which this story made
       * `hidden … xl:flex`, i.e. `display:none` below `xl`, so its `flex-1` is
       * not laid out and distributes nothing. The identity block does not grow
       * either. That left `justify-end` here with no free main-axis space to
       * work on: it was inert, and the trigger packed flush against the wordmark
       * with the rest of the bar empty, on every phone and tablet. `ml-auto`
       * consumes the free space directly and does not depend on a sibling.
       * D10 predicted this exact class change and it was declined; the mockup
       * has it as `.spacer{flex:1 1 auto}` in frames A and B.
       */}
      <nav
        data-slot="site-nav-trigger-landmark"
        aria-label={t("nav.landmark")}
        className="ml-auto flex justify-end xl:hidden"
      >
        <Dialog open={sheetOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            data-slot="site-nav-trigger"
            /*
             * The accessible name is STABLE across open and closed —
             * `aria-expanded` carries the state, exactly as the theme toggle
             * uses `aria-pressed`. Do not swap "Abrir menú" / "Cerrar menú".
             *
             * `aria-controls` is CONDITIONAL (D6): the sheet portals to
             * `document.body` and is ABSENT while closed, so an unconditional
             * attribute would be a dangling IDREF and an axe
             * `aria-valid-attr-value` failure on the header of all 1,406 routes.
             * This is the shipped house form, used at four of the seven
             * `aria-controls` sites in `HeaderSearch.tsx`.
             *
             * 🔴 `flex`, NOT `grid` (D11). The mockup draws this as
             * `display:grid; place-items:center`, but `reflow-guards.test.ts`
             * runs a repo-wide scan that fails any `className` containing `grid`
             * without `grid-cols-*`, exempting only boxes with BOTH a fixed `h-`
             * and a fixed `w-`. `min-h-11 min-w-11` are not fixed sizes, so the
             * literal translation would be an offender. The shipped
             * `HeaderSearch` trigger form is copied instead.
             */
            aria-label={t("nav.trigger")}
            aria-controls={sheetOpen ? sheetId : undefined}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-secondary"
          >
            <MenuIcon />
          </DialogTrigger>
          <DialogContent
            id={sheetId}
            /*
             * EXPLICITLY UNDESCRIBED. Radix warns on every open when Content has
             * neither a Description nor an explicit `aria-describedby={undefined}`,
             * and the bar is zero console output. The sheet has no description to
             * give — its Title names it — so the correct answer is to opt out
             * rather than mint copy for a warning.
             *
             * `max-w-[386px]` is the ruled figure (mockup frame A), capped HERE
             * rather than in the primitive: `ui/dialog.tsx` is shared and its
             * geometry — full-width, `top-0`, content-driven height — is already
             * what UX-DR24 asks for. Do not edit a primitive for one consumer.
             *
             * 🔴 `ml-auto mr-0` IS NOT DECORATION (2026-08-26 code review, ruled
             * by Juan). The primitive ships `fixed inset-x-0 top-0 … w-full`, so
             * adding a `max-width` OVER-CONSTRAINS `left:0; right:0; width` —
             * and CSS resolves that by ignoring `right` in LTR. The sheet
             * therefore rendered as a 386 px column hard against the LEFT edge
             * at every width from 387 px to 1279 px, while the trigger sat at
             * the other end of the row. Below 387 px it was correct only because
             * the cap never engaged. The mockup drew phone frames only and the
             * Task 9 matrix samples 195/320/390/1280, so the entire band the
             * `md`→`xl` move created was never opened. Ruled at review: the
             * sheet opens from the edge its trigger lives on.
             */
            aria-describedby={undefined}
            className="ml-auto mr-0 max-w-[386px]"
          >
            {/*
             * Radix requires a Title or the panel is an unnamed `role="dialog"`
             * (an axe `aria-dialog-name` failure plus a Radix console error).
             * `asChild` into an sr-only span keeps it out of the heading outline
             * — `popover.tsx` and `HeaderSearch.tsx` both record this reason.
             */}
            <DialogTitle asChild>
              <span className="sr-only">{t("nav.sheetTitle")}</span>
            </DialogTitle>
            {/*
             * THE SHEET'S OWN LIVE REGION, inside the portal and therefore
             * outside the subtree Radix inerts. It mounts EMPTY with the sheet
             * and is populated only by a later announcement, which is the
             * condition "a live region that mounts already-populated does not
             * announce reliably" requires. The header's region is inside a
             * `hidden` subtree at these widths, so the two can never both be
             * live.
             */}
            <span aria-live="polite" className="sr-only">
              {announcement}
            </span>
            {/*
             * Sheet body, in the mockup's order: search, then destinations, then
             * the language and theme controls below a hairline.
             *
             * THE SEARCH IS FIRST, AND THAT IS THE FOCUS RULING. UX-DR15 puts
             * initial focus on the sheet's first focusable element, and by DOM
             * order that is the search input — so Radix's own initial focus
             * lands correctly WITHOUT an `autoFocus` fight. `dismissClosesHost`
             * stays true: one Escape closes the whole sheet, listbox included
             * (Story 2.14's ruling 3).
             */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <SearchField
                  corpus={corpus}
                  status={status}
                  onEngage={engage}
                  onAnnounce={announce}
                  locale={locale}
                  dismissClosesHost
                />
              </div>
              <DialogClose
                aria-label={t("nav.close")}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary"
              >
                <CloseIcon />
              </DialogClose>
            </div>
            <nav aria-label={t("nav.landmark")}>
              <DestinationList variant="sheet" />
            </nav>
            {/*
             * THE PRICE, PAID DELIBERATELY: on phones, language and theme move
             * from one tap to two. That is the stated, accepted cost of holding
             * the 320 px floor and story 3.6's signature at the same time. Do
             * not "fix" it by hoisting these back into the header row — that is
             * the fifth row element the width argument above rules out.
             */}
            <div className="flex items-center gap-tile-gap border-t border-hairline pt-tile-gap">
              <LocaleAndThemeControls />
            </div>
          </DialogContent>
        </Dialog>
      </nav>
    </>
  );
}

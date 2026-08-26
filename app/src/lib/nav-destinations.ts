import type { DictionaryKey } from "@/lib/i18n";

/*
 * ══════════ THE NAVIGATION DESTINATION TABLE — Story 3.10, UX-DR24 ══════════
 *
 * Nine destinations in one ruled order, consumed by BOTH of `SiteNav`'s
 * presentations (the `<xl` sheet and the `≥xl` inline row) so the two can never
 * drift. EXPERIENCE.md → Navigation is the source of the order; the labels are
 * the ruled badge set from EXPERIENCE.md → The Landing Page, verbatim.
 *
 * ═══════ WHY `available` IS A DECLARED FLAG AND NOT A FILESYSTEM PROBE ══════
 *
 * Four of the nine routes do not exist yet. `/tournament`, `/tops`, `/players`
 * and `/teams` are story 3.9's, and they take the route count 1,406 → 1,410.
 * Until 3.9 mints them, linking to them would ship a 404 into the site chrome of
 * every one of 1,406 pre-rendered routes — and a nav that 404s is worse than a
 * nav that is honest about its size.
 *
 * A runtime check is not available to us: `SiteNav` is a client component
 * pre-rendered into every HTML file, so it has no filesystem to ask. The flag is
 * therefore static data — and `nav-destinations.test.ts` IS WHAT BINDS IT TO
 * REALITY. That gate asserts a bijection in both directions: every `true` has a
 * `page.tsx`, and every `false` has none.
 *
 * 🔴 SO THE FLAG IS NOT A HACK, AND THE COUPLING IS THE POINT. When story 3.9
 * mints the four routes, direction 2 of that gate goes RED and stays red until
 * these four booleans are flipped. At that moment the nav completes itself:
 * nine entries render, in both presentations, WITH NO CHANGE TO ANY COMPONENT.
 * 3.9 edits this file and nothing else in the nav.
 *
 * ═══════ WHY `route` IS DECLARED RATHER THAN DERIVED ════════════════════════
 *
 * `matches` points at `/tournament#results` — a SURFACE fragment on the
 * Tournament Hub, not a match route. Availability is a property of the route, so
 * two destinations can share one, and stripping the fragment at each call site
 * would be the same derivation written three times. It is also what
 * `aria-current="page"` compares against (D12): comparing `href` would leave
 * *Partidos* permanently unmarked, since no pathname ever equals a fragment.
 *
 * ═══════ NO MATCH ROUTES HERE, AND THAT IS AC 2 HOLDING (D2) ════════════════
 *
 * `#results` is a surface fragment: per EXPERIENCE.md → Deep-Link Fragment
 * Grammar it scrolls and opens nothing, deliberately, because opening it would
 * expand all nine round sections and rebuild the DOM weight Story 2.19 moved
 * behind disclosure. No destination is a match route, so this module imports
 * nothing from story 3.8's `match-anchors.ts` / `use-anchor-nonce.ts` and adds
 * no `hashchange` handling — one deep-link mechanism, not two. The test pins it.
 *
 * PURE DATA. No React, no DOM, no `next/*` — so the gate can read it in the
 * `node` environment without a jsdom pragma, and so it stays out of the ESLint
 * client-import seam that governs `src/components/**`.
 */

export interface NavDestination {
  /** Stable identity, used by tests and by React keys. Never rendered. */
  key: string;
  /** The accessible name's source. Typed, so a missing leaf is a compile error. */
  labelKey: DictionaryKey;
  /** Where the link goes, fragment included. */
  href: string;
  /**
   * The route the href lands on, fragment stripped.
   *
   * What `available` is checked against, and what `aria-current="page"` compares
   * a pathname to. Exact match only — a profile is not its index (D12).
   */
  route: string;
  /** False ⇒ the route does not exist yet, so the entry does not render at all. */
  available: boolean;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    key: "home",
    labelKey: "nav.destinations.home",
    href: "/",
    route: "/",
    available: true,
  },
  {
    key: "compare",
    labelKey: "nav.destinations.compare",
    href: "/compare",
    route: "/compare",
    available: true,
  },
  {
    key: "tournament",
    labelKey: "nav.destinations.tournament",
    href: "/tournament",
    route: "/tournament",
    available: false,
  },
  {
    key: "matches",
    labelKey: "nav.destinations.matches",
    href: "/tournament#results",
    route: "/tournament",
    available: false,
  },
  {
    key: "tops",
    labelKey: "nav.destinations.tops",
    href: "/tops",
    route: "/tops",
    available: false,
  },
  {
    /*
     * ⚠️ `/players` IS THE INDEX, AND IT DOES NOT EXIST. Only
     * `src/app/players/[slug]/page.tsx` does. A directory-level availability
     * check would find `players/` present and mark this entry available, which
     * is precisely how a nav entry comes to point at a 404 — so the gate rejects
     * any route carrying a dynamic segment rather than resolving it.
     */
    key: "players",
    labelKey: "nav.destinations.players",
    href: "/players",
    route: "/players",
    available: false,
  },
  {
    /** Same index-vs-profile shape as `players` above. */
    key: "teams",
    labelKey: "nav.destinations.teams",
    href: "/teams",
    route: "/teams",
    available: false,
  },
  {
    key: "glossary",
    labelKey: "nav.destinations.glossary",
    href: "/glossary",
    route: "/glossary",
    available: true,
  },
  {
    key: "about",
    labelKey: "nav.destinations.about",
    href: "/about",
    route: "/about",
    available: true,
  },
];

/** The entries that render. Four today; nine once story 3.9 lands. */
export function availableDestinations(): readonly NavDestination[] {
  return NAV_DESTINATIONS.filter((destination) => destination.available);
}

/**
 * Which destination, if any, the given pathname IS.
 *
 * Exact match only (D12). `/players/ramirez-julian-mex` must not mark
 * *Jugadores* as the current page, and once 3.9 mints `/players` it must not
 * either — a profile is not its index, and marking it would tell a screen
 * reader the reader is somewhere they are not.
 */
export function currentDestinationKey(pathname: string): string | null {
  const match = NAV_DESTINATIONS.find(
    (destination) => destination.available && destination.route === pathname
  );
  return match?.key ?? null;
}

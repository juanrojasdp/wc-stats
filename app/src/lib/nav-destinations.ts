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
 * ⚠️ BUT NOT WITH NO CHANGE TO THE HEADER TOKEN (2026-08-26 code review).
 * `DESIGN.md` rules that ANY change to the header's composition changes
 * `--header-h`, and flipping these four flags adds five inline links to the
 * `≥xl` row. Story 3.10's own 9.5 table already shows the search input squeezed
 * from 511 px to 158 px in `es` at 1280 px, so the row is at its limit before
 * the five arrive. The bijection gate binds the flag to the filesystem; NOTHING
 * binds it to a re-measurement of the token. Story 3.9 must re-run the R2/D8
 * matrix and re-derive `--spacing-header-h-*` after flipping these, or the row
 * wraps to 118 px while the token still reports 62 and every anchor and the
 * skip link go back behind the bar.
 *
 * ═══════ WHY `route` IS DECLARED RATHER THAN DERIVED ════════════════════════
 *
 * `matches` points at `/tournament/#results` — a SURFACE fragment on the
 * Tournament Hub, not a match route. Availability is a property of the route, so
 * two destinations can share one, and stripping the fragment at each call site
 * would be the same derivation written three times. It is also what
 * `aria-current="page"` compares against (D12): comparing `href` would leave
 * *Partidos* permanently unmarked, since no pathname ever equals a fragment.
 *
 * 🔴 EVERY PATH HERE ENDS IN A SLASH, AND BOTH HALVES BREAK WITHOUT IT
 * (2026-08-26 code review). `next.config.ts` sets `trailingSlash: true`, which
 * this repo already treats as ruled: `compare-url.ts` ships
 * `COMPARE_PATH = "/compare/"` under the comment "the slash is mandatory", and
 * `PlayerHero.tsx` records that "a slash-less `/compare?…` is a REDIRECT rather
 * than a link". Both halves of this table were shipped slash-less and both were
 * wrong:
 *
 *   `href`  — a slash-less href is a 301 hop on the static export, on every nav
 *             click. For `matches` it is worse: the ruled fragment form is
 *             `/tournament/#results` (`PlayerMatchesSection.tsx`: "THE TRAILING
 *             SLASH BEFORE `#` IS MANDATORY"), so the fragment rode a redirect.
 *
 *   `route` — Next 16 derives `usePathname()` from `location.href` with NO
 *             trailing-slash normalisation, so the live value is `/compare/`.
 *             Compared with `===` against a slash-less `/compare` it never
 *             matched, and `aria-current="page"`, the inline underline and the
 *             sheet's lime marker were silently absent on every destination
 *             except `/`. The tests missed it because they mocked `usePathname`
 *             with slash-less literals — asserting against an input the app
 *             cannot produce. The gate now pins the slash on both fields.
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

/**
 * The nine identities, as a union rather than `string` (2026-08-26 code review).
 *
 * Three call sites cast `destination.key` to `keyof typeof es.nav.destinations`
 * to look a label up. Against a bare `string` that cast was UNCHECKED, so a typo
 * or a mis-paired row compiled clean and the static-output guard then looked up
 * a leaf that did not exist, counted zero, and PASSED — defeating the gate whose
 * whole job is catching exactly that. The union makes those casts checked; the
 * `labelKey`-matches-`key` assertion in `nav-destinations.test.ts` closes the
 * other half, which no type can express across an array literal.
 */
export type NavDestinationKey =
  | "home"
  | "compare"
  | "tournament"
  | "matches"
  | "tops"
  | "players"
  | "teams"
  | "glossary"
  | "about";

export interface NavDestination {
  /** Stable identity, used by tests and by React keys. Never rendered. */
  key: NavDestinationKey;
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
    href: "/compare/",
    route: "/compare/",
    available: true,
  },
  {
    key: "tournament",
    labelKey: "nav.destinations.tournament",
    href: "/tournament/",
    route: "/tournament/",
    available: false,
  },
  {
    key: "matches",
    labelKey: "nav.destinations.matches",
    href: "/tournament/#results",
    route: "/tournament/",
    available: false,
  },
  {
    key: "tops",
    labelKey: "nav.destinations.tops",
    href: "/tops/",
    route: "/tops/",
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
    href: "/players/",
    route: "/players/",
    available: false,
  },
  {
    /** Same index-vs-profile shape as `players` above. */
    key: "teams",
    labelKey: "nav.destinations.teams",
    href: "/teams/",
    route: "/teams/",
    available: false,
  },
  {
    key: "glossary",
    labelKey: "nav.destinations.glossary",
    href: "/glossary/",
    route: "/glossary/",
    available: true,
  },
  {
    key: "about",
    labelKey: "nav.destinations.about",
    href: "/about/",
    route: "/about/",
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
export function currentDestinationKey(pathname: string): NavDestinationKey | null {
  const match = availableDestinations().find(
    (destination) => destination.route === pathname
  );
  return match?.key ?? null;
}

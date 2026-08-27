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
 * ✅ ALL NINE ROUTES NOW EXIST. Story 3.9 minted `/tournament`, `/tops`,
 * `/players` and `/teams` — FOUR page files — and took the route count
 * 1,406 → 1,410. Every flag below reads `true`, and this block is kept rather
 * than deleted because it explains a mechanism that is still load-bearing.
 *
 * Before 3.9, linking to an unbuilt route would have shipped a 404 into the site
 * chrome of every one of 1,406 pre-rendered routes — a nav that 404s is worse
 * than a nav that is honest about its size.
 *
 * A runtime check is not available to us: `SiteNav` is a client component
 * pre-rendered into every HTML file, so it has no filesystem to ask. The flag is
 * therefore static data — and `nav-destinations.test.ts` IS WHAT BINDS IT TO
 * REALITY. That gate asserts a bijection in both directions: every `true` has a
 * `page.tsx`, and every `false` has none.
 *
 * 🔴 THE COUPLING WAS THE POINT, AND IT WORKED. When story 3.9 minted the four
 * routes, direction 2 of that gate went RED and stayed red until the booleans
 * were flipped — driven deliberately, with the failing output recorded in that
 * story's Dev Agent Record (A1). The nav then completed itself: nine entries
 * render, in both presentations, WITH NO CHANGE TO ANY COMPONENT. 3.9 edited
 * this file and nothing else in the nav.
 *
 * ⚠️ IT IS FIVE BOOLEANS, NOT FOUR, AND EVERY OTHER ARTIFACT IN THIS REPO SAID
 * FOUR. Story 3.10's file, its completion notes, two `sprint-status.yaml` lines,
 * the `d073575` commit message and an earlier version of THIS comment all said
 * "3.9 flips four booleans". They were off by one: `matches` and `tournament`
 * share the route `/tournament/` and differ only by the `#results` fragment, so
 * nine destinations over EIGHT DISTINCT ROUTES needed FOUR new page files and
 * FIVE flag flips. `es.ts:86` was the one artifact that had it right. Story 3.9
 * drove the resulting failure red on purpose (its Task 11.3) so the off-by-one
 * became evidence rather than folklore. Three different correct numbers —
 * 9 destinations, 8 routes, 4 files, 5 flags — are routinely quoted as if
 * interchangeable.
 *
 * ⚠️ THE HEADER TOKEN WAS RE-MEASURED, NOT ASSUMED (2026-08-26 code review,
 * discharged by story 3.9 Task 10.5). `DESIGN.md` rules that ANY change to the
 * header's composition changes `--header-h`, and flipping these flags added five
 * inline links to the `≥xl` row. The bijection gate binds the flag to the
 * filesystem; NOTHING binds it to a re-measurement of the token, so 3.9 re-ran
 * the R2/D8 matrix rather than predicting the outcome — predictions about this
 * token have been wrong twice. The measured values are in that story's Dev Agent
 * Record.
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
  /**
   * False ⇒ the route has no `page.tsx`, so the entry does not render at all.
   * ALL NINE READ TRUE since story 3.9; the flag is kept because it is what the
   * bijection gate binds, in both directions, and because a route DELETED in
   * future must be able to turn one of these back to `false`.
   */
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
    available: true,
  },
  {
    key: "matches",
    labelKey: "nav.destinations.matches",
    href: "/tournament/#results",
    route: "/tournament/",
    available: true,
  },
  {
    key: "tops",
    labelKey: "nav.destinations.tops",
    href: "/tops/",
    route: "/tops/",
    available: true,
  },
  {
    /*
     * ⚠️ `/players` IS THE INDEX, AND IT IS NOT THE PROFILE ROUTE.
     * `src/app/players/page.tsx` (story 3.9) and
     * `src/app/players/[slug]/page.tsx` are two different routes; Next resolves
     * them independently.
     *
     * THE RULING THE INDEX'S ARRIVAL DOES NOT RETIRE: a DIRECTORY-LEVEL
     * availability check would have found `players/` present and marked this
     * entry available for the whole of the 1,248 profiles' existence, before any
     * index page was written — which is precisely how a nav entry comes to point
     * at a 404. So the gate still rejects any route carrying a dynamic segment
     * rather than resolving it, and still resolves this one to a LITERAL
     * `src/app/players/page.tsx`. The claim that has changed is only "it does not
     * exist"; the mechanism is untouched.
     */
    key: "players",
    labelKey: "nav.destinations.players",
    href: "/players/",
    route: "/players/",
    available: true,
  },
  {
    /** Same index-vs-profile shape as `players` above, minted by the same story. */
    key: "teams",
    labelKey: "nav.destinations.teams",
    href: "/teams/",
    route: "/teams/",
    available: true,
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

/** The entries that render. All NINE, since story 3.9 minted the last four routes. */
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
 *
 * ⚠️ `tournament` SHADOWS `matches`, DELIBERATELY (documented at code review
 * 2026-08-27). Two entries declare `route: "/tournament/"` — *Torneo* and
 * *Partidos*, which differ only by the `#results` fragment D1 rules — and
 * `.find()` returns the first, so *Partidos* NEVER receives `aria-current`
 * on any pathname on this site.
 *
 * That is correct and is not a bug to fix: one URL has one current destination,
 * and D1 rules that *Partidos* is contained by *Torneo* rather than a sibling of
 * it. It is written down because the shadowing became REACHABLE only when story
 * 3.9 flipped both flags — before that both were unavailable and `.find()` saw
 * neither — and because the obvious "fix" (matching the fragment, or hoisting
 * `matches` above `tournament`) would put `aria-current="page"` on two entries
 * at once, which is the actual defect.
 */
export function currentDestinationKey(pathname: string): NavDestinationKey | null {
  const match = availableDestinations().find(
    (destination) => destination.route === pathname
  );
  return match?.key ?? null;
}

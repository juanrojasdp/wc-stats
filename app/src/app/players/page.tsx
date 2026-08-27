import type { Metadata } from "next";

import { PlayersIndexRegion } from "@/components/PlayersIndexRegion";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";
import { composeRouteTitle } from "@/lib/route-title";

/*
 * `/players` — THE PLAYER INDEX (Story 3.9, UX-DR24, D4).
 *
 * ═══════════ IT SITS BESIDE `[slug]/`, AND THAT COLLIDES WITH NOTHING ═══════
 *
 * `src/app/players/page.tsx` and `src/app/players/[slug]/page.tsx` are resolved
 * INDEPENDENTLY by Next: the index and the dynamic segment are different routes
 * at different paths. Before this story `out/players/` held 1,248 slug
 * directories and no `index.html`; it now holds 1,248 and one.
 *
 * 🔴 PLAIN PATH, `.tsx`, NO ROUTE GROUP — and this is not a style preference
 * (D7, ledger `deferred-work.md:4826`, which names story 3.9 as its owner).
 * Two independent mechanisms break if this file moves:
 *
 *   1. `nav-destinations.test.ts`'s `pageFor()` resolves a declared route to
 *      `src/app{route}/page.tsx` LITERALLY. A route inside
 *      `src/app/(landing)/players/` does not turn direction 2 of the
 *      availability gate red, so the `available` boolean is never flipped, and
 *      the nav ships four entries wide beside a live, unlinked page — the
 *      precise failure direction 2 exists to catch, passing green.
 *   2. `sitemap.ts`'s `assertPlainSegment` THROWS on a segment starting with
 *      `(` or `@`, so `next build` fails during "Collecting page data".
 *
 * Two further shapes to avoid: a static route nested BENEATH a dynamic one
 * (bracketed directories are skipped before recursing), and a `_private` folder
 * name (skipped entirely).
 *
 * ═══════════ THE 1,248 COME DOWN THE RUNTIME PATH ═══════════
 *
 * This shell reads NO artifact — its `<title>` composes from a locale string.
 * `PlayersIndexRegion` fetches `/index/tournament.json` at runtime, following
 * `TournamentHubRegion`'s four-state machine. Build-time-reading the 1,248 into
 * the export is the AD-11 violation D5b names explicitly, and it would put
 * 409 KB onto this route's own first Lighthouse median.
 *
 * `output: "export"` with no dynamic segment HERE, so this route needs no
 * `generateStaticParams` — `[slug]/page.tsx` has its own and is untouched.
 */

/*
 * THE "<title> STAYS SPANISH" QUESTION IS CLOSED, NOT OPEN (D8).
 * `deferred-work.md:4163` records D17, ruled by Juan 2026-08-25: ACCEPT ES
 * CANONICAL, closed on all 104 + 1,248 + 48 + Hub routes. This route takes no
 * new position by carrying a title.
 *
 * The string is composed in a PURE HELPER, never inline: the i18n gate flags any
 * template or concatenation that is the direct value of a `title:`/`description:`
 * property, and `--max-warnings 0` makes that a build error.
 */
export function generateMetadata(): Metadata {
  const title = composeRouteTitle({
    surfaceLabel: t("players.title"),
    siteName: t("app.siteName"),
    separator: t("hub.separator"),
  });
  const description = t("players.meta.description");
  /*
   * `og:image` IS A SAME-ORIGIN CARD, AND THE ORIGIN GATE DOES NOT HOLD THIS
   * LINE (D20, Story 3.3). AR-11's "zero external requests" scopes to
   * THIRD-PARTY ORIGINS: a URL in a `<meta>` tag is not a request this page
   * makes at all. `FETCHING_POSITIONS` in
   * `scripts/assert-no-external-origins.mjs` is the operative definition of "a
   * request" and `<meta content>` is deliberately not in it — so that script
   * REPORTS an off-origin card and PASSES. What holds this line is
   * `canonical-output.test.ts` over the whole export, and nothing else.
   *
   * `url: "./"` IS LOAD-BEARING (Story 3.2, AC2). The canonical comes from the
   * root layout and is inherited here because this file declares NO
   * `alternates`; `openGraph` is REPLACED WHOLESALE by the key a child
   * declares, so the layout's `url` never reaches this route. Drop the line and
   * this page ships a canonical with no matching `og:url` — silently.
   *
   * `locale: "es_ES"` rides the same trap. Drop it and this Spanish page
   * advertises the Open Graph default, `en_US`, to every unfurler. One locale
   * per route is a constant (D17/D20). `type`, `siteName` and `images` ride it
   * too (Story 3.3, AC2).
   *
   * THE OBJECT IS NOT LIFTED INTO A SHARED HELPER — that would move `alt:` out
   * of the eslint metadata selector's reach and silently disable the rule that
   * makes a bare Spanish literal a build error. THE URL ALONE IS LIFTED, to
   * `@/lib/og-card`: the whole-export gate asserts the URL's exact VALUE only
   * because all sites import that one constant. An inline literal here re-opens
   * the drift hole that shipped 1,405 documents pointing at a 404, green.
   *
   * NO `alternates` KEY, for any reason — `mergeMetadata` branches on key
   * PRESENCE. NO `twitter` KEY — declared once on the layout and inherited.
   */
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "./",
      locale: "es_ES",
      type: "website",
      siteName: t("app.siteName"),
      images: [
        { url: OG_CARD_PATH, width: 1200, height: 630, alt: t("meta.ogImageAlt") },
      ],
    },
  };
}

export default function PlayersIndexPage() {
  return (
    /*
     * `py-`, not `pb-`: this route leads with an <h1> under the sticky header.
     *
     * THE <h1> AND THE SECTION HEADINGS RENDER WITH THE SHELL, not with the
     * data (EXPERIENCE.md → State Patterns, cold route load): the surface's
     * shape must be readable before any artifact lands. The <h1> is here, in the
     * pre-rendered server component; the 48 group headings arrive with the fetch
     * because their names come from the artifact, and the skeleton is shaped
     * like them in the meantime.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-display text-ink-primary">{t("players.title")}</h1>
      <PlayersIndexRegion />
    </div>
  );
}

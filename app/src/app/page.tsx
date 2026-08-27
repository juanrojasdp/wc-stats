import type { Metadata } from "next";

import { LandingContent } from "@/components/LandingContent";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";
import { composeRouteTitle } from "@/lib/route-title";

/*
 * `/` — THE LANDING SURFACE (Story 3.9, UX-DR24, FR-39 / NFR-11).
 *
 * ═══════════ WHAT USED TO BE HERE, AND WHERE IT WENT ═══════════
 *
 * This file was the TOURNAMENT HUB (Story 2.12) with Story 2.13's leaderboards
 * section beneath it. UX-DR24 split that surface across two addresses and gave
 * `/` a job it never had:
 *
 *   · results + standings  → `src/app/tournament/page.tsx`, with this file's
 *     entire `generateMetadata` (`composeHubTitle`, `meta.description`) moved
 *     VERBATIM and the one-provider rule intact.
 *   · the leaderboards mount → `src/app/tops/page.tsx`, RE-SITED and not
 *     duplicated: `LEADERBOARDS_SECTION_ID` is still defined once and rendered
 *     once, so there is no second `id="leaders"` anywhere in the export.
 *
 * `/` now orients a first arrival instead of burying them in tables — a lede,
 * eight badges, and the global attribution footer. That is FR-39's whole ask,
 * and NFR-11 is why it is not a third table surface.
 *
 * ═══════════ THIS ROUTE READS NO ARTIFACT — NEITHER PATH ═══════════
 *
 * AD-11 allows exactly two data paths and `/` takes neither (story 3.9 D5b):
 * NO build-time `readTournament()`/`readLeaderboards()`, NO runtime fetch. Its
 * reachable-artifact list is the EMPTY SET, and `static-output.test.ts` asserts
 * that literally — the gate that catches a build-time read of the 409 KB index
 * sneaking back onto the landing page, which would put that weight straight
 * onto this route's own Lighthouse floor.
 *
 * IT TAKES TWO ASSERTIONS TO HOLD THAT LINE, NOT ONE (code review 2026-08-27).
 * The `reachable` walk matches `fetchArtifact<T>(…)` and is therefore blind to
 * a build-time `readTournament()`; for a while this docblock credited it with
 * catching something it could not see. The build-time half is now asserted
 * separately, by `buildDataReadsReachableFrom` in the same file.
 *
 * Consequently there is NO loading state and NO empty state here
 * (EXPERIENCE.md → State Patterns): a surface with no data has no data states.
 *
 * `output: "export"` with no dynamic segment, so this route needs no
 * `generateStaticParams`.
 *
 * A SERVER COMPONENT over a client body — the shipped house pattern, stated at
 * `players/[slug]/page.tsx:14-22` and followed by `/about`, `/glossary` and
 * `/compare`. The client boundary is what makes the language toggle work at
 * all: a server `t()` renders canonical Spanish into the static export and
 * never changes again. The body lives in `src/components/`, NOT colocated under
 * `src/app/`, because colocating escapes the ESLint client-import seam.
 */

/*
 * NO BUILD-TIME READ HERE, NOT EVEN FOR THE TITLE — and that is the one way
 * this export differs from the four other routes with metadata. `/tournament`,
 * `/tops`, `/players` and `/teams` each read an artifact or compose from a
 * surface label; `/`'s title is a locale string, because D5b puts this route's
 * reachable-artifact list at `[]` and a `readTournament()` call for a `<title>`
 * would be a third data path on the one route that has none.
 *
 * The string is composed in a PURE HELPER, never inline: the i18n gate flags any
 * template or concatenation that is the direct value of a `title:`/`description:`
 * property, even when every fragment is a t() call, and `--max-warnings 0` makes
 * that a build error.
 *
 * THE "<title> STAYS SPANISH" QUESTION IS CLOSED, NOT OPEN (D8).
 * `deferred-work.md:4163` records D17, ruled by Juan 2026-08-25: ACCEPT ES
 * CANONICAL. `/` already carried a title before this story, so no new position
 * is taken here either way.
 */
export function generateMetadata(): Metadata {
  const title = composeRouteTitle({
    surfaceLabel: t("landing.title"),
    siteName: t("app.siteName"),
    separator: t("hub.separator"),
  });
  const description = t("landing.meta.description");
  /*
   * `og:image` IS A SAME-ORIGIN CARD, AND THE ORIGIN GATE DOES NOT HOLD THIS
   * LINE (D20, Story 3.3). AR-11's "zero external requests" scopes to
   * THIRD-PARTY ORIGINS: a URL in a `<meta>` tag is not a request this page
   * makes at all — it is a hint a crawler may fetch, off-page and off-session,
   * and it cannot touch LCP, TBT, the payload budget or the NFR-9 telemetry
   * surface. `FETCHING_POSITIONS` in `scripts/assert-no-external-origins.mjs` is
   * the operative definition of "a request" and `<meta content>` is deliberately
   * not in it — so that script REPORTS an off-origin card and PASSES. What holds
   * this line is `canonical-output.test.ts` over the whole export, and nothing
   * else.
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

export default function Home() {
  return (
    /*
     * `py-`, not `pb-`: this route leads with an <h1> under the sticky site
     * header, and dropping the top half leaves it flush against the bar.
     *
     * NO `SortAnnouncerProvider`. 2.11a decision 9 scopes one polite
     * sort-announcement region to a page that HAS a sortable `DataTable`, and
     * this one renders none by construction (D1: no table on `/`). Mounting a
     * provider with nothing to announce would be an empty live region on the
     * site's entry route.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <LandingContent />
    </div>
  );
}

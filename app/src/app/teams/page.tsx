import type { Metadata } from "next";

import { TeamsIndexRegion } from "@/components/TeamsIndexRegion";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";
import { composeRouteTitle } from "@/lib/route-title";

/*
 * `/teams` — THE TEAM INDEX (Story 3.9, UX-DR24, D5).
 *
 * Sits beside `src/app/teams/[slug]/page.tsx` and collides with nothing: Next
 * resolves the index and the dynamic segment independently.
 *
 * 🔴 PLAIN PATH, `.tsx`, NO ROUTE GROUP (D7, ledger `deferred-work.md:4826`).
 * `nav-destinations.test.ts`'s `pageFor()` resolves a declared route to
 * `src/app{route}/page.tsx` LITERALLY, so a route group defeats the availability
 * gate SILENTLY; and `sitemap.ts`'s `assertPlainSegment` throws on a
 * parenthesised segment, failing `next build` outright. The full reasoning is at
 * `src/app/players/page.tsx`.
 *
 * ⚠️ THIS SURFACE IS KNOWINGLY REDUNDANT with `/tournament#standings`, which
 * carries the same 48 with more competitive context. It exists so no member of
 * the ruled badge grid resolves to a FRAGMENT while its neighbours resolve to
 * pages — a navigation-consistency reason, not an information one, recorded as a
 * cost rather than dressed up as a benefit. `TeamsIndexRegion`'s docblock
 * carries the full statement.
 *
 * The 48 come down the RUNTIME path, like `/players` and for the same AD-11
 * reason. This shell reads no artifact.
 */

/*
 * THE "<title> STAYS SPANISH" QUESTION IS CLOSED, NOT OPEN (D8) —
 * `deferred-work.md:4163`, D17, ruled by Juan 2026-08-25. Composed in a PURE
 * HELPER because the i18n gate flags a template as the direct value of `title:`,
 * and `--max-warnings 0` makes that a build error.
 */
export function generateMetadata(): Metadata {
  const title = composeRouteTitle({
    surfaceLabel: t("teams.title"),
    siteName: t("app.siteName"),
    separator: t("hub.separator"),
  });
  const description = t("teams.meta.description");
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

export default function TeamsIndexPage() {
  return (
    /* `py-`, not `pb-`: the route leads with an <h1> under the sticky header,
       and that <h1> renders with the SHELL so the surface's shape is readable
       before the artifact lands. */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <h1 className="type-display text-ink-primary">{t("teams.title")}</h1>
      <TeamsIndexRegion />
    </div>
  );
}

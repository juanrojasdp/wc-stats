import type { Metadata } from "next";

import { LeaderboardsSection } from "@/components/LeaderboardsSection";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { readLeaderboards } from "@/lib/build-data";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";
import { composeRouteTitle } from "@/lib/route-title";
import { leaderboardTeasers } from "@/viz/leaderboard-model";

/*
 * `/tops` — LÍDERES DEL TORNEO, RE-SITED (Story 3.9, UX-DR24).
 *
 * ═══════════ RE-SITED, NEVER DUPLICATED ═══════════
 *
 * AC 1 offered "preserved or deliberately re-sited". EXPERIENCE.md:66 chooses:
 * "Story 2.13's leaderboards mount moves to `/tops` with its `#leaders` anchor
 * — re-sited, never duplicated, since two elements carrying that id would be a
 * duplicate-id defect."
 *
 * So `LEADERBOARDS_SECTION_ID` is NOT touched, and NO second `<div id="leaders">`
 * is minted here. The constant is defined once at `LeaderboardsSection.tsx:73`
 * and rendered once at `:81`; `page.tsx` and `hub-model.ts:115-127` both record
 * a previous attempt at a second id being removed at review. The section renders
 * its own anchor and always has — this file supplies the route, not the id.
 *
 * ═══════════ THE SLUG IS `/tops`, THE LABEL IS "Líderes" ═══════════
 *
 * Not a mismatch and not an oversight — ruled by Juan at story 3.7. `es.ts`
 * ships `leaderboards.title: "Líderes del torneo"` as this page's own <h1>, so
 * a badge or nav entry reading "Tops" would be a SECOND Spanish name for one
 * surface. The ROUTE SLUG stays `/tops` because slugs are language-neutral
 * English and are not UI strings (story 2.18's ruled decision 11, the same rule
 * that renamed `#lideres` → `#leaders`). Do not re-open this.
 *
 * `output: "export"` with no dynamic segment, so this route needs no
 * `generateStaticParams`.
 */

/*
 * BUILD-TIME READ, TITLE + TEASERS ONLY (AD-11, and D5b's table for story 3.9).
 * The teasers are a PROJECTION — see the `leaderboardTeasers` call below — and
 * the full 36 boards come down the runtime path inside `LeaderboardsRegion`.
 *
 * The title is composed in a PURE HELPER, never inline: the i18n gate flags any
 * template or concatenation that is the direct value of a `title:`/`description:`
 * property, even when every fragment is a t() call.
 *
 * THE "<title> STAYS SPANISH" QUESTION IS CLOSED, NOT OPEN (D8).
 * `deferred-work.md:4163` records D17, ruled by Juan 2026-08-25: ACCEPT ES
 * CANONICAL. This route takes no new position by carrying a title.
 */
export function generateMetadata(): Metadata {
  const title = composeRouteTitle({
    surfaceLabel: t("leaderboards.title"),
    siteName: t("app.siteName"),
    separator: t("hub.separator"),
  });
  /*
   * FOLDED INTO `leaderboards.*` RATHER THAN A `topsPage.*` NAMESPACE. D16
   * offered both and asked the implementer to state which: this one, because the
   * whole `leaderboards.*` namespace moves to `/tops` with the surface it
   * describes, so the route's metadata belongs beside it rather than in a second
   * namespace naming the same surface by its slug.
   */
  const description = t("leaderboards.meta.description");
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

export default function TopsPage() {
  /*
   * PROJECTED, NOT PASSED WHOLE (Story 2.13 code review, carried verbatim).
   * `LeaderboardsSection` is a client component, so its prop is serialized into
   * this document's flight payload — handing it the full artifact inlined every
   * row to render three per board, and duplicated the bytes the runtime region
   * already fetches. `leaderboardTeasers` is the pure projection: <=3 rows per
   * board. The artifact is ~409 KB; this is the AD-11 line.
   */
  const teasers = leaderboardTeasers(readLeaderboards().boards);

  return (
    /*
     * `py-`, not `pb-`: `LeaderboardsSection` leads with its own <h1>
     * ("Líderes del torneo") directly under the sticky site header, so this
     * route needs the top rhythm for the same reason `/tournament` does — D2
     * conditions `py-` on leading with an <h1>, which this route now does.
     *
     * It led with an <h2> until code review 2026-08-27, which left this the
     * only route in the export with no <h1>; the tag was promoted in
     * `LeaderboardsSection` rather than a second heading added here, so the
     * `#leaders` / `leaders-title` pairing stays defined and rendered once.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      {/*
       * THIS ROUTE'S OWN SINGLE PROVIDER (Story 3.9 D9).
       *
       * 2.11a ruled decision 9 allows exactly ONE polite live region for sort
       * announcements PER PAGE. On `/` a single provider wrapped both the Hub
       * region and this section; splitting the route split the need, so
       * `/tournament` mounts one and `/tops` mounts one. Story 2.13's standing
       * instruction — "LIFT THIS PROVIDER TO THE PAGE … do NOT add a second
       * one" — is scoped to a page and is honoured: `LeaderboardsSection` still
       * mounts none of its own, and `useSortAnnounce()` walks up to this one.
       *
       * Getting this wrong FAILS SILENTLY, which is why 2.13 wrote that
       * instruction down rather than trusting it to be obvious.
       *
       * Mounted OUTSIDE every fetch/status gate: a live region that mounts
       * already-populated does not announce reliably.
       */}
      <SortAnnouncerProvider>
        <LeaderboardsSection teasers={teasers} />
      </SortAnnouncerProvider>
    </div>
  );
}

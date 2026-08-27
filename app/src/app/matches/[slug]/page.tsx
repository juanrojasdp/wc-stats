import type { Metadata } from "next";

import { MatchBundleRegion } from "@/components/MatchBundleRegion";
import { MatchHero } from "@/components/MatchHero";
import { readMatchBundle, readTournament } from "@/lib/build-data";
import { t } from "@/lib/i18n";
import { composeMatchTitle, stageLabelKey, toHeroData } from "@/lib/match-hero";

/*
 * The first dynamic route: /matches/[slug] (AR-11, AC 1). With output: 'export'
 * this MUST enumerate its params — generateStaticParams reads the tournament
 * manifest at build time (an fs read, AD-11) and pre-renders exactly the listed
 * matches. dynamicParams = false makes a non-manifest slug impossible, matching
 * the static export's "only what was generated exists" semantics.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return readTournament().entities.matches.map((match) => ({ slug: match.matchId }));
}

/*
 * Server-side (metadata is the ONE place a Hero-adjacent server t() is correct):
 * compose the title from the bundle's own metadata (ruled decision 8 — an
 * AD-11-legal fs read that carries knockoutScore directly). The string is built
 * in the pure helper, NOT inline, because the i18n lint gate flags any
 * template/concat that is the direct value of a title:/description: property.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { metadata } = readMatchBundle(slug);
  const stageLabel = t(stageLabelKey(metadata.stage));
  const title = composeMatchTitle({
    homeName: metadata.homeTeam.name,
    awayName: metadata.awayTeam.name,
    score: metadata.score,
    knockoutScore: metadata.knockoutScore,
    stageLabel,
    siteName: t("app.siteName"),
    separator: t("match.meta.separator"),
    scoreSeparator: t("match.hero.scoreSeparator"),
    penShort: t("match.meta.penShort"),
  });
  const description = `${stageLabel}${t("match.meta.separator")}${metadata.venue}`;
  /*
   * `og:image` IS A SAME-ORIGIN CARD, AND THE BAN THAT USED TO SIT ON THIS LINE
   * WAS AN OVER-READ (D20, 2026-08-26; Story 3.3). AR-11's "zero external
   * requests" clause scopes to THIRD-PARTY ORIGINS, not to assets as such: a URL
   * in a `<meta>` tag is not a request this page makes at all — it is a hint a
   * crawler may fetch, off-page and off-session, and it cannot touch LCP, TBT,
   * the payload budget or the NFR-9 telemetry surface. `FETCHING_POSITIONS` in
   * `scripts/assert-no-external-origins.mjs` is the operative definition of "a
   * request", and `<meta content>` is deliberately not in it.
   *
   * WHICH MEANS THE ORIGIN GATE DOES NOT HOLD THIS LINE. It reports an
   * off-origin `og:image` and passes. What holds it is
   * `canonical-output.test.ts` over the whole export, plus the per-route
   * assertions in `players/static-output.test.ts` and
   * `teams/static-output.test.ts` — and nothing else.
   */
  /*
   * `url: "./"` IS LOAD-BEARING AND MUST SURVIVE ANY FUTURE REWRITE OF THIS
   * `openGraph` OBJECT (Story 3.2, AC2). The CANONICAL comes from the root
   * layout and is inherited here because this file declares no `alternates`;
   * `openGraph`, by contrast, is REPLACED WHOLESALE by the key a child
   * declares, so the layout's `url` never reaches this route. Drop the line
   * below and this page ships a canonical with no matching `og:url` —
   * silently. `canonical-output.test.ts` is the gate that catches it.
   *
   * `locale: "es_ES"` rides the same trap and is load-bearing for the same
   * reason: this object REPLACES the layout's `openGraph` wholesale, so the
   * layout's locale never arrives here. Drop it and this Spanish page
   * advertises the Open Graph default, `en_US`, to every unfurler (review
   * 2026-08-26). One locale per route is a constant, not a variable (D17/D20).
   */
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "./",
      locale: "es_ES",
      /*
       * `type`, `siteName` and `images` ride the SAME wholesale-replacement
       * trap as `url` and `locale` above (Story 3.3, AC2): this object replaces
       * the layout's, so the layout's card never reaches this route. All three
       * are therefore authored at all five `openGraph` sites, and the object is
       * NOT lifted into a shared helper — that would move `alt:` out of the
       * eslint metadata selector's reach and silently disable the rule that
       * makes a bare Spanish literal a build error. The full reasoning lives
       * once, at `src/app/layout.tsx`; the whole-export gate in
       * `canonical-output.test.ts` is what stops the five copies drifting.
       *
       * The image URL is RELATIVE — `metadataBase` resolves it. An absolute
       * literal would be a second copy of the origin and turns
       * `site-origin.test.ts` red.
       */
      type: "website",
      siteName: t("app.siteName"),
      images: [
        { url: "/og-card.png", width: 1200, height: 630, alt: t("meta.ogImageAlt") },
      ],
    },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = readMatchBundle(slug);
  const data = toHeroData(bundle);
  return (
    /*
     * max-w-6xl is DESIGN's dashboard width: the ≥md two-column key-statistics
     * grid and 2.7's side-by-side pitch panels do not fit 672px. The Hero keeps
     * its own measure inside it.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">
      {/* Pre-rendered Hero from metadata + storyStats (AR-11 build-time path). */}
      <div className="mx-auto w-full max-w-2xl">
        <MatchHero data={data} />
      </div>
      {/* Below-Hero region fetches only this match's own bundle at runtime. */}
      <MatchBundleRegion matchId={slug} />
    </div>
  );
}

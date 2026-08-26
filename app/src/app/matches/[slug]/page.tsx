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
  // No og:image — zero external/asset requests (AR-11).
  /*
   * `url: "./"` IS LOAD-BEARING AND MUST SURVIVE ANY FUTURE REWRITE OF THIS
   * `openGraph` OBJECT (Story 3.2, AC2). The CANONICAL comes from the root
   * layout and is inherited here because this file declares no `alternates`;
   * `openGraph`, by contrast, is REPLACED WHOLESALE by the key a child
   * declares, so the layout's `url` never reaches this route. Drop the line
   * below and this page ships a canonical with no matching `og:url` —
   * silently. `canonical-output.test.ts` is the gate that catches it.
   */
  return { title, description, openGraph: { title, description, url: "./" } };
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

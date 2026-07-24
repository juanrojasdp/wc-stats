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
  return { title, description, openGraph: { title, description } };
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
    <div className="mx-auto max-w-2xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">
      {/* Pre-rendered Hero from metadata + storyStats (AR-11 build-time path). */}
      <MatchHero data={data} />
      {/* Below-Hero region fetches only this match's own bundle at runtime. */}
      <MatchBundleRegion matchId={slug} />
    </div>
  );
}

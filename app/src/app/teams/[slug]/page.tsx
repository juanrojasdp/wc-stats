import type { Metadata } from "next";

import { TeamHero } from "@/components/TeamHero";
import { TeamProfileRegion } from "@/components/TeamProfileRegion";
import { readTeamProfile, readTournament } from "@/lib/build-data";
import { stageLabelKey } from "@/lib/hub-model";
import { t } from "@/lib/i18n";
import { composeTeamDescription, composeTeamTitle, toTeamHeroData } from "@/lib/team-profile";

/*
 * `/teams/[slug]` (Story 2.16, FR-28, UJ-3). The third dynamic route, on
 * `/players/[slug]`'s shape exactly — same profile structure, same
 * projection-to-hero plus client-region split, same inherited `<title>`-language
 * note. With `output: 'export'` a route MUST enumerate its params, so
 * `generateStaticParams` reads the tournament manifest off the filesystem at
 * build time (AD-11) and pre-renders exactly the listed teams.
 * `dynamicParams = false` makes a non-manifest slug impossible, which is what a
 * static export's "only what was generated exists" semantics mean.
 *
 * THE BUILD READS FIXTURES. `build-data.ts`'s DATA_ROOT is `../data/fixtures`,
 * so this build generates ONE team route (`mexico`). The 48-route pre-render is
 * Story 2.19's cutover, which flips DATA_ROOT here and `src/lib/data.ts`'s
 * together.
 *
 * SEVEN OF THE EIGHT `/teams` SLUGS THAT SHIP ON THE BUILT EXPORT STILL 404, and
 * that is a FIXTURE PROPERTY rather than a defect of this route. `out/index.html`
 * emits czechia, germany, korea-republic and mexico from standings, and the four
 * match pages emit six more across their headers — but the fixture manifest
 * lists one team, so only `mexico` resolves. It resolves at 2.19's real-data
 * flip. Do not "fix" it by filtering the manifest.
 */
export const dynamicParams = false;

/**
 * The route manifest, mapped 1:1 with NO EXISTENCE FILTER (ruled D5).
 *
 * Filtering on whether the artifact file exists would convert a real pipeline
 * breach — AD-4 asserts a bijection between `entities.teams` and the emitted
 * profiles, "empty sections allowed, absence not", measured green at 48↔48 with
 * zero mismatches — into a route that silently vanishes from the site.
 * `readTeamProfile` throws instead, and the build fails naming the team.
 *
 * `teamId` IS the slug and no `encodeURIComponent` is needed:
 * `common.schema.json` fixes `TeamId` as "lowercase ASCII kebab, accent-stripped.
 * An id once emitted never changes" (AD-3).
 *
 * SYNCHRONOUS, unlike its two siblings below: Next 16 awaits `params` in
 * `generateMetadata` and in the page component, and in neither case here.
 */
export function generateStaticParams(): { slug: string }[] {
  return readTournament().entities.teams.map((team) => ({ slug: team.teamId }));
}

/*
 * `generateMetadata` is the ONE place a server `t()` from `@/lib/i18n` is
 * correct on this route (`MatchHero.tsx`: a server-t() BODY surface "would
 * freeze Spanish and ignore the language toggle"; metadata is emitted once per
 * build and has no toggle to ignore).
 *
 * Both strings are built by the pure helpers, NEVER inline — the i18n lint gate
 * flags any template or concatenation that is the DIRECT VALUE of a
 * `title:`/`description:` property, even when every fragment is a t() call.
 *
 * `openGraph` carries BOTH, because a `description` alone emits no OG tags at
 * all and AC 3 asks for OG. NO `og:image`: AR-11 permits zero external or asset
 * requests.
 *
 * THE CONTENT IS NAME + TOURNAMENT RECORD (`EXPERIENCE.md:42`). `record` carries
 * nine fields, so D7 rules the composition rather than leaving it open:
 * "{name} · {won}-{drawn}-{lost} · {siteName}", with the description adding the
 * resolved `furthestStage` label — the only carrier of progression on this route,
 * since `matches[].result` reads `draw` on the four shootout matches (1.18 R4).
 *
 * THIS ROUTE INHERITS THE UNRULED `<title>`-LANGUAGE QUESTION (owner: Juan,
 * filed once under Story 2.12 for `/`). The metadata is emitted in the build's
 * default dictionary regardless of the reader's toggle. Deliberately NOT
 * re-filed here — one entry, one owner.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = readTeamProfile(slug);
  const separator = t("team.meta.separator");
  const recordSeparator = t("team.meta.recordSeparator");
  const title = composeTeamTitle({
    name: profile.name,
    won: profile.record.won,
    drawn: profile.record.drawn,
    lost: profile.record.lost,
    siteName: t("app.siteName"),
    separator,
    recordSeparator,
  });
  const description = composeTeamDescription({
    name: profile.name,
    won: profile.record.won,
    drawn: profile.record.drawn,
    lost: profile.record.lost,
    furthestStageLabel: t(stageLabelKey(profile.record.furthestStage)),
    separator,
    recordSeparator,
  });
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

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = readTeamProfile(slug);
  /*
   * A PROJECTION, never the artifact (AD-11). `toTeamHeroData` keeps the
   * identity block, the nine record fields, two aggregates and the form strip;
   * the forty tactical leaves, the formations and the per-match rows are fetched
   * below by `TeamProfileRegion` from the same artifact at runtime. Serializing
   * the whole profile into the HTML would ship every byte twice on all 48
   * routes, and AD-11 admits "no third path".
   */
  const hero = toTeamHeroData(profile);
  return (
    /*
     * `max-w-6xl` and the gutter pair are `/matches/[slug]`'s and
     * `/players/[slug]`'s container exactly: the per-match table below carries
     * thirteen columns and the Hub's dashboard width is what the site already
     * reserves for a wide data surface. The Hero keeps its own narrower measure
     * inside it.
     *
     * `pb-`, NOT `py-` — both shipped routes use `pb-layer-gap`.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">
      <div className="mx-auto w-full max-w-2xl">
        <TeamHero data={hero} />
      </div>
      <TeamProfileRegion slug={slug} />
    </div>
  );
}

import type { Metadata } from "next";

import { PlayerHero } from "@/components/PlayerHero";
import { PlayerProfileRegion } from "@/components/PlayerProfileRegion";
import { readPlayerProfile, readTournament } from "@/lib/build-data";
import { t } from "@/lib/i18n";
import {
  composePlayerDescription,
  composePlayerTitle,
  toPlayerHeroData,
} from "@/lib/player-profile";

/*
 * `/players/[slug]` (Story 2.15, FR-27). The second dynamic route, on
 * `/matches/[slug]`'s shape exactly — with `output: 'export'` a route MUST
 * enumerate its params, so `generateStaticParams` reads the tournament manifest
 * off the filesystem at build time (AD-11) and pre-renders exactly the listed
 * players. `dynamicParams = false` makes a non-manifest slug impossible, which
 * is what a static export's "only what was generated exists" semantics mean.
 *
 * THE BUILD READS FIXTURES. `build-data.ts`'s DATA_ROOT is `../data/fixtures`,
 * so this build generates TWO player routes. The 1,248-route pre-render is Story
 * 2.19's cutover, which flips DATA_ROOT here and `src/lib/data.ts`'s together.
 */
export const dynamicParams = false;

/**
 * The route manifest, mapped 1:1 with NO EXISTENCE FILTER (ruled D10).
 *
 * Filtering on whether the artifact file exists would convert a real pipeline
 * breach — AD-4 asserts a bijection between `entities.players` and the emitted
 * profiles, "empty sections allowed, absence not" — into a route that silently
 * vanishes from a 1,248-page site. `readPlayerProfile` throws instead, and the
 * build fails naming the player.
 *
 * SYNCHRONOUS, unlike its two siblings below: Next 16 awaits `params` in
 * `generateMetadata` and in the page component, and in neither case here.
 */
export function generateStaticParams(): { slug: string }[] {
  return readTournament().entities.players.map((player) => ({ slug: player.playerId }));
}

/*
 * `generateMetadata` is the ONE place a server `t()` from `@/lib/i18n` is
 * correct on this route (`MatchHero.tsx`: a server-t() BODY surface "would
 * freeze Spanish and ignore the language toggle"; metadata is emitted once per
 * build and has no toggle to ignore).
 *
 * Both strings are built by the pure helpers, NEVER inline — the i18n lint gate
 * flags any template or concatenation that is the direct value of a
 * `title:`/`description:` property, even when every fragment is a t() call.
 *
 * `openGraph` carries BOTH, because a `description` alone emits no OG tags at
 * all and AC 5 asks for OG. NO `og:image`: AR-11 permits zero external or asset
 * requests.
 *
 * THIS ROUTE INHERITS THE UNRULED `<title>`-LANGUAGE QUESTION (owner: Juan,
 * filed once under Story 2.12 for `/`). The metadata is emitted in the build's
 * default dictionary regardless of the reader's toggle; AC 5 puts that on 1,248
 * routes at 2.19. Deliberately NOT re-filed here — one entry, one owner.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = readPlayerProfile(slug);
  const separator = t("player.meta.separator");
  const title = composePlayerTitle({
    playerName: profile.name,
    teamName: profile.team.name,
    siteName: t("app.siteName"),
    separator,
  });
  const description = composePlayerDescription({
    positionLabel: t(`enums.position.${profile.position}`),
    teamName: profile.team.name,
    separator,
  });
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
  return { title, description, openGraph: { title, description, url: "./", locale: "es_ES" } };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = readPlayerProfile(slug);
  /*
   * A PROJECTION, never the artifact (AD-11). `toPlayerHeroData` keeps the
   * identity block and the four Hero tiles; the eighteen aggregates, the
   * physical block, the trends and the per-match rows are fetched below by
   * `PlayerProfileRegion` from the same artifact at runtime. Serializing the
   * whole profile into the HTML would ship every byte twice on all 1,248 routes.
   */
  const hero = toPlayerHeroData(profile);
  return (
    /*
     * `max-w-6xl` and the gutter pair are `/matches/[slug]`'s container exactly:
     * the per-match table below carries fifteen columns and the Hub's dashboard
     * width is what the site already reserves for a wide data surface. The Hero
     * keeps its own narrower measure inside it.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile pb-layer-gap md:px-gutter-desktop">
      <div className="mx-auto w-full max-w-2xl">
        <PlayerHero data={hero} />
      </div>
      <PlayerProfileRegion slug={slug} />
    </div>
  );
}

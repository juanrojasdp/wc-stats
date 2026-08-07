import type {
  Appearances,
  EntityRef,
  MetricCode,
  PlayerProfile,
  Position,
} from "@/lib/contract/contract-types";

/*
 * Pure profile display logic (Story 2.15), on `match-hero.ts`'s terms and in its
 * sibling position: no React, no locale binding, no formatting, no fs. Every
 * label is passed in already resolved by the caller.
 *
 * IT MUST STAY SERVER-IMPORTABLE. `app/players/[slug]/page.tsx` is a server
 * component and imports both exports below, so this module may never carry
 * `"use client"` and may never live under `src/viz/**` (which the ESLint seam
 * bars from `@/lib/build-data` and from a server `t()`). It imports contract
 * TYPES only, so it is erased entirely at runtime on both sides of the seam.
 *
 * NOTHING HERE AGGREGATES (AD-5/AR-5). A profile is cross-match by definition,
 * so the single-bundle carve-out does not apply at all: every number on the
 * route is precomputed by the Pipeline and read verbatim. `heroTiles` below
 * SELECTS four of the eighteen emitted aggregates, which AD-5 permits in as
 * many words ("filter, select"); it derives none of them, and all eighteen still
 * render in full further down the page (SM-C2).
 */

/* ------------------------------- Hero projection --------------------------- */

/**
 * The four aggregates the Hero tiles carry, in tile order (ruled D5).
 *
 * A `readonly MetricCode[]` of METRIC CODES rather than four hand-copied
 * numbers: the codes are contract enum members, so a code that leaves the enum
 * is a compile error here rather than a tile that silently stops resolving.
 *
 * Selection, never derivation. `topSpeed` is the artifact's own `max` and
 * `passCompletion` its own WEIGHTED `average` — this file computes neither and
 * must not, which is also why `aggregation` never reaches the screen: Story 1.18
 * records that the same word "average" means a weighted arithmetic on a player
 * profile and an unweighted one on a team profile, "and both are correct". A
 * user-facing "how this was computed" label keyed off that field would be wrong
 * on one of the two surfaces.
 */
export const HERO_TILE_METRICS: readonly MetricCode[] = [
  "goals",
  "topSpeed",
  "totalDistance",
  "passCompletion",
];

/** One Hero tile's raw value, still unformatted (AD-7 puts all Intl in the App). */
export interface PlayerHeroTile {
  metricCode: MetricCode;
  value: number;
}

/**
 * The minimal subset serialized into the pre-rendered `PlayerHero`'s props.
 *
 * NEVER THE WHOLE ARTIFACT. AD-11 splits the route into a build-time fs read for
 * Hero-critical content and a client fetch for everything below it, and Story
 * 2.13 measured what ignoring that costs on the Hub: `out/index.html` at 98,640 B
 * projected against ~989,436 B un-projected. The largest real profile is 11,741 B
 * raw, so inlining one would not be catastrophic — but it would put the SAME
 * bytes in the HTML and in the fetched artifact on all 1,248 routes, and there is
 * no third rendering path to justify.
 */
export interface PlayerHeroData {
  playerId: string;
  name: string;
  team: EntityRef;
  position: Position;
  shirtNumber: number;
  appearances: Appearances;
  /** Index-aligned to `HERO_TILE_METRICS`. */
  tiles: PlayerHeroTile[];
}

/**
 * Project the build-time artifact down to the Hero props (AD-11 split).
 *
 * FAILS LOUD ON A MISSING AGGREGATE rather than rendering a hole. Story 1.18 R2
 * shipped TOTALITY on all 1,248 files — every player carries all eighteen
 * aggregates, the 209 zero-appearance players included — so a code that is not
 * present is a broken artifact, not a shape this route may branch on (D8). The
 * throw names the player and the code, because at 1,248 routes an unattributed
 * build failure is a search rather than a fix.
 */
export function toPlayerHeroData(profile: PlayerProfile): PlayerHeroData {
  return {
    playerId: profile.playerId,
    name: profile.name,
    team: profile.team,
    position: profile.position,
    shirtNumber: profile.shirtNumber,
    appearances: profile.appearances,
    tiles: HERO_TILE_METRICS.map((metricCode) => {
      const aggregate = profile.aggregates.find(
        (candidate) => candidate.metricCode === metricCode
      );
      if (aggregate === undefined) {
        throw new Error(
          `player-profile: ${profile.playerId} carries no "${metricCode}" aggregate; ` +
            `the artifact is total by contract (all 18 codes, always).`
        );
      }
      return { metricCode, value: aggregate.value };
    }),
  };
}

/* -------------------------------- Metadata --------------------------------- */

/**
 * The `<title>`/OG string: player name, team, site name (AC 5).
 *
 * COMPOSED HERE AND NOT INSIDE `generateMetadata`, which is `composeMatchTitle`'s
 * binding precedent rather than a stylistic echo: the i18n lint gate flags any
 * template or concatenation that is the DIRECT VALUE of a `title:`/`description:`
 * property, even when every fragment is a t() call.
 *
 * `playerName` and `teamName` pass through UNTRANSLATED. Both are source
 * proper nouns (AD-7: "source proper names pass through as-is in English"), so
 * "Julian QUINONES" and "Mexico" read identically in both dictionaries — the
 * artifact's own Given SURNAME casing included.
 */
export function composePlayerTitle(input: {
  playerName: string;
  teamName: string;
  siteName: string;
  separator: string;
}): string {
  const { playerName, teamName, siteName, separator } = input;
  return `${playerName}${separator}${teamName}${separator}${siteName}`;
}

/**
 * The OG/meta description: position label, team, site-scoped context.
 *
 * The position label arrives ALREADY RESOLVED (`enums.position.*`) — this module
 * holds no dictionary keys and calls no t(), so the caller owns the locale.
 */
export function composePlayerDescription(input: {
  positionLabel: string;
  teamName: string;
  separator: string;
}): string {
  const { positionLabel, teamName, separator } = input;
  return `${positionLabel}${separator}${teamName}`;
}

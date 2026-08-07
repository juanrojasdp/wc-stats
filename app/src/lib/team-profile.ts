import type {
  Group,
  MatchResult,
  Stage,
  TeamProfile,
  TeamTournamentRecord,
} from "@/lib/contract/contract-types";

/*
 * `/teams/{slug}`'s pure display logic (Story 2.16), on `player-profile.ts`'s
 * terms and in its sibling position: no React, no locale binding, no formatting,
 * no fs. Every label is passed in already resolved by the caller.
 *
 * IT MUST STAY SERVER-IMPORTABLE. `app/teams/[slug]/page.tsx` is a server
 * component and imports all three exports below, so this module may never carry
 * `"use client"` and may never live under `src/viz/**` (which the ESLint seam
 * bars from `@/lib/build-data` and from a server `t()`). It imports contract
 * TYPES only, so it is erased entirely at runtime on both sides of the seam.
 *
 * NOTHING HERE AGGREGATES (AD-5 / AR-5). A team profile is cross-match by
 * definition, so the single-bundle carve-out does not apply at all: every number
 * on the route is precomputed by the Pipeline and read verbatim. The projection
 * below SELECTS a subset of the artifact, which AD-5 permits in as many words
 * ("filter, select"); it derives nothing.
 */

/* ------------------------------- Hero projection --------------------------- */

/**
 * The minimal subset serialized into the pre-rendered `TeamHero`'s props.
 *
 * NEVER THE WHOLE ARTIFACT (AD-11). The route splits into a build-time fs read
 * for Hero-critical content and a client fetch for everything below it, and
 * Story 2.13 measured what ignoring that costs on the Hub: `out/index.html` at
 * 98,640 B projected against ~989,436 B un-projected. The largest team artifact
 * is 5,974 B raw, so inlining one would not be catastrophic — but it would put
 * the SAME bytes in the HTML and in the fetched artifact on all 48 routes, and
 * AD-11 admits "no third path; no inlining full bundles into HTML".
 *
 * THE ARTIFACT IS READ TWICE, ONCE PER AD-11 PATH, AND THAT IS THE DESIGN. The
 * region fetches the full artifact over HTTP independently; this projection and
 * the region's payload never share state.
 *
 * THE FIELD LIST IS EXACT. Over-projecting defeats the point; under-projecting
 * breaks the form strip, which needs `matches[].result` and nothing else from
 * `matches[]`.
 */
export interface TeamHeroData {
  teamId: string;
  name: string;
  teamCode: string;
  group: Group;
  record: TeamTournamentRecord;
  /** `tacticalIdentity.possession` — a percentage. */
  possession: number;
  /**
   * `tacticalIdentity.pressingIntensity` — a COUNT-VALUED MEAN, not a
   * percentage. "Mean defensive pressures applied per match", `x-decimals: 1`.
   * Mexico is 213.0. It never takes a `%` sign.
   */
  pressingIntensity: number;
  /**
   * The form strip: `matches[].result` in the artifact's chronological order
   * (ruled D3). A projection, never an aggregation — nothing is summed, counted
   * or re-ordered, so AR-5 is satisfied.
   */
  form: MatchResult[];
}

/**
 * Project the build-time artifact down to the Hero props (AD-11 split).
 *
 * NO GUARD AND NO THROW HERE, unlike `toPlayerHeroData`. That function throws on
 * a missing aggregate because `PlayerProfile.aggregates` is a LOOKUP — an array
 * searched by `metricCode`, which can miss. Every field below is a REQUIRED,
 * NON-NULLABLE property of a `additionalProperties: false` object, so there is
 * nothing to look up and nothing to miss; `readTeamProfile`'s two throws already
 * cover a missing or wrong-version artifact, and the runtime region's model
 * guards the leaves it renders.
 */
export function toTeamHeroData(profile: TeamProfile): TeamHeroData {
  return {
    teamId: profile.teamId,
    name: profile.name,
    teamCode: profile.teamCode,
    group: profile.group,
    record: profile.record,
    possession: profile.tacticalIdentity.possession,
    pressingIntensity: profile.tacticalIdentity.pressingIntensity,
    form: profile.matches.map((row) => row.result),
  };
}

/* -------------------------------- Metadata --------------------------------- */

/**
 * The `<title>`/OG string: team name and tournament record (AC 3).
 *
 * COMPOSED HERE AND NOT INSIDE `generateMetadata`, which is `composeMatchTitle`'s
 * and `composePlayerTitle`'s binding precedent rather than a stylistic echo: the
 * i18n lint gate flags any template or concatenation that is the DIRECT VALUE of
 * a `title:`/`description:` property, even when every fragment is a t() call.
 *
 * `EXPERIENCE.md:42` specifies "team: name + tournament record", and `record`
 * carries nine fields — so the composition is RULED (D7) rather than left open:
 * `"{name} · {won}-{drawn}-{lost} · {siteName}"`.
 *
 * THE W-D-L TRIPLE IS SELECTED, NEVER DERIVED. `record.played` is ALL matches,
 * group and knockout, and `record.points` counts GROUP-STAGE points only —
 * a naive `won*3 + drawn` disagrees with the contract on 19 of 48 real teams
 * (Mexico is 12 naive, 9 by contract). Nothing here computes either.
 *
 * `name` PASSES THROUGH UNTRANSLATED. It is a source proper noun (AD-7: "source
 * proper names pass through as-is in English"), so "Mexico" and "Türkiye" read
 * identically in both dictionaries.
 */
export function composeTeamTitle(input: {
  name: string;
  won: number;
  drawn: number;
  lost: number;
  siteName: string;
  separator: string;
  recordSeparator: string;
}): string {
  const { name, won, drawn, lost, siteName, separator, recordSeparator } = input;
  const record = `${String(won)}${recordSeparator}${String(drawn)}${recordSeparator}${String(lost)}`;
  return `${name}${separator}${record}${separator}${siteName}`;
}

/**
 * The OG/meta description: the record plus how far the team went.
 *
 * The stage label arrives ALREADY RESOLVED (`enums.stage.*`) — this module holds
 * no dictionary keys and calls no t(), so the caller owns the locale.
 *
 * `furthestStage` IS THE ONLY CARRIER OF PROGRESSION on this route (Story 1.18
 * R4): `matches[].result` follows `metadata.score`, so the four shootout matches
 * read `draw` for both teams and a team that advanced on penalties shows a draw
 * chip on that row. That is contracted and is not annotated anywhere (ruled Q3).
 */
export function composeTeamDescription(input: {
  name: string;
  won: number;
  drawn: number;
  lost: number;
  furthestStageLabel: string;
  separator: string;
  recordSeparator: string;
}): string {
  const { name, won, drawn, lost, furthestStageLabel, separator, recordSeparator } = input;
  const record = `${String(won)}${recordSeparator}${String(drawn)}${recordSeparator}${String(lost)}`;
  return `${name}${separator}${record}${separator}${furthestStageLabel}`;
}

/* ------------------------------- Compare link ------------------------------ */

/**
 * The "Comparar equipo" deep link (AC 4): `/compare?type=teams&a={slug}`.
 *
 * COMPOSED IN A HELPER rather than interpolated at the call site, which is the
 * house rule for every route this app emits. The target does not exist yet —
 * Story 2.17 owns `/compare` — and linking to an unbuilt route is itself ruled
 * (Story 2.12 D2 and 2.13 ruling 3 both ruled navigation surfaces link to
 * unbuilt routes), which is why the caller passes `prefetch={false}`.
 *
 * THE TRAILING SLASH BEFORE THE QUERY IS MANDATORY AND IS EMITTED HERE, not left
 * to Next. `trailingSlash: true` normalises a slash-less path at request time,
 * so `/compare?…` is rewritten to `/compare/?…` and the href in the exported
 * HTML stops matching what this helper returns — which is exactly the drift
 * `matchHref`'s docblock records ("emits its own trailing slash, which is why it
 * is called rather than interpolated"). Caught by the static-output test, which
 * asserts against the EMITTED markup rather than this function's return value.
 *
 * AC 4 spells the target `/compare?type=teams&a={slug}`; `/compare/?…` is that
 * same target in this site's canonical path form, and every other href builder
 * in the codebase emits the slash the same way.
 *
 * NO `encodeURIComponent`. `AD-3` fixes `TeamId` as "lowercase ASCII kebab,
 * accent-stripped", so a slug carries nothing a query string could misread —
 * and encoding it would make the emitted href differ from the slug the route
 * was generated under.
 */
export function compareTeamHref(teamId: string): string {
  return `/compare/?type=teams&a=${teamId}`;
}

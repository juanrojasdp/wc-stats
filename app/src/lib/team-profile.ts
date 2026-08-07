import type {
  Group,
  MatchResult,
  Stage,
  TeamProfile,
  TeamTournamentRecord,
} from "@/lib/contract/contract-types";
import { formResults } from "@/viz/team-profile-model";

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
    /*
     * THROUGH THE MODEL'S `formResults`, not a second inline map (code review
     * 2026-08-07). `team-profile-model.ts` exports `formResults` documented as
     * "the Hero's form strip", and three tests pin D3 and AR-5 against it —
     * that it is a projection and never an aggregation, and that it matches the
     * artifact's own order. Nothing imported it: this line was a duplicate of
     * the same projection, so the shipped strip was the untested copy and the
     * tested one was dead. One behaviour, one implementation, and the D3 tests
     * now grade the code the route actually runs.
     */
    form: formResults(profile),
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


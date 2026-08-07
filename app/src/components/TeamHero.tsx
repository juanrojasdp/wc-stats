"use client";

import Link from "next/link";

import { GlossaryTerm } from "@/components/GlossaryTerm";
import { ProfileStatTiles, type ProfileStatTile } from "@/components/ProfileStatTiles";
import { ResultChip } from "@/components/ResultChip";
import { stageLabelKey } from "@/lib/hub-model";
import { useLocale, useT } from "@/lib/i18n-provider";
import {
  composeGoalPair,
  composeGroupLabel,
  composeRecordTriple,
  formatGoalDifference,
  formatPressingIntensity,
  formatRateValue,
  formatTeamCount,
} from "@/lib/team-profile-format";
import { compareHref } from "@/lib/compare-url";
import { type TeamHeroData } from "@/lib/team-profile";

/*
 * The pre-rendered Hero for `/teams/{slug}` (Story 2.16, AC 1 and AC 4) — the
 * build-time half of AD-11's split.
 *
 * `"use client"` + `useT()`, NEVER A SERVER `t()`. A server-t() body surface
 * "would freeze Spanish and ignore the language toggle" (`MatchHero`'s ruling).
 * `generateMetadata` is the ONE place a server `t()` is correct on this route,
 * because metadata is emitted once per build and has no toggle to ignore.
 *
 * IT RECEIVES A PROJECTION, NEVER THE ARTIFACT. `toTeamHeroData` keeps the
 * identity block, the record, two aggregates and the form strip; the forty
 * tactical leaves, the formations and the per-match rows are fetched below by
 * `TeamProfileRegion` from the same artifact at runtime. Serializing the whole
 * profile into the HTML would ship every byte twice on all 48 routes, and AD-11
 * admits "no third path; no inlining full bundles into HTML".
 *
 * NO GOALKEEPING BLOCK, AND IT IS RULED RATHER THAN MISSING (D8). Story 1.18's
 * R1(A), taken by Juan: goalkeeping appears in NO profile artifact,
 * `team-profile.schema.json` has no such property and is
 * `additionalProperties: false`, and `profiles.py` records that "nothing
 * goalkeeping-shaped is synthesized". Synthesizing it from Match Bundles would
 * breach AR-5 and AD-11 both; rendering an `EmptyStatePanel` for it would imply
 * the page is incomplete.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const RECORD_SEPARATOR = "-";

export function TeamHero({ data }: { data: TeamHeroData }) {
  const t = useT();
  const { locale } = useLocale();

  const groupLabel = composeGroupLabel(t("match.hero.group"), data.group);

  /*
   * TILES, NOT A LEADER TREATMENT. `ProfileStatTiles` is Story 2.15's
   * single-entity tile: same grid, same card, same type ramp as
   * `StoryStatTiles`, with NO ▲ glyph, no side accent and no `resolveLeader` —
   * a profile has no leader, which is 2.10 decision 11's declared departure from
   * UX-DR7. The tile is NOT a tap target (`EXPERIENCE.md:73`).
   *
   * EVERY `value` ARRIVES PRE-FORMATTED. The component never formats.
   *
   * NOTHING HERE IS RE-DERIVED (D12). `played` is ALL matches, group and
   * knockout — Argentina is 8, not 3. `points` counts GROUP-STAGE points only,
   * so a naive `won*3 + drawn` disagrees on 19 of 48 real teams (Mexico is 12
   * naive, 9 by contract). `goalDifference` ships SIGNED and is never computed
   * from `goalsFor - goalsAgainst`.
   */
  const tiles: ProfileStatTile[] = [
    {
      key: "played",
      labelNode: t("team.tile.played"),
      value: formatTeamCount(data.record.played, locale),
    },
    {
      key: "record",
      labelNode: t("team.tile.record"),
      value: composeRecordTriple({
        won: formatTeamCount(data.record.won, locale),
        drawn: formatTeamCount(data.record.drawn, locale),
        lost: formatTeamCount(data.record.lost, locale),
        separator: RECORD_SEPARATOR,
      }),
      caption: t("team.tile.recordCaption"),
    },
    {
      key: "goals",
      labelNode: t("team.tile.goals"),
      value: composeGoalPair({
        goalsFor: formatTeamCount(data.record.goalsFor, locale),
        goalsAgainst: formatTeamCount(data.record.goalsAgainst, locale),
        separator: RECORD_SEPARATOR,
      }),
      caption: t("team.tile.goalsCaption"),
    },
    {
      key: "goalDifference",
      labelNode: t("team.tile.goalDifference"),
      value: formatGoalDifference(data.record.goalDifference, locale),
    },
    {
      key: "points",
      labelNode: t("team.tile.points"),
      value: formatTeamCount(data.record.points, locale),
      /* The contract's own scoping, stated rather than assumed: knockout ties
       * award none. */
      caption: t("team.tile.pointsCaption"),
    },
    {
      key: "furthestStage",
      labelNode: t("team.tile.furthestStage"),
      value: t(stageLabelKey(data.record.furthestStage)),
    },
    {
      key: "possession",
      labelNode: t("team.tile.possession"),
      value: formatRateValue(data.possession, locale),
    },
    {
      key: "pressingIntensity",
      /*
       * GLOSSARY-MARKED (Task 10.8, UX-DR20), and the tile label is the ONLY
       * safe host on this route. Every competing host is barred: a sortable
       * column head cannot nest a focusable trigger inside its
       * `<button aria-expanded>` (2.13, and nothing in the build catches it),
       * the chart axis titles are SVG `<text>` that no popover can attach to,
       * and the section `<h2>`s ("Identidad táctica", "Formaciones", "Partidos
       * del torneo") match no row of the per-term policy table — a dotted
       * underline with no popover behind it is the broken promise 2.5 decision 8
       * rules against.
       *
       * `pressing` is a real `GLOSSARY_TERMS` id and its definition is exactly
       * what a reader needs here: it says the press rates are INDEPENDENT and do
       * not sum to 100, which is the same fact D10 makes the charts' note carry.
       *
       * A `<div>`, not a `<span>`: decision 9 forbids portalling
       * `Popover.Content`, so the panel mounts as a DOM sibling of its trigger,
       * and `div` inside `span` is an invalid content model that React's
       * validateDOMNesting does NOT warn about.
       */
      /*
       * NO `normal-case` (code review 2026-08-07). `type-stat-label` sets
       * `text-transform: uppercase` and every shipped tile on the site takes
       * it, so the override made this ONE tile of eight render in sentence
       * case: seven read "PARTIDOS", "BALANCE (G-E-P)" … and this one read
       * "Presiones defensivas". It is the same defect `PhysicalSection` had —
       * removed there in this story's own `1b93797` with the same reasoning —
       * and it arrived here the same way, incidental to the glossary markup
       * rather than as a ruling.
       */
      labelNode: (
        <div className="inline-flex items-center gap-1">
          <GlossaryTerm termId="pressing">{t("team.tile.pressingIntensity")}</GlossaryTerm>
        </div>
      ),
      /*
       * A COUNT-VALUED MEAN AT 1 dp, WITH NO PERCENT SIGN (D12). The contract
       * calls it "Mean defensive pressures applied per match"; Mexico is 213.0.
       * `possession` sits two tiles away and IS a percentage, which is exactly
       * how a stray "%" here would read as correct.
       */
      value: formatPressingIntensity(data.pressingIntensity, locale),
      caption: t("team.tile.pressingIntensityCaption"),
    },
  ];

  return (
    <section className="mt-6">
      {/*
       * The `<h1>` is `sr-only`: the visible identity block below carries the
       * team name at display size, and a second visible heading would duplicate
       * it. One `<h1>` per route.
       */}
      <h1 className="sr-only">{data.name}</h1>

      <div className="flex flex-col items-center gap-1">
        <p aria-hidden="true" className="type-label-caps text-ink-secondary">
          {data.teamCode.toUpperCase()}
        </p>
        <p className="type-display text-ink-primary">{data.name}</p>
        <p className="type-caption text-ink-secondary">{groupLabel}</p>
      </div>

      <ProfileStatTiles tiles={tiles} />

      {/*
       * THE FORM STRIP (ruled D3): a projection of `matches[].result` in the
       * artifact's own chronological order. Not an aggregation — nothing is
       * summed, averaged or derived — so AR-5 is satisfied.
       *
       * THE ARRAY INDEX IS THE REACT KEY, and this is the one place that is
       * legitimate (`TournamentHub.tsx`'s shipped ruling): the strip is a
       * positional sequence of repeated values with no stable identity of its
       * own, and W-W-W-W-L carries four identical entries.
       */}
      {data.form.length > 0 ? (
        <div className="mt-5 flex flex-col items-center gap-1">
          <p className="type-stat-label text-ink-secondary">{t("team.hero.form")}</p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {data.form.map((result, index) => (
              <ResultChip key={index} result={result} />
            ))}
          </div>
        </div>
      ) : null}

      {/*
       * "Comparar equipo" (AC 4) -> `/compare?type=teams&a={slug}`.
       *
       * `prefetch={false}` BECAUSE THE ROUTE DOES NOT EXIST YET — Story 2.17
       * owns `/compare`. Linking to an unbuilt route is itself ruled (2.12 D2
       * and 2.13 ruling 3 both ruled navigation surfaces link to unbuilt
       * routes), but prefetching one is a guaranteed round trip for a 404.
       *
       * The href is composed in a helper, never interpolated at the call site.
       */}
      <div className="mt-5 flex justify-center">
        <Link
          /*
           * 🔴 THE ONE `compareHref` HELPER (Story 2.17, ruled D2). `team-profile.ts`'s
           * private `compareTeamHref` is DELETED: the route had two inbound links
           * built by two helpers that disagreed about the trailing slash, and
           * `PlayerHero` is repointed at this same function. `/compare` owns the
           * shape of its own URL, and one home is what stops the two from drifting
           * apart again.
           *
           * `prefetch={false}` STAYS. The route exists now, but this is a
           * navigation surface rendered on every team page and 2.13 MEASURED
           * Next's default prefetch taking the resource count 48 → 75.
           */
          href={compareHref("teams", data.teamId)}
          prefetch={false}
          className="flex min-h-11 items-center underline underline-offset-4 type-body text-accent-cyan"
        >
          {t("team.action.compare")}
        </Link>
      </div>
    </section>
  );
}

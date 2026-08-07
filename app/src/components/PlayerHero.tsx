"use client";

import Link from "next/link";

import { ProfileStatTiles, type ProfileStatTile } from "@/components/ProfileStatTiles";
import { useLocale, useT } from "@/lib/i18n-provider";
import { teamHref } from "@/lib/hub-model";
import {
  composeMetricLabel,
  formatCount,
  formatProfileValue,
  profileUnitKey,
} from "@/lib/player-profile-format";
import type { PlayerHeroData } from "@/lib/player-profile";
import { MIN_HIT_PX } from "@/viz/marker-layout";
import { LEADERBOARD_UNIT, leaderboardMetricKey } from "@/viz/leaderboard-model";
import { profileMetricFormat } from "@/viz/player-profile-model";

/*
 * The pre-rendered profile Hero (Story 2.15, AD-11's build-time half).
 *
 * `"use client"` + `useT()`, NEVER a server `t()` — `MatchHero.tsx`'s ruling
 * verbatim: a server-t() Hero "would freeze Spanish and ignore the language
 * toggle". It pre-renders to canonical Spanish HTML at build and swaps copy on
 * the single post-hydration pass.
 *
 * IT RECEIVES A PROJECTION, not the artifact (`PlayerHeroData`). Everything
 * below the Hero — eighteen aggregates, the physical block, six trend series,
 * up to eight match rows — is fetched at runtime by `PlayerProfileRegion`.
 *
 * Layout order (the story's ruled Route Composition): sr-only h1 → identity
 * block → appearances line → four tiles → the "Comparar" action.
 */

/** Composition glyphs are module consts, never bare JSX literals (i18n gate). */
const DOT_SEPARATOR = " · ";
const LABEL_SEPARATOR = ": ";
const SPACE = " ";

export function PlayerHero({ data }: { data: PlayerHeroData }) {
  const t = useT();
  const { locale } = useLocale();

  const positionLabel = t(`enums.position.${data.position}`);

  /*
   * The sr-only page heading, on `MatchHero`'s ruled shape: ONE `<h1>`, carrying
   * the identity a reader landing here needs — name, position, team. The visible
   * name below is a paragraph rather than a second heading, because two `<h1>`s
   * saying almost the same thing is worse than one that says all of it.
   */
  const heading = `${data.name}${DOT_SEPARATOR}${positionLabel}${DOT_SEPARATOR}${data.team.name}`;

  /*
   * Hoisted into an identifier, not composed in the JSX: `jsx-no-literals`
   * rejects a template literal as a child EVEN WHEN every fragment is a t()
   * call. The TRAILING SPACE is deliberate — the accessible-name algorithm
   * inserts one between element children, but the DOM text concatenates raw, so
   * the live name read back was "Ver el equipoMexico". An explicit separator
   * makes it true in every engine rather than true in the spec (2.12's finding).
   */
  const teamLinkPrefix = `${t("hub.standings.rowLink")}${SPACE}`;

  /*
   * The appearances line, composed as a STRING above the JSX. t() has no
   * interpolation, so every counter is a resolved label beside a formatted
   * number; composing it in JSX would emit the separators as literal children
   * and fail the gate.
   *
   * `minutesPlayed: 0` WITH `played > 0` IS RENDERED AS A REAL ZERO (ruled D4a,
   * 20 players). Story 1.18: "0 is the honest floor." No `<1`, no dash, no
   * footnote — AR-5 requires verbatim, `<1` is a client-side reinterpretation,
   * and the em dash is this codebase's MISSING-data glyph, which would assert an
   * absence of information where the information exists.
   */
  const appearancesLine = [
    `${t("player.appearances.played")}${LABEL_SEPARATOR}${formatCount(
      data.appearances.played,
      locale
    )}`,
    `${t("player.appearances.started")}${LABEL_SEPARATOR}${formatCount(
      data.appearances.started,
      locale
    )}`,
    `${t("player.appearances.substitute")}${LABEL_SEPARATOR}${formatCount(
      data.appearances.substituteAppearances,
      locale
    )}`,
    `${t("player.appearances.minutes")}${LABEL_SEPARATOR}${formatCount(
      data.appearances.minutesPlayed,
      locale
    )}`,
  ].join(DOT_SEPARATOR);

  /*
   * The four Hero tiles (ruled D5), read from `aggregates[]` — never from
   * `physical{}`, which is the physical section's source. The artifact repeats
   * `totalDistance` and `topSpeed` in both blocks ON PURPOSE and this route
   * renders both: deduping would be a client-side edit of a verbatim surface.
   *
   * The unit rides the LABEL as a composed string (`composeMetricLabel`), which
   * is `StoryStatTiles`' and `KeyStatisticsSection.statLabel`'s pattern —
   * `{t(a)} ({t(b)})` in JSX fails the i18n gate.
   */
  const tiles: ProfileStatTile[] = data.tiles.map((tile) => {
    const unit = LEADERBOARD_UNIT[tile.metricCode];
    const unitKey = profileUnitKey(unit);
    return {
      key: `hero-${tile.metricCode}`,
      labelNode: composeMetricLabel(
        t(leaderboardMetricKey(tile.metricCode)),
        unitKey === null ? null : t(unitKey)
      ),
      value: formatProfileValue(tile.value, profileMetricFormat(tile.metricCode), locale),
    };
  });

  return (
    <header className="pt-layer-gap">
      <h1 className="sr-only">{heading}</h1>

      <div className="flex items-center gap-3">
        {/*
         * The shirt badge. `aria-hidden` because the number is spoken in the
         * line beneath it — a bare "16" announced before the name reads as a
         * list position rather than a shirt.
         */}
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hairline bg-surface-overlay type-label-caps tabular-nums text-ink-secondary"
        >
          {formatCount(data.shirtNumber, locale)}
        </span>
        <div className="min-w-0">
          <p className="type-title text-ink-primary">{data.name}</p>
          <p className="type-caption text-ink-secondary">
            {positionLabel}
            {DOT_SEPARATOR}
            {t("player.shirt")}
            {SPACE}
            <span className="tabular-nums">{formatCount(data.shirtNumber, locale)}</span>
          </p>
        </div>
      </div>

      <p className="mt-2 type-caption text-ink-secondary">
        {/*
         * The team cross-link (UX-DR22). `/teams/{teamId}/` DOES NOT RESOLVE
         * until Story 2.16 and is linked anyway, on the shipped precedent
         * `MatchHero` and `LineupsDisclosure` already set — the dangling routes
         * are filed in deferred-work.md, not stubbed.
         *
         * `prefetch={false}`: Next prefetches every `<Link>` entering the
         * viewport, and this one would be a round trip for a 404 on all 1,248
         * routes. The `sr-only` prefix REUSES `hub.standings.rowLink`
         * ("Ver el equipo") rather than minting a second phrase for one act.
         */}
        <Link
          href={teamHref(data.team.id)}
          prefetch={false}
          className="inline-flex items-center underline underline-offset-4 text-accent-cyan"
          style={{ minHeight: MIN_HIT_PX, minWidth: MIN_HIT_PX }}
        >
          <span className="sr-only">{teamLinkPrefix}</span>
          {data.team.name}
        </Link>
      </p>

      <p className="mt-1 type-caption tabular-nums text-ink-secondary">{appearancesLine}</p>

      <ProfileStatTiles tiles={tiles} />

      {/*
       * AC 4's "Comparar" entry (FR-29). The `/compare` route DOES NOT EXIST —
       * Story 2.17 owns it — and it is linked anyway rather than stubbed, on the
       * ruling 2.12 D2 and 2.13 ruling 3 already set and that
       * `LineupsDisclosure`/`MatchHero` already ship, pinned green by
       * `matches/static-output.test.ts`. Building a placeholder route here would
       * mean 2.17 inherits a route it has to delete first.
       *
       * THE SLASH BEFORE THE QUERY STRING IS WRITTEN OUT, not left to Next.
       * `next.config.ts` sets `trailingSlash: true`, so the AC's literal
       * `/compare?type=…` is rewritten to `/compare/?type=…` — which is the form
       * that actually ships and the form 2.17's route will live at. Writing the
       * emitted shape here is the same discipline `hub-model`'s three href
       * helpers apply: the source states what the document contains, and the
       * static-output test asserts that string rather than a redirect.
       *
       * NOT a `hub-model` helper: those three take an id and return a route,
       * and this is a query-string entry point to a route that does not exist
       * yet. 2.17 owns the shape and should mint the helper with it.
       */}
      <div className="mt-4">
        <Link
          href={`/compare/?type=players&a=${data.playerId}`}
          prefetch={false}
          className="inline-flex items-center rounded-full border border-hairline px-4 type-label-caps text-ink-primary underline underline-offset-4"
          style={{ minHeight: MIN_HIT_PX }}
        >
          {t("player.compare")}
        </Link>
      </div>
    </header>
  );
}

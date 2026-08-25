"use client";

import Link from "next/link";

import {
  LEADERBOARDS_LOG_LABEL,
  LeaderboardsRegion,
} from "@/components/LeaderboardsRegion";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { useGlossaryMarking } from "@/components/glossary-marking";
import { formatInteger } from "@/lib/format";
import { playerHref, teamHref } from "@/lib/hub-model";
import { useLocale, useT } from "@/lib/i18n-provider";
import { NBSP, formatLeaderboardValue, leaderboardUnitKey } from "@/lib/leaderboard-format";
import {
  LEADERBOARD_FORMAT,
  LEADERBOARD_UNIT,
  type LeaderboardTeaser,
  leaderboardMetricKey,
} from "@/viz/leaderboard-model";

/*
 * LÍDERES DEL TORNEO (Story 2.13, FR-26 / UJ-4) — the Hub's leaderboards
 * section, at the TWO altitudes EXPERIENCE.md's Visualization Layering row
 * gives it: "Leaderboards (Hub) | Top-3 teaser rows | — | Full sortable table".
 * The em dash at Tactical altitude is why this story ships NO CHART and adds no
 * recharts importer (ruling 2).
 *
 * IT IS A SECTION OF `/`, NOT A ROUTE (ruling 1). The IA route table is closed
 * and `/`'s own Purpose cell names leaderboards; a separate route would also
 * break the FR-34 combined-budget accounting, which assumes the Hub loads both
 * artifacts. Story 2.12 owns `app/src/app/page.tsx` and reached the same
 * conclusion independently ("there is no /leaderboards route in the IA table").
 *
 * `#leaders` IS THE ANCHOR THIS STORY RULES (it was `#lideres` until Story
 * 2.19 Task 7.4 — see the const below). No Hub anchor is specified
 * anywhere in the planning artifacts — EXPERIENCE.md's enumerated anchor set is
 * Match-Dashboard-only — while UX-DR18 requires "stable deep-link anchors for
 * every section". If 2.12 lands with a different id, ADOPT ITS: the id is a
 * coordination token, not a design decision, and two ids is the only bad
 * outcome.
 *
 * "use client" + useT() IS LOAD-BEARING, not incidental. A server-t() surface
 * FREEZES SPANISH and ignores the language toggle — the exact trap
 * MatchHero.tsx's docblock records and deferred-work item 6.2 closes ("Home
 * page body ignores the language toggle"). The page above stays a SERVER
 * component and passes the build-time payload down as a prop; this is the
 * client boundary.
 *
 * NOT `TacticalSection`. That is the Match Dashboard's accordion shell, on the
 * do-not-touch list of three prior stories, and a leaderboard is not a
 * collapsible Tactical section.
 */

/*
 * RENAMED "lideres" -> "leaders" BY STORY 2.19 (Task 7.4, ledger A18/L2236).
 *
 * Story 2.18's ruled decision 11 is that SLUGS AND FRAGMENT IDS ARE ENGLISH OR
 * ROMANIZED, and this was the last Spanish one in the app — every other anchor
 * on every route already reads `#standings`, `#results`, `#key-stats`,
 * `#shot-maps`, `#pass-networks`, `#trends`, `#tactical-identity`. A single
 * Spanish id in that set is not a localisation, it is an inconsistency, and it
 * would have shipped as a permanent URL.
 *
 * It is a URL-SHAPED CHANGE and this is the last story, so it is taken now or
 * never: no shared link to `#lideres` exists yet, because the site has not been
 * published (Task 9 does that). Deferring it past launch would have meant
 * breaking a live anchor or keeping the inconsistency forever.
 *
 * The VISIBLE copy is untouched — the heading still reads "Líderes del torneo"
 * in Spanish and "Tournament leaders" in English. Only the id changes.
 */
export const LEADERBOARDS_SECTION_ID = "leaders";
const HEADING_ID = "leaders-title";

export function LeaderboardsSection({ teasers }: { teasers: readonly LeaderboardTeaser[] }) {
  const t = useT();

  return (
    <section
      id={LEADERBOARDS_SECTION_ID}
      aria-labelledby={HEADING_ID}
      /*
       * No scroll-margin here: globals.css already sets
       * `scroll-padding-top: 4.5rem` on the scroll container, which is what
       * clears the sticky chrome for every in-page anchor. A second offset
       * would double it.
       */
      className="mt-section-gap"
    >
      <h2 id={HEADING_ID} className="type-headline text-ink-primary">
        {t("leaderboards.title")}
      </h2>

      {/*
       * THE TEASERS ARE PRE-RENDERED FROM THE BUILD-TIME PROP (AD-11): hero
       * altitude is the first thing a reader meets, and it must survive with no
       * JavaScript and before the runtime fetch resolves. The tables below come
       * from the client fetch, which is the one artifact load FR-26 permits.
       */}
      {teasers.length > 0 ? (
        <>
          <h3 className="type-title mt-tile-gap text-ink-secondary">
            {t("leaderboards.teaserHeading")}
          </h3>
          {/*
           * THE TEASERS ARE INSIDE A BOUNDARY TOO (2.13 code review). They were
           * outside it, and `LEADERBOARD_FORMAT`/`LEADERBOARD_UNIT` are
           * `Record<MetricCode, …>` — a COMPILE-time guarantee over a union that
           * says nothing about parsed JSON. A metricCode the pipeline adds
           * without a schemaVersion bump sails past the only runtime gate,
           * misses the registry, and reaches `leaderboard-format.ts`'s `never`
           * throw. With no ancestor boundary that unmounts the React root and
           * blanks the WHOLE Hub — results and standings included. The teaser is
           * the half that must survive when everything else fails, so it gets
           * the same containment the region has.
           */}
          <TacticalErrorBoundary logLabel={LEADERBOARDS_LOG_LABEL}>
            {/*
             * THE BASE COLUMN IS DECLARED, not left implicit (Story 2.19 Task
             * 6.2). With no `grid-template-columns` below `sm` the cards land
             * in an IMPLICIT auto track, which is floored by the card's
             * max-content rather than clamped to the container: measured at a
             * 195 px viewport the container was 163 px wide and the track
             * resolved to 278.5 px, making `/` the worst reflow failure in the
             * matrix at doc scrollWidth 295. `grid-cols-1` is
             * `repeat(1, minmax(0, 1fr))`, which clamps the track to the
             * container; the `sm:`/`lg:` steps above it are unchanged.
             *
             * `repeat(auto-fit, minmax(min(100%, 15rem), 1fr))` was tried first
             * and REJECTED ON MEASUREMENT: the rule is emitted correctly and
             * still resolved to two 164 px tracks inside a 163 px container, so
             * the percentage is not behaving as a clamp under `auto-fit` here.
             * The explicit base column is boring and it works.
             */}
            <div className="mt-tile-gap grid grid-cols-1 gap-tile-gap sm:grid-cols-2 lg:grid-cols-3">
              {teasers.map((teaser) => (
                <BoardTeaser key={`${teaser.scope}-${teaser.metricCode}`} teaser={teaser} />
              ))}
            </div>
          </TacticalErrorBoundary>
        </>
      ) : null}

      {/*
       * THE PROVIDER LIFT 2.13 ASKED FOR, DONE BY STORY 2.12.
       *
       * This block used to mount its own `SortAnnouncerProvider`, with the
       * standing instruction "WHEN 2.12'S PAGE LANDS, LIFT THIS PROVIDER TO THE
       * PAGE and let both regions consume it — do NOT add a second one".
       * 2.12's `page.tsx` now mounts exactly one, wrapping this section and the
       * results/standings region alike, so the nested one is gone: two
       * providers on one page means two polite live regions, which 2.11a ruled
       * decision 9 forbids outright and which fails SILENTLY.
       *
       * `useSortAnnounce()` still resolves — it walks up to the page-level
       * provider — so this section's tables announce exactly as before.
       * Verified in the browser rather than assumed (2.12 Task 9).
       *
       * The boundary stays: it keeps a throw in the runtime region from
       * blanking the Hub, since the teasers above are build-time markup and
       * must survive it.
       */}
      <TacticalErrorBoundary logLabel={LEADERBOARDS_LOG_LABEL}>
        <LeaderboardsRegion />
      </TacticalErrorBoundary>
    </section>
  );
}

/**
 * One board's hero-altitude teaser: its heading, then every row RANKED 3 OR
 * BETTER as a compact ordered list.
 *
 * THE COUNT IS RENDERED, NEVER HARDCODED (Task 2.4, ruling 9). `teaserRows`
 * filters on `rank <= 3` rather than slicing, so a tie at rank 3 yields four or
 * more rows — and this must say so rather than claim three.
 */
function BoardTeaser({ teaser }: { teaser: LeaderboardTeaser }) {
  const t = useT();
  const { locale } = useLocale();
  const { markMetric } = useGlossaryMarking();

  const rows = teaser.shown;
  if (rows.length === 0) {
    return null;
  }

  const format = LEADERBOARD_FORMAT[teaser.metricCode];
  const unitKey = leaderboardUnitKey(LEADERBOARD_UNIT[teaser.metricCode]);
  const heading = `${t(leaderboardMetricKey(teaser.metricCode))}${t(
    "leaderboards.boardSeparator"
  )}${t(teaser.scope === "team" ? "leaderboards.scope.team" : "leaderboards.scope.player")}`;
  const countLabel = `${formatInteger(rows.length, locale)} ${
    rows.length === 1 ? t("leaderboards.teaserCountOne") : t("leaderboards.teaserCount")
  }`;
  /*
   * THE OVERFLOW LINE (ruled by Juan at the 2.13 code review). A card prints at
   * most TEASER_LIMIT rows and then says how many qualifying rows it withheld,
   * rather than cutting them silently — the real emission ties 51 players at
   * rank 1 on `passCompletion/player`. Ruling 9 is intact: `teaserRows` still
   * selects on `rank <= 3`; what is bounded is the CARD, and it states its own
   * truncation, so nothing is misstated.
   *
   * The shared rank is named ONLY when every withheld row carries it. Composed
   * here rather than through a placeholder because t() has no interpolation.
   */
  const overflowLabel =
    teaser.hiddenCount === 0
      ? null
      : teaser.hiddenRank === null
        ? `+${formatInteger(teaser.hiddenCount, locale)} ${t("leaderboards.teaserOverflowMore")}`
        : `+${formatInteger(teaser.hiddenCount, locale)} ${
            teaser.hiddenCount === 1
              ? t("leaderboards.teaserOverflowTiedAtOne")
              : t("leaderboards.teaserOverflowTiedAt")
          } ${formatInteger(teaser.hiddenRank, locale)}`;
  const entityIsTeam = teaser.scope === "team";

  return (
    <article className="rounded-md border border-hairline bg-surface-raised p-4">
      {/*
        THE BOARD'S TERM IS MARKED HERE (Story 2.19 Task 7.9, ledger L2347).
        The heading STRING is still what the caption and the announcement are
        built from; only the rendered node carries the glossary trigger, which
        is why it could not be marked where the ledger first looked — a metric
        name is also a sortable column head, and a focusable trigger cannot nest
        inside a `<button aria-expanded>`.
      */}
      <h4 className="type-stat-label text-ink-secondary">
        {markMetric(teaser.metricCode, heading)}
      </h4>
      <p className="type-caption mt-1 text-ink-secondary">{countLabel}</p>
      <ol className="mt-2 grid grid-cols-1 gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="type-table-numeric text-ink-secondary">
                {formatInteger(row.rank, locale)}
              </span>
              {/*
               * EVERY ROW LINKS (ruling 3, UX-DR22). AD-3 makes the entity id
               * the slug, already route-safe, and `trailingSlash: true` makes
               * the trailing slash required. Both routes are unbuilt today —
               * the shipped LineupsDisclosure / MatchHero precedent, not a
               * departure.
               */}
              <Link
                /*
                 * `playerHref`/`teamHref` (Story 2.15 D10): `/players/` is a
                 * LIVE route from this story on, and the trailing slash has one
                 * definition in `hub-model` rather than three restatements.
                 */
                href={entityIsTeam ? teamHref(row.entityId) : playerHref(row.entityId)}
                /*
                 * Prefetch OFF, for AC 4 and for waste alike — see the PREFETCH
                 * const in LeaderboardsRegion, which records the 48 -> 75
                 * resource measurement that found this. The teasers are
                 * build-time markup, so their links would fire on page load
                 * before the reader has done anything at all.
                 */
                prefetch={false}
                className="truncate type-body text-ink-primary underline underline-offset-2 hover:no-underline"
              >
                {row.entityName}
              </Link>
            </span>
            {/*
             * TEASER UNITS RIDE THE VALUE (ruling 6) — "36,8 km/h", the AC's
             * own example and UJ-4's "his km/h figure, formatted es-CO". A
             * teaser row has NO COLUMN HEAD to carry the unit, which is exactly
             * why es.ts's ruled decision 4 ("the unit NEVER rides the label …
             * never per cell") does not reach this altitude. Joined with a
             * NON-BREAKING space so the two never wrap apart.
             */}
            <span className="whitespace-nowrap type-table-numeric text-ink-primary">
              {unitKey === null
                ? formatLeaderboardValue(row.value, format, locale)
                : `${formatLeaderboardValue(row.value, format, locale)}${NBSP}${t(unitKey)}`}
            </span>
          </li>
        ))}
      </ol>
      {overflowLabel === null ? null : (
        <p className="type-caption mt-2 text-ink-secondary">{overflowLabel}</p>
      )}
    </article>
  );
}

import type { Metadata } from "next";

import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TournamentHubHeading } from "@/components/TournamentHub";
import { TournamentHubRegion } from "@/components/TournamentHubRegion";
import { readTournament } from "@/lib/build-data";
import { composeHubTitle } from "@/lib/hub-model";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";

/*
 * `/tournament` — THE TOURNAMENT HUB, AT ITS OWN ADDRESS (Story 3.9, UX-DR24).
 *
 * ═══════════ THIS IS AN ADDRESS CHANGE, NOT A REDESIGN ═══════════
 *
 * EXPERIENCE.md:60-66, verbatim: "The move is an address change, not a
 * redesign." The nine results sections and twelve standings sections keep their
 * `ViewDataDisclosure` treatment, their outside-the-control counts, their
 * artifact order, their `rank`-as-a-column rendering, their sort behaviour AND
 * their anchors. SM-C2 binds exactly as it did on `/`.
 *
 * Everything below arrived here from `src/app/page.tsx` unedited — the
 * `generateMetadata` export including every load-bearing `openGraph` key, the
 * one-provider rule, and the container. `/` is now the Landing surface
 * (`LandingContent`), which reads no bundle at all.
 *
 * ═══════════ THE FRAGMENTS MOVED WITH THE SURFACE, AND ONE OF THEM IS A
 *             NAV TARGET WITH NO GATE BEHIND IT ═══════════
 *
 * `STANDINGS_SURFACE_ID` (`#standings`) and `RESULTS_SURFACE_ID` (`#results`)
 * are defined in `hub-model.ts:130-131` and rendered by `TournamentHub` and by
 * `TournamentHubRegion`'s loading skeleton. Both are SURFACE fragments: they
 * scroll and open nothing. The per-group anchors (`#standings-group-a`,
 * `#results-r32`) are LEAF fragments and do open, through `openNonce`.
 *
 * 🔴 `nav-destinations.ts`'s `matches` entry points at `/tournament/#results`.
 * The availability gate binds the FLAG to the existence of this `page.tsx` and
 * NOTHING binds it to that fragment resolving — so a Hub that arrived here
 * without `#results` would ship a valid page with a dead nav target, green.
 * Verified in the export at story 3.9 Task 4.4 rather than assumed.
 *
 * Known and deliberate (AD-11's build-time/runtime split, carried not
 * re-derived): `#standings` is in the STATIC HTML, because the loading skeleton
 * emits it as its LCP anchor; `#results` and every per-group anchor arrive only
 * after hydration and the runtime fetch. Do not "improve" this.
 *
 * `output: "export"` with no dynamic segment, so this route needs no
 * `generateStaticParams`.
 */

/*
 * BUILD-TIME READ, METADATA ONLY (ruled D1, and D5b's table for this story).
 * AD-11 allows exactly two data paths: an fs read at build time and the client
 * fetch at runtime. The title takes the first — `tournamentName` is a proper
 * noun the artifact owns (AD-7) and it must exist before any JavaScript runs,
 * for link previews and search results. The TABLES take the second: Story 1.17
 * measured the real index at 409,512 B raw, and AD-11 bans inlining a bundle
 * that size into HTML.
 *
 * The string is composed in the PURE helper, never inline, because the i18n
 * gate flags any template or concatenation that is the direct value of a
 * `title:`/`description:` property — even when every fragment is a t() call
 * (`composeMatchTitle`'s precedent, Story 2.4 decision 8).
 *
 * THE "<title> STAYS SPANISH" QUESTION IS CLOSED, NOT OPEN (Story 3.9 D8).
 * `deferred-work.md:4163` records D17, ruled by Juan 2026-08-25: ACCEPT ES
 * CANONICAL, closed on all 104 + 1,248 + 48 + Hub routes. This route therefore
 * takes NO new position by carrying a title — it carries the one `/` already
 * shipped. (`/about` and `/glossary` still carry docblocks calling that
 * decision open. They are stale; correcting them is out of this story's scope.)
 */
export function generateMetadata(): Metadata {
  const { tournamentName } = readTournament();
  const title = composeHubTitle({
    tournamentName,
    siteName: t("app.siteName"),
    separator: t("hub.separator"),
  });
  const description = t("meta.description");
  /*
   * `og:image` IS A SAME-ORIGIN CARD, AND THE BAN THAT USED TO SIT ON THIS LINE
   * WAS AN OVER-READ (D20, 2026-08-26; Story 3.3). AR-11's "zero external
   * requests" clause scopes to THIRD-PARTY ORIGINS, not to assets as such: a URL
   * in a `<meta>` tag is not a request this page makes at all — it is a hint a
   * crawler may fetch, off-page and off-session, and it cannot touch LCP, TBT,
   * the payload budget or the NFR-9 telemetry surface. `FETCHING_POSITIONS` in
   * `scripts/assert-no-external-origins.mjs` is the operative definition of "a
   * request", and `<meta content>` is deliberately not in it.
   *
   * WHICH MEANS THE ORIGIN GATE DOES NOT HOLD THIS LINE. It reports an
   * off-origin `og:image` and passes. What holds it is
   * `canonical-output.test.ts` over the whole export, plus the per-route
   * assertions in `players/static-output.test.ts` and
   * `teams/static-output.test.ts` — and nothing else.
   */
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
   *
   * NO `alternates` KEY, FOR ANY REASON — not even `{}`. `mergeMetadata`
   * branches on key PRESENCE, so declaring it replaces the layout's object
   * wholesale and this route ships NO canonical at all. `layout.tsx:52-60`
   * calls that trap "sharper" than the `openGraph` one. NO `twitter` KEY
   * either: `card: "summary_large_image"` is declared once on the layout and
   * inherited, and `twitter:image`/`:alt` are DERIVED by Next from
   * `openGraph.images` below.
   */
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "./",
      locale: "es_ES",
      /*
       * `type`, `siteName` and `images` ride the SAME wholesale-replacement
       * trap as `url` and `locale` above (Story 3.3, AC2): this object replaces
       * the layout's, so the layout's card never reaches this route. All three
       * are therefore authored at every `openGraph` site, and the OBJECT is
       * NOT lifted into a shared helper — that would move `alt:` out of the
       * eslint metadata selector's reach and silently disable the rule that
       * makes a bare Spanish literal a build error. The full reasoning lives
       * once, at `src/app/layout.tsx`.
       *
       * THE URL ALONE IS LIFTED, to `@/lib/og-card` (code review 2026-08-27).
       * This comment used to say the whole-export gate "stops the copies
       * drifting"; it did not — it asserted the URL's ORIGIN and never its
       * VALUE, so renaming the asset in one file shipped 1,405 documents
       * pointing at a 404, green. One constant, written by the generator, is
       * what stops it now. `url` is not in the eslint selector's key list, so
       * only it moves; `alt:` stays inline here.
       *
       * The path is ROOT-RELATIVE — `metadataBase` resolves it. An absolute
       * literal would be a second copy of the origin and turns
       * `site-origin.test.ts` red.
       */
      type: "website",
      siteName: t("app.siteName"),
      images: [
        { url: OG_CARD_PATH, width: 1200, height: 630, alt: t("meta.ogImageAlt") },
      ],
    },
  };
}

export default function TournamentPage() {
  return (
    /*
     * max-w-6xl is DESIGN's dashboard width, matching the match route: the
     * standings table's eleven columns and the results table's six do not fit
     * a narrower measure at >=md.
     *
     * `py-`, not `pb-`: this route leads with an <h1> under the sticky site
     * header, and dropping the top half left that <h1> flush against the bar.
     * The bottom-only `pb-` form used by `/compare` and the profile routes is
     * for routes whose first child is not a heading.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      {/*
       * ONE SortAnnouncerProvider FOR THE WHOLE ROUTE. 2.11a ruled decision 9
       * allows exactly one polite live region for sort announcements per page.
       *
       * 🔴 SPLITTING THE ROUTE SPLIT THE NEED (Story 3.9 D9). On `/` this
       * provider wrapped BOTH this region and `LeaderboardsSection`; the
       * leaderboards have moved to `/tops`, which therefore mounts its OWN
       * single provider. That is not a second provider on one page — it is one
       * provider on each of two pages. Story 2.13's standing instruction ("do
       * NOT add a second one") is scoped to a page and is intact.
       *
       * Mounted OUTSIDE every fetch/status gate: a live region that mounts
       * already-populated does not announce reliably, and mounting it with the
       * data would unmount it on the error-path retry. It renders nothing but
       * an empty sr-only span until a table announces through it.
       */}
      <SortAnnouncerProvider>
        <TournamentHubHeading />
        {/* Results and standings from tournament.json (fetched at runtime). */}
        <TournamentHubRegion />
      </SortAnnouncerProvider>
    </div>
  );
}

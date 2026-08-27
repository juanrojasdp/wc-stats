import type { Metadata } from "next";

import { LeaderboardsSection } from "@/components/LeaderboardsSection";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TournamentHubHeading } from "@/components/TournamentHub";
import { TournamentHubRegion } from "@/components/TournamentHubRegion";
import { readLeaderboards, readTournament } from "@/lib/build-data";
import { composeHubTitle } from "@/lib/hub-model";
import { t } from "@/lib/i18n";
import { OG_CARD_PATH } from "@/lib/og-card";
import { leaderboardTeasers } from "@/viz/leaderboard-model";

/*
 * `/` — THE TOURNAMENT HUB (Story 2.12, Task 1.1). Replaces the Story 2.1
 * placeholder body that proved the token/font/locale stack; its four
 * `app.scaffold.*` / `a11y.scaffold.*` keys were retired from both dictionaries
 * in the same change, because this was their only call site.
 *
 * A SERVER COMPONENT over client bodies — the shipped house pattern (`/about`,
 * `/glossary`, `/404`). The client boundary is what makes the language toggle
 * work at all: a server `t()` renders canonical Spanish into the static export
 * and never changes again.
 *
 * `output: "export"` with no dynamic segment, so this route needs no
 * `generateStaticParams`.
 *
 * ------------------------------- COORDINATION -------------------------------
 *
 * STORY 2.13 REACHED THIS FILE FIRST. Its session wrote a minimal Hub here to
 * host `LeaderboardsSection`, with a docblock stating that 2.12's body "takes
 * over this file and appends results and standings ABOVE the section below —
 * keeping the import, the `readLeaderboards()` call and the one
 * <LeaderboardsSection> element, which is the whole of 2.13's mount". That is
 * exactly what this file now does: 2.13's mount is untouched and its chosen
 * page position is honoured rather than re-litigated.
 *
 * Consequently there is NO separate `<div id="leaders">` slot: 2.13 already
 * renders that anchor itself (`LEADERBOARDS_SECTION_ID`), and a second element
 * carrying the same id would be a duplicate-id defect. Task 1.4's slot is
 * discharged BY the real section.
 */

/*
 * BUILD-TIME READ, METADATA ONLY (ruled D1). AD-11 allows exactly two data
 * paths: an fs read at build time and the client fetch at runtime. The title
 * takes the first — `tournamentName` is a proper noun the artifact owns (AD-7)
 * and it must exist before any JavaScript runs, for link previews and search
 * results. The TABLES take the second: Story 1.17 measured the real index at
 * 409,512 B raw, and AD-11 bans inlining a bundle that size into HTML.
 *
 * The string is composed in the PURE helper, never inline, because the i18n
 * gate flags any template or concatenation that is the direct value of a
 * `title:`/`description:` property — even when every fragment is a t() call
 * (`composeMatchTitle`'s precedent, Story 2.4 decision 8).
 *
 * DECLARED TENSION, recorded rather than resolved here: 2.13's draft of this
 * file refused a metadata export on the grounds that the "<title>/OG stays
 * Spanish after an EN toggle" decision is UNRULED, following /about and
 * /glossary (Story 2.18). This story's Task 1.1 requires the export, UX-DR22
 * requires a meaningful <title>/OG per route, and the closest precedent is the
 * DATA-BEARING one — `/matches/[slug]` has shipped `generateMetadata` since
 * Story 2.4. `/` also already carries a title today, from the layout's default
 * `metadata`, so the stays-Spanish consequence is not introduced here. That
 * open ledger entry (owner: Juan) is listed in this story's Dev Notes as
 * affecting `/`; it stays open and this export inherits it.
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
       * are therefore authored at all five `openGraph` sites, and the OBJECT is
       * NOT lifted into a shared helper — that would move `alt:` out of the
       * eslint metadata selector's reach and silently disable the rule that
       * makes a bare Spanish literal a build error. The full reasoning lives
       * once, at `src/app/layout.tsx`.
       *
       * THE URL ALONE IS LIFTED, to `@/lib/og-card` (code review 2026-08-27).
       * This comment used to say the whole-export gate "stops the five copies
       * drifting"; it did not — it asserted the URL's ORIGIN and never its
       * VALUE, so renaming the asset in one of five files shipped 1,405
       * documents pointing at a 404, green. One constant, written by the
       * generator, is what stops it now. `url` is not in the eslint selector's
       * key list, so only it moves; `alt:` stays inline here.
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

export default function Home() {
  /*
   * PROJECTED, NOT PASSED WHOLE (Story 2.13 code review). `LeaderboardsSection`
   * is a client component, so its prop is serialized into this document's flight
   * payload — handing it the full artifact inlined every row to render three per
   * board, and duplicated the bytes the runtime region already fetches. That is
   * the very rule the metadata docblock above cites for `tournament.json`.
   * `leaderboardTeasers` is the pure projection: <=3 rows per board.
   */
  const teasers = leaderboardTeasers(readLeaderboards().boards);

  return (
    /*
     * max-w-6xl is DESIGN's dashboard width, matching the match route: the
     * standings table's eleven columns and the results table's six do not fit
     * a narrower measure at >=md.
     *
     * `py-`, not `pb-`: the shipped route shell (`/about`, `/glossary`) pads
     * both ends, and dropping the top half left the <h1> flush against the
     * sticky site header.
     */
    <div className="mx-auto max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      {/*
       * ONE SortAnnouncerProvider FOR THE WHOLE ROUTE (Task 1.3), wrapping BOTH
       * this story's tables and 2.13's. 2.11a ruled decision 9 allows exactly
       * one polite live region for sort announcements.
       *
       * THIS IS THE LIFT 2.13 ASKED FOR, IN ITS OWN WORDS: it mounted a
       * provider inside `LeaderboardsSection` because 2.12 had not landed, and
       * left the instruction "WHEN 2.12'S PAGE LANDS, LIFT THIS PROVIDER TO THE
       * PAGE and let both regions consume it — do NOT add a second one". The
       * nested one is removed in the same change; leaving both would mint two
       * live regions, and its own comment records that getting this wrong fails
       * SILENTLY.
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
        {/*
         * STORY 2.13's SECTION, and its own `#leaders` anchor (renamed from
         * `#lideres` by 2.19 Task 7.4, ledger A18). Its position is
         * 2.13's choice, stated in the draft of this file it wrote; this story
         * appends above it rather than restructuring around it.
         */}
        <LeaderboardsSection teasers={teasers} />
      </SortAnnouncerProvider>
    </div>
  );
}

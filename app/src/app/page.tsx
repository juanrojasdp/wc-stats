import type { Metadata } from "next";

import { LeaderboardsSection } from "@/components/LeaderboardsSection";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TournamentHubHeading } from "@/components/TournamentHub";
import { TournamentHubRegion } from "@/components/TournamentHubRegion";
import { readLeaderboards, readTournament } from "@/lib/build-data";
import { composeHubTitle } from "@/lib/hub-model";
import { t } from "@/lib/i18n";
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
 * Consequently there is NO separate `<div id="lideres">` slot: 2.13 already
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
  // No og:image — zero external/asset requests (AR-11).
  return { title, description, openGraph: { title, description } };
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
         * STORY 2.13's SECTION, and its own `#lideres` anchor. Its position is
         * 2.13's choice, stated in the draft of this file it wrote; this story
         * appends above it rather than restructuring around it.
         */}
        <LeaderboardsSection teasers={teasers} />
      </SortAnnouncerProvider>
    </div>
  );
}

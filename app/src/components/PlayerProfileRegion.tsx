"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { PhysicalSection } from "@/components/PhysicalSection";
import { PlayerAggregatesSection } from "@/components/PlayerAggregatesSection";
import { PlayerMatchesSection } from "@/components/PlayerMatchesSection";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { TrendsSection } from "@/components/TrendsSection";
import { Button } from "@/components/ui/button";
import type { PlayerProfile } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { useT } from "@/lib/i18n-provider";
import {
  aggregateRows,
  matchRows,
  physicalModel,
  trendSeries,
} from "@/viz/player-profile-model";

/*
 * The below-Hero runtime region for `/players/{slug}` (Story 2.15, AD-11's
 * client half). On mount it fetches EXACTLY ONE artifact — this player's own
 * profile — through the sole fetch path, and holds it in ephemeral state (AD-10:
 * no cache, no store, no state library).
 *
 * It mirrors `MatchBundleRegion` / `LeaderboardsRegion` rather than inventing a
 * shape: the same four-state machine, the same `cancelled` cleanup flag, the
 * same retry `attempt` counter, the same persistent polite live region, and the
 * same focus move to the aria-busy skeleton on retry.
 */

/*
 * "error" and "invalid" ARE DELIBERATELY DISTINCT. A fetch that failed is a
 * network problem the reader can retry; a payload that ARRIVED INTACT and then
 * failed the playerId/schemaVersion gate is a data-integrity problem — telling
 * that reader to check their connection misnames the cause, and a retry button
 * would re-fetch the identical bad artifact forever. `LeaderboardsRegion`: "a
 * retry cannot change the answer."
 */
type Status = "loading" | "loaded" | "error" | "invalid";

/** DEVELOPER-facing console label, never user copy — hence a const, not a t(). */
const PROFILE_LOG_LABEL = "PlayerProfileRegion render failed";

export function PlayerProfileRegion({ slug }: { slug: string }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);

  // Retry unmounts the panel that owns focus, dropping the caret to <body>.
  // `attempt` only ever increments on a retry click.
  useEffect(() => {
    if (attempt > 0) {
      busyRef.current?.focus();
    }
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    /*
     * `data.ts` prefixes DATA_ROOT ("/data/fixtures" today, "/data" after 2.19's
     * cutover) and `scripts/copy-data.mjs` copies the whole tree verbatim into
     * `out/data`, so the fixture profiles ship with NO script change.
     */
    fetchArtifact<PlayerProfile>(`/index/player-profiles/${slug}.json`)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        /*
         * VALIDATE BEFORE DECLARING SUCCESS. A stale CDN copy or a redirected
         * 200 parses fine and would render another player's numbers under this
         * player's name. `payload` IS TYPED NON-NULL, WHICH PROVES NOTHING HERE
         * — this is the untyped fetch boundary and the type is a cast.
         */
        if (payload.playerId !== slug || payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("invalid");
          return;
        }
        setProfile(payload);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  return (
    <div className="mt-layer-gap">
      {/*
       * Persistent polite live region — announces only when its text changes,
       * i.e. once the fetch resolves (and again on a language toggle). Failure
       * announces too: silence on the one state that needs feedback strands a
       * screen-reader user who has scrolled past the Hero.
       */}
      <span aria-live="polite" className="sr-only">
        {status === "loaded" ? t("player.region.loaded") : null}
        {status === "error" ? t("player.region.error") : null}
        {status === "invalid" ? t("player.region.invalid") : null}
      </span>

      {status === "loading" ? (
        <div
          ref={busyRef}
          tabIndex={-1}
          /*
           * `role="group"` IS LOAD-BEARING, not decoration (code review
           * 2026-08-07). A `<div>` with no role maps to `role="generic"`, for
           * which ARIA declares name-from-author PROHIBITED — so the
           * `aria-label` below is DROPPED, axe's `aria-prohibited-attr` flags
           * it, and the retry `focus()` above lands on an unnamed node that
           * announces nothing, making the whole keep-the-reader-oriented patch
           * inert. `group` is the minimal role that legitimately takes a name
           * and adds no live region. Found at the Story 2.13 review and fixed in
           * `LeaderboardsRegion`; this file mirrored `MatchBundleRegion`, which
           * is the sibling that was missed, and inherited the defect with it.
           */
          role="group"
          aria-busy="true"
          aria-label={t("player.region.loading")}
          className="grid gap-tile-gap"
        >
          {/* Layout-shaped: zone chart block, trend chart block, two tables. */}
          <div className="skeleton h-[196px] w-full" />
          <div className="skeleton mt-6 h-[192px] w-full" />
          <div className="skeleton mt-6 h-32 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="type-body text-destructive">{t("player.region.error")}</p>
          <Button
            variant="destructive"
            onClick={() => {
              setStatus("loading");
              setProfile(null);
              setAttempt((value) => value + 1);
            }}
            className="mt-3 min-h-11"
          >
            {t("match.bundle.retry")}
          </Button>
        </div>
      ) : null}

      {/* Arrived intact, wrong player or wrong schema. NO RETRY. */}
      {status === "invalid" ? (
        <EmptyStatePanel
          headline={t("player.region.invalid")}
          explanation={t("player.region.invalidExplanation")}
        />
      ) : null}

      {/*
       * EXACTLY ONE `SortAnnouncerProvider` on this route, and it is OUTSIDE the
       * status gate so its one polite region is mounted for the route's lifetime
       * rather than appearing with the payload — a live region that mounts
       * already-populated does not announce reliably, and mounting it with the
       * data would also reset it on the error-path retry.
       *
       * Three tables announce through it (physical, aggregates, matches) plus
       * the trends alternative, which is why every one of them passes
       * `tableName`.
       */}
      <SortAnnouncerProvider>
        {status === "loaded" && profile !== null ? (
          /*
           * The boundary keeps the model's and the format layer's honesty from
           * costing the reader the whole route: both throw loudly by design, and
           * the Hero above is build-time markup that must survive a bad payload.
           *
           * EVERY ROW IS BUILT HERE, EAGERLY, before any disclosure mounts — so
           * a bad value fails on LOAD rather than when the reader opens "Ver los
           * datos" (Story 2.9's review finding: "Guard at model entry and fail
           * loud on load").
           */
          <TacticalErrorBoundary
            headlineKey="player.region.crashed"
            explanationKey="player.region.crashedExplanation"
            logLabel={PROFILE_LOG_LABEL}
          >
            <ProfileSections profile={profile} />
          </TacticalErrorBoundary>
        ) : null}
      </SortAnnouncerProvider>
    </div>
  );
}

/**
 * The four sections, in the ruled disclosure-grammar order (EXPERIENCE.md:209 —
 * "headline aggregates first (hero altitude), tactical identity/trend
 * visualizations second, full per-match tables last"): physical, trends,
 * aggregates, per-match.
 *
 * PLAIN `<section>` BLOCKS IN NORMAL FLOW. There is no collapsible shell on this
 * route: `TacticalSection` is do-not-touch and its `id` prop is typed to the
 * closed eleven-member `SectionId`, `ViewDataDisclosure` is the viz-alternative
 * control rather than a section shell, and 2.11b ruled Expert tables are not
 * behind "Ver los datos". Widening `SectionId` or building a second expansion
 * model was rejected.
 *
 * Split out of the region so every model call sits INSIDE the error boundary —
 * a throw in `matchRows` at the region's own body would escape it.
 */
function ProfileSections({ profile }: { profile: PlayerProfile }) {
  const physical = physicalModel(profile);
  const trends = trendSeries(profile);
  const aggregates = aggregateRows(profile);
  const matches = matchRows(profile);
  return (
    <>
      <PhysicalSection physical={physical} />
      <TrendsSection series={trends} />
      <PlayerAggregatesSection rows={aggregates} />
      <PlayerMatchesSection rows={matches} />
    </>
  );
}

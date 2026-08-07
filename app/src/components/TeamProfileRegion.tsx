"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyStatePanel } from "@/components/EmptyStatePanel";
import { SortAnnouncerProvider } from "@/components/SortAnnouncer";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { TeamFormationsSection } from "@/components/TeamFormationsSection";
import { TeamIdentitySection } from "@/components/TeamIdentitySection";
import { TeamMatchesSection } from "@/components/TeamMatchesSection";
import { Button } from "@/components/ui/button";
import type { TeamProfile } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { useT } from "@/lib/i18n-provider";
/* Read-only import: `phases-model.ts` is do-not-touch and stays untouched. The
 * skeleton takes its chart heights from the SAME function the charts do. */
import { distributionChartHeightClass } from "@/viz/phases-model";
import {
  formationRows,
  identityCharts,
  shapeTables,
  teamMatchRows,
} from "@/viz/team-profile-model";

/*
 * The below-Hero runtime region for `/teams/{slug}` (Story 2.16, AD-11's client
 * half). On mount it fetches EXACTLY ONE artifact — this team's own profile —
 * through the sole fetch path, and holds it in ephemeral state (AD-10: no cache,
 * no store, no state library).
 *
 * It mirrors `PlayerProfileRegion` / `MatchBundleRegion` rather than inventing a
 * shape: the same four-state machine, the same `cancelled` cleanup flag, the
 * same retry `attempt` counter, the same persistent polite live region, and the
 * same focus move to the aria-busy skeleton on retry.
 *
 * THE ARTIFACT IS READ TWICE, ONCE PER AD-11 PATH, AND THAT IS THE DESIGN. The
 * Hero above was projected from a build-time fs read; this fetch is independent
 * and the two never share state.
 */

/*
 * "error" and "invalid" ARE DELIBERATELY DISTINCT. A fetch that failed is a
 * network problem the reader can retry; a payload that ARRIVED INTACT and then
 * failed the teamId/schemaVersion gate is a data-integrity problem — telling
 * that reader to check their connection misnames the cause, and a retry button
 * would re-fetch the identical bad artifact forever. `LeaderboardsRegion`: "a
 * retry cannot change the answer."
 */
type Status = "loading" | "loaded" | "error" | "invalid";

/** DEVELOPER-facing console label, never user copy — hence a const, not a t(). */
const PROFILE_LOG_LABEL = "TeamProfileRegion render failed";

export function TeamProfileRegion({ slug }: { slug: string }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<TeamProfile | null>(null);
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
    fetchArtifact<TeamProfile>(`/index/team-profiles/${slug}.json`)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        /*
         * VALIDATE BEFORE DECLARING SUCCESS. A stale CDN copy or a redirected
         * 200 parses fine and would render another team's numbers under this
         * team's name. `payload` IS TYPED NON-NULL, WHICH PROVES NOTHING HERE —
         * this is the untyped fetch boundary and the type is a cast.
         *
         * SO THE SHAPE IS CHECKED BEFORE IT IS DEREFERENCED (code review
         * 2026-08-07). The line below reads `payload.teamId`, and the docblock
         * above is the reason that is not safe on its own: a body of `null`, a
         * bare array or a JSON scalar all parse, all satisfy the cast, and all
         * throw a TypeError on the dot. That throw landed in `.catch` and became
         * `"error"` — the RETRYABLE state — so a permanently malformed artifact
         * offered a retry button forever. A non-object body is a data-integrity
         * failure exactly like a teamId mismatch, and takes the same no-retry
         * `"invalid"` branch.
         */
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
          setStatus("invalid");
          return;
        }
        if (payload.teamId !== slug || payload.schemaVersion !== SCHEMA_VERSION) {
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
        {status === "loaded" ? t("team.region.loaded") : null}
        {status === "error" ? t("team.region.error") : null}
        {status === "invalid" ? t("team.region.invalid") : null}
      </span>

      {status === "loading" ? (
        <div
          ref={busyRef}
          tabIndex={-1}
          aria-busy="true"
          /*
           * `role="group"` IS LOAD-BEARING, not decoration (code review
           * 2026-08-07). A `<div>` with no role maps to `role="generic"`, for
           * which ARIA declares name-from-author PROHIBITED — so the
           * `aria-label` below is DROPPED, axe's `aria-prohibited-attr` flags
           * it, and the retry `focus()` above lands on an unnamed node. The
           * sibling this region mirrors carries the same role for the same
           * reason (`PlayerProfileRegion.tsx`, `LeaderboardsRegion.tsx`); this
           * file mirrored its PRE-PATCH shape and inherited the defect.
           */
          role="group"
          aria-label={t("team.region.loading")}
          className="grid gap-tile-gap"
        >
          {/*
           * LAYOUT-SHAPED (UX-DR14), AND NOW ACTUALLY SHAPED LIKE THE PAYLOAD
           * (code review 2026-08-07). This emitted five blocks for eight
           * rendered surfaces, with `mt-6` margins fighting the grid's own
           * `gap-tile-gap` and every height hardcoded — so the anti-CLS claim
           * the comment made was unbacked, and two of the four charts had no
           * placeholder at all.
           *
           * THE FOUR CHART HEIGHTS COME FROM THE SAME FUNCTION THE CHARTS DO.
           * `distributionChartHeightClass` is what `identityCharts` calls for
           * each rate chart's `heightClass` (8, 9, 3 and 4 categories, in the
           * ruled section order), so the fallback and the chart cannot drift —
           * which is the whole point of a layout-shaped skeleton. The four
           * table blocks stay approximate: a table's height is row-count
           * driven and no shipped helper predicts it.
           */}
          <div className={`skeleton w-full ${distributionChartHeightClass(8)}`} />
          <div className={`skeleton w-full ${distributionChartHeightClass(9)}`} />
          <div className={`skeleton w-full ${distributionChartHeightClass(3)}`} />
          <div className={`skeleton w-full ${distributionChartHeightClass(4)}`} />
          {/* The two `shapeByPhase` tables (D13), formations, then per-match. */}
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="type-body text-destructive">{t("team.region.error")}</p>
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

      {/* Arrived intact, wrong team or wrong schema. NO RETRY. */}
      {status === "invalid" ? (
        <EmptyStatePanel
          headline={t("team.region.invalid")}
          explanation={t("team.region.invalidExplanation")}
        />
      ) : null}

      {/*
       * EXACTLY ONE `SortAnnouncerProvider` on this route, and it is OUTSIDE the
       * status gate so its one polite region is mounted for the route's lifetime
       * rather than appearing with the payload — a live region that mounts
       * already-populated does not announce reliably, and mounting it with the
       * data would also reset it on the error-path retry. Two providers would be
       * two live regions, a 2.11a decision 9 violation that FAILS SILENTLY:
       * `useSortAnnounce()` is a no-op outside a provider.
       *
       * Eight tables announce through it (four chart alternatives, two shape
       * tables, formations, per-match), which is why every one passes `tableName`.
       */}
      <SortAnnouncerProvider>
        {status === "loaded" && profile !== null ? (
          /*
           * The boundary keeps the model's and the format layer's honesty from
           * costing the reader the whole route: both throw loudly by design, and
           * the Hero above is build-time markup that must survive a bad payload.
           */
          <TacticalErrorBoundary
            headlineKey="team.region.crashed"
            explanationKey="team.region.crashedExplanation"
            logLabel={PROFILE_LOG_LABEL}
          >
            <TeamSections profile={profile} />
          </TacticalErrorBoundary>
        ) : null}
      </SortAnnouncerProvider>
    </div>
  );
}

/**
 * The three sections, in the ruled disclosure-grammar order
 * (`EXPERIENCE.md:209` — "headline aggregates first (hero altitude), tactical
 * identity/trend visualizations second, full per-match tables last"): identity,
 * formations, per-match.
 *
 * PLAIN `<section>` BLOCKS IN NORMAL FLOW. There is no collapsible shell on this
 * route: `TacticalSection` is do-not-touch and its `id` prop is typed to the
 * closed eleven-member `SectionId`, and `ViewDataDisclosure` is the
 * viz-alternative control rather than a section shell. Widening `SectionId` was
 * rejected.
 *
 * EVERY ROW SET IS BUILT HERE, EAGERLY, before any disclosure mounts — so a bad
 * value fails on LOAD rather than when the reader opens "Ver los datos" (Story
 * 2.9's review finding: "Guard at model entry and fail loud on load").
 *
 * Split out of the region so every model call sits INSIDE the error boundary —
 * a throw in `identityCharts` at the region's own body would escape it.
 */
function TeamSections({ profile }: { profile: TeamProfile }) {
  const charts = identityCharts(profile);
  const shape = shapeTables(profile);
  const formations = formationRows(profile);
  const matches = teamMatchRows(profile);
  return (
    <>
      <TeamIdentitySection charts={charts} shape={shape} teamName={profile.name} />
      <TeamFormationsSection rows={formations} />
      <TeamMatchesSection rows={matches} />
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { TacticalLayer } from "@/components/TacticalLayer";
import { Button } from "@/components/ui/button";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { SCHEMA_VERSION } from "@/lib/contract/schema-version";
import { fetchArtifact } from "@/lib/data";
import { useT } from "@/lib/i18n-provider";

/*
 * Below-Hero runtime region (Task 6, AC 3). The server page passes only the
 * matchId; on mount this fetches EXACTLY one artifact — the match's own bundle
 * (FR-34: no tournament.json at runtime) — via the sole fetch path. State is
 * ephemeral (AD-10: no cache, no store). While loading it shows layout-shaped
 * skeletons with aria-busy; on success a polite live region announces "Datos
 * cargados." and the Tactical Layer (Story 2.5) renders from the held payload;
 * on failure an inline retry panel appears with the shell and nav left fully
 * usable.
 *
 * The announcement text is rendered from t() in a persistent live region, so a
 * post-load language toggle re-announces it in the new language (Task 9.3)
 * without re-fetching.
 */

type Status = "loading" | "loaded" | "error";

export function MatchBundleRegion({ matchId }: { matchId: string }) {
  const t = useT();
  const [status, setStatus] = useState<Status>("loading");
  const [bundle, setBundle] = useState<MatchBundle | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef<HTMLDivElement>(null);

  // Retry unmounts the panel that owns focus, which would drop the caret to
  // <body>. attempt only ever increments on a retry click, so moving focus to
  // the (named, aria-busy) skeleton region keeps a keyboard/SR user oriented.
  useEffect(() => {
    if (attempt > 0) {
      busyRef.current?.focus();
    }
  }, [attempt]);

  useEffect(() => {
    // Initial state is already "loading"; retry resets it in its handler, so
    // the effect never sets state synchronously (react-hooks/set-state-in-effect).
    let cancelled = false;
    fetchArtifact<MatchBundle>(`/matches/${matchId}.json`)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        /*
         * Validate before declaring success (2.4 deferred decision D4, closed
         * here now that the payload is actually consumed). A stale CDN copy or
         * a redirected 200 parses fine and would render another match's data,
         * or v1 shapes against a v2 reader — both take the error branch.
         * SCHEMA_VERSION comes from the generated module; never hardcoded.
         */
        if (payload.matchId !== matchId || payload.schemaVersion !== SCHEMA_VERSION) {
          setStatus("error");
          return;
        }
        setBundle(payload);
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
  }, [matchId, attempt]);

  return (
    <div className="mt-layer-gap">
      {/*
       * Persistent polite live region — announces only when its text changes,
       * i.e. once the fetch resolves (and again if the locale is toggled).
       * Failure announces too: silence on the one state that needs feedback
       * strands a screen-reader user who has scrolled past the Hero.
       */}
      <span aria-live="polite" className="sr-only">
        {status === "loaded" ? t("match.bundle.loaded") : null}
        {status === "error" ? t("match.bundle.error") : null}
      </span>

      {status === "loading" ? (
        <div
          ref={busyRef}
          tabIndex={-1}
          aria-busy="true"
          aria-label={t("match.bundle.loading")}
          className="grid gap-tile-gap"
        >
          {/* key-stats paired rows */}
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-11 w-full" />
          {/* momentum card block */}
          <div className="skeleton mt-6 h-32 w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <p className="type-body text-destructive">{t("match.bundle.error")}</p>
          <Button
            variant="destructive"
            onClick={() => {
              setStatus("loading");
              setBundle(null);
              setAttempt((a) => a + 1);
            }}
            className="mt-3 min-h-11"
          >
            {t("match.bundle.retry")}
          </Button>
        </div>
      ) : null}

      {status === "loaded" && bundle !== null ? <TacticalLayer bundle={bundle} /> : null}
    </div>
  );
}

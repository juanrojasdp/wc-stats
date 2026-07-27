"use client";

import { useEffect, useState, type ReactNode } from "react";

import { EmptyStatePanel, PendingSectionPanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import { KeyStatisticsSection } from "@/components/KeyStatisticsSection";
import { ShotMapsSection } from "@/components/ShotMapsSection";
import { TacticalSection } from "@/components/TacticalSection";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { useT } from "@/lib/i18n-provider";
import {
  SECTION_IDS,
  buildSectionPlans,
  isCollapsibleId,
  sectionSummaryKey,
  sectionTitleKey,
  type SectionId,
} from "@/lib/tactical-sections";
import { LG_MEDIA_QUERY, useMediaQuery } from "@/lib/use-media-query";

/*
 * The Tactical Layer (Task 4, AC 1): eleven section shells in the registry's
 * normative order, with the disclosure behaviour UX-DR6/UX-DR18 rule.
 *
 * This layer is CLIENT-ONLY by AR-11 — it mounts inside MatchBundleRegion's
 * loaded branch, so no Tactical markup exists in out/ and the browser has
 * already given up on a "#momentum" deep link by the time the target mounts.
 * The mount-time hash read below is not belt-and-braces; it is the only thing
 * that makes anchors work at all.
 */

/** Which section a hash names, or null for anything else (#main-content, #expert). */
function sectionIdFromHash(hash: string): SectionId | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return SECTION_IDS.find((id) => id === raw) ?? null;
}

interface FocusRequest {
  id: SectionId;
  nonce: number;
  scroll: boolean;
}

export function TacticalLayer({ bundle }: { bundle: MatchBundle }) {
  const t = useT();
  // AC 3's section-named absence copy, shared with the panel-level absence
  // ShotMapsSection renders (Story 2.7 Task 8.2a).
  const emptyHeadline = useEmptyHeadline();
  const isLg = useMediaQuery(LG_MEDIA_QUERY);
  // Explicit user/anchor decisions only; everything unset follows the
  // breakpoint, so a resize past lg still expands the untouched sections.
  const [overrides, setOverrides] = useState<Partial<Record<SectionId, boolean>>>({});
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  useEffect(() => {
    function openFromHash() {
      const id = sectionIdFromHash(window.location.hash);
      if (id === null) {
        return;
      }
      setOverrides((previous) => ({ ...previous, [id]: true }));
      setFocus((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1, scroll: true }));
    }
    // Run once for the deep link that landed before this subtree existed, then
    // stay subscribed for in-page anchor navigation.
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function toggle(id: SectionId, willOpen: boolean) {
    setOverrides((previous) => ({ ...previous, [id]: willOpen }));
    if (willOpen) {
      // Focus moves into what was revealed only on a user toggle; closing
      // leaves focus on the trigger where the user put it.
      setFocus((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1, scroll: false }));
    }
  }

  /*
   * Content dispatch (Task 4.6). ONE explicit switch so stories 2.6-2.10 each
   * replace exactly one line, with a default that throws on an unknown id
   * rather than rendering nothing.
   */
  function sectionContent(id: SectionId): ReactNode {
    switch (id) {
      case "key-stats":
        return (
          <KeyStatisticsSection
            keyStatistics={bundle.keyStatistics}
            homeCode={bundle.metadata.homeTeam.teamCode.toUpperCase()}
            awayCode={bundle.metadata.awayTeam.teamCode.toUpperCase()}
          />
        );
      case "shot-maps":
        return (
          <ShotMapsSection
            shots={bundle.events.shots}
            crosses={bundle.events.crosses}
            home={{
              teamId: bundle.metadata.homeTeam.teamId,
              teamCode: bundle.metadata.homeTeam.teamCode.toUpperCase(),
              name: bundle.metadata.homeTeam.name,
            }}
            away={{
              teamId: bundle.metadata.awayTeam.teamId,
              teamCode: bundle.metadata.awayTeam.teamCode.toUpperCase(),
              name: bundle.metadata.awayTeam.name,
            }}
            teamXg={{
              home: bundle.keyStatistics.home.expectedGoals,
              away: bundle.keyStatistics.away.expectedGoals,
            }}
          />
        );
      case "momentum":
      case "pass-networks":
      case "offers-to-receive":
      case "movement-to-receive":
      case "defensive-actions":
      case "phases":
      case "pressing":
      case "set-plays":
      case "goalkeeping":
        return <PendingSectionPanel />;
      default: {
        const unexpected: never = id;
        throw new Error(`TacticalLayer: unknown section id ${JSON.stringify(unexpected)}`);
      }
    }
  }

  /*
   * Disclosure policy and vertical rhythm both live in buildSectionPlans, in
   * the pure registry module where they can be unit-tested — this loop used to
   * sit inline here, which meant the logic AC 1 is actually about was the one
   * part of the story with no test at all.
   *
   * The Hero→Tactical layer-gap already lives on MatchBundleRegion's
   * container; nothing here adds a second one.
   */
  const plans = buildSectionPlans(bundle, isLg, overrides);

  return (
    <div>
      {plans.map((plan) => {
        const title = t(sectionTitleKey(plan.id));
        return (
          <TacticalSection
            key={plan.id}
            id={plan.id}
            title={title}
            summary={
              plan.showSummary && isCollapsibleId(plan.id) ? t(sectionSummaryKey(plan.id)) : null
            }
            collapsible={plan.collapsible}
            open={plan.open}
            onToggle={() => toggle(plan.id, !plan.open)}
            focusNonce={focus?.id === plan.id ? focus.nonce : 0}
            focusScroll={focus?.id === plan.id ? focus.scroll : false}
            className={plan.spacedFromPrevious ? "mt-section-gap" : undefined}
          >
            {plan.isEmpty ? (
              <EmptyStatePanel
                headline={emptyHeadline(title)}
                explanation={t("tactical.empty.explanation")}
              />
            ) : (
              sectionContent(plan.id)
            )}
          </TacticalSection>
        );
      })}
    </div>
  );
}

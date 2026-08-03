"use client";

import { useEffect, useState, type ReactNode } from "react";

import { DefensiveActionsSection } from "@/components/DefensiveActionsSection";
import { EmptyStatePanel, PendingSectionPanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import { KeyStatisticsSection } from "@/components/KeyStatisticsSection";
import { MomentumSection } from "@/components/MomentumSection";
import { MovementToReceiveSection } from "@/components/MovementToReceiveSection";
import { OffersToReceiveSection } from "@/components/OffersToReceiveSection";
import { PassNetworksSection } from "@/components/PassNetworksSection";
import { ShotMapsSection } from "@/components/ShotMapsSection";
import { TacticalSection } from "@/components/TacticalSection";
import type { MatchBundle } from "@/lib/contract/contract-types";
import type { DictionaryKey } from "@/lib/i18n";
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

/*
 * Per-section DEDICATED empty-state copy (Story 2.6 ruled decision 12).
 *
 * UX-DR13 and EXPERIENCE.md:92 require one specific sentence for the momentum
 * section — "La línea de momentum no está disponible para este partido." — not
 * the generic "Sin datos de {sección} para este partido." composition. The
 * override is a LOOKUP applied at the `headline=` prop below, never a
 * conditional hook call: useEmptyHeadline() takes no argument, stays called
 * unconditionally, and remains the default for the other ten sections. The hook
 * is not forked.
 */
const EMPTY_HEADLINE_OVERRIDE: Partial<Record<SectionId, DictionaryKey>> = {
  momentum: "tactical.empty.momentumHeadline",
  /*
   * Story 2.9 ruled decision 4. These two sections are "empty" when
   * `bundle.players === null` (ruled decision 3) — a DOMAIN G absence, not a
   * receiving-section absence. The report's receiving pages may be perfectly
   * present, so the generic headline would name the wrong thing.
   */
  "offers-to-receive": "tactical.empty.receivingHeadline",
  "movement-to-receive": "tactical.empty.receivingHeadline",
};

/*
 * The EXPLANATION half of the same override (Story 2.9 ruled decision 4).
 *
 * The generic explanation is literally "El informe oficial no incluye esta
 * sección." Shipping that over a Domain G absence would be a FALSE STATEMENT —
 * the same dishonesty EmptyStatePanel's own docblock exists to prevent, and the
 * mirror of the FR-22 inversion decision 3 cites as its own justification. This
 * mechanism is additive: the other nine sections keep the generic sentence.
 */
const EMPTY_EXPLANATION_OVERRIDE: Partial<Record<SectionId, DictionaryKey>> = {
  "offers-to-receive": "tactical.empty.receivingExplanation",
  "movement-to-receive": "tactical.empty.receivingExplanation",
};

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
      case "pass-networks":
        return (
          <PassNetworksSection
            nodes={bundle.events.passNetworkNodes}
            edges={bundle.events.passNetworkEdges}
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
          />
        );
      case "momentum":
        return (
          <MomentumSection
            momentum={bundle.momentum}
            goals={bundle.metadata.goals}
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
          />
        );
      /*
       * Story 2.9's three sections. Narrow, explicit props — never the whole
       * bundle (Story 2.5 Task 5.1's precedent).
       *
       * The two receiving sections take `bundle.players`, NOT
       * `bundle.events.receiving`: `ReceivingEvent` is unfulfillable in every
       * one of its eight required fields (Story 1.13), so that table can only
       * ever be null. See ruled decisions 1 and 2.
       */
      case "offers-to-receive":
        return (
          <OffersToReceiveSection
            players={bundle.players}
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
          />
        );
      case "movement-to-receive":
        return (
          <MovementToReceiveSection
            players={bundle.players}
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
          />
        );
      case "defensive-actions":
        return (
          <DefensiveActionsSection
            defensiveActions={bundle.events.defensiveActions}
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
          />
        );
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
        /*
         * Hoisted into an identifier: the ternary form inside the `headline=`
         * prop trips the i18n gate, which requires a plain identifier there.
         */
        const overrideKey = EMPTY_HEADLINE_OVERRIDE[plan.id];
        const emptyCopy = overrideKey === undefined ? emptyHeadline(title) : t(overrideKey);
        // Same hoist, same reason: a ternary inside `explanation=` trips the
        // i18n gate, which requires a plain identifier there.
        const explanationKey = EMPTY_EXPLANATION_OVERRIDE[plan.id] ?? "tactical.empty.explanation";
        const emptyExplanation = t(explanationKey);
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
              <EmptyStatePanel headline={emptyCopy} explanation={emptyExplanation} />
            ) : (
              sectionContent(plan.id)
            )}
          </TacticalSection>
        );
      })}
    </div>
  );
}

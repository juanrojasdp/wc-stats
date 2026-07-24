"use client";

import { useEffect, useState, type ReactNode } from "react";

import { EmptyStatePanel, PendingSectionPanel } from "@/components/EmptyStatePanel";
import { KeyStatisticsSection } from "@/components/KeyStatisticsSection";
import { TacticalSection } from "@/components/TacticalSection";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { useT } from "@/lib/i18n-provider";
import {
  COLLAPSIBLE_SECTION_IDS,
  SECTION_IDS,
  sectionDataState,
  sectionSummaryKey,
  sectionTitleKey,
  type CollapsibleSectionId,
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

const COLLAPSIBLE_IDS = new Set<SectionId>(COLLAPSIBLE_SECTION_IDS);

function isCollapsibleId(id: SectionId): id is CollapsibleSectionId {
  return COLLAPSIBLE_IDS.has(id);
}

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
      case "momentum":
      case "shot-maps":
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
   * Disclosure policy in precedence order (Task 4.3), resolved for every
   * section before rendering:
   *   1. empty  → never collapsible at any width (ruled decision 10 — an
   *      absence you must tap to discover is still a silent absence, and a
   *      summary line for data that is not there is nonsense);
   *   2. key-stats / momentum → never collapsible (ruled decision 3);
   *   3. everything else → collapsible, and only BELOW lg. At ≥lg the section
   *      renders in the expanded presentation: a plain <h2>, no trigger and no
   *      summary line, exactly as the desktop mockup draws it (AC 1 gives
   *      Accordion semantics to the <lg presentation only).
   *
   * Rhythm (Task 4.4): expanded sections are separated by section-gap; the run
   * of collapsed shells stacks directly on its own hairlines, with one
   * section-gap before the first of the run. The Hero→Tactical layer-gap
   * already lives on MatchBundleRegion's container. Computed in a straight
   * loop here rather than by mutating across map callbacks.
   */
  interface SectionPlan {
    id: SectionId;
    isEmpty: boolean;
    collapsible: boolean;
    open: boolean;
    summary: string | null;
    spacing: string | undefined;
  }

  const plans: SectionPlan[] = [];
  let previousWasShell = false;
  for (const [index, id] of SECTION_IDS.entries()) {
    const isEmpty = sectionDataState(bundle, id) === "empty";
    const collapsible = !isEmpty && !isLg && isCollapsibleId(id);
    // Collapsible implies <lg, so the default is collapsed; a user or anchor
    // override survives a trip out to ≥lg and back.
    const open = collapsible ? (overrides[id] ?? false) : true;
    const isShell = collapsible && !open;
    plans.push({
      id,
      isEmpty,
      collapsible,
      open,
      summary: collapsible && isCollapsibleId(id) ? t(sectionSummaryKey(id)) : null,
      spacing: index > 0 && !(isShell && previousWasShell) ? "mt-section-gap" : undefined,
    });
    previousWasShell = isShell;
  }

  return (
    <div>
      {plans.map((plan) => (
        <TacticalSection
          key={plan.id}
          id={plan.id}
          title={t(sectionTitleKey(plan.id))}
          summary={plan.summary}
          collapsible={plan.collapsible}
          open={plan.open}
          onToggle={() => toggle(plan.id, !plan.open)}
          focusNonce={focus?.id === plan.id ? focus.nonce : 0}
          focusScroll={focus?.id === plan.id ? focus.scroll : false}
          className={plan.spacing}
        >
          {plan.isEmpty ? (
            <EmptyStatePanel
              headline={t("tactical.empty.headline")}
              explanation={t("tactical.empty.explanation")}
            />
          ) : (
            sectionContent(plan.id)
          )}
        </TacticalSection>
      ))}
    </div>
  );
}

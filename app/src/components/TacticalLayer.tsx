"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DefensiveActionsSection } from "@/components/DefensiveActionsSection";
/*
 * `PendingSectionPanel` is NO LONGER IMPORTED. Story 2.10 gives every SectionId
 * a real component, so it loses its last call site — and a dead binding here
 * would be caught by NOTHING in the build chain:
 * @typescript-eslint/no-unused-vars is not in the flat config's active set and
 * tsconfig sets no noUnusedLocals, so `eslint --max-warnings 0` exits 0 on one.
 * Story 2.9 shipped dead bindings and took a review finding for it.
 *
 * THE COMPONENT ITSELF AND ITS tactical.pending.* KEYS STAY (ruled decision
 * 20): EmptyStatePanel.tsx is outside this story's touch list, the Expert Layer
 * (2.11) may want the same shell, and deleting live locale keys is a change
 * three exhaustiveness tests would have to be reasoned about. The keep-or-delete
 * call is routed to 2.11 in deferred-work.md.
 */
import { EmptyStatePanel, useEmptyHeadline } from "@/components/EmptyStatePanel";
import { GoalkeepingSection } from "@/components/GoalkeepingSection";
import { KeyStatisticsSection } from "@/components/KeyStatisticsSection";
import { MomentumSection } from "@/components/MomentumSection";
import { MovementToReceiveSection } from "@/components/MovementToReceiveSection";
import { OffersToReceiveSection } from "@/components/OffersToReceiveSection";
import { PassNetworksSection } from "@/components/PassNetworksSection";
import { PhasesSection } from "@/components/PhasesSection";
import { PressingSection } from "@/components/PressingSection";
import { SetPlaysSection } from "@/components/SetPlaysSection";
import { ShotMapsSection } from "@/components/ShotMapsSection";
import { TacticalErrorBoundary } from "@/components/TacticalErrorBoundary";
import { TacticalSection } from "@/components/TacticalSection";
import { useGlossaryMarking } from "@/components/glossary-marking";
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

/**
 * Every named player in the match — starters and substitutes, both sides —
 * flattened to the `{ playerId, name }` pairs `PassNetworksSection`'s matrix
 * table resolves edge endpoints against (Story 2.19 R1).
 *
 * `metadata.lineups` and not `bundle.players`: `lineups` is REQUIRED on the
 * bundle where `players` is `PlayerRecords | null`, and both were measured to
 * resolve 47,194 of 47,194 edge endpoints across all 104 real matches. With two
 * total sources, the one that cannot be absent wins.
 *
 * Pure and module-level so it stays trivially testable and so the memo in the
 * component below has something stable to call.
 */
/**
 * The one indirection that makes a section's PROP CONSTRUCTION lazy and
 * contained (ledger L1504, Story 2.19 D15).
 *
 * It looks like a no-op and is not. `build(id)` runs during THIS component's
 * render, which happens (a) only when `TacticalSection` has actually mounted
 * its children — i.e. only for open sections — and (b) underneath the
 * per-section `TacticalErrorBoundary`, so a throw while building props is
 * caught where the section's own render errors already were.
 *
 * A `ReactNode` child could not do either: JSX evaluates its children in the
 * PARENT's render, above the boundary, for every section on every re-render.
 */
function SectionContent({
  id,
  build,
}: {
  id: SectionId;
  build: (id: SectionId) => ReactNode;
}) {
  return <>{build(id)}</>;
}

function matchRoster(bundle: MatchBundle): { playerId: string; name: string }[] {
  return (["home", "away"] as const).flatMap((side) => {
    const lineup = bundle.metadata.lineups[side];
    return [...lineup.starters, ...lineup.substitutes].map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
    }));
  });
}

export function TacticalLayer({ bundle }: { bundle: MatchBundle }) {
  const t = useT();
  // AC 3's section-named absence copy, shared with the panel-level absence
  // ShotMapsSection renders (Story 2.7 Task 8.2a).
  const emptyHeadline = useEmptyHeadline();
  // Story 2.18 ruled decision 6: term marking is a policy the LAYER owns, so
  // the eleven consumers of the shell can see it. TacticalSection stays unaware.
  const { markHeading, markSummary } = useGlossaryMarking();
  const isLg = useMediaQuery(LG_MEDIA_QUERY);
  // Explicit user/anchor decisions only; everything unset follows the
  // breakpoint, so a resize past lg still expands the untouched sections.
  const [overrides, setOverrides] = useState<Partial<Record<SectionId, boolean>>>({});
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  /*
   * MEMOISED ON THE BUNDLE, not rebuilt in `sectionContent` (Story 2.19 R1).
   * `sectionContent` runs once per section on every render, and a fresh array
   * literal there would give `PassNetworksSection`'s roster index a new identity
   * each time — rebuilding a 30-odd entry Map on every keystroke of any state
   * this layer owns, for the one section that reads it.
   */
  const roster = useMemo(() => matchRoster(bundle), [bundle]);

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
            /*
             * Story 2.19 R1. With `passNetworkNodes: null` — the shape on
             * 104/104 real matches — the edges carry player IDS and no names, so
             * the matrix table needs a roster to resolve them.
             * `metadata.lineups` is REQUIRED on the bundle where `players` is
             * nullable, and both were measured to resolve all 47,194 endpoints
             * corpus-wide, so the required one is used.
             */
            roster={roster}
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
      /*
       * Story 2.10's four sections — the LAST four PendingSectionPanel
       * fall-throughs, so all eleven sections now render real content.
       *
       * Narrow, explicit props, never the whole bundle (Story 2.5 Task 5.1's
       * precedent). #phases and #pressing read the SAME `tacticalIdentity`
       * block: ruled decision 4 gives #phases all 17 phase rates and #pressing
       * the four press rates plus the blocks (the metres went with
       * `PossessionSplitMetres` in change-set CS-2), so seven of the nine
       * out-of-possession values appear in both — deliberately, because
       * #pressing's shipped, frozen summary promises pressing intensity and is
       * also the <lg collapsed-shell copy.
       */
      case "phases":
        return (
          <PhasesSection
            tacticalIdentity={bundle.tacticalIdentity}
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
      case "pressing":
        return (
          <PressingSection
            tacticalIdentity={bundle.tacticalIdentity}
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
      case "set-plays":
        return (
          <SetPlaysSection
            setPlays={bundle.setPlays}
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
      case "goalkeeping":
        return (
          <GoalkeepingSection
            goalkeeping={bundle.goalkeeping}
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
        /*
         * Story 2.18 decision 6's four bindings, in this exact shape. The
         * RESOLVED STRING must survive: useEmptyHeadline() is
         * `(title: string) => string`, and that signature is the only thing
         * standing between a mistake here and
         * "Sin datos de [object Object] para este partido." — do not pass it a
         * node and do not widen it.
         */
        const titleText = t(sectionTitleKey(plan.id));
        const summaryText =
          plan.showSummary && isCollapsibleId(plan.id) ? t(sectionSummaryKey(plan.id)) : null;
        const titleNode = markHeading(plan.id, titleText);
        const summaryNode = markSummary(plan.id, summaryText);
        /*
         * Hoisted into an identifier: the ternary form inside the `headline=`
         * prop trips the i18n gate, which requires a plain identifier there.
         */
        const overrideKey = EMPTY_HEADLINE_OVERRIDE[plan.id];
        const emptyCopy = overrideKey === undefined ? emptyHeadline(titleText) : t(overrideKey);
        // Same hoist, same reason: a ternary inside `explanation=` trips the
        // i18n gate, which requires a plain identifier there.
        const explanationKey = EMPTY_EXPLANATION_OVERRIDE[plan.id] ?? "tactical.empty.explanation";
        const emptyExplanation = t(explanationKey);
        return (
          <TacticalSection
            key={plan.id}
            id={plan.id}
            title={titleNode}
            summary={summaryNode}
            collapsible={plan.collapsible}
            open={plan.open}
            onToggle={() => toggle(plan.id, !plan.open)}
            focusNonce={focus?.id === plan.id ? focus.nonce : 0}
            focusScroll={focus?.id === plan.id ? focus.scroll : false}
            className={plan.spacedFromPrevious ? "mt-section-gap" : undefined}
          >
            {/*
             * PER-SECTION CONTAINMENT (Story 2.18 ruled decision 7), resolving a
             * blast radius filed FIVE times (2.8, 2.6, 2.9, 1.14, 2.10) and
             * routed every time to "whichever story next touches
             * TacticalSection". The whole-layer instance in MatchBundleRegion
             * stays as the outer floor; that call site is untouched.
             *
             * FIRST LIMIT, NOW CLOSED (Story 2.19 Task 5.8, ledger L1504,
             * ruled back INTO scope by D15). `sectionContent(plan.id)` used to
             * be called RIGHT HERE, in the layer's own render, so a throw
             * during prop construction — or the `default:` exhaustiveness
             * throw — happened ABOVE this boundary and only the outer instance
             * caught it. It is now called inside `<SectionContent>` below,
             * which renders UNDER the boundary, so prop construction is
             * contained by the same boundary as the section's own render.
             *
             * The same move is the performance half of L1504, and it is what
             * D15 actually names. `TacticalSection` lazy-mounts its children
             * (UX-DR6), but the CHILDREN ELEMENT still had to be built by this
             * render — so every one of the eleven sections constructed its
             * full prop set on every re-render of this layer, collapsed or
             * not, including the pass matrix's roster lookups and every
             * `.toUpperCase()` in the switch. Handing the boundary a COMPONENT
             * plus its id defers all of it to the sections that are actually
             * open.
             *
             * SECOND LIMIT, STILL OPEN AND STILL RECORDED: there is no
             * automatic reset — `state = { failed: false }` with no reset path
             * — and `plan.id` is constant, so `key={plan.id}` could never force
             * a remount. Keyed on `${id}-${open}` instead, so collapsing and
             * re-expanding a crashed section yields a fresh instance.
             * `key-stats` and `momentum` NEVER collapse, so a crash in either
             * is still permanent for the page's life.
             */}
            <TacticalErrorBoundary
              key={`${plan.id}-${plan.open}`}
              headlineKey="tactical.empty.sectionCrashed"
              explanationKey="tactical.empty.sectionCrashedExplanation"
            >
              {plan.isEmpty ? (
                <EmptyStatePanel headline={emptyCopy} explanation={emptyExplanation} />
              ) : (
                <SectionContent id={plan.id} build={sectionContent} />
              )}
            </TacticalErrorBoundary>
          </TacticalSection>
        );
      })}
    </div>
  );
}

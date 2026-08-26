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
import { anchorNonce, useAnchorHit, type AnchorHit } from "@/lib/use-anchor-nonce";
import {
  reportUnresolvedFragment,
  resolveMatchFragment,
  type MatchFragmentTarget,
  type PanelAnchorId,
} from "@/lib/match-anchors";
import {
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

/*
 * `sectionIdFromHash` LIVED HERE AND IS GONE (Story 3.8, D1).
 *
 * It was whole-string equality against the eleven SectionIds, which made
 * `#shot-maps-log` — and every other finer fragment — resolve to null SILENTLY.
 * `resolveMatchFragment` (`@/lib/match-anchors`) replaces it rather than
 * extending it, because keeping both would leave the route with two grammars.
 * Being a pure module, the replacement is also unit-testable without this
 * component graph, which the local function never was.
 */

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

  /*
   * ONE HOOK INSTANCE FOR THE WHOLE ROUTE (Story 3.8, D4), read here and passed
   * down as explicit numbers. Not one hook per section: that would mint five
   * `hashchange` + five capture-phase `click` listener pairs on a route that
   * needs exactly one pair, and it would scatter the grammar across five files
   * instead of keeping it in the one that owns the switch.
   *
   * It also subsumes the old `hashchange`-only subscription that used to live in
   * the effect below. The hook already owns that listener AND the same-fragment
   * click case the old subscription could not see (D6): a reader who collapsed
   * `#defensive-actions` and re-clicked its Expert link got no event, no
   * override and a section that stayed shut. Keeping both would also mean two
   * focus-nonce bumps per navigation, so the old one is deleted, not layered.
   */
  const hit = useAnchorHit();
  const [seenHit, setSeenHit] = useState<AnchorHit | null>(null);

  /*
   * THE HIT THE DEEP LINK'S CLAIM IS STILL LIVE FOR (code review R2).
   *
   * `hit` itself is never cleared — an empty hash early-returns in the hook, so
   * the last fragment a reader visited stays readable for the life of the page.
   * That is correct for the hook and WRONG as a nonce source, because a
   * `ViewDataDisclosure` re-inits `seenNonce` to 0 on every mount, and this layer
   * remounts section subtrees twice over: `TacticalSection` renders
   * `{open ? <div>{children}</div> : null}`, and the error boundary here is keyed
   * `${plan.id}-${plan.open}`. So a reader who deep-linked a panel, CLOSED the
   * table, collapsed the section and re-expanded it met a stale positive nonce
   * and had their close silently discarded — every cycle, for the life of the
   * page.
   *
   * So the claim is CONSUMED: it is live from the navigation that minted it until
   * the reader takes manual control of a section (`toggle` below), and a nonce
   * derived from it is 0 thereafter. Fixed HERE and not in `ViewDataDisclosure`,
   * deliberately — that contract is shared with the Tournament Hub's 21 sections
   * and 2.19's shipped behaviour is not this story's to change.
   */
  const [activeHit, setActiveHit] = useState<AnchorHit | null>(null);

  /*
   * The resolved target, kept in state rather than re-derived in render, so the
   * empty-state anchor (R3) and the panel landing effect (R1) read one value that
   * was computed exactly once per hit.
   */
  const [target, setTarget] = useState<MatchFragmentTarget | null>(null);

  /** Bumped per addressed panel, so the landing effect re-fires on a re-click. */
  const [landing, setLanding] = useState<{ panel: PanelAnchorId; nonce: number } | null>(null);

  /*
   * ADJUSTED DURING RENDER, NOT IN AN EFFECT — and that is forced, not stylistic.
   *
   * The obvious shape is `useEffect(… , [hit])`, and it is what this code was
   * first written as. `react-hooks/set-state-in-effect` rejects it under
   * `--max-warnings 0`, exactly as `ViewDataDisclosure`'s own docblock warns; the
   * OLD code here escaped the rule only because its setState calls sat inside a
   * `hashchange` CALLBACK rather than in an effect body. So this follows the
   * project's established idiom for the same problem — React's documented
   * "adjusting state when a prop changes" — which `ViewDataDisclosure:99-105`
   * already uses to consume this very nonce.
   *
   * COMPARED BY IDENTITY, and the hook minting a FRESH OBJECT on every read is
   * what makes that work: a same-fragment re-click produces a new `hit` with the
   * same `id`, so this fires again where an `id` comparison would not. That is
   * the whole of ledger path (a) — a reader who collapses a section and re-clicks
   * its Expert link — and it is why the old `hashchange`-only subscription is
   * DELETED rather than kept alongside. Keeping both would also double every
   * focus-nonce bump.
   *
   * The mount-time read inside the hook stays load-bearing for the reason this
   * file's header gives: the subtree does not exist in the exported HTML, so the
   * browser has already abandoned the fragment by the time the target mounts.
   */
  if (hit !== seenHit) {
    setSeenHit(hit);
    setActiveHit(hit);
    /*
     * PURE IN RENDER (code review P5). `resolveMatchFragment` no longer reports;
     * the dev-visible report for an addressed-but-unresolvable fragment is issued
     * from the effect below, where a side effect belongs. This render can be
     * discarded by React without emitting anything or latching a dedupe key.
     */
    const resolved = hit === null ? null : resolveMatchFragment(`#${hit.id}`);
    setTarget(resolved);
    if (resolved !== null) {
      const id = resolved.section;
      setOverrides((previous) => ({ ...previous, [id]: true }));
      if (resolved.panel === null) {
        /*
         * A SECTION fragment keeps its shipped UX-DR18 behaviour EXACTLY (D1,
         * re-affirmed at code review R1): expand, scroll to the section, focus
         * its heading, open no table.
         */
        setFocus((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1, scroll: true }));
      } else {
        /*
         * A PANEL fragment lands on the PANEL (R1). The section's own scroll and
         * heading focus are deliberately NOT requested: `TacticalSection` scrolls
         * to `<section id={plan.id}>` and focuses its heading with
         * `preventScroll`, which before this fix left the reader parked at the
         * section top with the addressed table opening below the fold — and, when
         * the section was already expanded, left DOM focus on the heading while
         * the browser's own fragment scroll had moved the viewport to the panel.
         */
        const panel = resolved.panel;
        setLanding((previous) => ({ panel, nonce: (previous?.nonce ?? 0) + 1 }));
      }
    }
  }

  /*
   * THE REPORT, AND THE LANDING — both side effects, both after commit.
   *
   * The report is the D2 gate moved out of render. The landing is R1: the
   * addressed panel's element cannot be looked up until it has mounted, and below
   * `lg` it does not exist at all until the expansion above commits.
   */
  useEffect(() => {
    if (hit !== null) {
      reportUnresolvedFragment(`#${hit.id}`);
    }
  }, [hit]);

  useEffect(() => {
    if (landing === null) {
      return;
    }
    const element = document.getElementById(landing.panel);
    if (element === null) {
      return;
    }
    element.scrollIntoView();
    /*
     * `preventScroll` because `scrollIntoView` has already positioned it — the
     * same reasoning `TacticalSection` records for the section case. The target
     * carries `tabIndex={-1}` so it can hold focus without joining the tab order.
     */
    element.focus({ preventScroll: true });
  }, [landing]);

  function toggle(id: SectionId, willOpen: boolean) {
    /*
     * The reader took manual control, so the deep link's claim is SPENT (R2).
     * Cleared for every section, not just this one: the fragment addressed one
     * panel, and once the reader is driving the page it should not re-assert
     * itself behind them on a later remount.
     */
    setActiveHit(null);
    setOverrides((previous) => ({ ...previous, [id]: willOpen }));
    if (willOpen) {
      // Focus moves into what was revealed only on a user toggle; closing
      // leaves focus on the trigger where the user put it.
      setFocus((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1, scroll: false }));
    }
  }

  /*
   * TYPED, SO A TYPO IS A COMPILE ERROR (code review P6).
   *
   * `anchorNonce` takes a bare `string` and must keep doing so — D3 shares it with
   * the Tournament Hub, whose section ids are not `PanelAnchorId`s. That left all
   * six call sites below unguarded: `anchorNonce(hit, "pass-netwoks-matrix")`
   * would compile, return 0 forever, and open nothing. This wrapper puts the
   * story's own argument for typing `href` against `MatchFragmentId` (D8) where
   * the nonces are read. Still numbers at the prop boundary, as D4 requires — the
   * helper is internal and greppable, not a callback prop.
   */
  function panelNonce(anchorId: PanelAnchorId): number {
    return anchorNonce(activeHit, anchorId);
  }

  /*
   * WHICH PANEL ANCHOR AN EMPTY SECTION MUST STILL CARRY (code review R3).
   *
   * When `plan.isEmpty` the section component never mounts — the layer renders a
   * section-level `EmptyStatePanel` instead — so the panel id vanished from the
   * DOM entirely and the fragment landed NOWHERE. On the shipped corpus that is
   * `#defensive-actions-table` on 104/104 matches. D10.2 rules the opposite: "a
   * link that lands on a named absence is honest; a link that lands nowhere is
   * not", which is why `ShotMapsSection` already wraps its absent arms in a
   * `<div id=…>`.
   *
   * The id given is the one the READER IS CURRENTLY ADDRESSING, which is what
   * makes a single element serve a section with two panel anchors (`shot-maps`):
   * whichever of the two was followed is the one that must have a target.
   */
  function emptyStateAnchorId(sectionId: SectionId): string | undefined {
    if (target === null || target.panel === null || target.section !== sectionId) {
      return undefined;
    }
    return target.panel;
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
            shotsNonce={panelNonce("shot-maps-shots")}
            crossesNonce={panelNonce("shot-maps-crosses")}
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
            matrixNonce={panelNonce("pass-networks-matrix")}
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
            tableNonce={panelNonce("offers-to-receive-table")}
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
            tableNonce={panelNonce("movement-to-receive-table")}
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
            tableNonce={panelNonce("defensive-actions-table")}
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
                <div id={emptyStateAnchorId(plan.id)} tabIndex={-1}>
                  <EmptyStatePanel headline={emptyCopy} explanation={emptyExplanation} />
                </div>
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

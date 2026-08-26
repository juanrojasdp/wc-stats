"use client";

import { useEffect, useState } from "react";

/*
 * THE DEEP-LINK SIGNAL, SHARED BY THE HUB AND THE MATCH ROUTE (Story 3.8, D3).
 *
 * EXTRACTED FROM `TournamentHub.tsx:182-215`, WHERE IT WAS BUILT AND PROVED.
 * Story 2.19 wrote it for the Hub's 21 section tables; Story 3.8 needs the same
 * mechanism for the match route's six panel disclosures. Copied, it would be two
 * implementations of the one subtle thing in this codebase that has already been
 * got wrong once — so it moved instead, and the Hub's diff is an import line.
 *
 * ── the docblock that came with it, because it is the design rationale ──
 *
 * A nonce that increments for the anchor the URL fragment currently names, and
 * is `0` for every other anchor. Feeds `ViewDataDisclosure.openNonce`.
 *
 * UX-DR18's deep links point straight at these sections and the Hub's
 * `useHashScroll` exists because the anchors do not exist in the exported HTML.
 * Putting the tables behind a disclosure without this would mean a shared
 * `…/#results-r32` scrolled to a heading over a closed control — the very defect
 * ledger L1553/L1886 files against the match route. Subscribed to `hashchange`
 * as well as read once at mount, so in-page anchor navigation opens its target
 * too.
 *
 * ═══ AND TO `click`, WHICH IS WHAT MAKES THE NONCE EARN ITS NAME ═══
 *
 * `hashchange` fires only when the fragment CHANGES. `ViewDataDisclosure`'s
 * `openNonce` docblock justifies being a counter rather than a boolean on the
 * grounds that a boolean "could not" re-open on a second navigation to the same
 * anchor — but with `hashchange` as the only source, neither could the counter
 * (2.19 code review): a reader who follows `…/#standings-group-a`, closes the
 * group, then clicks the same in-page link again got no event, no increment and
 * a section that stayed shut.
 *
 * Same-fragment clicks are therefore caught directly. Capture phase, so it still
 * runs if something downstream stops propagation, and it only ever re-reads a
 * hash the browser is already on — it never navigates.
 *
 * ── what Story 3.8 added, and why ──
 *
 * `useAnchorHit` exposes the RAW hit. The Hub only ever asks "what is this one
 * section's nonce?", but the match route needs the hit itself: the same read has
 * to drive section EXPANSION as well as panel opening, through a grammar
 * (`resolveMatchFragment`) that maps one fragment onto both. `useAnchorNonce` is
 * kept as the thin wrapper the Hub already calls.
 *
 * A FRESH OBJECT ON EVERY READ IS LOAD-BEARING, not sloppiness. It is what makes
 * a same-fragment re-click a new `hit` identity, and therefore what lets a
 * `useEffect([hit])` downstream re-fire on a navigation whose fragment did not
 * change. Do not memoise it on `id`.
 */

/** Strips the leading `#` off `window.location.hash`. */
export const HASH_PREFIX = "#";

/**
 * The ONE stripping rule, shared with `@/lib/match-anchors` (code review).
 *
 * This was `hash.replace(HASH_PREFIX, "")`, which removes the FIRST `#` anywhere
 * in the string rather than a leading one, while the match route's grammar used
 * `startsWith`/`slice`. Two modules parsing the same fragment with two different
 * rules, in a story whose stated goal was that the route not be left with two
 * grammars. Defined here because this is the generic module of the pair: the
 * match-route grammar imports it, never the other way round.
 */
export function stripHashPrefix(hash: string): string {
  return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash;
}

/** The fragment the reader is currently on, plus a counter that rises per read. */
export interface AnchorHit {
  id: string;
  nonce: number;
}

export function useAnchorHit(): AnchorHit | null {
  const [hit, setHit] = useState<AnchorHit | null>(null);
  useEffect(() => {
    function readHash() {
      const id = stripHashPrefix(window.location.hash);
      if (id === "") {
        return;
      }
      setHit((previous) => ({ id, nonce: (previous?.nonce ?? 0) + 1 }));
    }
    function onClick(event: MouseEvent) {
      /*
       * A CLICK THAT IS NOT NAVIGATING THIS TAB MUST NOT BUMP THIS TAB'S NONCE
       * (code review). Without these three guards a Ctrl/Cmd-click on an Expert
       * log link opened a new tab AND re-opened, in the tab the reader was still
       * looking at, a disclosure they had deliberately closed. `button !== 0`
       * covers middle-click (the other open-in-new-tab gesture) and any
       * non-primary press; `defaultPrevented` respects a handler that has already
       * cancelled the navigation this listener exists to observe.
       */
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      // Same document, same fragment: the one case that fires no `hashchange`.
      if (anchor.hash === "" || anchor.hash !== window.location.hash) {
        return;
      }
      if (anchor.pathname !== window.location.pathname) {
        return;
      }
      /*
       * Same ORIGIN too: `pathname` and `hash` can coincide on a cross-origin
       * href, and a click leaving the site is not an in-page navigation.
       */
      if (anchor.origin !== window.location.origin) {
        return;
      }
      readHash();
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", readHash);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return hit;
}

/** This anchor's nonce for the current hit, or `0` — which `openNonce` reads as "never". */
export function anchorNonce(hit: AnchorHit | null, anchorId: string): number {
  return hit !== null && hit.id === anchorId ? hit.nonce : 0;
}

/** The Hub's shape: one hook call, then a lookup per section. */
export function useAnchorNonce(): (anchorId: string) => number {
  const hit = useAnchorHit();
  return (anchorId) => anchorNonce(hit, anchorId);
}

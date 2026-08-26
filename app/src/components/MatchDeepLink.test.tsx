// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TacticalLayer } from "@/components/TacticalLayer";
import { PANEL_ANCHORS } from "@/lib/match-anchors";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { LocaleProvider } from "@/lib/i18n-provider";
import fixture from "../../../data/fixtures/matches/m001-mexico-south-africa.json";

/*
 * ═══ THE MATCH ROUTE'S DEEP LINKS — Story 3.8 (AC 1, AC 3, AC 4, AC 5/A2) ═══
 *
 * WHAT THESE PIN, AND WHY IT IS THE TRANSITION AND NOT THE MARKUP (A2).
 *
 * A test that asserts `#shot-maps-crosses` exists as an anchor would have passed
 * for the entire life of the defect: the six Expert log links were real anchors
 * pointing at real sections the whole time. What did not happen was the TABLE
 * OPENING. So every case below asserts a closed → open TRANSITION — a `<table>`
 * appearing inside the addressed region — and, in the same breath, that the
 * SIBLING panel's table did NOT appear. One fragment, one panel.
 *
 * ═══ THE FIXTURE IS THE RIGHT HARNESS, AND THAT IS A RULING (D10) ═══
 *
 * Measured 2026-08-26 against the 104 real bundles the built site serves versus
 * this fixture: `events.crosses` and `events.defensiveActions` are null on
 * 104/104 REAL matches, and `passNetworkNodes` is null on 104/104 too. The
 * fixture populates all three. That is not a fixture defect — it is what lets
 * these tests reach panels the corpus renders as named absences, and it is why
 * the browser pass in Task 10 uses the shot log while these tests use the cross
 * log and the defensive-actions log.
 *
 * IT ALSO MEANS THE FIXTURE AND THE CORPUS TAKE DIFFERENT BRANCHES of
 * `PassNetworksSection`: these tests exercise its `PitchPanel` branch, while a
 * real reader always meets its matrix-only branch. Both carry the same
 * `pass-networks-matrix` nonce; wiring only one would look green here and ship
 * broken, which is the single most likely way to get this story wrong.
 *
 * Pinned by RELATIVE FIXTURE PATH, never by an id the corpus could also carry.
 */
const bundle = fixture as unknown as MatchBundle;

/*
 * THE SHAPE EVERY REAL READER MEETS, and the reason this constant exists.
 *
 * `passNetworkNodes` is null on 104/104 shipped bundles, so `PassNetworksSection`
 * always takes its MATRIX-ONLY branch in production — while the fixture populates
 * nodes and therefore always takes the `PitchPanel` branch. Story 3.8 wired the
 * `pass-networks-matrix` anchor into BOTH and called half-wiring "the single most
 * likely way to get this story wrong", then shipped tests that rendered only the
 * branch no reader ever reaches. This nulls the field so the shipped branch is
 * exercised too.
 */
const matrixOnlyBundle = {
  ...bundle,
  events: { ...bundle.events, passNetworkNodes: null },
} as unknown as MatchBundle;

/*
 * These cases render the WHOLE Tactical Layer — eleven sections, recharts leaves
 * behind `next/dynamic`, and up to two full renders in a single case — which is
 * the point: the mechanism under test spans the layer, five section components,
 * `PitchPanel` and `ViewDataDisclosure`, and a narrower harness would not
 * exercise the wiring that actually broke.
 *
 * THE INTERMITTENT FAILURES HAD A KNOWN CAUSE, AND IT WAS NOT THE BUDGET (code
 * review). This file first raised the budget to 30 s against renders costing about
 * a second each. The real source is `userEvent.setup({ delay: null })` without `{ delay: null }`:
 * user-event advances timers between keystrokes and hangs under full-suite load,
 * which `HeaderSearch.test.tsx` already had the fix for. Every `setup()` below now
 * passes `{ delay: null }`, and the budget is a modest multiple of the real cost
 * rather than a 6x blanket that would also hide a genuine future slowdown.
 */
vi.setConfig({ testTimeout: 15_000, hookTimeout: 15_000 });

/*
 * jsdom implements no layout, so it implements no `scrollIntoView`.
 * `TacticalSection`'s focus-scroll calls it on every anchor-driven open — which
 * is correct in a browser and throws here — so it is stubbed rather than routed
 * around.
 *
 * A RECORDING STUB, NOT A NO-OP, AND RESTORED AFTERWARDS (code review). The
 * original discarded its subject: a silent no-op installed on the shared prototype
 * with no `afterAll` made this suite STRUCTURALLY INCAPABLE of observing what got
 * scrolled to — which is exactly how "the deep link opens the panel but never
 * scrolls to it" shipped green. Recording the element costs nothing and lets the
 * landing be asserted.
 */
const scrolledTo: Element[] = [];
const originalScrollIntoView = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
  scrolledTo.push(this);
};

afterAll(() => {
  // jsdom ships no implementation, so the "original" is undefined; assigning it
  // back still leaves the prototype exactly as this file found it.
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

/** The element the layer last asked the browser to bring into view. */
function lastScrollTarget(): Element | undefined {
  return scrolledTo.at(-1);
}

/*
 * jsdom has no ResizeObserver. `use-element-width.ts:53` guards on
 * `typeof … === "undefined"` and degrades to width 0, but a section that threw
 * here would be caught by its own `TacticalErrorBoundary` and render an empty
 * state — silently costing a case its subject rather than going red. A no-op
 * class is cheaper than reasoning about which sections survive without one.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

/*
 * `matchMedia` is jsdom-supplied and reports no match, so `useMediaQuery(lg)` is
 * FALSE — and that is the case these tests want. Below `lg` the nine collapsible
 * sections start COLLAPSED, so "the deep link opened it" is a real transition
 * rather than a no-op against something that was already open.
 */

/*
 * ARRIVE ON A FRAGMENT THE WAY A READER ARRIVES ON ONE (code review).
 *
 * `window.location.hash = "#x"` QUEUES A `hashchange`, and jsdom delivers it as a
 * task — which can land AFTER the layer has mounted and read the fragment, minting
 * a SECOND hit and a second nonce for what was one navigation. That made cases
 * order-dependent: they passed in file order and failed in isolation, because
 * whether the stray event arrived before or after mount depended on what the
 * previous case had left in the URL.
 *
 * A cold deep link fires no `hashchange` at all — the browser is already on the
 * fragment when the document loads, which is the whole reason `useAnchorHit` reads
 * once at mount. `replaceState` reproduces exactly that, and the cases that DO want
 * an in-page navigation dispatch it explicitly.
 */
function arriveAt(hash: string): void {
  window.history.replaceState(null, "", `${window.location.pathname}${hash}`);
}

function renderLayer(which: MatchBundle = bundle) {
  return render(
    <LocaleProvider>
      <TacticalLayer bundle={which} />
    </LocaleProvider>
  );
}

/** The section-level collapse control, which is NOT the panel's disclosure control. */
function sectionTrigger(sectionId: string): HTMLElement {
  const trigger = document.querySelector(`#${sectionId}-heading button`);
  expect(trigger, `#${sectionId} must have a collapse control`).not.toBeNull();
  return trigger as HTMLElement;
}

/*
 * A collapsed section MOUNTS NO CHILDREN, so below `lg` a panel's DOM target
 * does not exist until something expands its section. That is the AR-11 shape
 * this whole story is built on — the fragment's target is absent from the
 * exported HTML too — so "the target exists" is itself an assertion about
 * expansion, and the helpers keep the two questions apart.
 */
function target(anchorId: string): HTMLElement | null {
  return document.getElementById(anchorId);
}

/** The panel region a fragment addresses. Asserts it is mounted at all. */
function region(anchorId: string): HTMLElement {
  const element = target(anchorId);
  expect(element, `#${anchorId} must exist for the fragment to land on it`).not.toBeNull();
  return element as HTMLElement;
}

function tablesIn(anchorId: string): HTMLElement[] {
  return within(region(anchorId)).queryAllByRole("table");
}

/*
 * The panel's disclosure control, found by `aria-expanded` and NEVER by its
 * label.
 *
 * MEASURED, AND IT COST A DEBUGGING PASS: `LocaleProvider` resolves
 * localStorage, then `navigator.language`, then its `initialLocale` — and jsdom
 * reports `en-US`, so this harness renders "Hide data", not "Ocultar los datos".
 * Worse, the resolution lands in an effect, so a copy-matching selector is
 * TIMING-dependent and passes or fails run to run. `aria-expanded` is the same
 * attribute in both locales and is also the semantically correct handle: it is
 * the state the reader is being told about.
 *
 * Exactly one per panel region — asserted, so a second collapsible arriving
 * inside a panel later makes this ambiguous LOUDLY rather than silently picking
 * the wrong control.
 */
function disclosureTrigger(anchorId: string): HTMLElement {
  const triggers = region(anchorId).querySelectorAll("button[aria-expanded]");
  expect(triggers, `#${anchorId} must hold exactly one disclosure control`).toHaveLength(1);
  return triggers[0] as HTMLElement;
}

beforeEach(() => {
  /*
   * PINNED, NOT INHERITED (code review; standing ledger rule owned by this story).
   * `LocaleProvider` resolves localStorage, then `navigator.language`, then its
   * `initialLocale`. This file documented in prose that jsdom reports `en-US` and
   * then let an ambient default decide — so story 3.5's first-visit detection
   * could change what this suite renders without touching it. The assumption is
   * now stated in code and fails loudly if the harness changes underneath it.
   */
  Object.defineProperty(window.navigator, "language", {
    value: "en-US",
    configurable: true,
  });
  window.localStorage.clear();
  scrolledTo.length = 0;
  arriveAt("");
});

afterEach(() => {
  cleanup();
  arriveAt("");
});

describe("the deep link opens the panel it names (AC 1, AC 5)", () => {
  it("mounts NO addressed panel and NO section table with no fragment at all", async () => {
    /*
     * The floor every other case is measured against. Without it, "a table
     * appeared" proves nothing — it might have been open all along.
     *
     * Below `lg` the nine collapsible sections are collapsed and mount no
     * children, so the panel targets are absent outright rather than present and
     * closed. Both halves are asserted: no target, and no table anywhere.
     */
    await act(async () => {
      renderLayer();
    });
    expect(target("shot-maps-shots"), "collapsed sections mount nothing").toBeNull();
    expect(target("shot-maps-crosses"), "collapsed sections mount nothing").toBeNull();
    expect(target("defensive-actions-table"), "collapsed sections mount nothing").toBeNull();
    expect(screen.queryAllByRole("table"), "no table on arrival").toHaveLength(0);
  });

  it("opens ONLY the panel the fragment names — #shot-maps-crosses", async () => {
    arriveAt("#shot-maps-crosses");
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("shot-maps-crosses").length, "the addressed panel opened").toBeGreaterThan(0);
    expect(tablesIn("shot-maps-shots"), "its sibling stayed shut").toHaveLength(0);
  });
});

describe("AC 4 — #shot-maps no longer holds two links (ledger L1886)", () => {
  it("addresses the shot log and the cross log INDEPENDENTLY", async () => {
    /*
     * THE ASSERTION THE LEDGER ENTRY EXISTS FOR, and it must be its own case.
     * Both Expert links read `href: "#shot-maps"` before this story: one
     * fragment, two independent disclosures, and no way to address either. The
     * inverse half is what makes this an assertion about DISAMBIGUATION rather
     * than about one anchor happening to work.
     */
    arriveAt("#shot-maps-shots");
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("shot-maps-shots").length, "shots opened").toBeGreaterThan(0);
    expect(tablesIn("shot-maps-crosses"), "crosses stayed shut").toHaveLength(0);

    cleanup();

    arriveAt("#shot-maps-crosses");
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("shot-maps-crosses").length, "crosses opened").toBeGreaterThan(0);
    expect(tablesIn("shot-maps-shots"), "shots stayed shut").toHaveLength(0);
  });
});

describe("AC 1 — the SAME-FRAGMENT second click re-opens", () => {
  it("re-opens #defensive-actions-table after the reader closes it", async () => {
    /*
     * THE DEFECT THAT MADE THE SIX LINKS A SILENT NO-OP ON THE SECOND CLICK, and
     * the case the whole capture-phase listener exists for.
     *
     * IN A REAL BROWSER no `hashchange` fires here — it is already on
     * `#defensive-actions-table` and the anchor names the same fragment — so a
     * `hashchange`-only source gives no event, no nonce increment, and a region
     * that stays shut. JSDOM DEVIATES AND FIRES ONE ANYWAY (measured, not
     * assumed), which means THIS case alone cannot say which source re-opened
     * the panel. It pins the reader-visible behaviour end to end; the case below
     * cancels the navigation to isolate the capture-phase listener, and Task 10
     * proves it where jsdom cannot: a real browser.
     *
     * `#defensive-actions-table` and not the cross log: on the shipped corpus
     * `events.defensiveActions` is null, so a real reader meets the section's
     * empty state and there is no control to re-open (D10). The fixture carries
     * 63 defensive actions, which is what makes this panel reachable at all.
     */
    const user = userEvent.setup({ delay: null });
    arriveAt("#defensive-actions-table");
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("defensive-actions-table").length, "the deep link opened it").toBeGreaterThan(0);

    // Closed the way a reader closes it — the disclosure's own control.
    const hide = disclosureTrigger("defensive-actions-table");
    expect(hide, "the deep link left it expanded").toHaveAttribute("aria-expanded", "true");
    await user.click(hide);
    expect(tablesIn("defensive-actions-table"), "the reader closed it").toHaveLength(0);

    /*
     * A REAL in-page anchor, in the same document, with the SAME pathname — the
     * hook's guards reject a cross-route link and a differing fragment outright,
     * so a synthetic event on a detached node would prove nothing.
     */
    const link = document.createElement("a");
    link.href = `${window.location.pathname}#defensive-actions-table`;
    link.textContent = "re-click";
    document.body.appendChild(link);
    await act(async () => {
      link.click();
    });

    expect(
      tablesIn("defensive-actions-table").length,
      "the SAME fragment, clicked again, re-opens it"
    ).toBeGreaterThan(0);
    link.remove();
  });

  it("re-opens it from the CLICK ALONE, with navigation cancelled", async () => {
    /*
     * ═══ THE CASE THAT ISOLATES THE CAPTURE-PHASE LISTENER ═══
     *
     * MEASURED, NOT ASSUMED: jsdom FIRES `hashchange` for a same-fragment
     * anchor click, where a real browser fires none. That deviation is the whole
     * reason the case above cannot, on its own, prove which source re-opened the
     * panel — in jsdom the `hashchange` path would carry it even with the
     * capture-phase listener deleted, and the test would stay green while the
     * shipped behaviour was broken. (It is also why AC 1's real proof is the
     * browser pass in Task 10, and why Task 8.7 reverts the wiring to show these
     * tests can go red at all.)
     *
     * So the navigation is CANCELLED. A bubble-phase `preventDefault` on
     * `document` stops jsdom performing the navigation — therefore no
     * `hashchange`, asserted below — while the hook's CAPTURE-phase listener has
     * already run, because capture precedes bubble. Whatever re-opens the panel
     * here can only be that listener.
     *
     * This is also the guard the hook's own docblock claims: capture phase "so
     * it still runs if something downstream stops propagation".
     */
    arriveAt("#defensive-actions-table");
    await act(async () => {
      renderLayer();
    });
    const user = userEvent.setup({ delay: null });
    await user.click(disclosureTrigger("defensive-actions-table"));
    expect(tablesIn("defensive-actions-table"), "closed before the re-click").toHaveLength(0);

    let hashchanges = 0;
    const countHashchange = () => {
      hashchanges += 1;
    };
    const cancel = (event: Event) => event.preventDefault();
    window.addEventListener("hashchange", countHashchange);
    document.addEventListener("click", cancel);

    const link = document.createElement("a");
    link.href = `${window.location.pathname}#defensive-actions-table`;
    document.body.appendChild(link);
    await act(async () => {
      link.click();
    });

    document.removeEventListener("click", cancel);
    window.removeEventListener("hashchange", countHashchange);
    link.remove();

    expect(hashchanges, "navigation was cancelled, so no hashchange could carry it").toBe(0);
    expect(
      tablesIn("defensive-actions-table").length,
      "the capture-phase click listener re-opened it on its own"
    ).toBeGreaterThan(0);
  });
});

describe("the section fragment keeps its shipped meaning (D1)", () => {
  it("expands #shot-maps and opens NO disclosure", async () => {
    /*
     * `#shot-maps` is the ruled UX-DR18 anchor 2.11c verified live at two widths,
     * and widening it would silently change the meaning of eleven links that
     * already ship. The section expands — its panels' DOM targets exist, which
     * below `lg` they would not if it were still collapsed — and no table opens.
     */
    arriveAt("#shot-maps");
    await act(async () => {
      renderLayer();
    });
    expect(document.getElementById("shot-maps-shots"), "the section expanded").not.toBeNull();
    expect(tablesIn("shot-maps-shots"), "a section fragment opens no table").toHaveLength(0);
    expect(tablesIn("shot-maps-crosses"), "a section fragment opens no table").toHaveLength(0);
  });

  it("leaves an unresolvable fragment harmless - no crash, no open table (AC 3)", async () => {
    /*
     * A fragment is READER INPUT. `#shot-maps-log` names a real section and a
     * panel that does not exist; it reports loudly in dev and must never take the
     * page down. `TacticalErrorBoundary` would swallow a throw into an empty
     * state, so the assertion is that the layer still renders NORMALLY.
     *
     * STRENGTHENED AT THE CODE REVIEW. This case was titled "no crash, no open
     * table" and asserted only that SOME heading existed — which any of the eleven
     * error-boundary empty states would have satisfied, and which checked neither
     * half of its own name. It also let a genuine `console.error` through on every
     * green run, teaching readers of this suite to ignore exactly the gate D2
     * exists to make loud.
     */
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    arriveAt("#shot-maps-log");
    await act(async () => {
      renderLayer();
    });

    expect(screen.getAllByRole("heading").length, "the layer still rendered").toBeGreaterThan(0);
    expect(screen.queryAllByRole("table"), "NO table opened").toHaveLength(0);
    expect(target("shot-maps-shots"), "and no section was expanded").toBeNull();
    expect(target("shot-maps-crosses"), "and no section was expanded").toBeNull();
    expect(consoleError, "the miss was reported once, in dev").toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toMatch(/shot-maps-log/);
  });
});

describe("the deep link LANDS on the panel, not merely opens it (code review R1)", () => {
  it("scrolls to and focuses the addressed PANEL — #shot-maps-crosses", async () => {
    /*
     * ═══ THE DEFECT THE ORIGINAL SUITE COULD NOT SEE ═══
     *
     * Story 3.8 gave `PitchPanel` an `id` and never scrolled to it. The only
     * scroll in the mechanism targets `<section id={plan.id}>`, so a shared
     * `…/#shot-maps-crosses` expanded the section, opened the crosses table, and
     * left the reader parked at the section heading with the opened table below
     * the fold — behind a full shot-map panel. The story's own user statement is
     * "a shared anchor lands on data".
     *
     * It was invisible because the harness stubbed `scrollIntoView` to a no-op AND
     * because Task 10.2's browser pass used "Registro de tiros" — the FIRST panel
     * in its section, the one case where section-top scroll and panel scroll are
     * indistinguishable. The cross log is the second panel, which is why it is the
     * subject here.
     */
    arriveAt("#shot-maps-crosses");
    await act(async () => {
      renderLayer();
    });

    expect(tablesIn("shot-maps-crosses").length, "the addressed panel opened").toBeGreaterThan(0);
    expect(lastScrollTarget(), "the viewport went to the PANEL").toBe(target("shot-maps-crosses"));
    expect(document.activeElement, "and so did focus").toBe(target("shot-maps-crosses"));
  });

  it("keeps the SECTION fragment landing on the section — #shot-maps (UX-DR18)", async () => {
    /*
     * The other half of R1, and the ruling it must not break. `#shot-maps` is the
     * shipped UX-DR18 anchor 2.11c verified live at two widths: expand, scroll to
     * the SECTION, focus its heading, open no table. Only the finer fragment moved.
     */
    arriveAt("#shot-maps");
    await act(async () => {
      renderLayer();
    });

    expect(lastScrollTarget(), "a section fragment still lands on the section").toBe(
      document.getElementById("shot-maps")
    );
    expect(document.activeElement, "focus is the section heading").toBe(
      document.getElementById("shot-maps-heading")
    );
    expect(tablesIn("shot-maps-shots"), "and opens no table").toHaveLength(0);
  });
});

describe("a reader's close STAYS closed (code review R2)", () => {
  it("does not re-open the table when the section is collapsed and re-expanded", async () => {
    /*
     * ═══ THE STALE-NONCE DEFECT ═══
     *
     * `hit` is never cleared, and a `ViewDataDisclosure` re-inits `seenNonce` to 0
     * on every mount — and this layer remounts section subtrees twice over
     * (`{open ? <div>{children}</div> : null}`, plus an error boundary keyed
     * `${plan.id}-${plan.open}`). So a reader who deep-linked a panel, CLOSED the
     * table, collapsed the section and re-expanded it met a stale positive nonce
     * and had their close discarded — every cycle, for the life of the page.
     *
     * The claim is consumed on a section toggle, so the re-expanded section shows
     * the disclosure in its own default state: closed.
     */
    const user = userEvent.setup({ delay: null });
    arriveAt("#defensive-actions-table");
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("defensive-actions-table").length, "the deep link opened it").toBeGreaterThan(0);

    await user.click(disclosureTrigger("defensive-actions-table"));
    expect(tablesIn("defensive-actions-table"), "the reader closed it").toHaveLength(0);

    // Collapse the SECTION (not the panel), then re-expand it.
    await user.click(sectionTrigger("defensive-actions"));
    expect(target("defensive-actions-table"), "the subtree unmounted").toBeNull();
    await user.click(sectionTrigger("defensive-actions"));

    expect(
      tablesIn("defensive-actions-table"),
      "the reader's close survives the remount"
    ).toHaveLength(0);
  });
});

describe("every registry anchor is reachable (code review)", () => {
  /*
   * THE GATE NOTHING PROVIDED. `PANEL_ANCHORS` could grow a seventh entry, gain an
   * href, compile, resolve, and pass both of Story 3.8's new pins while rendering
   * no DOM target at all — the dead-anchor class this story exists to close,
   * reintroduced one story later. Three of the six shipped anchors had no
   * end-to-end assertion of any kind.
   */
  it.each(PANEL_ANCHORS.map((anchor) => [anchor.id] as const))(
    "%s has a DOM target and opens its table",
    async (anchorId) => {
      window.location.hash = `#${anchorId}`;
      await act(async () => {
        renderLayer();
      });
      expect(target(anchorId), `#${anchorId} must exist in the DOM`).not.toBeNull();
      expect(tablesIn(anchorId).length, `#${anchorId} must open its table`).toBeGreaterThan(0);
    }
  );
});

describe("the anchor survives a NAMED ABSENCE (code review R3, D10.2)", () => {
  it("gives #defensive-actions-table a target on the 104/104 shape where the section is empty", async () => {
    /*
     * ═══ THE LINK THAT LANDED NOWHERE ═══
     *
     * `events.defensiveActions` is null on 104/104 shipped bundles, so `plan.isEmpty`
     * holds, the layer renders a SECTION-LEVEL empty state and `DefensiveActionsSection`
     * never mounts — taking the anchor id out of the DOM entirely. So the one Expert log
     * link a real reader is most likely to follow resolved, expanded its section, and then
     * had nothing to land on.
     *
     * D10.2 rules the standard: "a link that lands on a named absence is honest; a link
     * that lands nowhere is not." `ShotMapsSection` already honoured it for its own absent
     * arms; the section-level path did not.
     */
    const emptyDefensive = {
      ...bundle,
      events: { ...bundle.events, defensiveActions: null },
    } as unknown as MatchBundle;

    arriveAt("#defensive-actions-table");
    await act(async () => {
      renderLayer(emptyDefensive);
    });

    const landed = target("defensive-actions-table");
    expect(landed, "the anchor lands ON the absence, not nowhere").not.toBeNull();
    expect(tablesIn("defensive-actions-table"), "there is no table to open").toHaveLength(0);
    expect(lastScrollTarget(), "and the viewport went to it").toBe(landed);
  });
});

describe("PassNetworksSection is wired at BOTH its disclosure sites (D5, D10.3)", () => {
  it("opens the matrix table on the branch 104/104 real matches take", async () => {
    /*
     * `passNetworkNodes` null is the SHIPPED shape; the fixture's populated nodes
     * are the exception. Wiring only the fixture's branch looks green in exactly
     * one of the two worlds, which is what D10.3 warned about — and what the
     * original suite did.
     */
    arriveAt("#pass-networks-matrix");
    await act(async () => {
      renderLayer(matrixOnlyBundle);
    });
    expect(target("pass-networks-matrix"), "the matrix branch carries the anchor").not.toBeNull();
    expect(tablesIn("pass-networks-matrix").length, "the matrix table opened").toBeGreaterThan(0);
    expect(lastScrollTarget()).toBe(target("pass-networks-matrix"));
  });
});


// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TacticalLayer } from "@/components/TacticalLayer";
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
 * These cases render the WHOLE Tactical Layer — eleven sections, recharts leaves
 * behind `next/dynamic`, and up to two full renders in a single case — which is
 * the point: the mechanism under test spans the layer, five section components,
 * `PitchPanel` and `ViewDataDisclosure`, and a narrower harness would not
 * exercise the wiring that actually broke. It also costs roughly a second per
 * render here, and vitest's 5 s default made this file fail INTERMITTENTLY on a
 * loaded machine — a timeout dressed as a behaviour failure, which is worse than
 * a slow test. The budget is raised deliberately rather than the coverage cut.
 */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/*
 * jsdom implements no layout, so it implements no `scrollIntoView`.
 * `TacticalSection`'s focus-scroll calls it on every anchor-driven open — which
 * is correct in a browser and throws here — so it is stubbed rather than routed
 * around. The behaviour under test is that the disclosure OPENS, not that the
 * page scrolls.
 */
Element.prototype.scrollIntoView = function scrollIntoView() {};

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

function renderLayer() {
  return render(
    <LocaleProvider>
      <TacticalLayer bundle={bundle} />
    </LocaleProvider>
  );
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
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  window.location.hash = "";
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
    window.location.hash = "#shot-maps-crosses";
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
    window.location.hash = "#shot-maps-shots";
    await act(async () => {
      renderLayer();
    });
    expect(tablesIn("shot-maps-shots").length, "shots opened").toBeGreaterThan(0);
    expect(tablesIn("shot-maps-crosses"), "crosses stayed shut").toHaveLength(0);

    cleanup();

    window.location.hash = "#shot-maps-crosses";
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
    const user = userEvent.setup();
    window.location.hash = "#defensive-actions-table";
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
    window.location.hash = "#defensive-actions-table";
    await act(async () => {
      renderLayer();
    });
    const user = userEvent.setup();
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
    window.location.hash = "#shot-maps";
    await act(async () => {
      renderLayer();
    });
    expect(document.getElementById("shot-maps-shots"), "the section expanded").not.toBeNull();
    expect(tablesIn("shot-maps-shots"), "a section fragment opens no table").toHaveLength(0);
    expect(tablesIn("shot-maps-crosses"), "a section fragment opens no table").toHaveLength(0);
  });

  it("leaves an unresolvable fragment harmless — no crash, no open table (AC 3)", async () => {
    /*
     * A fragment is READER INPUT. `#shot-maps-log` names a real section and a
     * panel that does not exist; it reports loudly in dev and must never take the
     * page down. `TacticalErrorBoundary` would swallow a throw into an empty
     * state, so the assertion is that the layer still renders NORMALLY.
     */
    window.location.hash = "#shot-maps-log";
    await act(async () => {
      renderLayer();
    });
    expect(screen.getAllByRole("heading").length, "the layer still rendered").toBeGreaterThan(0);
  });
});

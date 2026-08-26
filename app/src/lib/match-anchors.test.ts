import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PANEL_ANCHORS,
  resolveMatchFragment,
  type PanelAnchorId,
} from "@/lib/match-anchors";
import { SECTION_IDS } from "@/lib/tactical-sections";

/*
 * THE FRAGMENT GRAMMAR (Story 3.8, ruled D1/D2).
 *
 * `#<SectionId>` keeps its shipped meaning exactly; `#<SectionId>-<panel>` is
 * the new, finer address that also opens one disclosure; anything else is
 * `null`. The interesting half of this suite is the THIRD case, because the
 * defect ledger L1553 filed against the old `sectionIdFromHash` was not that it
 * returned null — it was that it returned null SILENTLY, so a typo in an href
 * shipped as a dead anchor with nothing anywhere going red.
 *
 * Every unresolvable-fragment case below therefore spies on `console.error` and
 * asserts the CALL COUNT, not just the return value.
 */
describe("resolveMatchFragment — the section half (unchanged behaviour)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves every SectionId to itself, opening NO panel", () => {
    /*
     * D1: a section-level fragment keeps its shipped UX-DR18 behaviour — expand,
     * scroll, focus the heading — and opens no table. Only the finer fragment
     * opens one. This is the pin against a future "helpful" widening.
     */
    for (const id of SECTION_IDS) {
      expect(resolveMatchFragment(`#${id}`), id).toEqual({ section: id, panel: null });
    }
  });

  it("accepts a fragment with or without its leading #", () => {
    expect(resolveMatchFragment("shot-maps")).toEqual({ section: "shot-maps", panel: null });
    expect(resolveMatchFragment("#shot-maps")).toEqual({ section: "shot-maps", panel: null });
  });

  it("returns null for the empty fragment", () => {
    expect(resolveMatchFragment("")).toBeNull();
    expect(resolveMatchFragment("#")).toBeNull();
  });
});

describe("resolveMatchFragment — the panel half (AC 3, AC 4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves every registry entry onto a REAL SectionId", () => {
    expect(PANEL_ANCHORS.length, "the six Expert log destinations").toBe(6);
    for (const anchor of PANEL_ANCHORS) {
      expect(SECTION_IDS as readonly string[], anchor.id).toContain(anchor.section);
      expect(resolveMatchFragment(`#${anchor.id}`), anchor.id).toEqual({
        section: anchor.section,
        panel: anchor.id,
      });
    }
  });

  it("gives the shot log and the cross log DISTINCT panels on the SAME section — L1886", () => {
    /*
     * THE ASSERTION THE LEDGER ENTRY EXISTS FOR. Both Expert links read
     * `href: "#shot-maps"` before this story, so the second one was a no-op:
     * one fragment, two independent disclosures, no way to address either.
     */
    const shots = resolveMatchFragment("#shot-maps-shots");
    const crosses = resolveMatchFragment("#shot-maps-crosses");
    expect(shots).not.toBeNull();
    expect(crosses).not.toBeNull();
    expect(shots?.section).toBe("shot-maps");
    expect(crosses?.section).toBe("shot-maps");
    expect(shots?.panel).not.toBe(crosses?.panel);
  });

  it("keeps every anchor id unique and non-empty", () => {
    const ids = PANEL_ANCHORS.map((anchor) => anchor.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, "an empty anchor id would collide with the bare section fragment").not.toBe("");
    }
  });

  it("keeps every anchor id distinct from every SectionId", () => {
    /*
     * A registry entry that shadowed a section id would make the grammar
     * ambiguous at its own first branch — the exact class of defect L1886 is.
     */
    for (const anchor of PANEL_ANCHORS) {
      expect(SECTION_IDS as readonly string[], anchor.id).not.toContain(anchor.id);
    }
  });
});

describe("resolveMatchFragment — addressed but unresolvable (AC 3, D2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("stays SILENT for the route's legitimate non-section fragments", () => {
    /*
     * `#main-content` (SiteHeader.tsx:62) and `#expert` (ExpertLayer.tsx:71) are
     * real anchors on every match page. ExpertLayer.tsx:226-229 states outright
     * that a null here is BY DESIGN. A blanket warn would fire on both on every
     * single page load, which is how a loud gate teaches people to ignore it.
     */
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMatchFragment("#main-content")).toBeNull();
    expect(resolveMatchFragment("#expert")).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("reports ONCE in dev for a fragment that addresses a section it cannot resolve", () => {
    /*
     * `#shot-maps-log` is the shape a hand-edited or stale href takes: it names
     * a real section and then a panel that does not exist. Loud in dev/test.
     *
     * REPORTED ONCE (D2, copying i18n.ts's `reportedMissing` Set): this resolves
     * on every render of a mounted layer, so a per-call report would flood the
     * console and bury the first, useful line.
     */
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMatchFragment("#shot-maps-log")).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toMatch(/shot-maps-log/);

    resolveMatchFragment("#shot-maps-log");
    expect(consoleError, "the second identical miss is swallowed").toHaveBeenCalledTimes(1);
  });

  it("reports each DISTINCT miss on its own — a keyed Set, not a one-shot latch", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMatchFragment("#pass-networks-nope")).toBeNull();
    expect(resolveMatchFragment("#defensive-actions-nope")).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("says nothing in production, and still returns null", () => {
    /*
     * The i18n.test.ts:173-179 shape. A fragment is READER INPUT — someone
     * hand-types `#shot-map` — so the report must never reach a reader's console
     * and must never be a throw (D2): a typo taking the page down inside
     * TacticalErrorBoundary is strictly worse than a fragment that does nothing.
     */
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMatchFragment("#shot-maps-production-only-miss")).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("stays silent for a fragment that names no section at all", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(resolveMatchFragment("#not-a-section-at-all")).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("PANEL_ANCHORS — the frozen registry (D1)", () => {
  it("covers the six disclosures the Expert log links point at", () => {
    const byId = new Map<PanelAnchorId, string>(
      PANEL_ANCHORS.map((anchor) => [anchor.id, anchor.section])
    );
    expect(byId.get("shot-maps-shots")).toBe("shot-maps");
    expect(byId.get("shot-maps-crosses")).toBe("shot-maps");
    expect(byId.get("pass-networks-matrix")).toBe("pass-networks");
    expect(byId.get("offers-to-receive-table")).toBe("offers-to-receive");
    expect(byId.get("movement-to-receive-table")).toBe("movement-to-receive");
    expect(byId.get("defensive-actions-table")).toBe("defensive-actions");
  });
});

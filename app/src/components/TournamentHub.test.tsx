// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentHub } from "@/components/TournamentHub";
import type { Tournament } from "@/lib/contract/contract-types";
import { LocaleProvider } from "@/lib/i18n-provider";
import { resultsSections, standingsSections } from "@/lib/hub-model";
import fixture from "../../../data/fixtures/index/tournament.json";

/*
 * ═══════ SM-C2 ON THE TOURNAMENT HUB — Story 2.19 ruled decision D15 ═══════
 *
 * Every populated section table on this route sits behind `ViewDataDisclosure`,
 * with its row count rendered outside. The reason is measured and recorded in
 * `TournamentHub.tsx`: at 104 matches the route rendered 6,025 DOM nodes, 33
 * tables and 2,442 cells at 412 px with nothing collapsed, and Lighthouse
 * mobile scored 68 against AC 2's floor of 90.
 *
 * WHAT THESE TESTS EXIST TO CATCH is the half of SM-C2 that is easy to get
 * wrong later: "density moved behind disclosure, NEVER DELETED". A future
 * change that drops a group, hides an empty section's named copy, or breaks the
 * deep-link path would leave the route faster and less honest. Each is pinned.
 *
 * The fixture carries ONE group and a knockout tie (D5) — the assertions below
 * are about STRUCTURE PER SECTION, never about a count of 104.
 */

const tournament = fixture as unknown as Tournament;

/*
 * jsdom implements no layout, so it implements no `scrollIntoView`.
 * `useHashScroll` calls it unconditionally on mount — which is correct in a
 * browser and throws here — so the deep-link case below stubs it rather than
 * routing around it. Stubbing the missing DOM API is the honest move: the
 * behaviour under test is that the disclosure OPENS, not that the page scrolls.
 */
Element.prototype.scrollIntoView = function scrollIntoView() {};

function renderHub(node = <TournamentHub tournament={tournament} />) {
  return render(<LocaleProvider>{node}</LocaleProvider>);
}

/** How many sections have rows, and therefore earn a disclosure. */
function disclosureCount(): number {
  return (
    standingsSections(tournament).filter((s) => s.rows.length > 0).length +
    resultsSections(tournament).filter((s) => s.rows.length > 0).length
  );
}

/*
 * Story 3.5 — `LocaleProvider` now detects the locale from
 * `navigator.language` when nothing is persisted, and jsdom's default is
 * "en-US". Every assertion in this file reads a SPANISH string, so the file
 * must state the Spanish browser it assumes rather than inherit an ambient
 * default that used to be ignored.
 */
beforeEach(() => {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-CO");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("TournamentHub — SM-C2 disclosure (D15)", () => {
  it("renders NO section table on arrival, and one disclosure control per section", () => {
    renderHub();
    expect(document.querySelectorAll("table")).toHaveLength(0);
    // Selected by ACCESSIBLE NAME, not by `[aria-expanded="false"]`: the
    // glossary triggers and the sort menu are also collapsed controls, and a
    // structural selector would pass on the wrong element.
    const controls = screen.getAllByRole("button", { name: /^Ver los datos: / });
    expect(controls.length).toBe(disclosureCount());
    for (const control of controls) expect(control).toHaveAttribute("aria-expanded", "false");
  });

  it("KEEPS THE HEADINGS AND THE COUNTS OUTSIDE — the shape of the tournament is still readable closed", () => {
    renderHub();
    const sections = standingsSections(tournament);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      // The <h3> is still rendered AND still carries the deep-link anchor id.
      const heading = document.getElementById(section.anchorId);
      expect(heading).not.toBeNull();
      expect(heading?.tagName).toBe("H3");
      // The count of what is behind the control is rendered before opening it.
      expect(screen.getAllByText(new RegExp(`^${section.rows.length}\\s`)).length).toBeGreaterThan(0);
    }
  });

  it("reveals the real table — every row, nothing deleted — when the control is used", async () => {
    const user = userEvent.setup();
    renderHub();
    const section = standingsSections(tournament)[0];
    const control = screen.getAllByRole("button", { name: /^Ver los datos: / })[0];
    await user.click(control);
    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    // Header row plus one body row per standings row: the density moved, it did
    // not shrink.
    expect(within(table as HTMLElement).getAllByRole("row")).toHaveLength(section.rows.length + 1);
    expect(control).toHaveAttribute("aria-expanded", "true");
  });

  it("OPENS FROM A DEEP LINK — a shared #standings-group-* must not land on a closed control", async () => {
    const section = standingsSections(tournament)[0];
    window.location.hash = `#${section.anchorId}`;
    await act(async () => {
      renderHub();
    });
    const region = document.getElementById(section.anchorId)?.parentElement;
    expect(region?.querySelector("table")).not.toBeNull();
  });

  it("leaves an EMPTY section's named copy visible rather than hiding it behind a control", () => {
    /*
     * A group with no rows renders its table flat, so the reader sees "Sin
     * posiciones para este grupo." A control labelled "Ver los datos" over an
     * empty panel promises data that is not there.
     */
    const groups = (tournament as unknown as { groups: { standings: unknown[] }[] }).groups;
    const emptied = {
      ...tournament,
      groups: [{ ...groups[0], standings: [] }],
    } as unknown as Tournament;
    const sections = standingsSections(emptied);
    /*
     * ASSERTED, NOT RETURNED PAST (2.19 code review).
     *
     * This used to be `if (sections.length === 0 || sections[0].rows.length !== 0)
     * return;` under the comment "the fixture's shape does not admit the edit;
     * nothing to assert." But "`standingsSections` stopped emitting a section for
     * an emptied group" IS the regression this case exists to catch — so on the
     * exact failure it is written for, it returned early and reported GREEN having
     * verified nothing.
     *
     * A precondition that can silently swallow the defect is not a precondition,
     * it is a hole. If the fixture shape genuinely changes, this fails loudly and
     * whoever changed it updates the case deliberately.
     */
    expect(
      sections,
      "the emptied group produced no standings section — either the fixture changed " +
        "shape, or `standingsSections` has stopped emitting empty sections, which is " +
        "precisely the regression this case exists to catch"
    ).toHaveLength(1);
    expect(
      sections[0].rows,
      "the emptied group's section still carries rows — the fixture edit did not take"
    ).toHaveLength(0);

    renderHub(<TournamentHub tournament={emptied} />);
    expect(screen.getAllByText(/Sin posiciones para este grupo/).length).toBeGreaterThan(0);
  });
});

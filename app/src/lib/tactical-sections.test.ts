import { describe, expect, it } from "vitest";

import { readMatchBundle } from "@/lib/build-data";
import type { MatchBundle } from "@/lib/contract/contract-types";
import { t, type Locale } from "@/lib/i18n";
import {
  ALWAYS_EXPANDED_SECTION_IDS,
  COLLAPSIBLE_SECTION_IDS,
  COMPACT_KEY_STAT_FIELDS,
  KEY_STAT_FIELDS,
  KEY_STAT_FORMAT,
  KEY_STAT_UNIT,
  SECTION_IDS,
  buildKeyStatRows,
  buildSectionPlans,
  sectionDataState,
  sectionSummaryKey,
  sectionTitleKey,
  type SectionId,
} from "@/lib/tactical-sections";

/*
 * Pure registry tests (node env — the harness has no jsdom by the Story 2.2
 * decision). Fixtures are read off the filesystem through the build-time
 * reader, the same path static-output.test.ts uses.
 */

const LOCALES: Locale[] = ["es", "en"];

const m001 = readMatchBundle("m001-mexico-south-africa");
const m002 = readMatchBundle("m002-korea-republic-czechia");
const m074 = readMatchBundle("m074-germany-paraguay");

describe("SECTION_IDS (AC 1)", () => {
  it("is the normative order, verbatim", () => {
    // Asserted as literals, not derived from the module under test.
    expect([...SECTION_IDS]).toEqual([
      "key-stats",
      "momentum",
      "shot-maps",
      "pass-networks",
      "offers-to-receive",
      "movement-to-receive",
      "defensive-actions",
      "phases",
      "pressing",
      "set-plays",
      "goalkeeping",
    ]);
  });

  it("has 11 unique entries", () => {
    expect(SECTION_IDS).toHaveLength(11);
    expect(new Set(SECTION_IDS).size).toBe(11);
  });

  it("partitions exactly into always-expanded and collapsible, with no overlap", () => {
    expect([...ALWAYS_EXPANDED_SECTION_IDS]).toEqual(["key-stats", "momentum"]);
    expect(COLLAPSIBLE_SECTION_IDS).toHaveLength(9);
    const union = new Set<SectionId>([...ALWAYS_EXPANDED_SECTION_IDS, ...COLLAPSIBLE_SECTION_IDS]);
    expect(union.size).toBe(SECTION_IDS.length);
    expect([...union].sort()).toEqual([...SECTION_IDS].sort());
    for (const id of ALWAYS_EXPANDED_SECTION_IDS) {
      expect(COLLAPSIBLE_SECTION_IDS).not.toContain(id);
    }
  });

  it("keeps the collapsible ids in registry order", () => {
    const collapsible: readonly SectionId[] = COLLAPSIBLE_SECTION_IDS;
    const registryOrder = SECTION_IDS.filter((id) => collapsible.includes(id));
    expect([...COLLAPSIBLE_SECTION_IDS]).toEqual(registryOrder);
  });
});

describe("section copy (AC 1)", () => {
  it("resolves a title for every section in both locales", () => {
    for (const id of SECTION_IDS) {
      for (const locale of LOCALES) {
        const title = t(sectionTitleKey(id), locale);
        expect(title, `${id} title missing in ${locale}`).not.toBe("");
        expect(title).not.toContain("tactical.sections");
      }
    }
  });

  it("resolves a summary for every collapsible section in both locales", () => {
    for (const id of COLLAPSIBLE_SECTION_IDS) {
      for (const locale of LOCALES) {
        const summary = t(sectionSummaryKey(id), locale);
        expect(summary, `${id} summary missing in ${locale}`).not.toBe("");
        expect(summary).not.toContain("tactical.sections");
      }
    }
  });

  it("gives es and en different words (a copy-paste mirror would pass everything above)", () => {
    expect(t(sectionTitleKey("key-stats"), "es")).toBe("Estadísticas clave");
    expect(t(sectionTitleKey("key-stats"), "en")).toBe("Key statistics");
    expect(t(sectionTitleKey("goalkeeping"), "es")).toBe("Arqueros");
    expect(t(sectionTitleKey("goalkeeping"), "en")).toBe("Goalkeeping");
  });

  it("resolves the empty-state and pending copy in both locales", () => {
    for (const locale of LOCALES) {
      expect(t("tactical.empty.headlineBefore", locale)).not.toBe("");
      expect(t("tactical.empty.headlineAfter", locale)).not.toBe("");
      expect(t("tactical.empty.explanation", locale)).not.toBe("");
      expect(t("tactical.pending.headline", locale)).not.toBe("");
      expect(t("tactical.pending.explanation", locale)).not.toBe("");
    }
    /*
     * AC 3's headline names the section, composed around the resolved <h2>
     * title (t() has no interpolation). Assert the composed shape here, since
     * the fragments alone read as nonsense.
     */
    const composed = (locale: Locale, title: string) =>
      `${t("tactical.empty.headlineBefore", locale)} ${title} ${t("tactical.empty.headlineAfter", locale)}`;
    expect(composed("es", t(sectionTitleKey("momentum"), "es"))).toBe(
      "Sin datos de Línea de momentum para este partido."
    );
    expect(composed("en", t(sectionTitleKey("momentum"), "en"))).toBe(
      "No data for Momentum timeline in this match."
    );
    // Ruled decision 9: a pending section must never claim the report omits it.
    expect(t("tactical.pending.explanation", "es")).not.toBe(t("tactical.empty.explanation", "es"));
  });
});

describe("sectionDataState over the real fixtures (AC 3)", () => {
  it("marks every section ready on m001 and m074", () => {
    for (const bundle of [m001, m074]) {
      for (const id of SECTION_IDS) {
        expect(sectionDataState(bundle, id), `${bundle.matchId} / ${id}`).toBe("ready");
      }
    }
  });

  it("marks only momentum empty on m002 (its momentum is null)", () => {
    expect(m002.momentum).toBeNull();
    for (const id of SECTION_IDS) {
      expect(sectionDataState(m002, id), id).toBe(id === "momentum" ? "empty" : "ready");
    }
  });
});

/*
 * null and [] are DIFFERENT states in this contract (schema $comments say so
 * verbatim): null = the report does not carry that page → empty state; [] =
 * the page was present and listed zero events → ready, and the owning story
 * renders its own zero-content view.
 */
describe("sectionDataState: null vs [] (AC 3)", () => {
  function withEvents(patch: Partial<MatchBundle["events"]>): MatchBundle {
    return { ...m001, events: { ...m001.events, ...patch } };
  }

  /*
   * Story 2.7 ruled decision 2 (closing the 2.5 review's decision D7):
   * #shot-maps is fed by TWO tables and is silent-absent only when BOTH are
   * missing. The previous assertion here — `shots: null` -> "empty" — was
   * correct while the section carried one map and is wrong now that the cross
   * map is a second panel inside it.
   */
  it("calls shot-maps empty only when shots AND crosses are both null", () => {
    expect(sectionDataState(withEvents({ shots: [], crosses: [] }), "shot-maps")).toBe("ready");
    expect(sectionDataState(withEvents({ shots: null, crosses: [] }), "shot-maps")).toBe("ready");
    expect(sectionDataState(withEvents({ shots: [], crosses: null }), "shot-maps")).toBe("ready");
    expect(sectionDataState(withEvents({ shots: null, crosses: null }), "shot-maps")).toBe("empty");
  });

  it("keeps a crosses-only report's section visible rather than hiding present data", () => {
    // The FR-22 failure mode inverted: a section-wide "the official report does
    // not include this section" over crosses that are sitting in the bundle.
    const crossesOnly = withEvents({ shots: null });
    expect(crossesOnly.events.crosses).not.toBeNull();
    expect(sectionDataState(crossesOnly, "shot-maps")).toBe("ready");
  });

  it("treats an empty defensive-actions array as ready and null as empty", () => {
    expect(sectionDataState(withEvents({ defensiveActions: [] }), "defensive-actions")).toBe("ready");
    expect(sectionDataState(withEvents({ defensiveActions: null }), "defensive-actions")).toBe("empty");
  });

  /*
   * STORY 2.9 RULED DECISION 3 — the two receiving predicates read
   * `bundle.players`, NOT `events.receiving`.
   *
   * `ReceivingEvent` is unfulfillable in every one of its eight required fields
   * (Story 1.13, 104 reports / 416 pages), so `events.receiving` can only ever
   * be null and the old predicate was wrong in BOTH directions: it returned
   * "ready" when `receiving` was populated but `players` was null (the
   * component mounts and throws — a whole-layer outage), and "empty" when
   * `receiving` was null but `players` was populated — hiding data sitting in
   * the bundle, the FR-22 failure mode inverted.
   *
   * The four-way truth table replaces the old "flips both together" assertion,
   * on the model of the shot-maps table above (Story 2.7's precedent).
   */
  function withPlayers(players: MatchBundle["players"]): MatchBundle {
    return { ...m001, players };
  }

  it("reads bundle.players for BOTH receiving sections, never events.receiving", () => {
    const populatedPlayers = m001.players;
    expect(populatedPlayers).not.toBeNull();
    const table: {
      players: MatchBundle["players"];
      receiving: MatchBundle["events"]["receiving"];
      expected: "ready" | "empty";
    }[] = [
      // players populated → ready, WHATEVER receiving says.
      { players: populatedPlayers, receiving: null, expected: "ready" },
      { players: populatedPlayers, receiving: [], expected: "ready" },
      // `[]` is "the pages were present and listed nobody" — ready, and the
      // component renders its own zero line.
      { players: [], receiving: null, expected: "ready" },
      { players: [], receiving: [], expected: "ready" },
      // players null → empty, even when receiving is populated: there is no
      // per-event receiving data these sections could render.
      { players: null, receiving: null, expected: "empty" },
      { players: null, receiving: [], expected: "empty" },
    ];
    for (const row of table) {
      const bundle: MatchBundle = {
        ...m001,
        players: row.players,
        events: { ...m001.events, receiving: row.receiving },
      };
      for (const id of ["offers-to-receive", "movement-to-receive"] as const) {
        expect(
          sectionDataState(bundle, id),
          `${id} / players=${row.players === null ? "null" : row.players.length} / receiving=${
            row.receiving === null ? "null" : row.receiving.length
          }`
        ).toBe(row.expected);
      }
    }
  });

  it("does not hide present Domain G data behind an absent receiving table", () => {
    // The FR-22 inversion, stated as its own case: a section-wide "the official
    // report does not include this section" over per-player rows sitting in the
    // bundle. This is the exact defect Story 2.7's ruled decision 2 exists for.
    const noReceiving = withEvents({ receiving: null });
    expect(noReceiving.players).not.toBeNull();
    expect(sectionDataState(noReceiving, "offers-to-receive")).toBe("ready");
  });

  it("leaves #defensive-actions on events.defensiveActions, unchanged", () => {
    const noPlayers = withPlayers(null);
    expect(sectionDataState(noPlayers, "defensive-actions")).toBe("ready");
    expect(sectionDataState(withPlayers([]), "defensive-actions")).toBe("ready");
  });

  it("needs BOTH pass-network tables to call the section ready", () => {
    expect(sectionDataState(withEvents({ passNetworkNodes: [], passNetworkEdges: [] }), "pass-networks")).toBe(
      "ready"
    );
    expect(sectionDataState(withEvents({ passNetworkNodes: null }), "pass-networks")).toBe("empty");
    expect(sectionDataState(withEvents({ passNetworkEdges: null }), "pass-networks")).toBe("empty");
  });

  it("treats an empty goalkeeping array as ready and null as empty", () => {
    expect(sectionDataState({ ...m001, goalkeeping: [] }, "goalkeeping")).toBe("ready");
    expect(sectionDataState({ ...m001, goalkeeping: null }, "goalkeeping")).toBe("empty");
  });

  it("throws on an id outside the union rather than falling through", () => {
    expect(() => sectionDataState(m001, "expert" as SectionId)).toThrow(/expert/);
  });
});

describe("KEY_STAT_FIELDS (AC 2)", () => {
  it("is the contract's required[] order, verbatim", () => {
    expect([...KEY_STAT_FIELDS]).toEqual([
      "possession",
      "goals",
      "expectedGoals",
      "shots",
      "shotsOnTarget",
      "passes",
      "passesCompleted",
      "passCompletion",
      "completedLineBreaks",
      "defensiveLineBreaks",
      "receptionsInFinalThird",
      "crosses",
      "ballProgressions",
      "defensivePressures",
      "directPressures",
      "forcedTurnovers",
      "secondBalls",
      "distanceCovered",
      "sprintDistance",
    ]);
    expect(KEY_STAT_FIELDS).toHaveLength(19);
  });

  it("covers TeamKeyStatistics exhaustively (a field added later fails here)", () => {
    expect([...KEY_STAT_FIELDS].sort()).toEqual(Object.keys(m001.keyStatistics.home).sort());
  });

  it("assigns every field a format tag, and km only to the two distances", () => {
    for (const field of KEY_STAT_FIELDS) {
      expect(KEY_STAT_FORMAT[field], field).toBeDefined();
    }
    expect(Object.keys(KEY_STAT_UNIT).sort()).toEqual(["distanceCovered", "sprintDistance"]);
    expect(KEY_STAT_FORMAT.possession).toBe("percent");
    expect(KEY_STAT_FORMAT.passCompletion).toBe("percent");
    expect(KEY_STAT_FORMAT.expectedGoals).toBe("decimal2");
    expect(KEY_STAT_FORMAT.distanceCovered).toBe("decimal1");
    expect(KEY_STAT_FORMAT.sprintDistance).toBe("decimal1");
    expect(KEY_STAT_FORMAT.shots).toBe("integer");
  });
});

describe("COMPACT_KEY_STAT_FIELDS (ruled decision 4)", () => {
  it("is the six ruled rows", () => {
    expect([...COMPACT_KEY_STAT_FIELDS]).toEqual([
      "possession",
      "expectedGoals",
      "shots",
      "shotsOnTarget",
      "passesCompleted",
      "passCompletion",
    ]);
  });

  it("is a subset of KEY_STAT_FIELDS that preserves their relative order", () => {
    for (const field of COMPACT_KEY_STAT_FIELDS) {
      expect(KEY_STAT_FIELDS).toContain(field);
    }
    const compact: readonly string[] = COMPACT_KEY_STAT_FIELDS;
    const inRegistryOrder = KEY_STAT_FIELDS.filter((field) => compact.includes(field));
    expect([...COMPACT_KEY_STAT_FIELDS]).toEqual(inRegistryOrder);
  });
});

describe("buildKeyStatRows (AC 2)", () => {
  const rows = buildKeyStatRows(m001.keyStatistics);

  it("emits one row per field, in registry order, carrying both sides' raw values", () => {
    expect(rows.map((row) => row.field)).toEqual([...KEY_STAT_FIELDS]);
    const possession = rows[0];
    expect(possession.home).toBe(57.1);
    expect(possession.away).toBe(36.1);
  });

  it("resolves the leader per row — home, away and tie", () => {
    const byField = new Map(rows.map((row) => [row.field, row]));
    // m001 home 57.1 / away 36.1 → home leads possession.
    expect(byField.get("possession")?.leader).toBe("home");
    // m001 home 31 / away 32 forced turnovers → away leads.
    expect(byField.get("forcedTurnovers")?.leader).toBe("away");
  });

  it("marks equal values as a tie (no leader marks — never color-only)", () => {
    const tied = buildKeyStatRows({
      ...m001.keyStatistics,
      away: { ...m001.keyStatistics.away, shots: m001.keyStatistics.home.shots },
    });
    expect(tied.find((row) => row.field === "shots")?.leader).toBe("tie");
  });
});

/*
 * The disclosure/rhythm planner (2.5 review patch). This is the logic AC 1 is
 * actually about — precedence, breakpoint defaults, override survival and the
 * collapsed-run gap rule — and it previously lived inline in TacticalLayer,
 * where the node-env harness could not reach it.
 */
describe("buildSectionPlans — disclosure precedence (AC 1)", () => {
  const planFor = (plans: ReturnType<typeof buildSectionPlans>, id: SectionId) => {
    const plan = plans.find((candidate) => candidate.id === id);
    if (plan === undefined) {
      throw new Error(`no plan for ${id}`);
    }
    return plan;
  };

  it("plans every section, in the registry's order", () => {
    const plans = buildSectionPlans(m001, false, {});
    expect(plans.map((plan) => plan.id)).toEqual([...SECTION_IDS]);
  });

  it("never collapses key-stats or momentum, at either width", () => {
    for (const isLg of [false, true]) {
      const plans = buildSectionPlans(m001, isLg, {});
      for (const id of ALWAYS_EXPANDED_SECTION_IDS) {
        expect(planFor(plans, id).collapsible, `${id} at isLg=${isLg}`).toBe(false);
        expect(planFor(plans, id).open).toBe(true);
        expect(planFor(plans, id).showSummary).toBe(false);
      }
    }
  });

  it("never collapses an EMPTY section, at either width (ruled decision 10)", () => {
    // m002 is the one fixture with a null slice: momentum. Use a constructed
    // bundle so an ALWAYS_EXPANDED id is not doing the work for us.
    // Both of #shot-maps' tables must be null for it to be empty at all
    // (Story 2.7 ruled decision 2).
    const noMaps = {
      ...m001,
      events: { ...m001.events, shots: null, crosses: null },
    } as MatchBundle;
    for (const isLg of [false, true]) {
      const plan = planFor(buildSectionPlans(noMaps, isLg, {}), "shot-maps");
      expect(plan.isEmpty).toBe(true);
      expect(plan.collapsible).toBe(false);
      expect(plan.open).toBe(true);
      // A summary line describing data that is not there would be nonsense.
      expect(plan.showSummary).toBe(false);
    }
    expect(planFor(buildSectionPlans(m002, false, {}), "momentum").isEmpty).toBe(true);
  });

  it("collapses the other nine below lg and opens them at or above it", () => {
    const below = buildSectionPlans(m001, false, {});
    const above = buildSectionPlans(m001, true, {});
    for (const id of COLLAPSIBLE_SECTION_IDS) {
      expect(planFor(below, id).collapsible, `${id} below lg`).toBe(true);
      expect(planFor(below, id).open, `${id} below lg`).toBe(false);
      // Ruled by the 2.5 review: still a real disclosure at >=lg, merely open.
      expect(planFor(above, id).collapsible, `${id} at lg`).toBe(true);
      expect(planFor(above, id).open, `${id} at lg`).toBe(true);
      expect(planFor(above, id).showSummary, `${id} at lg`).toBe(true);
    }
  });

  it("lets an explicit override beat the breakpoint default, both ways", () => {
    const openedBelow = buildSectionPlans(m001, false, { "shot-maps": true });
    expect(planFor(openedBelow, "shot-maps").open).toBe(true);
    const closedAbove = buildSectionPlans(m001, true, { "shot-maps": false });
    expect(planFor(closedAbove, "shot-maps").open).toBe(false);
    // An override on a non-collapsible section is ignored, not honoured.
    expect(planFor(buildSectionPlans(m001, false, { "key-stats": false }), "key-stats").open).toBe(
      true
    );
  });

  it("suppresses section-gap only between consecutive collapsed shells", () => {
    const plans = buildSectionPlans(m001, false, {});
    // First section never carries a leading gap.
    expect(planFor(plans, "key-stats").spacedFromPrevious).toBe(false);
    // momentum follows an expanded section → gap.
    expect(planFor(plans, "momentum").spacedFromPrevious).toBe(true);
    // shot-maps is the FIRST of the collapsed run → still gets its gap.
    expect(planFor(plans, "shot-maps").spacedFromPrevious).toBe(true);
    // The rest of the run stacks directly on its own hairlines.
    for (const id of COLLAPSIBLE_SECTION_IDS.slice(1)) {
      expect(planFor(plans, id).spacedFromPrevious, `${id} in the shell run`).toBe(false);
    }
  });

  it("gives every section a gap at >=lg, where nothing is a shell", () => {
    const plans = buildSectionPlans(m001, true, {});
    expect(plans[0].spacedFromPrevious).toBe(false);
    for (const plan of plans.slice(1)) {
      expect(plan.spacedFromPrevious, `${plan.id} at lg`).toBe(true);
    }
  });
});

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
      expect(t("tactical.empty.headline", locale)).not.toBe("");
      expect(t("tactical.empty.explanation", locale)).not.toBe("");
      expect(t("tactical.pending.headline", locale)).not.toBe("");
      expect(t("tactical.pending.explanation", locale)).not.toBe("");
    }
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

  it("treats an empty shots array as ready and a null shots table as empty", () => {
    expect(sectionDataState(withEvents({ shots: [] }), "shot-maps")).toBe("ready");
    expect(sectionDataState(withEvents({ shots: null }), "shot-maps")).toBe("empty");
  });

  it("treats an empty defensive-actions array as ready and null as empty", () => {
    expect(sectionDataState(withEvents({ defensiveActions: [] }), "defensive-actions")).toBe("ready");
    expect(sectionDataState(withEvents({ defensiveActions: null }), "defensive-actions")).toBe("empty");
  });

  it("flips both receiving sections together", () => {
    const emptyArray = withEvents({ receiving: [] });
    const nulled = withEvents({ receiving: null });
    for (const id of ["offers-to-receive", "movement-to-receive"] as const) {
      expect(sectionDataState(emptyArray, id)).toBe("ready");
      expect(sectionDataState(nulled, id)).toBe("empty");
    }
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

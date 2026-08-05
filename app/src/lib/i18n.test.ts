import { afterEach, describe, expect, it, vi } from "vitest";

import { en } from "@/locales/en";
import { es } from "@/locales/es";
import type { PossessionContestType } from "@/lib/contract/contract-types";
import {
  GLOSSARY_TERMS,
  SECTION_HEADING_MARKS,
  SECTION_SUMMARY_MARKS,
  findTermSpan,
  glossaryDefinitionKey,
  glossaryTermEnKey,
  glossaryTermEsKey,
} from "@/lib/glossary";
import { t, type Locale } from "@/lib/i18n";
import {
  COLLAPSIBLE_SECTION_IDS,
  KEY_STAT_FIELDS,
  SECTION_IDS,
  sectionSummaryKey,
  sectionTitleKey,
} from "@/lib/tactical-sections";
import type { CollapsibleSectionId, SectionId } from "@/lib/tactical-sections";
import { CROSS_DELIVERY_TYPES, crossDeliveryKey } from "@/viz/cross-map-model";
import { EXPERT_FIELDS, expertFieldKey, expertFieldTitleKey } from "@/viz/expert-model";
import {
  DEFENSIVE_ACTION_TYPES,
  POSSESSION_CONTEST_TYPES,
  defensiveActionKey,
  possessionContestKey,
} from "@/viz/defensive-actions-model";
import {
  AERIAL_TYPES,
  DISTRIBUTION_TYPES,
  FEET_TECHNIQUES,
  HANDS_TECHNIQUES,
  INTERVENTION_BODY_TYPES,
  INTERVENTION_TYPES,
  THROW_TECHNIQUES,
  aerialTypeKey,
  distributionTypeKey,
  feetTechniqueKey,
  handsTechniqueKey,
  interventionBodyTypeKey,
  interventionTypeKey,
  throwTechniqueKey,
} from "@/viz/goalkeeping-model";
import {
  BLOCK_LEVELS,
  IN_POSSESSION_PHASES,
  OUT_OF_POSSESSION_PHASES,
  PRESS_PHASES,
  blockLevelKey,
  inPossessionPhaseKey,
  outOfPossessionPhaseKey,
} from "@/viz/phases-model";
import { OFFER_MOVEMENT_TYPES, offerMovementKey } from "@/viz/receiving-model";
import { RECEIVING_EVENT_TYPES, receivingEventTypeKey } from "@/viz/receiving-log-model";
/*
 * The link table is imported from the component that renders it, so the hrefs
 * this suite pins ARE the shipped ones. `environment: "node"` loads
 * ExpertLayer.tsx without trouble — nothing at its module top level touches the
 * DOM.
 */
import { LOG_LINKS } from "@/components/ExpertLayer";
import {
  CORNER_DELIVERY_STYLES,
  CORNER_DELIVERY_TYPES,
  FREE_KICK_TYPES,
  PITCH_SIDES,
  cornerDeliveryStyleKey,
  cornerDeliveryTypeKey,
  freeKickTypeKey,
  pitchSideKey,
} from "@/viz/set-plays-model";
import { SHOT_OUTCOMES, shotOutcomeKey } from "@/viz/shot-map-model";

describe("t()", () => {
  it("defaults to the canonical Spanish dictionary", () => {
    expect(t("app.scaffold.heading")).toBe(es.app.scaffold.heading);
  });

  it("resolves the active locale's value", () => {
    expect(t("app.scaffold.heading", "en")).toBe(en.app.scaffold.heading);
    expect(t("app.scaffold.heading", "es")).not.toBe(t("app.scaffold.heading", "en"));
  });

  it("throws on a key that does not resolve to a string", () => {
    // Bypasses the compile-time key type to exercise the runtime guard.
    expect(() => t("app.missing" as Parameters<typeof t>[0])).toThrow(/did not resolve/);
  });
});

/*
 * Story 2.2 Task 4 decision: once locale persistence ships, a throwing t()
 * would turn a stale key into an uncaught page crash. In production an
 * unresolvable key falls back (es value, else the key itself) with a
 * console.error; dev and test keep the throw so regressions stay loud.
 */
describe("t() production fallback policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the key with a console.error instead of throwing in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(t("app.missing" as Parameters<typeof t>[0])).toBe("app.missing");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toMatch(/did not resolve/);
  });

  it("falls back to the canonical es value when a non-es lookup misses", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // en is type-mirrored, so a real miss cannot exist in a compiling tree;
    // simulate the untyped boundary by breaking the leaf at runtime.
    const enScaffold = en.app.scaffold as Record<string, unknown>;
    const original = enScaffold.heading;
    enScaffold.heading = undefined;
    try {
      expect(t("app.scaffold.heading", "en")).toBe(es.app.scaffold.heading);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      enScaffold.heading = original;
    }
  });

  it("returns the raw key when the key misses in both locales, logging it once", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // The stale-persisted-key scenario: absent from en AND from the es
    // fallback — the raw dot-path is the last resort.
    const key = "app.missing.everywhere" as Parameters<typeof t>[0];
    expect(t(key, "en")).toBe("app.missing.everywhere");
    expect(consoleError).toHaveBeenCalledTimes(1);
    // Re-resolving the same miss (e.g. a list re-render) must not re-log.
    expect(t(key, "en")).toBe("app.missing.everywhere");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("keeps throwing outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => t("app.missing" as Parameters<typeof t>[0])).toThrow(/did not resolve/);
  });
});

/*
 * Story 2.5 Task 9.2: the enums.metric namespace is keyed by TeamKeyStatistics
 * field name (MetricCode is string-identical to the field it ranks), so a
 * field added to the contract must not silently render an unlabelled row.
 */
describe("enums.metric / enums.unit (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per Key Statistics field", () => {
    expect(Object.keys(es.enums.metric).sort()).toEqual([...KEY_STAT_FIELDS].sort());
  });

  it("resolves every metric label in both locales", () => {
    for (const field of KEY_STAT_FIELDS) {
      for (const locale of locales) {
        const label = t(`enums.metric.${field}`, locale);
        expect(label, `${field} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.metric");
      }
    }
  });

  it("resolves the km unit in both locales", () => {
    for (const locale of locales) {
      expect(t("enums.unit.km", locale)).toBe("km");
    }
  });
});

/*
 * Story 2.7 Task 11.2. The marker legend, the popover qualifier and the log's
 * Outcome column all read enums.shotOutcome; the cross table's delivery column
 * reads enums.crossDelivery. A missing entry would render an unlabelled legend
 * swatch — the failure the shape half of the dual encoding cannot cover.
 *
 * The `en` mirror is also enforced by the compile error on `en: Dictionary`;
 * looping both locales through t() catches the same class of miss at runtime,
 * following the enums.metric assertion's shape.
 */
describe("enums.shotOutcome / enums.crossDelivery (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per ShotOutcome value", () => {
    expect(Object.keys(es.enums.shotOutcome).sort()).toEqual(
      [...SHOT_OUTCOMES].sort()
    );
  });

  it("has exactly one entry per CrossDeliveryType value", () => {
    expect(Object.keys(es.enums.crossDelivery).sort()).toEqual([...CROSS_DELIVERY_TYPES].sort());
  });

  it("resolves every shot-outcome label in both locales", () => {
    for (const outcome of SHOT_OUTCOMES) {
      for (const locale of locales) {
        const label = t(shotOutcomeKey(outcome), locale);
        expect(label, `${outcome} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.shotOutcome");
      }
    }
  });

  it("resolves every delivery-type label in both locales", () => {
    for (const deliveryType of CROSS_DELIVERY_TYPES) {
      for (const locale of locales) {
        const label = t(crossDeliveryKey(deliveryType), locale);
        expect(label, `${deliveryType} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.crossDelivery");
      }
    }
  });

  it("does NOT carry ShotOutcomeDetail labels — those ride CS-1 (Task 10.4)", () => {
    // AD-14 decision CR-2 makes `outcome` authoritative for marker encoding, so
    // this story maps the stable five-value enum only. The 22->24 detail
    // extension is CS-1's payload and belongs to Stories 2.11/2.13/2.18.
    expect(Object.keys(es.enums.shotOutcome)).toHaveLength(5);
    expect(Object.keys(es.enums)).not.toContain("shotOutcomeDetail");
  });
});

/*
 * Story 2.9 Task 7.5, on the same template. Three enums land at once:
 * OfferMovementType (six — the proportion bar's segments AND the movement
 * table's column heads), DefensiveActionType (four) and PossessionContestType
 * (six, for the log column that appears only when a row carries a value).
 *
 * Driven by the frozen ordered lists the models export, so a contract enum
 * change is caught here as well as at compile time.
 */
describe("enums.offerMovement / defensiveAction / possessionContest (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];
  /*
   * REVIEW PATCH: this list used to be hand-copied here while its two siblings
   * were imported, contradicting the docblock above ("driven by the frozen
   * ordered lists the models export"). A seventh contest code would have needed
   * two files edited to be caught, and the label-resolution loop below would
   * simply never have visited it. Now imported like the others.
   */
  const CONTEST_TYPES: readonly PossessionContestType[] = POSSESSION_CONTEST_TYPES;

  it("has exactly one entry per OfferMovementType value", () => {
    expect(Object.keys(es.enums.offerMovement).sort()).toEqual([...OFFER_MOVEMENT_TYPES].sort());
  });

  it("labels ALL FOUR DefensiveActionType values", () => {
    // Two of the four (block, possession-contest) can never be plotted — they
    // are aggregate panels with no coordinates anywhere in the corpus — but the
    // log table and any future emission may carry them, and an unlabelled row
    // is worse than an unreachable label (ruled decision 5).
    expect(Object.keys(es.enums.defensiveAction).sort()).toEqual([...DEFENSIVE_ACTION_TYPES].sort());
  });

  it("has exactly one entry per PossessionContestType value", () => {
    expect(Object.keys(es.enums.possessionContest).sort()).toEqual([...CONTEST_TYPES].sort());
  });

  it("resolves every movement label in both locales", () => {
    for (const code of OFFER_MOVEMENT_TYPES) {
      for (const locale of locales) {
        const label = t(offerMovementKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.offerMovement");
      }
    }
  });

  it("resolves every defensive-action and contest label in both locales", () => {
    for (const locale of locales) {
      for (const code of DEFENSIVE_ACTION_TYPES) {
        const label = t(defensiveActionKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.defensiveAction");
      }
      for (const code of CONTEST_TYPES) {
        const label = t(possessionContestKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.possessionContest");
      }
    }
  });

  it("keeps `no-movement` labelled — 24.9% of all corpus offers ride it", () => {
    // The ledger's "the movement map prints exactly FIVE types" constrains the
    // movement PAGE's grid, not Domain G. Dropping the sixth would hide a
    // quarter of the data behind a label that does not exist.
    for (const locale of locales) {
      expect(t("enums.offerMovement.no-movement", locale)).not.toBe("");
    }
  });
});

/*
 * ------------------------- STORY 2.10's FOURTEEN ENUMS -------------------------
 *
 * Task 8.5. Every list is IMPORTED from the model that owns it, never
 * hand-copied here — the 2.9 review patched exactly that mistake, because a
 * hand-copied list means a widened enum needs two files edited to be caught and
 * the label-resolution loop simply never visits the new code.
 *
 * THIS SUITE IS WHY THE KEY BUILDERS' `as DictionaryKey` CAST IS SAFE. Every
 * builder ends in that cast because DictionaryKey is a literal union and a
 * template-literal expression infers `string`; the cast silences the compiler,
 * so this round-trip is the ONLY thing standing between a typo'd key and a
 * runtime miss.
 */
describe("Story 2.10's Domain C enums (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per InPossessionPhase value", () => {
    expect(Object.keys(es.enums.inPossessionPhase).sort()).toEqual(
      [...IN_POSSESSION_PHASES].sort()
    );
    expect(Object.keys(en.enums.inPossessionPhase).sort()).toEqual(
      [...IN_POSSESSION_PHASES].sort()
    );
  });

  it("has exactly one entry per OutOfPossessionPhase value", () => {
    expect(Object.keys(es.enums.outOfPossessionPhase).sort()).toEqual(
      [...OUT_OF_POSSESSION_PHASES].sort()
    );
    expect(Object.keys(en.enums.outOfPossessionPhase).sort()).toEqual(
      [...OUT_OF_POSSESSION_PHASES].sort()
    );
  });

  it("has exactly one entry per BlockLevel value", () => {
    expect(Object.keys(es.enums.blockLevel).sort()).toEqual([...BLOCK_LEVELS].sort());
    expect(Object.keys(en.enums.blockLevel).sort()).toEqual([...BLOCK_LEVELS].sort());
  });

  it("resolves every Domain C label in both locales", () => {
    for (const locale of locales) {
      for (const code of IN_POSSESSION_PHASES) {
        const label = t(inPossessionPhaseKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.inPossessionPhase");
      }
      for (const code of OUT_OF_POSSESSION_PHASES) {
        const label = t(outOfPossessionPhaseKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.outOfPossessionPhase");
      }
      for (const code of BLOCK_LEVELS) {
        const label = t(blockLevelKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.blockLevel");
      }
    }
  });

  /*
   * #pressing renders the four press rates through the SAME namespace #phases
   * uses (ruled decision 4's deliberate duplication), so the subset needs no
   * labels of its own — but it must stay a strict subset, or a press rate would
   * render an unresolved key.
   */
  it("labels every press rate #pressing renders", () => {
    for (const code of PRESS_PHASES) {
      expect(OUT_OF_POSSESSION_PHASES).toContain(code);
      for (const locale of locales) {
        expect(t(outOfPossessionPhaseKey(code), locale)).not.toBe("");
      }
    }
  });

  it("keeps the metre unit as locale metadata (AD-7)", () => {
    expect(t("enums.unit.m", "es")).toBe("m");
    expect(t("enums.unit.m", "en")).toBe("m");
  });
});

describe("Story 2.10's Domain F enums (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per Domain F value", () => {
    expect(Object.keys(es.enums.freeKick).sort()).toEqual([...FREE_KICK_TYPES].sort());
    expect(Object.keys(en.enums.freeKick).sort()).toEqual([...FREE_KICK_TYPES].sort());
    expect(Object.keys(es.enums.cornerDeliveryType).sort()).toEqual(
      [...CORNER_DELIVERY_TYPES].sort()
    );
    expect(Object.keys(en.enums.cornerDeliveryType).sort()).toEqual(
      [...CORNER_DELIVERY_TYPES].sort()
    );
    expect(Object.keys(es.enums.cornerDeliveryStyle).sort()).toEqual(
      [...CORNER_DELIVERY_STYLES].sort()
    );
    expect(Object.keys(en.enums.cornerDeliveryStyle).sort()).toEqual(
      [...CORNER_DELIVERY_STYLES].sort()
    );
    expect(Object.keys(es.enums.pitchSide).sort()).toEqual([...PITCH_SIDES].sort());
    expect(Object.keys(en.enums.pitchSide).sort()).toEqual([...PITCH_SIDES].sort());
  });

  it("resolves every Domain F label in both locales", () => {
    for (const locale of locales) {
      for (const code of FREE_KICK_TYPES) {
        const label = t(freeKickTypeKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.freeKick");
      }
      for (const code of CORNER_DELIVERY_TYPES) {
        const label = t(cornerDeliveryTypeKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.cornerDeliveryType");
      }
      for (const code of CORNER_DELIVERY_STYLES) {
        const label = t(cornerDeliveryStyleKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.cornerDeliveryStyle");
      }
      for (const code of PITCH_SIDES) {
        const label = t(pitchSideKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.pitchSide");
      }
    }
  });

  /*
   * The four free-kick labels must STAND ALONE, because they render as flat
   * siblings with no containment cue (ruled decision 6). "Al arco" on its own
   * would read as a column header rather than a free-kick outcome, so each
   * Spanish label carries its own qualifier.
   */
  it("gives each free-kick label a self-standing Spanish form", () => {
    expect(t(freeKickTypeKey("direct-on-target"), "es")).toBe("Directo al arco");
    expect(t(freeKickTypeKey("direct-off-target"), "es")).toBe("Directo desviado");
  });
});

describe("Story 2.10's Domain E enums (AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per Domain E value", () => {
    const pairs: [Record<string, string>, Record<string, string>, readonly string[]][] = [
      [es.enums.distributionType, en.enums.distributionType, DISTRIBUTION_TYPES],
      [es.enums.feetTechnique, en.enums.feetTechnique, FEET_TECHNIQUES],
      [es.enums.handsTechnique, en.enums.handsTechnique, HANDS_TECHNIQUES],
      [es.enums.throwTechnique, en.enums.throwTechnique, THROW_TECHNIQUES],
      [es.enums.interventionType, en.enums.interventionType, INTERVENTION_TYPES],
      [es.enums.interventionBodyType, en.enums.interventionBodyType, INTERVENTION_BODY_TYPES],
      [es.enums.aerialType, en.enums.aerialType, AERIAL_TYPES],
    ];
    for (const [spanish, english, codes] of pairs) {
      expect(Object.keys(spanish).sort()).toEqual([...codes].sort());
      expect(Object.keys(english).sort()).toEqual([...codes].sort());
    }
  });

  it("resolves every Domain E label in both locales", () => {
    for (const locale of locales) {
      for (const code of DISTRIBUTION_TYPES) {
        expect(t(distributionTypeKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
      for (const code of FEET_TECHNIQUES) {
        const label = t(feetTechniqueKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.feetTechnique");
      }
      for (const code of HANDS_TECHNIQUES) {
        expect(t(handsTechniqueKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
      for (const code of THROW_TECHNIQUES) {
        expect(t(throwTechniqueKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
      for (const code of INTERVENTION_TYPES) {
        const label = t(interventionTypeKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.interventionType");
      }
      for (const code of INTERVENTION_BODY_TYPES) {
        expect(t(interventionBodyTypeKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
      for (const code of AERIAL_TYPES) {
        expect(t(aerialTypeKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
    }
  });

  /*
   * The LatAm register is the ruled one (UX-DR19), and review-i18n.md:26
   * recorded that the WHOLE goalkeeping domain had zero terminology coverage
   * before this story. "arquero" and "atajada" carry it.
   */
  it("uses the ruled LatAm register for the goalkeeping vocabulary", () => {
    expect(t("tactical.sections.goalkeeping.title", "es")).toBe("Arqueros");
    expect(t("viz.goalkeeping.keeperOne", "es")).toBe("Arquero");
    expect(t(interventionTypeKey("save-and-retain"), "es")).toContain("Atajada");
    expect(t("viz.goalkeeping.savePercentage", "es")).toContain("atajadas");
  });

  /*
   * CrossDeliveryType is REUSED from Story 2.7 for aerialControl's
   * deliveryTypesFaced rather than a second namespace being minted — one
   * vocabulary, one source of truth.
   */
  it("does not mint a second cross-delivery namespace", () => {
    expect(Object.keys(es.enums)).not.toContain("aerialCrossDelivery");
    for (const code of CROSS_DELIVERY_TYPES) {
      expect(t(crossDeliveryKey(code), "es")).not.toBe("");
    }
  });
});

/*
 * Story 2.9 ruled decision 4: the two receiving sections must NOT ship the
 * generic empty-state explanation. Their absence trigger is `bundle.players ===
 * null` — a Domain G absence, not a receiving-section absence — so
 * "El informe oficial no incluye esta sección." would be a false statement.
 */
describe("the receiving empty-state override (ruled decision 4)", () => {
  it("differs from the generic copy in BOTH halves and BOTH locales", () => {
    for (const locale of ["es", "en"] as Locale[]) {
      /*
       * REVIEW PATCH: this compared the override against
       * `tactical.empty.headlineBefore` — a FRAGMENT ("Sin datos de") that
       * `EmptyStatePanel` composes with the section title. A full sentence is
       * trivially unequal to a fragment, so the assertion passed no matter
       * what, and would still have passed if the override had been set to the
       * composed generic headline — which is the exact regression ruled
       * decision 4 exists to prevent. Compare against the COMPOSED string, for
       * both receiving sections.
       */
      const composedGeneric = (title: string) =>
        `${t("tactical.empty.headlineBefore", locale)} ${title} ${t("tactical.empty.headlineAfter", locale)}`;
      for (const id of ["offers-to-receive", "movement-to-receive"] as const) {
        expect(t("tactical.empty.receivingHeadline", locale)).not.toBe(
          composedGeneric(t(sectionTitleKey(id), locale))
        );
      }
      expect(t("tactical.empty.receivingHeadline", locale)).not.toBe(
        t("tactical.empty.headlineBefore", locale)
      );
      expect(t("tactical.empty.receivingExplanation", locale)).not.toBe(
        t("tactical.empty.explanation", locale)
      );
    }
  });

  it("names the per-player data rather than the section", () => {
    expect(es.tactical.empty.receivingExplanation).toMatch(/jugador/);
    expect(en.tactical.empty.receivingExplanation).toMatch(/per-player/);
  });
});

describe("the sortable data-table keys (Story 2.11a, UX-DR12)", () => {
  /*
   * Every key the shared DataTable and its announcer resolve, in BOTH locales,
   * on the shipped template. The harness has no jsdom, so this is the only
   * place the sort surface's strings can be proved to exist at all.
   */
  const SORT_KEYS = [
    "viz.table.sortAction",
    "viz.table.sortedBy",
    "viz.table.sortAscending",
    "viz.table.sortDescending",
    "viz.table.sortCleared",
  ] as const;

  it("resolves in both locales", () => {
    for (const locale of ["es", "en"] as Locale[]) {
      for (const key of SORT_KEYS) {
        const value = t(key, locale);
        expect(value, `${key} (${locale})`).not.toBe("");
        // t() returns the key itself when a leaf is missing.
        expect(value, `${key} (${locale})`).not.toBe(key);
      }
    }
  });

  it("keeps the two direction words distinct in both locales", () => {
    for (const locale of ["es", "en"] as Locale[]) {
      expect(t("viz.table.sortAscending", locale)).not.toBe(
        t("viz.table.sortDescending", locale)
      );
    }
  });

  it("composes an accessible name that CONTAINS the visible head text", () => {
    /*
     * WCAG 2.5.3 Label in Name: the header button's visible text is the column
     * head, and its accessible name is `${sortAction} ${headText}`. This pins
     * the composition order — a name of "Minuto Ordenar por" would still
     * contain the head but reads as broken Spanish, and a name that REPLACED
     * the head would break 2.5.3 outright.
     */
    const headText = es.viz.table.minute;
    const accessibleName = `${es.viz.table.sortAction} ${headText}`;
    expect(accessibleName).toBe("Ordenar por Minuto");
    expect(accessibleName).toContain(headText);
    expect(accessibleName.startsWith(es.viz.table.sortAction)).toBe(true);
  });

  it("states the cleared order as a sentence naming no column (decision 5)", () => {
    // The third state of the cycle is "no column active", so the announcement
    // cannot name one. It must still be a complete sentence.
    for (const dictionary of [es, en]) {
      expect(dictionary.viz.table.sortCleared.endsWith(".")).toBe(true);
    }
    expect(es.viz.table.sortCleared).not.toContain(es.viz.table.sortedBy);
  });
});

/*
 * ==================== STORY 2.18 — THE TERMINOLOGY GATE ====================
 *
 * THE GUARDS THAT MAKE THIS STORY STICK. Ten stories shipped ~417 locale leaves
 * ahead of 2.18 under the honour system, and NOTHING in the build chain had ever
 * compared a shipped Spanish string to EXPERIENCE.md's per-term policy table.
 * The audit that opened this story found one hard register violation, one
 * peninsular survivor and two policy rows the shipped app contradicted. These
 * suites are what stop the next story re-breaking any of it.
 */

/** Every string leaf of a dictionary, as `dot.path` → value pairs. */
function stringLeaves(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") {
    return [[prefix, node]];
  }
  if (typeof node === "object" && node !== null) {
    return Object.entries(node).flatMap(([key, value]) =>
      stringLeaves(value, prefix ? `${prefix}.${key}` : key)
    );
  }
  throw new Error(`unexpected dictionary leaf at "${prefix}"`);
}

describe("key-builder resolution sweep (Story 2.18 Task 9.1a)", () => {
  const locales: Locale[] = ["es", "en"];

  /*
   * THIS IS WHAT DISCHARGES AC 1's "no raw-key fallthrough", and it is a
   * different risk from the leaf-level sweeps below. Every key builder in the
   * repo ends in `as DictionaryKey`, because DictionaryKey is a literal union
   * and a template-literal expression infers `string`. The cast silences the
   * compiler — so a builder pointing at a path that DOES NOT EXIST is invisible
   * to tsc, and no sweep over the dictionary's own leaves can see it either:
   * the leaves are all fine, it is the ADDRESS that is wrong. Only resolving
   * every builder over its full id domain catches it.
   *
   * t() throws on an unresolvable key outside production, so a bad cast fails
   * here loudly rather than rendering a raw dot path to a reader.
   */
  it("resolves every glossary key builder over every term, in both locales", () => {
    expect(GLOSSARY_TERMS.length).toBeGreaterThan(0);
    for (const id of GLOSSARY_TERMS) {
      for (const locale of locales) {
        for (const key of [
          glossaryTermEsKey(id),
          glossaryTermEnKey(id),
          glossaryDefinitionKey(id),
        ]) {
          const value = t(key, locale);
          expect(value, `${key} in ${locale}`).not.toBe("");
          expect(value, `${key} in ${locale}`).not.toBe(key);
          expect(value, `${key} in ${locale}`).not.toContain("glossary.");
        }
      }
    }
  });

  it("resolves every section title and summary key, in both locales", () => {
    for (const locale of locales) {
      for (const id of SECTION_IDS) {
        const value = t(sectionTitleKey(id), locale);
        expect(value, `${id} title in ${locale}`).not.toBe("");
        expect(value, `${id} title in ${locale}`).not.toContain("tactical.sections");
      }
      for (const id of COLLAPSIBLE_SECTION_IDS) {
        const value = t(sectionSummaryKey(id), locale);
        expect(value, `${id} summary in ${locale}`).not.toBe("");
        expect(value, `${id} summary in ${locale}`).not.toContain("tactical.sections");
      }
    }
  });
});

describe("forbidden-register sweep (Story 2.18 Task 9.1b)", () => {
  /*
   * Walks the EXPORTED es OBJECT's string leaves, never the file text.
   * Comments legitimately name the forbidden forms in order to reject them —
   * es.ts's own enums docblock contains "balón parado · tiro de esquina ·
   * arquero · atajada" — so a text-level grep would be red on correct code.
   *
   * Case-insensitive because the live violation was a capital-C "Córners".
   * Note "a puerta" was never a standalone hit: it hid inside
   * viz.momentum.ownGoal's "en propia puerta", which is why this sweep could
   * only go green after Task 8.2.
   */
  /*
   * LEADING-ANCHORED (2.18 code review). This was an unanchored substring
   * match, so any future legitimate string containing a forbidden form INSIDE a
   * longer word turned the build red with a register violation it did not
   * commit — "disparada", "comparada" and "preparada" all contain "parada", and
   * the only escape was the whole-namespace glossary exemption. `\b` does not
   * work against accented Spanish in JS RegExp, so the boundary is spelled with
   * a Unicode lookbehind: not preceded by a letter or digit.
   *
   * DELIBERATELY LEADING-ONLY — a trailing boundary would silently disarm the
   * sweep. "clasificaci" is a PREFIX (it must still catch "clasificación" and
   * "clasificatoria"), and the live violation this story remediated was the
   * PLURAL "Córners"; a trailing `(?![\p{L}\p{N}])` makes both unmatchable, so
   * the test would pass by never firing.
   *
   * "a puerta" is now plain "puerta": the goal-frame noun is peninsular
   * wherever it appears (the app says "arco" everywhere), and anchoring the old
   * two-word form on its leading "a" would have stopped catching "en propia
   * puerta" — the exact string Task 8.2 had to remediate.
   *
   * [¡!] sits OUTSIDE the anchor — punctuation has no word boundary and is
   * banned wherever it appears.
   */
  const FORBIDDEN =
    /(?<![\p{L}\p{N}])(?:portero|parada|puerta|fuera de juego|clasificaci|chute|córner|vosotros|usted)|[¡!]/iu;

  /*
   * The glossary DEFINITIONS are exempt, and the exemption is the point rather
   * than a loophole: they legitimately name rejected and peninsular forms in
   * order to explain them. Row 30 ("córner is the form the site does not use"),
   * row 31 ("fuera de juego is the peninsular form") and the shot-outcome row's
   * rejected "a puerta" all appear there on purpose. The `es`/`en` TERM leaves
   * are NOT exempt.
   */
  const isExempt = (path: string) => /^glossary\.[^.]+\.definition$/.test(path);

  it("finds no forbidden register in any non-exempt es leaf", () => {
    const offenders = stringLeaves(es)
      .filter(([path]) => !isExempt(path))
      .filter(([, value]) => FORBIDDEN.test(value))
      .map(([path, value]) => `${path} = ${JSON.stringify(value)}`);
    expect(offenders).toEqual([]);
  });

  it("keeps the exemption honest — the definitions really do carry the rejected forms", () => {
    // A vacuous exemption is worse than none: if these ever stop matching, the
    // exemption is dead weight and should be deleted rather than kept.
    expect(es.glossary.corner.definition).toMatch(/córner/i);
    expect(es.glossary.offside.definition).toMatch(/fuera de juego/i);
    expect(es.glossary["on-target"].definition).toMatch(/a puerta/i);
  });

  it("does NOT flag 'balón parado' — parado is not parada", () => {
    expect(FORBIDDEN.test(es.tactical.sections["set-plays"].title)).toBe(false);
    expect(FORBIDDEN.test(es.viz.setPlays.figurePrefix)).toBe(false);
    expect(es.tactical.sections["set-plays"].title).toBe("Balón parado");
  });
});

/*
 * THE MARKS MUST STILL LAND — added by the 2.18 code review, and it is the
 * guard the marking mechanism was missing.
 *
 * markHeading/markSummary resolve the ruled term out of the dictionary and look
 * for it in the ALREADY-RESOLVED title or summary. A miss degrades SILENTLY to
 * unmarked text — deliberately, because a reworded summary is a copy change and
 * not a crash. The cost of that choice is that a copy edit can delete a
 * section's only glossary affordance with the whole suite green: the sole pin
 * was matches/static-output.test.ts's `expect(marked).toEqual(["momentum"])`,
 * which exercises headingMark alone, so all four SUMMARY marks were asserted in
 * neither locale. `set-plays` is the sharpest case — its ruled term is the
 * singular "tiro de esquina" against a summary reading "Tiros de esquina", so
 * it resolves only through findTermSpan's plural fallback, the most fragile
 * path in the function.
 *
 * This walks the real registry against the real dictionaries in BOTH locales,
 * so it cannot drift from what the renderer does.
 */
describe("every configured section mark resolves in both locales (Story 2.18)", () => {
  const locales: Locale[] = ["es", "en"];

  it("resolves every HEADING mark", () => {
    for (const [id, mark] of Object.entries(SECTION_HEADING_MARKS)) {
      for (const locale of locales) {
        const title = t(sectionTitleKey(id as SectionId), locale);
        const term = t(
          locale === "es" ? glossaryTermEsKey(mark.id) : glossaryTermEnKey(mark.id),
          locale
        );
        expect(findTermSpan(title, term), `${id} heading / ${locale}: "${term}" in "${title}"`)
          .not.toBeNull();
      }
    }
  });

  it("resolves every SUMMARY mark", () => {
    for (const [id, mark] of Object.entries(SECTION_SUMMARY_MARKS)) {
      for (const locale of locales) {
        const summary = t(sectionSummaryKey(id as CollapsibleSectionId), locale);
        const term = t(
          locale === "es" ? glossaryTermEsKey(mark.id) : glossaryTermEnKey(mark.id),
          locale
        );
        expect(findTermSpan(summary, term), `${id} summary / ${locale}: "${term}" in "${summary}"`)
          .not.toBeNull();
      }
    }
  });

  it("is not vacuous — the registry actually configures marks", () => {
    // If a future edit empties either map, the two loops above pass trivially.
    const configured =
      Object.keys(SECTION_HEADING_MARKS).length + Object.keys(SECTION_SUMMARY_MARKS).length;
    expect(configured).toBeGreaterThan(0);
  });
});

describe("ruled-term pins (Story 2.18 Task 9.1c)", () => {
  /*
   * Six pins, each a policy row a prior story broke or nearly broke. Nothing
   * else in the build chain enforces a single ruled string.
   */
  it("row 30 — the set-plays summary uses tiro de esquina, not córner or laterales", () => {
    const summary = es.tactical.sections["set-plays"].summary;
    expect(summary).toContain("iro");
    expect(summary).toContain("esquina");
    expect(summary).not.toContain("órner");
    expect(summary).not.toContain("laterales");
  });

  it("row 30 — viz.setPlays.corners is the ruled plural", () => {
    expect(es.viz.setPlays.corners).toBe("Tiros de esquina");
  });

  it("row 38 — the possession vocabulary is the RULED form, not the rejected one", () => {
    expect(es.viz.phases.inPossession).toBe("En posesión");
    expect(es.viz.phases.outOfPossession).toBe("Sin posesión");
    // The four compound metric labels keep their metric name (decision 4).
    expect(es.viz.pressing.metre.lineHeight.inPossession).toBe("Altura de la línea en posesión");
    expect(es.viz.pressing.metre.teamLength.outOfPossession).toBe(
      "Longitud del equipo sin posesión"
    );
  });

  it("the peninsular goal-frame noun is gone — the app says arco, never puerta", () => {
    expect(es.viz.momentum.ownGoal).not.toContain("puerta");
    expect(es.viz.momentum.ownGoal).toBe("en contra");
  });

  it("rows 3 and 23 — the ruled section labels are byte-exact", () => {
    expect(es.tactical.sections.pressing.title).toBe("Presión y bloques defensivos");
    expect(es.tactical.sections.goalkeeping.title).toBe("Arqueros");
  });

  it("decision 1 — /about and the glossary make ONE xG claim, not two", () => {
    /*
     * FD-1: per-shot xG does not exist in the source PDFs at all (team totals
     * only), which is why every marker is drawn at the same size. Both surfaces
     * must say so; a reader who finds them disagreeing learns nothing.
     */
    for (const dictionary of [es, en]) {
      expect(dictionary.about.methodology).toMatch(/xG/);
      expect(dictionary.glossary.xg.definition).toMatch(/xG|Expected goals|Goles esperados/);
    }
    expect(es.about.methodology).toContain("no hay un valor por remate");
    expect(es.glossary.xg.definition).toContain("no un valor por remate");
    expect(en.about.methodology).toContain("there is no per-shot value");
    expect(en.glossary.xg.definition).toContain("not a per-shot value");
  });

  it("decision 5 — the momentum gloss refuses the dominance reading", () => {
    // Story 1.8 closed OQ-5: the series is final-third entries per minute. The
    // policy table's original tooltip ("qué equipo domina en cada tramo") was
    // factually false, and viz.momentum's docblock forbids implying it.
    expect(es.glossary.momentum.definition).toContain("no mide dominio");
    expect(en.glossary.momentum.definition).toContain("does not measure dominance");
    expect(es.glossary.momentum.definition).not.toContain("impulso");
  });

  it("decision 3 — the offers/movements relationship ships in the SECTION, not only the glossary", () => {
    // A glossary popover is a hover-away affordance; the summary is what the
    // collapsed shell, the anchor and the panelTitle all show.
    expect(es.tactical.sections["movement-to-receive"].summary).toContain("ofrecimientos");
    expect(en.tactical.sections["movement-to-receive"].summary).toContain("offers");
  });

  it("Task 8.10 — the Hero tile labels no longer bake in their unit (AD-7)", () => {
    for (const dictionary of [es, en]) {
      expect(dictionary.match.hero.tiles.distance).not.toContain("(");
      expect(dictionary.match.hero.tiles.topSpeed).not.toContain("(");
    }
    expect(t("enums.unit.kmh", "es")).toBe("km/h");
    expect(t("enums.unit.kmh", "en")).toBe("km/h");
  });

  it("Task 8.9 — one delivery shape has ONE name per language", () => {
    expect(en.enums.cornerDeliveryStyle.inswing).toBe(en.enums.crossDelivery.inswing);
    expect(en.enums.cornerDeliveryStyle.outswing).toBe(en.enums.crossDelivery.outswing);
    expect(es.enums.cornerDeliveryStyle.inswing).toBe(es.enums.crossDelivery.inswing);
  });
});

describe("glossary exhaustiveness (Story 2.18 Task 9.4)", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per GlossaryTermId, with NO allowance", () => {
    /*
     * Exact, in both dictionaries. This is why the /glossary page's chrome
     * lives in a separate `glossaryPage` namespace: a page-chrome key in here
     * would have to be exempted by hand, and the first exemption is how an
     * exhaustiveness assertion stops being one.
     *
     * The list is IMPORTED, never hand-copied — the 2.9 review's
     * PossessionContestType finding: a hand-copied list means a widened union
     * needs two files edited to be caught, and the loops below simply never
     * visit the new id.
     */
    expect(Object.keys(es.glossary).sort()).toEqual([...GLOSSARY_TERMS].sort());
    expect(Object.keys(en.glossary).sort()).toEqual([...GLOSSARY_TERMS].sort());
  });

  it("gives every term a non-empty, non-key label in both locales", () => {
    for (const id of GLOSSARY_TERMS) {
      for (const locale of locales) {
        for (const key of [
          glossaryTermEsKey(id),
          glossaryTermEnKey(id),
          glossaryDefinitionKey(id),
        ]) {
          const value = t(key, locale);
          expect(value.trim(), `${key} in ${locale}`).not.toBe("");
          expect(value, `${key} in ${locale}`).not.toBe(key);
        }
      }
    }
  });

  it("keeps the TERM PAIR locale-invariant — only the definition is translated", () => {
    /*
     * AC 2 and EXPERIENCE's Component-Patterns rule both require both languages
     * to render SIMULTANEOUSLY in one locale's page ("salida de balón — en:
     * build-up"), so es.glossary.<id>.es and en.glossary.<id>.es must hold the
     * same bytes. Without this pin, a later reader "fixes" the apparently
     * untranslated en mirror and silently deletes Diego's bridge.
     */
    for (const id of GLOSSARY_TERMS) {
      expect(en.glossary[id].es, `${id}.es`).toBe(es.glossary[id].es);
      expect(en.glossary[id].en, `${id}.en`).toBe(es.glossary[id].en);
    }
  });

  it("actually translates the definitions — no Spanish left in an en leaf", () => {
    // `en: Dictionary` guards key SHAPE only and would happily accept a Spanish
    // string in an en leaf, so shape-mirroring proves nothing about content.
    let differing = 0;
    for (const id of GLOSSARY_TERMS) {
      if (en.glossary[id].definition !== es.glossary[id].definition) {
        differing += 1;
      }
    }
    expect(differing).toBe(GLOSSARY_TERMS.length);
  });

  it("suppresses the counterpart subtitle exactly where the two terms are identical", () => {
    // Ruled decision 13. These three are the jargon/tooltip rows; every other
    // term must differ, or its subtitle would be a tautology.
    const identical = GLOSSARY_TERMS.filter((id) => es.glossary[id].es === es.glossary[id].en);
    expect([...identical].sort()).toEqual(["momentum", "sprint", "xg"]);
  });

  it("resolves the /glossary page chrome in both locales", () => {
    for (const locale of locales) {
      for (const key of [
        "glossaryPage.title",
        "glossaryPage.intro",
        "glossaryPage.seeMore",
        "glossaryPage.jargonNote",
        "glossaryPage.authoredNote",
        "glossaryPage.esPrefix",
        "glossaryPage.enPrefix",
      ] as const) {
        const value = t(key, locale);
        expect(value, `${key} in ${locale}`).not.toBe("");
        expect(value, `${key} in ${locale}`).not.toBe(key);
      }
    }
    // The language-code prefixes name the OTHER language, so they do not swap.
    expect(en.glossaryPage.esPrefix).toBe(es.glossaryPage.esPrefix);
    expect(en.glossaryPage.enPrefix).toBe(es.glossaryPage.enPrefix);
  });

  it("still mints NO ShotOutcomeDetail namespace (decision 12 — CS-1 has not landed)", () => {
    // The 2.7 tripwires, re-asserted from this story's side: 2.18 maps the
    // stable five-value ShotOutcome only, and both must be deleted DELIBERATELY
    // when detail labels ship.
    expect(Object.keys(es.enums)).not.toContain("shotOutcomeDetail");
    expect(Object.keys(es.enums.shotOutcome)).toHaveLength(5);
  });
});

describe("the per-section crash copy (Story 2.18 decision 7)", () => {
  it("does NOT reuse the bundle-level crash strings", () => {
    /*
     * match.bundle.crashed names a BUNDLE-level failure ("el análisis táctico
     * de este partido"). A bundle-wide fault surfacing as "this section" is a
     * narrower and possibly false claim; a section-level fault claiming the
     * whole analysis is gone is false the other way.
     */
    for (const dictionary of [es, en]) {
      expect(dictionary.tactical.empty.sectionCrashed).not.toBe(dictionary.match.bundle.crashed);
      expect(dictionary.tactical.empty.sectionCrashedExplanation).not.toBe(
        dictionary.match.bundle.crashedExplanation
      );
    }
  });

  it("never claims the REPORT lacks the section (the FR-22 inversion)", () => {
    // An app-side failure stated as one. The generic empty-state explanation —
    // "El informe oficial no incluye esta sección." — would be a false
    // statement over a render crash.
    for (const dictionary of [es, en]) {
      expect(dictionary.tactical.empty.sectionCrashedExplanation).not.toBe(
        dictionary.tactical.empty.explanation
      );
    }
    expect(es.tactical.empty.sectionCrashedExplanation).not.toContain("informe");
    expect(en.tactical.empty.sectionCrashedExplanation).not.toContain("report");
  });
});

describe("the expert.* namespace (Story 2.11b, AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  /*
   * THE MANDATORY SWEEP. `expertFieldKey` ends in an `as DictionaryKey` cast —
   * DictionaryKey is a literal union and a template-literal expression infers
   * `string` — so tsc is defeated by construction and this round-trip over the
   * builder's FULL DOMAIN is the only thing between a typo'd key and a runtime
   * miss. Both locales, because `en` is a separate object.
   */
  it("resolves all 40 column heads in both locales", () => {
    expect(EXPERT_FIELDS).toHaveLength(40);
    for (const field of EXPERT_FIELDS) {
      for (const locale of locales) {
        const label = t(expertFieldKey(field), locale);
        expect(label, `${field} in ${locale}`).not.toBe("");
        expect(label, `${field} in ${locale}`).not.toContain("expert.field");
      }
    }
  });

  it("resolves the full term behind every abbreviated head", () => {
    const titled = EXPERT_FIELDS.map(expertFieldTitleKey).filter((key) => key !== null);
    // Five zone bands + highSpeedRuns + topSpeed (the last added by the 2.11b
    // code review, which abbreviated the ES head to the ruled "Vel. máx.").
    expect(titled).toHaveLength(7);
    for (const key of titled) {
      for (const locale of locales) {
        expect(t(key, locale), `${key} in ${locale}`).not.toBe("");
      }
    }
  });

  it("reuses the ruled Vel. máx. abbreviation for the topSpeed head", () => {
    /*
     * 2.11b CODE REVIEW. The head shipped as "Velocidad máxima", the widest in
     * the physical group, while `enums.metric.topSpeed` already carried the
     * ruled abbreviation and EXPERIENCE.md:139 names this exact term as the
     * table-abbreviation precedent. Pinned to the SAME string as the existing
     * ruled copy, so a second mint cannot drift in beside it. The existing
     * entry lives on the Hero's stat tiles, NOT under enums.metric — Story
     * 2.18 records why (`topSpeed` is absent from KEY_STAT_FIELDS, so an
     * enums.metric entry turns the "one per Key Statistics field" assertion
     * red). Same ruled string, different namespace, and this pins them equal.
     */
    expect(es.expert.field.topSpeed).toBe(es.match.hero.tiles.topSpeed);
    expect(es.expert.fieldTitle.topSpeed).toBe("Velocidad máxima");
  });

  it("ships no invented English abbreviation for high-speed runs", () => {
    /*
     * 2.11b CODE REVIEW. "HIGH-SPD RUNS" was a mint with no glossary entry, no
     * ruling and no record in the Completion Notes — unlike its Spanish
     * counterpart, which the glossary rules verbatim. Nothing else in the EN
     * block is abbreviated, so it was retired rather than recorded.
     */
    expect(en.expert.field.highSpeedRuns).toBe("High-speed runs");
    expect(en.expert.field.highSpeedRuns).not.toContain("SPD");
  });

  it("states a default order that is true in BOTH layouts", () => {
    /*
     * 2.11b CODE REVIEW. The caption is this table's accessible name and its
     * one durable statement of canonical order (2.11a decision 7 forbids it
     * mutating). "equipo LOCAL y dorsal" was false below md, where the rows are
     * filtered to one side — with the away team selected no home-team ordering
     * is observable at all.
     */
    expect(es.expert.tableCaption).not.toContain("local");
    expect(en.expert.tableCaption).not.toContain("home");
    for (const dictionary of [es, en]) {
      expect(dictionary.expert.tableCaption).not.toBe("");
    }
  });

  it("distinguishes an absent Domain G from a present one with no rows", () => {
    /*
     * 2.11b CODE REVIEW. `players: []` used to fall through the null gate and
     * render 50 sortable headers over an empty body with no explanation — and
     * the contract states verbatim that "Empty array and null are distinct
     * states". `expert.empty.*` cannot serve it: it says the report does not
     * include the per-player pages, which is false when the pages are there.
     */
    for (const dictionary of [es, en]) {
      expect(dictionary.expert.emptyRows.headline).not.toBe(dictionary.expert.empty.headline);
      expect(dictionary.expert.emptyRows.explanation).not.toBe(
        dictionary.expert.empty.explanation
      );
      expect(dictionary.expert.emptyRows.headline).not.toBe("");
      expect(dictionary.expert.emptyRows.explanation).not.toBe("");
    }
  });

  it("ships the ruled table abbreviation for high-speed runs", () => {
    // The glossary definition states it as ruled copy: "En las tablas la
    // columna se abrevia CARR. ALTA VEL." A head that quietly stopped using it
    // would contradict a definition the same page renders.
    expect(es.expert.field.highSpeedRuns).toBe("CARR. ALTA VEL.");
    expect(es.glossary["high-speed-run"].definition).toContain("CARR. ALTA VEL.");
  });

  it("reuses the ruled glossary Spanish rather than minting a second form", () => {
    expect(es.expert.field.takeOns).toContain("Regate");
    expect(es.expert.field.stepIns).toContain("Irrupci");
    expect(es.expert.field.lineBreaksAttempted).toContain("Rupturas de líneas");
    expect(es.expert.field.ballProgressions).toBe(es.enums.metric.ballProgressions);
  });

  it("keeps the three group labels resolvable and distinct", () => {
    for (const locale of locales) {
      const labels = [
        t("expert.group.inPossession", locale),
        t("expert.group.outOfPossession", locale),
        t("expert.group.physical", locale),
      ];
      for (const label of labels) {
        expect(label, locale).not.toBe("");
      }
      expect(new Set(labels).size, locale).toBe(3);
    }
  });

  it("uses the RULED group labels, not the rejected broadcast form", () => {
    // EXPERIENCE.md:276 rules "En posesión / Sin posesión / Físico". Story 2.18
    // decision 4 already moved the app off "Con balón / Sin balón"; this is the
    // pin that keeps a new namespace from reintroducing it.
    expect(es.expert.group.inPossession).toBe("En posesión");
    expect(es.expert.group.outOfPossession).toBe("Sin posesión");
    expect(es.expert.group.physical).toBe("Físico");
  });

  it("resolves the six movement columns through enums.offerMovement", () => {
    // The Expert table's six offersByMovementType columns mint NO keys of
    // their own — a seventh entry in that namespace would turn the
    // OFFER_MOVEMENT_TYPES pin above red.
    for (const code of OFFER_MOVEMENT_TYPES) {
      for (const locale of locales) {
        expect(t(offerMovementKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
    }
    expect(Object.keys(es.expert.field)).not.toContain("offersByMovementType");
  });

  it("keeps Domain G OUT of enums.metric", () => {
    /*
     * The regression this namespace exists to avoid: enums.metric is pinned
     * key-for-key to KEY_STAT_FIELDS (19 Domain B fields), so parking one
     * per-player label there would turn a green test red — and the two
     * namespaces genuinely describe different quantities.
     */
    expect(Object.keys(es.enums.metric).sort()).toEqual([...KEY_STAT_FIELDS].sort());
    for (const field of EXPERT_FIELDS) {
      if (!(KEY_STAT_FIELDS as readonly string[]).includes(field)) {
        expect(Object.keys(es.enums.metric)).not.toContain(field);
      }
    }
  });

  it("gives the Expert crash its own copy, distinct from the Tactical pair", () => {
    /*
     * Ruled decision 1. match.bundle.crashed says "el análisis táctico de este
     * partido" — a FALSE statement over an Expert crash while eleven healthy
     * Tactical sections render above it, and false the other way round too.
     */
    for (const dictionary of [es, en]) {
      expect(dictionary.match.bundle.crashedExpert).not.toBe(dictionary.match.bundle.crashed);
      expect(dictionary.match.bundle.crashedExpertExplanation).not.toBe(
        dictionary.match.bundle.crashedExplanation
      );
      expect(dictionary.match.bundle.crashedExpert).not.toBe(
        dictionary.tactical.empty.sectionCrashed
      );
    }
    /*
     * 2.11b CODE REVIEW. The explanation used to assert the Tactical Layer was
     * healthy — which this boundary cannot know. Both boundaries are siblings
     * over the SAME bundle and the expected throw source is @/lib/format on a
     * non-finite numeric, a fault class that can throw in both; the fallbacks
     * then stack and the lower one states the upper one is fine. It must name
     * no sibling it cannot observe.
     */
    expect(es.match.bundle.crashedExpertExplanation).not.toContain("táctico");
    expect(en.match.bundle.crashedExpertExplanation).not.toContain("tactical");
  });

  it("names the logs in the summary now that 2.11c has shipped them", () => {
    /*
     * INVERTED BY STORY 2.11c, which is what this pin was waiting for. 2.11b
     * shipped the tables-only form deliberately, because "registros completos"
     * named content the reader could not find; the logs block IS that content,
     * so the leaf is now the mobile mockup's copy verbatim in both locales.
     */
    expect(es.expert.summary).toBe(
      "En posesión · Sin posesión · Físico — tablas por jugador y registros completos"
    );
    expect(en.expert.summary).toBe(
      "In possession · Out of possession · Physical — per-player tables and full event logs"
    );
    // Lower-cased on both sides: the heading is sentence-capitalised, the
    // summary carries the same words mid-sentence.
    expect(es.expert.summary.toLowerCase()).toContain(es.expert.logs.heading.toLowerCase());
    expect(en.expert.summary.toLowerCase()).toContain(en.expert.logs.heading.toLowerCase());
  });
});

/*
 * ------------------- STORY 2.11c — THE FULL EVENT LOGS BLOCK -------------------
 *
 * Tasks 4.4 / 4.4a / 4.4b. Three of these guard failure modes that NOTHING else
 * in the chain can see: a typo'd fragment (sectionIdFromHash is exact-match and
 * returns null SILENTLY), a link label that duplicates the section title it is
 * composed against (the hint would print the same phrase twice on one line), and
 * a fourth table resolving the same caption string as three shipped ones.
 */
describe("Story 2.11c's receiving log and log links", () => {
  const locales: Locale[] = ["es", "en"];

  it("has exactly one entry per ReceivingEventType value, in both locales", () => {
    // The list is IMPORTED from the model that owns it, never hand-copied here
    // — the 2.9 review patched exactly that mistake.
    expect(Object.keys(es.enums.receivingEventType).sort()).toEqual(
      [...RECEIVING_EVENT_TYPES].sort()
    );
    expect(Object.keys(en.enums.receivingEventType).sort()).toEqual(
      [...RECEIVING_EVENT_TYPES].sort()
    );
  });

  it("resolves every discriminator label in both locales", () => {
    for (const code of RECEIVING_EVENT_TYPES) {
      for (const locale of locales) {
        const label = t(receivingEventTypeKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label).not.toContain("enums.receivingEventType");
      }
    }
  });

  it("resolves the movement column through enums.offerMovement, minting no second set", () => {
    // The log's movementType column reuses the shipped labels via
    // `offerMovementKey`; a seventh set would turn the OFFER_MOVEMENT_TYPES pin
    // above red.
    expect(Object.keys(es.enums.receivingEventType)).not.toContain("in-front");
    for (const code of OFFER_MOVEMENT_TYPES) {
      for (const locale of locales) {
        expect(t(offerMovementKey(code), locale), `${code} in ${locale}`).not.toBe("");
      }
    }
  });

  it("keeps the receiving log's order string OUT of viz.table.caption's cluster", () => {
    /*
     * `viz.table.caption` is literally "Ordenado por minuto." and is resolved by
     * three tables already; AC 3 forbids a fourth consumer. The receiving log
     * states its REAL order — minute, then home before away.
     */
    for (const locale of locales) {
      expect(t("expert.logs.receivingOrder", locale), locale).not.toBe(
        t("viz.table.caption", locale)
      );
      expect(t("expert.logs.receivingOrder", locale), locale).not.toBe(
        t("expert.tableCaption", locale)
      );
    }
  });

  it("gives every one of the six links a label DISTINCT from its section title", () => {
    /*
     * Task 2.3's hand check, made permanent. The rendered hint is
     * `${section title} · Ver los datos` printed beside the label, so a label
     * equal to its own title prints the same phrase twice on one line. Two of
     * the six were byte-identical to their titles in a first draft
     * ("Ofrecimientos para recibir", "Desmarques"), which is why this exists.
     */
    expect(LOG_LINKS).toHaveLength(6);
    for (const link of LOG_LINKS) {
      for (const locale of locales) {
        const label = t(link.labelKey, locale);
        const title = t(link.titleKey, locale);
        expect(label, `${link.id} in ${locale}`).not.toBe("");
        expect(label, `${link.id} in ${locale}`).not.toBe(title);
      }
    }
  });

  it("keeps the six link labels distinct from each other, in both locales", () => {
    for (const locale of locales) {
      const labels = LOG_LINKS.map((link) => t(link.labelKey, locale));
      expect(new Set(labels).size, locale).toBe(LOG_LINKS.length);
    }
  });

  it("points every href at a real SectionId — the story's largest silent failure", () => {
    /*
     * TASK 4.4a, and the cheapest test in the story. A typo like
     * `#pass-network` yields a dead anchor that no type, no lint and no other
     * test catches, because `sectionIdFromHash` is whole-string equality against
     * the eleven SectionIds and returns `null` SILENTLY.
     */
    for (const link of LOG_LINKS) {
      expect(link.href.startsWith("#"), link.id).toBe(true);
      expect(SECTION_IDS as readonly string[], link.id).toContain(link.href.slice(1));
    }
  });

  it("makes the new caption distinct from all 27 shipped ones — COMPOSED, not by key", () => {
    /*
     * TASK 4.4b, AND THE REASON IT IS SPELLED OUT: a key-level test would go RED
     * ON A PRE-EXISTING CONDITION. Four es keys already resolve byte-identical
     * to "Ordenado por equipo y dorsal." — viz.table.captionNodes,
     * viz.offers.tableCaption, viz.movement.tableCaption and
     * expert.tableCaption (three in en, where expert.tableCaption diverges).
     * That is harmless because every rendered <caption> except
     * expert.tableCaption's is disambiguated by its `${title} — ` prefix, so the
     * property AC 3 actually claims is about the COMPOSED strings.
     *
     * This list mirrors each component's own composition, one entry per rendered
     * <DataTable>: 27 before this story, 28 after. `DefensiveActionsSection`'s
     * caption is conditional, so BOTH branches are listed and the count is
     * checked against the branch the fixtures take.
     */
    const SEPARATOR = " — ";
    const SPACE = " ";

    function composedCaptions(locale: Locale): string[] {
      const title = (key: Parameters<typeof t>[0]) => t(key, locale);
      const shotMaps = title("viz.shotMap.title");
      const crossMaps = title("viz.crossMap.title");
      const passNetwork = title("viz.passNetwork.title");
      const offers = title("viz.offers.title");
      const movement = title("viz.movement.title");
      const defensive = title("viz.defensiveActions.title");
      const momentum = title("tactical.sections.momentum.title");
      const phases = title("tactical.sections.phases.title");
      const pressing = title("tactical.sections.pressing.title");
      const setPlays = title("tactical.sections.set-plays.title");
      const goalkeeping = title("tactical.sections.goalkeeping.title");
      return [
        // ShotMapsSection (2)
        `${shotMaps}${SEPARATOR}${title("viz.table.caption")}`,
        `${crossMaps}${SEPARATOR}${title("viz.table.caption")}`,
        // PassNetworksSection (2)
        `${passNetwork}${SEPARATOR}${title("viz.table.captionNodes")}`,
        `${passNetwork}${SEPARATOR}${title("viz.table.captionEdges")}`,
        // OffersToReceiveSection (2)
        `${offers}${SEPARATOR}${title("viz.offers.totalsCaption")}`,
        `${offers}${SEPARATOR}${title("viz.offers.tableCaption")}`,
        // MovementToReceiveSection (2)
        `${movement}${SEPARATOR}${title("viz.movement.totalsCaption")}`,
        `${movement}${SEPARATOR}${title("viz.movement.tableCaption")}`,
        // DefensiveActionsSection (1) — the clocked branch the fixtures take.
        `${defensive}${SEPARATOR}${title("viz.table.caption")}`,
        // MomentumSection (1)
        `${momentum}${SEPARATOR}${title("viz.momentum.metricNote")}${SPACE}${title(
          "viz.momentum.tableCaption"
        )}`,
        // PhasesSection (2)
        `${phases}${SEPARATOR}${title("viz.phases.inPossession")}${SEPARATOR}${title(
          "viz.phases.tableCaption"
        )}`,
        `${phases}${SEPARATOR}${title("viz.phases.outOfPossession")}${SEPARATOR}${title(
          "viz.phases.tableCaption"
        )}`,
        // PressingSection (3)
        `${pressing}${SEPARATOR}${title("viz.pressing.pressRates")}${SEPARATOR}${title(
          "viz.pressing.tableCaption"
        )}`,
        `${pressing}${SEPARATOR}${title("viz.pressing.blocks")}${SEPARATOR}${title(
          "viz.pressing.tableCaption"
        )}`,
        `${pressing}${SEPARATOR}${title("viz.pressing.metreTableCaption")}`,
        // SetPlaysSection (4)
        `${setPlays}${SEPARATOR}${title("viz.setPlays.totalsCaption")}`,
        `${setPlays}${SEPARATOR}${title("viz.setPlays.freeKickCaption")}`,
        `${setPlays}${SEPARATOR}${title("viz.setPlays.cornerCaption")}`,
        `${setPlays}${SEPARATOR}${title("viz.setPlays.cornerTypeSideCaption")}`,
        // GoalkeepingSection (7)
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.summaryCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.timelineCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.preventionCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.distributionCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.aerialCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.headlineCaption")}`,
        `${goalkeeping}${SEPARATOR}${title("viz.goalkeeping.bodyTypeCaption")}`,
        // ExpertLayer's Domain G table (1) — the ONE unprefixed caption.
        title("expert.tableCaption"),
      ];
    }

    for (const locale of locales) {
      const shipped = composedCaptions(locale);
      expect(shipped, locale).toHaveLength(27);
      expect(new Set(shipped).size, `the 27 shipped captions in ${locale}`).toBe(27);

      const receiving = `${t("expert.logs.receivingHeading", locale)}${SEPARATOR}${t(
        "expert.logs.receivingOrder",
        locale
      )}`;
      expect(shipped, `the new caption in ${locale}`).not.toContain(receiving);
      expect(new Set([...shipped, receiving]).size, locale).toBe(28);
    }
  });

  it("keeps the receiving heading and the block heading distinct", () => {
    // The <h3> names the block, the <h4> names the one table inside it; the
    // table's caption is built from the <h4>'s string, so they must not collide.
    for (const locale of locales) {
      expect(t("expert.logs.heading", locale), locale).not.toBe(
        t("expert.logs.receivingHeading", locale)
      );
      expect(t("expert.logs.receivingName", locale), locale).not.toBe("");
    }
  });

  it("mints NO empty-state copy for the logs block (Task 2.5)", () => {
    /*
     * FD-1: when `anyReceivingEvents` is false the heading and table are absent
     * entirely — never an em dash, never an empty panel. The six links stay
     * unconditional, so there is no absence string to mint for them either.
     */
    expect(Object.keys(es.expert.logs).sort()).toEqual(Object.keys(en.expert.logs).sort());
    expect(Object.keys(es.expert.logs)).not.toContain("empty");
  });
});

describe("dictionary mirroring (AD-12)", () => {
  // The real enforcement is the compile error on `en: Dictionary`; this
  // runtime sweep is a belt-and-braces regression net for the same property.
  function keyShape(node: unknown, prefix = ""): string[] {
    if (typeof node === "string") {
      return [prefix];
    }
    if (typeof node === "object" && node !== null) {
      return Object.entries(node).flatMap(([key, value]) =>
        keyShape(value, prefix ? `${prefix}.${key}` : key)
      );
    }
    throw new Error(`unexpected dictionary leaf at "${prefix}"`);
  }

  it("en mirrors the exact key shape of es", () => {
    expect(keyShape(en).sort()).toEqual(keyShape(es).sort());
  });

  it("dictionaries contain only non-empty string leaves", () => {
    for (const dictionary of [es, en]) {
      for (const key of keyShape(dictionary)) {
        expect(t(key as Parameters<typeof t>[0], dictionary === es ? "es" : "en")).not.toBe("");
      }
    }
  });
});

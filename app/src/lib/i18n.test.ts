import { afterEach, describe, expect, it, vi } from "vitest";

import { en } from "@/locales/en";
import { es } from "@/locales/es";
import type { PossessionContestType } from "@/lib/contract/contract-types";
import { t, type Locale } from "@/lib/i18n";
import { KEY_STAT_FIELDS, sectionTitleKey } from "@/lib/tactical-sections";
import { CROSS_DELIVERY_TYPES, crossDeliveryKey } from "@/viz/cross-map-model";
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

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { en } from "@/locales/en";
import { es } from "@/locales/es";
import type { Leaderboards, MetricCode, PossessionContestType } from "@/lib/contract/contract-types";
import {
  GLOSSARY_TERMS,
  SECTION_HEADING_MARKS,
  SECTION_SUMMARY_MARKS,
  findTermSpan,
  glossaryDefinitionKey,
  glossaryTermEnKey,
  glossaryTermEsKey,
} from "@/lib/glossary";
import {
  MATCHDAY_ROUNDS,
  MATCH_RESULTS,
  RESULT_COLUMN_KEYS,
  SHARED_ROUND_STAGES,
  STANDINGS_COLUMN_KEYS,
  matchResultLetterKey,
  matchResultWordKey,
  matchdayRoundLabelKey,
} from "@/lib/hub-model";
import { t, type Locale } from "@/lib/i18n";
import {
  entityKindLabelKey,
  entityKindRowLinkKey,
  type SearchEntityKind,
} from "@/lib/search-model";
import {
  speedZoneBandKey,
  speedZoneLabelKey,
  startedLabelKey,
} from "@/lib/player-profile-format";
import { composeHeadAccessibleName } from "@/lib/table-sort";
import {
  COLLAPSIBLE_SECTION_IDS,
  KEY_STAT_FIELDS,
  SECTION_IDS,
  sectionSummaryKey,
  sectionTitleKey,
} from "@/lib/tactical-sections";
import type { CollapsibleSectionId, SectionId } from "@/lib/tactical-sections";
import { CROSS_DELIVERY_TYPES, crossDeliveryKey } from "@/viz/cross-map-model";
import { SPEED_ZONES } from "@/viz/player-profile-model";
import { EXPERT_FIELDS, expertFieldKey, expertFieldTitleKey } from "@/viz/expert-model";
import {
  ABBREVIATED_METRICS,
  leaderboardMetricAbbrKey,
  leaderboardMetricKey,
} from "@/viz/leaderboard-model";

/*
 * The leaderboards fixture, for the caption-uniqueness list (Story 2.13 Task
 * 8.3). Read rather than hardcoded at three boards: the component is driven off
 * `boards.length` and Story 1.17's real emission carries roughly thirty, so a
 * literal count here would pin a fixture fact instead of the property.
 */
const LEADERBOARD_FIXTURE: Leaderboards = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "..", "data", "fixtures", "index", "leaderboards.json"),
    "utf8"
  )
) as Leaderboards;
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
  RECEIVING_EVENT_TYPES,
  receivingEventTypeKey,
  receivingLogRows,
} from "@/viz/receiving-log-model";
import type { ReceivingEvent } from "@/lib/contract/contract-types";
/*
 * The link table is imported from `lib/expert-logs`, the PURE module that owns
 * it, so the hrefs this suite pins ARE the shipped ones without dragging a
 * `"use client"` component — and `DataTable` -> `SortAnnouncer` -> `radix-ui`
 * behind it — into `environment: "node"`. It lived in `ExpertLayer.tsx` until
 * the 2.11c code review; see that file's docblock for why it moved.
 */
import { LOG_LINKS } from "@/lib/expert-logs";
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

/*
 * The probe key was `app.scaffold.heading` until Story 2.12 retired the whole
 * scaffold namespace (its only call site, `src/app/page.tsx`'s Story 2.1
 * placeholder body, is now the Tournament Hub). `notFound.homeLink` replaces it
 * on the two properties these assertions actually need: it is a leaf, and its
 * es and en values DIFFER — which is what makes the third assertion below
 * meaningful. `app.siteName` would not do: it is "WC Stats" in both.
 */
describe("t()", () => {
  it("defaults to the canonical Spanish dictionary", () => {
    expect(t("notFound.homeLink")).toBe(es.notFound.homeLink);
  });

  it("resolves the active locale's value", () => {
    expect(t("notFound.homeLink", "en")).toBe(en.notFound.homeLink);
    expect(t("notFound.homeLink", "es")).not.toBe(t("notFound.homeLink", "en"));
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
    const enNotFound = en.notFound as Record<string, unknown>;
    const original = enNotFound.homeLink;
    enNotFound.homeLink = undefined;
    try {
      expect(t("notFound.homeLink", "en")).toBe(es.notFound.homeLink);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      enNotFound.homeLink = original;
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

  it("carries the five ShotOutcome labels and DELIBERATELY no ShotOutcomeDetail ones", () => {
    /*
     * RETITLED, NOT DELETED (Story 2.13 ruling 5). The assertions below are
     * byte-identical to the ones this test shipped with; only its NAME and this
     * comment changed, because the name asserted a premise that is now false and
     * "green tests named 'CS-1 has not landed' misreport the gate's state to the
     * next reader" is the filed defect.
     *
     * CS-1 HAS LANDED (093a1b2, plus 4682639; schemaVersion 2 -> 3, and CS-2 has
     * since taken it to 4). `ShotOutcomeDetail` exists in the contract with all
     * 24 values. What does NOT exist, on purpose, is a locale label for any of
     * them: AD-14 decision CR-2 makes `outcome` authoritative for marker
     * encoding and forbids deriving it from the detail, so the App maps the
     * stable five-value enum and nothing else.
     *
     * This is therefore STILL CORRECT AS AN ASSERTION and must stay green. It
     * is the only thing between the extended enum and an unlabelled detail code
     * reaching a user. Deleting it belongs to whoever ships ShotOutcomeDetail
     * locale labels — Story 2.13 maps `MetricCode`, a different closed enum on a
     * different surface, so the ledger's deletion condition is unmet here.
     */
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

  /*
   * STORY 2.14's TWO BUILDERS, REGISTERED HERE (code review 2026-08-07).
   *
   * Task 5.7 says "Register any key builder in the key-builder resolution
   * sweep", and this describe is that sweep. They were instead resolved inside
   * 2.14's own `search` describe further down — equivalent coverage, but it
   * defeats the point of having ONE place a reader checks that every builder in
   * the repo resolves, and a second home for one concept is the pattern ruling 9
   * polices in the dictionary itself.
   *
   * The `search` describe keeps its REUSE assertions, which are about which
   * shipped key each kind maps to and are genuinely story-local.
   */
  it("resolves both search entity-kind builders over their full domain", () => {
    const kinds: SearchEntityKind[] = ["player", "team", "match"];
    for (const kind of kinds) {
      for (const locale of locales) {
        for (const key of [entityKindLabelKey(kind), entityKindRowLinkKey(kind)]) {
          const value = t(key, locale);
          expect(value, `${key} in ${locale}`).not.toBe("");
          expect(value, `${key} in ${locale}`).not.toBe(key);
        }
      }
    }
  });

  /*
   * STORY 2.15's THREE BUILDERS, REGISTERED HERE (code review 2026-08-07) — for
   * the same reason as 2.14's directly above, and this time reintroducing the
   * pattern that ruling had just removed. They were resolved inside the `player`
   * describe further down, which is equivalent coverage in the wrong place: the
   * whole value of this sweep is that it is ONE place a reader checks that every
   * builder in the repo resolves.
   *
   * `speedZoneLabelKey` and `speedZoneBandKey` point INTO `expert.*` rather than
   * `player.*` (D12's reuse), so a broken cast here would surface as a raw
   * `expert.field.` path in a tile label, which is what the negative assertions
   * pin. The `player` describe keeps its REUSE assertions — which shipped key
   * each builder maps to — because those are genuinely story-local.
   */
  it("resolves all three player-profile builders over their full domain", () => {
    for (const locale of locales) {
      for (const zone of SPEED_ZONES) {
        for (const key of [speedZoneLabelKey(zone), speedZoneBandKey(zone)]) {
          const value = t(key, locale);
          expect(value, `${key} in ${locale}`).not.toBe("");
          expect(value, `${key} in ${locale}`).not.toBe(key);
          expect(value, `${key} in ${locale}`).not.toContain("expert.");
        }
      }
      for (const started of [true, false]) {
        const key = startedLabelKey(started);
        const value = t(key, locale);
        expect(value, `${key} in ${locale}`).not.toBe("");
        expect(value, `${key} in ${locale}`).not.toBe(key);
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

  it("still mints NO ShotOutcomeDetail namespace, now that CS-1 HAS landed", () => {
    /*
     * RETITLED, NOT DELETED (Story 2.13 ruling 5) — assertions byte-identical,
     * name and rationale corrected. CS-1 landed at 093a1b2 (schemaVersion 2 ->
     * 3; CS-2 has since taken it to 4) and the 24-value `ShotOutcomeDetail`
     * enum exists in the contract. NO LOCALE LABELS FOR IT DO, and that is
     * deliberate: AD-14 decision CR-2 makes `outcome` authoritative, so 2.18
     * maps the stable five-value ShotOutcome only.
     *
     * The 2.7 tripwire re-asserted from this story's side. Both stay green and
     * undeleted until detail labels actually ship; deletion is re-routed to
     * that story, not taken by 2.13, which maps `MetricCode` instead.
     */
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
    /*
     * DRIVEN THROUGH `receivingLogRows`, NOT through `offerMovementKey`
     * directly. An earlier version of this test re-ran the pre-existing
     * OFFER_MOVEMENT_TYPES label loop and never touched the receiving model at
     * all — so if the model started emitting `enums.receivingMovement.*` it
     * would still have passed, while claiming in its own name to cover exactly
     * that. Patched at the 2.11c code review.
     *
     * One constructed event per movement code, through the model's real entry
     * point: the key it emits must BE the shipped `offerMovementKey` key, and
     * must resolve non-empty in both locales.
     */
    const HOME = { teamId: "home-id", teamCode: "HOM" };
    const AWAY = { teamId: "away-id", teamCode: "AWY" };
    const events = OFFER_MOVEMENT_TYPES.map(
      (code) =>
        ({
          teamId: HOME.teamId,
          playerId: "p-1",
          playerName: "Alguien",
          type: "offer",
          movementType: code,
          at: { minute: 10, stoppageMinute: null },
          x: 50,
          y: 50,
        }) as unknown as ReceivingEvent
    );
    const rows = receivingLogRows(events, HOME, AWAY);
    expect(rows).toHaveLength(OFFER_MOVEMENT_TYPES.length);
    for (const [index, code] of OFFER_MOVEMENT_TYPES.entries()) {
      const emitted = rows[index].movementTypeKey;
      expect(emitted, code).toBe(offerMovementKey(code));
      for (const locale of locales) {
        expect(t(emitted!, locale), `${code} in ${locale}`).not.toBe("");
      }
    }
    // And the discriminator namespace stays two-valued — it never absorbs a
    // movement code.
    expect(Object.keys(es.enums.receivingEventType)).not.toContain("in-front");
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

  it("keeps every LOG_LINKS id unique — two DOM ids and a React key ride on it", () => {
    /*
     * Added at the 2.11c code review. `id` is the only field the rest of this
     * suite did not pin, and three things are built from it: the `<li>`'s React
     * key, the anchor's own `expert-log-link-${id}`, and the hint's
     * `expert-log-hint-${id}`. A repeated id therefore gives duplicate DOM ids
     * and makes one link's `aria-labelledby` resolve against ANOTHER link's
     * hint — silently, since duplicate ids are not an error anywhere.
     */
    const ids = LOG_LINKS.map((link) => link.id);
    expect(new Set(ids).size).toBe(LOG_LINKS.length);
    for (const id of ids) {
      expect(id, id).not.toBe("");
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
     * This list mirrors each component's own composition, one entry per RENDERED
     * <DataTable>: 27 before this story, 28 after. `DefensiveActionsSection`'s
     * caption is conditional, so only the branch the fixtures actually take is
     * listed — the clocked one. Listing both would put 28 entries in a list the
     * assertion below pins at 27, and the unlisted branch
     * (`viz.defensiveActions.tableCaptionNoClock`) is distinct from every entry
     * here anyway, so nothing is lost. (An earlier version of this comment
     * claimed both branches were listed; corrected at the 2.11c code review.)
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

    /*
     * STORY 2.13 EXTENDS THIS LIST WITH THE HUB'S LEADERBOARD TABLES, and it
     * was WARNED that the pin below would go red on a stale count — it has
     * before.
     *
     * DERIVED FROM THE FIXTURE'S OWN BOARD LIST, not hardcoded at three. The
     * component renders one DataTable per board and is driven off
     * `boards.length`; Story 1.17's real emission carries roughly thirty boards
     * and its unruled D3/D5 may cap player rows, so a literal three here would
     * be a fixture fact masquerading as a property. What IS the property — every
     * rendered caption on the site is distinct — holds at either scale, and this
     * mirrors the component's composition exactly:
     *   `${metricLabel}${boardSeparator}${scopeLabel}${SEPARATOR}${tableCaption}`
     */
    function hubLeaderboardCaptions(locale: Locale): string[] {
      const title = (key: Parameters<typeof t>[0]) => t(key, locale);
      return LEADERBOARD_FIXTURE.boards.map((board) => {
        const heading = `${title(leaderboardMetricKey(board.metricCode))}${title(
          "leaderboards.boardSeparator"
        )}${title(board.scope === "team" ? "leaderboards.scope.team" : "leaderboards.scope.player")}`;
        return `${heading}${SEPARATOR}${title("leaderboards.tableCaption")}`;
      });
    }

    /*
     * Story 2.15's four, mirroring each section's composition exactly. The
     * trends and matches captions carry a SECOND clause because their order
     * statement alone is byte-identical ("Ordenado por fecha."): the note and
     * the link sentence are what separate them, and this is where that is
     * pinned.
     */
    function profileCaptions(locale: Locale): string[] {
      const title = (key: Parameters<typeof t>[0]) => t(key, locale);
      return [
        `${title("player.sections.physical.title")}${SEPARATOR}${title("player.caption.physical")}`,
        `${title("player.sections.trends.title")}${SEPARATOR}${title(
          "player.caption.trends"
        )}${SEPARATOR}${title("player.caption.trendsNote")}`,
        `${title("player.sections.aggregates.title")}${SEPARATOR}${title(
          "player.caption.aggregates"
        )}`,
        `${title("player.sections.matches.title")}${SEPARATOR}${title(
          "player.caption.matches"
        )}${SEPARATOR}${title("player.caption.matchesLink")}`,
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

      /*
       * The Hub captions (Story 2.13): distinct from each other AND from all 28
       * on the match route.
       *
       * NO LITERAL COUNT (2.13 code review). The helper's comment above says a
       * literal three "would be a fixture fact masquerading as a property" —
       * and the code then pinned both `3` and `31` two lines later, which is
       * the fixture fact it disowned. The real emission carries 36 boards, so
       * both literals break at the 2.19 DATA_ROOT flip for a reason unrelated
       * to any behaviour, and the fixture was already regenerated once during
       * this story. One board per caption, all distinct, at any board count.
       */
      const hub = hubLeaderboardCaptions(locale);
      expect(hub, `the Hub captions in ${locale}`).toHaveLength(LEADERBOARD_FIXTURE.boards.length);
      expect(new Set(hub).size, `the Hub captions in ${locale}`).toBe(hub.length);
      expect(new Set([...shipped, receiving, ...hub]).size, locale).toBe(28 + hub.length);

      /*
       * STORY 2.15 ADDS FOUR: /players/{slug} renders three DataTables plus the
       * trends data-alternative. Every one is `${sectionTitle} - ...`, the same
       * prefixing all 27 above use, which is both why they are distinct from
       * each other and why they cannot collide with the match route's.
       *
       * 2.13 WARNED THAT THE PIN ABOVE HAS GONE RED ON A STALE COUNT BEFORE, so
       * this block carries its own count rather than editing 27/28.
       */
      const profile = profileCaptions(locale);
      expect(profile, `the profile captions in ${locale}`).toHaveLength(4);
      expect(new Set(profile).size, `the profile captions in ${locale}`).toBe(4);
      expect(new Set([...shipped, receiving, ...hub, ...profile]).size, locale).toBe(
        28 + hub.length + 4
      );
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

/*
 * ------------------------- STORY 2.12, THE TOURNAMENT HUB --------------------
 *
 * Task 7.3. The `const KEYS = [...] as const` sweep over both locales, plus the
 * two assertions the story calls its likeliest silent bug: the es-`D`/en-`D`
 * divergence, and the chip/column letter split.
 */
describe("hub.* and Story 2.12's enums (AC 3, AC 4)", () => {
  const locales: Locale[] = ["es", "en"];

  const KEYS = [
    "hub.title",
    "hub.separator",
    "hub.region.loading",
    "hub.region.loaded",
    "hub.region.error",
    "hub.region.retry",
    "hub.region.invalid",
    "hub.region.invalidExplanation",
    "hub.columns.more",
    "hub.columns.fewer",
    "hub.sortMenu.trigger",
    "hub.sortMenu.clear",
    "hub.standings.heading",
    "hub.standings.caption",
    "hub.standings.tableName",
    "hub.standings.rowLink",
    "hub.standings.empty.headline",
    "hub.standings.empty.explanation",
    "hub.results.heading",
    "hub.results.caption",
    "hub.results.tableName",
    "hub.results.rowLink",
    "hub.results.extraTimeShort",
    "hub.results.shootoutFull",
    "hub.results.empty.headline",
    "hub.results.empty.explanation",
  ] as const;

  it("resolves every minted Hub key in both locales", () => {
    for (const key of KEYS) {
      for (const locale of locales) {
        const value = t(key, locale);
        expect(value, `${key} in ${locale}`).not.toBe("");
        expect(value, `${key} in ${locale}`).not.toContain("hub.");
      }
    }
  });

  it("has one column head per rendered column, in both locales", () => {
    expect(Object.keys(es.hub.standings.column).sort()).toEqual([...STANDINGS_COLUMN_KEYS].sort());
    expect(Object.keys(es.hub.results.column).sort()).toEqual([...RESULT_COLUMN_KEYS].sort());
    for (const key of STANDINGS_COLUMN_KEYS) {
      for (const locale of locales) {
        expect(t(`hub.standings.column.${key}`, locale), `${key} in ${locale}`).not.toBe("");
      }
    }
    for (const key of RESULT_COLUMN_KEYS) {
      for (const locale of locales) {
        expect(t(`hub.results.column.${key}`, locale), `${key} in ${locale}`).not.toBe("");
      }
    }
  });

  it("carries a full term for every ABBREVIATED head and for no other (UX-DR17)", () => {
    /*
     * TableColumn's contract is "full term when headText is abbreviated; null
     * otherwise". `team` and `form` are whole words in both locales, so a
     * headTitle for them would be a duplicate rather than an expansion.
     */
    const abbreviated = STANDINGS_COLUMN_KEYS.filter(
      (key) => key !== "team" && key !== "form"
    );
    expect(Object.keys(es.hub.standings.columnTitle).sort()).toEqual([...abbreviated].sort());
    for (const key of abbreviated) {
      for (const locale of locales) {
        const head = t(`hub.standings.column.${key}`, locale);
        const full = t(`hub.standings.columnTitle.${key}`, locale);
        expect(full, `${key} in ${locale}`).not.toBe("");
        // An "expansion" no longer than the abbreviation expands nothing.
        expect(full.length, `${key} in ${locale}`).toBeGreaterThan(head.length);
      }
    }
  });

  it("ships the RULED Spanish standings abbreviations verbatim", () => {
    // EXPERIENCE.md's "result letters & standings columns" row: PJ, G, E, P,
    // GF, GC, DG, Pts. One of the three scaffolding rows deferred-work.md
    // routed to its owning story, which this is.
    expect([
      es.hub.standings.column.played,
      es.hub.standings.column.won,
      es.hub.standings.column.drawn,
      es.hub.standings.column.lost,
      es.hub.standings.column.goalsFor,
      es.hub.standings.column.goalsAgainst,
      es.hub.standings.column.goalDifference,
      es.hub.standings.column.points,
    ]).toEqual(["PJ", "G", "E", "P", "GF", "GC", "DG", "Pts"]);
  });

  it("ships the RULED chip letters: V/E/D in es, W/D/L in en", () => {
    expect(MATCH_RESULTS.map((code) => t(matchResultLetterKey(code), "es"))).toEqual([
      "V",
      "E",
      "D",
    ]);
    expect(MATCH_RESULTS.map((code) => t(matchResultLetterKey(code), "en"))).toEqual([
      "W",
      "D",
      "L",
    ]);
  });

  it("es `D` and en `D` name DIFFERENT MatchResult codes (D8's inversion)", () => {
    /*
     * THE STORY'S LIKELIEST SILENT BUG, pinned. es `D` is *derrota* (loss); en
     * `D` is *draw*. Keying a chip off the LETTER instead of the enum code
     * would flip every loss into a draw on the language toggle with nothing to
     * catch it — no type error, no lint error, no other test.
     */
    const esD = MATCH_RESULTS.filter((code) => t(matchResultLetterKey(code), "es") === "D");
    const enD = MATCH_RESULTS.filter((code) => t(matchResultLetterKey(code), "en") === "D");
    expect(esD).toEqual(["loss"]);
    expect(enD).toEqual(["draw"]);
    expect(esD).not.toEqual(enD);
  });

  it("keeps the chip letters and the standings column letters apart", () => {
    // Chips are V/E/D, columns are G/E/P — only `E` coincides, in the same row,
    // for concepts that are NOT the same. Two namespaces, on purpose.
    expect(es.enums.matchResult.win).not.toBe(es.hub.standings.column.won);
    expect(es.enums.matchResult.loss).not.toBe(es.hub.standings.column.lost);
    expect(es.enums.matchResult.draw).toBe(es.hub.standings.column.drawn);
  });

  it("labels every MatchResult with a spoken word, distinct from its letter", () => {
    for (const code of MATCH_RESULTS) {
      for (const locale of locales) {
        const word = t(matchResultWordKey(code), locale);
        expect(word, `${code} in ${locale}`).not.toBe("");
        expect(word.length, `${code} in ${locale}`).toBeGreaterThan(1);
      }
    }
  });

  it("has exactly one entry per MatchdayRound code", () => {
    expect(Object.keys(es.enums.matchdayRound).sort()).toEqual([...MATCHDAY_ROUNDS].sort());
    for (const round of MATCHDAY_ROUNDS) {
      for (const locale of locales) {
        expect(t(matchdayRoundLabelKey(round), locale), `${round} in ${locale}`).not.toBe("");
      }
    }
  });

  it("pins the six shared round labels EQUAL to their enums.stage counterparts", () => {
    /*
     * `MatchdayRound` restates six `Stage` codes deliberately (an unlabelled
     * code is worse than a restated one). This is what stops the restatement
     * from drifting into a second Spanish term for the same round.
     */
    for (const stage of SHARED_ROUND_STAGES) {
      for (const locale of locales) {
        expect(t(`enums.matchdayRound.${stage}`, locale), `${stage} in ${locale}`).toBe(
          t(`enums.stage.${stage}`, locale)
        );
      }
    }
  });

  it("does NOT reuse match-scoped copy on the Hub", () => {
    /*
     * `match.bundle.loading` is "Cargando datos DEL PARTIDO" and
     * `match.bundle.invalid` "Los datos DE ESTE PARTIDO" — both false
     * statements on a tournament-wide route. This asserts the Hub minted its
     * own rather than pointing at them.
     */
    for (const locale of locales) {
      expect(t("hub.region.loading", locale)).not.toBe(t("match.bundle.loading", locale));
      expect(t("hub.region.invalid", locale)).not.toBe(t("match.bundle.invalid", locale));
      expect(t("hub.standings.caption", locale)).not.toBe(t("viz.table.caption", locale));
      expect(t("hub.results.caption", locale)).not.toBe(t("viz.table.caption", locale));
    }
  });

  it("gives the two Hub tables distinct captions and distinct names", () => {
    for (const locale of locales) {
      expect(t("hub.standings.caption", locale)).not.toBe(t("hub.results.caption", locale));
      expect(t("hub.standings.tableName", locale)).not.toBe(t("hub.results.tableName", locale));
    }
  });

  it("keeps the retired scaffold keys retired", () => {
    // Task 1.1 removed their only call site. Re-adding them would be the
    // dead-key defect facing the other way.
    expect(Object.keys(es.app)).toEqual(["siteName"]);
    expect(Object.keys(es.a11y)).toEqual(["localeAnnouncement"]);
  });
});

/*
 * ============= STORY 2.13 — LÍDERES DEL TORNEO (Task 8.2, AD-7) =============
 *
 * `leaderboardMetricKey` ends in an `as DictionaryKey` cast — DictionaryKey is
 * a literal union and a template-literal expression infers `string` — so tsc is
 * defeated by construction, exactly as it is for `expertFieldKey`. A round-trip
 * over the builder's FULL 32-value domain, in BOTH locales, is the only thing
 * between a typo'd key and a runtime miss.
 */
describe("the leaderboards namespaces (Story 2.13, AD-2 / AD-7)", () => {
  const locales: Locale[] = ["es", "en"];

  /*
   * The MetricCode domain as a `Record<MetricCode, true>`, so a contract enum
   * change is a compile error in this test rather than a silently uncovered
   * case — the same AD-2 mechanism the registries themselves use.
   */
  const ALL_METRIC_CODES: Record<MetricCode, true> = {
    ballProgressions: true,
    completedLineBreaks: true,
    crosses: true,
    crossesCompleted: true,
    defensiveLineBreaks: true,
    defensivePressures: true,
    distanceCovered: true,
    duelsWonAerial: true,
    duelsWonPhysical: true,
    expectedGoals: true,
    forcedTurnovers: true,
    goals: true,
    highSpeedRuns: true,
    interceptions: true,
    lineBreaksCompleted: true,
    passCompletion: true,
    passes: true,
    passesCompleted: true,
    possession: true,
    possessionRegains: true,
    receptionsInFinalThird: true,
    secondBalls: true,
    shots: true,
    shotsOnTarget: true,
    sprintDistance: true,
    sprints: true,
    stepIns: true,
    switchesOfPlay: true,
    tacklesWon: true,
    takeOns: true,
    topSpeed: true,
    totalDistance: true,
  };
  const METRIC_CODES = Object.keys(ALL_METRIC_CODES) as MetricCode[];

  it("has exactly one entry per MetricCode value — all 32", () => {
    expect(METRIC_CODES).toHaveLength(32);
    expect(Object.keys(es.enums.leaderboardMetric).sort()).toEqual([...METRIC_CODES].sort());
    expect(Object.keys(en.enums.leaderboardMetric).sort()).toEqual([...METRIC_CODES].sort());
  });

  it("resolves every metric label in both locales", () => {
    for (const code of METRIC_CODES) {
      for (const locale of locales) {
        const label = t(leaderboardMetricKey(code), locale);
        expect(label, `${code} in ${locale}`).not.toBe("");
        expect(label, `${code} in ${locale}`).not.toContain("enums.leaderboardMetric");
      }
    }
  });

  it("does NOT touch enums.metric — that namespace is pinned to KEY_STAT_FIELDS", () => {
    /*
     * THE STORY'S SHARPEST TRAP, asserted from this side too. `enums.metric` is
     * pinned key-for-key to the 19 Domain B Key Statistics fields by the suite
     * above, and `tactical-sections.ts`, which owns that list, is do-not-touch.
     * MetricCode is 32 values, so the labels needed a NEW namespace; one extra
     * key over there is a red suite.
     */
    expect(Object.keys(es.enums.metric).sort()).toEqual([...KEY_STAT_FIELDS].sort());
    expect(Object.keys(es.enums.metric)).not.toContain("topSpeed");
  });

  it("carries exactly the ABBREVIATED_METRICS in leaderboardMetricAbbr, and no more", () => {
    const abbreviated = Object.keys(ABBREVIATED_METRICS).sort();
    expect(abbreviated).toEqual(["highSpeedRuns", "topSpeed"]);
    expect(Object.keys(es.enums.leaderboardMetricAbbr).sort()).toEqual(abbreviated);
    expect(Object.keys(en.enums.leaderboardMetricAbbr).sort()).toEqual(abbreviated);
    for (const code of METRIC_CODES) {
      const key = leaderboardMetricAbbrKey(code);
      if (key === null) {
        continue;
      }
      for (const locale of locales) {
        expect(t(key, locale), `${code} in ${locale}`).not.toBe("");
      }
    }
  });

  it("MINTS NO ABBREVIATION — both reuse ruled copy the app already ships", () => {
    /*
     * THE RULED-REUSE PINS, the same mechanism `expert.field.topSpeed` uses.
     * EXPERIENCE.md names "VEL. MÁX." for "Velocidad máxima" as the worked
     * example of the abbreviation rule, and both strings already exist as ruled
     * copy — the Hero's top-speed tile and the glossary's high-speed-run
     * definition. Pinning them EQUAL is what stops a second mint drifting in.
     *
     * `topSpeed` sits on the Hero tiles rather than under enums.metric because
     * it is absent from KEY_STAT_FIELDS; Story 2.18 records why.
     */
    expect(es.enums.leaderboardMetricAbbr.topSpeed).toBe(es.match.hero.tiles.topSpeed);
    expect(es.enums.leaderboardMetricAbbr.topSpeed).toBe("Vel. máx.");
    expect(es.enums.leaderboardMetricAbbr.highSpeedRuns).toBe(es.expert.field.highSpeedRuns);
    expect(es.enums.leaderboardMetricAbbr.highSpeedRuns).toBe("CARR. ALTA VEL.");
  });

  it("takes the FULL term for the two abbreviated metrics, never the short form", () => {
    /*
     * `enums.leaderboardMetric` holds full terms ONLY. Copying
     * `expert.field.topSpeed` here would have put "Vel. máx." in the namespace
     * whose whole job is to carry the expansion — so both come from
     * `expert.fieldTitle` instead.
     */
    expect(es.enums.leaderboardMetric.topSpeed).toBe(es.expert.fieldTitle.topSpeed);
    expect(es.enums.leaderboardMetric.topSpeed).toBe("Velocidad máxima");
    expect(es.enums.leaderboardMetric.highSpeedRuns).toBe(es.expert.fieldTitle.highSpeedRuns);
    expect(es.enums.leaderboardMetric.highSpeedRuns).toBe("Carreras a alta velocidad");
    // And they really are different strings, or the abbreviation would be idle.
    expect(es.enums.leaderboardMetric.topSpeed).not.toBe(
      es.enums.leaderboardMetricAbbr.topSpeed
    );
  });

  it("inherits eighteen labels from enums.metric verbatim, minting no second name", () => {
    // Every enums.metric key except `directPressures`, which is not a
    // MetricCode. A divergence here means one quantity has two Spanish names.
    const inherited = (Object.keys(es.enums.metric) as string[]).filter(
      (key) => key !== "directPressures"
    );
    expect(inherited).toHaveLength(18);
    for (const key of inherited) {
      const code = key as MetricCode;
      expect(es.enums.leaderboardMetric[code], key).toBe(
        es.enums.metric[key as keyof typeof es.enums.metric]
      );
      expect(en.enums.leaderboardMetric[code], key).toBe(
        en.enums.metric[key as keyof typeof en.enums.metric]
      );
    }
  });

  it("resolves the whole leaderboards.* surface in both locales", () => {
    for (const locale of locales) {
      for (const key of [
        "leaderboards.title",
        "leaderboards.teaserHeading",
        "leaderboards.tablesHeading",
        "leaderboards.teaserCount",
        "leaderboards.teaserCountOne",
        "leaderboards.boardSeparator",
        "leaderboards.tableCaption",
        "leaderboards.filterLabel",
        "leaderboards.filterPlaceholder",
        "leaderboards.filterResults",
        "leaderboards.filterResultsOne",
        "leaderboards.filterNoResults",
        "leaderboards.filterNoResultsExplanation",
        "leaderboards.empty",
        "leaderboards.emptyExplanation",
        "leaderboards.loading",
        "leaderboards.error",
        "leaderboards.retry",
        "leaderboards.invalid",
        "leaderboards.invalidExplanation",
        "leaderboards.columns.rank",
        "leaderboards.columns.matchesPlayed",
        "leaderboards.columns.perMatch",
        "leaderboards.scope.team",
        "leaderboards.scope.player",
        "leaderboards.higherIsBetter.true",
        "leaderboards.higherIsBetter.false",
      ] as const) {
        const value = t(key, locale);
        expect(value, `${key} in ${locale}`).not.toBe("");
        expect(value, `${key} in ${locale}`).not.toBe(key);
      }
    }
  });

  it("ships the RULED title and avoids 'clasificación' entirely", () => {
    /*
     * EXPERIENCE.md's policy row rules the string: "standings / leaderboards |
     * translate | Tabla de posiciones / Líderes del torneo | 'Clasificación' is
     * avoided entirely — in LatAm it *means* the standings table, and the Hub
     * carries both surfaces". The forbidden-register sweep above already bans
     * the "clasificaci" prefix across every es leaf; this makes the INTENT
     * explicit for a later reader who might otherwise reach for it.
     */
    expect(es.leaderboards.title).toBe("Líderes del torneo");
    for (const [key, value] of Object.entries(es.leaderboards)) {
      if (typeof value === "string") {
        expect(value, `leaderboards.${key}`).not.toMatch(/clasificaci/i);
      }
    }
  });

  it("keeps the two higherIsBetter labels distinct — the artifact carries the flag to be rendered", () => {
    for (const dictionary of [es, en]) {
      expect(dictionary.leaderboards.higherIsBetter.true).not.toBe(
        dictionary.leaderboards.higherIsBetter.false
      );
    }
  });

  it("distinguishes the singular and plural result-count nouns in both locales", () => {
    // t() has no interpolation, so the count sentence is composed at the call
    // site — which only works if the two nouns actually differ.
    for (const dictionary of [es, en]) {
      expect(dictionary.leaderboards.filterResults).not.toBe(
        dictionary.leaderboards.filterResultsOne
      );
      expect(dictionary.leaderboards.teaserCount).not.toBe(
        dictionary.leaderboards.teaserCountOne
      );
    }
  });

  /*
   * THESE CALL THE SHIPPED COMPOSER (2.13 code review). The version that
   * shipped built its own template literal and asserted it against itself:
   *
   *   const accessibleName = `${sortAction} ${headText} (${headTitle})`;
   *   expect(accessibleName).toBe("Ordenar por Vel. máx. (Velocidad máxima)");
   *
   * — green if `headAccessibleName` were deleted, green if its operands were
   * swapped, and green under the suppression bug below. Worse, the string it
   * pinned was not the one the component emitted: the real head carries its
   * unit, so ES actually reads "Ordenar por Vel. máx. (km/h) (Velocidad
   * máxima)". `composeHeadAccessibleName` now lives in `@/lib/table-sort` for
   * exactly this reason — a composition trapped inside a "use client" closure
   * cannot be reached by a node-environment suite.
   */
  it("composes an accessible name that CONTAINS the visible abbreviated head", () => {
    /*
     * WCAG 2.5.3 Label in Name, for the one case Story 2.13 adds: an
     * ABBREVIATED head. Visible text FIRST, full term appended. Swapping
     * headText for headTitle would give "Ordenar por Velocidad máxima" over
     * visible text reading "Vel. máx.", which is a 2.5.3 failure outright.
     */
    const headText = es.enums.leaderboardMetricAbbr.topSpeed;
    const headTitle = es.enums.leaderboardMetric.topSpeed;
    const accessibleName = composeHeadAccessibleName(es.viz.table.sortAction, headText, headTitle);
    expect(accessibleName).toBe("Ordenar por Vel. máx. (Velocidad máxima)");
    expect(accessibleName).toContain(headText);
    expect(accessibleName.startsWith(es.viz.table.sortAction)).toBe(true);
    // The unabbreviated form is unchanged from the pre-2.13 composition.
    const plainHead = es.leaderboards.columns.rank;
    expect(composeHeadAccessibleName(es.viz.table.sortAction, plainHead, null)).toBe(
      "Ordenar por Puesto"
    );
  });

  it("still carries the full term when the head also carries a UNIT", () => {
    /*
     * THE REAL HEAD, which the previous test never built. Ruling 6 puts the
     * unit head-side, so `headText` is "Vel. máx. (km/h)" while `headTitle`
     * stays the bare term. Both halves are ruled and their composition simply
     * stacks — clumsy, disclosed and accepted; what matters is that the full
     * term is still THERE, and that the visible text still leads.
     */
    const headText = `${es.enums.leaderboardMetricAbbr.topSpeed} (${es.enums.unit.kmh})`;
    const name = composeHeadAccessibleName(
      es.viz.table.sortAction,
      headText,
      es.enums.leaderboardMetric.topSpeed
    );
    expect(name).toContain(headText);
    expect(name).toContain(es.enums.leaderboardMetric.topSpeed);
  });

  it("SUPPRESSES a parenthetical the head already contains — the EN unit case", () => {
    /*
     * THE BUG THIS TEST EXISTS FOR. `ABBREVIATED_METRICS` and `TITLED_FIELDS`
     * are keyed per metric/field, not per locale, so in EN the "abbreviation"
     * and the full term are the SAME STRING. A byte-equality guard fired on
     * `topSpeed` only while the head carried no unit; once ruling 6 appended
     * " (km/h)" the two halves were never byte-equal and EN shipped
     * "Sort by Top speed (km/h) (Top speed)" — the exact string en.ts's own
     * comment promises is impossible. It regressed the Expert Layer's already
     * shipped topSpeed head too, since `ExpertLayer` composes headText the same
     * way. Containment is the correct test; byte-equality is its special case.
     */
    expect(en.enums.leaderboardMetricAbbr.topSpeed).toBe(en.enums.leaderboardMetric.topSpeed);
    const bare = composeHeadAccessibleName(
      en.viz.table.sortAction,
      en.enums.leaderboardMetricAbbr.topSpeed,
      en.enums.leaderboardMetric.topSpeed
    );
    expect(bare).toBe("Sort by Top speed");

    const withUnit = `${en.enums.leaderboardMetricAbbr.topSpeed} (${en.enums.unit.kmh})`;
    const composed = composeHeadAccessibleName(
      en.viz.table.sortAction,
      withUnit,
      en.enums.leaderboardMetric.topSpeed
    );
    expect(composed).toBe("Sort by Top speed (km/h)");
    expect(composed).not.toContain("(Top speed)");
  });

  it("keeps the Hub's kickoff head to ONE parenthetical (ruled at the 2.13 review)", () => {
    /*
     * The Hub's kickoff column supplied a PRE-COMPOSED headTitle,
     * "Hora (hora local)", and the composer wrapped the already-wrapped string:
     * "Ordenar por Hora (Hora (hora local))".
     *
     * THE FIX IS AT THE CALL SITE, NOT IN THE COMPOSER, and this test pins the
     * distinction deliberately. `TableColumn.headTitle`'s documented contract is
     * a BARE full term; the composer's job is to append it visible-text-first,
     * and teaching it to detect and unwrap a caller's own parentheses would be a
     * second special case guessing at intent. So the assertion below is on the
     * SHIPPED values — a bare clarifier in, one parenthetical out.
     */
    const shipped = composeHeadAccessibleName(
      es.viz.table.sortAction,
      es.hub.results.column.kickoff,
      es.match.hero.localTime
    );
    expect(shipped).toBe(
      `${es.viz.table.sortAction} ${es.hub.results.column.kickoff} (${es.match.hero.localTime})`
    );
    expect(shipped).not.toContain("((");
    expect(shipped.match(/\(/g) ?? []).toHaveLength(1);
    // And the visible head still leads it — WCAG 2.5.3.
    expect(shipped).toContain(es.hub.results.column.kickoff);
  });

  it("reuses the shipped column names for the entity and team heads", () => {
    /*
     * DELIBERATELY NOT MINTED. `viz.table.team` / `viz.table.player` already
     * ship as the house column names for exactly these quantities, so
     * `leaderboards.columns` carries only the three heads that had no shipped
     * equivalent. A second pair would be two sources for one term.
     */
    expect(Object.keys(es.leaderboards.columns).sort()).toEqual([
      "matchesPlayed",
      "perMatch",
      "rank",
    ]);
    for (const locale of locales) {
      expect(t("viz.table.team", locale)).not.toBe("");
      expect(t("viz.table.player", locale)).not.toBe("");
    }
  });
});

/*
 * ============= STORY 2.14 — THE HEADER SEARCH NAMESPACE (Task 5.7) =============
 *
 * `entityKindLabelKey` and `entityKindRowLinkKey` are KEY BUILDERS, so they join
 * the resolution sweep: both return `DictionaryKey` from a switch, and a switch
 * arm pointing at a path that does not exist is invisible to tsc in exactly the
 * way a template-literal cast is. Resolving every arm in both locales is the
 * only thing between a wrong address and a raw dot path reaching a reader.
 *
 * The rest of this describe polices RULING 9: reuse first, mint only what has a
 * rendering call site, and never mint a second name for a shipped term.
 */
describe("the search namespace (Story 2.14, AD-7 / ruling 9)", () => {
  const locales: Locale[] = ["es", "en"];

  /*
   * BUILDER RESOLUTION LIVES IN THE KEY-BUILDER SWEEP, not here (code review
   * 2026-08-07) — see "resolves both search entity-kind builders over their full
   * domain" in `describe("key-builder resolution sweep …")` above. What stays in
   * this describe is what is specific to this story: WHICH shipped key each kind
   * maps to, and that nothing was minted that could have been reused.
   */

  it("resolves the three capped-announcement fragments in both locales", () => {
    /*
     * Ruled R2 at code review: the announcement discloses the RESULT_LIMIT cap
     * ("Mostrando los primeros 10 de 214 resultados"). Three fragments on the
     * noResultsBefore/After idiom, because t() has no interpolation.
     */
    for (const locale of locales) {
      for (const key of [
        "search.cappedBefore",
        "search.cappedMiddle",
        "search.cappedAfter",
      ] as const) {
        const value = t(key, locale);
        expect(value, `${key} in ${locale}`).not.toBe("");
        expect(value, `${key} in ${locale}`).not.toBe(key);
      }
    }
  });

  it("REUSES the shipped entity labels — no second source for one term", () => {
    /*
     * `leaderboards`' binding precedent, applied again: "NO COLUMN LABEL FOR THE
     * ENTITY OR THE TEAM. Those two heads resolve viz.table.player /
     * viz.table.team … a second pair here would be two sources for one term."
     */
    expect(entityKindLabelKey("player")).toBe("viz.table.player");
    expect(entityKindLabelKey("team")).toBe("viz.table.team");
    expect(entityKindLabelKey("match")).toBe("hub.results.column.match");
    // And two of the three row prefixes are the shipped hub.* ones.
    expect(entityKindRowLinkKey("team")).toBe("hub.standings.rowLink");
    expect(entityKindRowLinkKey("match")).toBe("hub.results.rowLink");
  });

  it("mints NO duplicate of any string it could have reused", () => {
    /*
     * The dead-key prohibition's mirror image. A `search.*` value that already
     * exists verbatim elsewhere in the dictionary is a second home for one term
     * — the drift `leaderboards` and `format.ts` both police in their own
     * domains. The player row prefix is the only genuinely new NAME, and it
     * deliberately parallels the two hub.* forms without repeating either.
     */
    for (const locale of locales) {
      const dictionary = locale === "es" ? es : en;
      const searchValues = Object.values(dictionary.search);
      const elsewhere = stringLeaves(dictionary)
        .filter(([path]) => !path.startsWith("search."))
        .map(([, value]) => value);
      const duplicated = searchValues.filter((value) => elsewhere.includes(value));
      expect(duplicated, `${locale} re-mints a shipped string`).toEqual([]);
    }
  });

  it("keeps the placeholder and label DISTINCT from the leaderboard filter's", () => {
    // The leaderboard copy is board-scoped ("Filtrar por nombre" / "Escribe un
    // nombre") and would be FALSE on a control that also finds matches — which
    // is why these two were minted rather than reused.
    for (const locale of locales) {
      expect(t("search.label", locale)).not.toBe(t("leaderboards.filterLabel", locale));
      expect(t("search.placeholder", locale)).not.toBe(
        t("leaderboards.filterPlaceholder", locale)
      );
    }
  });

  it("composes the AC's empty-state sentence from its two fragments", () => {
    /*
     * `t()` HAS NO INTERPOLATION, and `react/jsx-no-literals` bans the
     * guillemets as JSX text — so the sentence exists only as a call-site
     * composition, and this is where its SHAPE is pinned. EXPERIENCE.md quotes
     * the Spanish verbatim.
     */
    expect(`${es.search.noResultsBefore}Messi${es.search.noResultsAfter}`).toBe(
      "Sin resultados para «Messi»."
    );
    // The guillemets are the ruled glyph and are legal: the forbidden-register
    // sweep bans [¡!], not «».
    expect(es.search.noResultsBefore).toContain("«");
    expect(es.search.noResultsAfter).toContain("»");
    // Both locales keep the same punctuation — one string, one glyph pair.
    expect(en.search.noResultsBefore).toContain("«");
  });

  it("gives the four non-result states DISTINCT copy, so none can stand in for another", () => {
    /*
     * Task 7.8: "no corpus" and "zero matches" are different facts, and the AC's
     * copy asserts the second. Error, invalid and loading must each say their
     * own thing, or the component can render a true-looking falsehood.
     */
    for (const locale of locales) {
      const states = [
        t("search.loading", locale),
        t("search.error", locale),
        t("search.invalid", locale),
        `${t("search.noResultsBefore", locale)}x${t("search.noResultsAfter", locale)}`,
      ];
      expect(new Set(states).size, locale).toBe(4);
    }
  });

  it("keeps the invalid copy distinct from the Hub's, which covers other routes", () => {
    // The header searches on four routes the Hub never reaches, so it carries
    // its own copy rather than borrowing region-scoped wording.
    for (const locale of locales) {
      expect(t("search.invalid", locale)).not.toBe(t("hub.region.invalid", locale));
    }
  });

  it("is tuteo and clean of the forbidden register", () => {
    // The global sweep above already walks every es leaf; this names the
    // namespace explicitly so a reader sees it was considered rather than
    // covered by accident. "Busca"/"Escribe" are the tuteo imperatives.
    expect(es.search.label).toMatch(/^Busca\b/);
    expect(es.search.placeholder).toMatch(/^Escribe\b/);
    for (const value of Object.values(es.search)) {
      expect(value, value).not.toMatch(/[¡!]/);
      expect(value, value).not.toMatch(/usted|vosotros|clasificaci/i);
    }
  });

  it("is a11y-safe by placement — the live-region copy is NOT under a11y.*", () => {
    // `es.a11y` and `es.app` are pinned EXACTLY by the Story 2.12 test above; a
    // live-region string parked in either goes instantly red. This states where
    // it went instead.
    expect(Object.keys(es.a11y)).toEqual(["localeAnnouncement"]);
    expect(es.search.loading).toBeTypeOf("string");
  });
});

/*
 * ============ STORY 2.15 - THE PLAYER-PROFILE NAMESPACE (Task 9.2) ============
 *
 * `speedZoneLabelKey`, `speedZoneBandKey` and `startedLabelKey` are KEY
 * BUILDERS, so they join the resolution sweep: each returns a `DictionaryKey`
 * built by template-literal cast or by a boolean branch, and an address that
 * does not exist is invisible to tsc in exactly the way every other cast in this
 * file is. Resolving each over its FULL domain in both locales is the only thing
 * between a wrong address and a raw dot path reaching a reader.
 *
 * The rest of this describe polices D12: REUSE FIRST, mint only what has a
 * rendering call site, and never mint a second name for a shipped term.
 */
describe("the player namespace (Story 2.15, AD-7 / D12)", () => {
  // Declared per-describe, the way every other block in this file does it.
  const locales: Locale[] = ["es", "en"];

  /*
   * BUILDER RESOLUTION LIVES IN THE KEY-BUILDER SWEEP, not here (code review
   * 2026-08-07) — see "resolves all three player-profile builders over their
   * full domain" in `describe("key-builder resolution sweep …")` above. This
   * describe had its own copy, which is exactly what 2.14's review had just
   * ruled against. What stays here is what is specific to this story: WHICH
   * shipped key each builder maps to, and that nothing was minted that could
   * have been reused.
   */
  it("REUSES the shipped speed-zone labels and bands - it mints neither", () => {
    /*
     * D12's table, asserted rather than trusted. `es.ts` warns in place that
     * restating these "would be two sources for one term"; the addresses below
     * are `expert.*`, which is what proves the reuse.
     */
    expect(speedZoneLabelKey(1)).toBe("expert.field.distanceZone1");
    expect(speedZoneBandKey(5)).toBe("expert.fieldTitle.distanceZone5");
    expect(es.expert.fieldTitle.distanceZone1).toBe("0-7 km/h");
    // The `player` namespace must carry NO zone label or band of its own.
    expect(JSON.stringify(es.player)).not.toContain("Zona ");
    expect(JSON.stringify(es.player)).not.toContain("km/h");
  });

  it("mints ONLY the heads the artifact has no shipped label for", () => {
    /*
     * `attemptsAtGoal` and `passesAttempted` are NOT MetricCodes (Story 1.18),
     * so their heads come from `expert.field.*`; every metric head comes from
     * `enums.leaderboardMetric.*`. What was genuinely missing is the five
     * per-match heads plus the transposed table's two, which no
     * metric-per-column surface has.
     */
    expect(Object.keys(es.player.column).sort()).toEqual([
      "date",
      "metric",
      "minutesPlayed",
      "opponent",
      "speedBand",
      "speedZone",
      "stage",
      "started",
      "value",
    ]);
    for (const locale of locales) {
      expect(t("expert.field.attemptsAtGoal", locale)).not.toBe("");
      expect(t("expert.field.passesAttempted", locale)).not.toBe("");
    }
  });

  it("adds NO Domain G label to the SEALED enums.metric namespace", () => {
    // enums.metric is pinned to KEY_STAT_FIELDS (19 Domain B fields) elsewhere
    // in this file; this asserts Story 2.15 did not widen it.
    expect(Object.keys(es.enums.metric).sort()).toEqual([...KEY_STAT_FIELDS].sort());
  });

  it("gives the region's states DISTINCT copy, so none stands in for another", () => {
    /*
     * A fetch that never arrived, a payload that arrived at the wrong version, a
     * render-time crash and a load in progress are four different facts. Copy
     * that collapses any two tells the reader something false about what went
     * wrong and about whether retrying can help.
     */
    for (const locale of locales) {
      const states = [
        t("player.region.loading", locale),
        t("player.region.loaded", locale),
        t("player.region.error", locale),
        t("player.region.invalid", locale),
        t("player.region.crashed", locale),
      ];
      expect(new Set(states).size, `player.region.* in ${locale}`).toBe(states.length);
    }
  });

  it("keeps the empty-state copy off the match-scoped composition", () => {
    /*
     * `useEmptyHeadline()` composes "Sin datos de {seccion} PARA ESTE PARTIDO",
     * which is FALSE on a route that is not a match - which is why this route
     * authors its own pair. This asserts the profile copy did not inherit that
     * clause.
     */
    for (const locale of locales) {
      for (const key of [
        "player.empty.trendsHeadline",
        "player.empty.trendsExplanation",
        "player.empty.matchesHeadline",
        "player.empty.matchesExplanation",
      ] as const) {
        expect(t(key, locale), key).not.toBe("");
        expect(t(key, locale), key).not.toContain(t("tactical.empty.headlineAfter", locale));
      }
    }
  });

  it("gives the four tables distinct names, since one live region serves them all", () => {
    for (const locale of locales) {
      const names = [
        t("player.tableName.physical", locale),
        t("player.tableName.trends", locale),
        t("player.tableName.aggregates", locale),
        t("player.tableName.matches", locale),
      ];
      expect(new Set(names).size, `player.tableName.* in ${locale}`).toBe(names.length);
    }
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

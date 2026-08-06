import { describe, expect, it } from "vitest";

import {
  GLOSSARY_GLOSS_KEY,
  GLOSSARY_POLICY,
  GLOSSARY_TERMS,
  findTermSpan,
  glossaryDefinitionKey,
  glossaryTermEnKey,
  glossaryTermEsKey,
  type GlossaryTermId,
} from "@/lib/glossary";

/*
 * The glossary registry is the ONLY part of Story 2.18 a node-only harness can
 * test (no jsdom). Everything rendered is proved live in Task 11.
 */

/*
 * WRITTEN OUT AS A LITERAL, deliberately (Task 2.3). Comparing GLOSSARY_TERMS
 * against Object.keys(GLOSSARY_ORDER) would be derived-vs-derived and could not
 * catch the reordering this test exists to catch — /glossary renders this order
 * to the reader, and the order is EXPERIENCE.md's policy-table order, not
 * alphabetical. The 2.10 frozen-Record tests do it this way.
 */
const EXPECTED_ORDER: readonly GlossaryTermId[] = [
  "line-break",
  "counter-press",
  "pressing",
  "build-up",
  "high-block",
  "mid-block",
  "low-block",
  "line-height",
  "team-length",
  "phases-of-play",
  "xg",
  "pass-network",
  "speed-zones",
  "high-speed-run",
  "sprint",
  "take-on",
  "step-in",
  "second-ball",
  "forced-turnover",
  "ball-progression",
  "reception-in-final-third",
  "set-play",
  "momentum",
  "goal",
  "on-target",
  "off-target",
  "blocked",
  "incomplete",
  "goalkeeper",
  "save",
  "distribution",
  "coming-off-the-line",
  "one-on-one",
  "defender",
  "midfielder",
  "forward",
  "corner",
  "offside",
  "cross",
  "offers-to-receive",
  "movement-to-receive",
  "defensive-actions",
];

describe("GLOSSARY_TERMS (ruled decision 10)", () => {
  it("is the policy-table order, exactly", () => {
    expect([...GLOSSARY_TERMS]).toEqual([...EXPECTED_ORDER]);
  });

  it("carries no duplicate ids", () => {
    expect(new Set(GLOSSARY_TERMS).size).toBe(GLOSSARY_TERMS.length);
  });

  it("uses language-neutral lower-case slugs (ruled decision 11)", () => {
    // The anchor is /glossary/#build-up, and the URL carries no language: an
    // uppercase character or a space would break the deep link.
    for (const id of GLOSSARY_TERMS) {
      expect(id, id).toBe(id.toLowerCase());
      expect(id, id).not.toContain(" ");
      expect(id, id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("expands the set-rows the policy table names as sets", () => {
    // A GlossaryTermId of `high-mid-low-block` has no coherent term pair and no
    // counterpart-language subtitle, which is why the rows are expanded.
    for (const id of ["high-block", "mid-block", "low-block"] as const) {
      expect(GLOSSARY_TERMS).toContain(id);
    }
    for (const id of ["goal", "on-target", "off-target", "blocked", "incomplete"] as const) {
      expect(GLOSSARY_TERMS).toContain(id);
    }
    for (const id of ["distribution", "coming-off-the-line", "one-on-one"] as const) {
      expect(GLOSSARY_TERMS).toContain(id);
    }
    for (const id of ["goalkeeper", "defender", "midfielder", "forward"] as const) {
      expect(GLOSSARY_TERMS).toContain(id);
    }
  });

  it("carries every NOT-YET-USED policy row that is a term (AC 1's discharge)", () => {
    // AC 1's "implemented verbatim" is discharged HERE for the rows whose
    // surfaces ship in 2.11-2.16: a real es entry with a real definition, not a
    // dead viz.*/enums.* key. The scaffolding rows (result letters & standings
    // columns, standings / leaderboards, fouls / duels) get no glossary id and
    // are NOT discharged anywhere yet — their surfaces ship in 2.11-2.16 and
    // minting keys for an absent surface is the dead-key defect AC 1 prohibits.
    // They are deferred by name in deferred-work.md (2.18 code review).
    for (const id of [
      "speed-zones",
      "high-speed-run",
      "take-on",
      "step-in",
      "offside",
      "coming-off-the-line",
      "one-on-one",
    ] as const) {
      expect(GLOSSARY_TERMS).toContain(id);
    }
  });

  it("mints no ShotOutcomeDetail id, now that CS-1 HAS landed", () => {
    /*
     * RETITLED, NOT DELETED (Story 2.13 ruling 5) — the assertion is
     * byte-identical; only the name and this comment changed. CS-1 landed at
     * 093a1b2 (schemaVersion 2 -> 3; CS-2 has since taken it to 4) and the
     * 24-value `ShotOutcomeDetail` enum exists. No glossary id names one, on
     * purpose: AD-14 decision CR-2 makes `outcome` authoritative and forbids
     * deriving marker encoding from the detail.
     *
     * NOTE FOR THE NEXT READER, because this one is BLUNTER THAN ITS NAME: the
     * check is `not.toContain("detail")` over the whole id, so it will reject
     * ANY future glossary id containing the substring "detail" — not merely a
     * ShotOutcomeDetail one. If a legitimate term ever needs that word, narrow
     * the assertion rather than assuming this test has caught a real violation.
     */
    for (const id of GLOSSARY_TERMS) {
      expect(id).not.toContain("detail");
    }
  });
});

describe("GLOSSARY_POLICY", () => {
  it("is total over GLOSSARY_TERMS and carries nothing else", () => {
    expect(Object.keys(GLOSSARY_POLICY).sort()).toEqual([...GLOSSARY_TERMS].sort());
  });

  it("keeps the three English terms the table rules as jargon/tooltip", () => {
    expect(GLOSSARY_POLICY.xg).toBe("jargon");
    expect(GLOSSARY_POLICY.sprint).toBe("jargon");
    expect(GLOSSARY_POLICY.momentum).toBe("tooltip");
  });

  it("rules every other term as translate", () => {
    for (const id of GLOSSARY_TERMS) {
      if (id === "xg" || id === "sprint" || id === "momentum") {
        continue;
      }
      expect(GLOSSARY_POLICY[id], id).toBe("translate");
    }
  });
});

describe("key builders", () => {
  it("produce the literal expected strings", () => {
    // Literals, not template re-derivations: a builder that composed the wrong
    // path would reproduce its own bug in a template-built expectation.
    expect(glossaryTermEsKey("build-up")).toBe("glossary.build-up.es");
    expect(glossaryTermEnKey("build-up")).toBe("glossary.build-up.en");
    expect(glossaryDefinitionKey("build-up")).toBe("glossary.build-up.definition");
    expect(glossaryTermEsKey("xg")).toBe("glossary.xg.es");
    expect(glossaryDefinitionKey("movement-to-receive")).toBe(
      "glossary.movement-to-receive.definition"
    );
  });

  it("stay under the glossary namespace for every id", () => {
    for (const id of GLOSSARY_TERMS) {
      expect(glossaryTermEsKey(id)).toBe(`glossary.${id}.es`);
      expect(glossaryTermEnKey(id)).toBe(`glossary.${id}.en`);
      expect(glossaryDefinitionKey(id)).toBe(`glossary.${id}.definition`);
    }
  });
});

describe("GLOSSARY_GLOSS_KEY (ruled decision 13)", () => {
  it("points xG at the already-ruled expansion rather than a second copy", () => {
    expect(GLOSSARY_GLOSS_KEY.xg).toBe("match.hero.xgExpansion");
  });

  it("gives sprint and momentum no gloss — they render nothing", () => {
    expect(GLOSSARY_GLOSS_KEY.sprint).toBeUndefined();
    expect(GLOSSARY_GLOSS_KEY.momentum).toBeUndefined();
  });

  it("names only ids that exist", () => {
    for (const id of Object.keys(GLOSSARY_GLOSS_KEY)) {
      expect(GLOSSARY_TERMS).toContain(id as GlossaryTermId);
    }
  });
});

/*
 * findTermSpan is what makes "mark one term per section" work against copy that
 * was frozen before this story existed. Every case below is a REAL string from
 * the shipped dictionary or from this story's own remediation.
 */
describe("findTermSpan", () => {
  it("finds an exact term and marks it", () => {
    const text = "Altura de la línea defensiva e intensidad de la presión.";
    const span = findTermSpan(text, "altura de la línea defensiva");
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe("Altura de la línea defensiva");
  });

  it("is case-insensitive — the en momentum heading depends on it", () => {
    const span = findTermSpan("Momentum timeline", "momentum");
    expect(span).not.toBeNull();
    expect("Momentum timeline".slice(span!.start, span!.end)).toBe("Momentum");
  });

  it("extends a singular term over the plural surface form", () => {
    const text = "Desde dónde llegaron los tiros y los centros de cada equipo.";
    const span = findTermSpan(text, "centro");
    expect(text.slice(span!.start, span!.end)).toBe("centros");
  });

  it("matches a multi-word term whose first word is pluralised in the copy", () => {
    // The ruled term is singular ("tiro de esquina"); the remediated set-plays
    // summary opens with "Tiros de esquina".
    const text = "Tiros de esquina, tiros libres y saques de banda: cuántos y con qué resultado.";
    const span = findTermSpan(text, "tiro de esquina");
    expect(text.slice(span!.start, span!.end)).toBe("Tiros de esquina");
  });

  it("matches the en plural of a single-word term", () => {
    const text = "Where each team's shots and crosses came from.";
    const span = findTermSpan(text, "cross");
    expect(text.slice(span!.start, span!.end)).toBe("crosses");
  });

  it("stops at a non-word character rather than swallowing punctuation", () => {
    const text = "Altura de la línea defensiva e intensidad de la presión.";
    const span = findTermSpan(text, "presión");
    expect(text.slice(span!.start, span!.end)).toBe("presión");
  });

  it("returns null when the copy was reworded — marking degrades, never crashes", () => {
    expect(findTermSpan("Cómo se repartió el partido entre ataque y defensa.", "fases del juego"))
      .toBeNull();
    expect(findTermSpan("", "centro")).toBeNull();
    expect(findTermSpan("Estadísticas clave", "  ")).toBeNull();
  });

  it("treats regex metacharacters in a term as literal text", () => {
    // No dictionary term carries one today; a future amendment must not turn a
    // copy string into a pattern.
    expect(findTermSpan("a+b is not a-b", "a+b")).toEqual({ start: 0, end: 3 });
  });
});

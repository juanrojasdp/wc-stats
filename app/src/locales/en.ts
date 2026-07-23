import type { Dictionary } from "./es";

/*
 * Type-mirrored English dictionary (AD-12): `Dictionary` is derived from the
 * canonical `es`, so a missing or extra key here is a compile error.
 */
export const en: Dictionary = {
  app: {
    siteName: "WC Stats",
    scaffold: {
      heading: "Design system scaffold",
      body: "This page proves the tokens, the self-hosted fonts and the locale layer. Real tournament content arrives with the next stories.",
      statLabel: "Sample xG",
    },
  },
  a11y: {
    scaffold: {
      demoRegion: "Design token demo",
    },
  },
  meta: {
    title: "WC Stats — 2026 World Cup Analytics",
    description: "Tactical and statistical analysis of all 104 matches of the 2026 World Cup.",
  },
  enums: {
    stage: {},
    position: {},
    shotOutcome: {},
    metric: {},
    unit: {},
  },
};

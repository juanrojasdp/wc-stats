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
    localeAnnouncement: "Language: English",
  },
  chrome: {
    skipLink: "Skip to content",
    languageToggle: {
      label: "Language",
      es: "ES",
      en: "EN",
      // Each segment is named in its own language in BOTH locales.
      esFull: "Español",
      enFull: "English",
    },
    themeToggle: {
      label: "Light theme",
    },
    footer: {
      attribution:
        "Data: official FIFA Post-Match Summary Reports — 2026 World Cup. Independent site, not affiliated with FIFA.",
      aboutLink: "About this site",
    },
  },
  about: {
    title: "About this site",
  },
  notFound: {
    message: "This page does not exist. Were you looking for a match?",
    homeLink: "Back to home",
  },
  meta: {
    title: "WC Stats — 2026 World Cup Analytics",
    description: "Tactical and statistical analysis of all 104 matches of the 2026 World Cup.",
  },
  match: {
    hero: {
      group: "Group",
      localTime: "local time",
      scoreSeparator: "–",
      ownGoal: "(o.g.)",
      penalty: "(pen.)",
      extraTime: "Decided in extra time",
      shootout: "Penalties:",
      leader: "leader",
      xg: "xG",
      xgExpansion: "expected goals",
      tiles: {
        possession: "Possession",
        shots: "Shots",
        distance: "Distance (km)",
        topSpeed: "Top speed (km/h)",
      },
      lineups: {
        title: "Line-ups and formations",
        summary: "starters and substitutes",
        starters: "Starters",
        substitutes: "Substitutes",
        formation: "Formation",
      },
    },
    meta: {
      separator: " · ",
      penShort: "pen.",
    },
    bundle: {
      loaded: "Data loaded.",
      error: "We could not load the data. Check your connection and try again.",
      retry: "Retry",
      loading: "Loading match data",
    },
  },
  enums: {
    stage: {
      group: "Group stage",
      r32: "Round of 32",
      r16: "Round of 16",
      qf: "Quarter-final",
      sf: "Semi-final",
      "third-place": "Third place",
      final: "Final",
    },
    position: {
      gk: "Goalkeeper",
      df: "Defender",
      mf: "Midfielder",
      fw: "Forward",
    },
    shotOutcome: {},
    metric: {},
    unit: {},
  },
};

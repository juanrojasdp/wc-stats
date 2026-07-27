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
      invalid: "This match's data does not match this version of the site.",
      invalidExplanation: "We are aware of it. Please try again later.",
      crashed: "We could not display the tactical analysis for this match.",
      crashedExplanation: "The rest of the page is still available.",
    },
  },
  tactical: {
    sections: {
      "key-stats": {
        title: "Key statistics",
      },
      momentum: {
        title: "Momentum timeline",
      },
      "shot-maps": {
        title: "Shot map & xG",
        summary: "Where and when each team's shots came from.",
      },
      "pass-networks": {
        title: "Pass networks",
        summary: "Who connected with whom, and where the ball circulated.",
      },
      "offers-to-receive": {
        title: "Offers to receive",
        summary: "How often players asked for the ball, and how often it arrived.",
      },
      "movement-to-receive": {
        title: "Movement to receive",
        summary: "How players moved off the ball to receive in space.",
      },
      "defensive-actions": {
        title: "Defensive actions",
        summary: "Where each team regained the ball and forced turnovers.",
      },
      phases: {
        title: "Phases of play",
        summary: "How the match split between attack, transition and defence.",
      },
      pressing: {
        title: "Pressing & defensive blocks",
        summary: "Defensive line height and pressing intensity.",
      },
      "set-plays": {
        title: "Set plays",
        summary: "Corners, free kicks and throw-ins: how many, and to what effect.",
      },
      goalkeeping: {
        title: "Goalkeeping",
        summary: "Goalkeeper interventions, distribution and aerial play.",
      },
    },
    empty: {
      headlineBefore: "No data for",
      headlineAfter: "in this match.",
      explanation: "The official report does not include this section.",
    },
    pending: {
      headline: "This section is not on the site yet.",
      explanation: "We are building this view; the data is already in the report.",
    },
    keyStats: {
      showAll: "View all statistics",
      showLess: "View fewer statistics",
      contested: "Contested possession:",
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
    metric: {
      possession: "Possession",
      goals: "Goals",
      expectedGoals: "xG",
      shots: "Shots",
      shotsOnTarget: "Shots on target",
      passes: "Passes",
      passesCompleted: "Completed passes",
      passCompletion: "Pass accuracy",
      completedLineBreaks: "Completed line breaks",
      defensiveLineBreaks: "Defensive line breaks",
      receptionsInFinalThird: "Receptions in final third",
      crosses: "Crosses",
      ballProgressions: "Ball progressions",
      defensivePressures: "Defensive pressures",
      directPressures: "Direct pressures",
      forcedTurnovers: "Forced turnovers",
      secondBalls: "Second balls",
      distanceCovered: "Distance",
      sprintDistance: "Sprint distance",
    },
    unit: {
      km: "km",
    },
  },
};

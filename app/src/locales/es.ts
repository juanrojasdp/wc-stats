/*
 * Canonical dictionary (AD-12): Spanish is the source of truth; every other
 * locale is a typed mirror of this shape. Leaves are plain strings (no
 * `as const`) so mirrors may differ in value but never in shape.
 *
 * Register: tuteo, neutral LatAm, no exclamation marks.
 *
 * The empty `enums` namespaces are reserved structure: enum→label maps and
 * unit labels are locale-layer metadata keyed by artifact codes (AD-7).
 * Per-surface stories extend them; the scaffold only fixes the shape.
 */
export const es = {
  app: {
    siteName: "WC Stats",
    scaffold: {
      heading: "Andamiaje del sistema de diseño",
      body: "Esta página comprueba los tokens, las fuentes autoalojadas y la capa de idiomas. El contenido real del torneo llega con las siguientes historias.",
      statLabel: "xG de ejemplo",
    },
  },
  a11y: {
    scaffold: {
      demoRegion: "Demostración de tokens de diseño",
    },
    // Announced in the TARGET language on switch (WCAG 4.1.3, ruled strings).
    localeAnnouncement: "Idioma: Español",
  },
  chrome: {
    skipLink: "Saltar al contenido",
    languageToggle: {
      label: "Idioma",
      es: "ES",
      en: "EN",
      esFull: "Español",
      enFull: "English",
    },
    themeToggle: {
      // Stable accessible name (2.2 review): the toggle is named for the
      // light theme; aria-pressed carries whether it is active.
      label: "Tema claro",
    },
    footer: {
      // Ruled copy, verbatim (EXPERIENCE.md → i18n & Terminology → Attribution OQ-3).
      attribution:
        "Datos: informes oficiales post-partido de la FIFA — Copa Mundial 2026. Sitio independiente, sin afiliación con la FIFA.",
      aboutLink: "Acerca del sitio",
    },
  },
  about: {
    title: "Acerca del sitio",
  },
  notFound: {
    // Ruled copy, verbatim (EXPERIENCE.md → State Patterns → Unknown route).
    message: "Esta página no existe. ¿Buscabas un partido?",
    homeLink: "Volver al inicio",
  },
  meta: {
    title: "WC Stats — Analítica del Mundial 2026",
    description: "Análisis táctico y estadístico de los 104 partidos de la Copa Mundial 2026.",
  },
  match: {
    hero: {
      // Stage-chip group suffix (Task 3.3): "Fase de grupos · Grupo A".
      group: "Grupo",
      // Context line trailing clarifier: kickoff is venue-local wall-clock.
      localTime: "hora local",
      // En-dash between scoreline numbers; routed through the layer so the
      // score row carries no hardcoded JSX text (AD-12 gate).
      scoreSeparator: "–",
      // Scorer-line suffixes (ruled decision 3 — no UX convention existed).
      ownGoal: "(a.g.)",
      penalty: "(pen.)",
      // decidedBy captions beneath the score row (Task 3.6).
      extraTime: "Definido en tiempo extra",
      shootout: "Penales:",
      // Story-Stat leader marker (Task 4.2) — appended to the sr-only name.
      leader: "líder",
      // xG glossary term + its sr-only expansion (Task 4.4).
      xg: "xG",
      xgExpansion: "goles esperados",
      tiles: {
        possession: "Posesión",
        shots: "Tiros",
        distance: "Distancia (km)",
        topSpeed: "Vel. máx. (km/h)",
      },
      lineups: {
        title: "Alineaciones y formaciones",
        // Summary line tail after the two formation strings.
        summary: "titulares y suplentes",
        starters: "Titulares",
        substitutes: "Suplentes",
        formation: "Formación",
      },
    },
    // Title/OG composition fragments (Task 2.2). Punctuation only — the
    // fragments themselves are locale-neutral but registered so the composer
    // never hardcodes them.
    meta: {
      separator: " · ",
      penShort: "pen.",
    },
    // Below-Hero client lifecycle (Task 6): announcement + inline retry panel.
    bundle: {
      loaded: "Datos cargados.",
      error: "No pudimos cargar los datos. Revisa tu conexión e intenta de nuevo.",
      retry: "Reintentar",
      // aria-label for the aria-busy skeleton container (no visible text).
      loading: "Cargando datos del partido",
    },
  },
  /*
   * Tactical Layer (Story 2.5). `sections` carries one title per section and a
   * summary for the NINE collapsible ones only — key-stats and momentum never
   * collapse, so a summary key for them would be dead copy. Summaries are
   * static descriptive copy in this story (ruled decision 2); stories 2.6-2.10
   * may replace their own with artifact-sourced values when they own the data.
   */
  tactical: {
    sections: {
      "key-stats": {
        title: "Estadísticas clave",
      },
      momentum: {
        title: "Línea de momentum",
      },
      "shot-maps": {
        title: "Mapa de tiros y xG",
        summary: "Desde dónde y cuándo llegaron los tiros de cada equipo.",
      },
      "pass-networks": {
        title: "Red de pases",
        summary: "Quién conectó con quién y por dónde circuló el balón.",
      },
      "offers-to-receive": {
        title: "Ofrecimientos para recibir",
        summary: "Cuántas veces se pidió el balón y cuántas llegó el pase.",
      },
      "movement-to-receive": {
        title: "Desmarques",
        summary: "Cómo se movieron sin balón para recibir con ventaja.",
      },
      "defensive-actions": {
        title: "Acciones defensivas",
        summary: "Dónde recuperó cada equipo y dónde forzó las pérdidas.",
      },
      phases: {
        title: "Fases del juego",
        summary: "Cómo se repartió el partido entre ataque, transición y defensa.",
      },
      pressing: {
        title: "Presión y bloques defensivos",
        summary: "Altura de la línea defensiva e intensidad de la presión.",
      },
      "set-plays": {
        title: "Balón parado",
        summary: "Córners, tiros libres y laterales: cuántos y con qué resultado.",
      },
      goalkeeping: {
        title: "Arqueros",
        summary: "Intervenciones, distribución y juego aéreo de los arqueros.",
      },
    },
    /*
     * Ruled decision 1: the copy carries no section name. EXPERIENCE's
     * "Sin datos de {sección}…" is a template slot and t() has no
     * interpolation by design; the section is named by the <h2> directly
     * above the panel.
     */
    empty: {
      headline: "Sin datos de esta sección para este partido.",
      explanation: "El informe oficial no incluye esta sección.",
    },
    /*
     * Ruled decision 9: a section whose data IS in the bundle but whose
     * content component has not shipped yet gets this, never the empty state
     * — claiming the report omits present data is the dishonesty FR-22 exists
     * to prevent.
     */
    pending: {
      headline: "Esta sección aún no está disponible en el sitio.",
      explanation: "Estamos construyendo esta vista; los datos ya están en el informe.",
    },
    keyStats: {
      showAll: "Ver todas las estadísticas",
      showLess: "Ver menos estadísticas",
      contested: "Posesión disputada:",
    },
  },
  enums: {
    // Tournament stage labels, keyed by the Stage enum codes (AD-7).
    stage: {
      group: "Fase de grupos",
      r32: "Dieciseisavos de final",
      r16: "Octavos de final",
      qf: "Cuartos de final",
      sf: "Semifinal",
      "third-place": "Tercer puesto",
      final: "Final",
    },
    // Lineup position labels, keyed by the Position enum codes.
    position: {
      gk: "Arquero",
      df: "Defensa",
      mf: "Mediocampista",
      fw: "Delantero",
    },
    shotOutcome: {},
    /*
     * Metric labels keyed by the artifact FIELD name. MetricCode is
     * deliberately string-identical to the field it ranks, so Story 2.13
     * inherits eighteen of these for free (`directPressures` is the one field
     * that is not a MetricCode).
     */
    metric: {
      possession: "Posesión",
      goals: "Goles",
      expectedGoals: "xG",
      shots: "Tiros",
      shotsOnTarget: "Tiros al arco",
      passes: "Pases",
      passesCompleted: "Pases completados",
      passCompletion: "Precisión de pases",
      completedLineBreaks: "Rupturas de líneas completadas",
      defensiveLineBreaks: "Rupturas de líneas defensivas",
      receptionsInFinalThird: "Recepciones en el último tercio",
      crosses: "Centros",
      ballProgressions: "Progresiones de balón",
      defensivePressures: "Presiones defensivas",
      directPressures: "Presiones directas",
      forcedTurnovers: "Recuperaciones forzadas",
      secondBalls: "Segundas jugadas",
      distanceCovered: "Distancia",
      sprintDistance: "Distancia en sprint",
    },
    // Units are locale metadata, never baked into a label string (AD-7).
    unit: {
      km: "km",
    },
  },
};

export type Dictionary = typeof es;

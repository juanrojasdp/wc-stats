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
      /*
       * A payload that arrived intact but failed the matchId/schemaVersion
       * gate is NOT a network failure: telling the reader to check their
       * connection misnames the cause, and re-fetching the same artifact can
       * never fix it, so this branch carries no retry.
       */
      invalid: "Los datos de este partido no coinciden con esta versión del sitio.",
      invalidExplanation: "Estamos al tanto. Vuelve a intentarlo más tarde.",
      // Fallback when the Tactical Layer itself throws while rendering.
      crashed: "No pudimos mostrar el análisis táctico de este partido.",
      crashedExplanation: "El resto de la página sigue disponible.",
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
      /*
       * Story 2.7 ruled decision 11: the old title "Mapa de tiros y xG"
       * promised a per-shot xG that FD-1 established does not exist in the
       * source PDFs, and the section now carries TWO maps (ruled decision 1:
       * the cross map is a second panel inside #shot-maps, so the registry
       * stays at eleven sections).
       */
      "shot-maps": {
        title: "Mapa de tiros y centros",
        summary: "Desde dónde llegaron los tiros y los centros de cada equipo.",
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
    /*
     * AC 3's copy names the section: "Sin datos de {sección} para este
     * partido." t() carries no interpolation by design, so the caller composes
     * the headline around the section's own resolved <h2> title, which
     * TacticalLayer already holds — no per-section keys, no interpolation.
     */
    empty: {
      headlineBefore: "Sin datos de",
      headlineAfter: "para este partido.",
      explanation: "El informe oficial no incluye esta sección.",
      /*
       * UX-DR13 / EXPERIENCE.md:92 require a DEDICATED sentence for this one
       * section, not the generic composition above (Story 2.6 decision 12).
       * Applied through a per-section override at TacticalLayer's `headline=`
       * prop; useEmptyHeadline() stays the default for the other ten and is
       * NOT forked. Quoted verbatim from UX-DR13.
       */
      momentumHeadline: "La línea de momentum no está disponible para este partido.",
      /*
       * Story 2.9 ruled decision 4. The two receiving sections are "empty" when
       * `bundle.players === null` (ruled decision 3), and the generic
       * explanation — "El informe oficial no incluye esta sección." — would be
       * a FALSE STATEMENT there: a Domain G absence is not a receiving-section
       * absence, and the report's receiving pages may be perfectly present.
       * Shipping that sentence would be the same dishonesty EmptyStatePanel's
       * own docblock exists to prevent, and the mirror of the FR-22 inversion
       * decision 3 cites as its own justification. So BOTH halves are
       * overridden, and the copy names the real absence: the per-player data.
       */
      receivingHeadline: "Sin datos por jugador para este partido.",
      receivingExplanation:
        "Esta sección se arma con las tablas por jugador del informe, y este informe no las trae.",
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
  /*
   * Pitch-panel copy (Story 2.7). Every string that reaches a marker's
   * accessible name, a popover row, a legend entry, a column head or the
   * attribution caption lives here — the viz modules under src/viz return
   * dictionary KEYS and raw values, and the components resolve them.
   *
   * Counters carry a singular AND a plural form. t() has no interpolation and
   * no plural machinery, so "1 gol" vs "2 goles" is a two-key choice made at
   * the call site; a single "goles" would render "1 goles" over m074 Paraguay's
   * map, which is a visible copy defect in both languages.
   */
  viz: {
    // EXPERIENCE's ruled in-panel short form (OQ-3), verbatim. Permanent,
    // never conditional, never behind a disclosure — it must survive a
    // screenshot (UX-DR21, UJ-2 step 5).
    attribution: "Datos: FIFA PMSR · wc-stats",
    // The ONE canonical control string for the data-table alternative.
    viewData: "Ver los datos",
    hideData: "Ocultar los datos",
    teamSelector: "Equipo",
    table: {
      caption: "Ordenado por minuto.",
      team: "Equipo",
      player: "Jugador",
      minute: "Minuto",
      x: "X",
      y: "Y",
      outcome: "Resultado",
      xg: "xG",
      delivery: "Tipo de centro",
      completed: "Completado",
      // The placeholder for a CrossEvent field the source page cannot fill.
      unknown: "—",
      yes: "Sí",
      no: "No",
      // Pass-network columns, shared by the node popover rows and both tables.
      shirt: "Dorsal",
      involvement: "Participación",
      connections: "Conexiones",
      from: "Desde",
      to: "Hacia",
      passes: "Pases",
      /*
       * Each pass-network table STATES ITS OWN ORDER (UX-DR12 requires one).
       * Deliberately NOT viz.table.caption, whose value is "Ordenado por
       * minuto." — a false statement on rows that have no clock.
       */
      captionNodes: "Ordenado por equipo y dorsal.",
      captionEdges: "Ordenado por equipo y número de pases, de mayor a menor.",
      // Story 2.9 columns, shared by the defensive popover, the defensive log
      // and the two receiving tables.
      actionType: "Tipo de acción",
      contestType: "Tipo de disputa",
      offersMade: "Ofrecimientos",
      offersReceived: "Recibidos",
      receivedPct: "% recibido",
      players: "Jugadores",
      total: "Total",
    },
    cluster: {
      dialogLabel: "Eventos en este punto",
      countBefore: "Punto con",
      countAfter: "eventos",
    },
    // SPOKEN placeholders for a marker's accessible name. Deliberately not
    // viz.table.unknown: an em dash is a typographic mark that most screen
    // readers announce as nothing, so "Tiro de —, —, bloqueado" degraded to
    // "Tiro de, , bloqueado". The table keeps the em dash; speech gets words.
    marker: {
      unknownPlayer: "jugador desconocido",
      unknownMinute: "minuto desconocido",
      /*
       * Spoken pinned state for markers that carry no aria-pressed — clustered
       * ones, which open a dialog instead of toggling (2.8 review). Appended to
       * the accessible name so the pin has a non-visual carrier on the majority
       * of nodes, without claiming the element is a toggle button.
       */
      pinned: "aislado",
    },
    shotMap: {
      title: "Mapa de tiros",
      markerPrefix: "Tiro de",
      minutePrefix: "minuto",
      shots: "tiros",
      shotsOne: "tiro",
      goals: "goles",
      goalsOne: "gol",
      xg: "xG",
      figurePrefix: "Mapa de tiros:",
      zero: "El informe no registra tiros para este equipo.",
      ownGoalsExcluded: "Los autogoles no se dibujan en el mapa; aparecen en la tabla.",
    },
    crossMap: {
      title: "Mapa de centros",
      markerPrefix: "Centro de",
      minutePrefix: "minuto",
      crosses: "centros",
      crossesOne: "centro",
      completed: "Completado",
      attempted: "Intentado",
      // Lower-case for the panel's count chip ("21 centros · 9 completados").
      // The singular exists for the same reason goalsOne does: without it a
      // team with one completed cross reads "1 completados".
      completedCount: "completados",
      completedCountOne: "completado",
      figurePrefix: "Mapa de centros:",
      zero: "El informe no registra centros para este equipo.",
    },
    passNetwork: {
      title: "Red de pases",
      figurePrefix: "Red de pases:",
      /*
       * The accessible name is a name / role / VALUE triple (UX-DR16), and the
       * marker's middle clause carries the value: "Jugador Raul RANGEL,
       * participación 80 pases y 6 conexiones, nodo de la red de pases". The
       * connection count lives in the NAME because edges are aria-hidden by
       * construction and the detail panel is aria-hidden too — it is the sole
       * non-visual handle on what isolating this node would highlight.
       */
      markerPrefix: "Jugador",
      involvementPrefix: "participación",
      nameJoin: "y",
      nodeRole: "nodo de la red de pases",
      players: "jugadores",
      playersOne: "jugador",
      connectionsCount: "conexiones",
      connectionsCountOne: "conexión",
      passes: "pases",
      passesOne: "pase",
      zero: "El informe no registra una red de pases para este equipo.",
      // No on-pitch text labels exist (an 11 px numeral does not fit a 10-20 px
      // circle at 390 px), so the note is what explains the size channel.
      nodeNote: "Nodo: jugador · el tamaño indica la participación.",
      /*
       * The legend labels its five bands with bare integers ("1–4", "5–7", …)
       * and every swatch is aria-hidden, so without this the panel stated five
       * naked numbers with no unit anywhere — and nodeNote explains the SIZE
       * channel only, never the ramp (2.8 review). Decision 4's whole case for
       * labelled bands is that stating the numbers makes a ramp whose adjacent
       * stops separate by ~1.3:1 legible; numbers without a unit state nothing.
       */
      edgeNote: "Línea: pases entre dos jugadores · el grosor y el color indican cuántos.",
      // EXPERIENCE's ruled <md declutter control, verbatim. Same "declutter
      // without deleting" grammar as tactical.keyStats.showAll.
      showAll: "Mostrar todos los pases",
      showLess: "Mostrar menos pases",
    },
    /*
     * Momentum Timeline (Story 2.6). The section TITLE stays "Línea de
     * momentum" — a ruled product concept with a ruled i18n treatment
     * (EXPERIENCE.md:259 keeps the English term) — but the contract is emphatic
     * that the series is a per-minute count of FINAL-THIRD DISTRIBUTIONS, "NOT
     * a possession percentage and not an abstract momentum index; the App's own
     * copy must not imply otherwise". So the real metric is named everywhere a
     * number is: the subtitle, the y-axis, the figure label, the aria-valuetext
     * and the table column heads (decision 13).
     */
    momentum: {
      figurePrefix: "Línea de momentum:",
      metricNote: "Entradas al último tercio por minuto, por equipo.",
      axisMinute: "Minuto",
      axisEntries: "Entradas al último tercio",
      cursorLabel: "Cursor de minuto: mueve con las flechas para leer cada minuto.",
      minutePrefix: "Minuto",
      entries: "entradas",
      entriesOne: "entrada",
      goals: "goles",
      goalsOne: "gol",
      minutes: "minutos",
      minutesOne: "minuto",
      goalPrefix: "Gol de",
      ownGoal: "en propia puerta",
      penalty: "de penal",
      // Spoken when a goal's stamp is not on the sample grid and its marker was
      // placed on the nearest minute instead. Without it the chart, the table
      // and the marker's own name each claim a different position, silently.
      approximate: "posición aproximada",
      // This table states ITS OWN order — deliberately not viz.table.caption,
      // whose "Ordenado por minuto." is a different claim on a grid whose
      // minute is not unique.
      tableCaption: "Ordenado por minuto de partido, incluido el tiempo añadido.",
      tableGoal: "Gol",
    },
    /*
     * STORY 2.9 — the three sections FR-22 promises and the corpus reshaped.
     *
     * `#defensive-actions` is a real pitch map. `#offers-to-receive` and
     * `#movement-to-receive` are NOT maps and their copy must never imply they
     * are: Story 1.13 measured `ReceivingEvent` unfulfillable in every one of
     * its eight required fields, so there is no per-event receiving data of any
     * kind. Both read Domain G's whole-match per-player aggregates, and every
     * string below is written for aggregates — no minute, no position, no
     * "where".
     */
    offers: {
      title: "Ofrecimientos para recibir",
      figurePrefix: "Ofrecimientos para recibir:",
      // Tile labels. Short, because they sit under a large number at 320 px.
      madeLabel: "Ofrecimientos",
      receivedLabel: "Recibidos",
      receivedPctLabel: "% recibido",
      // Counters carry a singular AND a plural: t() has no plural machinery,
      // and "1 ofrecimientos" is a visible copy defect in both languages.
      offers: "ofrecimientos",
      offersOne: "ofrecimiento",
      received: "recibidos",
      receivedOne: "recibido",
      // The share is null when a team made no offers — never 0%, which would
      // claim every offer went unreceived.
      noShare: "sin ofrecimientos",
      zero: "El informe no registra ofrecimientos para este equipo.",
      // "No rows for this team" is NOT "this team made zero offers": the first
      // is an absence of Domain G data, the second a fact about the match.
      // Rendering the second for the first is the FR-22 failure mode inverted.
      noRows: "El informe no incluye datos por jugador de este equipo.",
      // Names the metric beside the numbers, as the momentum subtitle does.
      note: "Totales del partido, sumados sobre los jugadores del equipo.",
      // Each table STATES ITS OWN ORDER. Deliberately not viz.table.caption,
      // whose "Ordenado por minuto." is false on rows that carry no clock.
      totalsCaption: "Totales por equipo.",
      tableCaption: "Ordenado por equipo y dorsal.",
    },
    movement: {
      title: "Desmarques",
      figurePrefix: "Desmarques:",
      offers: "ofrecimientos",
      offersOne: "ofrecimiento",
      // The bar's segments carry no in-segment labels (the two smallest corpus
      // categories are 2.3% and 3.1%, ~7–9 px at 320 px, below DESIGN's 11 px
      // type floor), so this names the channel the value list decodes.
      barNote: "Cada barra reparte los ofrecimientos del equipo entre los seis tipos de desmarque.",
      zero: "El informe no registra ofrecimientos para este equipo.",
      totalsCaption: "Totales por equipo y tipo de desmarque.",
      tableCaption: "Ordenado por equipo y dorsal.",
    },
    defensiveActions: {
      title: "Acciones defensivas",
      markerPrefix: "Acción defensiva de",
      minutePrefix: "minuto",
      figurePrefix: "Acciones defensivas:",
      actions: "acciones",
      actionsOne: "acción",
      /*
       * The legend is ONE ENTRY PER TEAM (ruled decision 19): one shape, one
       * colour per team, so the two plottable action types are visually
       * identical and a per-type legend would claim a distinction the map does
       * not draw. This noun completes "MEX · acciones defensivas".
       */
      legendNoun: "acciones defensivas",
      zero: "El informe no registra acciones defensivas para este equipo.",
      /*
       * The log's caption when NO row carries a clock — the corpus case, where
       * `at` has no carrier at all and the minute column is gated away
       * entirely. viz.table.caption ("Ordenado por minuto.") would assert an
       * ordering the table does not have.
       */
      tableCaptionNoClock: "Ordenado por equipo; el informe no registra el minuto.",
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
    /*
     * The five-value marker outcome (Story 2.7 Task 10.2), verbatim from
     * EXPERIENCE's ruled i18n table row "shot outcomes (legend + log headers)".
     * ShotOutcomeDetail labels are deliberately ABSENT: its 22->24 extension is
     * CS-1's payload, and AD-14 decision CR-2 makes `outcome` authoritative for
     * marker encoding — the detail labels belong to Stories 2.11/2.13/2.18.
     */
    shotOutcome: {
      goal: "Gol",
      "on-target": "Al arco",
      "off-target": "Desviado",
      blocked: "Bloqueado",
      incomplete: "Incompleto",
    },
    /*
     * Cross delivery types (Story 2.7 ruled decision 10). New terms with no row
     * in EXPERIENCE's per-term table, decided here under its Spanish-first
     * tie-breaker. Short adjectives because they live in a table column whose
     * head already names the dimension ("Tipo de centro"); the long forms
     * ("centro cerrado") would wrap at 390 px, where Spanish already runs
     * 20-30 % longer than English.
     */
    crossDelivery: {
      inswing: "Cerrado",
      outswing: "Abierto",
      driven: "Tenso",
      lofted: "Bombeado",
      cutback: "Atrás",
      "push-cross": "Empujado",
    },
    /*
     * The six OfferMovementType codes (Story 2.9 Task 7.3), keyed by contract
     * code per AD-7. LatAm register (UX-DR19): "desmarque" is the regional term
     * for the movement itself, so the enum labels name the DIRECTION and the
     * section title carries the noun. Short forms, because they head a
     * six-column table and label the bar's value list at 320 px, where Spanish
     * already runs 20-30% longer than English.
     *
     * `no-movement` is labelled like the other five. It is 24.9% of all corpus
     * offers — the movement PAGE prints only five types, but Domain G, the
     * source these sections actually read, carries the sixth.
     */
    offerMovement: {
      "in-front": "Por delante",
      "in-between": "Entre líneas",
      "out-to-in": "De fuera a dentro",
      "in-to-out": "De dentro a fuera",
      "in-behind": "A la espalda",
      "no-movement": "Sin desmarque",
    },
    /*
     * All FOUR DefensiveActionType codes are labelled even though only two can
     * ever be plotted: `block` and `possession-contest` are aggregate panels
     * with no coordinates anywhere in the corpus, but the log table and any
     * future emission may carry them, and an unlabelled row is worse than an
     * unreachable label. Singular forms — each labels ONE event.
     */
    defensiveAction: {
      "forced-turnover": "Recuperación forzada",
      "possession-regain": "Recuperación de balón",
      block: "Bloqueo",
      "possession-contest": "Disputa de balón",
    },
    /*
     * The six PossessionContestType codes, for the log column that appears only
     * when some row carries a value (ruled decision 20 — on corpus-real data
     * the column is absent entirely, since contest_type is null on
     * 20,169/20,169).
     */
    possessionContest: {
      pass: "Pase",
      "attempt-at-goal": "Tiro",
      cross: "Centro",
      clearance: "Despeje",
      "physical-duel": "Duelo físico",
      "aerial-duel": "Duelo aéreo",
    },
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

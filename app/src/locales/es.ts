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
      /*
       * Story 2.18 Task 7.5. EXPERIENCE.md's IA route table names the footer as
       * /glossary's reach path ("Footer, every glossary tooltip's 'see more'");
       * DESIGN.md's footer bullet mentions only the about link and is stale.
       * The spine disagreement is FILED, not resolved by editing DESIGN.md.
       */
      glossaryLink: "Glosario",
    },
  },
  about: {
    title: "Acerca del sitio",
    dataTitle: "Los datos",
    methodologyTitle: "Cómo leemos el xG",
    creditsTitle: "Créditos",
    projectTitle: "Sobre el proyecto",
    /*
     * RULED VERBATIM (Story 2.18 decision 1, Juan). The epic's own parenthetical
     * — "xG used as-is, never recomputed" — is TRUE of the team totals and
     * MISLEADING about per-shot values: rendering decision FD-1 records that
     * per-shot xG does not exist in the source PDFs at all, which is why every
     * shot marker is drawn at the same size and every event log omits the xG
     * row. This is the first time FD-1 becomes user-visible copy, on the one
     * page whose entire purpose is to explain the data honestly. It must agree
     * with glossary.xg.definition — two surfaces, one claim.
     */
    methodology:
      "Los valores de xG son los que publica la FIFA en el informe oficial; nunca los recalculamos. El informe solo publica el xG total de cada equipo — no hay un valor por remate, por eso todos los remates se dibujan del mismo tamaño.",
    /*
     * PROPOSED, NOT RULED. No spine carries credits or project-framing wording,
     * so both were authored here under Voice and Tone (tuteo, neutral LatAm, no
     * exclamation marks, flat register, numbers carry the drama) and logged as
     * new rows under EXPERIENCE.md's extension procedure. Flagged in the story's
     * Completion Notes for Juan to confirm or overturn at review.
     */
    credits:
      "El sitio lo construye y lo mantiene una sola persona. El diseño, el código y las traducciones son propios; los datos son de la FIFA.",
    project:
      "Es un proyecto personal, gratuito y sin publicidad. No vendemos datos, no cobramos por el acceso y no recibimos nada de la FIFA ni de ningún club.",
  },
  /*
   * ---------------------------- THE GLOSSARY ----------------------------
   *
   * One entry per GlossaryTermId (src/lib/glossary.ts), in EXPERIENCE.md's
   * per-term policy-table order — NOT alphabetical, because alphabetical
   * differs between es and en and /glossary renders this order to the reader.
   *
   * `es` and `en` hold the SAME BYTES IN BOTH DICTIONARIES. The term PAIR is
   * locale-invariant: AC 2 and EXPERIENCE's Component-Patterns rule both require
   * both languages to render simultaneously, in one locale's page ("salida de
   * balón — en: build-up"), so a bilingual reader can bridge the two without
   * flipping the entire interface (review-i18n.md §5). Only `definition`
   * differs between the dictionaries. Do not "fix" the mirrored term leaves.
   *
   * EVERY DEFINITION IS AUTHORED, NOT TRANSCRIBED. The PMSR prints no glossary
   * page and no definition of any term — 0 hits across all 52 pages — so these
   * are written from page placement and reconciliation arithmetic, and
   * glossaryPage.authoredNote says so on the page. A definition that claims data
   * the corpus does not carry is exactly the defect this story exists to
   * prevent.
   *
   * This namespace is EXEMPT from i18n.test.ts's forbidden-register sweep: the
   * definitions legitimately name rejected and peninsular forms in order to
   * explain them (row 30's "córner", row 31's "fuera de juego", the "a puerta"
   * the shot-outcome row rejects).
   */
  glossary: {
    "line-break": {
      es: "rupturas de líneas",
      en: "line breaks",
      definition:
        "Un pase que deja atrás a una o más líneas de jugadores rivales. El informe las cuenta por equipo, y también las que sufre cada defensa.",
    },
    "counter-press": {
      es: "contrapresión",
      en: "counter-press",
      definition:
        "Presionar de inmediato después de perder el balón, para recuperarlo antes de que el rival se acomode. El informe la publica como una de las fases sin balón.",
    },
    pressing: {
      es: "presión",
      en: "pressing",
      definition:
        "Ir a quitarle el balón al rival de forma organizada. El informe reparte el tiempo sin balón entre presión alta, media y baja.",
    },
    "build-up": {
      es: "salida de balón",
      en: "build-up",
      definition:
        "La fase en la que un equipo saca el balón desde su propio campo. El informe la separa en salida con presión y salida sin presión.",
    },
    "high-block": {
      es: "bloque alto",
      en: "high block",
      definition:
        "El equipo defiende con sus líneas cerca del campo rival. Es una de las tres alturas de bloque que mide el informe.",
    },
    "mid-block": {
      es: "bloque medio",
      en: "mid block",
      definition:
        "El equipo defiende con sus líneas en la zona central del campo. Es una de las tres alturas de bloque que mide el informe.",
    },
    "low-block": {
      es: "bloque bajo",
      en: "low block",
      definition:
        "El equipo defiende con sus líneas cerca de su propio arco. Es una de las tres alturas de bloque que mide el informe.",
    },
    "line-height": {
      es: "altura de la línea defensiva",
      en: "line height",
      definition:
        "A qué distancia del propio arco juega la última línea, en metros. El informe no dice a qué fase del juego corresponde cada distancia.",
    },
    "team-length": {
      es: "longitud del equipo",
      en: "team length",
      definition:
        "La distancia en metros entre la línea más adelantada del equipo y la más retrasada. El informe no dice a qué fase del juego corresponde.",
    },
    "phases-of-play": {
      es: "fases del juego",
      en: "phases of play",
      definition:
        "Los tramos en los que el informe reparte el partido: ocho con balón y nueve sin balón. Son tasas independientes, no suman 100 y no son partes de un total.",
    },
    xg: {
      es: "xG",
      en: "xG",
      // Must agree with about.methodology — two surfaces, one claim (FD-1).
      definition:
        "Goles esperados: la probabilidad de gol de cada remate según el modelo de la FIFA. El informe publica solo el total por equipo, no un valor por remate.",
    },
    "pass-network": {
      es: "red de pases",
      en: "pass network",
      definition:
        "El dibujo de quién le pasó a quién dentro de un equipo. Cada jugador es un nodo y cada línea son los pases entre dos jugadores.",
    },
    "speed-zones": {
      es: "zonas de velocidad",
      en: "speed zones",
      definition:
        "Los tramos de velocidad en los que el informe reparte la distancia que recorre cada jugador.",
    },
    "high-speed-run": {
      es: "carreras a alta velocidad",
      en: "high-speed runs",
      definition:
        "Los recorridos que un jugador hace por encima del umbral de velocidad que fija el informe. En las tablas la columna se abrevia CARR. ALTA VEL.",
    },
    sprint: {
      es: "sprint",
      en: "sprint",
      definition:
        "Un tramo de carrera a máxima velocidad. El informe publica la distancia recorrida en sprint por jugador y por equipo.",
    },
    "take-on": {
      es: "regate",
      en: "take-on",
      definition:
        "El intento de superar a un rival con el balón controlado. El informe lo imprime como Take Ons, entre las progresiones de balón y los remates.",
    },
    "step-in": {
      /*
       * FINAL (Story 2.18 decision 2, Juan). `stepIns` is a required member of
       * PlayerInPossession, printed as "Step Ins" on the In Possession -
       * Distributions page between "Take Ons" and "Attempts at Goal" — so
       * "salto" is affirmatively contradicted (a defender stepping out to press
       * could only be an out-of-possession metric) and "conducción interior"
       * invents a direction the PMSR never prints.
       */
      es: "irrupción",
      en: "step-in",
      definition:
        "Una conducción con la que el jugador se mete en el bloque rival. El informe la imprime como Step Ins en la página de distribuciones con balón, así que es una acción con balón y no una salida defensiva.",
    },
    "second-ball": {
      es: "segunda jugada",
      en: "second ball",
      definition:
        "La disputa por un balón suelto después de un despeje, un rechace o un duelo aéreo.",
    },
    "forced-turnover": {
      es: "recuperaciones forzadas",
      en: "forced turnovers",
      definition:
        "Las pérdidas que un equipo le provoca al rival. El crédito es de quien fuerza la pérdida, no de quien la sufre.",
    },
    "ball-progression": {
      es: "progresión de balón",
      en: "ball progression",
      definition:
        "Llevar el balón hacia el arco rival, con pase o con conducción. El informe la cuenta por jugador y por equipo.",
    },
    "reception-in-final-third": {
      es: "recepción en el último tercio",
      en: "reception in the final third",
      definition: "Recibir el balón en el tercio de campo más cercano al arco rival.",
    },
    "set-play": {
      es: "balón parado",
      en: "set play",
      definition:
        "Toda jugada que arranca con el balón detenido: tiros de esquina, tiros libres, saques de banda y penales.",
    },
    momentum: {
      /*
       * DECISION 5, ruled by Juan: the policy table's own tooltip text
       * ("impulso del partido: qué equipo domina en cada tramo") is FACTUALLY
       * FALSE for the shipped series. Story 1.8 closed OQ-5 — the series is a
       * per-minute per-team count of final-third distributions, not a possession
       * or dominance measure, and viz.momentum's docblock says the App's own
       * copy must not imply otherwise, which is why the ruled tooltip was
       * silently never shipped. Newly authored, logged under the table's
       * extension procedure; NOT a reuse of viz.momentum.metricNote, which is a
       * different string. The second sentence exists because the FIRST sentence
       * of any momentum gloss invites the dominance reading.
       */
      es: "momentum",
      en: "momentum",
      definition:
        "Cuántas veces entra cada equipo al último tercio, minuto a minuto. El informe no publica posesión por minuto, así que esto no mide dominio.",
    },
    goal: {
      es: "gol",
      en: "goal",
      definition:
        "El remate que termina en gol. Es uno de los cinco resultados de remate que publica el informe.",
    },
    "on-target": {
      es: "al arco",
      en: "on target",
      definition:
        "El remate que iba al arco y no entró. Decimos al arco y no a puerta, que es la forma peninsular. Es uno de los cinco resultados de remate.",
    },
    "off-target": {
      es: "desviado",
      en: "off target",
      definition:
        "El remate que se fue por fuera del arco. Es uno de los cinco resultados de remate.",
    },
    blocked: {
      es: "bloqueado",
      en: "blocked",
      definition:
        "El remate que un rival bloquea antes de que llegue al arco. Es uno de los cinco resultados de remate.",
    },
    incomplete: {
      /*
       * The forward note ruled decision 12 requires: the report also prints a
       * LONGER per-shot label whose vocabulary this site does not map yet. Its
       * 22->24 extension rides CS-1, which has not landed. Do NOT write the
       * number 22 anywhere.
       */
      es: "incompleto",
      en: "incomplete",
      definition:
        "El remate que el informe no clasifica en ninguno de los otros cuatro resultados. El informe también imprime una etiqueta más larga por remate, cuyo vocabulario el sitio todavía no traduce.",
    },
    goalkeeper: {
      es: "arquero",
      en: "goalkeeper",
      definition:
        "El jugador que defiende el arco. Decimos arquero, la forma que usa la mayor parte de América Latina.",
    },
    save: {
      es: "atajada",
      en: "save",
      definition:
        "La intervención con la que el arquero evita un gol. Decimos atajada, la forma que acompaña a arquero.",
    },
    distribution: {
      es: "distribución",
      en: "distribution",
      definition:
        "Cómo el arquero pone el balón en juego: con el pie, de volea desde las manos o con un lanzamiento. El informe reparte cada familia en técnicas.",
    },
    salida: {
      es: "salidas",
      en: "coming off the line",
      definition: "Cuando el arquero deja su línea para cortar un centro o un balón filtrado.",
    },
    "one-on-one": {
      es: "mano a mano",
      en: "one-on-one",
      definition: "El duelo entre el arquero y un atacante que llega solo frente al arco.",
    },
    defender: {
      es: "defensa",
      en: "defender",
      definition:
        "La posición de los jugadores de la última línea. El informe la imprime en las alineaciones.",
    },
    midfielder: {
      es: "mediocampista",
      en: "midfielder",
      definition:
        "La posición de los jugadores del mediocampo. El informe la imprime en las alineaciones.",
    },
    forward: {
      es: "delantero",
      en: "forward",
      definition:
        "La posición de los jugadores de ataque. El informe la imprime en las alineaciones.",
    },
    corner: {
      es: "tiro de esquina",
      en: "corner",
      definition:
        "El saque desde la esquina del campo. Decimos tiro de esquina en todo el sitio; córner es la forma que el sitio no usa.",
    },
    offside: {
      es: "posición adelantada",
      en: "offside",
      definition:
        "La infracción por recibir el balón por detrás de la última línea rival. Decimos posición adelantada; fuera de juego es la forma peninsular.",
    },
    cross: {
      es: "centro",
      en: "cross",
      definition:
        "El envío desde una banda hacia el área. El informe publica cuántos se intentaron, cuántos se completaron y con qué tipo de envío.",
    },
    "offers-to-receive": {
      /*
       * DECISION 3's relationship, verbatim and shared with movement-to-receive.
       * Measured: sum(offersByMovementType) == totalOffers on 3,289/3,289 staged
       * player rows, and `no-movement` is 24.9% of all corpus offers — so offers
       * strictly contain movements. STATE the relationship; never put a fixture
       * number in user-facing copy.
       */
      es: "ofrecimientos para recibir",
      en: "offers to receive",
      definition:
        "Un ofrecimiento es un jugador que se ofrece para recibir; un desmarque es la parte de esos ofrecimientos en la que además se movió. El informe cuenta aparte los ofrecimientos sin movimiento.",
    },
    "movement-to-receive": {
      es: "desmarques",
      en: "movement to receive",
      definition:
        "Un ofrecimiento es un jugador que se ofrece para recibir; un desmarque es la parte de esos ofrecimientos en la que además se movió. El informe cuenta aparte los ofrecimientos sin movimiento.",
    },
    "defensive-actions": {
      es: "acciones defensivas",
      en: "defensive actions",
      definition:
        "Las acciones con las que un equipo intenta recuperar el balón: recuperaciones, bloqueos y disputas. El informe solo publica coordenadas de algunas de ellas.",
    },
  },
  /*
   * /glossary page chrome. DELIBERATELY SEPARATE from the `glossary` namespace
   * above, which carries term entries ONLY: i18n.test.ts asserts
   * Object.keys(es.glossary) equals GLOSSARY_TERMS exactly, with no allowance,
   * and a page-chrome key living in there would have to be exempted by hand.
   */
  glossaryPage: {
    title: "Glosario",
    intro: "Los términos tácticos y estadísticos que usa el sitio, en español y en inglés.",
    // The popover's "see more" link, and EXPERIENCE's named reach path.
    seeMore: "Ver en el glosario",
    jargonNote: "Se mantiene el término en inglés: no hay una forma corta en español que se reconozca.",
    authoredNote:
      "El informe oficial no trae un glosario. Estas definiciones las escribimos nosotros, a partir de dónde aparece cada dato en el informe y de cómo cuadran sus cifras.",
    /*
     * Language-code prefixes for the counterpart-language subtitle
     * ("salida de balón — en: build-up"). Locale-invariant in BOTH dictionaries,
     * like the term pairs themselves: the subtitle names the OTHER language, so
     * its prefix does not swap with the interface.
     */
    esPrefix: "es:",
    enPrefix: "en:",
    metaTitle: "Glosario — WC Stats",
    metaDescription:
      "Los términos tácticos y estadísticos del Mundial 2026 que usa el sitio, en español y en inglés.",
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
        /*
         * STORY 2.18 Task 8.10 — the AD-7 unit violation, narrow fix only.
         * These two baked their unit into the label, which enums.unit exists to
         * prevent (and "km/h" had no entry at all). The unit is now composed at
         * the call site in StoryStatTiles, as a STRING.
         *
         * Deliberately NOT routed through enums.metric or KEY_STAT_UNIT:
         * `topSpeed` is absent from KEY_STAT_FIELDS, so an enums.metric.topSpeed
         * entry turns i18n.test.ts's "one entry per Key Statistics field"
         * assertion red, and tactical-sections.ts is do-not-touch.
         */
        distance: "Distancia",
        topSpeed: "Vel. máx.",
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
        /*
         * STORY 2.18 decision 3. The section is titled "Desmarques" but every
         * number under it is an OFFER count: offersByMovementType is a six-way
         * split of totalOffers whose sixth value is literally `no-movement`
         * ("Sin desmarque"), 24.9% of all corpus offers. So offers strictly
         * CONTAIN movements, and the title names the smaller set while the data
         * is the larger one.
         *
         * Ruled: do NOT retitle (the title is consumed by two test suites, the
         * section id, the anchor and the collapsed-shell copy), and do NOT rely
         * on the glossary alone — a popover is a hover-away affordance, so the
         * relationship ships HERE, where a reader meets it. Verbatim.
         *
         * This also replaces the "sin balón" prose decision 4 deliberately left
         * alone: natural prose, not the vocabulary token.
         */
        summary: "Cómo se ofrecieron para recibir, y en cuáles de esos ofrecimientos además se movieron.",
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
        /*
         * STORY 2.18 REMEDIATION — the one HARD register violation the
         * terminology audit found. This line shipped "Córners … y laterales"
         * while the SEVEN viz.setPlays.* keys inside this very section all say
         * "tiro de esquina", and viz.setPlays.throwIns says "Saques de banda".
         * EXPERIENCE.md row 30 rules "tiro de esquina"; "córner" is the
         * forbidden register. English was already correct.
         */
        summary: "Tiros de esquina, tiros libres y saques de banda: cuántos y con qué resultado.",
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
      /*
       * Story 2.18 ruled decision 7 — the PER-SECTION error boundary's copy.
       * Deliberately NOT match.bundle.crashed reused: that string names a
       * bundle-level failure ("el análisis táctico de este partido"), and a
       * bundle-wide fault surfacing as "this section" would be a narrower and
       * possibly false claim.
       *
       * It states an APP-SIDE failure as one. It must NEVER claim the report
       * lacks the section — that is the FR-22 inversion this codebase has
       * guarded against three times, and it is what makes this pair different
       * from tactical.empty.explanation.
       */
      sectionCrashed: "No pudimos mostrar esta sección.",
      sectionCrashedExplanation: "Los datos llegaron en un formato que no pudimos leer.",
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
      // Story 2.10 columns, shared by the four Tactical closing sections.
      phase: "Fase",
      category: "Categoría",
      measure: "Medida",
      count: "Cantidad",
      share: "Participación",
      left: "Izquierda",
      right: "Derecha",
      complete: "Completados",
      incomplete: "Incompletos",
      // The involvement timeline's slot-index column. Duplicate-minute rows are
      // otherwise indistinguishable (ruled decision 7): the corpus draws 95-145
      // slots against a 0-120 minute with no stoppage field, so on real data
      // many slots share a minute.
      slot: "Intervalo",
      /*
       * A COUNT of slots, distinct from `slot` (a slot INDEX). The two appear in
       * adjacent tables inside one disclosure, and decision 14 separated those
       * tables precisely because the two quantities are not the same thing.
       */
      slotCount: "Intervalos",
      keeper: "Arquero",
      /*
       * Story 2.11a — the ONE sortable data-table contract (UX-DR12).
       *
       * t() has no interpolation and no plural machinery, so every one of these
       * is composed into a `const` identifier at the call site and never as a
       * template literal inside a gated prop.
       *
       * `sortAction` prefixes the column head in the header button's
       * ACCESSIBLE NAME ("Ordenar por Minuto"). The visible text is the head
       * itself, so the name contains it — WCAG 2.5.3 Label in Name holds.
       *
       * `sortedBy` + a direction word is the polite announcement. The state
       * also rides `aria-sort` on the <th>; the announcement exists because a
       * changed attribute on an element the reader is not focused on is not
       * spoken.
       *
       * `sortCleared` is the cycle's THIRD state — no column active, which IS
       * the artifact order (AD-5). It names no column, because none is active.
       */
      sortAction: "Ordenar por",
      sortedBy: "Ordenado por",
      sortAscending: "ascendente",
      sortDescending: "descendente",
      sortCleared: "Se restauró el orden original de la tabla.",
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
      /*
       * STORY 2.18 REMEDIATION — the peninsular survivor. "Puerta" is the
       * peninsular goal-frame noun and the app says "arco" everywhere else;
       * "en contra" pairs with the already-shipped match.hero.ownGoal "(a.g.)"
       * while avoiding "meta", which also leans peninsular. Ruled in the story,
       * not chosen at implementation time.
       *
       * This is also why i18n.test.ts's forbidden-register sweep can only go
       * green after this edit: "a puerta" was never a standalone hit, it hid
       * inside this string.
       */
      ownGoal: "en contra",
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
    /*
     * Story 2.10's four sections. NO `title` KEY IN ANY OF THEM: the four
     * section titles already exist as tactical.sections.*.title ("Fases del
     * juego", "Presión y bloques defensivos", "Balón parado", "Arqueros") and
     * are used verbatim for the ViewDataDisclosure panelTitle. Re-minting a
     * viz.*.title here would give the page two names for one section.
     */
    phases: {
      figurePrefix: "Fases del juego:",
      /*
       * STORY 2.18 REMEDIATION, decision 4 — EXPERIENCE.md row 38 ("Expert
       * column groups") rules "En posesión / Sin posesión" and logs
       * "Con balón / Sin balón" as the REJECTED chattier broadcast alternative;
       * 2.10 shipped the rejected form. The table stands and the app moves:
       * EXPERIENCE's own header rule is "Spines win on conflict", the contract
       * enums are inPossessionPhase / outOfPossessionPhase, and 2.11's Expert
       * column-group tabs are this row's own surface. The `en` values were
       * already correct and are NOT touched.
       */
      inPossession: "En posesión",
      outOfPossession: "Sin posesión",
      /*
       * THE SINGLE MOST IMPORTANT SENTENCE ON THIS SURFACE. The eight and nine
       * values are INDEPENDENT RATES: corpus in-possession sums run 84-149 and
       * equal 100 on five of 208 team-innings; out-of-possession 73-97 and
       * equal 100 on ZERO. Without this line a reader reasonably assumes the
       * bars partition the match.
       */
      note: "Son tasas independientes por fase: no suman 100 y no son partes de un total.",
      axisRate: "Porcentaje del tiempo",
      axisPhase: "Fase",
      tableCaption: "Ordenado por fase, en el orden del informe.",
    },
    pressing: {
      figurePrefix: "Presión y bloques:",
      pressRates: "Intensidad de la presión",
      blocks: "Bloques defensivos",
      note: "Son tasas independientes: no suman 100 y no son partes de un total.",
      axisRate: "Porcentaje del tiempo",
      axisPhase: "Fase",
      metres: "Altura de la línea y longitud del equipo",
      /*
       * Keyed by measure and possession state (AD-7). The unit is NOT baked in
       * — enums.unit.m carries it.
       */
      /*
       * STORY 2.18 REMEDIATION, decision 4's SECOND half. These four are
       * COMPOUND METRIC LABELS, not standalone possession vocabulary — the
       * naive "repoint the six leaves to En posesión" would have deleted the
       * metric name and left four labels reading "En posesión". Only the
       * possession-state clause moves.
       */
      metre: {
        lineHeight: {
          inPossession: "Altura de la línea en posesión",
          outOfPossession: "Altura de la línea sin posesión",
        },
        teamLength: {
          inPossession: "Longitud del equipo en posesión",
          outOfPossession: "Longitud del equipo sin posesión",
        },
      },
      /*
       * Ruled decision 5. The corpus prints THREE panels per possession state
       * with three measures each (including team_width, which the contract does
       * not model), and m001's staged line_height of 19/39/54 matches neither
       * the fixture's single 44.4 nor any mean of them. This sentence states
       * the gap WITHOUT claiming which phase the number describes — the one
       * thing decision 5 forbids. Story 1.16 owns the aggregation rule.
       */
      metreNote: "El informe no define a qué fase del juego corresponden estas distancias.",
      tableCaption: "Ordenado por fase, en el orden del informe.",
      metreTableCaption: "Distancias en metros, por medida y estado de posesión.",
    },
    setPlays: {
      figurePrefix: "Balón parado:",
      totals: "Totales",
      totalSetPlays: "Acciones a balón parado",
      setPlaysOne: "acción a balón parado",
      setPlaysMany: "acciones a balón parado",
      freeKicks: "Tiros libres",
      corners: "Tiros de esquina",
      cornersOne: "tiro de esquina",
      cornersMany: "tiros de esquina",
      throwIns: "Saques de banda",
      penalties: "Penales",
      /*
       * Ruled decision 6. `direct == directOnTarget + directOffTarget` is what
       * the contract's FreeKickCounts description asserts, and it is FALSE on
       * 208/208 corpus team-innings (160 have on+off == 0 while direct > 0) —
       * while TRUE on all six fixture ones. The four values therefore render as
       * flat siblings with no containment cue, and this sentence is why.
       */
      freeKickNote: "El informe publica los cuatro valores por separado; no siempre se contienen entre sí.",
      cornerSide: "Lado del saque",
      cornerType: "Tipo de envío",
      cornerStyle: "Estilo de envío",
      // Corner STYLE sums to totalCorners on only 96 of 208 corpus
      // team-innings (112 under, never over), so it is never drawn as a bar.
      cornerStyleNote: "Recuento independiente: puede no coincidir con el total de tiros de esquina.",
      /*
       * FOR A PARTITION THAT DISAGREES WITH ITS DECLARED TOTAL — never the note
       * above. Corner SIDE and corner TYPE both hold 208/208 on the corpus, so
       * calling them "recuento independiente" would deny the part-of-whole
       * relation the bar is drawing. Decision 8 requires the surface to SHOW
       * BOTH AND NORMALIZE NEITHER (AD-6): this says the source disagrees with
       * itself, not that the categories are independent.
       */
      cornerMismatchNote:
        "Los segmentos no suman el total de tiros de esquina que publica el informe. Se muestran ambas cifras, sin ajustar ninguna.",
      // Printed verbatim beside a bar whose denominator is the sum of its own
      // segments. When the two disagree the surface shows BOTH (AD-6).
      declaredTotal: "Total según el informe",
      barNote: "Cada barra reparte los tiros de esquina del equipo entre las categorías del informe.",
      zero: "El informe no registra acciones a balón parado para este equipo.",
      zeroCorners: "El informe no registra tiros de esquina para este equipo.",
      totalsCaption: "Totales por equipo.",
      freeKickCaption: "Tiros libres por tipo, recuentos independientes.",
      cornerCaption: "Tiros de esquina por lado, tipo y estilo de envío.",
      /* Its own caption: this table is the izquierda/derecha split WITHIN each
         delivery type, not the counts-and-shares table above (decision 19). */
      cornerTypeSideCaption: "Tiros de esquina por lado dentro de cada tipo de envío.",
    },
    goalkeeping: {
      figurePrefix: "Arqueros:",
      keeperOne: "Arquero",
      keeperMany: "Arqueros",
      involvementsOne: "participación",
      involvementsMany: "participaciones",
      involvementTitle: "Participaciones",
      /*
       * Ruled decision 7's axis sentence. The x axis is the SAMPLE INDEX, never
       * the minute: the corpus draws 95-145 slots per team-inning against a
       * bare 0-120 `Minute` with no stoppage field, and 2,506 of 21,764 slots
       * fall in stoppage time — so minutes repeat. An unexplained axis whose
       * labels repeat is exactly what this sentence prevents.
       */
      involvementAxisNote:
        "El eje ordena los intervalos del informe; un intervalo de descuento lleva el minuto reglamentario anterior.",
      axisSlot: "Intervalo del informe",
      axisInvolvements: "Participaciones",
      distribution: "Distribución",
      distributionTotal: "Total",
      lineBreaks: "Rupturas de líneas",
      goalPrevention: "Prevención de gol",
      attemptsFaced: "Remates enfrentados",
      savePercentage: "% de atajadas",
      interventions: "Intervenciones",
      byInterventionType: "Por tipo de intervención",
      byBodyType: "Por parte del cuerpo",
      /*
       * Ruled decision 13: the two goal-prevention breakdowns have DIFFERENT
       * denominators — byInterventionType sums to attemptsFaced, byBodyType to
       * totalInterventions — and the contract requires each panel to be
       * labelled with its own total rather than implying a shared one.
       */
      denominatorPrefix: "sobre",
      aerial: "Juego aéreo",
      aerialInterventions: "Intervenciones aéreas",
      crossesFaced: "Centros enfrentados",
      crossesFacedCompleted: "Centros completados",
      /*
       * Ruled decision 3's second consequence. Once its counterpart is gated
       * away, `crossesFacedAttempted` renders ALONE — and a value labelled as
       * the *attempted half of a pair* with no counterpart reads as a MISSING
       * number rather than an ABSENT one. This is its solo label.
       */
      crossesFacedAlone: "Centros enfrentados (el informe no publica cuántos se completaron)",
      deliveryTypes: "Tipo de centro enfrentado",
      /*
       * THE RULED GATE-DISCLOSURE SENTENCE (decision 3). Five contract-required
       * sub-blocks are null on 208/208 corpus team-innings and populated on 6/6
       * fixture ones, so the section the dev builds is NOT the section that
       * ships at the 2.19 cutover. Hiding five whole panels with nothing on
       * screen explaining it is silent absence at panel granularity — the one
       * thing FR-22 forbids. This is neither five rows of em dashes (rightly
       * banned) nor silence.
       */
      gateNote:
        "El informe publica algunos desgloses solo como imagen, sin valores legibles: esos paneles no se muestran.",
      zeroRecord: "El informe no incluye un bloque de arquero para este equipo.",
      zeroAll: "El informe no lista arqueros para este partido.",
      /*
       * PER-KEEPER, and distinct from `zeroAll` on purpose. This renders inside
       * a named keeper's panel, beside their own involvement total and above
       * their distribution and aerial numbers — so the section-level "no lista
       * arqueros para este partido" was flatly contradicted by its own
       * surroundings. What is absent here is the plotted timeline, nothing else.
       */
      zeroTimeline: "El informe no grafica intervalos para este arquero.",
      /*
       * QUALIFIED technique headings. `enums.distributionType.*` names the three
       * FAMILIES, which `completionList` prints as rows immediately above with
       * different numbers; reusing them here put the same words over two
       * different quantities. Minted under EXPERIENCE.md:278.
       */
      feetTechniques: "Técnicas de saque con el pie",
      handsTechniques: "Técnicas de saque de volea",
      throwTechniques: "Técnicas de saque con la mano",
      /*
       * Ruled decision 14's TWO captions. `totalInvolvements` is what the
       * report PRINTS; the timeline is what it PLOTS. Measured over 208
       * team-innings the difference runs 0..5 and is exactly 0 on only 59 —
       * while all six fixture keepers sum precisely. The captions disclose the
       * gap rather than resolving it, because the ledger's rule is "do not
       * resolve it by making the numbers agree".
       */
      summaryCaption: "Total de participaciones que publica el informe.",
      timelineCaption:
        "Intervalos que grafica el informe, en orden. La fuente no garantiza que sumen el total.",
      distributionCaption: "Distribución por familia y técnica.",
      preventionCaption:
        "Intervenciones por tipo; suman los remates enfrentados, no las intervenciones totales.",
      /*
       * Decision 13's denominators, NAMED. The contract requires an App
       * rendering these panels together to "label them with their own totals
       * rather than implying a shared one": byInterventionType sums to
       * attemptsFaced, byBodyType to totalInterventions.
       */
      headlineCaption: "Totales de prevención de gol que publica el informe.",
      bodyTypeCaption:
        "Intervenciones por parte del cuerpo; suman las intervenciones totales, no los remates enfrentados.",
      aerialCaption: "Juego aéreo y centros enfrentados.",
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
    /*
     * ------------------------- STORY 2.10's ENUMS -------------------------
     *
     * Fourteen closed vocabularies, keyed by CONTRACT ENUM CODE (AD-7), each
     * driven by a frozen ordered list in the models and each pinned by an
     * i18n.test.ts exhaustiveness assertion in BOTH locales.
     *
     * Ruled terms reused VERBATIM from EXPERIENCE.md's per-term table:
     * presión · bloque alto/medio/bajo · altura de la línea defensiva ·
     * longitud del equipo · fases del juego · salida de balón · contrapresión ·
     * balón parado · tiro de esquina · arquero · atajada · distribución.
     * Everything else was minted here under EXPERIENCE.md:278's procedure and
     * is recorded in the story's Dev Agent Record. LatAm register throughout
     * (UX-DR19).
     */
    // The eight in-possession phases of play (Domain C).
    inPossessionPhase: {
      "build-up-unopposed": "Salida de balón sin presión",
      "build-up-opposed": "Salida de balón con presión",
      progression: "Progresión",
      "final-third": "Último tercio",
      "long-ball": "Balón largo",
      "attacking-transition": "Transición ofensiva",
      "counter-attack": "Contraataque",
      "set-piece": "Balón parado",
    },
    /*
     * The nine out-of-possession phases. `high-press` and `high-block` are
     * SEPARATE enum values in the source and stay separate here — #pressing
     * renders the four press rates and the three block heights as distinct
     * concepts, so collapsing the vocabulary would make the duplication
     * ruled decision 4 requires look like an error.
     */
    outOfPossessionPhase: {
      "high-press": "Presión alta",
      "mid-press": "Presión media",
      "low-press": "Presión baja",
      "high-block": "Bloque alto",
      "mid-block": "Bloque medio",
      "low-block": "Bloque bajo",
      recovery: "Repliegue",
      "defensive-transition": "Transición defensiva",
      "counter-press": "Contrapresión",
    },
    // The three defensive block heights. EXPERIENCE's ruled rows, verbatim.
    blockLevel: {
      high: "Bloque alto",
      mid: "Bloque medio",
      low: "Bloque bajo",
    },
    /*
     * The four free-kick types (Domain F). Each label STANDS ALONE, because the
     * four render as flat siblings with no containment cue (ruled decision 6) —
     * "Al arco" on its own would read as a column header rather than a
     * free-kick outcome.
     */
    freeKick: {
      direct: "Tiro libre directo",
      "direct-on-target": "Directo al arco",
      "direct-off-target": "Directo desviado",
      indirect: "Tiro libre indirecto",
    },
    cornerDeliveryType: {
      "direct-to-area": "Directo al área",
      short: "En corto",
      "edge-of-penalty-area": "Al borde del área",
    },
    /*
     * Corner delivery STYLE shares its vocabulary with CrossDeliveryType, and
     * deliberately reuses Story 2.7's ruled adjectives so one delivery shape
     * has one Spanish name across the app. They are separate contract enums, so
     * they get separate namespaces — but not separate words.
     */
    cornerDeliveryStyle: {
      inswing: "Cerrado",
      outswing: "Abierto",
      driven: "Tenso",
      lofted: "Bombeado",
    },
    pitchSide: {
      left: "Izquierda",
      right: "Derecha",
    },
    /*
     * ---------------------- Domain E, the goalkeeper ----------------------
     * review-i18n.md:26 records that the WHOLE goalkeeping domain had zero
     * terminology coverage, so every row below is newly minted. "Arquero" and
     * "atajada" are the ruled LatAm terms and carry the register.
     */
    /*
     * STORY 2.18 Task 8.6 — one of the two ad-hoc terms 2.10 minted with no
     * policy row, now ruled and logged as a new table row.
     *
     * The es labels split on body-part/technique while `en` splits on
     * KICK vs THROW, and "Saque de volea" (kick from the hands) against
     * "Saque con la mano" (thrown) were mutually confusable — nothing in the
     * volley label said it came from the hands. Realigned to the en
     * distinction: two kicks, one throw.
     */
    distributionType: {
      feet: "Saque con el pie",
      hands: "Volea desde las manos",
      throw: "Lanzamiento con la mano",
    },
    feetTechnique: {
      "play-onto": "Al pie",
      "play-into": "Al interior",
      "play-around": "Por fuera",
      "play-through": "Filtrado",
      "play-beyond": "A la espalda",
      other: "Otro",
    },
    handsTechnique: {
      "side-kick": "Volea lateral",
      "from-hands": "Desde las manos",
      "drop-kick": "Bote pronto",
    },
    throwTechnique: {
      "over-arm": "Por encima",
      "under-arm": "Por abajo",
      "side-arm": "Lateral",
      chest: "Desde el pecho",
    },
    interventionType: {
      "save-and-retain": "Atajada y retención",
      "save-and-deflect": "Atajada y rechace",
      "deflect-and-retain": "Rechace y retención",
      "save-attempt": "Intento de atajada",
      "no-save-attempt": "Sin intento de atajada",
    },
    interventionBodyType: {
      head: "Cabeza",
      hands: "Manos",
      "upper-body": "Tren superior",
      "lower-body": "Tren inferior",
      feet: "Pies",
    },
    aerialType: {
      punch: "Despeje de puños",
      // Story 2.18 Task 8.6: "Descuelgue" leans Spain against the ruled LatAm
      // register (UX-DR19), and "Atrapada" pairs with the shipped
      // arquero/atajada vocabulary. Logged as a new table row.
      claim: "Atrapada",
      "tipped-palmed": "Desvío con la mano",
    },
    // Units are locale metadata, never baked into a label string (AD-7).
    unit: {
      km: "km",
      // Story 2.10: the four Domain C distances. Added HERE rather than in a
      // new namespace — AD-7 keys units by metric code, and this is the home.
      m: "m",
      // Story 2.18 Task 8.10: the Hero's top-speed tile had no unit entry at
      // all, so "km/h" was baked into its label.
      kmh: "km/h",
    },
  },
};

export type Dictionary = typeof es;

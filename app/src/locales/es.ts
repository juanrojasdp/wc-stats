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
  /*
   * STORY 2.12 retired `app.scaffold.*` and `a11y.scaffold.demoRegion`. Task 1.1
   * replaced the Story 2.1 placeholder body in `src/app/page.tsx`, which was
   * their ONLY call site, so leaving them would be the dead-key defect facing
   * the other way — the same defect `deferred-work.md` cites for minting keys
   * ahead of a surface.
   */
  app: {
    siteName: "WC Stats",
  },
  a11y: {
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
    /*
     * THIRD PERSON, matching credits (2.18 code review). These two sit on one
     * page and disagreed about who "we" are: credits says the site is built by
     * "una sola persona" and project then answered in the first person plural
     * ("No vendemos… no cobramos… no recibimos"). Both now describe the project
     * itself, so the page holds one voice.
     */
    project:
      "Es un proyecto personal, gratuito y sin publicidad. No vende datos, no cobra por el acceso y no recibe nada de la FIFA ni de ningún club.",
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
        "Ir a quitarle el balón al rival de forma organizada. El informe publica la presión alta, media y baja como tasas independientes: no suman 100 y no son partes del tiempo sin balón.",
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
       * LONGER per-shot label whose vocabulary this site does not map. CS-1 HAS
       * NOW LANDED (093a1b2; schemaVersion 2 -> 3, and CS-2 has since taken it
       * to 4), so that extension exists in the contract — and the site still
       * maps none of it, deliberately, because AD-14 decision CR-2 makes
       * `outcome` authoritative for marker encoding. (Stale-rationale fix,
       * Story 2.13 ruling 5.) Decision 12: do NOT write the count anywhere, in
       * code, comment or copy — this comment stated the rule and broke it in
       * the same sentence until the 2.18 code review. The counts live in
       * contract/common.schema.json, which is the one place they cannot go
       * stale.
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
    "coming-off-the-line": {
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
       *
       * EACH ENTRY OPENS WITH ITS OWN SENTENCE (2.18 code review). The shared
       * relationship sentence is unchanged and still ships in both, as Task 6.5
       * requires — but it was the ENTIRE definition of both, and the two entries
       * render consecutively at /glossary, so a reader met the same paragraph
       * twice in a row and the page read as a duplication bug.
       */
      es: "ofrecimientos para recibir",
      en: "offers to receive",
      definition:
        "Cuántas veces los jugadores de un equipo se ofrecieron como opción de pase, y en cuántas de esas les llegó el balón. Un ofrecimiento es un jugador que se ofrece para recibir; un desmarque es la parte de esos ofrecimientos en la que además se movió. El informe cuenta aparte los ofrecimientos sin movimiento.",
    },
    "movement-to-receive": {
      es: "desmarques",
      en: "movement to receive",
      definition:
        "Los ofrecimientos en los que el jugador además hizo un movimiento, repartidos en seis tipos. Un ofrecimiento es un jugador que se ofrece para recibir; un desmarque es la parte de esos ofrecimientos en la que además se movió. El informe cuenta aparte los ofrecimientos sin movimiento.",
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
    /*
     * NO metaTitle/metaDescription (2.18 code review). /glossary shipped a
     * route metadata export while /about deliberately refuses one until the
     * open <title>/OG-stays-Spanish ruling lands — so the en.* halves of these
     * keys were unreachable by construction, which is the dead-key pattern
     * AC 1's BINDING prohibits. Both routes now wait on the same decision;
     * re-mint these with the metadata export when it is taken.
     */
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
      /*
       * Story 2.11b ruled decision 1. The Expert Layer gets its OWN sibling
       * boundary and its own copy: `crashed` above literally says "el análisis
       * táctico de este partido", which would be a FALSE STATEMENT over an
       * Expert crash while eleven healthy Tactical sections render above it.
       *
       * REVIEW PATCH (2.11b code review). The explanation used to say "El
       * análisis táctico y el resto de la página siguen disponibles." — which
       * this boundary CANNOT KNOW. The two boundaries are siblings over the
       * SAME bundle and the expected throw source is @/lib/format on a
       * non-finite numeric, a fault class that can throw in both layers; the
       * two fallbacks then stack and the lower one asserts the upper one is
       * fine. It now names the reader's actual recourse and claims nothing
       * about a sibling it cannot observe. Still distinct from
       * `crashedExplanation`, which i18n.test.ts pins.
       */
      crashedExpert: "No pudimos mostrar los datos por jugador de este partido.",
      crashedExpertExplanation: "Puedes recargar la página para volver a intentarlo.",
    },
  },
  /*
   * ------------------------ THE TOURNAMENT HUB (Story 2.12) ------------------
   *
   * `/`'s results and standings. A NEW TOP-LEVEL NAMESPACE rather than a branch
   * of `match.*`: every string under `match.bundle.*` is match-scoped and would
   * be a FALSE STATEMENT here — `match.bundle.loading` is literally "Cargando
   * datos DEL PARTIDO" and `match.bundle.invalid` "Los datos DE ESTE PARTIDO".
   * The same goes for `tactical.empty.*` ("… para este partido"). The Hub is a
   * different surface and gets its own copy.
   *
   * REUSED, NOT RE-MINTED: `enums.stage.*` (all 7 codes, already ruled, incl.
   * "Dieciseisavos de final"), `match.hero.group` ("Grupo" — one term, one key;
   * promoting it to a shared namespace would rewrite a shipped key path for no
   * behavioural gain, and 2.16/2.17 are the natural point), and
   * `match.hero.scoreSeparator` / `match.meta.penShort` for the scoreline.
   *
   * RULED VERBATIM by EXPERIENCE.md's per-term table: `standings.heading` is
   * "Tabla de posiciones" (the row that also rules "Líderes del torneo" for
   * 2.13, and that avoids "Clasificación" entirely — in LatAm it MEANS the
   * standings table and the Hub carries both surfaces), and the standings
   * column abbreviations are its ruled set: PJ, G, E, P, GF, GC, DG, Pts.
   *
   * NEWLY AUTHORED under EXPERIENCE.md's extension procedure, because that
   * table has no row for any of them: `hub.title` (the Hub `<h1>`, which no
   * spine specifies), `results.heading` ("Resultados" — the results-surface
   * heading, likewise unspecified), `enums.matchdayRound.*` (all nine codes,
   * which had no key in either dictionary) and the ENGLISH standings column
   * abbreviations (the table rules the Spanish set and the English CHIP
   * letters, not the English column heads). All four are flagged in the story's
   * Completion Notes for Juan to confirm.
   *
   * The four rows are appended to EXPERIENCE.md's own table under "Rows
   * appended by Story 2.12" — added at CODE REVIEW, because the first pass
   * minted the strings and claimed the append without making it. Minting
   * terminology without the row is how the table stops being the record.
   */
  hub: {
    /*
     * The page `<h1>`. It is a locale string rather than `tournamentName`
     * because AD-11 (ruled D1) reserves the build-time `readTournament()` read
     * to `<title>`/OG metadata, and the artifact's proper noun is not available
     * to the pre-rendered body. It must cover the whole route — leaderboards
     * (2.13) as well as standings and results — so it names the tournament
     * rather than either surface.
     */
    title: "El torneo",
    // Composition glyph, registered so no component hardcodes it.
    separator: " · ",
    // The runtime region's four states (D1), mirroring MatchBundleRegion's
    // machine with Hub-scoped copy.
    region: {
      loading: "Cargando los datos del torneo",
      loaded: "Datos del torneo cargados.",
      error: "No pudimos cargar los datos del torneo. Revisa tu conexión e intenta de nuevo.",
      retry: "Reintentar",
      /*
       * A payload that ARRIVED INTACT and then failed the schemaVersion gate is
       * not a network failure, so this branch carries no retry — re-fetching
       * the identical artifact can never change the answer.
       */
      invalid: "Los datos del torneo no coinciden con esta versión del sitio.",
      invalidExplanation: "Estamos al tanto. Vuelve a intentarlo más tarde.",
      /*
       * The render-time crash the error boundary catches — a DIFFERENT failure
       * from `error` (the fetch never arrived) and from `invalid` (it arrived
       * and failed the version gate): here it arrived, passed the gate, and one
       * malformed field threw while painting.
       *
       * Hub-scoped rather than the boundary's `match.bundle.crashed` default,
       * which reads "el análisis táctico de este partido" — a false statement
       * on a tournament-wide route (ruled D8).
       */
      crashed: "No pudimos mostrar los resultados y las posiciones.",
      crashedExplanation:
        "Los datos del torneo llegaron con un valor que no pudimos leer. Estamos al tanto.",
    },
    /*
     * The `<md` column disclosure (AC 4). TWO keys, not one conditional call:
     * `{t(cond ? "a" : "b")}` trips the i18n gate, so the key is built into a
     * variable — ViewDataDisclosure's hard-won idiom, copied rather than
     * re-derived.
     */
    columns: {
      more: "Más columnas",
      fewer: "Menos columnas",
    },
    // The `<md` sort menu (AC 4). `trigger` is composed with the table's own
    // name at the call site so twelve menus do not share one accessible name.
    sortMenu: {
      trigger: "Ordenar",
      clear: "Orden original",
    },
    standings: {
      // RULED VERBATIM (EXPERIENCE.md, "standings / leaderboards").
      heading: "Tabla de posiciones",
      /*
       * UX-DR12's "stated default sort per table", discharged by the caption —
       * which NEVER mutates on sort (2.11a decision 7). `null` sort state IS
       * artifact order (AD-5), and the artifact states rank order.
       */
      caption: "Ordenado por posición.",
      // Names the table in the ONE polite sort announcement; composed with the
      // group label at the call site, because twelve tables share this surface.
      tableName: "Tabla de posiciones",
      // sr-only prefix on the stretched row anchor, so a screen reader's link
      // list reads "Ver el equipo México" and not a bare team name.
      rowLink: "Ver el equipo",
      empty: {
        headline: "Sin posiciones para este grupo.",
        explanation: "El índice del torneo todavía no trae la tabla de este grupo.",
      },
      column: {
        rank: "Pos.",
        team: "Equipo",
        played: "PJ",
        won: "G",
        drawn: "E",
        lost: "P",
        goalsFor: "GF",
        goalsAgainst: "GC",
        goalDifference: "DG",
        points: "Pts",
        form: "Forma",
      },
      /*
       * `headTitle` for the NINE abbreviated heads only — TableColumn's
       * contract is "full term when headText is abbreviated; null otherwise",
       * so `team` and `form` deliberately have no entry. UX-DR17 requires the
       * full term behind every ruled abbreviation.
       */
      columnTitle: {
        rank: "Posición",
        played: "Partidos jugados",
        won: "Ganados",
        drawn: "Empatados",
        lost: "Perdidos",
        goalsFor: "Goles a favor",
        goalsAgainst: "Goles en contra",
        goalDifference: "Diferencia de gol",
        points: "Puntos",
      },
    },
    results: {
      // NEWLY AUTHORED (see the namespace docblock).
      heading: "Resultados",
      caption: "Ordenado por número de partido.",
      tableName: "Tabla de resultados",
      rowLink: "Ver el partido",
      /*
       * Row-sized `decidedBy` suffixes. `match.hero.extraTime` ("Definido en
       * tiempo extra") and `match.hero.shootout` ("Penales:") are HERO-sized
       * caption copy and do not fit a 390 px table row, so the row prints a
       * short visible form and carries the full term in an `sr-only` span.
       * The extra-time full form REUSES `match.hero.extraTime`; the shoot-out
       * one is minted here because `match.hero.shootout` carries a colon and
       * labels a following number rather than standing alone.
       */
      extraTimeShort: "t. extra",
      shootoutFull: "Definido en penales",
      empty: {
        headline: "Sin resultados para esta fase.",
        explanation: "El índice del torneo todavía no trae partidos en esta fase.",
      },
      column: {
        match: "Partido",
        matchNumber: "N.º",
        date: "Fecha",
        kickoff: "Hora",
        venue: "Sede",
        matchdayRound: "Jornada",
      },
      columnTitle: {
        matchNumber: "Número de partido",
      },
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
      /*
       * Story 2.11b — the Expert tables' fourth identity column. The
       * viz.table.* namespace already carried team, player and shirt; this was
       * the only identity head missing. The VALUES are enums.position.*, which
       * has shipped since Story 2.4.
       */
      position: "Posición",
      /*
       * Story 2.11c — the receiving log's two enum columns (ruling 3).
       *
       * "Tipo de desmarque" is REQUIRED, not a choice: it is already the
       * shipped Spanish for exactly this classification, in
       * viz.movement.totalsCaption ("Totales por equipo y tipo de desmarque.")
       * and viz.movement.barNote ("...entre los seis tipos de desmarque.").
       * Minting "Tipo de movimiento" would put a second Spanish name on one
       * enum. The EN head is "Movement type" — the noun viz.movement.barNote
       * already uses ("the six movement types"); note that viz.movement.title
       * itself reads "Movement to receive", which is the SECTION's name and not
       * a column head. (An earlier draft of this comment claimed the EN head
       * matched viz.movement.title; corrected at the 2.11c code review.)
       */
      eventType: "Tipo de evento",
      movementType: "Tipo de desmarque",
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
      /*
       * These three MUST track enums.distributionType (2.18 code review). Task
       * 8.6 realigned that enum's es labels to the en kick-vs-throw distinction
       * BECAUSE "Saque de volea" and "Saque con la mano" were mutually
       * confusable — but these headings kept both rejected strings verbatim and
       * print one line below the labels that replaced them, reintroducing the
       * confusion the enum fix removed. Each heading now names its own family.
       */
      feetTechniques: "Técnicas de saque con el pie",
      handsTechniques: "Técnicas de volea desde las manos",
      throwTechniques: "Técnicas de lanzamiento con la mano",
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
     * ShotOutcomeDetail labels are deliberately ABSENT, and they stay absent
     * now that CS-1 has landed (093a1b2; the 24-value enum exists in the
     * contract): AD-14 decision CR-2 makes `outcome` authoritative for marker
     * encoding and forbids deriving it from the detail, so the absence is a
     * ruling rather than a gap. Whoever ships detail labels owns minting them
     * — 2.11 and 2.18 have both shipped without, and 2.13 maps `MetricCode`
     * instead. (Stale-rationale fix, Story 2.13 ruling 5.)
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
     * Story 2.11c — the ReceivingEvent DISCRIMINATOR, and the only new enum
     * namespace the receiving log needs (ruling 3). The log merges the two
     * surfaces that share one array, so without this column a reader cannot
     * tell an offer row from a movement row on any of the 270.
     *
     * THE SPANISH IS DERIVED FROM SHIPPED COPY, not chosen. The two values name
     * the two SECTIONS the array feeds, so the labels are the singular of those
     * two section titles: viz.offers.title is "Ofrecimientos para recibir" and
     * viz.movement.title is "Desmarques". That makes the column
     * self-documenting — a reader maps a row to a section — and it agrees with
     * enums.offerMovement's own docblock, which states that "desmarque is the
     * regional term for the movement itself, so the enum labels name the
     * DIRECTION and the section title carries the noun".
     *
     * A KNOWING NEAR-COLLISION, recorded rather than papered over: a row can
     * read event type "Desmarque" beside movement type "Sin desmarque". That is
     * what the source says — the movement-to-receive map records an event whose
     * movement classification is "no movement". Splitting the terms would be a
     * ruling, not a dev choice.
     *
     * (2.18 decision 3 is the ruling that binds "ofrecimientos" for the OFFER
     * side; 2.11b's Task 3.8 read the opposite and "Ofrecimientos" shipped as a
     * declared departure from it, re-affirmed at that story's code review.)
     */
    receivingEventType: {
      offer: "Ofrecimiento",
      movement: "Desmarque",
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
    /*
     * ---------------------- STORY 2.12's THREE ENUMS ------------------------
     *
     * TWO LETTER SYSTEMS COLLIDE ON THE HUB, and keying off the enum code is
     * what keeps them apart — this is the story's likeliest silent bug.
     *
     * 1. `D` INVERTS ACROSS LOCALES. es `D` is *derrota* (LOSS); en `D` is
     *    *draw*. A key named after the letter would flip meaning on the
     *    language toggle with nothing to catch it. `i18n.test.ts` asserts the
     *    divergence explicitly: es `D` and en `D` map to DIFFERENT MatchResult
     *    codes, and that assertion exists to fail if anyone "tidies" these.
     * 2. CHIPS AND COLUMNS USE DIFFERENT LETTERS FOR THE SAME CONCEPTS, IN THE
     *    SAME ROW. Chips are V/E/D, standings columns are G/E/P — only `E`
     *    coincides. The two live in different namespaces on purpose.
     * 3. And in EN the standings `played` head is "MP", not "P": `P` is already
     *    the es *perdidos* column, and English standings tables split on
     *    played-vs-lost the other way round. Newly authored, since
     *    EXPERIENCE.md rules the es column set only.
     *
     * Both are RULED VERBATIM by EXPERIENCE.md's "result letters & standings
     * columns" row (V / E / D; chips EN: W / D / L) — one of the three
     * scaffolding rows `deferred-work.md` routed to its owning story, which
     * this is.
     */
    matchResult: {
      win: "V",
      draw: "E",
      loss: "D",
    },
    /*
     * The chip's spoken form. A chip whose accessible content is a bare letter
     * makes the row's name unreadable, so every chip carries an `sr-only` word.
     * A spoken-form rule is not written in the spines — this is a ruled
     * addition, on the precedent of the `líder` sr-only affix (Story 2.4).
     */
    matchResultFull: {
      win: "Victoria",
      draw: "Empate",
      loss: "Derrota",
    },
    /*
     * All NINE MatchdayRound codes. `MatchdayRound` is a SEPARATE closed enum
     * from `Stage`: six codes share a name with a stage and are restated here
     * rather than bridged to `enums.stage`, because a code with no entry of its
     * own renders unlabelled the day the two vocabularies diverge. The six
     * shared labels are pinned EQUAL to their `enums.stage` counterparts in
     * `i18n.test.ts`, so the restatement cannot drift into a second term.
     *
     * "Jornada" is the standard LatAm word for a group matchday; the round is a
     * rendered LABEL on every results row and is never a sectioning key (D10).
     */
    matchdayRound: {
      "group-md1": "Jornada 1",
      "group-md2": "Jornada 2",
      "group-md3": "Jornada 3",
      r32: "Dieciseisavos de final",
      r16: "Octavos de final",
      qf: "Cuartos de final",
      sf: "Semifinal",
      "third-place": "Tercer puesto",
      final: "Final",
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
    /*
     * ---------------- STORY 2.13 — THE 32 LEADERBOARD METRICS ----------------
     *
     * A NEW NAMESPACE, because `enums.metric` above is SEALED: i18n.test.ts
     * pins its key set exactly to KEY_STAT_FIELDS (19 Domain B fields) and
     * `tactical-sections.ts`, which owns that list, is do-not-touch. One extra
     * key there is a red suite — this file already records the collision twice.
     * MetricCode is 32 values, so a new namespace is the only shape that fits,
     * and it is the shape `expert.field` established for exactly this reason.
     *
     * ALMOST NOTHING HERE IS MINTED. Eighteen strings are `enums.metric` above,
     * verbatim (every one of its 19 keys except `directPressures`, which is not
     * a MetricCode); fourteen come from `expert.field` / `expert.fieldTitle`.
     * A metric that names the same quantity as a shipped label takes that
     * label rather than a second name for it.
     *
     * FULL TERMS ONLY. Two of the fourteen are ABBREVIATIONS in `expert.field`
     * — topSpeed is "Vel. máx." and highSpeedRuns is "CARR. ALTA VEL." — so
     * both are taken from `expert.fieldTitle` instead. The abbreviations live in
     * `leaderboardMetricAbbr` below and are keyed by the same code, which is
     * what lets a narrow column head swap one for the other while keeping the
     * full term in `headTitle` and in the accessible name (UX-DR17, UX-DR19).
     */
    leaderboardMetric: {
      // — 18 from enums.metric, verbatim —
      ballProgressions: "Progresiones de balón",
      completedLineBreaks: "Rupturas de líneas completadas",
      crosses: "Centros",
      defensiveLineBreaks: "Rupturas de líneas defensivas",
      defensivePressures: "Presiones defensivas",
      distanceCovered: "Distancia",
      expectedGoals: "xG",
      forcedTurnovers: "Recuperaciones forzadas",
      goals: "Goles",
      passCompletion: "Precisión de pases",
      passes: "Pases",
      passesCompleted: "Pases completados",
      possession: "Posesión",
      receptionsInFinalThird: "Recepciones en el último tercio",
      secondBalls: "Segundas jugadas",
      shots: "Tiros",
      shotsOnTarget: "Tiros al arco",
      sprintDistance: "Distancia en sprint",
      // — 14 from expert.field, verbatim, except the two noted below —
      crossesCompleted: "Centros completados",
      duelsWonAerial: "Duelos aéreos ganados",
      duelsWonPhysical: "Duelos físicos ganados",
      interceptions: "Intercepciones",
      lineBreaksCompleted: "Rupturas de líneas completadas",
      possessionRegains: "Recuperaciones",
      sprints: "Sprints",
      stepIns: "Irrupciones",
      switchesOfPlay: "Cambios de orientación",
      tacklesWon: "Entradas ganadas",
      takeOns: "Regates",
      totalDistance: "Distancia total",
      // The two whose expert.field value is an ABBREVIATION. Their FULL terms
      // come from expert.fieldTitle — this namespace holds full terms only.
      highSpeedRuns: "Carreras a alta velocidad",
      topSpeed: "Velocidad máxima",
    },
    /*
     * The ruled table abbreviations — EXACTLY TWO, and THIS STORY MINTS NONE.
     *
     * EXPERIENCE.md's Spanish-text-expansion rule names one worked example
     * ("VEL. MÁX." for "Velocidad máxima", with the full term in the header's
     * tooltip and aria-label), and the app already ships both strings as ruled
     * copy. Both values below are byte-for-byte reuses, pinned in i18n.test.ts
     * so a second mint cannot drift in beside them:
     *   topSpeed      = match.hero.tiles.topSpeed  (= expert.field.topSpeed)
     *   highSpeedRuns = expert.field.highSpeedRuns (ruled by the glossary's
     *                   high-speed-run definition, verbatim)
     *
     * SENTENCE CASE, not ALL-CAPS, for topSpeed: the uppercase rendering comes
     * from `type-stat-label`, which carries `text-transform: uppercase`, never
     * from the string. (`type-label-caps` does NOT — despite the name it is a
     * caps-METRIC label, 11px/600/0.08em tracking, and every one of its twenty
     * consumers passes content that is already uppercase. Corrected at review;
     * the earlier claim named both classes.) Every other metric has no ruled
     * abbreviation and therefore gets no
     * entry — the head falls back to its full term.
     */
    leaderboardMetricAbbr: {
      highSpeedRuns: "CARR. ALTA VEL.",
      topSpeed: "Vel. máx.",
    },
  },
  /*
   * ------------------------ THE EXPERT LAYER (Story 2.11b) ------------------
   *
   * A NEW TOP-LEVEL NAMESPACE, not a branch of `tactical`: the Expert Layer is
   * a SIBLING of the Tactical Layer, never a twelfth SectionId (ruled decision
   * 2), and nesting its copy under `tactical.` would be the first step back
   * toward the registry it must stay out of.
   *
   * `field` is FORTY keys, not forty-six. The six `offersByMovementType`
   * columns resolve through the shipped `enums.offerMovement` bridge — adding a
   * seventh entry there would turn i18n.test.ts's OFFER_MOVEMENT_TYPES pin red,
   * and restating those six labels here would be two sources for one term.
   *
   * Domain G labels are DELIBERATELY NOT in `enums.metric`: that namespace is
   * pinned key-for-key to KEY_STAT_FIELDS (19 Domain B fields), so one extra
   * key there is a red suite.
   *
   * Ruled Spanish reused verbatim from the glossary rather than re-invented:
   * regate (take-on) · irrupción (step-in, FINAL, 2.18 decision 2) ·
   * rupturas de líneas (line-break) · progresión de balón · centro (cross) ·
   * presión (pressing) · zonas de velocidad · carreras a alta velocidad, whose
   * definition already ships the ruled table abbreviation "CARR. ALTA VEL." ·
   * recuperaciones (forced-turnover) · balón suelto (second-ball) · sprint.
   * `Tiros`, `Precisión de pases` and `Ofrecimientos` / `Recibidos` follow the
   * shipped enums.metric and viz.table values for the SAME quantities rather
   * than minting a second name for each.
   *
   * Newly minted here under EXPERIENCE.md:278's procedure and recorded in the
   * story's Dev Agent Record: proyecciones (pushingOn), proyecciones con
   * presión (pushingOnIntoPressing), recepciones de balón suelto
   * (looseBallReceptions), disputas ganadas (possessionContestsWon),
   * posesiones interrumpidas (possessionInterrupted), cambios de orientación
   * (switchesOfPlay).
   */
  expert: {
    pill: "EXPERTO",
    // Ruled by the mobile mockup's own <h2>, verbatim.
    heading: "Datos por jugador",
    // The mobile mockup's copy, VERBATIM. Story 2.11c landed the logs block, so
    // "registros completos" now names content the reader can reach.
    summary: "En posesión · Sin posesión · Físico — tablas por jugador y registros completos",
    /*
     * UX-DR12 requires every table to STATE its default order, and this one
     * never mutates on sort (2.11a decision 7).
     *
     * REVIEW PATCH (2.11b code review): "equipo LOCAL y dorsal" was false in
     * half the story. Below md the rows are filtered to one side, so with the
     * away team selected no "equipo local" ordering is observable at all — and
     * the caption is this table's accessible name and its one durable
     * statement of canonical order, so it cannot be allowed to drift. "por
     * equipo y dorsal" is true in BOTH layouts: the wide table is ordered by
     * team then shirt, and the narrow one shows a contiguous slice of exactly
     * that order. Reworded rather than made conditional, because decision 7
     * forbids a caption that mutates.
     */
    tableCaption: "Ordenado por equipo y dorsal.",
    // Names the table in the ONE polite sort announcement the page owns.
    tableName: "Tabla de datos por jugador",
    group: {
      // Ruled VERBATIM in EXPERIENCE.md:276. The rejected "Con balón / Sin
      // balón" form was removed from the app by Story 2.18 decision 4 — do not
      // reintroduce it, and do not reuse viz.phases.*, which are PHASE labels.
      inPossession: "En posesión",
      outOfPossession: "Sin posesión",
      physical: "Físico",
      // aria-label for the <md column-group ToggleGroup.
      label: "Grupo de columnas",
    },
    empty: {
      /*
       * NAMES DOMAIN G, not "the Expert Layer" (ruled decision 10). The
       * generic "El informe oficial no incluye esta sección." would be a false
       * statement over a report whose other pages are present, and `players`
       * is nullable, so this branch is reachable.
       */
      headline: "Sin datos por jugador para este partido.",
      explanation: "El informe oficial de este partido no incluye las páginas por jugador.",
    },
    /*
     * REVIEW PATCH (2.11b code review). A SECOND, DISTINCT absence — the
     * report DOES carry the per-player pages, but the current view has no rows
     * to show. `empty` above cannot serve it: "el informe oficial no incluye
     * las páginas por jugador" is a false statement here.
     *
     * Three triggers reach it. `players: []`, which the contract sanctions
     * explicitly ("Empty array and null are distinct states",
     * match-bundle.schema.json) and which used to render 50 sortable headers
     * over an empty body with no explanation at all; a Domain G page carrying
     * only one team's records at <md; and the reader selecting the side that
     * has no rows. The team ToggleGroup stays mounted alongside this panel, so
     * the third case is always one tap from recovery.
     */
    emptyRows: {
      headline: "Sin filas por jugador para mostrar.",
      explanation: "El informe incluye las páginas por jugador, pero no hay filas que mostrar aquí.",
    },
    /*
     * STORY 2.11c — THE FULL EVENT LOGS BLOCK (AC 1, UX-DR18).
     *
     * SIX LINK LABELS, and none of them may equal the viz.*.title it is
     * composed against: the rendered hint is `${section title} · Ver los datos`
     * printed beside the label, so a label equal to its own title would print
     * the same phrase twice on one line. i18n.test.ts asserts all six, in both
     * locales, so this stays true.
     *
     * `offers` and `movement` are "Tabla de ..." rather than "Registro de ..."
     * on purpose (ruling 6): those two are Story 2.9's AGGREGATE surfaces, not
     * event logs, and AC 1 does not enumerate them — they are here as pointers.
     *
     * receivingOrder states the ONE table this block renders, and deliberately
     * does NOT reuse viz.table.caption ("Ordenado por minuto."), which three
     * tables already resolve and which would be a fourth indistinguishable
     * caption. It is composed with receivingHeading at the call site, so the
     * rendered <caption> names its own table like the other ten sections do.
     */
    logs: {
      heading: "Registros completos",
      shotLog: "Registro de tiros",
      crossLog: "Registro de centros",
      passMatrix: "Matriz de pases",
      offers: "Tabla de ofrecimientos",
      movement: "Tabla de desmarques",
      defensive: "Registro de acciones defensivas",
      receivingHeading: "Registro de recepciones",
      receivingOrder: "Ordenado por minuto, luego local antes que visitante.",
      // Names the table in the ONE polite sort announcement the page owns.
      receivingName: "Tabla del registro de recepciones",
    },
    /*
     * The 40 keyed column heads, in the contract's required[] order.
     * The unit NEVER rides the label (ruled decision 4): metres and km/h go in
     * the column head as `enums.unit.*`, composed at the call site, and never
     * per cell — 46 columns of per-cell units at 11px is unreadable.
     */
    field: {
      // inPossession (16 scalars; the nested offers block is six more columns
      // resolved through enums.offerMovement).
      passesAttempted: "Pases intentados",
      passesCompleted: "Pases completados",
      passCompletion: "Precisión de pases",
      switchesOfPlay: "Cambios de orientación",
      crossesAttempted: "Centros intentados",
      crossesCompleted: "Centros completados",
      lineBreaksAttempted: "Rupturas de líneas intentadas",
      lineBreaksCompleted: "Rupturas de líneas completadas",
      lineBreakCompletion: "Precisión de rupturas de líneas",
      ballProgressions: "Progresiones de balón",
      takeOns: "Regates",
      stepIns: "Irrupciones",
      /*
       * "Tiros", following the shipped enums.metric.shots for the same
       * quantity. NEVER "Intentos a puerta": "a puerta" is on the
       * forbidden-register sweep and "al arco" is the ruled LatAm form, which
       * this column does not need because the report counts ALL attempts, not
       * only the on-target ones.
       */
      attemptsAtGoal: "Tiros",
      goals: "Goles",
      /*
       * OFFER, not movement. The glossary's FINAL ruling (2.18 decision 3) is
       * "offers to receive" -> ofrecimientos and "movement to receive" ->
       * desmarques, and Story 2.9 already ships these two exact fields as
       * viz.table.offersMade / offersReceived. `enums.offerMovement`'s "Sin
       * desmarque" labels the MOVEMENT type `no-movement`, so it fixes the
       * house term for movement, not for offer.
       */
      totalOffers: "Ofrecimientos",
      offersReceived: "Ofrecimientos recibidos",
      // outOfPossession (15).
      tacklesMade: "Entradas",
      tacklesWon: "Entradas ganadas",
      blocks: "Bloqueos",
      interceptions: "Intercepciones",
      pressingDirect: "Presión directa",
      pressingIndirect: "Presión indirecta",
      duelsWonAerial: "Duelos aéreos ganados",
      duelsWonPhysical: "Duelos físicos ganados",
      // "disputa" is the shipped house term for a possession contest
      // (viz.table.contestType = "Tipo de disputa").
      possessionContestsWon: "Disputas ganadas",
      clearances: "Despejes",
      looseBallReceptions: "Recepciones de balón suelto",
      /*
       * MINTED. The report prints "Pushing On" for a defender advancing with
       * the line; "proyección" is the established LatAm term for exactly that
       * movement and invents no direction the source does not print.
       */
      pushingOn: "Proyecciones",
      pushingOnIntoPressing: "Proyecciones con presión",
      possessionRegains: "Recuperaciones",
      possessionInterrupted: "Posesiones interrumpidas",
      // physical (9). The five zones are the PAGE'S OWN km/h bands, which ride
      // in `fieldTitle` rather than in the head text.
      totalDistance: "Distancia total",
      distanceZone1: "Zona 1",
      distanceZone2: "Zona 2",
      distanceZone3: "Zona 3",
      distanceZone4: "Zona 4",
      distanceZone5: "Zona 5",
      // The ruled table abbreviation, shipped verbatim by the high-speed-run
      // glossary definition: "En las tablas la columna se abrevia CARR. ALTA
      // VEL."
      highSpeedRuns: "CARR. ALTA VEL.",
      sprints: "Sprints",
      /*
       * REVIEW PATCH (2.11b code review). Shipped as "Velocidad máxima", the
       * widest head in the physical group — while `enums.metric.topSpeed`
       * already carries "Vel. máx." as RULED copy, and EXPERIENCE.md:139 names
       * this exact term as the table-abbreviation precedent ("VEL. MÁX." for
       * "Velocidad máxima", full term in the tooltip, ellipsis truncation never
       * the first resort). This reuses the existing ruled abbreviation rather
       * than minting a second one; the full term is in `fieldTitle.topSpeed`.
       */
      topSpeed: "Vel. máx.",
    },
    /*
     * `headTitle` for the six ABBREVIATED heads only — TableColumn's contract
     * is "full term when headText is abbreviated; null otherwise", so every
     * other column deliberately has no entry here.
     */
    fieldTitle: {
      distanceZone1: "0-7 km/h",
      distanceZone2: "7-15 km/h",
      distanceZone3: "15-20 km/h",
      distanceZone4: "20-25 km/h",
      distanceZone5: "25 km/h o más",
      highSpeedRuns: "Carreras a alta velocidad",
      topSpeed: "Velocidad máxima",
    },
  },
  /*
   * ================= LÍDERES DEL TORNEO (Story 2.13, FR-26) =================
   *
   * A NEW TOP-LEVEL NAMESPACE for the Hub's leaderboards section. This
   * DISCHARGES THE LEADERBOARDS HALF of EXPERIENCE.md's "standings /
   * leaderboards" policy row, which glossary.ts records as having "NO locale
   * keys at all" and deferred to its owning story. The STANDINGS half is Story
   * 2.12's and is not claimed here.
   *
   * `title` IS RULED, not chosen. The policy row reads: "standings /
   * leaderboards | translate | Tabla de posiciones / Líderes del torneo |
   * 'Clasificación' is avoided entirely — in LatAm it *means* the standings
   * table, and the Hub carries both surfaces". i18n.test.ts's forbidden-register
   * sweep bans the prefix "clasificaci" outright, so any leaderboard copy
   * reaching for it turns the suite red by design.
   *
   * NO COLUMN LABEL FOR THE ENTITY OR THE TEAM. Those two heads resolve
   * `viz.table.player` / `viz.table.team`, which already ship as the house
   * column names for exactly those quantities — a second pair here would be two
   * sources for one term, which is what this file's docblocks exist to prevent.
   * The VALUE column's head is the metric label itself (enums.leaderboardMetric
   * or its abbreviation), so it needs no entry either.
   *
   * t() HAS NO INTERPOLATION, so the result-count sentence is composed at the
   * call site from `filterResults` / `filterResultsOne` and a formatted number.
   * Tuteo, neutral LatAm register, no exclamation marks (UX-DR19).
   */
  leaderboards: {
    title: "Líderes del torneo",
    // Names the two altitudes EXPERIENCE.md's Visualization Layering row gives
    // this surface: teaser rows, then the full sortable tables.
    teaserHeading: "Lo más destacado",
    tablesHeading: "Tablas completas",
    /*
     * The teaser's own row count, composed at the call site — NEVER the literal
     * "3". Ranks are competition-ranked, so a tie at rank 3 puts four or more
     * rows in a teaser and a hardcoded three would be a visible lie (ruling 9).
     */
    teaserCount: "primeros puestos",
    teaserCountOne: "primer puesto",
    /*
     * THE TEASER'S OVERFLOW LINE (ruled by Juan at the 2.13 code review).
     *
     * A card prints at most three rows; when more rows qualify at `rank <= 3`
     * it STATES how many it withheld rather than cutting them silently. The
     * real emission makes this concrete: `passCompletion/player` puts 51
     * one-match players at rank 1, which turned one card in a three-up grid
     * into a 51-entry list.
     *
     * `…TiedAt` names the shared rank and is used ONLY when every withheld row
     * carries it; `…More` is the honest fallback when the withheld rows span
     * more than one rank, because naming a rank they do not all share would be
     * the misstatement the disclosure exists to avoid. Both are composed at the
     * call site — t() has no interpolation.
     */
    teaserOverflowTiedAt: "empatados en el puesto",
    teaserOverflowTiedAtOne: "empatado en el puesto",
    // NO singular variant: "+1 más en el top 3" and "+2 más en el top 3" take
    // the same words, so a `…MoreOne` key would be a dead one.
    teaserOverflowMore: "más en el top 3",
    // Joins a board's metric label to its scope label in the board heading.
    boardSeparator: " · ",
    /*
     * UX-DR12 requires every table to STATE its default order, and this one
     * never mutates on sort (2.11a decision 7). The default order is the
     * artifact's, which for a leaderboard is rank order — there is no
     * sorted-on-mount column and no `defaultSort` prop.
     */
    tableCaption: "Ordenado por puesto.",
    /*
     * THE PER-BOARD DISCLOSURE (ruled at the 2.13 code review). Past the first
     * three boards the table is not mounted at all, so the real emission's 36
     * boards do not put ~2,965 rows on the page at once. Distinct from 2.12's
     * "Más columnas" control, which discloses COLUMNS within one table.
     */
    showTable: "Ver la tabla",
    hideTable: "Ocultar la tabla",
    filterLabel: "Filtrar por nombre",
    filterPlaceholder: "Escribe un nombre",
    filterResults: "resultados",
    filterResultsOne: "resultado",
    filterNoResults: "Sin resultados",
    filterNoResultsExplanation:
      "Ningún nombre coincide con el filtro. Borra letras para ver más filas.",
    empty: "Todavía no hay tablas de líderes",
    emptyExplanation: "El índice del torneo no trae ninguna tabla de líderes.",
    /*
     * A board that ARRIVED with zero rows is not a filter that excluded them.
     * Conflating the two told the reader to "borrar letras" from an empty
     * filter box — found at the 2.13 code review. The contract's "empty array
     * and null are distinct states" applies one level down as well.
     */
    boardEmpty: "Esta tabla llegó sin filas",
    boardEmptyExplanation: "El torneo todavía no tiene datos suficientes para este indicador.",
    loading: "Cargando las tablas de líderes",
    /*
     * The RESOLVED announcement, which this region shipped without — while both
     * sibling regions on the same routes (match.bundle.loaded, hub.region.loaded)
     * announced theirs. A screen-reader user was told when results and standings
     * arrived and nothing when the leaderboards did; the aria-busy skeleton just
     * disappeared. Found at the 2.13 code review, and it is exactly the
     * two-regions-answering-differently defect the region's own docblock claims
     * to have avoided.
     */
    loaded: "Tablas de líderes cargadas.",
    error: "No pudimos cargar las tablas de líderes.",
    retry: "Reintentar",
    /*
     * A payload that arrived intact and then failed the schemaVersion gate —
     * a data-integrity problem, not a network one, so it gets NO retry button
     * (re-fetching the same artifact cannot change the answer). Mirrors
     * match.bundle.invalid, whose distinction Story 2.5's review ruled.
     */
    invalid: "Las tablas de líderes no coinciden con esta versión de los datos.",
    invalidExplanation:
      "El archivo llegó completo pero trae otra versión del esquema, así que no se muestra.",
    columns: {
      rank: "Puesto",
      matchesPlayed: "Partidos",
      perMatch: "Por partido",
    },
    // Plural, because it names what the whole board ranks — the entity COLUMN
    // head is the singular viz.table.team / viz.table.player.
    scope: {
      team: "Equipos",
      player: "Jugadores",
    },
    /*
     * The artifact carries `higherIsBetter` "so the App can label the board
     * correctly without a hard-coded metric table of its own" (the schema's own
     * words). Render it; do not ignore it.
     */
    higherIsBetter: {
      true: "Más es mejor",
      false: "Menos es mejor",
    },
  },
};

export type Dictionary = typeof es;

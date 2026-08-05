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
      glossaryLink: "Glossary",
    },
  },
  about: {
    title: "About this site",
    dataTitle: "The data",
    methodologyTitle: "How we read xG",
    creditsTitle: "Credits",
    projectTitle: "About the project",
    // RULED VERBATIM (Story 2.18 decision 1) — see es.ts for why the AC's
    // one-clause form was overturned. Must agree with glossary.xg.definition.
    methodology:
      "xG values are FIFA's own, taken from the official report and never recomputed. The report publishes only each team's xG total — there is no per-shot value, which is why every shot marker is drawn at the same size.",
    // PROPOSED, not ruled — flagged for Juan at review (see es.ts).
    credits:
      "The site is built and maintained by one person. The design, the code and the translations are ours; the data is FIFA's.",
    // Third person, matching credits — see the es.ts note on the person clash.
    project:
      "This is a personal project, free and ad-free. It does not sell data, it does not charge for access, and it receives nothing from FIFA or from any club.",
  },
  /*
   * THE GLOSSARY. The `es` and `en` leaves are BYTE-IDENTICAL to es.ts and that
   * is deliberate, not an untranslated mirror: the term PAIR is
   * locale-invariant, because AC 2 requires both languages to render
   * simultaneously in one locale's page ("build-up — es: salida de balón").
   * Only `definition` is localised. Do not "fix" the mirrored term leaves.
   *
   * Every definition below is AUTHORED IN ENGLISH against the same corpus
   * facts, never machine-translated: `en: Dictionary` guards key shape only and
   * would happily accept a Spanish string in an `en` leaf.
   */
  glossary: {
    "line-break": {
      es: "rupturas de líneas",
      en: "line breaks",
      definition:
        "A pass that plays past one or more lines of opposition players. The report counts them per team, and also the ones each defence concedes.",
    },
    "counter-press": {
      es: "contrapresión",
      en: "counter-press",
      definition:
        "Pressing immediately after losing the ball, to win it back before the opponent settles. The report publishes it as one of the out-of-possession phases.",
    },
    pressing: {
      es: "presión",
      en: "pressing",
      definition:
        "Organised pressure to win the ball back. The report publishes high, mid and low pressing as independent rates: they do not add to 100 and they are not shares of time out of possession.",
    },
    "build-up": {
      es: "salida de balón",
      en: "build-up",
      definition:
        "The phase in which a team plays the ball out from its own half. The report splits it into build-up opposed and build-up unopposed.",
    },
    "high-block": {
      es: "bloque alto",
      en: "high block",
      definition:
        "The team defends with its lines close to the opposition half. One of the three block heights the report measures.",
    },
    "mid-block": {
      es: "bloque medio",
      en: "mid block",
      definition:
        "The team defends with its lines around the middle of the pitch. One of the three block heights the report measures.",
    },
    "low-block": {
      es: "bloque bajo",
      en: "low block",
      definition:
        "The team defends with its lines close to its own goal. One of the three block heights the report measures.",
    },
    "line-height": {
      es: "altura de la línea defensiva",
      en: "line height",
      definition:
        "How far from its own goal a team's last line plays, in metres. The report does not state which phase of play each distance describes.",
    },
    "team-length": {
      es: "longitud del equipo",
      en: "team length",
      definition:
        "The distance in metres between a team's most advanced line and its deepest one. The report does not state which phase of play it describes.",
    },
    "phases-of-play": {
      es: "fases del juego",
      en: "phases of play",
      definition:
        "The passages the report splits a match into: eight in possession and nine out of possession. They are independent rates, they do not sum to 100 and they are not parts of a whole.",
    },
    xg: {
      es: "xG",
      en: "xG",
      definition:
        "Expected goals: each shot's probability of becoming a goal, per FIFA's model. The report publishes only the team total, not a per-shot value.",
    },
    "pass-network": {
      es: "red de pases",
      en: "pass network",
      definition:
        "The picture of who passed to whom within a team. Each player is a node and each line is the passes between two players.",
    },
    "speed-zones": {
      es: "zonas de velocidad",
      en: "speed zones",
      definition: "The speed bands the report uses to split the distance each player covers.",
    },
    "high-speed-run": {
      es: "carreras a alta velocidad",
      en: "high-speed runs",
      definition:
        "Runs a player makes above the speed threshold the report sets. The Spanish column head is abbreviated to CARR. ALTA VEL.",
    },
    sprint: {
      es: "sprint",
      en: "sprint",
      definition:
        "A passage of running at top speed. The report publishes sprint distance per player and per team.",
    },
    "take-on": {
      es: "regate",
      en: "take-on",
      definition:
        "An attempt to beat an opponent while keeping the ball. The report prints it as Take Ons, between ball progressions and attempts at goal.",
    },
    "step-in": {
      es: "irrupción",
      en: "step-in",
      definition:
        "A carry with which a player breaks into the opposition block. The report prints it as Step Ins on the in-possession distributions page, so it is an on-ball action and not a defensive move.",
    },
    "second-ball": {
      es: "segunda jugada",
      en: "second ball",
      definition: "The contest for a loose ball after a clearance, a rebound or an aerial duel.",
    },
    "forced-turnover": {
      es: "recuperaciones forzadas",
      en: "forced turnovers",
      definition:
        "Losses of possession a team forces on its opponent. The credit belongs to the team that forces it, not to the one that suffers it.",
    },
    "ball-progression": {
      es: "progresión de balón",
      en: "ball progression",
      definition:
        "Moving the ball towards the opposition goal, by pass or by carry. The report counts it per player and per team.",
    },
    "reception-in-final-third": {
      es: "recepción en el último tercio",
      en: "reception in the final third",
      definition: "Receiving the ball in the third of the pitch closest to the opposition goal.",
    },
    "set-play": {
      es: "balón parado",
      en: "set play",
      definition:
        "Any play that starts from a dead ball: corners, free kicks, throw-ins and penalties.",
    },
    momentum: {
      // Decision 5 — the policy table's own tooltip text is factually false for
      // this series (Story 1.8 closed OQ-5). See es.ts.
      es: "momentum",
      en: "momentum",
      definition:
        "How often each team enters the final third, minute by minute. The report publishes no per-minute possession, so this does not measure dominance.",
    },
    goal: {
      es: "gol",
      en: "goal",
      definition:
        "A shot that ends in a goal. One of the five shot outcomes the report publishes.",
    },
    "on-target": {
      es: "al arco",
      en: "on target",
      definition:
        "A shot that was heading in and did not go in. One of the five shot outcomes the report publishes.",
    },
    "off-target": {
      es: "desviado",
      en: "off target",
      definition:
        "A shot that missed the goal. One of the five shot outcomes the report publishes.",
    },
    blocked: {
      es: "bloqueado",
      en: "blocked",
      definition:
        "A shot an opponent blocks before it reaches the goal. One of the five shot outcomes the report publishes.",
    },
    incomplete: {
      es: "incompleto",
      en: "incomplete",
      definition:
        "A shot the report does not classify into any of the other four outcomes. The report also prints a longer per-shot label whose vocabulary the site does not map yet.",
    },
    goalkeeper: {
      es: "arquero",
      en: "goalkeeper",
      definition:
        "The player who defends the goal. The Spanish term the site uses is the one most of Latin America uses.",
    },
    save: {
      es: "atajada",
      en: "save",
      definition: "The intervention with which a goalkeeper prevents a goal.",
    },
    distribution: {
      es: "distribución",
      en: "distribution",
      definition:
        "How a goalkeeper puts the ball back in play: kicked from feet, volleyed from the hands, or thrown. The report splits each family into techniques.",
    },
    "coming-off-the-line": {
      es: "salidas",
      en: "coming off the line",
      definition: "When a goalkeeper leaves the line to cut out a cross or a through ball.",
    },
    "one-on-one": {
      es: "mano a mano",
      en: "one-on-one",
      definition: "The duel between a goalkeeper and an attacker arriving alone in front of goal.",
    },
    defender: {
      es: "defensa",
      en: "defender",
      definition:
        "The position of the players in the last line. The report prints it in the line-ups.",
    },
    midfielder: {
      es: "mediocampista",
      en: "midfielder",
      definition: "The position of the players in midfield. The report prints it in the line-ups.",
    },
    forward: {
      es: "delantero",
      en: "forward",
      definition: "The position of the attacking players. The report prints it in the line-ups.",
    },
    corner: {
      es: "tiro de esquina",
      en: "corner",
      definition:
        "The kick taken from the corner of the pitch. The Spanish term the site uses throughout is tiro de esquina.",
    },
    offside: {
      es: "posición adelantada",
      en: "offside",
      definition:
        "The offence of receiving the ball beyond the opposition's last line. The Spanish term the site uses is the Latin American one.",
    },
    cross: {
      es: "centro",
      en: "cross",
      definition:
        "A delivery from a wide area into the box. The report publishes how many were attempted, how many were completed and the delivery type.",
    },
    "offers-to-receive": {
      // Decision 3's relationship, verbatim and shared with movement-to-receive.
      // Each entry opens with its own sentence first — see the es.ts note.
      es: "ofrecimientos para recibir",
      en: "offers to receive",
      definition:
        "How often a team's players made themselves an option for a pass, and how often the ball reached them. An offer is a player making himself available to receive; a movement to receive is the subset of those offers in which he also moved. The report counts offers with no movement separately.",
    },
    "movement-to-receive": {
      es: "desmarques",
      en: "movement to receive",
      definition:
        "The offers in which the player also made a move, split across six types. An offer is a player making himself available to receive; a movement to receive is the subset of those offers in which he also moved. The report counts offers with no movement separately.",
    },
    "defensive-actions": {
      es: "acciones defensivas",
      en: "defensive actions",
      definition:
        "The actions with which a team tries to win the ball back: regains, blocks and contests. The report publishes coordinates for only some of them.",
    },
  },
  glossaryPage: {
    title: "Glossary",
    intro: "The tactical and statistical terms the site uses, in Spanish and English.",
    seeMore: "See in the glossary",
    jargonNote:
      "The English term is kept: there is no short Spanish form a reader would recognise.",
    authoredNote:
      "The official report carries no glossary. These definitions are ours, written from where each figure appears in the report and from how its numbers reconcile.",
    // Locale-invariant in both dictionaries — the subtitle names the OTHER
    // language, so its prefix does not swap with the interface.
    esPrefix: "es:",
    enPrefix: "en:",
    // No metaTitle/metaDescription — see the es.ts note: /glossary's metadata
    // export was removed so both new routes wait on the same open ruling.
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
        // Story 2.18 Task 8.10 — the unit is composed at the call site from
        // enums.unit, never baked into the label (AD-7). See es.ts.
        distance: "Distance",
        topSpeed: "Top speed",
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
      crashedExpert: "We could not display the per-player data for this match.",
      // Review patch (2.11b): claimed the sibling Tactical boundary was healthy,
      // which this boundary cannot know. See the es.ts note.
      crashedExpertExplanation: "You can reload the page to try again.",
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
        title: "Shot & cross maps",
        summary: "Where each team's shots and crosses came from.",
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
        // Story 2.18 decision 3 — the offers⊋movements relationship ships in
        // the section, not only in the glossary. Verbatim; see es.ts.
        summary: "How they offered to receive, and in which of those offers they also moved.",
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
      momentumHeadline: "The momentum timeline is not available for this match.",
      receivingHeadline: "No per-player data for this match.",
      receivingExplanation:
        "This section is built from the report's per-player tables, and this report does not carry them.",
      // Story 2.18 decision 7 — the per-section boundary's copy. An app-side
      // failure, stated as one; it must never claim the report lacks the
      // section (see es.ts).
      sectionCrashed: "We couldn't display this section.",
      sectionCrashedExplanation: "The data arrived in a format we couldn't read.",
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
  viz: {
    attribution: "Data: FIFA PMSR · wc-stats",
    viewData: "View data",
    hideData: "Hide data",
    teamSelector: "Team",
    table: {
      caption: "Sorted by minute.",
      team: "Team",
      player: "Player",
      minute: "Minute",
      x: "X",
      y: "Y",
      outcome: "Outcome",
      xg: "xG",
      delivery: "Cross type",
      completed: "Completed",
      unknown: "—",
      yes: "Yes",
      no: "No",
      shirt: "Shirt",
      involvement: "Involvement",
      connections: "Connections",
      from: "From",
      to: "To",
      passes: "Passes",
      captionNodes: "Sorted by team, then shirt number.",
      captionEdges: "Sorted by team, then passes, highest first.",
      actionType: "Action type",
      contestType: "Contest type",
      offersMade: "Offers",
      offersReceived: "Received",
      receivedPct: "Received %",
      players: "Players",
      total: "Total",
      // Story 2.10 columns.
      phase: "Phase",
      category: "Category",
      measure: "Measure",
      count: "Count",
      share: "Share",
      left: "Left",
      right: "Right",
      complete: "Complete",
      incomplete: "Incomplete",
      slot: "Slot",
      slotCount: "Slots",
      keeper: "Goalkeeper",
      // Story 2.11a — the one sortable data-table contract (UX-DR12). Mirrors
      // es.ts exactly; see that file for why each key exists.
      sortAction: "Sort by",
      sortedBy: "Sorted by",
      sortAscending: "ascending",
      sortDescending: "descending",
      sortCleared: "The table's original order has been restored.",
      position: "Position",
      // Story 2.11c — the receiving log's two enum columns.
      eventType: "Event type",
      movementType: "Movement type",
    },
    cluster: {
      dialogLabel: "Events at this point",
      countBefore: "Point with",
      countAfter: "events",
    },
    marker: {
      unknownPlayer: "unknown player",
      unknownMinute: "unknown minute",
      pinned: "isolated",
    },
    shotMap: {
      title: "Shot map",
      markerPrefix: "Shot by",
      minutePrefix: "minute",
      shots: "shots",
      shotsOne: "shot",
      goals: "goals",
      goalsOne: "goal",
      xg: "xG",
      figurePrefix: "Shot map:",
      zero: "The report records no shots for this team.",
      ownGoalsExcluded: "Own goals are not drawn on the map; they appear in the table.",
    },
    crossMap: {
      title: "Cross map",
      markerPrefix: "Cross by",
      minutePrefix: "minute",
      crosses: "crosses",
      crossesOne: "cross",
      completed: "Completed",
      attempted: "Attempted",
      completedCount: "completed",
      completedCountOne: "completed",
      figurePrefix: "Cross map:",
      zero: "The report records no crosses for this team.",
    },
    passNetwork: {
      title: "Pass network",
      figurePrefix: "Pass network:",
      markerPrefix: "Player",
      involvementPrefix: "involvement",
      nameJoin: "and",
      nodeRole: "pass-network node",
      players: "players",
      playersOne: "player",
      connectionsCount: "connections",
      connectionsCountOne: "connection",
      passes: "passes",
      passesOne: "pass",
      zero: "The report records no pass network for this team.",
      nodeNote: "Node: player · size shows involvement.",
      edgeNote: "Line: passes between two players · thickness and colour show how many.",
      showAll: "Show all passes",
      showLess: "Show fewer passes",
    },
    momentum: {
      figurePrefix: "Momentum timeline:",
      metricNote: "Final-third entries per minute, by team.",
      axisMinute: "Minute",
      axisEntries: "Final-third entries",
      cursorLabel: "Minute cursor: use the arrow keys to read each minute.",
      minutePrefix: "Minute",
      entries: "entries",
      entriesOne: "entry",
      goals: "goals",
      goalsOne: "goal",
      minutes: "minutes",
      minutesOne: "minute",
      goalPrefix: "Goal by",
      ownGoal: "own goal",
      penalty: "penalty",
      approximate: "approximate position",
      tableCaption: "Ordered by match minute, stoppage time included.",
      tableGoal: "Goal",
    },
    offers: {
      title: "Offers to receive",
      figurePrefix: "Offers to receive:",
      madeLabel: "Offers",
      receivedLabel: "Received",
      receivedPctLabel: "Received %",
      offers: "offers",
      offersOne: "offer",
      received: "received",
      receivedOne: "received",
      noShare: "no offers",
      zero: "The report records no offers for this team.",
      noRows: "The report carries no per-player data for this team.",
      note: "Match totals, summed over the team's players.",
      totalsCaption: "Team totals.",
      tableCaption: "Sorted by team, then shirt number.",
    },
    movement: {
      title: "Movement to receive",
      figurePrefix: "Movement to receive:",
      offers: "offers",
      offersOne: "offer",
      barNote: "Each bar splits the team's offers across the six movement types.",
      zero: "The report records no offers for this team.",
      totalsCaption: "Team totals by movement type.",
      tableCaption: "Sorted by team, then shirt number.",
    },
    defensiveActions: {
      title: "Defensive actions",
      markerPrefix: "Defensive action by",
      minutePrefix: "minute",
      figurePrefix: "Defensive actions:",
      actions: "actions",
      actionsOne: "action",
      legendNoun: "defensive actions",
      zero: "The report records no defensive actions for this team.",
      tableCaptionNoClock: "Sorted by team; the report records no minute.",
    },
    // Story 2.10's four sections. No `title` key — the four section titles
    // already exist as tactical.sections.*.title.
    phases: {
      figurePrefix: "Phases of play:",
      inPossession: "In possession",
      outOfPossession: "Out of possession",
      note: "These are independent per-phase rates: they do not sum to 100 and are not parts of a whole.",
      axisRate: "Share of time",
      axisPhase: "Phase",
      tableCaption: "Sorted by phase, in the report's order.",
    },
    pressing: {
      figurePrefix: "Pressing and blocks:",
      pressRates: "Pressing intensity",
      blocks: "Defensive blocks",
      note: "These are independent rates: they do not sum to 100 and are not parts of a whole.",
      axisRate: "Share of time",
      axisPhase: "Phase",
      metres: "Defensive line height and team length",
      metre: {
        lineHeight: {
          inPossession: "Line height in possession",
          outOfPossession: "Line height out of possession",
        },
        teamLength: {
          inPossession: "Team length in possession",
          outOfPossession: "Team length out of possession",
        },
      },
      metreNote: "The report does not state which phase of play these distances describe.",
      tableCaption: "Sorted by phase, in the report's order.",
      metreTableCaption: "Distances in metres, by measure and possession state.",
    },
    setPlays: {
      figurePrefix: "Set plays:",
      totals: "Totals",
      totalSetPlays: "Set plays",
      setPlaysOne: "set play",
      setPlaysMany: "set plays",
      freeKicks: "Free kicks",
      corners: "Corners",
      cornersOne: "corner",
      cornersMany: "corners",
      throwIns: "Throw-ins",
      penalties: "Penalties",
      freeKickNote: "The report publishes all four values separately; they do not always contain one another.",
      cornerSide: "Side taken from",
      cornerType: "Delivery type",
      cornerStyle: "Delivery style",
      cornerStyleNote: "Independent counts: these may not match the corner total.",
      cornerMismatchNote:
        "The segments do not add up to the corner total the report publishes. Both figures are shown, and neither is adjusted.",
      declaredTotal: "Report's total",
      barNote: "Each bar splits the team's corners across the report's categories.",
      zero: "The report records no set plays for this team.",
      zeroCorners: "The report records no corners for this team.",
      totalsCaption: "Team totals.",
      freeKickCaption: "Free kicks by type, independent counts.",
      cornerCaption: "Corners by side, delivery type and delivery style.",
      cornerTypeSideCaption: "Corners by side within each delivery type.",
    },
    goalkeeping: {
      figurePrefix: "Goalkeeping:",
      keeperOne: "Goalkeeper",
      keeperMany: "Goalkeepers",
      involvementsOne: "involvement",
      involvementsMany: "involvements",
      involvementTitle: "Involvements",
      involvementAxisNote:
        "The axis orders the report's slots; a stoppage slot carries the preceding regulation minute.",
      axisSlot: "Report slot",
      axisInvolvements: "Involvements",
      distribution: "Distribution",
      distributionTotal: "Total",
      lineBreaks: "Line breaks",
      goalPrevention: "Goal prevention",
      attemptsFaced: "Attempts faced",
      savePercentage: "Save percentage",
      interventions: "Interventions",
      byInterventionType: "By intervention type",
      byBodyType: "By body part",
      denominatorPrefix: "of",
      aerial: "Aerial control",
      aerialInterventions: "Aerial interventions",
      crossesFaced: "Crosses faced",
      crossesFacedCompleted: "Crosses completed",
      crossesFacedAlone: "Crosses faced (the report does not publish how many were completed)",
      deliveryTypes: "Cross type faced",
      gateNote:
        "The report publishes some breakdowns as images only, with no readable values: those panels are not shown.",
      zeroRecord: "The report includes no goalkeeper block for this team.",
      zeroAll: "The report lists no goalkeeper for this match.",
      zeroTimeline: "The report plots no slots for this goalkeeper.",
      feetTechniques: "Kick-from-feet techniques",
      handsTechniques: "Kick-from-hands techniques",
      throwTechniques: "Throw techniques",
      summaryCaption: "Total involvements as printed by the report.",
      timelineCaption:
        "Slots as plotted by the report, in order. The source does not guarantee they sum to the total.",
      distributionCaption: "Distribution by family and technique.",
      preventionCaption:
        "Interventions by type; these sum to attempts faced, not to total interventions.",
      headlineCaption: "Goal-prevention totals as printed by the report.",
      bodyTypeCaption:
        "Interventions by body part; these sum to total interventions, not to attempts faced.",
      aerialCaption: "Aerial control and crosses faced.",
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
    shotOutcome: {
      goal: "Goal",
      "on-target": "On target",
      "off-target": "Off target",
      blocked: "Blocked",
      incomplete: "Incomplete",
    },
    crossDelivery: {
      inswing: "Inswinging",
      outswing: "Outswinging",
      driven: "Driven",
      lofted: "Lofted",
      cutback: "Cutback",
      "push-cross": "Push cross",
    },
    offerMovement: {
      "in-front": "In front",
      "in-between": "In between",
      "out-to-in": "Out to in",
      "in-to-out": "In to out",
      "in-behind": "In behind",
      "no-movement": "No movement",
    },
    // Story 2.11c — the ReceivingEvent discriminator. See the es.ts note for
    // why the Spanish is the singular of the two section titles; in EN the two
    // codes are already plain words.
    receivingEventType: {
      offer: "Offer",
      movement: "Movement",
    },
    defensiveAction: {
      "forced-turnover": "Forced turnover",
      "possession-regain": "Possession regain",
      block: "Block",
      "possession-contest": "Possession contest",
    },
    possessionContest: {
      pass: "Pass",
      "attempt-at-goal": "Attempt at goal",
      cross: "Cross",
      clearance: "Clearance",
      "physical-duel": "Physical duel",
      "aerial-duel": "Aerial duel",
    },
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
    // Story 2.10's fourteen vocabularies, keyed by contract enum code (AD-7).
    inPossessionPhase: {
      "build-up-unopposed": "Build-up unopposed",
      "build-up-opposed": "Build-up opposed",
      progression: "Progression",
      "final-third": "Final third",
      "long-ball": "Long ball",
      "attacking-transition": "Attacking transition",
      "counter-attack": "Counter-attack",
      "set-piece": "Set piece",
    },
    outOfPossessionPhase: {
      "high-press": "High press",
      "mid-press": "Mid press",
      "low-press": "Low press",
      "high-block": "High block",
      "mid-block": "Mid block",
      "low-block": "Low block",
      recovery: "Recovery",
      "defensive-transition": "Defensive transition",
      "counter-press": "Counter-press",
    },
    blockLevel: {
      high: "High block",
      mid: "Mid block",
      low: "Low block",
    },
    freeKick: {
      direct: "Direct free kick",
      "direct-on-target": "Direct on target",
      "direct-off-target": "Direct off target",
      indirect: "Indirect free kick",
    },
    cornerDeliveryType: {
      "direct-to-area": "Direct to area",
      short: "Short",
      "edge-of-penalty-area": "Edge of the area",
    },
    /*
     * Story 2.18 Task 8.9. These shipped as "Inswing"/"Outswing" while
     * en.enums.crossDelivery ships "Inswinging"/"Outswinging" for the SAME
     * delivery shape. The es docblock states the reuse is deliberate — "one
     * delivery shape has one Spanish name across the app" — and es delivers on
     * it; en did not.
     */
    cornerDeliveryStyle: {
      inswing: "Inswinging",
      outswing: "Outswinging",
      driven: "Driven",
      lofted: "Lofted",
    },
    pitchSide: {
      left: "Left",
      right: "Right",
    },
    distributionType: {
      feet: "Kick from feet",
      hands: "Kick from hands",
      throw: "Throw",
    },
    feetTechnique: {
      "play-onto": "Play onto",
      "play-into": "Play into",
      "play-around": "Play around",
      "play-through": "Play through",
      "play-beyond": "Play beyond",
      other: "Other",
    },
    handsTechnique: {
      "side-kick": "Side kick",
      "from-hands": "From hands",
      "drop-kick": "Drop kick",
    },
    throwTechnique: {
      "over-arm": "Over-arm",
      "under-arm": "Under-arm",
      "side-arm": "Side-arm",
      chest: "Chest",
    },
    interventionType: {
      "save-and-retain": "Save and retain",
      "save-and-deflect": "Save and deflect",
      "deflect-and-retain": "Deflect and retain",
      "save-attempt": "Save attempt",
      "no-save-attempt": "No save attempt",
    },
    interventionBodyType: {
      head: "Head",
      hands: "Hands",
      "upper-body": "Upper body",
      "lower-body": "Lower body",
      feet: "Feet",
    },
    aerialType: {
      punch: "Punch",
      claim: "Claim",
      "tipped-palmed": "Tipped or palmed",
    },
    unit: {
      km: "km",
      m: "m",
      kmh: "km/h",
    },
  },
  expert: {
    pill: "EXPERT",
    heading: "Per-player data",
    // The mockup's copy, verbatim — 2.11c landed the logs block. See es.ts.
    summary: "In possession · Out of possession · Physical — per-player tables and full event logs",
    // Review patch (2.11b): "home team" was false below md, where the rows are
    // filtered to one side. See the es.ts note.
    tableCaption: "Sorted by team and shirt number.",
    tableName: "Per-player data table",
    group: {
      inPossession: "In possession",
      outOfPossession: "Out of possession",
      physical: "Physical",
      label: "Column group",
    },
    empty: {
      headline: "No per-player data for this match.",
      explanation: "The official report for this match does not include the per-player pages.",
    },
    // Review patch (2.11b): the report DOES carry the pages, but this view has
    // no rows. `empty` above would be a false statement here. See the es.ts note.
    emptyRows: {
      headline: "No per-player rows to show.",
      explanation: "The report includes the per-player pages, but there are no rows to show here.",
    },
    // Story 2.11c — the full event logs block. See the es.ts note for why the
    // six labels must differ from the section titles they compose against, and
    // why `offers`/`movement` are "table" rather than "log".
    logs: {
      heading: "Full event logs",
      shotLog: "Shot log",
      crossLog: "Cross log",
      passMatrix: "Pass matrix",
      offers: "Offers table",
      movement: "Movement table",
      defensive: "Defensive-actions log",
      receivingHeading: "Receiving log",
      receivingOrder: "Sorted by minute, then home before away.",
      receivingName: "Receiving log table",
    },
    field: {
      passesAttempted: "Passes attempted",
      passesCompleted: "Passes completed",
      passCompletion: "Pass completion",
      switchesOfPlay: "Switches of play",
      crossesAttempted: "Crosses attempted",
      crossesCompleted: "Crosses completed",
      lineBreaksAttempted: "Line breaks attempted",
      lineBreaksCompleted: "Line breaks completed",
      lineBreakCompletion: "Line break completion",
      ballProgressions: "Ball progressions",
      takeOns: "Take-ons",
      stepIns: "Step-ins",
      attemptsAtGoal: "Attempts at goal",
      goals: "Goals",
      totalOffers: "Offers to receive",
      offersReceived: "Offers received",
      tacklesMade: "Tackles made",
      tacklesWon: "Tackles won",
      blocks: "Blocks",
      interceptions: "Interceptions",
      pressingDirect: "Direct pressing",
      pressingIndirect: "Indirect pressing",
      duelsWonAerial: "Aerial duels won",
      duelsWonPhysical: "Physical duels won",
      possessionContestsWon: "Possession contests won",
      clearances: "Clearances",
      looseBallReceptions: "Loose-ball receptions",
      pushingOn: "Pushing on",
      pushingOnIntoPressing: "Pushing on into pressing",
      possessionRegains: "Possession regains",
      possessionInterrupted: "Possession interrupted",
      totalDistance: "Total distance",
      distanceZone1: "Zone 1",
      distanceZone2: "Zone 2",
      distanceZone3: "Zone 3",
      distanceZone4: "Zone 4",
      distanceZone5: "Zone 5",
      /*
       * REVIEW PATCH (2.11b code review). Shipped as "HIGH-SPD RUNS" — an
       * invented contraction with no glossary entry and no pinning test, unlike
       * the Spanish "CARR. ALTA VEL.", which the high-speed-run definition
       * rules verbatim. Nothing in EN is abbreviated in this block ("Possession
       * interrupted" is longer and ships whole), so the mint is retired rather
       * than recorded: there is no EN copy ruling to reuse and this story does
       * not have one to make.
       */
      highSpeedRuns: "High-speed runs",
      sprints: "Sprints",
      topSpeed: "Top speed",
    },
    fieldTitle: {
      distanceZone1: "0-7 km/h",
      distanceZone2: "7-15 km/h",
      distanceZone3: "15-20 km/h",
      distanceZone4: "20-25 km/h",
      distanceZone5: "25 km/h and above",
      highSpeedRuns: "High-speed runs",
      // Mirrors es.expert.fieldTitle.topSpeed, which expands "Vel. máx.". The
      // EN head is unabbreviated, so this title restates it — TITLED_FIELDS is
      // keyed per FIELD, not per locale, and parity is the compile-time rule.
      topSpeed: "Top speed",
    },
  },
};

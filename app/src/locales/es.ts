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
  },
  meta: {
    title: "WC Stats — Analítica del Mundial 2026",
    description: "Análisis táctico y estadístico de los 104 partidos de la Copa Mundial 2026.",
  },
  enums: {
    stage: {},
    position: {},
    shotOutcome: {},
    metric: {},
    unit: {},
  },
};

export type Dictionary = typeof es;

"use client";

/*
 * THE ONE LAZY BOUNDARY for every recharts-bearing leaf in the app (Story 2.15
 * ruled D1, AC 6). Every `dynamic()` call site in `src/components/**` imports
 * from HERE and from nowhere else.
 *
 * WHAT IT FIXES, and why the ledger's recorded remedy would not have. The filed
 * remedy was "a single shared re-export module that both leaves import" — but
 * `MomentumChart.tsx` and `TacticalCharts.tsx` ALREADY imported the identical
 * bare specifier `"recharts"`, so module identity was never the problem. The
 * duplication is PER ASYNC CHUNK GROUP, and there were two groups because there
 * were two distinct `dynamic()` IMPORT SPECIFIERS — `@/components/MomentumChart`
 * and `@/components/TacticalCharts`. A barrel that both leaves import leaves
 * both groups intact; a barrel that both CALL SITES import collapses them into
 * one, and one group carries one copy of the ~300 kB vendor.
 *
 * The converse was already proven in-repo before this file existed:
 * `PhasesSection` and `PressingSection` declare FIVE `dynamic()` handles across
 * three files, all pointing at `@/components/TacticalCharts`, and produce ONE
 * chunk group — "next/dynamic dedupes on the import specifier, so this costs
 * nothing at the network layer" (PhasesSection's own docblock).
 *
 * MEASURED. Before: two 300.4 kB chunks classified VENDOR (89.4 + 89.2 kB
 * gzip-9). After: exactly one. The three-scenario cost table is in the story's
 * Completion Notes; the classifier that produces it discriminates on
 * `CartesianAxis` AND `Brush` AND `redux` together, because `CartesianAxis`
 * alone also matches the 34.5 kB TacticalCharts LEAF.
 *
 * THE COST IS REAL AND IS RECORDED RATHER THAN HIDDEN. Collapsing the groups
 * means a Match Dashboard that mounts only `MomentumChart` — `momentum` is in
 * ALWAYS_EXPANDED_SECTION_IDS, so it mounts at every width — now also pulls the
 * `TacticalCharts` and `ProfileCharts` leaves. That is a small regression on the
 * one path where nothing else opens, against −89 kB gzip the moment a second
 * chart section opens, on every `≥lg` load, and on every `/players/{slug}`.
 *
 * ADDING A CHART? EXPORT IT HERE. A chart reached by any other `dynamic()`
 * specifier mints a fresh chunk group and a fresh vendor copy — the precise
 * defect this file exists to remove. This module holds re-exports ONLY: it must
 * never grow logic, because everything it names is on the deferred side of the
 * boundary and anything added here is deferred with it.
 */

export { MomentumChart } from "@/components/MomentumChart";
export { DistributionChart, InvolvementChart } from "@/components/TacticalCharts";
export { CategoryBarChart, TrendChart } from "@/components/ProfileCharts";
export { CompareBarChart } from "@/components/CompareCharts";

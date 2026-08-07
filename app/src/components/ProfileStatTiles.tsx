"use client";

import { cn } from "@/lib/utils";

/*
 * The single-entity stat tile (Story 2.15, ruled D5).
 *
 * A NEW COMPONENT RATHER THAN AN EXTENSION OF `StoryStatTiles`, and the reason
 * is structural. `EXPERIENCE.md:73` specs one tile for "Hero Story Stats,
 * profiles, comparison", but every head-to-head clause in that spec — two
 * values, the accented leader, the ▲ glyph, the `sr-only` «líder» — exists only
 * in head-to-head context. A PROFILE HAS NO LEADER. Widening `StoryStatTiles`
 * would mean making `awayValue`, `homeCode`, `awayCode` and `leader` optional on
 * a component whose whole job is comparing two of them, which is how a
 * comparison component quietly becomes a component that sometimes compares.
 *
 * So the TOKEN RECIPE is copied verbatim and the BEHAVIOUR is not: same grid,
 * same card, same `type-stat-label` / `type-stat-value` / `type-label-caps`
 * ramp, same `tabular-nums`. NO leader glyph, no side accent, no `resolveLeader`.
 *
 * THE TILE IS NOT A TAP TARGET (`EXPERIENCE.md:73`). The only focusable thing a
 * tile may contain is a `GlossaryTerm` inside its label, which is why `label`
 * accepts a node — the label is composed as a STRING at the call site whenever
 * it carries a unit, because the JSX form `{t(a)} ({t(b)})` emits `" ("` as a
 * literal child and fails the i18n gate.
 */

export interface ProfileStatTile {
  key: string;
  /** Already-resolved. A node only so a `GlossaryTerm` can ride inside it. */
  labelNode: React.ReactNode;
  /** Already formatted through `@/lib/format` — this component never formats. */
  value: string;
  /** Optional metric code / unit caption beneath the value. */
  caption?: string;
  /** Spans both grid columns — the odd tile out in a 3- or 5-tile block. */
  wide?: boolean;
}

export function ProfileStatTiles({ tiles }: { tiles: readonly ProfileStatTile[] }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-tile-gap">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className={cn("rounded-md bg-surface-raised p-3", tile.wide === true && "col-span-2")}
        >
          <div className="type-stat-label text-center text-ink-secondary">{tile.labelNode}</div>
          <div className="mt-2 flex flex-col items-center gap-0.5">
            {/*
             * `tabular-nums` on the VALUE, always. DESIGN.md:301 makes the
             * pairing mandatory and `type-stat-value` deliberately carries no
             * font-variant-numeric of its own, so the Tailwind utility is the
             * only half that supplies it — four tiles whose digits do not align
             * column-to-column is exactly what it exists to prevent.
             */}
            <span className="type-stat-value tabular-nums text-ink-primary">{tile.value}</span>
            {tile.caption === undefined ? null : (
              <span className="type-label-caps text-ink-secondary">{tile.caption}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

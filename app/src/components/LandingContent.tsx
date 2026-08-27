"use client";

import { FeatureBadge } from "@/components/FeatureBadge";
import type { DictionaryKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-provider";
import { type NavDestinationKey, availableDestinations } from "@/lib/nav-destinations";

/*
 * ═══════════ `/` — THE LANDING SURFACE (Story 3.9, D1; UX-DR24) ═════════════
 *
 * EXPERIENCE.md → The Landing Page rules four zones, top to bottom at 390 px:
 *
 *   1 IDENTITY   — the <h1> and a two-to-four-sentence lede: what this is,
 *                  where the data comes from, that it is free and independent.
 *                  PROSE, NOT TILES. It does not replace `/about`, which still
 *                  exists and is still linked from the footer and from badge 8.
 *   2 COMPARAR   — one full-width badge for `/compare`, emphasised, own row.
 *   3 GRID       — the remaining SEVEN badges. One column `<sm`, two `≥sm`,
 *                  four `≥lg`. DOM order equals visual order at every width.
 *   4 FOOTER     — the shipped `AttributionFooter`, already global via
 *                  `layout.tsx`. NOTHING TO ADD HERE.
 *
 * ═══════════ NO TABLE, NO DISCLOSURE, NO LOADING STATE, NO EMPTY STATE ══════
 *
 * `/` reads NO bundle — not at build time, not at runtime. Its reachable
 * artifact list is the empty set (D5b), and `static-output.test.ts` asserts
 * BOTH halves of that separately: a `fetchArtifact` walk for the runtime path
 * and a `readTournament`/`readLeaderboards` walk for the build-time one. The
 * second was added at code review 2026-08-27 — until then the runtime walk was
 * credited with catching a build-time read it structurally could not see. Lede, badges and footer are all
 * pre-rendered static content, so there is no state to be in and therefore no
 * loading or empty copy to mint (EXPERIENCE.md → State Patterns).
 *
 * Everything dense has its own route now. That is the whole point of the
 * refactor: the Hub that used to live here is at `/tournament`.
 *
 * ═══════════ "use client" + useT() IS LOAD-BEARING ═══════════
 *
 * A server-`t()` surface FREEZES SPANISH and ignores the language toggle — the
 * trap `MatchHero.tsx` and `LeaderboardsSection.tsx` both record, and the one
 * deferred item 6.2 closed under the title "Home page body ignores the language
 * toggle". The page above stays a SERVER component; this is the client boundary.
 */

/*
 * THE RULED BADGE SET, IN THE RULED ORDER — Comparar first (zone 2), then the
 * seven of zone 3.
 *
 * 🔴 THE LABELS ARE NOT DECLARED HERE. They are read from `NAV_DESTINATIONS`,
 * whose own docblock states that its nine entries ARE "the ruled badge set
 * (EXPERIENCE.md → The Landing Page) PLUS `Inicio`, and the values below are
 * that set verbatim". Two lists of the same eight labels is two lists to keep in
 * step; this is one list with two presentations, exactly as the nav's own sheet
 * and inline row are.
 *
 * `home` is the one destination with no badge — a badge to the page you are
 * already on. That is why the SET is an explicit key list rather than simply
 * every available destination; the ORDER is ruled here too. Availability is a
 * separate question and is applied on top of this list, not instead of it.
 *
 * ⚠️ BADGE 3 IS CONTAINED BY BADGE 2, AND THAT IS RULED, NOT ACCIDENTAL (D1).
 * *Torneo* addresses the page; *Partidos* addresses the results half of it, at
 * `/tournament/#results`. The flat alternative (*Partidos* + *Posiciones*, no
 * *Torneo*) was considered and rejected. Standings has no badge and is reached
 * through *Torneo*. Do not "fix" this.
 */
const EMPHASISED_KEY: NavDestinationKey = "compare";

const GRID_KEYS: readonly NavDestinationKey[] = [
  "tournament",
  "matches",
  "tops",
  "players",
  "teams",
  "glossary",
  "about",
];

/**
 * The supporting line's key for a destination. Built as an identifier rather
 * than inline, because `{t(`landing.badge.${key}.support`)}` is exactly the
 * template-in-a-gated-position shape the i18n ESLint rule rejects, and
 * `--max-warnings 0` makes that a build error.
 */
function supportKey(key: NavDestinationKey): DictionaryKey {
  return `landing.badge.${key}.support` as DictionaryKey;
}

export function LandingContent() {
  const t = useT();

  /*
   * KEYED OFF `availableDestinations()`, NOT `NAV_DESTINATIONS` (code review
   * 2026-08-27).
   *
   * This built its map from the full table and never read `available`, so the
   * whole availability apparatus — the bijection gate, `SiteNav.test.tsx`'s
   * render-to-flag binding, the export-level "no unavailable destination is
   * linked" case — protected the NAV ONLY. `nav-destinations.ts`'s own docblock
   * requires the flag to stay usable ("a route DELETED in future must be able
   * to turn one of these back to `false`"); the moment a future story does that,
   * `SiteNav` would correctly drop the entry, every gate would stay green, and
   * this grid would go on shipping a full-card link to a deleted route — a 404
   * on the site's entry page.
   *
   * `home` is still excluded by GRID_KEYS rather than by this filter: it is
   * available and deliberately badge-less, which is a different fact.
   */
  const byKey = new Map(availableDestinations().map((destination) => [destination.key, destination]));
  const emphasised = byKey.get(EMPHASISED_KEY);

  return (
    <div>
      {/* ── ZONE 1 — identity ───────────────────────────────────────────── */}
      <h1 className="type-display text-ink-primary">{t("landing.title")}</h1>
      {/*
       * `max-w-prose` and NOT the full 6xl measure: this is the one block of
       * running prose on the site, and DESIGN's dashboard width is a table
       * width. Sixty-odd characters is what a lede is read at.
       */}
      <p className="mt-tile-gap max-w-prose type-body text-ink-secondary">{t("landing.lede")}</p>

      {/* ── ZONE 2 — Comparar, emphasised, on its own row ────────────────── */}
      {emphasised === undefined ? null : (
        <div className="mt-section-gap">
          <FeatureBadge
            href={emphasised.href}
            label={t(emphasised.labelKey)}
            support={t(supportKey(EMPHASISED_KEY))}
            emphasised
          />
        </div>
      )}

      {/* ── ZONE 3 — the seven-badge grid ────────────────────────────────── */}
      {/*
       * 🔴 EVERY `grid` CLASSNAME CARRIES A `grid-cols-*`. With no explicit
       * `grid-template-columns` the items land in an IMPLICIT auto track, which
       * is floored by the item's max-content rather than clamped to the
       * container — measured at a 195 px viewport, that is how `/` became the
       * worst reflow cell in the R2/D8 matrix. `reflow-guards.test.ts:209-270`
       * sweeps the repo for implicit grids and this is why.
       *
       * One column `<sm`, two `≥sm`, four `≥lg` — the contract's steps exactly.
       * DOM ORDER EQUALS VISUAL ORDER AT EVERY WIDTH: no `order-*`, no
       * `grid-flow-dense`, nothing that would let the two disagree.
       */}
      <div className="mt-tile-gap grid grid-cols-1 gap-tile-gap sm:grid-cols-2 lg:grid-cols-4">
        {GRID_KEYS.map((key) => {
          const destination = byKey.get(key);
          if (destination === undefined) {
            return null;
          }
          return (
            <FeatureBadge
              key={key}
              href={destination.href}
              label={t(destination.labelKey)}
              support={t(supportKey(key))}
            />
          );
        })}
      </div>

      {/*
       * ZONE 4 is the shipped `AttributionFooter`, mounted globally by
       * `layout.tsx`. It is not rendered here and must not be — a second copy on
       * `/` would be two attribution blocks on the site's entry page.
       */}
    </div>
  );
}

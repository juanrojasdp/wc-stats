/**
 * The `<title>`/OG string for a route that leads with a TRANSLATED surface
 * label, composed OUTSIDE `generateMetadata` (Story 3.9, D8).
 *
 * ═══════════ WHY THIS HELPER EXISTS AT ALL ═══════════
 *
 * `eslint.config.mjs:207-221` gates the keys
 * `title|description|default|template|absolute|alt|siteName` inside `metadata`
 * and `generateMetadata`, and `--max-warnings 0` turns a finding into a BUILD
 * ERROR. A template literal or a concatenation as the direct value of `title:`
 * is flagged even when every fragment is already a `t()` call. That is why
 * `composeHubTitle`, `composeMatchTitle`, `composePlayerTitle` and
 * `composeTeamTitle` exist, and story 3.9's four new routes need the same
 * treatment.
 *
 * ═══════════ WHY IT IS NOT `composeHubTitle` ═══════════
 *
 * `composeHubTitle`'s first parameter is `tournamentName`, and its docblock
 * states that it "is passed through untranslated: the contract calls it 'a
 * proper noun, not a translated label' (AD-7)". `/tops`, `/players` and
 * `/teams` compose from translated surface labels — "Líderes del torneo",
 * "Jugadores", "Equipos" — so routing them through that helper would falsify a
 * docblock that is currently true. One helper per claim; the two produce the
 * identical shape and `route-title.test.ts` pins that they agree on order.
 *
 * `/tournament` keeps `composeHubTitle`: its title really is the proper noun.
 */
export function composeRouteTitle(input: {
  surfaceLabel: string;
  siteName: string;
  separator: string;
}): string {
  return `${input.surfaceLabel}${input.separator}${input.siteName}`;
}

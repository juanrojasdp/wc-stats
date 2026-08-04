import { GlossaryContent } from "@/components/GlossaryContent";

/*
 * /glossary (Story 2.18, AC 2) — a thin server page whose body is a client
 * component, exactly like /about and /404. The route is on the architecture
 * seed list; the client body lives in src/components/, NOT colocated here, so
 * it does not escape the i18n import seam (a known open gap this story is told
 * not to trigger).
 *
 * NO metadata export, deliberately, and this MATCHES /about rather than
 * diverging from it (2.18 code review). This route shipped a metadata export
 * while /about's docblock refused one on the grounds that the <title>/OG-
 * stays-Spanish decision is open and "adding one here would quietly take that
 * decision" — so the product had one new page with a title and one without,
 * and the en.glossaryPage.meta* keys were dead by construction, which is the
 * pattern AC 1's own BINDING prohibits. Both routes now wait on the same
 * ruling. The keys are removed rather than left unreachable; re-mint them with
 * the route metadata when the <title>/OG decision lands.
 */
export default function GlossaryPage() {
  return <GlossaryContent />;
}

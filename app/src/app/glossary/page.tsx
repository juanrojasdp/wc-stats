import type { Metadata } from "next";

import { GlossaryContent } from "@/components/GlossaryContent";
import { t } from "@/lib/i18n";

/*
 * /glossary (Story 2.18, AC 2) — a thin server page whose body is a client
 * component, exactly like /about and /404. The route is on the architecture
 * seed list; the client body lives in src/components/, NOT colocated here, so
 * it does not escape the i18n import seam (a known open gap this story is told
 * not to trigger).
 *
 * The metadata strings come from dedicated keys rather than being composed, so
 * no pure helper is needed: the gate flags a template or concatenation that is
 * the DIRECT VALUE of a title:/description: property, and a t() call is
 * neither. This is layout.tsx's shipped pattern.
 *
 * KNOWN AND FILED, not fixed here: <title> and OG stay Spanish after an EN
 * toggle, which makes the en.* metadata keys unreachable. That is one of the
 * open decisions awaiting a human ruling; this route makes it one route worse
 * and says so in the ledger rather than resolving it.
 */
export const metadata: Metadata = {
  title: t("glossaryPage.metaTitle"),
  description: t("glossaryPage.metaDescription"),
};

export default function GlossaryPage() {
  return <GlossaryContent />;
}

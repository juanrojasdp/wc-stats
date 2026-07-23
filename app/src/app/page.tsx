import { formatDecimal } from "@/lib/format";
import { t } from "@/lib/i18n";

/*
 * Disposable placeholder proving the stack end-to-end: tokens, typography
 * ramp, fonts and the locale layer. Story 2.2 builds the real chrome.
 */
export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-gutter-mobile py-layer-gap md:px-gutter-desktop">
      <p className="type-label-caps text-ink-secondary">{t("app.siteName")}</p>
      <h1 className="type-headline mt-tile-gap text-ink-primary">{t("app.scaffold.heading")}</h1>
      <p className="type-body mt-tile-gap max-w-prose text-ink-secondary">{t("app.scaffold.body")}</p>
      <section aria-label={t("a11y.scaffold.demoRegion")} className="mt-section-gap">
        <div className="inline-block rounded-lg border border-hairline bg-surface-raised p-gutter-desktop">
          <p className="type-stat-label text-ink-secondary">{t("app.scaffold.statLabel")}</p>
          <p className="type-stat-value mt-tile-gap text-primary">{formatDecimal(1.24, "es")}</p>
        </div>
      </section>
    </main>
  );
}

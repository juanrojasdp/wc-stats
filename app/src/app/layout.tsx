import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";

import { AttributionFooter } from "@/components/AttributionFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { bootstrapScript } from "@/lib/bootstrap";
import { t } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n-provider";
import { ThemeProvider } from "@/lib/theme-provider";

import "./globals.css";

/*
 * Both are variable fonts, so no `weight` is passed. next/font downloads them
 * at build time and serves the woff2 from /_next/static/media/ — zero runtime
 * requests to Google (AR-11).
 */
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: t("meta.title"),
  description: t("meta.description"),
};

/*
 * Canonical server markup (AD-12): lang="es" plus the font variable classes,
 * no theme class — dark is canonical via :root in globals.css, so no-JS
 * visitors still get dark. The ONE inline pre-paint script (first element in
 * <body>, ahead of any content paint) sets <html lang>, the locale class and
 * the theme class from persisted preferences; suppressHydrationWarning scopes
 * to <html>'s own attributes, which the script legitimately mutates before
 * React hydrates.
 */
const htmlClassName = [archivo.variable, inter.variable].join(" ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={htmlClassName} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <LocaleProvider>
          <ThemeProvider>
            <SiteHeader />
            {/* Skip-link target; tabIndex lets fragment navigation move focus. */}
            <main id="main-content" tabIndex={-1} className="flex-1">
              {children}
            </main>
            <AttributionFooter />
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

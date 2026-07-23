import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter } from "next/font/google";

import { t } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n-provider";

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
 * class="dark" is hardcoded for the scaffold: dark is the canonical theme and
 * the pre-paint theme script is Story 2.2. lang="es": pre-rendered HTML is
 * always Spanish (AD-12).
 */
const htmlClassName = ["dark", archivo.variable, inter.variable].join(" ");

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={htmlClassName}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}

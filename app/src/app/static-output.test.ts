import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { es } from "@/locales/es";

/*
 * Verifies the exported artifacts, not live components: vitest runs in the
 * node environment (no jsdom devDependency — Story 2.2 Task 10 chose the
 * lightest option), so the built HTML is the honest check of AC 2/4 markup.
 * Skipped only when NEITHER artifact exists (no build ran); a partial export
 * — one file present, the other missing — must fail loudly, not skip.
 * `npm run build` precedes `npm test` in the story's verification chain.
 */

const OUT_DIR = fileURLToPath(new URL("../../out/", import.meta.url));
const INDEX_HTML = OUT_DIR + "index.html";
const NOT_FOUND_HTML = OUT_DIR + "404.html";
const anyBuilt = existsSync(INDEX_HTML) || existsSync(NOT_FOUND_HTML);

describe.skipIf(!anyBuilt)("exported 404.html (AC 4)", () => {
  it("carries the ruled Spanish copy and the NotFoundContent home link", () => {
    const html = readFileSync(NOT_FOUND_HTML, "utf8");
    expect(html).toContain(es.notFound.message);
    // Pinned to the 404 body's own link label: a bare href="/" check is
    // satisfied by the header wordmark, which is on every page.
    expect(html).toMatch(new RegExp(`href="/"[^>]*>${es.notFound.homeLink}`));
  });

  it("inherits the chrome shell (attribution footer present)", () => {
    const html = readFileSync(NOT_FOUND_HTML, "utf8");
    expect(html).toContain(es.chrome.footer.attribution.slice(0, 40));
  });
});

describe.skipIf(!anyBuilt)("exported index.html canonical markup (AC 2)", () => {
  it("is Spanish with no hardcoded theme class (dark is canonical via :root)", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
    expect(htmlTag).toContain('lang="es"');
    expect(htmlTag).not.toMatch(/class="[^"]*\bdark\b/);
    expect(htmlTag).not.toMatch(/class="[^"]*\blight\b/);
  });

  it("embeds the bootstrap script exactly once as an executable inline script, ahead of the chrome", () => {
    // The bundler may minify/re-quote the checked-in script literal, so an
    // exact string match against bootstrapScript would be flaky —
    // executable inline scripts are identified structurally instead. The
    // RSC flight payload also carries an escaped copy; only unescaped
    // <script> elements count.
    const html = readFileSync(INDEX_HTML, "utf8");
    const executables = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(
      ([, body]) => body.includes("wcstats.theme") && !body.includes("self.__next_f")
    );
    expect(executables).toHaveLength(1);
    for (const marker of ["wcstats.locale", "prefers-color-scheme", "locale-"]) {
      expect(executables[0][1]).toContain(marker);
    }
    const at = html.indexOf(executables[0][0]);
    expect(at).toBeGreaterThan(html.indexOf("<body"));
    expect(at).toBeLessThan(html.indexOf("<header"));
  });
});

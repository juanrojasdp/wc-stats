import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GLOSSARY_TERMS } from "@/lib/glossary";
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
// trailingSlash: true → out/<route>/index.html.
const ABOUT_HTML = OUT_DIR + "about/index.html";
const GLOSSARY_HTML = OUT_DIR + "glossary/index.html";
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

/*
 * STORY 2.18 Task 9.6 — the two routes this story owns. On the house pattern:
 * skipped only when NO build ran, asserting against the DICTIONARY OBJECT
 * rather than against the components under test, and failing loudly on a
 * partial export rather than skipping.
 */
describe.skipIf(!anyBuilt)("exported /glossary (AC 2)", () => {
  it("was exported at all — a build that skipped it fails here, it does not skip", () => {
    expect(existsSync(GLOSSARY_HTML), "out/glossary/index.html missing").toBe(true);
  });

  it("renders every glossary term, Spanish canonical, with its #term anchor", () => {
    const html = readFileSync(GLOSSARY_HTML, "utf8");
    expect(html).toContain(es.glossaryPage.title);
    for (const id of GLOSSARY_TERMS) {
      // The anchor is a language-neutral English slug (ruled decision 11), so
      // one id works from both locales and survives an amended Spanish term.
      expect(html, `missing anchor for ${id}`).toContain(`id="${id}"`);
      // Both languages render SIMULTANEOUSLY (AC 2), not just the active one.
      expect(html, `missing es term for ${id}`).toContain(es.glossary[id].es);
      expect(html, `missing en term for ${id}`).toContain(es.glossary[id].en);
    }
  });

  it("says once, on the page, that the definitions are authored rather than transcribed", () => {
    // The PMSR prints no glossary and no definition of any term. Claiming
    // otherwise on this page would be the dishonesty the story exists against.
    expect(readFileSync(GLOSSARY_HTML, "utf8")).toContain(es.glossaryPage.authoredNote);
  });

  it("is a real definition list and adds no landmark", () => {
    const html = readFileSync(GLOSSARY_HTML, "utf8");
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    // 22 landmarks for 11 sections was an axe failure once already.
    expect(html).not.toContain('role="region"');
  });
});

describe.skipIf(!anyBuilt)("exported /about (AC 3)", () => {
  it("was exported at all — a build that skipped it fails here, it does not skip", () => {
    expect(existsSync(ABOUT_HTML), "out/about/index.html missing").toBe(true);
  });

  it("carries the full attribution, the methodology note and the credits", () => {
    const html = readFileSync(ABOUT_HTML, "utf8");
    expect(html).toContain(es.about.title);
    // The attribution is the ALREADY-RULED string, split at its sentence
    // boundary in the component — never a second copy minted in a new key.
    const sentences = es.chrome.footer.attribution.split(". ");
    /*
     * ASSERT THE SHAPE BEFORE DESTRUCTURING (2.18 code review). This read
     * `const [dataSentence, independence] = …split(". ")`, so a one-sentence
     * rewording made `independence` undefined and `toContain(undefined)` threw
     * a TypeError — the guard failed pointing at itself instead of reporting
     * that AC 3's independence disclaimer had vanished from the page.
     */
    expect(
      sentences.length,
      "the ruled attribution must stay two sentences — AC 3 requires the independence disclaimer to stand alone"
    ).toBeGreaterThanOrEqual(2);
    const [dataSentence, independence] = sentences;
    expect(html).toContain(dataSentence);
    expect(html).toContain(independence);
    expect(html).toContain(es.about.methodology);
    expect(html).toContain(es.about.credits);
    expect(html).toContain(es.about.project);
  });

  it("states the per-shot xG absence, not just 'used as-is' (FD-1, decision 1)", () => {
    /*
     * The AC's own parenthetical is MISLEADING: per-shot xG does not exist in
     * the source PDFs at all (team totals only), which is why every shot marker
     * is drawn at the same size. This is the page whose purpose is to explain
     * the data honestly, so the absence must be on it.
     */
    expect(readFileSync(ABOUT_HTML, "utf8")).toContain("no hay un valor por remate");
  });
});

describe.skipIf(!anyBuilt)("the footer reaches both /about and /glossary on every route (AC 3)", () => {
  it("links both from the site chrome, on an unrelated route", () => {
    // EXPERIENCE.md's IA route table names the footer as /glossary's reach
    // path; DESIGN.md's footer bullet mentions only /about and is stale (filed).
    // trailingSlash: true, so Next rewrites both hrefs — asserting the
    // slash-less form passes on a document that links nowhere.
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).toContain('href="/about/"');
    expect(html).toContain('href="/glossary/"');
    expect(html).toContain(es.chrome.footer.glossaryLink);
  });
});

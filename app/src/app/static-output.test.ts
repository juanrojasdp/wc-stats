import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { Leaderboards } from "@/lib/contract/contract-types";
import { readTournament } from "@/lib/build-data";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { t } from "@/lib/i18n";
import { NAV_DESTINATIONS } from "@/lib/nav-destinations";
import { es } from "@/locales/es";
import { leaderboardMetricKey } from "@/viz/leaderboard-model";

/*
 * The leaderboards artifact the Hub is built from (Story 2.13).
 *
 * REPOINTED FROM THE FIXTURE TO THE SHIPPED ARTIFACT AT THE 2.19 CUTOVER, and
 * this one is not a cosmetic swap. `data/fixtures/index/leaderboards.json`
 * carries 3 boards; the emitted artifact carries 36. The "renders EVERY board"
 * case below loops over this list against the EXPORTED page, so while it read
 * the fixture it proved three headings and stayed green — silently checking 8%
 * of what the Hub actually ships.
 *
 * That is the opposite of D2's rule rather than an exception to it: D2 keeps
 * fixture-pinned UNIT tests pinned, and this file is not a unit test. Every
 * assertion in it reads `out/`, so its inputs have to be what shipped.
 */
const LEADERBOARDS_SHIPPED: Leaderboards = JSON.parse(
  readFileSync(path.join(process.cwd(), "..", "data", "index", "leaderboards.json"), "utf8")
) as Leaderboards;

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

/*
 * ═══════════ THE AUTHORSHIP CAPTION IN THE EXPORTED CHROME ═══════════
 *
 * SLICED, NOT COUNTED. A bare `toContain` proves the string is somewhere in the
 * document, and this file has been fooled twice by the RSC flight payload —
 * once on a serialized prop, once on a name that also occurs in markup — so
 * "it appears twice" would be satisfied by one render plus one payload copy.
 * What the spec claims is TWO RENDER SITES, so each is asserted inside its own
 * element slice.
 *
 * The export is Spanish (`<html lang="es">`, D17 makes ES canonical), so the
 * caption on disk is the `es` leaf. The `en` value is the client toggle's job
 * and is pinned in `i18n.test.ts`, not here.
 */
describe.skipIf(!anyBuilt)("the authorship caption ships in the header AND the footer", () => {
  const DOCUMENTS: [string, string][] = [
    ["index.html", INDEX_HTML],
    ["404.html", NOT_FOUND_HTML],
    ["about/index.html", ABOUT_HTML],
    ["glossary/index.html", GLOSSARY_HTML],
  ];

  /**
   * Escape a dictionary value before it is interpolated into a `RegExp`.
   *
   * ADDED AT THE REVIEW, and it is not hypothetical hardening: every string
   * below is RULED COPY that a future story may reword. `"Acerca del sitio"`
   * becoming `"¿Qué es esto?"` is fine, but `"Acerca del sitio (FAQ)"` would
   * turn the parentheses into a capture group — still matching, so a REAL
   * mismatch could pass — and a `[` would throw `Invalid regular expression`,
   * failing the guard while pointing at itself instead of at the copy change.
   *
   * HTML-ESCAPED FIRST, THEN REGEX-ESCAPED (code review 2026-08-26). The
   * original hardened one half: these strings are matched against EXPORTED
   * MARKUP, where React has already escaped `&`, `<` and `>`. Ruled copy
   * gaining an ampersand — `"Acerca del sitio & FAQ"` — ships as `&amp;` on
   * disk, so the raw dictionary value would stop matching and the guard would
   * red on CORRECT output while blaming the caption. Same failure mode the
   * regex escape exists to prevent, one layer down.
   */
  const entities = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rx = (value: string) => entities(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Occurrences of `needle` in `haystack` — the count these cases are named for.
   * `needle` is HTML-escaped for the same reason `rx` escapes it: the haystack
   * is exported markup, not the dictionary.
   */
  const countOf = (haystack: string, needle: string) =>
    haystack.split(entities(needle)).length - 1;

  for (const [label, file] of DOCUMENTS) {
    it(`renders it once under the wordmark and once in the footer — ${label}`, () => {
      /*
       * EXISTENCE FIRST (review). `anyBuilt` only tests index.html and 404.html,
       * so a PARTIAL export — the shape this file's own header comment says
       * "must fail loudly, not skip" — reached `readFileSync` and threw a raw
       * ENOENT naming a path, instead of this assertion naming the route.
       */
      expect(existsSync(file), `${label} missing from out/ — partial export`).toBe(true);
      const html = readFileSync(file, "utf8");

      const header = /<header[\s>][\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
      expect(header, `${label} has no <header> element at all`).not.toBe("");

      /*
       * ADJACENT, AND COUNTED — both added at the review, because slicing alone
       * proves only "somewhere in this element, at least once", which is not
       * what this case is named for.
       *
       * The adjacency regex IS the WCAG 2.5.3 ruling in assertion form: the
       * caption is the anchor's NEXT SIBLING, never its child. Moving the
       * `<span>` inside the `<Link>` renames the banner's first focusable
       * element on all 1,406 routes — the skip link precedes it and sits
       * OUTSIDE the <header> (SiteHeader.tsx) — and that is the single most
       * load-bearing decision here.
       */
      expect(
        header,
        `${label}: the caption must sit immediately AFTER the closing </a>, as a sibling — never inside the home link (WCAG 2.5.3)`
      ).toMatch(new RegExp(`>${rx(es.app.siteName)}</a><span[^>]*>${rx(es.chrome.signature)}</span>`));
      expect(countOf(header, es.chrome.signature), `${label}: exactly one header render`).toBe(1);

      const footer = /<footer[\s>][\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
      expect(footer, `${label} has no <footer> element at all`).not.toBe("");
      expect(countOf(footer, es.chrome.signature), `${label}: exactly one footer render`).toBe(1);

      /*
       * NOT A REGRESSION IN THE SAME EDIT (Story 2.19 Task 6.8). The two footer
       * links sit inside running text and were a WCAG 1.4.1 failure — axe's
       * only serious finding on 30 of 32 route x theme x locale cells — until
       * they were PERSISTENTLY underlined. Adding a line beneath them is
       * exactly the kind of change that quietly reflows a className, so the
       * underline is asserted here rather than assumed.
       *
       * 🔴 TOKEN EQUALITY, NOT `/\bunderline\b/` (review). That pattern was
       * VACUOUS: `\b` fires on the hyphen, so it matched `hover:no-underline`
       * and `underline-offset-2` on their own. An edit dropping the persistent
       * `underline` while keeping the hover class — the exact 1.4.1 regression
       * this block exists to catch — passed green in all four documents.
       *
       * ALL THREE TOKENS, NOT JUST `underline` (code review 2026-08-26). The
       * replacement asserted MEMBERSHIP of one token, while the spec's ruled
       * constraint is that `underline underline-offset-2 hover:no-underline`
       * survives EXACTLY. Dropping `underline-offset-2` (the 2 px offset that
       * keeps the rule off the descenders) or `hover:no-underline` (the hover
       * affordance) still passed. Each is asserted separately so the failure
       * names which one went.
       */
      for (const linkLabel of [es.chrome.footer.aboutLink, es.chrome.footer.glossaryLink]) {
        const anchor = new RegExp(`<a[^>]*>${rx(linkLabel)}</a>`).exec(footer)?.[0];
        expect(anchor, `${label}: no footer anchor for "${linkLabel}"`).toBeDefined();
        const classes = (/class="([^"]*)"/.exec(anchor ?? "")?.[1] ?? "").split(/\s+/);
        for (const token of ["underline", "underline-offset-2", "hover:no-underline"]) {
          expect(
            classes,
            `${label}: "${linkLabel}" lost \`${token}\` — the ruled link-in-text-block treatment (WCAG 1.4.1, Story 2.19 Task 6.8)`
          ).toContain(token);
        }
      }
    });
  }
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
 * STORY 2.12 Task 8.4 — the exported `/` HTML.
 *
 * WHAT THIS FILE CAN AND CANNOT SEE, stated plainly so a reader does not
 * mistake a thin suite for a thin surface. Ruled D1 puts the Hub's tables on
 * the CLIENT fetch path, so the exported HTML carries the route's shell in its
 * `loading` state and NOT a single standings or result row. That is the
 * property under test here, not a limitation of it: the AD-11 assertion below
 * is the one thing only this file can check, and it fails loudly if anyone ever
 * "optimises" the index into the markup.
 *
 * The rendered tables are covered where they are decidable — `hub-model.test.ts`
 * over the grouping, ordering, keying and hrefs — and in the browser at Task 9.
 */
describe.skipIf(!anyBuilt)("exported / — the Tournament Hub (Story 2.12)", () => {
  it("carries the route heading in the pre-rendered body, not only after hydration", () => {
    /*
     * The <h1> sits OUTSIDE the fetch region on purpose: a document whose only
     * heading appears after a network round trip has no outline while the
     * request is in flight, and none at all if it fails.
     */
    expect(readFileSync(INDEX_HTML, "utf8")).toContain(es.hub.title);
  });

  it("paints a layout-shaped, aria-busy loading region with an accessible name", () => {
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).toContain('aria-busy="true"');
    // Hub-scoped copy: `match.bundle.loading` says "del partido", which would
    // be a false statement on a tournament-wide route.
    expect(html).toContain(es.hub.region.loading);
    expect(html).not.toContain(es.match.bundle.loading);
  });

  it("does NOT inline the tournament index into the HTML (AD-11)", () => {
    /*
     * AD-11 bans a third data path and bans inlining full bundles into HTML.
     * Story 1.17 measured the real index at 409,512 B raw; if it ever reaches
     * the markup, this route's document grows by that much on every visit.
     *
     * Asserted on SHAPE rather than on size, so it fails on the first row
     * rather than at some threshold: `knockoutResults` and `goalDifference` are
     * Tournament-only field names that appear nowhere else in the app.
     */
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).not.toContain("knockoutResults");
    expect(html).not.toContain("goalDifference");
  });

  it("composes the <title> from the artifact's own tournament name (UX-DR22)", () => {
    // `tournamentName` is a proper noun the artifact owns (AD-7) — read at
    // build time, passed through, never keyed and never translated.
    const html = readFileSync(INDEX_HTML, "utf8");
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    expect(title).toContain(es.app.siteName);
    expect(title).toContain(readTournament().tournamentName);
    // The layout's generic default must have been overridden by the route's.
    expect(title).not.toBe(es.meta.title);
  });

  it("retired the Story 2.1 scaffold body along with its keys", () => {
    // The placeholder's four keys were this route's only call site; the copy
    // and the keys had to go together or one of them becomes dead.
    const html = readFileSync(INDEX_HTML, "utf8");
    expect(html).not.toContain("Andamiaje del sistema de diseño");
    expect(html).not.toContain("Design system scaffold");
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

/*
 * ========== STORY 2.13 — LÍDERES DEL TORNEO ON THE HUB (Task 8.4) ==========
 *
 * The harness has no jsdom, no testing-library and no E2E, so the EXPORTED HTML
 * is where a rendered decision becomes assertable at all. Everything below is
 * read off the same `out/index.html` the suites above use, and every expected
 * string comes from the DICTIONARY OBJECT or the fixture rather than from the
 * components under test.
 */
describe.skipIf(!anyBuilt)("exported / — the leaderboards section (Story 2.13)", () => {
  const html = () => readFileSync(INDEX_HTML, "utf8");

  it("carries the ruled anchor and the ruled heading", () => {
    /*
     * `#leaders` is the anchor THIS STORY RULES — renamed from `#lideres` by
     * Story 2.19 Task 7.4 (ledger A18/L2236) so the app has no Spanish fragment
     * id left, per 2.18 ruled decision 11. No Hub anchor is specified in
     * any planning artifact, EXPERIENCE.md's enumerated set is
     * Match-Dashboard-only, and UX-DR18 requires "stable deep-link anchors for
     * every section". If Story 2.12 lands a different id, adopt ITS and change
     * this line — two ids is the only bad outcome.
     */
    expect(html()).toContain('id="leaders"');
    // The Spanish id is GONE, not merely joined by an English one.
    expect(html()).not.toContain('id="lideres"');
    expect(html()).toContain(es.leaderboards.title);
    expect(es.leaderboards.title).toBe("Líderes del torneo");
  });

  it("renders EVERY board in the artifact, keyed off metricCode + scope", () => {
    /*
     * Driven off the artifact's own board list, never off a literal (AC 2). A
     * board carries no id and no title, so its heading IS its identity: metric
     * label + scope label.
     *
     * At the 2.19 cutover that list went from 3 to 36. The floor below is
     * asserted at the real scale so the case cannot quietly shrink back to a
     * three-board check if the artifact is ever regenerated short.
     */
    /*
     * ASSERTED ON THE DOCUMENT'S TEXT, NOT ITS MARKUP (Story 2.19 Task 7.9).
     * D18(c) marks each board's glossary term in its heading, so a metric label
     * is no longer one contiguous run of characters in the HTML — "Tiros al
     * arco" ships as `Tiros <button …>al arco</button>`. The property this case
     * asserts is that every board is RENDERED, which is a claim about text; the
     * markup between the words is not part of it. Tags are replaced by nothing
     * rather than by a space, because the marking splits inside a phrase and the
     * spaces sit outside the trigger.
     */
    const page = html().replace(/<[^>]*>/g, "");
    expect(LEADERBOARDS_SHIPPED.boards.length).toBeGreaterThanOrEqual(36);

    /*
     * COUNTED, NOT JUST CONTAINED (2.19 code review).
     *
     * `toContain(label)` over the whole flattened document proves that a string
     * appears SOMEWHERE, not that a board rendered. 36 boards map to 35 distinct
     * ES labels — `completedLineBreaks` and `lineBreaksCompleted` both resolve to
     * "Rupturas de líneas completadas" and are separated only by `scope` — so a
     * board that stopped rendering entirely would still pass on its twin's label.
     * The case is named "renders EVERY board"; a substring test cannot say that.
     *
     * Counting occurrences per label restores the claim: a label shared by N
     * boards must appear at least N times. Still text-based, for the tag-stripping
     * reason above.
     */
    const expectedByLabel = new Map<string, string[]>();
    for (const board of LEADERBOARDS_SHIPPED.boards) {
      const label = t(leaderboardMetricKey(board.metricCode));
      expectedByLabel.set(label, [...(expectedByLabel.get(label) ?? []), board.metricCode]);
    }
    for (const [label, metricCodes] of expectedByLabel) {
      const occurrences = page.split(label).length - 1;
      expect(
        occurrences,
        `"${label}" is the heading for ${metricCodes.length} board(s) ` +
          `(${metricCodes.join(", ")}) but appears ${occurrences} time(s) in the page text`
      ).toBeGreaterThanOrEqual(metricCodes.length);
    }
    expect(page).toContain(es.leaderboards.scope.team);
    expect(page).toContain(es.leaderboards.scope.player);
  });

  it("pre-renders the teasers at hero altitude, from the BUILD-TIME read", () => {
    /*
     * AD-11: the teasers must survive with no JavaScript and before the runtime
     * fetch resolves, so they are in the exported HTML.
     *
     * ASSERTED ON RENDERED OUTPUT, NEVER ON A NAME (2.13 code review). The
     * version that shipped asserted `toContain("SON Heungmin")` — and that name
     * occurs TWICE in the document, once as markup and once inside the RSC
     * flight payload, so the test passed on the serialized prop alone. Delete
     * the entire <ol> from BoardTeaser and it stayed green.
     *
     * A LOCALE-FORMATTED VALUE cannot appear in the payload: the artifact
     * carries the figure as a raw number and only the render produces
     * "37,6 km/h", with a NON-BREAKING space (ruling 6). That string is proof
     * the component ran.
     *
     * RE-ANCHORED AT THE 2.19 CUTOVER: the fixture's top topSpeed row was
     * SON Heungmin at 35.2; the real corpus's is Kylian MBAPPE at 37.6 over 111
     * rows. The property is unchanged — only a rendered value carries a comma
     * and a non-breaking space — so only the literal moved.
     */
    const page = html();
    expect(page).toContain(es.leaderboards.teaserHeading);
    expect(page).toContain(`37,6 ${es.enums.unit.kmh}`);
  });

  it("inlines ONLY the teaser rows, never the whole artifact (AD-11)", () => {
    /*
     * `LeaderboardsSection` is a client component, so its prop is serialized
     * into this document's flight payload. It used to receive the whole
     * `Leaderboards`, which put all 32 fixture rows into the HTML to render 9 —
     * and the runtime region then fetched the same bytes again. At the 2.19
     * DATA_ROOT flip that is ~409 KB inlined into the Hub AND re-downloaded, on
     * a Lighthouse->=90 route. `page.tsx` now passes `leaderboardTeasers(...)`.
     *
     * The sibling guard for `tournament.json` asserts on `knockoutResults` —
     * a Tournament-only field name, which is why it could never fire on this.
     * These are the leaderboards' own tells: `aggregation` and `higherIsBetter`
     * are board fields the teaser does not paint, and the third is an entity in
     * a board but in no teaser.
     *
     * RE-ANCHORED AT THE 2.19 CUTOVER, and the guard got much stronger by it.
     * The fixture's witness was `gonzalez-armando-mex` at rank 20 of a 32-row
     * corpus; the real artifact holds 715 entities across 36 boards of which
     * only 39 reach any top three, so 676 of them would fail this assertion if
     * the whole payload were inlined again. `haaland-erling-nor` is one of them
     * — present in the 111-row topSpeed board, absent from every teaser.
     */
    const page = html();
    expect(page).not.toContain("aggregation");
    expect(page).not.toContain("higherIsBetter");
    expect(page).not.toContain("haaland-erling-nor");
  });

  it("links every player row to its Player Profile and every team row to its team", () => {
    /*
     * RULING 3, and the trailing slash is REQUIRED (`trailingSlash: true`) — an
     * assertion on the slash-less form passes on a document that links nowhere.
     * Both routes are unbuilt today; that is the shipped LineupsDisclosure /
     * MatchHero precedent, which `matches/static-output.test.ts` already pins
     * green, not a departure. AD-3 makes the entity id the slug.
     */
    const page = html();
    expect(page).toContain('href="/players/mbappe-kylian-fra/"');
    expect(page).toMatch(/href="\/teams\/[a-z0-9-]+\/"/);
  });

  it("renders the teaser's km/h figure with its unit, formatted es-CO", () => {
    /*
     * RULING 6 and UJ-4's own example. A teaser row has NO COLUMN HEAD to carry
     * the unit, so it composes value + unit — "35,2 km/h" — joined by a
     * NON-BREAKING space, which is what the   below is. In a table cell the
     * value stays bare and the unit rides the head instead.
     */
    expect(html()).toContain(`37,6 ${es.enums.unit.kmh}`);
  });

  it("names its section exactly once, and adds NO display-score element", () => {
    /*
     * The `type-display-score` invariant belongs to the MATCH route and is
     * deliberately not copied here — this section ships no score at all.
     *
     * THE LANDMARK ASSERTION WAS SELF-CONTRADICTORY (2.13 code review). It read
     * `not.toContain('role="region"')` beside `toContain('aria-labelledby=
     * "leaders-title"')` — but a <section> WITH an accessible name has the
     * implicit ARIA role `region` and IS a landmark; `aria-labelledby` on a
     * section is precisely what triggers it. So the second assertion proved the
     * landmark exists while the first claimed it did not, and a grep for the
     * literal attribute can never observe an implicit role — it would have
     * stayed green no matter how many named <section>s were added, which is
     * exactly the "22 landmarks for 11 sections" axe failure it cited.
     *
     * What is actually worth pinning is that this section contributes ONE
     * landmark and names it once: a duplicated id would give two landmarks the
     * same name, and duplicate ids are their own defect.
     */
    const page = html();
    expect(page).not.toContain("type-display-score");
    expect(page.match(/id="leaders"/g) ?? []).toHaveLength(1);
    expect(page.match(/aria-labelledby="leaders-title"/g) ?? []).toHaveLength(1);
    expect(page.match(/id="leaders-title"/g) ?? []).toHaveLength(1);
  });

  it("ships NO chart and NO recharts markup on the Hub (ruling 2)", () => {
    /*
     * EXPERIENCE.md's Visualization Layering row gives leaderboards exactly two
     * altitudes — "Top-3 teaser rows | — | Full sortable table" — and the em
     * dash at Tactical altitude is the ruling. A chart here would put the
     * recharts vendor chunk on a Lighthouse->=90 route.
     *
     * 🔴 THE OLD REASON GIVEN HERE WAS STALE AND IS CORRECTED (Story 2.17 Task
     * 10.3). It read "There are exactly two recharts import specifiers in the app
     * and the vendor duplication is PER SPECIFIER, so a third would put a third
     * ~300 KB chunk …". Both halves stopped being true at Story 2.15, which
     * introduced `@/components/Charts` — the ONE barrel every `dynamic()` call
     * site now names — and collapsed the two chunk groups into one. There are
     * FOUR recharts-bearing leaf modules today (`MomentumChart`,
     * `TacticalCharts`, `ProfileCharts`, `CompareCharts`) and exactly ONE vendor
     * chunk, measured on the built export at this story's baseline and again
     * after it: 359.0 KB → 362.0 KB, one line classified VENDOR both times.
     *
     * The DUPLICATION IS PER `dynamic()` SPECIFIER, not per leaf module, which is
     * why adding a fourth leaf costs 3 KB rather than 359. The classifier that
     * proves it discriminates on `CartesianAxis` AND `Brush` AND `redux`
     * together — `CartesianAxis` alone also matches a leaf — and it is a
     * verification step run and recorded per story, deliberately NOT a committed
     * assertion: "the App never measures bytes."
     */
    const page = html();
    expect(page).not.toContain("recharts");
    expect(page).not.toContain("<pattern");
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

/*
 * AC 5's "loads ONLY" half — Task 9.3, written at code review.
 *
 * THE STORY MANDATED THIS TEST AND IT WAS NEVER WRITTEN. Task 9.3 is explicit:
 * "Write the test as an ALLOW-LIST — {/index/tournament.json,
 * /index/leaderboards.json} — never `toHaveLength(1)`", the latter because it
 * would turn red the day Story 2.13 adds its fetch and tempt 2.13 to weaken it.
 * The Completion Notes claimed the assertion shipped; it had not.
 *
 * WHY A MODULE WALK RATHER THAN A NETWORK ASSERTION. The harness is
 * `environment: "node"` with no jsdom, so nothing can be mounted and no fetch
 * can be observed. What IS decidable statically is the thing AC 5 actually
 * constrains: which artifact paths are reachable from this route's module
 * graph. The walk starts at `src/app/page.tsx` and follows every `@/` import
 * transitively, so a third `fetchArtifact` added ANYWHERE under the Hub — in a
 * shared component, in a lib helper, in a future section — fails here.
 *
 * The other half of AD-4 stays out: the App never measures bytes ("measured by
 * the Pipeline, the App never re-measures"), and the combined-budget gate is
 * Story 1.17's D3/D5.
 */
const ARTIFACT_ALLOW_LIST = ["/index/leaderboards.json", "/index/tournament.json"];
const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));
const ALIAS_IMPORT = /from\s+"@\/([^"]+)"/g;
/*
 * BOTH SPELLINGS, and the second one is Story 2.14 Task 10.5 closing a blind
 * spot rather than a tidy-up. The string-literal form is what `/`'s two fetches
 * use; `MatchBundleRegion` uses a TEMPLATE literal
 * (`` fetchArtifact<MatchBundle>(`/matches/${matchId}.json`) ``), which the
 * literal-only pattern could never see — so a walk from the match route found
 * ZERO artifacts and would have reported an empty allow-list as if the route
 * fetched nothing at all. The interpolation is normalized to `{}` below, since
 * the id is per-route by construction.
 */
const FETCH_ARTIFACT_PATH = /fetchArtifact\s*<[^>]*>\s*\(\s*(?:"([^"]+)"|`([^`]+)`)/g;

/** Resolves an `@/x/y` specifier to a real file, or null for type-only paths. */
function resolveAlias(specifier: string): string | null {
  for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
    const full = SRC_DIR + candidate;
    if (existsSync(full)) {
      return full;
    }
  }
  return null;
}

function artifactPathsReachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const found = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(FETCH_ARTIFACT_PATH)) {
      // Group 1 = "literal"; group 2 = `template`, whose ${…} holes collapse to
      // {} so the path is comparable across routes.
      found.add(match[1] ?? match[2].replace(/\$\{[^}]*\}/g, "{}"));
    }
    for (const match of source.matchAll(ALIAS_IMPORT)) {
      const resolved = resolveAlias(match[1]);
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return [...found].sort();
}

describe("/ artifact fetches (AC 5, Task 9.3)", () => {
  it("reaches EXACTLY the two allow-listed artifacts and no others", () => {
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/page.tsx");
    // Set equality, deliberately: a MISSING fetch is as much a defect as an
    // extra one — it would mean a surface stopped loading its own data.
    expect(reachable).toEqual(ARTIFACT_ALLOW_LIST);
  });

  it("walks far enough to see a fetch that is several modules deep", () => {
    /*
     * Guards the guard. If `resolveAlias` ever stops resolving — a changed
     * path alias, a moved file — the walk would visit page.tsx alone, find
     * nothing, and the assertion above would fail loudly rather than pass
     * vacuously. `page.tsx` itself contains no `fetchArtifact` call at all:
     * both live two hops away, in the client regions.
     */
    expect(readFileSync(SRC_DIR + "app/page.tsx", "utf8")).not.toContain("fetchArtifact");
    expect(artifactPathsReachableFrom(SRC_DIR + "app/page.tsx").length).toBe(2);
  });

  it("does NOT reach the match bundle — that path belongs to /matches/{id} (FR-34)", () => {
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/page.tsx");
    expect(reachable.some((artifactPath) => artifactPath.includes("matches"))).toBe(false);
  });
});

/*
 * ══════════ STORY 2.14 — HEADER SEARCH IN THE EXPORTED HTML (Task 10.4) ═════
 *
 * WHAT THIS FILE CAN AND CANNOT SEE HERE, stated plainly. `SiteHeader` is
 * PRERENDERED into all five HTML files, and ruling 4 makes the `<md` collapse
 * pure CSS — so the exported markup contains BOTH branches on every route. That
 * is exactly what makes their PRESENCE assertable and their VISIBILITY not: this
 * file can prove both branches shipped everywhere, and can prove nothing about
 * which one a reader sees. That is browser work (Task 11.4).
 *
 * The open listbox and the sheet's contents are not assertable at all — both
 * mount on open, and nothing here opens anything.
 *
 * MATCHED AS REAL DOM ATTRIBUTES (`role="combobox"`, never the payload's
 * JSON-quoted spelling). The RSC flight payload has faked a pass in this file
 * twice before — once on a serialized prop, once on a name that also occurs in
 * markup — so every marker below is anchored to the `attr="value"` form.
 */
describe.skipIf(!anyBuilt)("exported header search — every route (Story 2.14)", () => {
  /*
   * MEMOISED AT THE 2.19 CUTOVER, and it is a correctness fix rather than a
   * tidy-up.
   *
   * Seven cases in this block call `everyRouteHtml()`, and on fixtures that was
   * 7 x 13 documents — free. At real data it is 7 x 1,406 documents, ~35 MB of
   * `readFileSync` per call and ~245 MB across the block, which pushed the first
   * case past vitest's 5 s default under ten-worker contention and failed the
   * suite on a TIMEOUT, not on an assertion. The export is immutable for the
   * duration of a run, so reading it once is the whole fix; a raised timeout
   * would only have made the same waste take longer.
   */
  let routeHtmlCache: { route: string; html: string }[] | null = null;

  /** Every exported route document, DISCOVERED rather than enumerated. */
  function everyRouteHtml(): { route: string; html: string }[] {
    if (routeHtmlCache !== null) {
      return routeHtmlCache;
    }
    const documents = [
      { route: "/", file: INDEX_HTML },
      { route: "/404", file: NOT_FOUND_HTML },
      { route: "/about", file: ABOUT_HTML },
      { route: "/glossary", file: GLOSSARY_HTML },
    ].filter((entry) => existsSync(entry.file));
    /*
     * EVERY DYNAMIC ROUTE FAMILY, not just `/matches` (code review 2026-08-07).
     * This walked `matches/` alone, so from the moment Story 2.15 shipped
     * `/players/{slug}` — and 2.16 `/teams/{slug}` — seven assertions titled "on
     * EVERY exported route" stopped covering the newest routes on the site while
     * staying green. A family added here is a family swept; the cost of
     * forgetting was silent and is now structural.
     */
    for (const family of ["matches", "players", "teams"]) {
      const familyDir = `${OUT_DIR}${family}/`;
      if (!existsSync(familyDir)) {
        continue;
      }
      for (const slug of readdirSync(familyDir)) {
        const file = `${familyDir}${slug}/index.html`;
        if (existsSync(file)) {
          documents.push({ route: `/${family}/${slug}`, file });
        }
      }
    }
    routeHtmlCache = documents.map(({ route, file }) => ({
      route,
      html: readFileSync(file, "utf8"),
    }));
    return routeHtmlCache;
  }

  /*
   * WARMED HERE, with its own budget, on `assert-schema-version.test.ts`'s
   * precedent. Memoising alone was not enough: the FIRST call still reads 1,406
   * documents off disk, and at ~35 MB under ten-worker contention that one call
   * exceeds vitest's 5 s default on its own — so whichever case happened to run
   * first failed on a timeout rather than on anything it asserted. Paying the
   * read once in a hook with a generous budget keeps every case below on
   * in-memory work, which is what they are actually about.
   */
  beforeAll(() => {
    everyRouteHtml();
  }, 60_000);

  /*
   * Local rather than imported: `glossary.ts` has a private one, and exporting a
   * shipped module's internal helper to satisfy a test widens its surface for
   * nobody's benefit. Locale copy is data, so it is escaped before it becomes a
   * pattern.
   */
  function escapeForRegExp(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  it("found every exported route to sweep — a vacuous sweep is not a pass", () => {
    // Driven off what the export actually contains, never off a pinned count.
    const swept = everyRouteHtml();
    expect(swept.length).toBeGreaterThanOrEqual(4);
    /*
     * AND REACHED THE DYNAMIC FAMILIES. The `>= 4` floor alone was met by the
     * four static shells, so it stayed green through the whole period the sweep
     * silently skipped `/players` and `/teams`. Each family is asserted only
     * when the export contains it, because a partial build is a real state here.
     */
    for (const family of ["matches", "players", "teams"]) {
      if (existsSync(`${OUT_DIR}${family}/`)) {
        expect(
          swept.some((entry) => entry.route.startsWith(`/${family}/`)),
          `out/${family}/ exists but no ${family} route was swept`
        ).toBe(true);
      }
    }
  });

  it("ships the combobox input on EVERY exported route", () => {
    for (const { route, html } of everyRouteHtml()) {
      expect(html, `no combobox on ${route}`).toContain('role="combobox"');
      /*
       * EXACTLY ONE. The sheet's input mounts only on open, so a second one in
       * the STATIC markup would mean two comboboxes exposed at some width —
       * which is the duplicate-roles failure ruling 4's CSS collapse avoids.
       */
      expect((html.match(/role="combobox"/g) ?? []).length, route).toBe(1);
      /*
       * 🔴 SCOPED TO A REAL `<label class="sr-only">`, NOT A BARE `toContain`
       * (code review 2026-08-07). Task 10.4 says "Use `class="…"`-scoped
       * matching — the RSC flight payload has faked a pass twice before", and
       * this assertion was an unscoped substring search for the locale string.
       * The serialized flight payload carries `es.search.label` as a prop value
       * whether or not a `<label>` element exists in the DOM, so the old form
       * would have stayed green through the exact failure it is here to catch:
       * an input whose accessible name never rendered.
       *
       * The `for` attribute is asserted too — an sr-only label that names
       * nothing is not an accessible name.
       */
      const labelled = html.match(
        new RegExp(`<label\\b([^>]*)>${escapeForRegExp(es.search.label)}</label>`)
      );
      expect(labelled, `combobox has no rendered <label> on ${route}`).not.toBeNull();
      // Attributes asserted separately, so React's emission order cannot break
      // this the way a single fused pattern would.
      const attributes = labelled?.[1] ?? "";
      expect(attributes, `label names nothing on ${route}`).toMatch(/\bfor="[^"]+"/);
      expect(attributes, `label is not sr-only on ${route}`).toMatch(
        /class="[^"]*\bsr-only\b/
      );
    }
  });

  it("ships the `<xl` NAV trigger on EVERY exported route", () => {
    /*
     * ⚠️ THIS USED TO PIN THE SEARCH'S OWN ICON BUTTON (`es.search.open`).
     * Story 3.10 / UX-DR24 deleted that trigger: below `xl` there is ONE
     * trigger, the nav's, and the search lives inside the sheet it opens. A
     * header carrying both would be the fifth row element DESIGN.md forbids.
     * The GUARANTEE is unchanged — every exported route ships a working narrow
     * entry point — so the case was re-pointed rather than deleted.
     */
    for (const { route, html } of everyRouteHtml()) {
      expect(html, `no nav trigger on ${route}`).toContain(
        `aria-label="${es.nav.trigger}"`
      );
    }
  });

  it("ships the four AVAILABLE destinations, and none of the five that are not", () => {
    /*
     * 🔴 THE ONLY PLACE THE PRE-3.9 RULING IS VISIBLE IN SHIPPED HTML (D1).
     * `/tournament`, `/tops`, `/players` and `/teams` do not exist yet, so
     * linking them would put a 404 in the site chrome of all 1,406 routes.
     * `nav-destinations.test.ts` binds the FLAG to the filesystem and
     * `SiteNav.test.tsx` binds the RENDER to the flag; this binds the EXPORT to
     * both, which is the artefact a reader actually receives.
     *
     * COUNTED, NOT MERELY FOUND — but the counts are asymmetric, and the reason
     * is D4. The sheet PORTALS to `document.body` and mounts only while OPEN, so
     * the exported HTML carries the INLINE presentation only: one anchor per
     * available destination, not two. (An earlier draft asserted exactly two,
     * reasoning from "both presentations ship in every route's markup" — true of
     * the trigger and the inline links, false of the sheet's contents, which do
     * not exist until a reader opens it.)
     *
     * So availability is asserted as "at least one anchor" rather than an exact
     * count: `Glosario` legitimately appears TWICE on every route, because the
     * attribution footer links the glossary too (`chrome.footer.glossaryLink`).
     * The UNAVAILABLE half is exact — zero — and that is the half that matters,
     * because it is the one that would ship a 404.
     */
    const { html } = everyRouteHtml()[0];
    for (const destination of NAV_DESTINATIONS) {
      const key = destination.key as keyof typeof es.nav.destinations;
      const label = es.nav.destinations[key];
      const count = html.split(`>${label}</a>`).length - 1;
      if (destination.available) {
        expect(
          count,
          `${label} is available but no anchor in the exported header carries it`
        ).toBeGreaterThanOrEqual(1);
      } else {
        expect(
          count,
          `${label} shipped, but ${destination.route} does not exist — that is a ` +
            "link to a 404 on every one of 1,406 routes. Story 3.9 mints the route " +
            "and flips the flag; until then it must not render."
        ).toBe(0);
      }
    }
  });

  it("keeps BOTH breakpoint branches in the markup, which is what ruling 4 requires", () => {
    /*
     * The collapse is CSS, not a JS breakpoint branch: `useMediaQuery`'s
     * getServerSnapshot returns false and `SiteHeader` is prerendered, so a JS
     * branch would emit narrow markup on the server and hydrate wide on desktop
     * — a mismatch on every page. `hidden xl:flex` and `xl:hidden` are the
     * mechanism; their presence here is the evidence it was used.
     *
     * ⚠️ THE BREAKPOINT IS `xl`, NOT `md` (Story 3.10 D15). Measured, not
     * preferred: nine Spanish destinations beside identity + search + ES|EN +
     * theme need ~1,060-1,080 px against 976 usable at `lg`, and `lg` fails
     * INVISIBLY because the search ships `min-w-0 flex-1` and collapses silently
     * rather than overflowing the row. `xl` clears by ~150 px.
     */
    const { html } = everyRouteHtml()[0];
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\bxl:flex\b/);
    expect(html).toMatch(/class="[^"]*\bxl:hidden\b/);
  });

  it("keeps the reserved slot's own two classes on the mounted component", () => {
    // Story 2.2 Task 5.3's slot: `min-w-0` is what lets the input shrink inside
    // the header's flex row, and dropping it pushes the toggles off a 320 px
    // viewport. `data-slot` stays as the slot's identity.
    const { html } = everyRouteHtml()[0];
    expect(html).toContain('data-slot="header-search-slot"');
    expect(html).toMatch(/data-slot="header-search-slot"[^>]*class="[^"]*\bmin-w-0\b/);
  });

  it("emits NO <section> from the header — heroSection() slices on the first one", () => {
    /*
     * 🔴 `matches/static-output.test.ts`'s `heroSection()` slices the WHOLE
     * document at its first `<section>`, and the header renders before <main>.
     * A `<section>` here would silently re-target 19 Hero assertions onto search
     * markup — green tests asserting the wrong DOM, which is the exact
     * lying-about-completion failure this story must not cause.
     *
     * Asserted on a match route, since that is the document heroSection() reads.
     */
    const matchRoute = everyRouteHtml().find((entry) => entry.route.startsWith("/matches/"));
    expect(matchRoute, "no match route in the export").toBeDefined();
    const html = (matchRoute as { html: string }).html;
    const firstSection = html.indexOf("<section");
    const header = html.indexOf("<header");
    expect(firstSection).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(-1);
    // The first <section> comes AFTER the header, i.e. the header emits none.
    expect(firstSection).toBeGreaterThan(header);
    expect(html.slice(header, firstSection)).not.toContain("<section");
  });

  it("does NOT inline the search corpus into any route's HTML (AD-11, ruling 1)", () => {
    /*
     * The corpus is joined at RUNTIME from `knockoutResults` (Task 2.6) and is
     * never prerendered — "do not optimise by prerendering the corpus" is the
     * ruling. The sibling guard above asserts this for `/`; every OTHER route is
     * new surface this story put a header search on, and none of them referenced
     * this artifact at all before.
     */
    /*
     * `goalDifference` WAS A PROBE HERE AND HAD TO BE RETIRED (Story 2.16). It
     * was chosen as a "Tournament-only field name that appears nowhere else in
     * the app", and that premise was ALREADY FALSE when it was written:
     * `contract-types.d.ts` declares it TWICE — on `StandingsRow` (Tournament)
     * and on `TeamTournamentRecord` (TeamProfile). Nothing exposed the overlap
     * until `/teams/{slug}` shipped, because its Hero projection legitimately
     * carries all nine `record` fields into the RSC payload (AD-11's build-time
     * half, which is the whole point of the projection).
     *
     * Verified on `out/teams/mexico/index.html` before retiring it: ZERO
     * occurrences of `knockoutResults`, `tournamentName`, `entities`,
     * `standings` and `venues` — the index is genuinely not inlined; only the
     * shared FIELD NAME collided. Keeping the token would have made a green
     * gate turn red on a correct route, which is worse than the gap it closed.
     *
     * `knockoutResults` stays and is the load-bearing probe: it is the field the
     * corpus join reads (Task 2.6) and it appears on `Tournament` alone.
     */
    for (const { route, html } of everyRouteHtml()) {
      expect(html, `${route} inlines the index`).not.toContain("knockoutResults");
      expect(html, `${route} inlines the index`).not.toContain("tournamentName");
    }
  });
});

/*
 * ══════════ STORY 2.14 Task 10.5 — THE ALLOW-LIST BLIND SPOT ══════════
 *
 * The walk above starts at `src/app/page.tsx` — the HUB's entry. Nothing has
 * ever walked from `layout.tsx`, so the GLOBAL CHROME's fetches were invisible
 * to this gate: a fetch added to the header appears on all five routes and no
 * test could see it. This story adds exactly such a fetch, so it closes the hole
 * in the same diff rather than filing it.
 *
 * PER-ROUTE ALLOW-LISTS, because the routes genuinely differ: the Hub reaches
 * two index artifacts, the chrome reaches one, the match route reaches its own
 * bundle. A single global list would have to be their union, which is the
 * assertion that permits everything.
 */
describe("global-chrome and match-route artifact fetches (Story 2.14 Task 10.5)", () => {
  it("the LAYOUT reaches exactly the tournament index — the header's one fetch", () => {
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/layout.tsx");
    // Set equality, deliberately: a MISSING fetch is as much a defect as an
    // extra one. If this list ever grows, the global chrome grew a data
    // dependency that every route pays for — precisely ruling 1's subject.
    expect(reachable).toEqual(["/index/tournament.json"]);
  });

  it("the layout's fetch is LAZY, so AC 7's declared departure stays bounded", () => {
    /*
     * A static module-graph edge is what this walk measures, and the header
     * genuinely has one — the honest half of ruling 1's disclosure. What bounds
     * the cost is that nothing FIRES on load: the loader is called only from an
     * engagement handler. Pinned structurally, so a later refactor cannot turn
     * the edge into an on-mount fetch without failing here.
     */
    const loader = readFileSync(SRC_DIR + "lib/tournament-index.ts", "utf8");
    expect(loader).toContain('fetchArtifact<Tournament>("/index/tournament.json")');
    const component = readFileSync(SRC_DIR + "components/HeaderSearch.tsx", "utf8");
    expect(component).toContain("loadTournamentIndex()");
    /*
     * `attempt === 0` IS THE LAZINESS GUARD, and it replaced `!engaged` at code
     * review 2026-08-07. The boolean was a one-way latch, which made the guard
     * do double duty as "never loaded" AND "never load again" — so a rejected
     * fetch was permanent. The counter separates the two: 0 still means nothing
     * has been requested (which is what this test pins), and every later value
     * is one attempt, which is what makes a retry expressible at all.
     */
    expect(component).toMatch(/if \(attempt === 0\) \{/);
    // And the loader is still reached only from an effect gated on it, never
    // from module scope or a render path.
    expect(component).toMatch(/}, \[attempt\]\);/);
  });

  it("the MATCH route reaches its own bundle and NOT the tournament index (FR-34)", () => {
    /*
     * FR-34 — "no tournament.json at runtime" — is scoped to this route (Story
     * 2.12 scoped it). The route's OWN module graph must stay clean of the
     * index: the header's fetch reaches this route through the LAYOUT, on
     * demand, which is the departure ruling 1 declares and bounds.
     */
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/matches/[slug]/page.tsx");
    expect(reachable).toEqual(["/matches/{}.json"]);
    expect(reachable).not.toContain("/index/tournament.json");
  });

  it("still walks far enough to see a TEMPLATE-literal fetch several modules deep", () => {
    /*
     * Guards the guard, as its sibling does for `/`. This one also guards the
     * regex extension itself: the match bundle's call is a template literal, and
     * before Task 10.5 the literal-only pattern could not see it — so a walk
     * from this route returned an empty array and would have reported "this
     * route fetches nothing" as a pass.
     */
    expect(readFileSync(SRC_DIR + "app/matches/[slug]/page.tsx", "utf8")).not.toContain(
      "fetchArtifact"
    );
    expect(artifactPathsReachableFrom(SRC_DIR + "app/matches/[slug]/page.tsx")).toHaveLength(1);
  });

  /*
   * ───────────── STORY 2.15 — /players/[slug] (Task 9.3) ─────────────
   *
   * The third per-route allow-list, on the two above's terms exactly. It needed
   * no change to the walker: Task 10.5 already extended `FETCH_ARTIFACT_PATH` to
   * match BOTH the string-literal and the TEMPLATE-literal spellings, and this
   * route's call is the template form
   * (`` fetchArtifact<PlayerProfile>(`/index/player-profiles/${slug}.json`) ``),
   * which the literal-only pattern could never have seen.
   */
  it("the PLAYER route reaches its own profile and NOTHING else (AD-11, FR-26)", () => {
    /*
     * SET EQUALITY, deliberately: a MISSING fetch is as much a defect as an
     * extra one. A profile is cross-match by definition, so the temptation to
     * pull `tournament.json` in — for opponent team codes, say — is real and
     * specific; this is what would catch it.
     */
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/players/[slug]/page.tsx");
    expect(reachable).toEqual(["/index/player-profiles/{}.json"]);
    expect(reachable).not.toContain("/index/tournament.json");
    expect(reachable).not.toContain("/index/leaderboards.json");
  });

  it("still walks far enough to see the player route's template-literal fetch", () => {
    // Guards the guard, as both siblings do: page.tsx holds no fetch itself —
    // the only one lives two hops away in PlayerProfileRegion.
    expect(readFileSync(SRC_DIR + "app/players/[slug]/page.tsx", "utf8")).not.toContain(
      "fetchArtifact"
    );
    expect(artifactPathsReachableFrom(SRC_DIR + "app/players/[slug]/page.tsx")).toHaveLength(1);
  });

  /*
   * ───────────── STORY 2.16 — /teams/[slug] (Task 9.2) ─────────────
   *
   * The fourth per-route allow-list, on the three above's terms exactly. No
   * change to the walker was needed: this route's call is the template form
   * (`` fetchArtifact<TeamProfile>(`/index/team-profiles/${slug}.json`) ``),
   * which Task 10.5's extended pattern already matches.
   */
  it("the TEAM route reaches its own profile and NOTHING else (AD-11, FR-26)", () => {
    /*
     * SET EQUALITY, deliberately: a MISSING fetch is as much a defect as an
     * extra one.
     *
     * THE `tournament.json` EXCLUSION IS THIS ROUTE'S SPECIFIC TRAP, not
     * boilerplate (Story 2.16 ruled D3). AC 2 mandates result chips, and
     * `tournament.json`'s `groups[].standings[].form` IS a `MatchResult[]` that
     * `TournamentHub` already chips — so reaching for it is the obvious move and
     * it is WRONG twice over: it is GROUP-STAGE ONLY (three entries for a team
     * that played eight), and pulling it in would breach FR-26. The form strip
     * is a projection of the profile's own `matches[].result` instead, and this
     * assertion is what keeps it that way.
     *
     * `readTournament()` in `generateStaticParams` does NOT appear here and must
     * not: it is a BUILD-TIME filesystem read through `@/lib/build-data`, which
     * is a different path from the runtime `fetchArtifact` this walk measures.
     */
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/teams/[slug]/page.tsx");
    expect(reachable).toEqual(["/index/team-profiles/{}.json"]);
    expect(reachable).not.toContain("/index/tournament.json");
    expect(reachable).not.toContain("/index/leaderboards.json");
  });

  it("still walks far enough to see the team route's template-literal fetch", () => {
    // Guards the guard, as all three siblings do: page.tsx holds no fetch
    // itself — the only one lives two hops away in TeamProfileRegion.
    expect(readFileSync(SRC_DIR + "app/teams/[slug]/page.tsx", "utf8")).not.toContain(
      "fetchArtifact"
    );
    expect(artifactPathsReachableFrom(SRC_DIR + "app/teams/[slug]/page.tsx")).toHaveLength(1);
  });

  /*
   * ───────────── STORY 2.17 — /compare (Task 10.4) ─────────────
   *
   * The fifth per-route allow-list, and the FIRST whose correct answer is more
   * than one artifact. `/compare` reaches four, and every one of them is
   * deliberate:
   *
   *  · `/index/tournament.json` — the picker's CORPUS and the slug MANIFEST. It
   *    belongs here in a way it belongs on no other entity route, and 2.14
   *    measured it as reachable from `/` alone. The route validates `?a=`/`?b=`
   *    against the manifest rather than against a 404, because AD-4 guarantees
   *    one artifact per listed entity — so a manifest hit means a failed fetch is
   *    a genuine `error` (retry may help) rather than an `invalid` (retry cannot).
   *  · the three ENTITY families, one per comparable type. Only ONE pair is ever
   *    fetched at runtime — the type in the URL decides — but all three call
   *    sites are statically reachable from the region, which is exactly what this
   *    walk measures and exactly what it should report.
   *
   * THE THREE FETCH CALL SITES ARE WRITTEN OUT SEPARATELY IN `CompareRegion` FOR
   * THIS TEST. A single call over a path built from a variable would make this
   * allow-list read as `[]` — the same blind spot Task 10.5 closed for the match
   * route, where a template-literal fetch was invisible to a literal-only regex.
   */
  it("the COMPARE route reaches the index plus the three entity families (AC 1, FR-34)", () => {
    /*
     * SET EQUALITY, deliberately: a MISSING fetch is as much a defect as an extra
     * one. Dropping `tournament.json` would silently disable slug validation and
     * turn every invalid comparison into a fetch error; dropping an entity family
     * would mean one of the three type-selector segments had stopped loading its
     * own data.
     */
    const reachable = artifactPathsReachableFrom(SRC_DIR + "app/compare/page.tsx");
    expect(reachable).toEqual([
      "/index/player-profiles/{}.json",
      "/index/team-profiles/{}.json",
      "/index/tournament.json",
      "/matches/{}.json",
    ]);
    /*
     * `leaderboards.json` IS THIS ROUTE'S SPECIFIC TRAP. The Hub already fetches
     * it and it carries thirty-odd ranked boards of exactly the metrics a
     * comparison shows — so reaching for it to answer "who ranks higher?" is the
     * obvious move, and it is WRONG twice over: it is +29 KB gzip this route has
     * no use for, and a RANK BETWEEN THE TWO SIDES is a displayed cross-entity
     * derivation banned outright by AD-5.
     */
    expect(reachable).not.toContain("/index/leaderboards.json");
  });

  it("still walks far enough to see all FOUR of the compare route's artifact paths", () => {
    /*
     * Guards the guard, as all four siblings do: page.tsx holds no fetch itself —
     * every one of them lives two hops away in CompareRegion.
     *
     * FOUR PATHS, THREE FETCHES PER LOAD, and the title used to say "three" while
     * asserting four (code review 2026-08-07). Both numbers are right about
     * different things: a single load fetches `tournament.json` plus the TWO
     * artifacts of the chosen type, but the type is a URL parameter, so all three
     * type branches of `fetchSide` are reachable from this entry point and the
     * allow-list must carry all four. A walk that returned three would mean one
     * branch had gone invisible to it.
     */
    expect(readFileSync(SRC_DIR + "app/compare/page.tsx", "utf8")).not.toContain("fetchArtifact");
    expect(artifactPathsReachableFrom(SRC_DIR + "app/compare/page.tsx")).toHaveLength(4);
  });
});

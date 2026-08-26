import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "@/lib/site-origin";

/*
 * THE CANONICAL-URL GATE OVER THE WHOLE EXPORT (Story 3.2, AC3/AC4/AC7).
 *
 * What it holds, on EVERY ONE of the ~1,407 exported `.html` files rather than
 * on a sample:
 *
 *   - exactly one `<link rel="canonical">`;
 *   - that canonical is absolute, same-origin and trailing-slashed, because
 *     `next.config.ts` sets `trailingSlash: true` and Netlify SERVES the
 *     slashed URL — a canonical that disagrees with the served URL is worse
 *     than none;
 *   - the canonical names ITS OWN ROUTE, derived from the file's own relative
 *     path. This is the case that catches a correctly-shaped canonical copied
 *     onto 1,405 wrong routes, which is exactly what a layout-level ABSOLUTE
 *     literal would have produced, and which "exactly one, absolute,
 *     same-origin" alone does not catch;
 *   - `og:url` is BYTE-IDENTICAL to the canonical — not "present", not "same
 *     origin". Both go through the same Next resolver, so equality is
 *     achievable rather than approximate, and anything less would let the four
 *     `generateMetadata` routes ship a canonical with no matching `og:url`
 *     after a future rewrite of their `openGraph` object;
 *   - no `hreflang` anywhere (D17, upheld by D20). A ruling is prose until
 *     something fails on it.
 *
 * WHY THIS FILE AND NOT `static-output.test.ts`, the natural home: story 3-10
 * held that file while this story ran, and standing AC A3 forbids modifying a
 * file another session holds. A3 does not force an abort here, because this
 * story does not need to MODIFY that file — it needs an assertion, and an
 * assertion can live in a file of its own. The `OUT_DIR` / `describe.skipIf` /
 * partial-export-fails-loudly conventions below are that file's, deliberately.
 *
 * EVERYTHING PINS BY RELATIVE PATH AND BY NO ENTITY ID AT ALL (standing AC A2).
 * The expected URL for each file is derived from that file's own path, so there
 * is nothing left to pin and no id the fixture corpus and the real corpus could
 * share. `players/static-output.test.ts:126`'s `QUINONES` constant is the shape
 * A2 forbids; it is one directory away and it is not copied here.
 */

const OUT_DIR = fileURLToPath(new URL("../../out/", import.meta.url));

/** Build chunks and copied JSON are not documents and are not walked. */
const SKIPPED_DIRECTORIES = new Set(["_next", "data"]);

/*
 * THE ONE RULED EXCEPTION (D3). These three are BYTE-IDENTICAL copies of the
 * same not-found route and all three resolve to `${SITE_ORIGIN}/_not-found/` —
 * a URL that is not an indexable route. Accepted on one mechanical ground: Next
 * already emits `<meta name="robots" content="noindex">` on that route, so the
 * canonical is inert to every crawler that honours it. Adding a metadata export
 * to `not-found.tsx` to "fix" it costs more than the defect.
 *
 * Named exactly, so a FOURTH unexplained exception cannot appear silently.
 */
const NOT_FOUND_ARTIFACTS = ["404.html", "404/index.html", "_not-found/index.html"];

/*
 * Of those three, only the two `404` copies are served somewhere their own
 * canonical does not name; `_not-found/index.html` IS served at
 * `/_not-found/`. Asserted as a set so neither a NEW exception nor a silently
 * dropped one passes.
 */
const PATH_MISMATCHED_DOCUMENTS = ["404.html", "404/index.html"];

/*
 * `out/404.html` is the only exported document whose served path cannot be
 * derived from `<dir>/index.html`. Pinned for the same reason as above: a
 * second such file would otherwise slip past the own-route case unexamined.
 */
const NON_INDEX_DOCUMENTS = ["404.html"];

/*
 * The structural spine of the export. Asserted present so that a PARTIAL export
 * fails loudly instead of passing every case vacuously — `describe.skipIf`
 * below skips only when the export is WHOLLY absent. This is the
 * `scanned === 0` lesson: a gate that runs over nothing reports green.
 */
const REQUIRED_DOCUMENTS = [
  "index.html",
  "about/index.html",
  "glossary/index.html",
  "compare/index.html",
  ...NOT_FOUND_ARTIFACTS,
];

/** Route families that must each contribute at least one exported document. */
const REQUIRED_FAMILIES = ["matches", "players", "teams"];

/*
 * I/O-bound, not logic-bound: 1,407 files / 38.2 MB, measured at ~3.3 s
 * standalone. Under full-suite load — ~58 test files in parallel, several of
 * them spawning node processes — an untimed I/O case fails on TIME rather than
 * on substance, a cost this project has already paid once. The shipped
 * precedent is `site-origin.test.ts`'s 20 s for 194 files / 3 MB; 60 s is the
 * proportionate figure here.
 */
const IO_TIMEOUT_MS = 60_000;

/*
 * `(?<![-\w:])` on every attribute name so `data-rel="canonical"` and
 * `data-href` can neither decoy nor spoof — the same guard
 * `assert-no-external-origins.mjs` grew at its code review, for the same
 * reason, after three such false negatives shipped green.
 */
const LINK_TAG = /<link\b[^>]*>/g;
const META_TAG = /<meta\b[^>]*>/g;
const REL_ATTRIBUTE = /(?<![-\w:])rel="([^"]*)"/;
const HREF_ATTRIBUTE = /(?<![-\w:])href="([^"]*)"/;
const HREFLANG_ATTRIBUTE = /(?<![-\w:])hreflang="([^"]*)"/;
const NAME_OR_PROPERTY = /(?<![-\w:])(?:property|name)="([^"]*)"/;
const CONTENT_ATTRIBUTE = /(?<![-\w:])content="([^"]*)"/;

/**
 * One exported document, reduced to the handful of facts the cases below need.
 * The full 38 MB is read once and never retained.
 */
interface ExportedDocument {
  /** Posix-separated path relative to `out/`, e.g. `players/l-messi/index.html`. */
  readonly relativePath: string;
  /** Every `<link rel="canonical">` href, in document order. Must be exactly one. */
  readonly canonicals: readonly string[];
  /** Every `og:url` value; tolerant of `name=` alongside `property=` and of attribute order. */
  readonly ogUrls: readonly string[];
  /** Every `hreflang` value carried by any `<link>`. Must be empty everywhere. */
  readonly hreflangs: readonly string[];
  /** True when a `robots` meta names `noindex`. */
  readonly noindex: boolean;
}

function* walkHtml(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      yield* walkHtml(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".html")) {
      yield path.join(dir, entry.name);
    }
  }
}

function readDocument(absolutePath: string): ExportedDocument {
  const html = readFileSync(absolutePath, "utf8");
  const canonicals: string[] = [];
  const hreflangs: string[] = [];
  const ogUrls: string[] = [];
  let noindex = false;

  for (const tag of html.match(LINK_TAG) ?? []) {
    if (REL_ATTRIBUTE.exec(tag)?.[1] === "canonical") {
      canonicals.push(HREF_ATTRIBUTE.exec(tag)?.[1] ?? "");
    }
    const hreflang = HREFLANG_ATTRIBUTE.exec(tag)?.[1];
    if (hreflang !== undefined) hreflangs.push(hreflang);
  }

  for (const tag of html.match(META_TAG) ?? []) {
    const key = NAME_OR_PROPERTY.exec(tag)?.[1];
    if (key === "og:url") ogUrls.push(CONTENT_ATTRIBUTE.exec(tag)?.[1] ?? "");
    if (key === "robots" && (CONTENT_ATTRIBUTE.exec(tag)?.[1] ?? "").includes("noindex")) {
      noindex = true;
    }
  }

  return {
    relativePath: path.relative(OUT_DIR, absolutePath).split(path.sep).join("/"),
    canonicals,
    ogUrls,
    hreflangs,
    noindex,
  };
}

/**
 * The URL this file is SERVED at, derived from its own relative path and
 * nothing else. `index.html` → `/`; `players/x/index.html` → `/players/x/`.
 * Null for a document whose served path is not derivable that way — `404.html`
 * is the only one, and `NON_INDEX_DOCUMENTS` pins that.
 */
function servedUrl(relativePath: string): string | null {
  if (relativePath === "index.html") return `${SITE_ORIGIN}/`;
  if (relativePath.endsWith("/index.html")) {
    return `${SITE_ORIGIN}/${relativePath.slice(0, -"index.html".length)}`;
  }
  return null;
}

/**
 * Failure messages name FILES, not counts. `site-origin.test.ts:89-95` records
 * why: a bare `expect(total).toBe(1)` reports `2 !== 1` and sends the reader
 * grepping 1,407 files for the one that broke.
 */
function report(offenders: readonly string[]): string {
  return offenders.slice().sort().join(", ");
}

const anyBuilt =
  existsSync(path.join(OUT_DIR, "index.html")) || existsSync(path.join(OUT_DIR, "404.html"));

describe.skipIf(!anyBuilt)("exported canonical URLs (AC 2, AC 3, AC 4)", () => {
  let documents: ExportedDocument[] = [];
  let byPath = new Map<string, ExportedDocument>();

  beforeAll(() => {
    documents = [...walkHtml(OUT_DIR)].map(readDocument);
    byPath = new Map(documents.map((document) => [document.relativePath, document]));
  }, IO_TIMEOUT_MS);

  it("walked a WHOLE export, not a partial one", () => {
    expect(report(REQUIRED_DOCUMENTS.filter((relativePath) => !byPath.has(relativePath)))).toBe("");

    const familiesWithoutRoutes = REQUIRED_FAMILIES.filter(
      (family) => !documents.some((document) => document.relativePath.startsWith(`${family}/`))
    );
    expect(report(familiesWithoutRoutes)).toBe("");

    /*
     * Every `.html` that is not `<dir>/index.html` is pinned by name, so a
     * second non-index document cannot enter the export without this case
     * naming it — it would otherwise be invisible to the own-route case below.
     */
    const nonIndex = documents
      .filter((document) => servedUrl(document.relativePath) === null)
      .map((document) => document.relativePath);
    expect(report(nonIndex)).toBe(report(NON_INDEX_DOCUMENTS));
  });

  it('carries EXACTLY ONE <link rel="canonical"> on every exported document', () => {
    const offenders = documents
      .filter((document) => document.canonicals.length !== 1)
      .map((document) => `${document.relativePath} (${document.canonicals.length})`);
    expect(report(offenders)).toBe("");
  });

  it("emits every canonical absolute, same-origin and trailing-slashed", () => {
    const offenders = documents
      .filter((document) => {
        const [canonical] = document.canonicals;
        if (canonical === undefined) return true;
        if (!canonical.startsWith(SITE_ORIGIN)) return true;
        if (!canonical.endsWith("/")) return true;
        try {
          return new URL(canonical).origin !== SITE_ORIGIN;
        } catch {
          return true;
        }
      })
      .map((document) => `${document.relativePath} -> ${document.canonicals[0] ?? "(none)"}`);
    expect(report(offenders)).toBe("");
  });

  it("points every canonical at the route the file is SERVED at, and nowhere else", () => {
    const offenders = documents
      .filter((document) => !NOT_FOUND_ARTIFACTS.includes(document.relativePath))
      .filter((document) => document.canonicals[0] !== servedUrl(document.relativePath))
      .map(
        (document) =>
          `${document.relativePath} -> ${document.canonicals[0] ?? "(none)"} (expected ${
            servedUrl(document.relativePath) ?? "(underivable)"
          })`
      );
    expect(report(offenders)).toBe("");
  });

  it("has EXACTLY the ruled not-found exceptions and no fourth (D3)", () => {
    const mismatched = documents
      .filter((document) => document.canonicals[0] !== servedUrl(document.relativePath))
      .map((document) => document.relativePath);
    expect(report(mismatched)).toBe(report(PATH_MISMATCHED_DOCUMENTS));
    expect(report(NOT_FOUND_ARTIFACTS.filter((relativePath) => !byPath.has(relativePath)))).toBe("");
  });

  it("makes the three not-found artifacts inert: same-origin, slashed, noindex (D3)", () => {
    const offenders = NOT_FOUND_ARTIFACTS.map((relativePath) => byPath.get(relativePath))
      .filter((document): document is ExportedDocument => document !== undefined)
      .filter(
        (document) => document.canonicals[0] !== `${SITE_ORIGIN}/_not-found/` || !document.noindex
      )
      .map(
        (document) =>
          `${document.relativePath} -> ${document.canonicals[0] ?? "(none)"} noindex=${document.noindex}`
      );
    expect(report(offenders)).toBe("");
  });

  it("emits og:url BYTE-IDENTICAL to the canonical on every exported document (AC 2)", () => {
    const offenders = documents
      .filter(
        (document) => document.ogUrls.length !== 1 || document.ogUrls[0] !== document.canonicals[0]
      )
      .map(
        (document) =>
          `${document.relativePath} og:url=${document.ogUrls.join("|") || "(none)"} canonical=${
            document.canonicals[0] ?? "(none)"
          }`
      );
    expect(report(offenders)).toBe("");
  });

  it("emits NO hreflang and NO per-locale alternate anywhere (AC 4, D17/D20)", () => {
    const offenders = documents
      .filter((document) => document.hreflangs.length > 0)
      .map((document) => `${document.relativePath} (${document.hreflangs.join(", ")})`);
    expect(report(offenders)).toBe("");
  });
});

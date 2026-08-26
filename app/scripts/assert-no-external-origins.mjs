/**
 * Post-export gate (Story 2.19 Task 6.14, ledger A3/L49): the shipped export
 * must FETCH nothing from another origin.
 *
 * AR-11 says zero external requests; NFR-9 says no analytics and no telemetry;
 * AD-13 says the deploy is a static export with no functions and no middleware.
 * Until now all three were checked by a ONE-TIME MANUAL GREP recorded in Story
 * 2.1's notes — which proves nothing about the tree that ships today. Story 2.1
 * routed the mechanical version here by name.
 *
 * Node built-ins only, and no dependencies: this runs on Netlify with `app/`'s
 * install alone, in the same chain as `copy-data.mjs`.
 *
 * ═══ THE ONE DESIGN DECISION, AND IT IS WHY THE FIRST VERSION WAS WRONG ═══
 *
 * A naive "any absolute URL in any file" scan reports 27 violations on a clean
 * build, and every one is a lie: they are DIAGNOSTIC STRINGS inside vendor
 * bundles — `https://react.dev/errors/`, `https://nextjs.org/docs/...`, core-js's
 * licence URL — sitting in error messages that no user agent ever fetches. A
 * gate that cries wolf on a green tree gets switched off.
 *
 * So this matches FETCHING POSITIONS only: the attributes and call sites that
 * actually cause a request. Everything else external is COUNTED AND PRINTED but
 * does not fail the build, so the signal is still visible.
 *
 * The complementary check is the runtime one — 0 external resource entries in a
 * real browser on every route — recorded in the story. Static and runtime
 * together are what make the claim; neither alone would.
 *
 * WHAT IT SCANS: every text asset in `out/`. It deliberately does NOT scan
 * `out/data`: those are 1,411 artifacts of proper nouns and are never parsed as
 * markup or executed. They are covered by the schema gate instead.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
/**
 * The export to scan. Defaults to `app/out` (the production invocation) and
 * accepts an override so the gate's own tests can point it at a fixture tree —
 * `assert-schema-version.mjs`'s established shape.
 */
const OUT = process.argv[2] === undefined ? path.join(APP_DIR, "out") : path.resolve(process.argv[2]);

/*
 * `.svg` and `.xml` ARE SCANNED (2.19 code review). An inline <svg> lives inside
 * the `.html` that carries it, but a STANDALONE `.svg` file in the export is a
 * document of its own, and `<image href>` / `<use href>` inside one are real
 * fetching positions — the gate reported "0 external subresources" over a tree
 * containing exactly that. `.xml` covers a sitemap or feed for the same reason.
 *
 * Matched case-INSENSITIVELY: `path.extname` returns the literal case, so a
 * `.HTML` asset used to skip the walk entirely.
 */
const SCANNED_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".txt",
  ".json",
  ".webmanifest",
  ".svg",
  ".xml",
]);
const SKIPPED_DIRECTORIES = new Set(["data"]);

/*
 * ═══ THE SITE'S OWN ORIGIN, READ FROM THE ONE PLACE IT IS DEFINED ═══
 *
 * Story 3.1. `metadataBase` exists to emit ABSOLUTE self-referencing URLs —
 * `<link rel="canonical">` and `hreflang` alternates on ~1,406 routes, plus
 * the sitemap's `<loc>` entries. This gate had no concept of the origin the
 * export is published at, so it failed the build on every one of them while
 * passing `og:image`, the one tag that genuinely makes a third party fetch an
 * asset. Backwards in both directions, and reproduced at exit 1 before the fix.
 *
 * Read by REGEX rather than imported: this file may depend on nothing outside
 * `node:*` (Netlify installs `app/` alone), and `src/lib/site-origin.ts` is a
 * TypeScript module. `assert-schema-version.mjs:26-37` does exactly this for
 * SCHEMA_VERSION — the shipped, in-directory, dependency-free precedent for
 * "one definition, two readers", including the loud throw when it misses.
 */
const SITE_ORIGIN_FILE = path.join(APP_DIR, "src", "lib", "site-origin.ts");

/*
 * `\s*$` rather than `$`, and EVERY match collected rather than the first
 * (code review 2026-08-26). Two separate ways the original read went wrong:
 *
 *   - Under `/m`, `$` matches immediately before `\n`, so a CRLF checkout puts
 *     a `\r` between the `;` and the newline and the read fails CLOSED: exit 2
 *     on every build, reporting the declaration MISSING when it is present and
 *     correct. There is no `.gitattributes` anywhere in this repo pinning the
 *     line ending, and this project has a recorded history of scripted edits
 *     emitting CRLF.
 *   - `^` under `/m` requires only COLUMN 0, which an unindented line inside
 *     the doc comment above the constant satisfies — and `.exec` returns the
 *     LEFTMOST match. A commented-out example, or a genuine second declaration
 *     added later, silently won the read. The drift gate cannot catch that
 *     either: it counts occurrences of the CURRENT origin VALUE, so a second
 *     declaration carrying a DIFFERENT value adds zero. Hence: exactly one, or
 *     exit 2 and say how many were found.
 */
const SITE_ORIGIN_DECLARATION = /^export const SITE_ORIGIN = ["'`]([^"'`]+)["'`];\s*$/gm;

async function readSiteOrigin() {
  const source = await readFile(SITE_ORIGIN_FILE, "utf8");
  const matches = [...source.matchAll(SITE_ORIGIN_DECLARATION)];
  if (matches.length === 0) {
    throw new Error(
      `could not find \`export const SITE_ORIGIN = "<origin>";\` in ${SITE_ORIGIN_FILE}`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `found ${matches.length} \`export const SITE_ORIGIN\` declarations in ${SITE_ORIGIN_FILE} — ` +
        `there must be exactly one, and the gate must not have to guess which`
    );
  }
  return matches[0][1];
}

/*
 * NO FALLBACK, EVER. A default here would mean a reformatted or renamed
 * constant silently reverts the gate to its pre-3.1 behaviour and red-builds
 * every page — or, worse, allow-lists a stale origin. Exit 2, not 1, on this
 * file's own recorded rule (the two exit-2 sites below): nothing was found to be wrong
 * with the export, the check could not be performed.
 *
 * Top-level `await` is already in use in this module (`for await`); ESM allows it.
 */
let SITE_ORIGIN;
try {
  SITE_ORIGIN = await readSiteOrigin();
  if (new URL(SITE_ORIGIN).origin !== SITE_ORIGIN) {
    throw new Error(`SITE_ORIGIN must be a bare origin (no trailing slash, no path): ${SITE_ORIGIN}`);
  }
} catch (error) {
  console.error(`assert-no-external-origins: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * The allow-list, and every entry is a NON-REQUEST: `www.w3.org/2000/svg` and
 * friends are XML NAMESPACE identifiers, present in every inline <svg> and never
 * fetched. THE SITE'S OWN ORIGIN IS NOT AN EXTERNAL ORIGIN, in any position —
 * including `<link rel="preload">`, and including the informational MENTIONED
 * line, which would otherwise report this site's own host as external over its
 * own sitemap. A wrong signal on a green build is how a gate gets switched off.
 *
 * THERE IS NO ENTRY FOR A FONT CDN, AN ANALYTICS HOST OR AN IMAGE SERVICE, and
 * there must never be one: `next/font` self-hosts into `_next/static/media`,
 * `images: { unoptimized: true }` is set in next.config, and NFR-9 bans
 * telemetry outright.
 *
 * THREE DETAILS OF THE SITE_ORIGIN ENTRY, each with its own red proof:
 *
 * - THE DOTS ARE ESCAPED, and that is not cosmetic. Unescaped, `.` is "any
 *   character" and the entry allow-lists a host spelled with any separator in
 *   the dot positions.
 * - THE ORIGIN BOUNDARY `(?:[/?#]|$)` IS THE SECURITY-RELEVANT HALF. A plain
 *   prefix match allow-lists `<origin>.evil.com/track.js`. `[/?#]` rather than
 *   `(/|$)` so a bare-origin query or fragment form is not falsely reported.
 * - SCHEME-EXACT WHEREVER THE ALLOWANCE IS CONSULTED AT ALL. An `http://`
 *   self-URL is not allow-listed, so an `http` preload or stylesheet surfaces.
 *   NOTE THE LIMIT OF THAT CLAIM (code review 2026-08-26): a `rel="canonical"`
 *   or `rel="alternate"` short-circuits in `linkHref` BEFORE the allow-list is
 *   reached, so an `http` canonical passes on its REL, not on its scheme. That
 *   is deliberate — the rel exclusion is origin- and scheme-independent by
 *   design — but do not read this bullet as covering it, because it does not.
 */
/*
 * `sitemaps.org` JOINED THIS LIST ON 2026-08-26, from the story 3.4 code
 * review. `out/sitemap.xml` opens with
 * `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` — the sitemap protocol
 * namespace, emitted by Next, never fetched by anything, and structurally the
 * same NON-REQUEST as the two entries above it.
 *
 * Story 3.4 shipped without this and accounted for the result honestly: it
 * measured the MENTIONED line going 6 -> 7 and proved the new entry was its own
 * sitemap and nothing else. That was the right call under its AC1, which barred
 * it from editing this gate. But the result was a permanent external origin on
 * the MENTIONED line of every clean build, and this file warns three separate
 * times that a wrong signal on a green build is how a gate gets switched off.
 * Ruled by Juan at that review: allow-list it.
 */
const NAMESPACE_ALLOWED = [
  /^https?:\/\/(www\.)?w3\.org\//i,
  /^https?:\/\/(www\.)?schema\.org\//i,
  /^https?:\/\/(www\.)?sitemaps\.org\//i,
];

/*
 * ═══ THE SELF-ORIGIN ALLOWANCE IS POSITION-SCOPED ═══
 *
 * Code review 2026-08-26. It shipped as a third entry in the ONE global
 * allow-list, which meant `allowed()` applied it at EVERY fetching position.
 * Measured consequence: a tree carrying `<script src="<origin>/tracker.js">`
 * and a self-origin `fetch("<origin>/collect", {method:"POST"})` scanned GREEN
 * — exit 0, and not even an informational MENTIONED line — where the pre-3.1
 * gate exited 1 naming both. Under AD-13 this deploy is a static export with
 * NO functions, so there is no self-origin endpoint to legitimately fetch: a
 * self-origin ABSOLUTE `fetch`/`src` is precisely the shape a proxied-analytics
 * regression takes, and NFR-9 is the clause this file's header calls the one
 * that matters most.
 *
 * So the allowance is granted only where AC1 actually argues for it: the
 * `<link href>` position (canonical, hreflang alternate, preload) and the two
 * INFORMATIONAL lines — `mentions` and `anchors` — which would otherwise report
 * this site's own host as external over story 3.4's sitemap. `src`, `srcset`,
 * `poster`, CSS `url()`, `@import`, `fetch()`, `import()`, `importScripts()`,
 * `new Worker()`, `XMLHttpRequest`, `EventSource` and `WebSocket` stay gated on
 * origin exactly as they were before story 3.1.
 */
const SELF_ORIGIN = new RegExp(`^${escapeRegExp(SITE_ORIGIN)}(?:[/?#]|$)`, "i");
const SELF_ORIGIN_POSITIONS = new Set(["<link href>"]);

/*
 * ═══ TWO HOST PATTERNS, AND THE DIFFERENCE IS THE WHOLE 2.19-REVIEW FIX ═══
 *
 * `HOST` requires a DOTTED ALPHABETIC TLD. That is right for the informational
 * passes below (`ANY_URL`, `ANCHOR_HREF`), which scan free text: `//` appears in
 * every JS comment in every vendor bundle, and a pattern loose enough to match
 * `//internal/x` would report thousands of them.
 *
 * It was WRONG for the fetching positions, and wrong in the one direction that
 * matters. `[a-z]{2,}` cannot match a digit, so an IP-literal host has no
 * alphabetic TLD and never matched at all — VERIFIED before this fix, by running
 * the shipped script over a page carrying
 * `<script src="https://93.184.216.34/track.js">` and
 * `fetch("https://203.0.113.9/collect")`: it printed "0 external subresources"
 * and exited 0. A gate whose entire purpose is AR-11 / NFR-9 passed a page that
 * loads a remote script and posts telemetry, because the exfiltration host was
 * an address rather than a name. Single-label hosts (`//localhost:3000/…`,
 * `//metrics/collect`) were invisible for the same reason.
 *
 * `FETCH_HOST` therefore admits IPv4 literals, bracketed IPv6 literals and
 * single-label hosts. It can afford to: every fetching position is ANCHORED on
 * an attribute name or a call site (`src="`, `fetch("`), so a `//` reached
 * through one of those anchors is a URL by construction, never a comment.
 */
const HOST = String.raw`(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'\`)<>\\]*`;
const FETCH_HOST = String.raw`(?:https?:)?\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9._~%-]+)(?::\d+)?[^\s"'\`)<>\\]*`;

/*
 * ═══ `rel="canonical"` AND `rel="alternate"` ARE NAVIGATION HINTS ═══
 *
 * Story 3.1, and it is the same rule as `<a href>` one comment below: a
 * canonical or an hreflang alternate is a statement ABOUT a document, not a
 * subresource the page loads. No user agent fetches either while rendering.
 * That holds REGARDLESS OF ORIGIN — which is what makes this mechanism
 * independent of the SITE_ORIGIN allowance rather than redundant with it.
 *
 * DENY BY DEFAULT, and the default is the point. Only these two are excluded;
 * `stylesheet`, `preload`, `prefetch`, `icon`, `manifest`, `preconnect`,
 * `dns-prefetch` and `modulepreload` stay gated, and so does anything HTML
 * gains in future. A new `rel` must be excluded DELIBERATELY; it must not
 * arrive allow-listed. Three consequences, each pinned by a test:
 *
 *   - a <link> with NO `rel` at all is a fetching position;
 *   - a <link> with an UNKNOWN `rel` is a fetching position;
 *   - `rel="alternate stylesheet"` is a FETCHING position. This is a real
 *     HTML idiom, and an "is `alternate` present?" substring test would blow
 *     a hole straight through AR-11. Hence: every token must be non-fetching.
 *
 * The exclusion is PER-TAG, not per-host: a canonical to some origin says
 * nothing about a stylesheet loaded from the same one.
 */
const NON_FETCHING_RELS = new Set(["canonical", "alternate"]);

/*
 * Attribute readers for the whole-<link>-tag match. Both accept the UNQUOTED
 * form. If `rel` were only read when quoted, an unquoted `rel=canonical` would
 * fall through to deny-by-default and RED-BUILD ON A CORRECT CANONICAL — a
 * build-breaking false positive, the failure mode this story exists to remove.
 */
/*
 * `(?<![-\w:])` RATHER THAN `\b`, AND IT IS NOT COSMETIC (code review
 * 2026-08-26). `\b` holds between `-` and `h`, so `\bhref` matched `data-href`
 * and `xlink:href`, and `.exec` returns the LEFTMOST match. Both readers were
 * therefore spoofable by an attribute nobody looks at:
 *
 *   - `<link rel="stylesheet" data-href="/local.css" href="<external>">` read
 *     the relative decoy and returned `null` — the tag vanished from the gate.
 *     Next already emits `data-precedence` on stylesheet links, so a future
 *     `data-*href` would have switched this position off wholesale.
 *   - `<link data-rel="canonical" rel="stylesheet" href="<external>">`
 *     manufactured a non-fetching rel and waved a real third-party stylesheet
 *     straight through the deny-by-default policy below.
 *
 * Both were verified exit 0 here and exit 1 against the pre-story gate.
 */
const LINK_HREF = new RegExp(String.raw`(?<![-\w:])href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`, "i");
const LINK_REL = new RegExp(String.raw`(?<![-\w:])rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`, "i");

/*
 * A PREFIX MATCH, NOT A FULL ONE, AND THAT IS THE WHOLE BUG (code review
 * 2026-08-26). This shipped as `^${FETCH_HOST}$`, testing the ENTIRE attribute
 * value, where the pre-3.1 position captured a PREFIX from the opening quote.
 * `FETCH_HOST`'s tail class excludes space, quote, apostrophe, backtick, `)`,
 * `<`, `>` and backslash — so any href containing ONE of them failed the
 * anchored test and the whole tag was dropped to `null`. Verified leaking, all
 * exit 0 here and exit 1 on the pre-story gate: `.../a b.css`, `.../a(1).css`,
 * a backslash path separator (browsers normalise it to `/` and fetch), and —
 * the sharp one — `href=" <external>"`, a single LEADING SPACE, which every
 * browser strips before fetching. Hence `.trim()` then prefix-match.
 */
const FETCH_HOST_PREFIX = new RegExp(`^(${FETCH_HOST})`, "i");

const attributeValue = (match) => (match === null ? undefined : (match[1] ?? match[2] ?? match[3]));

/**
 * The URL a `<link>` tag actually fetches, or `null` if it fetches nothing.
 *
 * Returns `null` for a relative or non-host-bearing `href` (the overwhelming
 * majority in this export — those are same-document by construction), and for
 * a tag whose `rel` is present and entirely non-fetching.
 */
function linkHref(match) {
  const tag = match[0];
  const href = attributeValue(LINK_HREF.exec(tag));
  if (href === undefined) return null;
  const fetched = FETCH_HOST_PREFIX.exec(href.trim());
  if (fetched === null) return null;

  const rel = attributeValue(LINK_REL.exec(tag)) ?? "";
  const tokens = rel.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((token) => NON_FETCHING_RELS.has(token))) return null;

  return fetched[1];
}

/**
 * Positions that CAUSE A REQUEST. Each pattern captures the URL in group 1,
 * unless the entry carries a fourth element — an `extract(match)` callback
 * returning the URL or `null`, for a position whose fetching-ness depends on
 * more of the tag than the URL alone (`<link rel>`). One code path either way.
 *
 * `<a href>` is deliberately NOT here: a link is a navigation the reader
 * chooses, not a fetch the page performs. It is reported below instead, so an
 * outbound link is still visible without failing a build over it.
 */
const FETCHING_POSITIONS = [
  ["src attribute", new RegExp(String.raw`\bsrc\s*=\s*["'](${FETCH_HOST})`, "gi")],
  ["srcset attribute", new RegExp(String.raw`\bsrcset\s*=\s*["'](${FETCH_HOST})`, "gi")],
  ["poster attribute", new RegExp(String.raw`\bposter\s*=\s*["'](${FETCH_HOST})`, "gi")],
  // Whole tag, then `linkHref` decides: the `rel` is not readable from a
  // pattern anchored on `href` alone. See NON_FETCHING_RELS above.
  ["<link href>", new RegExp(String.raw`<link\b[^>]*>`, "gi"), undefined, linkHref],
  // <image href> / <use href>, and their xlink: forms — the standalone-.svg
  // fetching positions the extension list above now reaches.
  [
    "<image>/<use> href",
    new RegExp(String.raw`<(?:image|use)\b[^>]*?\b(?:xlink:)?href\s*=\s*["'](${FETCH_HOST})`, "gi"),
  ],
  /*
   * ═══ THE TWO CSS-SYNTAX POSITIONS ARE SCOPED TO CSS-BEARING FILES ═══
   *
   * `url(` is matched case-INSENSITIVELY, and JavaScript's `new URL(` is a
   * four-character case-insensitive match for it. Inside a vendor bundle that is
   * everywhere: core-js's own URL feature detection carries
   * `new URL("https://a@b").username`, and the export ships three such strings.
   *
   * They did not surface before only because the old dotted-TLD `HOST` could not
   * match `a@b` or `x` — the same weakness that let real IP-literal hosts through.
   * Hardening the host pattern without this scope would have turned a green build
   * red over a polyfill's test fixture, which is precisely the "gate that cries
   * wolf" this file's header says gets switched off.
   *
   * So: `url()` and `@import` are CSS grammar, and are scanned in the files that
   * carry CSS — `.css`, plus `.html` for inline `<style>`. The `new\s` lookbehind
   * is belt-and-braces for a `<style>` block sitting next to inline JS in the same
   * HTML document. A url() injected by CSS-in-JS at runtime is out of this gate's
   * reach and is covered by the runtime check instead: 0 external resource
   * entries in a real browser on every route.
   */
  [
    "CSS url()",
    new RegExp(String.raw`(?<!\bnew\s)(?<![\w$.])url\(\s*["']?(${FETCH_HOST})`, "gi"),
    new Set([".css", ".html"]),
  ],
  [
    "CSS @import",
    new RegExp(String.raw`@import\s+(?:url\()?\s*["'](${FETCH_HOST})`, "gi"),
    new Set([".css", ".html"]),
  ],
  ["fetch()", new RegExp(String.raw`\bfetch\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["import()", new RegExp(String.raw`\bimport\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["importScripts()", new RegExp(String.raw`\bimportScripts\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["new Worker()", new RegExp(String.raw`new\s+Worker\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  [
    "XMLHttpRequest.open",
    new RegExp(String.raw`\.open\s*\(\s*["'][A-Z]+["']\s*,\s*["'\`](${FETCH_HOST})`, "gi"),
  ],
  ["new EventSource()", new RegExp(String.raw`new\s+EventSource\s*\(\s*["'\`](${FETCH_HOST})`, "gi")],
  ["new WebSocket()", new RegExp(String.raw`new\s+WebSocket\s*\(\s*["'\`]((?:wss?:)?\/\/[^\s"'\`]+)`, "gi")],
];

const ANY_URL = new RegExp(HOST, "gi");
const ANCHOR_HREF = new RegExp(String.raw`<a\b[^>]*\bhref\s*=\s*["'](${HOST})`, "gi");

const allowed = (url, permitSelfOrigin = false) => {
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  if (NAMESPACE_ALLOWED.some((pattern) => pattern.test(normalized))) return true;
  return permitSelfOrigin && SELF_ORIGIN.test(normalized);
};

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
      continue;
    }
    if (SCANNED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield path.join(dir, entry.name);
    }
  }
}

/**
 * The origin of a matched URL, or `null` if it will not parse.
 *
 * `new URL()` USED TO RUN UNGUARDED HERE, inside the try that owns the directory
 * walk (2.19 code review). `HOST`'s tail class admits `:`, `$`, `{` and `}`, so a
 * minified template literal like `"https://api.example.com:${port}/v1"` — or any
 * vendor string with an out-of-range port or a mangled IPv6 literal — matched the
 * regex and then threw. The throw was caught by the WALK's handler, so the build
 * died at exit 2 telling the operator to "run `next build` first", naming a cause
 * that had nothing to do with it and never printing the offending file.
 *
 * A REPORTING-ONLY CODE PATH MUST NOT BE ABLE TO FAIL THE BUILD. An unparseable
 * URL is now reported as itself, which is strictly more information than the
 * origin would have been.
 */
function originOf(raw) {
  const normalized = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

let scanned = 0;
const fetching = new Map();
const anchors = new Set();
const mentions = new Set();

try {
  for await (const file of walk(OUT)) {
    scanned += 1;
    const text = await readFile(file, "utf8");
    const relative = path.relative(OUT, file);

    const extension = path.extname(file).toLowerCase();

    for (const [position, pattern, onlyExtensions, extract] of FETCHING_POSITIONS) {
      // A position with no extension set applies everywhere; see "CSS url()".
      if (onlyExtensions !== undefined && !onlyExtensions.has(extension)) continue;
      for (const match of text.matchAll(pattern)) {
        // No extractor means group 1 is the URL — every position but <link>.
        const url = extract === undefined ? match[1] : extract(match);
        // `== null`, not `=== null`: an extractor returning `undefined` would reach
        // `allowed(undefined)`, whose `.startsWith` throws inside this walk's `try`
        // and kills the build at exit 2 blaming a missing export — exactly the
        // misattribution `originOf` below records as a bug already fixed once.
        if (url == null || allowed(url, SELF_ORIGIN_POSITIONS.has(position))) continue;
        const key = `${position}  ${url}`;
        const files = fetching.get(key) ?? new Set();
        files.add(relative);
        fetching.set(key, files);
      }
    }
    for (const match of text.matchAll(ANCHOR_HREF)) {
      if (!allowed(match[1], true)) anchors.add(match[1]);
    }
    for (const match of text.matchAll(ANY_URL)) {
      if (allowed(match[0], true)) continue;
      mentions.add(originOf(match[0]) ?? `${match[0]} (unparseable)`);
    }
  }
} catch (error) {
  console.error(`assert-no-external-origins: could not walk ${OUT} — run \`next build\` first`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

/*
 * A GATE THAT SCANNED NOTHING HAS PROVED NOTHING (2.19 code review).
 *
 * `out/` existing is not the same as `out/` holding an export: a cleaned tree, a
 * wrong `argv[2]`, or a build that emitted only `out/data` all walk cleanly and
 * scan zero files. The script used to print "0 text asset(s) in out/, 0 external
 * subresources." and exit 0 — a PASS, reported in the same words as a real one.
 *
 * `assert-schema-version.mjs` already fails on "no `*.json` artifacts" for this
 * exact reason; this is the same rule. Exit 2, not 1: nothing was found to be
 * wrong with the export, the export was not there to check.
 */
if (scanned === 0) {
  console.error(
    `assert-no-external-origins: scanned 0 text assets under ${OUT} — there is nothing to ` +
      `check, so this is not a pass. Run \`next build\` (and \`copy-data\`) first.`
  );
  process.exit(2);
}

if (anchors.size > 0) {
  console.log(`assert-no-external-origins: ${anchors.size} outbound <a href> (navigation, not a fetch):`);
  for (const href of anchors) console.log(`    ${href}`);
}
if (mentions.size > 0) {
  console.log(
    `assert-no-external-origins: ${mentions.size} external origin(s) MENTIONED in text ` +
      `(vendor error-message URLs and licences — not fetched): ${[...mentions].sort().join(", ")}`
  );
}

if (fetching.size > 0) {
  console.error(
    `assert-no-external-origins: ${fetching.size} EXTERNAL SUBRESOURCE(S) in the export ` +
      `— AR-11 requires zero external requests and NFR-9 bans telemetry:`
  );
  for (const [key, files] of fetching) {
    const shown = [...files].slice(0, 3).join(", ");
    const more = files.size > 3 ? ` (+${files.size - 3} more)` : "";
    console.error(`  ${key}\n      ${shown}${more}`);
  }
  process.exit(1);
}

console.log(`assert-no-external-origins: ${scanned} text asset(s) in out/, 0 external subresources.`);

# Sprint Change Proposal — Post-Launch SEO & Share Metadata

**Date:** 2026-08-26
**Author:** Juan (ruling), `bmad-correct-course` (analysis)
**Trigger:** Epic 2 retrospective §6.2 — the one blocker standing between Epic 2 and a written Epic 3
**Scope classification:** **Moderate** — no rollback, no MVP change; one architectural clarification,
one build-gate correction, and a new epic's scope defined
**Status:** APPROVED by Juan, 2026-08-26

---

## 1. Issue Summary

### 1.1 The ask

`mundial-stats.juancr.dev` was purchased on 2026-08-26, after Epic 2 shipped. The post-launch ask:

> Share previews (WhatsApp / Slack / X / LinkedIn) should render in English or Spanish depending on
> the user's zone.

### 1.2 Why it needed a ruling rather than a story

It collides head-on with three shipped decisions:

| Decision | Where | What it says |
|---|---|---|
| **D17** | Story 2.19, ruled 2026-08-25 | `<title>` / OG stay Spanish after an EN toggle; ES is canonical across all 1,406 routes. Closed ledger L147, L2697, L3227 as ACCEPTED. |
| **AR-11 (AD-11)** | `epics.md:92`, `ARCHITECTURE-SPINE.md:110` | Read by the code as banning `og:image` outright. |
| **AD-13 / NFR-8 / NFR-9** | `netlify.toml:1-4` | Pure static publish, no functions, no middleware, $0/month. Verified by Story 2.19 Task 9.3. |

### 1.3 The constraint the ask runs into

**Open Graph tags are read by crawlers.** A crawler has no user, no geolocation, no session and no
JavaScript. It issues one GET and parses one document. On a static export, **one URL yields exactly
one document** — there is no negotiation surface. The ask, taken literally, is not implementable on
this architecture at any price short of an Edge Function.

That is the finding. Everything below is about what to do with it.

### 1.4 Evidence gathered

Four findings, all verified against the tree at `97edcb9`, not inferred from documents.

---

#### **F1 — The `og:image` ban is a self-imposed over-read. Confirmed, and the project's own gate proves it.**

AR-11's actual text (`ARCHITECTURE-SPINE.md:110`, the authoritative long form):

> "All runtime assets are same-origin: fonts (Archivo + Inter per DESIGN.md) self-hosted via
> `next/font`, **zero external requests**."

The clause is scoped to *fonts* and *third-party origins*. It does not name images, meta tags, or
same-origin assets. Both available readings permit a same-origin OG card:

- Read narrowly ("this sentence is about fonts") — `og:image` is out of scope entirely.
- Read broadly ("all runtime assets are same-origin") — a same-origin `og:image` **satisfies** it.

The decisive evidence is mechanical rather than textual. `app/scripts/assert-no-external-origins.mjs`
is the *enforcement* of AR-11, added by Story 2.19 Task 6.14 to replace a one-time manual grep. It
enumerates `FETCHING_POSITIONS` explicitly — `src`, `srcset`, `poster`, `<link href>`,
`<image>/<use> href`, CSS `url()`, `@import`, `fetch()`, `import()`, `importScripts()`,
`new Worker()`, `XMLHttpRequest.open`, `EventSource`, `WebSocket`.

**`<meta content>` is deliberately absent from that list**, and the file's own header says why:

> "So this matches FETCHING POSITIONS only: the attributes and call sites that actually cause a
> request."

A page carrying `og:image` **fetches nothing**. The crawler fetches it, on another machine, minutes
or days later, entirely outside the page's load. It cannot affect LCP, TBT, payload budget, or the
NFR-9 telemetry surface — the three things AR-11 and its neighbours exist to protect.

**Verified empirically.** The gate was run against a fixture carrying `og:image` and `twitter:card`:
both pass clean.

**What the ban actually costs today:** every WhatsApp, Slack, LinkedIn and X preview of all 1,406
routes renders as a bare text row instead of a card. This is the single largest share-surface defect
in the project, and it was never an architectural decision — it is a comment.

**How it is pinned:** 2 test assertions and 4 source comments. *(The retrospective said three tests;
the count is two.)*

```
app/src/app/players/static-output.test.ts:125-126   assertion
app/src/app/teams/static-output.test.ts:139-140     assertion
app/src/app/matches/[slug]/page.tsx:49              comment
app/src/app/page.tsx:74                             comment
app/src/app/players/[slug]/page.tsx:53-55           comment
app/src/app/teams/[slug]/page.tsx:64-66             comment
```

---

#### **F2 — ⚠️ The retrospective's "available without any ruling" list is NOT available. That same gate blocks it.**

Retro §6.3 lists `metadataBase`, absolute canonical URLs, `sitemap.xml`, `robots.txt`, a Twitter card
and a same-origin `og:image` as "newly unblocked by the domain purchase alone". **That is wrong, and
the reason is worth the paragraph.**

`assert-no-external-origins.mjs` treats `<link href>` as a fetching position — correctly, for
stylesheets and preloads — but matches it against `FETCH_HOST`, **which has no concept of the site's
own origin**. `ALLOWED` contains exactly two entries, `w3.org` and `schema.org`, both XML namespaces.

Verified by running the shipped gate against a fixture:

```
$ node scripts/assert-no-external-origins.mjs <fixture>

assert-no-external-origins: 2 EXTERNAL SUBRESOURCE(S) in the export
  — AR-11 requires zero external requests and NFR-9 bans telemetry:
  <link href>  https://mundial-stats.juancr.dev/players/quinones/
      index.html
  <link href>  https://mundial-stats.juancr.dev/en/players/quinones/
      index.html
EXIT=1
```

`og:image` and `twitter:card` in the same fixture **passed**.

**The gate has it exactly backwards.** It fails the build on the site's own canonical URL — a
navigation hint that fetches nothing — while waving through the one tag that genuinely causes a
third party to fetch an asset.

**Consequence:** the first Epic 3 commit that adds `metadataBase` + canonical URLs **fails the
Netlify build chain on push**, on all ~1,406 pages at once, with an error message naming AR-11 and
NFR-9. Whoever hits it will reasonably conclude the architecture forbids canonical URLs.

**This makes the gate fix a hard prerequisite, sequenced first.** It is not a cleanup item.

---

#### **F3 — The measured Spanish surface in a share preview is one enum label.**

Before pricing 1,406 extra routes, we measured what an English reader actually loses today. Composed
from the shipped composers and the real corpus:

| Route | `<title>` / `og:title` | `og:description` | Spanish content |
|---|---|---|---|
| `/players/{slug}` | `Quiñones · Colombia · WC Stats` | `Delantero · Colombia` | **1 word** (position enum) |
| `/teams/{slug}` | `Mexico · 4-0-1 · WC Stats` | `Mexico · 4-0-1 · Octavos de final` | **1 phrase** (stage enum) |
| `/matches/{slug}` | `Mexico 2-1 Colombia · Octavos de final · WC Stats` | `Octavos de final · Estadio Azteca` | **1 phrase** (stage enum) |
| `/` | `WC Stats — Analítica del Mundial 2026` | full sentence | **fully Spanish** |

`app.siteName` is `"WC Stats"` in **both** dictionaries (`es.ts:21`, `en.ts:9`). Team names, player
names, scores, records and venues are proper nouns and numerals — language-neutral by construction.

**On 1,400 of 1,406 routes the title is already locale-neutral**, and the entire translatable delta
is a small closed set of enum labels: ~8 stage names and ~4 position names.

Option 2 proposes doubling the route count to ~2,812 in order to translate, on the typical preview,
**one or two words**.

---

#### **F4 — The real complaint is not the preview. It is the landing, and that is broken and fixable today.**

A share preview is one line of text. The page behind it is the entire product — and unlike the
crawler, the recipient's **browser** has `navigator.language`, runs JavaScript, and can be served
correctly from a static export with no architecture change whatsoever.

Today it is not. `app/src/lib/bootstrap.ts:36-41`:

```ts
/** Persisted valid locale → it; anything else → canonical es. */
export function resolveLocale(stored: string | null): Locale {
  if (stored === "es" || stored === "en") {
    return stored;
  }
  return "es";
}
```

There is no `navigator.language` branch, in the pure function or in the checked-in pre-paint script
literal. **Every first-time visitor on Earth is served Spanish**, including the English speaker who
just clicked the shared link this whole request is about.

An English-speaking recipient in Chicago currently gets: a Spanish-ish preview (2 words), then a
**fully Spanish product**. Option 2 fixes the first. `navigator.language` fixes the second.

---

## 2. Impact Analysis

### 2.1 Epic impact

| Epic | Impact |
|---|---|
| Epic 1 (Pipeline) | **None.** No contract change, no re-emission, no `schemaVersion` bump. `/contract` stays closed. |
| Epic 2 (Web App) | **Closed and unaffected.** D17 is upheld, not reopened. No completed story is rolled back or reopened. |
| **Epic 3 (new)** | Scope **defined** by this proposal. Unblocked to be written. |

### 2.2 Story impact

**No shipped story is rolled back or reopened.** Story 2.19's D17 stands as ruled. Two of its test
assertions are retired by an architectural clarification (F1), which is a correction to a
misreading, not a reversal of a decision.

### 2.3 Artifact conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| `epics.md:92` (AR-11) | Ambiguous scoping lets "zero external requests" be read as an asset ban | Clarifying clause added — same-origin assets and `<meta>` URLs are explicitly in bounds |
| `ARCHITECTURE-SPINE.md:110` (AD-11) | Same ambiguity, authoritative long form | Same clause |
| `epics.md` NFR-4 | Says "meaningful `<title>`/OG meta"; silent on canonical URLs, sitemap, robots, `og:image` | NFR-4 extended; the ES-canonical property recorded as a stated NFR, not folklore |
| `app/scripts/assert-no-external-origins.mjs` | **Fails the build on same-origin `<link href>`** (F2) | `SITE_ORIGIN` allowance + non-fetching `rel` exclusion |
| `app/eslint.config.mjs:160` | Metadata selector gates `title\|description\|default\|template\|absolute` — **`alt` and `siteName` are not gated**, so an `og:image` alt literal would ship un-translated and silent | Both keys added to the selector |
| `app/src/lib/bootstrap.ts` | No `navigator.language` (F4) | Detection added to the pure function **and** the script literal |
| PRD `prd.md:390` | Shareability bullet; no conflict | Unchanged |
| UX designs | No conflict — no visual surface changes | Unchanged |
| `netlify.toml` | No conflict — everything proposed is build-time and static | Unchanged |

### 2.4 Technical impact

- **No new runtime dependency, no function, no middleware.** AD-13 / NFR-8 / NFR-9 hold intact; the
  deploy stays `$0/month` on Netlify Free with 0 functions.
- **One new static asset** (~1200×630 PNG, same-origin, under `app/public/`). `app/public/` does not
  exist today and is created by this work.
- **Route count unchanged at ~1,406.** No route-manifest change, no bijection-test change.
- **`sitemap.xml` and `robots.txt`** ship as Next 16 static metadata routes, generated at build under
  `output: 'export'`. Note `trailingSlash: true` — every emitted URL must carry the trailing slash or
  the sitemap disagrees with what the host serves.
- **Ledger:** L525 (heatmap) and L4071 (`/compare` unpaired codes) have re-open triggers conditioned
  on per-locale URLs / a reopened contract. **This ruling does not fire either.** Both stay deferred.

---

## 3. Recommended Approach — RULED

**Path: Direct Adjustment.** No rollback. No MVP change. One new epic.

### 3.1 D20 — THE RULING (Juan, 2026-08-26)

> **UPHOLD D17. ES stays canonical for `<title>` and OG. Fix the landing instead.**

Locale-varying share previews are **not implementable** on a static export, and the two ways to buy
them are both refused:

- **Option 2 (per-locale URLs + hreflang)** — the standard answer, and genuinely correct for a
  prose site. **Refused on evidence, not on effort.** F3 measures the prize at one or two words per
  preview. The price is ~1,406 additional routes, every internal link, the route manifest, the
  route-bijection tests, and the collapse of the `t()`-at-`DEFAULT_LOCALE` server model that all 40
  shipped stories are built on. It also fires ledger L525 and L4071. The pages' indexable text is
  overwhelmingly proper nouns and numerals; an EN duplicate of a numeric table is near-duplicate
  content, so the index gain is not merely small — it is **uncertain in sign**.
- **Option 3 (Netlify Edge Function)** — refused. It breaks AD-13, NFR-8 and NFR-9, and `netlify.toml`
  states the no-functions property in its first four lines. Trading the project's $0 property for two
  translated words is not a trade.

**What is taken instead: everything that is actually reachable.** The full §6.3 bundle, plus the two
corrections the retrospective did not have (F1, F2), plus the fix for the real defect (F4).

### 3.2 D20-b — Option 2 is deferred against evidence, not against "someday"

Per-locale URLs are **not** ruled WONTFIX. They are deferred with a **falsifiable trigger**:

> **Revisit Option 2 when Google Search Console shows either (a) material impression volume on
> English-language queries, or (b) language-targeting confusion on the ES-canonical routes.
> Re-open no earlier than 90 days of collected data (≈ 2026-11-24).**

This is why `sitemap.xml` + Search Console are in scope now: **they are the instrument that makes the
trigger measurable.** Without them the deferral would be indefinite by construction.

### 3.3 The accepted consequence, recorded rather than discovered later

`navigator.language` detection and ES-canonical interact **at the crawler**, and the interaction is
accepted with its eyes open:

Googlebot renders JavaScript with `navigator.language` typically `en-US`. It will therefore see the
pre-paint script flip `<html lang>` to `en` and swap the body strings, while `<title>` / OG — emitted
by `generateMetadata` at build and never touched by the script — stay Spanish. **That is a
mixed-language rendered document**, which is precisely the failure mode Story 2.19 Task 9.3 set out
to disprove, reappearing at index time.

**Accepted, for three reasons:** (1) it is already the shipped behaviour whenever a reader toggles
to EN — detection only makes it automatic; (2) Google's initial non-rendered fetch sees `lang="es"`
plus the new explicit `<link rel="canonical">`, which is the strongest signal available to a static
site; (3) if it does cause harm, **that harm is exactly trigger (b) in §3.2** and re-opens Option 2
on evidence. The failure mode and the instrument that would detect it are the same mechanism.

### 3.4 Effort, risk, timeline

| | |
|---|---|
| **Effort** | **Low–Medium.** One epic, 4–5 stories. No data work, no contract work, no visual redesign. |
| **Risk** | **Low.** Additive only. The one genuine trap (F2) is identified, empirically reproduced, and sequenced first. |
| **Timeline** | Does not block the rest of Epic 3 (the signature, the home refactor, the nav menu) — those proceed in parallel. |
| **MVP impact** | **None.** MVP shipped. This is post-launch reach work. |

---

## 4. Detailed Change Proposals

### 4.1 Architecture — AR-11 / AD-11 scoping clarification

**File:** `_bmad-output/planning-artifacts/epics.md:92`

**OLD**

> - AR-11 (AD-11): Rendering split — build-time filesystem reads (`generateStaticParams` from the
>   route manifest) for static params, `<title>`/OG meta, and pre-rendered Hero content from
>   `storyStats`; client fetch for everything below the Hero; no inlining full bundles;
>   `output: 'export'`, `images: { unoptimized: true }`; fonts (Archivo + Inter) self-hosted via
>   `next/font`, zero external requests.

**NEW** — append one sentence:

> …fonts (Archivo + Inter) self-hosted via `next/font`, zero external requests. **The "zero external
> requests" clause scopes to THIRD-PARTY ORIGINS, not to assets as such: same-origin static assets
> under the export are in bounds, and a URL in a `<meta>` tag (`og:image`, `twitter:image`) is not a
> request the page makes at all — it is a hint a crawler may fetch, off-page and off-session. The
> mechanical enforcement is `app/scripts/assert-no-external-origins.mjs`, whose `FETCHING_POSITIONS`
> list is the operative definition of "a request".**

**Rationale:** F1. Retires a comment-level ban that never had architectural backing and that costs
every share preview on the site its card. Makes the *mechanical* gate the authority, so the next
reader cannot re-derive the ban from prose.

---

**File:** `_bmad-output/planning-artifacts/architecture/architecture-wc-stats-2026-07-21/ARCHITECTURE-SPINE.md:110` (AD-11 rule text)

Same clarifying sentence appended after "…self-hosted via `next/font`, zero external requests."

---

### 4.2 PRD / NFR-4 — extend to cover the SEO surface

**File:** `_bmad-output/planning-artifacts/epics.md` (NonFunctional Requirements, NFR-4)

**OLD**

> NFR-4: Shareability — stable, human-readable URLs for every match, player, team; meaningful
> `<title>`/OG meta for link previews.

**NEW**

> NFR-4: Shareability & discoverability — stable, human-readable URLs for every match, player, team;
> meaningful `<title>`/OG meta for link previews; **absolute canonical URLs from a configured
> `metadataBase`; a same-origin `og:image` card and a `summary_large_image` Twitter card;
> `sitemap.xml` and `robots.txt` emitted at build. Metadata is emitted ONCE PER ROUTE in the
> canonical locale (Spanish) — a static export yields one document per URL, and per-locale metadata
> is not reachable without per-locale URLs (D17, D20).**

**Rationale:** the ES-canonical property has been folklore carried in story files since 2.12 took it
de facto for `/`. It is now a stated NFR, so the next person asking "why is the preview Spanish?"
finds the answer in the requirements rather than in a ledger entry.

---

### 4.3 ⚠️ Build gate — teach `assert-no-external-origins` the site's own origin

**File:** `app/scripts/assert-no-external-origins.mjs`

**This is the prerequisite. Nothing else in §4 can land before it.**

**OLD**

```js
const ALLOWED = [/^https?:\/\/(www\.)?w3\.org\//i, /^https?:\/\/(www\.)?schema\.org\//i];
```

**NEW** (shape; the story owns the exact code)

```js
/*
 * THE SITE'S OWN ORIGIN IS NOT AN EXTERNAL ORIGIN. Absolute self-referencing
 * URLs are what `metadataBase` exists to emit: <link rel="canonical">,
 * og:url, og:image, the sitemap's <loc> entries. Every one is same-origin by
 * construction, and the gate used to fail the build on all ~1,406 of them —
 * while passing og:image, which is the one tag that genuinely causes a third
 * party to fetch an asset. Verified before this fix, on a fixture.
 *
 * Kept in ONE place and shared with the app's metadataBase, so the gate and
 * the emitted URLs can never disagree.
 */
const SITE_ORIGIN = "https://mundial-stats.juancr.dev";
const ALLOWED = [
  /^https?:\/\/(www\.)?w3\.org\//i,
  /^https?:\/\/(www\.)?schema\.org\//i,
  new RegExp(`^${escapeRegExp(SITE_ORIGIN)}(/|$)`, "i"),
];
```

**Plus** — `<link href>` must stop treating navigation hints as fetches:

```js
/*
 * `rel="canonical"` / `rel="alternate"` are NAVIGATION HINTS, exactly like the
 * <a href> this file already excludes for the same reason: "a link is a
 * navigation the reader chooses, not a fetch the page performs". Only the
 * fetching rel values (stylesheet, preload, prefetch, icon, manifest,
 * preconnect, dns-prefetch, modulepreload) belong in FETCHING_POSITIONS.
 */
```

**Two conditions the story must satisfy, or the fix is a hole rather than a fix:**

1. **A negative test.** A fixture carrying an off-origin `<link rel="stylesheet">` and an off-origin
   `og:image` must still fail. A gate that stopped failing has proved nothing — this file's own
   header makes that argument twice, and the `scanned === 0` guard exists for it.
2. **`SITE_ORIGIN` has exactly one definition** shared with `metadataBase`. Two copies drift, and the
   drift is silent in exactly the direction that matters.

**Rationale:** F2, empirically reproduced. Without this, the first canonical-URL commit red-builds
Netlify on every page with an error message that blames AR-11.

---

### 4.4 i18n lint gate — close the `alt` / `siteName` hole before `og:image` opens it

**File:** `app/eslint.config.mjs:160`

**OLD**

```
Property[key.name=/^(title|description|default|template|absolute)$/]
```

**NEW**

```
Property[key.name=/^(title|description|default|template|absolute|alt|siteName)$/]
```

**Rationale:** an `og:image` card carries `alt` text, and `openGraph.siteName` is a metadata string.
Neither key is gated today, so both would ship as bare Spanish literals **and the build would stay
green** — the exact "tests that passed for the wrong reason" class the retrospective logged four
instances of (§3.3). Closing the hole *before* the story that would fall into it is cheaper than
after. Note `alt` already appears in the JSX-attribute regexes; this adds it to the metadata-object
selector, which is a different AST path.

---

### 4.5 `bootstrap.ts` — first-visit locale detection

**File:** `app/src/lib/bootstrap.ts`

**OLD**

```ts
/** Persisted valid locale → it; anything else → canonical es. */
export function resolveLocale(stored: string | null): Locale {
  if (stored === "es" || stored === "en") {
    return stored;
  }
  return "es";
}
```

**NEW** (shape)

```ts
/**
 * Persisted override → navigator.language → canonical es (AD-12, D20).
 *
 * `preferred` is the browser's language tag or null when unavailable. Only the
 * PRIMARY SUBTAG is read: "en-GB", "en-US" and "en" all resolve to en, and
 * anything that is not Spanish or English falls to the canonical es — this is a
 * two-locale product, and a French reader gets the canonical, not a guess.
 */
export function resolveLocale(stored: string | null, preferred: string | null): Locale {
  if (stored === "es" || stored === "en") {
    return stored;
  }
  const primary = preferred === null ? null : preferred.toLowerCase().split("-")[0];
  if (primary === "en") {
    return "en";
  }
  return "es";
}
```

**Four constraints the story carries — each one is a defect if missed:**

1. **BOTH call sites, or they disagree.** The change lands in the pure function *and* in the
   checked-in `bootstrapScript` ES5 literal. `bootstrap.test.ts` already cross-checks the literal
   against the functions over the full input matrix — the matrix gains a `navigator.language`
   dimension, and that test is what stops the two drifting.
2. **`i18n-provider.tsx` must be updated too.** Its mount effect currently does
   `if (stored === null) return;` — with detection in the script but not the provider, React would
   re-render Spanish strings under an `<html lang="en">` the script had already set. The effect must
   fall through to the same `resolveLocale(null, navigator.language)`.
3. **A DETECTED locale is NEVER persisted.** Only an explicit toggle writes `wcstats.locale`.
   Persisting a guess would make it indistinguishable from a choice and would silently outlive a
   change of browser language.
4. **Detection is not an announcement.** The provider's existing rule — "restoring a persisted
   preference is not a user action: no announcement, no re-persist" — extends to detection. The live
   region stays silent.

**Rationale:** F4. This is the highest-value item in the whole change: it is what an English-speaking
recipient of a shared link actually experiences, and it is currently 100% wrong for 100% of them.

---

### 4.6 Metadata — `metadataBase`, canonical URLs, `og:image`, Twitter card

**Files:** `app/src/app/layout.tsx`, and the four `generateMetadata` sites
(`/`, `/matches/[slug]`, `/players/[slug]`, `/teams/[slug]`)

- `metadataBase: new URL(SITE_ORIGIN)` on the root layout, from the single shared constant (§4.3).
- `alternates: { canonical: ... }` per route. **`trailingSlash: true` is set in `next.config.ts`** —
  canonical URLs must carry the trailing slash or they disagree with what Netlify serves.
- `openGraph.images` → one same-origin card under `app/public/` (which does not exist yet).
  `openGraph.type`, `openGraph.locale: "es"` — an explicit declaration of the D20 canonical.
- `twitter: { card: "summary_large_image" }`.
- Alt text and `siteName` through `t()`, per §4.4.

**Test changes** (F1 — the two assertions are retired and *replaced*, never merely deleted):

```
app/src/app/players/static-output.test.ts:125-126
app/src/app/teams/static-output.test.ts:139-140

OLD:  it("emits NO og:image (AR-11 permits zero external or asset requests)")
NEW:  it("emits a SAME-ORIGIN og:image — AR-11 scopes to third-party origins (D20)")
      → assert og:image is present AND starts with SITE_ORIGIN
```

**The replacement is not optional.** Deleting the assertions would leave the same-origin property
unasserted, and an off-origin `og:image` would then ship green — the gate in §4.3 does not catch it,
because `<meta content>` is correctly not a fetching position. **The test is the only thing that
holds that line.** Four source comments are corrected to match.

---

### 4.7 `sitemap.xml` + `robots.txt`

**New files:** `app/src/app/sitemap.ts`, `app/src/app/robots.ts` (Next 16 static metadata routes,
generated at build under `output: 'export'`).

- Enumerated from **the route manifest** (`data/index/tournament.json` `entities`), which is the same
  source `generateStaticParams` uses — so the sitemap cannot drift from the built routes.
- ~1,406 URLs: 104 matches + 1,248 players + 48 teams + `/`, `/about`, `/glossary`, `/compare`.
- Trailing slashes on every entry (see §4.6).
- `/compare`'s parameterized variants are **excluded** — the bare route only. Its content is
  selection-dependent and query-driven; indexing permutations would be near-duplicate noise.
- `robots.txt` references the sitemap absolutely.
- **The story should assert sitemap-to-manifest bijection**, reusing the existing route-bijection
  pattern. A sitemap listing a URL that 404s is worse than no sitemap.
- **`.xml` is already in the gate's `SCANNED_EXTENSIONS`** — added by the 2.19 code review with a
  sitemap named as the motivating case. §4.3 is what lets it pass.

---

### 4.8 Ledger — file the successors

**File:** `_bmad-output/implementation-artifacts/deferred-work.md` — append a new block:

```markdown
## Filed by the SEO / locale ruling (sprint-change-proposal-2026-08-26)

- **D20 RULED (Juan, 2026-08-26): ES canonical for <title>/OG STANDS.** Upholds D17. Locale-varying
  share previews are not implementable on a static export: crawlers have no user, no geo and no JS,
  and one URL yields one document. Per-locale URLs are DEFERRED AGAINST EVIDENCE, not WONTFIX —
  re-open when Search Console shows material EN query volume or ES language-targeting confusion,
  no earlier than 2026-11-24 (90 days of data). **The sitemap shipped in Epic 3 is the instrument
  that makes this trigger measurable.** L147 / L2697 / L3227 stay CLOSED-ACCEPTED per D17.

- **D20-c: the AR-11 og:image ban is RETIRED as an over-read.** AR-11 scopes "zero external requests"
  to third-party origins and fonts; a same-origin og:image is not a request the page makes. Confirmed
  against assert-no-external-origins.mjs, whose FETCHING_POSITIONS list deliberately excludes
  <meta content>. AR-11 and AD-11 amended. 2 assertions REPLACED (not deleted) with a same-origin
  assertion; 4 comments corrected.

- **NOT FIRED by this ruling: L525 (heatmap) and L4071 (/compare unpaired codes).** Both name a
  reopened /contract or per-locale URLs as their trigger. D20 takes neither. Both stay deferred,
  unchanged.

- **ACCEPTED CONSEQUENCE of first-visit detection (D20, §3.3):** Googlebot renders with
  navigator.language = en-US, so the indexed DOM may be English while <title>/OG stay Spanish — a
  mixed-language rendered document. Accepted: it is already the shipped behaviour under a manual
  toggle, the pre-render and <link rel="canonical"> both declare es, and if it causes harm that harm
  IS re-open trigger (b) above.
```

---

### 4.9 `sprint-status.yaml` — register Epic 3

Add an Epic 3 entry with status `backlog` and its stories as `backlog`, and append a
`SEQUENCING PLAN` note:

```
# - Epic 3's SEO stories are gated on the build-gate fix (story 3-1). The shipped
#   assert-no-external-origins.mjs FAILS on the site's own absolute <link href>,
#   so metadataBase + canonical URLs red-build Netlify on ~1,406 pages until 3-1
#   lands. Verified empirically 2026-08-26; see sprint-change-proposal-2026-08-26 F2.
# - Epic 3's SEO track is INDEPENDENT of its home-refactor / nav-menu track and the
#   signature. They may run in parallel; only the SEO track has the 3-1 prerequisite.
```

---

## 5. Implementation Handoff

**Scope classification: Moderate** — backlog reorganization (a new epic), no fundamental replan.

### 5.1 Routing

| Recipient | Responsibility |
|---|---|
| **Developer (this workflow)** | Apply §4.1, §4.2, §4.8, §4.9 — the artifact edits. Done in this commit. |
| **`bmad-create-epics-and-stories`** | Write Epic 3 from §5.2, adopting ledger L1553/L1886 and L1465 explicitly (retro §6.1). |
| **`bmad-ux`** | Home refactor + nav menu, carrying the retro §6.4 guard (free to reshape, not free to regress below the Hub baseline of 68; re-measure per D4). **Independent of the SEO track.** |
| **`bmad-dev-story`** | Implement §4.3–§4.7 in the order below. |

### 5.2 Proposed Epic 3 SEO story shape

| # | Story | Depends on | Note |
|---|---|---|---|
| **3-1** | **Build-gate & lint-gate correction** — §4.3 + §4.4 | — | **PREREQUISITE. Nothing below builds without it.** Ships the negative test. |
| 3-2 | `metadataBase`, absolute canonical URLs, `og:url` — §4.6 (part) | 3-1 | Shared `SITE_ORIGIN`, one definition |
| 3-3 | `og:image` card + Twitter card — §4.6 (part) | 3-1, 3-2 | Retires the ban; **replaces** the 2 assertions; creates `app/public/` |
| 3-4 | `sitemap.xml` + `robots.txt` — §4.7 | 3-1, 3-2 | Manifest-bijection assertion; submit to Search Console (starts the D20-b clock) |
| 3-5 | First-visit locale detection — §4.5 | — | **Independent of 3-1.** Can run first or in parallel; highest user value |

### 5.3 Success criteria

1. `npm run build` green end-to-end, including `assert-no-external-origins`, with ~1,406 canonical
   URLs emitted — **and still red on a fixture carrying an off-origin `<link rel="stylesheet">`.**
2. A `mundial-stats.juancr.dev` link pasted into WhatsApp and Slack renders **a card with an image**.
3. `sitemap.xml` bijects with the route manifest; submitted to Search Console.
4. Netlify deploy: **0 functions, $0/month** — AD-13 / NFR-8 / NFR-9 re-verified, not assumed.
5. A browser with `navigator.language = en-US` and empty `localStorage` lands on **English**, and
   `wcstats.locale` is **still unset** afterwards.
6. Lighthouse SEO stays 100; performance does not regress below the recorded per-route baselines
   (D4: median of 3, mobile, host-realistic server).

### 5.4 What this proposal deliberately does NOT do

- Does not reopen D17, the contract, or `schemaVersion`.
- Does not change the route count, the route manifest, or the bijection tests.
- Does not fire L525 or L4071.
- Does not touch `netlify.toml`, and adds no function, middleware or env-dependent behaviour.
- Does not translate `<title>`/OG. **That is the ruling, not an omission.**

---

## Appendix — Change Navigation Checklist record

| § | Item | Status |
|---|---|---|
| 1.1 | Triggering story identified | [x] Story 2.19 (D17) + retro §6.2 |
| 1.2 | Core problem defined | [x] New requirement vs. shipped architectural constraint |
| 1.3 | Evidence gathered | [x] F1–F4, all verified against the tree; F2 empirically reproduced |
| 2.1 | Current epic completable | [x] Epic 2 closed, unaffected |
| 2.2 | Epic-level changes | [x] New Epic 3 defined |
| 2.3 | Remaining epics reviewed | [x] Epic 1 unaffected; `/contract` untouched |
| 2.4 | Invalidates / necessitates epics | [x] Necessitates Epic 3; invalidates none |
| 2.5 | Order / priority | [x] SEO track gated on 3-1; independent of home-refactor track |
| 3.1 | PRD conflicts | [x] NFR-4 extended; MVP unaffected |
| 3.2 | Architecture conflicts | [x] AR-11 / AD-11 clarified; AD-13 untouched |
| 3.3 | UI/UX conflicts | [N/A] No visual surface change |
| 3.4 | Other artifacts | [!] **Build gate + lint gate both need correction before any SEO work — §4.3, §4.4** |
| 4.1 | Option 1 — Direct Adjustment | [x] **Viable — SELECTED.** Effort Low–Medium, Risk Low |
| 4.2 | Option 2 — Rollback | [x] Not viable — nothing to roll back; D17 upheld |
| 4.3 | Option 3 — MVP review | [x] Not viable — MVP shipped; post-launch reach work |
| 4.4 | Path selected | [x] Direct Adjustment; rationale §3.1 |
| 5.1–5.5 | Proposal components | [x] §1–§5 |
| 6.1–6.3 | Review & approval | [x] Approved by Juan, 2026-08-26 |
| 6.4 | `sprint-status.yaml` updated | [x] §4.9 |
| 6.5 | Handoff confirmed | [x] §5.1 |

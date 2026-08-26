---
title: 'Sign the project — an authorship caption in the header and the footer'
type: 'feature'
created: '2026-08-26'
status: 'done'
baseline_commit: 'd28e56f9968bab033ea581d68202e62fcb657f6f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The site carries a data-provenance line ("Independent site, not affiliated with FIFA") but no authorship line. Nothing on any of the 1,406 exported routes says who built it.

**Approach:** Add one new locale string — an authorship caption — and render it in exactly two places in the shared chrome: directly under the wordmark in `SiteHeader`, and as a second caption line in `AttributionFooter`. One key, two call sites; no new component, no new route.

## Boundaries & Constraints

**Always:**
- The personal name renders **byte-identically in both locales**. Only the connective is translated (`Por` / `By`).
- `es.ts` is the canonical dictionary; `en.ts` is a typed mirror. Both change in the same edit.
- `SiteHeader`'s reflow guard needle — the literal class string `flex min-h-14 max-w-6xl flex-wrap items-center` — survives verbatim (`reflow-guards.test.ts` pins it; Story 2.19 R2/D8).
- The wordmark `<Link>` keeps a ≥44 px hit box (`min-h-11`, UX-DR15 / MIN_HIT_PX).
- The footer's `/about` and `/glossary` links keep `underline underline-offset-2 hover:no-underline` exactly (WCAG 1.4.1, axe `link-in-text-block`, Story 2.19 Task 6.8).
- Verified at 320 and 390 CSS px, both locales, both themes, before the work is called done.

**Ask First:**
- Any change to the ruled `chrome.footer.attribution` copy, or to the order of the header's four elements (wordmark → search → ES|EN → theme, AC 1 of Story 2.2).
- Any relaxation of an existing test assertion to make it pass.

**Never:**
- Do **not** put the caption inside the wordmark `<Link>`. The home link's accessible name stays `WC Stats`; authorship is not a link purpose.
- Do **not** mark the name with `lang`. WCAG 3.1.2 exempts proper names, and Story 2.19 Task 6.13's precedent is that a `lang` mark must assert a language change that actually occurs.
- Do not add the caption to `/about`, to `<title>`/OG metadata, or to any third surface.
- Do not add a `grid` container without `grid-cols-*` (repo-wide reflow scan).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| EN locale | `locale === "en"` | Header and footer both read `By Juan Camilo Rojas` | N/A |
| ES locale | `locale === "es"` | Header and footer both read `Por Juan Camilo Rojas` | N/A |
| Name invariance | either locale | The substring `Juan Camilo Rojas` is identical across `es` and `en` | Test fails if a locale mutates the name |
| 320 px viewport | narrowest ruled width | Header still fits; no horizontal document scroll; wordmark text not truncated | Reflow guard + browser matrix |
| 195 px layout viewport | 390 px device @ 200% zoom | Header wraps to more rows rather than overflowing (existing `flex-wrap` behaviour) | Manual measurement |

</frozen-after-approval>

## Code Map

- `app/src/locales/es.ts` -- canonical dictionary. `chrome` namespace holds `skipLink`, `languageToggle`, `themeToggle`, `footer`.
- `app/src/locales/en.ts` -- typed mirror (`Dictionary` derives from `es`); a missing or extra key is a compile error.
- `app/src/components/SiteHeader.tsx` -- the wordmark `<Link>` is the first flex child of the guarded header row.
- `app/src/components/AttributionFooter.tsx` -- one `<p class="type-caption text-ink-secondary">` carrying the attribution plus two persistently-underlined links.
- `app/src/lib/i18n.test.ts` -- the caption inventory here counts **rendered `<table><caption>` elements** (28/4/6/8), not `type-caption` strings. A `chrome.signature` key renders no `<caption>`, so those literals are expected to stay correct — confirm by running, and do not raise a pin for a caption that does not render.
- `app/src/lib/reflow-guards.test.ts` -- source-level guard on `SiteHeader`'s class string.
- `app/src/app/static-output.test.ts` -- reads `out/`; `INDEX_HTML`, `NOT_FOUND_HTML`, `ABOUT_HTML`, `GLOSSARY_HTML` helpers already defined.

## Tasks & Acceptance

**Execution:**
- [x] `app/src/locales/es.ts` -- add `chrome.signature: "Por Juan Camilo Rojas"` after `skipLink`, with a comment stating the name is not translated and why no `lang` mark -- canonical dictionary changes first.
- [x] `app/src/locales/en.ts` -- add the mirrored `chrome.signature: "By Juan Camilo Rojas"` -- typed mirror; omission is a build error.
- [x] `app/src/components/SiteHeader.tsx` -- wrap the wordmark `<Link>` and a new `type-caption text-ink-secondary` `<span>` in a `flex flex-col` block; the `<Link>` keeps `min-h-11` and its accessible name -- caption sits under the title without joining the link.
- [x] `app/src/components/AttributionFooter.tsx` -- add a second `<p class="type-caption text-ink-secondary">` carrying the signature, after the attribution paragraph; touch no existing class -- sign-off reads last, underlines untouched.
- [x] `app/src/lib/i18n.test.ts` -- add one case pinning the name's cross-locale byte-identity and the two connectives -- this is the property "my name is not translated", made testable.
- [x] `app/src/app/static-output.test.ts` -- add one case asserting the signature appears inside both the `<header>` and the `<footer>` slice of an exported document -- proves two render sites, not one string somewhere on the page.

**Acceptance Criteria:**
- Given any exported route in either locale, when the document is inspected, then the signature appears once within `<header>` and once within `<footer>`.
- Given the ES and EN dictionaries, when `chrome.signature` is compared, then both contain `Juan Camilo Rojas` verbatim and differ only in the connective.
- Given a 320 px and a 390 px viewport in both locales and both themes, when the header is rendered, then the document does not scroll horizontally and the wordmark is not truncated.
- Given `npm run build` (lint, typecheck, schema, export, origin gate) and `npx vitest run`, when both complete, then all gates are green and no test is newly skipped.

## Design Notes

**Why the caption is a sibling of the link, not its child.** Putting it inside `<Link href="/">` makes the home link announce "WC Stats By Juan Camilo Rojas, link" as the first focusable element on every page. An `aria-label` narrowing it back to "WC Stats" would then fail WCAG 2.5.3 (Label in Name), since the accessible name must contain the visible text. A sibling `<span>` avoids both.

**Header height — MEASURED, and the prediction was half wrong.** The predicted +5 px holds at one-row widths. Below the wrap threshold the row becomes two rows, which the plan did not anticipate: flexbox breaks lines on each item's max-content, and the caption widens the identity block 76 → 127 px (`es`; 122 in `en`). `min-w-0` cannot buy that back — it reduces the shrunk size, not the hypothetical main size line-breaking uses. No CSS arrangement avoids it without hiding, truncating or wrapping the name.

| width | header before | after | document scrollWidth |
|---|---|---|---|
| 195 (matrix) | 107 | 124 (+17, already wrapped) | 195 — no overflow |
| 320 (matrix) | 57 | 118 (wraps, two rows) | 320 — no overflow |
| 390 (matrix) | 57 | 62 (+5) | 390 — no overflow |
| 412 / 768 / 1440 / 1920 (spot) | 57 | 62 (+5) | no overflow |

**The wrap threshold is locale-dependent** (1 px sweep per locale): `es` wraps at ≤341 px, `en` at ≤337 px. An earlier draft of this spec and of both code comments said "354" — that was measured on an iframe whose 15 px scrollbar made the layout viewport narrower than the nominal width, and it wrongly implied a single locale-independent number. Corrected everywhere; provenance of each figure is now stated at the point of use.

**Document overflow is 0 of 96 cells** (320/390/195 × dark/light × es/en × 8 routes), so WCAG 1.4.10 — the property R2/D8 actually fixed — is untouched. Only height moved. Juan ruled the wrap in: the signature stays visible at every width rather than hidden on small phones. `reflow-guards.test.ts`'s `because` text and `SiteHeader`'s docblock carry these numbers, as that guard's own failure message requires, plus a new guard pinning the identity block itself.

**Shared-contract consequence — filed, not fixed here (Juan's call).** The 56 px header is encoded in `globals.css`'s `scroll-padding-top: 4.5rem` (whose comment says "change h-14 and this must follow") and in three `CompareChartsSection` offsets. Measured: `/compare`'s ruled mini-header is entirely behind the header at 320 px and clipped 6 px at 390 px; a wrapped bar hides an anchored heading by 46 px. Filed in `deferred-work.md` with the proposed `--header-h` fix; both files carry a pointer.

**Review outcome.** Two adversarial reviewers returned 26 findings, 14 distinct after dedup, 13 applied as patches. The most serious was mine: the footer-underline assertion was **vacuous** — `/\bunderline\b/` matches `hover:no-underline`, so the WCAG 1.4.1 regression it guarded would have passed. Now exact class-token equality, mutation-tested. A jsdom render test (`SiteSignature.test.tsx`) was added because the 2.5.3 sibling ruling lived only inside `describe.skipIf(!anyBuilt)` — unenforced on a clean clone — and because the `en` render path was verified nowhere (the export is Spanish-only). Both new guards were mutation-tested and do fail when the property breaks.

## Verification

**Commands:**
- `npm run build` (in `app/`) -- expected: lint, typecheck, schema gate, `next build`, `copy-data`, origin gate all exit 0.
- `npx vitest run` (in `app/`) -- expected: full suite green, route count 1,406, **0 skipped**.

**Manual checks (if no CLI):**
- Serve `app/out/` and load the export in an iframe at 320 px and 390 px width (the browser window itself cannot be resized in this environment). For each of ES/EN × dark/light: header shows the caption under the wordmark, footer shows it as its own line, `document.scrollWidth` does not exceed the viewport width, and the footer's two links remain underlined without hover.

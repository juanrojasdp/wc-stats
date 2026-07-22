# Review — Web-Verification Lens (reality-check of committed decisions)

- **Target:** `ARCHITECTURE-SPINE.md` (architecture-wc-stats-2026-07-21)
- **Lens:** every committed decision verified against the live web rather than asserted from training data
- **Reviewed:** 2026-07-21, independent WebSearch spot-checks of the Stack table's "Verified current 2026-07-21" claim and the mechanisms that lean on those pins

## Summary

The version pins themselves are largely real and current (Next 16.2.x, React 19.2, Tailwind 4.3.x, shadcn CLI v4, recharts 3.10.x, pymupdf 1.28, pdfplumber 0.11 all check out). The problems are in the *mechanisms and platform defaults the spine leans on*: two committed enforcement/cost claims (AD-12's "ESLint fails the build", AD-13's "no per-month cost" on Netlify) rest on defaults that changed in 2025–2026, and one committed tooling pairing (AD-2's `json-schema-to-typescript` + draft 2020-12) was never verified and is likely a mismatch.

## Findings

### CRITICAL

None. Nothing found invalidates the two-system paradigm or forces a re-architecture.

### HIGH

**H-1. AD-2: `json-schema-to-typescript` + JSON Schema draft 2020-12 is an unverified — and likely broken — pairing.**
The package's last publish (15.0.4) was roughly a year ago and its README declares no draft-2019-09/2020-12 support: it is draft-04-lineage, supports `$defs` but makes no mention of `prefixItems`, and lists many keywords as "not expressible" (`oneOf` as xor, `pattern`, `not`, `dependencies`, etc.). AD-2 commits both "draft 2020-12" and this generator in the same rule without a reality check, and the whole exact-version build gate hangs off the generated types.
Evidence: https://github.com/bcherny/json-schema-to-typescript (README, "not expressible" list; `$defs` option), https://www.npmjs.com/package/json-schema-to-typescript ("last published a year ago").
Fix: either (a) constrain `/contract` schemas to the draft-07-compatible subset of 2020-12 (allow `$defs`; ban `prefixItems`, `unevaluatedProperties`, `dependentSchemas`) and record that constraint in AD-2, or (b) swap the generator — `json-schema-to-ts` (actively maintained, type-level inference) or `quicktype` — after a one-schema spike proves round-trip fidelity. Do the spike before the contract epic starts; this is the only interface in the system.

**H-2. AD-12: "ESLint ... fails the build" is no longer a Next.js default — Next 16 removed lint from `next build` entirely.**
Next 16 removed the `next lint` command, removed the `eslint` key from `next.config`, and `next build` no longer runs linting at all. As written, AD-12's mechanical i18n gate (FR-30) silently never fires on Netlify, whose build (AD-13) runs only `next build`.
Evidence: https://nextjs.org/docs/app/guides/upgrading/version-16 (next lint removed, build no longer lints), https://nextjs.org/blog/next-15-5 (deprecation announcement).
Fix: amend AD-12/AD-13 to make the gate explicit: Netlify build command must be `eslint . --max-warnings 0 && next build` (or an equivalent `npm run build` script chaining lint before build), with ESLint 9 flat config invoked directly. The rule mechanics themselves are fine — `react/jsx-no-literals` exists in eslint-plugin-react and supports `noStrings`, `noAttributeStrings`, and `restrictedAttributes` (see M-2).

**H-3. AD-13 / Deferred: Netlify's free tier is no longer the 100GB-bandwidth plan for new accounts — it moved to a 300-credits/month system (~15GB effective at 20 credits/GB), and the spine's "no per-month cost" posture was not re-checked against it.**
Netlify replaced fixed free-tier allowances (100GB bandwidth / 300 build minutes) with a credit pool for accounts created after ~Sep 2025; bandwidth now draws 20 credits/GB and web requests also consume credits. Only legacy accounts keep 100GB. The spine's deferred item even says "revisit only if Netlify's own bandwidth dashboard says otherwise" — that dashboard is now a credits dashboard. Deploy previews do still exist on the free tier, and static-only publish remains supported, so the deployment shape survives — but the capacity assumption behind "$0 structural" is stale.
Evidence: https://temps.sh/compare/vs-netlify (300 credits, ~15GB, 20 credits/GB), https://agentdeals.dev/vendor/netlify (legacy 100GB vs new credits), https://www.luckymedia.dev/insights/netlify.
Fix: check which account model the deploy account is on; if credit-based, re-run the budget math (with 500KB-compressed match bundles, ~15GB/month is ≈30K full-bundle fetches — likely fine for MVP but it should be a stated number, not an assumption). Note Cloudflare Pages / GitHub Pages as the documented fallback if credits prove tight, since the app is pure static.

### MEDIUM

**M-1. Stack: TypeScript pinned at 5.9.x skips TypeScript 6.0, the designated bridge release — the "7.0 GA'd 2026-07-08" note is accurate but the conservative pin is now 6.0.x, not 5.9.x.**
TS 7.0 (Go-native) did GA on 2026-07-08, exactly as the spine's assumption note says — good verification there. But TypeScript 6.0 shipped 2026-03-23 as the final JavaScript-based release and the explicit bridge to 7.0 (deprecation flags, `ignoreDeprecations: "6.0"`). Pinning 5.9.x means adopting none of the deprecation signals and being two majors behind stable at project start.
Evidence: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/, https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/, https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx.
Fix: change the pin to `6.0.x` and reword the note: "7.0 (Go-native) GA'd 2026-07-08, too fresh; 6.0 is the bridge release — adopt it and keep deprecation warnings clean so the 7.0 move stays cheap."

**M-2. AD-12: the aria/title enforcement plan is realistic but over-engineered as written — `jsx-no-literals` itself covers attributes.**
`react/jsx-no-literals` supports `noAttributeStrings: true` and a `restrictedAttributes` array of attribute names, which directly covers `aria-*`/`title` without a hand-rolled `no-restricted-syntax` selector (which is brittle against JSXAttribute AST shapes and namespaced attributes). `no-restricted-syntax` is still legitimately needed for one gap: literals passed to non-JSX APIs (e.g. `document.title =`, metadata objects).
Evidence: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md (`noStrings`, `noAttributeStrings`, `restrictedAttributes`).
Fix: reword AD-12's mechanism to "`react/jsx-no-literals` with `noStrings` + `noAttributeStrings`/`restrictedAttributes` for aria/title; `no-restricted-syntax` only for metadata-object strings" — and pair with the H-2 fix so it actually gates the build.

**M-3. AD-11 / Stack: Next 16.2 static export is confirmed viable, but the spine omits the one config it forces — `images: { unoptimized: true }` (or a custom loader) if `next/image` is ever used.**
Verified: `output: 'export'` is fully supported in Next 16.x with the App Router; dynamic routes like `/matches/[slug]` require `generateStaticParams` (build fails without it — consistent with the spine's build-time path); `next/font` self-hosting is build-time and works under static export, matching AD-11's zero-external-requests rule. The default Image Optimization API, however, needs a server and is unavailable under export.
Evidence: https://nextjs.org/docs/app/guides/static-exports, https://github.com/vercel/next.js/issues/58171 (generateStaticParams required under export), https://github.com/vercel/next.js/discussions/60977 (images with output: 'export').
Fix: add one line to AD-11 or the conventions table: "`next.config`: `output: 'export'`, `images.unoptimized: true`; all imagery is static assets — no runtime image optimization exists under export."

### LOW

**L-1. Stack: recharts 3.10.x pin is days old.**
recharts 3.10.0 was published on/around 2026-07-20 (npm showed "15 hours ago" on 2026-07-21). The 3.x line is React-19-compatible (the 2.x-era `react-is` override problem was resolved by the 3.0 state rewrite), so the pairing is sound — but pinning a minor that shipped yesterday is the same "too fresh" risk the spine already flags for TS 7.
Evidence: https://www.npmjs.com/package/recharts, https://github.com/recharts/recharts/wiki/3.0-migration-guide, https://github.com/recharts/recharts/issues/4558.
Fix: pin `3.x` latest-stable-at-install (or `3.9.x` if 3.10 misbehaves) rather than committing the spine to a day-old minor.

**L-2. Verified-clean pins (recorded so the next reviewer doesn't re-litigate them).**
- Next.js 16.2.x exists; App Router static export supported (see M-3 sources).
- React 19.2 is what Next 16's `create-next-app` ships and what the App Router builds against. https://nextjs.org/blog/next-16, https://nextjs.org/docs/messages/react-version
- Tailwind CSS 4.3.x is real and current (4.3.0 on 2026-05-08; patches through 4.3.3). https://tailwindcss.com/blog/tailwindcss-v4-3, https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3
- shadcn CLI v4 is real (March 2026) and pairs with Tailwind v4 (v4 init support, `tw-animate-css`). https://ui.shadcn.com/docs/changelog/2026-03-cli-v4, https://ui.shadcn.com/docs/tailwind-v4
- pymupdf 1.28.x exists (wheels for Python 3.10–3.14 — covers "3.13+"). https://pymupdf.readthedocs.io/en/latest/changes.html, https://pypi.org/project/pymupdf/
- pdfplumber 0.11.x is current (0.11.10) and tested on Python 3.10–3.14. https://pypi.org/project/pdfplumber/
- Netlify deploy previews remain a free-tier feature (deployment-shape claim in the Structural Seed holds). https://www.luckymedia.dev/insights/netlify

**L-3. Stack table provenance: "sources in memlog" is not in the artifact set.**
The table claims verification with sources "in memlog", but no memlog is listed in the spine's `sources:` frontmatter or the planning-artifacts folder reachable from it, so the verification is unauditable from the artifact itself — which is how the H-1/H-3 gaps survived.
Fix: inline the source URL per pinned row (one column or a footnote list) in the Stack section.

## Verdict

Version pins are real; three leaned-on mechanisms were asserted, not verified (schema-codegen pairing, build-time lint gate, Netlify free-tier economics). Fixable with wording/config changes plus one codegen spike — no structural rework required.

import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

/*
 * The i18n gate (AD-12, AC #2): any hardcoded user-facing string is a build
 * error. Non-UI strings (keys, URLs, class names) stay legal — the gate is
 * jsx-no-literals plus targeted selectors, not a blanket no-strings rule.
 * `next build` never lints in Next 16; this config runs via
 * `eslint . --max-warnings 0`, the first link of the npm build chain (AR-13).
 */
export default defineConfig([
  // src/lib/contract/** is generated output (its /* eslint-disable */ banner
  // would otherwise count as an unused directive under --max-warnings 0).
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", "src/lib/contract/**"]),
  ...next,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      /*
       * Tuned from the story's starting point ({ ignoreProps: false,
       * noAttributeStrings: true }): checking ALL props flags className and
       * data-slot — non-UI strings the story requires to stay legal. Props are
       * instead gated by the no-restricted-syntax selectors below, which cover
       * exactly the user-facing attributes. jsx-no-literals still errors on
       * any literal JSX text or {'literal'} expression.
       */
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      /*
       * Gated attribute names, on ANY element — DOM attributes and custom
       * component props alike (<EmptyState message="..."> is gated the same
       * as aria-label). Beyond bare Literals the selectors also catch
       * template literals and string operands of concatenation/ternary/
       * logical expressions, which would otherwise bypass the gate.
       * t()/variable/function values stay legal.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip)$/] > Literal",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip)$/] JSXExpressionContainer > :matches(Literal, TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip)$/] JSXExpressionContainer :matches(BinaryExpression, LogicalExpression, ConditionalExpression) > :matches(Literal, TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        /*
         * OBJECT-SHAPED PROPS (Story 2.18 ruled decision 8). The three
         * selectors above match a Literal/TemplateLiteral that is a DIRECT
         * child of the JSXExpressionContainer — but recharts delivers text
         * through object-shaped props: `<YAxis label={{ value: "…" }} />` puts
         * the literal inside an ObjectExpression, so it passed the gate
         * silently. Filed by Story 2.6 in a story file and never promoted to
         * the ledger; two recharts surfaces ship today (2.6 MomentumChart, 2.10
         * TacticalCharts) and 2.13/2.15/2.16/2.17 will add more.
         *
         * TWO CONSTRAINTS, each of which exists because the looser form flags
         * correct code:
         *
         * 1. Scoped to the object's COPY-BEARING members (`value`, `children`).
         *    Gating every Property flags recharts' own positioning tokens —
         *    `label={{ value: t("…"), position: "insideLeft" }}` is correct
         *    code, and "insideLeft" is a layout keyword, not a user-facing
         *    string.
         * 2. Constrained to STRING literals via `raw`, because ESTree `Literal`
         *    includes numbers, booleans and null, and both shipped charts pass
         *    numeric `angle`, `position` and `offset` values.
         */
        /*
         * 3. Reached by :matches on key.name OR key.value, because a STRING
         *    key is a different AST shape: `label={{ value: "…" }}` has
         *    key.name === "value", but `label={{ "value": "…" }}` has no
         *    key.name at all — it has key.value. Keying only on the identifier
         *    form let the quoted spelling through silently (2.18 code review).
         *    A computed key (`label={{ [K]: "…" }}`) has neither and is not
         *    reachable by any static selector; it is not a shape this codebase
         *    writes, and the fixtures record that limit.
         */
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip)$/] JSXExpressionContainer ObjectExpression > Property:matches([key.name=/^(value|children)$/], [key.value=/^(value|children)$/]) > :matches(Literal[raw=/^[\"']/], TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        /*
         * The ternary/concatenation form of the same hole. The direct-child
         * combinator above stops at `value: "…"`, so
         * `label={{ value: loading ? t("x") : "Cargando…" }}` and
         * `label={{ value: t("x") + " (" + unit + ")" }}` both shipped clean.
         * This mirrors selector #3 in the plain-prop family. Still constrained
         * to STRING literals, so the numeric angle/offset values both shipped
         * charts pass inside `label={{…}}` stay legal.
         */
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-placeholder|aria-roledescription|aria-braillelabel|aria-valuetext|title|alt|placeholder|label|message|text|description|caption|heading|tooltip)$/] JSXExpressionContainer ObjectExpression > Property:matches([key.name=/^(value|children)$/], [key.value=/^(value|children)$/]) :matches(BinaryExpression, LogicalExpression, ConditionalExpression) > :matches(Literal[raw=/^[\"']/], TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        /*
         * `value` is NOT added to the shared name regex, deliberately: the
         * language toggle passes `value="es"` / `value="en"` to Radix
         * ToggleGroupItem as STATE TOKENS, both bare Literals directly under a
         * JSXAttribute[name.name="value"], and they would fail
         * `eslint --max-warnings 0` immediately. No scoping BY NAME can
         * separate a UI `value` from a form/state `value`, so recharts'
         * `<Label value="…" />` is reached by ELEMENT instead — the only
         * syntactically safe way to get at it.
         *
         * DIRECT-CHILD combinators, matching the three selectors above. A
         * descendant combinator here reaches into `value={t("app.siteName")}`
         * and flags the DICTIONARY KEY — turning the one correct way to write
         * the prop into a build error.
         */
        {
          selector:
            "JSXElement[openingElement.name.name=/^(Label|LabelList)$/] > JSXOpeningElement > JSXAttribute[name.name=\"value\"] > Literal[raw=/^[\"']/]",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            "JSXElement[openingElement.name.name=/^(Label|LabelList)$/] > JSXOpeningElement > JSXAttribute[name.name=\"value\"] > JSXExpressionContainer > :matches(Literal[raw=/^[\"']/], TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        /*
         * The ternary/concatenation form for the element-scoped `value`, and
         * the namespaced element spelling. Two gaps the first closure left
         * (2.18 code review):
         *
         * - `<Label value={cond ? t("x") : "hardcoded"} />` was unreachable:
         *   the direct-child combinator above stops at the ConditionalExpression,
         *   and the shared ternary selector deliberately excludes `value` from
         *   its name list (SiteHeader's ToggleGroupItem state tokens).
         * - `<Recharts.Label value="…" />` is a JSXMemberExpression, which has
         *   no `name.name` — matched here via `name.property.name`.
         *
         * NOT REACHABLE and deliberately so: an aliased import
         * (`import { Label as L }`) changes the identifier, and no static
         * selector can follow the binding. Recorded rather than papered over.
         */
        {
          selector:
            "JSXElement[openingElement.name.name=/^(Label|LabelList)$/] > JSXOpeningElement > JSXAttribute[name.name=\"value\"] JSXExpressionContainer :matches(BinaryExpression, LogicalExpression, ConditionalExpression) > :matches(Literal[raw=/^[\"']/], TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            "JSXElement[openingElement.name.property.name=/^(Label|LabelList)$/] > JSXOpeningElement > JSXAttribute[name.name=\"value\"] :matches(Literal[raw=/^[\"']/], TemplateLiteral)",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          // Covers `export const metadata = {...}` AND generateMetadata()
          // (Next's other first-class metadata path), including nested
          // title objects ({ default, template, absolute }).
          selector:
            ':matches(VariableDeclarator[id.name="metadata"], FunctionDeclaration[id.name="generateMetadata"], VariableDeclarator[id.name="generateMetadata"]) Property[key.name=/^(title|description|default|template|absolute)$/] > :matches(Literal, TemplateLiteral, BinaryExpression, LogicalExpression, ConditionalExpression)',
          message: "Metadata strings must come from the locale layer.",
        },
      ],
    },
  },
  {
    /*
     * Client-import seam (Story 2.2 Task 4): everything under src/components
     * is a client component (or composed by one) — importing the server-safe
     * t() there compiles, renders Spanish and silently ignores locale
     * switching. Components bind locale via useT()/useLocale() from
     * @/lib/i18n-provider; server components and src/app/** (metadata,
     * build-time-static text) keep direct t(). Type-only imports of
     * DictionaryKey/Locale are unaffected: only the `t` binding is barred.
     *
     * src/viz/** joins the seam with Story 2.7, which creates it: a new
     * top-level source directory that is not in this list silently escapes the
     * bar — the residual gap the 2.2 and 2.4 reviews filed. The viz modules are
     * pure and locale-free by design (they return dictionary KEYS, never
     * resolved strings), so the rule should never fire there; it is the guard
     * that keeps that design from eroding one convenient import at a time.
     */
    files: ["src/components/**/*.{ts,tsx}", "src/viz/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/i18n",
              importNames: ["t"],
              message:
                "Client components must bind locale via useT()/useLocale() from @/lib/i18n-provider; a direct t() import silently ignores locale switching.",
            },
            {
              // Build-time fs reader (Story 2.4): node:fs at module scope crashes
              // in the browser and inlining bundles violates AR-11. Server pages
              // read data; client components fetch via @/lib/data.
              name: "@/lib/build-data",
              message:
                "Client components must not import the build-time fs reader; fetch runtime data via fetchArtifact() from @/lib/data.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/i18n"],
              importNames: ["t"],
              message:
                "Client components must bind locale via useT()/useLocale() from @/lib/i18n-provider; a direct t() import silently ignores locale switching.",
            },
            {
              group: ["**/lib/build-data"],
              message:
                "Client components must not import the build-time fs reader; fetch runtime data via fetchArtifact() from @/lib/data.",
            },
          ],
        },
      ],
    },
  },
  {
    // The string store itself and generated contract output are exempt by
    // definition (generated files also carry /* eslint-disable */).
    files: ["src/locales/**", "src/lib/contract/**"],
    rules: {
      "react/jsx-no-literals": "off",
      "no-restricted-syntax": "off",
    },
  },
]);

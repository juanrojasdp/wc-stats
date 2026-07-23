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
    // The string store itself and generated contract output are exempt by
    // definition (generated files also carry /* eslint-disable */).
    files: ["src/locales/**", "src/lib/contract/**"],
    rules: {
      "react/jsx-no-literals": "off",
      "no-restricted-syntax": "off",
    },
  },
]);

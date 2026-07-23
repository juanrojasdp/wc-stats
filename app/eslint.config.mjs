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
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-valuetext|title|alt|placeholder)$/] > Literal",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|aria-valuetext|title|alt|placeholder)$/] JSXExpressionContainer > Literal",
          message: "User-facing strings must come from the locale layer (t()).",
        },
        {
          selector:
            'VariableDeclarator[id.name="metadata"] Property[key.name=/^(title|description)$/] > Literal',
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

import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import firebaseRulesPlugin from "@firebase/eslint-plugin-security-rules";

const eslintConfig = [
  {
    ignores: [
      "src/lib/supabase/types.ts",
      "supabase/.temp/**",
      "supabase/functions/**",
      "coverage/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-page-custom-font": "off",
    },
  },
  // Static analysis: complexity and size, as warnings.
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: { sonarjs },
    rules: {
      complexity: ["warn", 10],
      "sonarjs/cognitive-complexity": ["warn", 15],
      "max-lines-per-function": ["warn", 80],
    },
  },
  // Hooks rules restated, on the files eslint-config-next registers the
  // react-hooks plugin for.
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Firebase Security Rules: the plugin's documented flat preset, on the
  // two rules files, with every rule as a warning.
  {
    ...firebaseRulesPlugin.configs["flat/recommended"],
    files: ["firestore.rules", "storage.rules"],
    rules: {
      "@firebase/security-rules/no-open-reads": "warn",
      "@firebase/security-rules/no-open-writes": "warn",
      "@firebase/security-rules/no-redundant-matches": "warn",
    },
  },
];

export default eslintConfig;

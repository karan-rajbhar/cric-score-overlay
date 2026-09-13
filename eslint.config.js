import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

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
];

export default eslintConfig;

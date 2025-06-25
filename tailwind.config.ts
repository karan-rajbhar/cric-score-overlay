import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        cricket: {
          green: "#1B5E20",
          field: "#2E7D32",
          ball: "#D32F2F",
          stumps: "#8D6E63",
        },
      },
    },
  },
  plugins: [],
} satisfies Config; 
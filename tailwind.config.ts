import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  // Class strings live in .ts modules too (the figure table's, which a server
  // component imports; see components/ds/fig-table.ts): scan those as well,
  // but not tests, which only mention classes they check for.
  content: [
    "./src/**/*.{ts,tsx}",
    "!./src/**/*.test.{ts,tsx}",
    "!./src/**/__fixtures__/**",
  ],
  theme: {
    extend: {
      fontSize: {
        // The one size below text-xs: dense table cells, chips, axis labels.
        "2xs": "0.6875rem",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        score: ["var(--font-score)", "Outfit", "ui-sans-serif", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        ruby: {
          DEFAULT: "hsl(var(--ruby))",
          foreground: "hsl(var(--ruby-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
        },
        board: {
          DEFAULT: "hsl(var(--board))",
          foreground: "hsl(var(--board-foreground))",
          muted: "hsl(var(--board-muted))",
          line: "hsl(var(--board-line))",
          good: "hsl(var(--board-good))",
          warn: "hsl(var(--board-warn))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          "soft-foreground": "hsl(var(--primary-soft-foreground))",
        },
        // Design system tokens (globals.css; /design shows them).
        hero: {
          DEFAULT: "hsl(var(--hero))",
          foreground: "hsl(var(--hero-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        live: {
          DEFAULT: "hsl(var(--live))",
          foreground: "hsl(var(--live-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // Chart series: the two teams (globals.css --series-1 / --series-2).
        "series-1": "hsl(var(--series-1))",
        "series-2": "hsl(var(--series-2))",
        four: {
          DEFAULT: "hsl(var(--four))",
          foreground: "hsl(var(--four-foreground))",
        },
        six: {
          DEFAULT: "hsl(var(--six))",
          foreground: "hsl(var(--six-foreground))",
        },
        wicket: {
          DEFAULT: "hsl(var(--wicket))",
          foreground: "hsl(var(--wicket-foreground))",
        },
        extra: {
          DEFAULT: "hsl(var(--extra))",
          foreground: "hsl(var(--extra-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Match header card, dialogs, phone-frame panels.
        panel: "calc(var(--radius) + 10px)",
      },
      // Elevation and the top-of-screen wash (tokens in globals.css).
      boxShadow: {
        soft: "var(--shadow-soft)",
        float: "var(--shadow-float)",
        primary: "var(--shadow-primary)",
      },
      backgroundImage: {
        wash: "linear-gradient(120deg, hsl(var(--wash-1)) 0%, hsl(var(--wash-2)) 52%, hsl(var(--wash-3)) 100%)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

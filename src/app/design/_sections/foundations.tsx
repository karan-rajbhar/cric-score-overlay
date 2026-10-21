"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Caption, DocSection, Specimen } from "../_components/doc";

const PRINCIPLES = [
  [
    "Scores are the hero",
    "One big figure in the middle of the match header, in the figure face. Everything around it is small and light.",
  ],
  [
    "Soft and floating",
    "White cards float on a near-white page with soft, wide shadows. A pink-to-lavender wash sits behind the top of each screen, nowhere else.",
  ],
  [
    "One navy, used sparingly",
    "Navy marks the primary action, the selected tab and the current page. Lavender is its soft form for selected rows and second actions.",
  ],
  [
    "Colour means state",
    "Red is live or a wicket, green a four or a win, violet a six, amber extras. Nothing else is coloured.",
  ],
  [
    "Round and light",
    "Pills for buttons, tabs and chips, 18 px cards, a 28 px sheet. Urbanist from regular to semibold; Outfit for figures.",
  ],
  [
    "Thumb first",
    "A bottom tab bar on phones, 44 px targets, swipe for more live matches, one vertical scroll per screen.",
  ],
] as const;

type Swatch = { token: string; className: string; use: string; ring?: boolean };

const COLOURS: { group: string; swatches: Swatch[] }[] = [
  {
    group: "Surfaces and text",
    swatches: [
      {
        token: "--background",
        className: "bg-background",
        use: "Page",
        ring: true,
      },
      {
        token: "--card",
        className: "bg-card",
        use: "Cards, popovers",
        ring: true,
      },
      { token: "--muted", className: "bg-muted", use: "Stat tiles, tracks" },
      {
        token: "--hero",
        className: "bg-hero",
        use: "Flat lavender tint",
      },
      { token: "--border", className: "bg-border", use: "Hairlines" },
      {
        token: "--foreground",
        className: "bg-foreground",
        use: "Text, figures",
      },
      {
        token: "--muted-foreground",
        className: "bg-muted-foreground",
        use: "Labels, secondary text",
      },
    ],
  },
  {
    group: "Wash (top of screens)",
    swatches: [
      {
        token: "--wash-1",
        className: "bg-[hsl(var(--wash-1))]",
        use: "Top left: pink",
      },
      {
        token: "--wash-2",
        className: "bg-[hsl(var(--wash-2))]",
        use: "Middle: lavender",
      },
      {
        token: "--wash-3",
        className: "bg-[hsl(var(--wash-3))]",
        use: "Right: periwinkle",
      },
    ],
  },
  {
    group: "Action and brand",
    swatches: [
      {
        token: "--primary",
        className: "bg-primary",
        use: "Primary button, selected tab, links",
      },
      {
        token: "--primary-soft",
        className: "bg-primary-soft",
        use: "Selected row, active nav, soft button",
      },
      { token: "--brand", className: "bg-brand", use: "Logo only" },
      { token: "--ring", className: "bg-ring", use: "Focus ring" },
    ],
  },
  {
    group: "State",
    swatches: [
      { token: "--live", className: "bg-live", use: "Live chip" },
      {
        token: "--success",
        className: "bg-success",
        use: "Result, not out, win",
      },
      {
        token: "--warning",
        className: "bg-warning",
        use: "Innings break, abandoned",
      },
      {
        token: "--destructive",
        className: "bg-destructive",
        use: "Delete, errors",
      },
    ],
  },
  {
    group: "Deliveries",
    swatches: [
      { token: "--four", className: "bg-four", use: "Four" },
      { token: "--six", className: "bg-six", use: "Six" },
      { token: "--wicket", className: "bg-wicket", use: "Wicket" },
      { token: "--extra", className: "bg-extra", use: "Wide, no-ball, byes" },
    ],
  },
];

/** "241 50% 27%" -> "#23226A". */
function hslToHex(value: string): string {
  const [h = 0, s = 0, l = 0] = value
    .trim()
    .split(/\s+/)
    .map((p) => parseFloat(p));
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

const ALL_TOKENS = COLOURS.flatMap((g) => g.swatches.map((s) => s.token));

/** Current hex of every swatch, re-read when the theme class changes. */
function useTokenHex(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const style = getComputedStyle(root);
      setValues(
        Object.fromEntries(
          ALL_TOKENS.map((t) => [t, hslToHex(style.getPropertyValue(t))]),
        ),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return values;
}

function ColourSection() {
  const hex = useTokenHex();
  return (
    <Specimen
      title="Colour"
      usage="White carries the page, the wash colours the top of each screen, navy and lavender carry action and selection, and the rest only ever means a state. Every token has a dark-mode value (switch the theme above)."
      bodyClassName="space-y-6"
    >
      {COLOURS.map((g) => (
        <div key={g.group}>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            {g.group}
          </h4>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.swatches.map((s) => (
              <li key={s.token} className="min-w-0">
                <div
                  className={`h-14 rounded-lg ${s.className} ${s.ring ? "border border-border" : ""}`}
                />
                <p className="mt-1.5 truncate font-mono text-xs text-foreground">
                  {s.token}
                </p>
                <p className="truncate font-mono text-2xs text-muted-foreground">
                  {hex[s.token] ?? " "}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.use}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">The wash</h4>
        <div className="relative h-36 overflow-hidden rounded-panel border border-border bg-background">
          <div className="absolute inset-x-0 top-0 h-full bg-wash [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]" />
          <div className="absolute inset-x-4 bottom-4 rounded-xl bg-card p-3 text-sm shadow-soft">
            A card floating on the wash
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          bg-wash behind the top of a screen (ScreenWash), fading into the page.
          Not on cards, buttons or lists.
        </p>
      </div>
    </Specimen>
  );
}

const TYPE = [
  {
    name: "Score, hero",
    className: "font-score text-5xl font-semibold leading-none tabular-nums",
    sample: "142/4",
    spec: "Outfit 3rem / semibold / tabular",
  },
  {
    name: "Score, card",
    className: "font-score text-2xl font-semibold leading-none tabular-nums",
    sample: "168/6",
    spec: "Outfit 1.5rem / semibold",
  },
  {
    name: "Profile name",
    className: "text-[2.5rem] font-semibold leading-none tracking-tight",
    sample: "Joshi",
    spec: "Urbanist 2.5rem / semibold",
  },
  {
    name: "Page title",
    className: "text-2xl font-semibold tracking-tight",
    sample: "Summer League 2026",
    spec: "Urbanist 1.5rem / semibold",
  },
  {
    name: "Section title",
    className: "text-xl font-semibold",
    sample: "Upcoming matches",
    spec: "Urbanist 1.25rem / semibold",
  },
  {
    name: "Card title",
    className: "text-base font-semibold",
    sample: "Riverside Warriors innings",
    spec: "Urbanist 1rem / semibold",
  },
  {
    name: "Body",
    className: "text-sm",
    sample: "Hilltop Hawks won the toss and chose to bowl.",
    spec: "Urbanist 0.875rem / regular",
  },
  {
    name: "Label",
    className: "text-xs text-muted-foreground",
    sample: "Strike rate",
    spec: "Urbanist 0.75rem / muted",
  },
] as const;

function TypeSection() {
  return (
    <Specimen
      title="Typography"
      usage="Urbanist, Scoreline's own face, for text: light and round, regular to semibold. Outfit, its close cousin, for figures, because it has tabular digits: scores don't shift as they change and columns line up."
    >
      <dl className="divide-y divide-border">
        {TYPE.map((t) => (
          <div
            key={t.name}
            className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr_auto] sm:items-baseline sm:gap-4"
          >
            <dt className="text-xs text-muted-foreground">{t.name}</dt>
            <dd className={`min-w-0 truncate text-foreground ${t.className}`}>
              {t.sample}
            </dd>
            <dd className="font-mono text-2xs text-muted-foreground">
              {t.spec}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-muted p-4">
          <p className="text-xs text-muted-foreground">
            Tabular figures line up
          </p>
          <p className="mt-2 text-right font-score text-lg font-semibold tabular-nums leading-tight text-foreground">
            111.1
            <br />
            888.8
            <br />
            47.0
          </p>
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-xs text-muted-foreground">Weights in use</p>
          <p className="mt-2 flex flex-wrap gap-x-3 text-lg text-foreground">
            <span className="font-normal">Regular</span>
            <span className="font-medium">Medium</span>
            <span className="font-semibold">Semibold</span>
            <span className="font-bold">Bold</span>
          </p>
        </div>
      </div>
    </Specimen>
  );
}

const RADII = [
  { name: "lg", className: "rounded-lg", px: "14px", use: "Inputs" },
  {
    name: "xl",
    className: "rounded-xl",
    px: "18px",
    use: "Cards, tiles, keys",
  },
  {
    name: "panel",
    className: "rounded-panel",
    px: "24px",
    use: "Match header card",
  },
  {
    name: "sheet",
    className: "rounded-t-[1.75rem]",
    px: "28px top",
    use: "Sheet over the wash",
  },
  {
    name: "full",
    className: "rounded-full",
    px: "pill",
    use: "Buttons, tabs, chips",
  },
] as const;

const SPACES = [1, 2, 3, 4, 6, 8, 12] as const;
const SPACE_WIDTH: Record<(typeof SPACES)[number], string> = {
  1: "w-1",
  2: "w-2",
  3: "w-3",
  4: "w-4",
  6: "w-6",
  8: "w-8",
  12: "w-12",
};

function ShapeSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Specimen title="Radius" usage="Round, never sharp.">
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-3">
          {RADII.map((r) => (
            <li key={r.name}>
              <div
                className={`h-14 w-14 border-2 border-primary/50 bg-primary-soft ${r.className}`}
              />
              <p className="mt-1.5 font-mono text-xs text-foreground">
                {r.name} · {r.px}
              </p>
              <p className="text-xs text-muted-foreground">{r.use}</p>
            </li>
          ))}
        </ul>
      </Specimen>
      <Specimen
        title="Spacing"
        usage="4 px steps. 16 px page gutter and card padding on phones, 24 px from tablets up; 24 to 32 px between sections."
      >
        <ul className="space-y-2">
          {SPACES.map((s) => (
            <li key={s} className="flex items-center gap-3">
              <span className="w-12 font-mono text-xs text-muted-foreground">
                {s * 4}px
              </span>
              <span
                className={`h-3 rounded-[0.125rem] bg-primary ${SPACE_WIDTH[s]}`}
              />
            </li>
          ))}
        </ul>
      </Specimen>
      <Specimen
        title="Elevation"
        usage="Soft, wide shadows tinted navy, so white cards float on the near-white page. In dark mode cards add a hairline instead."
        bodyClassName="space-y-4"
      >
        <div className="rounded-xl bg-card p-3 text-sm shadow-soft">
          shadow-soft: cards, tables, round buttons
        </div>
        <div className="rounded-xl bg-card p-3 text-sm shadow-float">
          shadow-float: tab bar, menus, dialogs, card hover
        </div>
        <div className="rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-primary">
          shadow-primary: the main button, selected tab
        </div>
      </Specimen>
    </div>
  );
}

const ICONS: [LucideIcon, string][] = [
  [Search, "Search"],
  [Bell, "Notifications"],
  [Share2, "Share"],
  [Download, "Download"],
  [Plus, "New"],
  [RotateCcw, "Undo"],
  [MoreHorizontal, "More"],
  [ChevronRight, "Open"],
  [MapPin, "Venue"],
  [CalendarDays, "Date"],
  [Clock, "Time"],
  [Trophy, "Tournament"],
];

function IconSection() {
  return (
    <Specimen
      title="Icons"
      usage="Lucide at 16 px inline, 18 px in navigation, 1.5 stroke look. An icon must say something (venue, date, undo); no ornaments. Icon-only buttons always carry a label for screen readers."
    >
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ICONS.map(([Icon, label]) => (
          <li
            key={label}
            className="flex flex-col items-center gap-2 rounded-lg bg-muted px-2 py-3"
          >
            <Icon
              className="h-[1.125rem] w-[1.125rem] text-foreground"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
      <Caption>lucide-react · h-4 w-4 inline · h-[1.125rem] nav</Caption>
    </Specimen>
  );
}

export function FoundationsSection() {
  return (
    <DocSection
      id="foundations"
      title="Foundations"
      description="The decisions every component builds on, taken from Scoreline: white cards floating on a soft pink-to-lavender wash, a deep navy, pill shapes, a light round typeface and one big score."
    >
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map(([title, body], i) => (
          <li
            key={title}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs tabular-nums text-muted-foreground">
              {i + 1}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {title}
            </p>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ol>
      <ColourSection />
      <TypeSection />
      <ShapeSection />
      <IconSection />
    </DocSection>
  );
}

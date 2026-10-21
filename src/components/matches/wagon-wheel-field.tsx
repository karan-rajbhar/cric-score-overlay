/*
 * Shared look of the wagon wheel field (the chart and the scorer's shot
 * picker), as theme classes so dark mode follows. A light field with fine
 * rings; shots in the delivery colours used everywhere else: 1s-3s a grey
 * ramp, fours green, sixes violet, wickets red.
 */

export const FIELD = {
  ring: "fill-muted stroke-card",
  ringSelected: "fill-primary-soft stroke-card",
  ringHover: "hover:fill-accent",
  rim: "stroke-border",
  divider: "stroke-card",
  label: "fill-foreground",
  labelSelected: "fill-primary",
  grass: "fill-card stroke-border",
  wedge: "fill-transparent hover:fill-primary/5",
  wedgeSelected: "fill-primary/10",
  ring30: "fill-none stroke-border",
  guide: "fill-none stroke-border/70",
  radial: "stroke-border/70",
  pitch:
    "fill-[hsl(40_45%_90%)] stroke-[hsl(40_30%_72%)] dark:fill-[hsl(40_16%_26%)] dark:stroke-[hsl(40_16%_40%)]",
  crease: "stroke-[hsl(40_28%_55%)]",
  stumps: "fill-foreground",
  farStumps: "fill-muted-foreground",
  batter: "fill-primary stroke-card",
  aim: "stroke-primary",
  aimEnd: "fill-primary stroke-card",
} as const;

/** Line class and width for a shot, by what it scored. */
export function shotStyle(runs: number, isWicket: boolean) {
  if (isWicket) return { cls: "stroke-wicket", width: 2 };
  if (runs >= 6) return { cls: "stroke-six", width: 2.5 };
  if (runs === 4 || runs === 5) return { cls: "stroke-four", width: 2.25 };
  if (runs === 3) return { cls: "stroke-muted-foreground", width: 1.75 };
  if (runs === 2) return { cls: "stroke-muted-foreground/70", width: 1.5 };
  if (runs === 1) return { cls: "stroke-muted-foreground/45", width: 1.4 };
  return { cls: "stroke-muted-foreground/30", width: 1 };
}

/** The same colours as fills, for markers and legend dots. */
export const SHOT_FILL: Record<string, string> = {
  "1": "bg-muted-foreground/45",
  "2": "bg-muted-foreground/70",
  "3": "bg-muted-foreground",
  "4": "bg-four",
  "6": "bg-six",
};

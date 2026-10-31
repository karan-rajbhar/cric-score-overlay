import * as React from "react";
import { cn } from "~/lib/utils";

export type BallKind = "dot" | "run" | "four" | "six" | "wicket" | "extra";

const KIND: Record<BallKind, string> = {
  dot: "bg-muted text-muted-foreground",
  run: "border border-border bg-card text-foreground",
  four: "bg-four text-four-foreground",
  six: "bg-six text-six-foreground",
  wicket: "bg-wicket text-wicket-foreground",
  extra: "bg-extra/15 text-extra ring-1 ring-inset ring-extra/30",
};

const SPOKEN: Record<BallKind, string> = {
  dot: "dot ball",
  run: "runs",
  four: "four",
  six: "six",
  wicket: "wicket",
  extra: "extra",
};

/**
 * One delivery, as `deliveryLabel` spells it: "0", "1", "4", "6", "W",
 * "W+3", "wd+1", "nb+2". Colour says what happened (4 green, 6 violet, W
 * red, extras amber); plain runs stay quiet.
 */
export function BallChip({
  kind,
  label,
  size = "md",
  className,
}: {
  kind: BallKind;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-score font-semibold tabular-nums leading-none",
        size === "md"
          ? "h-8 min-w-8 px-1.5 text-sm"
          : "h-6 min-w-6 px-1 text-2xs",
        KIND[kind],
        className,
      )}
    >
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">
        {kind === "run" || kind === "extra" || (kind === "wicket" && label !== "W")
          ? `${label} ${SPOKEN[kind]}`
          : SPOKEN[kind]}
      </span>
    </span>
  );
}

/** "This over": the deliveries so far and the over's total on the right. */
export function OverStrip({
  title = "This over",
  balls,
  total,
  className,
}: {
  title?: React.ReactNode;
  balls: readonly { kind: BallKind; label: string }[];
  total?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="shrink-0 text-xs text-muted-foreground">{title}</span>
      <ol className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
        {balls.map((b, i) => (
          <li key={i}>
            <BallChip kind={b.kind} label={b.label} />
          </li>
        ))}
      </ol>
      {total !== undefined && (
        <span className="shrink-0 font-score text-sm font-semibold tabular-nums text-foreground">
          {total} {total === 1 ? "run" : "runs"}
        </span>
      )}
    </div>
  );
}

const KEY_TONE = {
  run: "bg-card text-foreground shadow-soft ring-1 ring-border/50 hover:bg-accent",
  four: "bg-four text-four-foreground hover:bg-four/90",
  six: "bg-six text-six-foreground hover:bg-six/90",
  wicket: "bg-wicket text-wicket-foreground hover:bg-wicket/90",
  extra:
    "bg-extra/15 text-extra ring-1 ring-inset ring-extra/30 hover:bg-extra/25",
  action: "bg-muted text-foreground hover:bg-accent",
} as const;

/** A scoring keypad key: big figure, optional small caption under it. */
export const KeypadButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: keyof typeof KEY_TONE;
    caption?: React.ReactNode;
  }
>(({ tone = "run", caption, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "flex min-h-14 cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-xl px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100",
      KEY_TONE[tone],
      className,
    )}
    {...props}
  >
    <span className="font-score text-xl font-semibold tabular-nums leading-none">
      {children}
    </span>
    {caption && (
      <span className="text-2xs font-medium leading-none opacity-80">
        {caption}
      </span>
    )}
  </button>
));
KeypadButton.displayName = "KeypadButton";

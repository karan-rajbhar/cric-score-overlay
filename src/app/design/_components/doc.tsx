import type * as React from "react";
import { cn } from "~/lib/utils";

/** A top-level part of the reference (Foundations, Controls...). */
export function DocSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 space-y-6"
    >
      <header className="border-b border-border pb-3">
        <h2
          id={`${id}-title`}
          className="text-balance text-2xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/** One component or token group: a title, usage notes and the live example. */
export function Specimen({
  title,
  usage,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  usage?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    // min-w-0: as a grid cell, don't grow to fit a wide table inside.
    <div className={cn("min-w-0 space-y-3", className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {usage && (
          <p className="mt-0.5 max-w-2xl text-pretty text-sm text-muted-foreground">
            {usage}
          </p>
        )}
      </div>
      <div
        className={cn(
          "rounded-xl border border-dashed border-border p-4 sm:p-6",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Small caption under a variant inside a specimen. */
export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 font-mono text-2xs text-muted-foreground">{children}</p>
  );
}

/**
 * A phone-width frame for composed screens. Clipped, not scrolled, so a
 * sticky tab bar inside it sticks to the window while the frame is in view
 * (no second scroll area).
 */
export function PhoneFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="mx-auto w-full min-w-0 max-w-[390px]">
      <div className="relative overflow-clip rounded-panel border border-border bg-background shadow-soft">
        {children}
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {title}
      </figcaption>
    </figure>
  );
}

import type * as React from "react";
import { cn } from "~/lib/utils";

export type Fact = [label: string, value: React.ReactNode];

/** The facts that apply: a falsy entry is left out, so no row says "none". */
export const factsOf = (...entries: (Fact | false | null | undefined | "")[]) =>
  entries.filter((e): e is Fact => Boolean(e));

/** Label on the left, value on the right; the rows split by hairlines. */
export function Facts({
  facts,
  className,
}: {
  facts: readonly Fact[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-border px-4 pb-2 sm:px-5", className)}>
      {facts.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-4 py-2.5"
        >
          <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right text-sm font-medium text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

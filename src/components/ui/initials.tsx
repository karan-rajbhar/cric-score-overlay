import { cn } from "~/lib/utils";

/**
 * Round initials avatar for people (players, members, scorers). Size it with
 * h-/w-/text- classes; the default is 32px.
 */
export function Initials({
  name,
  fallback = "?",
  letters = 1,
  className,
}: {
  name: string | null | undefined;
  fallback?: string;
  letters?: 1 | 2;
  className?: string;
}) {
  const text = (name?.trim() || fallback).slice(0, letters).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}

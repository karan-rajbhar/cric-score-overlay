import { cn } from "~/lib/utils";

/**
 * The context label above the batter / bowler picker titles: which side is
 * being chosen for, so the two dialogs are never mistaken for each other
 * (batting in green, as the striker on the scoreboard; bowling in blue).
 * The title says the task ("Choose the new batter").
 */
export function RoleBand({
  role,
  teamName,
}: {
  role: "batting" | "bowling";
  teamName?: string | null;
}) {
  return (
    <span
      data-testid={`role-band-${role}`}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        role === "batting"
          ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : "border-sky-600/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          role === "batting" ? "bg-emerald-600" : "bg-sky-600",
        )}
        aria-hidden="true"
      />
      {role === "batting" ? "Batting" : "Bowling"}
      {teamName ? ` · ${teamName}` : ""}
    </span>
  );
}

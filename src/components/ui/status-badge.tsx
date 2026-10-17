import { Badge, type BadgeProps } from "~/components/ui/badge";
import { formatStatus } from "~/lib/cricket";

const VARIANT: Record<string, BadgeProps["variant"]> = {
  live: "live",
  innings_break: "live",
  ongoing: "success",
  registration_open: "success",
  completed: "secondary",
  abandoned: "warning",
  cancelled: "warning",
};

/**
 * One status chip for matches and tournaments, so "live", "completed" and
 * "scheduled" look the same on every page. Unknown statuses fall back to a
 * neutral outline.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  /** Override the default formatted label. */
  label?: string;
  className?: string;
}) {
  if (!status) return null;
  return (
    <Badge variant={VARIANT[status] ?? "outline"} className={className}>
      {label ?? formatStatus(status)}
    </Badge>
  );
}

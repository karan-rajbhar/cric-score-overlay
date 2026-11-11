import { CloudOff, RotateCcw } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

/**
 * A list that could not be read (`/design#spec-could-not-load`): it says so
 * where the list would be and offers Try again. Never the empty state: that
 * means the read worked and found nothing. No error text from the database.
 */
export function CouldNotLoad({
  what,
  onRetry,
  className,
}: {
  /** "matches", "results": "Could not load matches". */
  what: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={CloudOff}
      title={`Could not load ${what}`}
      description="Check your connection and try again."
      primaryAction={
        onRetry
          ? {
              label: "Try again",
              onClick: onRetry,
              icon: RotateCcw,
              variant: "outline",
            }
          : undefined
      }
      className={className}
    />
  );
}

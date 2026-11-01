import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BackLink } from "~/components/ds/back-link";
import { buttonVariants } from "~/components/ds/button";
import { backLabelOf, parentOf, type NavCrumb } from "~/lib/navigation";
import { cn } from "~/lib/utils";

/**
 * From tablets up, a detail page's way out: round Back and where the page
 * sits (`~/lib/navigation`). Phones have `ScreenBar`.
 */
export function PageTrail({
  crumbs,
  current,
  avoid,
  className,
}: {
  crumbs: readonly NavCrumb[];
  /** This page's own name. */
  current: string;
  /** A page Back must not return to (see `BackLink`). */
  avoid?: string;
  className?: string;
}) {
  const label = backLabelOf(crumbs);
  return (
    <div className={cn("flex min-w-0 items-center gap-3 max-md:hidden", className)}>
      <BackLink
        href={parentOf(crumbs)}
        avoid={avoid}
        aria-label={label}
        title={label}
        className={cn(
          buttonVariants({ variant: "surface", size: "icon-sm" }),
          "shrink-0",
        )}
      >
        <ChevronLeft />
      </BackLink>
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
      >
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex shrink-0 items-center gap-1.5">
            <Link
              href={crumb.href}
              className="max-w-[10rem] truncate transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        ))}
        <span
          aria-current="page"
          className="min-w-0 truncate font-medium text-foreground"
        >
          {current}
        </span>
      </nav>
    </div>
  );
}

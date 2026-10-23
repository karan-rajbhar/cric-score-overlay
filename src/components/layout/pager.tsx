import Link from "next/link";

const linkClass = "text-sm font-medium text-primary hover:underline";

/**
 * "First page" / "Next page" links under a keyset-paged list
 * (`~/lib/keyset`). Renders nothing on a single page.
 */
export function Pager({
  label,
  firstHref,
  nextHref,
}: {
  /** Accessible name of the navigation, e.g. "Teams pages". */
  label: string;
  /** Set when this is not the first page. */
  firstHref?: string | null;
  nextHref?: string | null;
}) {
  if (!firstHref && !nextHref) return null;
  return (
    <nav aria-label={label} className="flex justify-between gap-3">
      {firstHref ? (
        <Link href={firstHref} className={linkClass}>
          First page
        </Link>
      ) : (
        <span />
      )}
      {nextHref && (
        <Link href={nextHref} className={linkClass}>
          Next page
        </Link>
      )}
    </nav>
  );
}

/**
 * "Show more" under a list read with a growing limit (`?<param>=<n>`): the
 * detail pages' match and member lists.
 */
export function ShowMoreLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="flex justify-center">
      <Link href={href} scroll={false} className={linkClass}>
        {label}
      </Link>
    </div>
  );
}

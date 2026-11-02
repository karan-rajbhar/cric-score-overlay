import Link from "next/link";
import { segmentedItem, segmentedTrack } from "~/components/ui/segmented";

/** Navigation on phones: a full 44px to tap. */
const TAP_TARGET = "min-h-11 sm:min-h-9";

/** My clubs / All clubs, the same switch on each list that has both. */
export function MineAllSwitch({
  label,
  mine,
  all,
  view,
}: {
  label: string;
  mine: { label: string; href: string };
  all: { label: string; href: string };
  view: "mine" | "all";
}) {
  return (
    <nav aria-label={label} className={segmentedTrack}>
      <Link
        href={mine.href}
        aria-current={view === "mine" ? "page" : undefined}
        className={segmentedItem(view === "mine", TAP_TARGET)}
      >
        {mine.label}
      </Link>
      <Link
        href={all.href}
        aria-current={view === "all" ? "page" : undefined}
        className={segmentedItem(view === "all", TAP_TARGET)}
      >
        {all.label}
      </Link>
    </nav>
  );
}

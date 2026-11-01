import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

/**
 * The search box of a list page: a plain GET form, so it works before the
 * page's JavaScript loads and its result is a URL. The whole app's search is
 * `/search`; this one narrows the list on screen.
 */
export function ListSearch({
  action,
  name = "search",
  value,
  label,
  placeholder,
  hidden,
}: {
  action: string;
  name?: string;
  value?: string;
  label: string;
  placeholder: string;
  /** Kept in the URL when searching (`view=all`). */
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      method="GET"
      role="search"
      className="relative w-full sm:max-w-sm"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        name={name}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        defaultValue={value}
        className="h-10 w-full pl-9 text-base sm:text-sm"
      />
      {Object.entries(hidden ?? {}).map(([key, val]) => (
        <input key={key} type="hidden" name={key} value={val} />
      ))}
    </form>
  );
}

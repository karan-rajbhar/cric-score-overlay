/**
 * What a page shows, kept in its URL so a reload, Back or a shared link keep
 * it. `replaceState` changes the address without a history entry or a server
 * request (Next keeps `useSearchParams` in step), so switching tabs costs no
 * reads and Back still leaves the page, not the tab.
 */
export function setUrlParam(
  name: string,
  value: string,
  /** The page's default: left out, so the plain URL stays the plain URL. */
  defaultValue?: string,
): void {
  const url = new URL(window.location.href);
  if (value === defaultValue) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(null, "", url);
}

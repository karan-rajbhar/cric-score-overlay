/** /matches/<id>/report: the printable match report (bare, always light). */
export function isMatchReportPath(
  pathname: string | null | undefined,
): boolean {
  return /^\/matches\/[^/]+\/report\/?$/.test(pathname ?? "");
}

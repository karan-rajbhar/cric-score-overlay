/** /matches/<id>/report: the printable match report (bare, always light). */
export function isMatchReportPath(
  pathname: string | null | undefined,
): boolean {
  return /^\/matches\/[^/]+\/report\/?$/.test(pathname ?? "");
}

/** /clubs/<id>/stats-report: the club's printable statistics (same shell). */
export function isClubStatsReportPath(
  pathname: string | null | undefined,
): boolean {
  return /^\/clubs\/[^/]+\/stats-report\/?$/.test(pathname ?? "");
}

/** A printable report page: no app shell, it brings its own toolbar. */
export function isReportPath(pathname: string | null | undefined): boolean {
  return isMatchReportPath(pathname) || isClubStatsReportPath(pathname);
}

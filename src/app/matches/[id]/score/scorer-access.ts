/**
 * Whether the signed-in user may use the scoring controls: `null` while that
 * is still being worked out.
 *
 * The check (`is_match_admin`) needs the network. A user confirmed as a
 * scorer of this match on this device keeps access while it cannot run
 * (offline, or not answered yet); the server re-checks every queued action
 * when it syncs.
 */
export function resolveScorerAccess(args: {
  hasUser: boolean;
  authLoading: boolean;
  /** Result of the admin check, `undefined` until it has answered. */
  isAdmin: boolean | undefined;
  adminCheckLoading: boolean;
  rememberedScorer: boolean;
  offline: boolean;
}): boolean | null {
  if (!args.hasUser) return args.authLoading ? null : false;
  if (args.isAdmin === true) return true;
  if (args.rememberedScorer && (args.offline || args.isAdmin === undefined)) {
    return true;
  }
  if (args.adminCheckLoading) return null;
  return false;
}

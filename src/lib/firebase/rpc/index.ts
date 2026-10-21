/**
 * Server-side dispatcher for the named procedures the app calls through
 * `client.rpc(name, args)`. Each name maps to a TypeScript port of the
 * former Postgres function.
 */

import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import type { AppUser } from "../auth-types";
import type { DataSource } from "../datasource";
import { DbQueryError } from "../query-builder";
import {
  canDeleteMatch,
  isClubAdmin,
  isClubMember,
  isMatchAdmin,
  isTeamMember,
} from "./auth-helpers";
import { inviteEmail, revokeInvitation } from "./access";
import { deleteMatch } from "./delete-match";
import {
  addTeamPlayer,
  checkUsernameAvailable,
  createTeamPlayer,
  ensureOwnProfile,
  updateOwnUsername,
} from "./profiles";
import {
  awardPenaltyRuns,
  endInnings,
  reassignOverBowler,
  replaceBatter,
  recomputeInningsRpc,
  recordBall,
  retireBatter,
  setCurrentBatsmen,
  setCurrentBowler,
  startSuperOver,
  undoLastBall,
  updateBall,
  type RecordBallArgs,
  type ScoringContext,
  type UpdateBallArgs,
} from "./scoring";
import { recalculateTournamentStandings } from "./standings";
import { ensureLiveState, liveRowOf, writeLiveState } from "../live-state";
import { ensureLiveScorecard } from "../scorecard-refresh";

export interface RpcContext {
  db: Firestore | null;
  ds: DataSource;
  uid: string | null;
  user: AppUser | null;
}

type Args = Record<string, unknown>;

function str(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value) {
    throw new DbQueryError(`invalid_input: missing ${key}`, "22000");
  }
  return value;
}

function optStr(args: Args, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value ? value : null;
}

/** Procedures that can answer with a {@link ScoringDelta}. */
const WITH_DELTA = new Set([
  "record_ball",
  "undo_last_ball",
  "set_current_batsmen",
  "set_current_bowler",
  "retire_batter",
  "award_penalty_runs",
]);

export async function callRpc(
  name: string,
  args: Args,
  ctx: RpcContext,
  scoringContext?: ScoringContext,
): Promise<unknown> {
  const scoring: ScoringContext = scoringContext ?? {
    db: ctx.db,
    ds: ctx.ds,
    uid: ctx.uid,
    // Offline-queue replays: an action already applied is not applied again.
    clientActionId: optStr(args, "p_client_action_id"),
    // For live_state.last_change (who scored last), from the session.
    scorerName:
      ctx.user?.user_metadata?.full_name ?? ctx.user?.user_metadata?.name ?? null,
  };
  // `p_with_delta`: answer `{ result, delta }`, the delta being the match's
  // documents as committed (the scoring screen updates from it instead of
  // re-reading its state).
  if (args.p_with_delta === true && WITH_DELTA.has(name)) {
    const sink = { matchId: str(args, "p_match_id"), value: null };
    const result = await callRpc(
      name,
      { ...args, p_with_delta: false },
      ctx,
      { ...scoring, delta: sink },
    );
    return { result, delta: sink.value };
  }
  switch (name) {
    case "record_ball":
      return recordBall(scoring, args as unknown as RecordBallArgs);
    case "undo_last_ball":
      return undoLastBall(scoring, str(args, "p_match_id"));
    case "update_ball":
      return updateBall(scoring, args as unknown as UpdateBallArgs);
    case "end_innings":
      return endInnings(scoring, str(args, "p_match_id"));
    case "start_super_over":
      return startSuperOver(scoring, str(args, "p_match_id"));
    case "recompute_innings":
      return recomputeInningsRpc(scoring, str(args, "p_innings_id"));
    case "award_penalty_runs":
      return awardPenaltyRuns(scoring, {
        p_match_id: str(args, "p_match_id"),
        p_runs: Number(args.p_runs),
        p_type: str(args, "p_type"),
        p_reason: optStr(args, "p_reason"),
        p_team_id: optStr(args, "p_team_id"),
      });
    case "retire_batter":
      return retireBatter(scoring, {
        p_match_id: str(args, "p_match_id"),
        p_player_id: str(args, "p_player_id"),
        p_type: str(args, "p_type"),
        p_reason: optStr(args, "p_reason"),
      });
    case "reassign_over_bowler":
      return reassignOverBowler(scoring, {
        p_match_id: str(args, "p_match_id"),
        p_bowler_id: str(args, "p_bowler_id"),
      });
    case "replace_batter":
      return replaceBatter(scoring, {
        p_match_id: str(args, "p_match_id"),
        p_from_id: str(args, "p_from_id"),
        p_to_id: str(args, "p_to_id"),
      });
    case "set_current_batsmen":
      return setCurrentBatsmen(
        scoring,
        str(args, "p_match_id"),
        str(args, "p_striker_id"),
        str(args, "p_non_striker_id"),
      );
    case "set_current_bowler":
      return setCurrentBowler(
        scoring,
        str(args, "p_match_id"),
        str(args, "p_bowler_id"),
      );
    case "refresh_live_state":
      // Server-only (the browser client rejects unknown names): server
      // actions call this after changing anything the scoreboard shows.
      return writeLiveState(ctx.ds, str(args, "p_match_id"), ctx.db);
    case "get_live_state": {
      // The scoreboard row from `live_state` (1 read), built once for
      // matches that predate it.
      const doc = await ensureLiveState(ctx.ds, str(args, "p_match_id"), ctx.db);
      return doc ? liveRowOf(doc) : null;
    }
    case "ensure_live_scorecard":
      // The match's `live_scorecard` doc, built once for matches that
      // predate it (viewers then listen to it directly).
      return ensureLiveScorecard(ctx.ds, str(args, "p_match_id"), ctx.db);
    case "recalculate_tournament_standings":
      await recalculateTournamentStandings(
        ctx.ds,
        str(args, "p_tournament_id"),
      );
      return null;
    case "ensure_own_profile":
      return ensureOwnProfile(ctx.ds, ctx.user);
    case "invite_email":
      return inviteEmail(
        ctx.ds,
        ctx.uid,
        str(args, "p_email"),
        optStr(args, "p_match_id"),
      );
    case "revoke_invitation":
      return revokeInvitation(ctx.ds, ctx.uid, str(args, "p_invitation_id"));
    case "update_own_username":
      return updateOwnUsername(ctx.ds, ctx.uid, str(args, "p_username"));
    case "check_username_available":
      return checkUsernameAvailable(
        ctx.ds,
        optStr(args, "p_username"),
        optStr(args, "p_current_user_id") ?? ctx.uid,
      );
    case "create_team_player":
      return createTeamPlayer(
        ctx.ds,
        ctx.uid,
        str(args, "p_team_id"),
        str(args, "p_full_name"),
        typeof args.p_jersey_number === "number" ? args.p_jersey_number : null,
        optStr(args, "p_match_id"),
      );
    case "add_team_player":
      return addTeamPlayer(
        ctx.ds,
        ctx.uid,
        str(args, "p_team_id"),
        str(args, "p_user_id"),
        optStr(args, "p_match_id"),
      );
    case "delete_match":
      return deleteMatch(
        { ds: ctx.ds, db: ctx.db, uid: ctx.uid },
        str(args, "p_match_id"),
        typeof args.p_confirm_title === "string" ? args.p_confirm_title : "",
      );
    case "can_delete_match":
      return canDeleteMatch(
        ctx.ds,
        optStr(args, "p_match_id"),
        optStr(args, "p_user_id") ?? ctx.uid,
      );
    case "is_match_admin":
      return isMatchAdmin(
        ctx.ds,
        optStr(args, "p_match_id"),
        optStr(args, "p_user_id") ?? ctx.uid,
      );
    case "is_club_admin":
      return isClubAdmin(
        ctx.ds,
        optStr(args, "p_club_id"),
        optStr(args, "p_user_id") ?? ctx.uid,
      );
    case "is_club_member":
      return isClubMember(
        ctx.ds,
        optStr(args, "p_club_id"),
        optStr(args, "p_user_id") ?? ctx.uid,
      );
    case "is_team_member":
      return isTeamMember(
        ctx.ds,
        optStr(args, "p_team_id"),
        optStr(args, "p_user_id") ?? ctx.uid,
      );
    default:
      throw new DbQueryError(`function ${name} does not exist`, "42883");
  }
}

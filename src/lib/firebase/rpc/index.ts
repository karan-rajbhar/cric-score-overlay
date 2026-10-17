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
  isClubAdmin,
  isClubMember,
  isMatchAdmin,
  isTeamMember,
} from "./auth-helpers";
import { inviteEmail } from "./access";
import {
  checkUsernameAvailable,
  createTeamPlayer,
  ensureOwnProfile,
  updateOwnUsername,
} from "./profiles";
import {
  awardPenaltyRuns,
  endInnings,
  reassignOverBowler,
  recomputeInningsRpc,
  recordBall,
  retireBatter,
  setCurrentBatsmen,
  setCurrentBowler,
  startSuperOver,
  undoLastBall,
  updateBall,
  type RecordBallArgs,
  type UpdateBallArgs,
} from "./scoring";
import { recalculateTournamentStandings } from "./standings";
import { ensureLiveState, liveRowOf, writeLiveState } from "../live-state";
import { ensureLiveScorecard } from "../live-scorecard-sync";

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

export async function callRpc(
  name: string,
  args: Args,
  ctx: RpcContext,
): Promise<unknown> {
  const scoring = { db: ctx.db, ds: ctx.ds, uid: ctx.uid };
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

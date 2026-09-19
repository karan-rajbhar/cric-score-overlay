export const ERROR_MESSAGES: Record<string, string> = {
  awaiting_new_batsman: "Select the new batsman before scoring the next ball.",
  bowler_not_set: "Select a bowler before scoring the next ball.",
  striker_mismatch: "Batsmen out of sync - reloading latest state.",
  non_striker_mismatch: "Batsmen out of sync - reloading latest state.",
  same_bowler_next_over:
    "This bowler just bowled the previous over. Choose a different bowler.",
  player_not_in_batting_team: "Selected player is not on the batting team.",
  player_already_out: "That batsman is already dismissed.",
  too_many_batsmen: "All 11 batsmen have already batted.",
  match_not_live: "The match is not live.",
  no_open_innings: "No open innings found.",
  nothing_to_undo: "Nothing to undo.",
  not_authorized: "You do not have permission to score this match.",
  "ON CONFLICT specification":
    "A scoring synchronization issue occurred. Please refresh the match and try again.",
  "violates unique constraint":
    "This player already has a record in this innings.",
  "violates foreign key constraint":
    "The referenced player, team, or match could not be found.",
  "fetch failed":
    "Database connection error. Please check your connection and retry.",
  "connection refused":
    "Database server is unreachable. Please verify connection and retry.",
  "statement timeout":
    "The database query timed out. Please retry.",
  "canceling statement due to statement timeout":
    "The database query timed out. Please retry.",
  "JWT expired":
    "Your session has expired. Please sign in again.",
  "token expired":
    "Your session has expired. Please sign in again.",
  "team_not_found":
    "The selected team could not be found.",
  "name_required":
    "Please enter a player name.",
};

export function friendlyError(message: string): string {
  if (!message) return message;
  for (const [key, translation] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key)) {
      return translation;
    }
  }
  return message;
}

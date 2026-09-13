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

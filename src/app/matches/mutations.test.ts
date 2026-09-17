import { describe, expect, it } from "vitest";
import { friendlyError, ERROR_MESSAGES } from "./errors";

describe("mutations error formatting", () => {
  it("translates direct error keys into user-friendly messages", () => {
    expect(friendlyError("awaiting_new_batsman")).toBe(
      "Select the new batsman before scoring the next ball.",
    );
    expect(friendlyError("bowler_not_set")).toBe(
      "Select a bowler before scoring the next ball.",
    );
    expect(friendlyError("same_bowler_next_over")).toBe(
      "This bowler just bowled the previous over. Choose a different bowler.",
    );
    expect(friendlyError("player_not_in_batting_team")).toBe(
      "Selected player is not on the batting team.",
    );
    expect(friendlyError("player_already_out")).toBe(
      "That batsman is already dismissed.",
    );
    expect(friendlyError("too_many_batsmen")).toBe(
      "All 11 batsmen have already batted.",
    );
    expect(friendlyError("match_not_live")).toBe("The match is not live.");
    expect(friendlyError("nothing_to_undo")).toBe("Nothing to undo.");
    expect(friendlyError("not_authorized")).toBe(
      "You do not have permission to score this match.",
    );
  });

  it("extracts error keys quoted in Postgres exception messages", () => {
    const pgError =
      'new row for relation "ball_by_ball" violates check constraint "same_bowler_next_over"';
    expect(friendlyError(pgError)).toBe(
      "This bowler just bowled the previous over. Choose a different bowler.",
    );

    const pgError2 = 'error: "striker_mismatch" at character 42';
    expect(friendlyError(pgError2)).toBe(
      "Batsmen out of sync - reloading latest state.",
    );
  });

  it("extracts error keys from multiline Postgres error outputs", () => {
    const multiline =
      "awaiting_new_batsman\nCONTEXT: PL/pgSQL function record_ball() line 42";
    expect(friendlyError(multiline)).toBe(
      "Select the new batsman before scoring the next ball.",
    );
  });

  it("handles Postgres constraint and conflict errors gracefully", () => {
    const conflictError =
      "there is no unique or exclusion constraint matching the ON CONFLICT specification";
    expect(friendlyError(conflictError)).toBe(
      "A scoring synchronization issue occurred. Please refresh the match and try again.",
    );

    const dupKeyError =
      'duplicate key value violates unique constraint "batting_performances_innings_user_unique"';
    expect(friendlyError(dupKeyError)).toBe(
      "This player already has a record in this innings.",
    );

    const fkError =
      'insert or update on table "matches" violates foreign key constraint "matches_team1_id_fkey"';
    expect(friendlyError(fkError)).toBe(
      "The referenced player, team, or match could not be found.",
    );
  });

  it("returns raw message unchanged when no translation exists", () => {
    const unmapped = "Network connection failed";
    expect(friendlyError(unmapped)).toBe("Network connection failed");
  });

  it("contains expected error dictionary entries", () => {
    expect(Object.keys(ERROR_MESSAGES)).toContain("awaiting_new_batsman");
    expect(Object.keys(ERROR_MESSAGES)).toContain("bowler_not_set");
    expect(Object.keys(ERROR_MESSAGES)).toContain("same_bowler_next_over");
    expect(Object.keys(ERROR_MESSAGES)).toContain("striker_mismatch");
    expect(Object.keys(ERROR_MESSAGES)).toContain("non_striker_mismatch");
  });
});

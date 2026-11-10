/**
 * Validation of the match rules a tournament form sends (plain module, so
 * the "use server" actions file exports only actions).
 */

import {
  tournamentRules,
  type TournamentRulesSource,
} from "~/app/matches/create/match-setup";

/**
 * The format, overs and wickets of the fixtures a tournament's generators
 * create: what the match wizard takes from the tournament
 * (`tournamentRules`, which reads `custom_overs` on older tournaments),
 * else the wizard's own T20 with 10 wickets.
 */
export function fixtureRulesOf(t: TournamentRulesSource): {
  match_format: string;
  overs_per_innings: number;
  wickets_per_innings: number;
} {
  const rules = tournamentRules(t);
  return {
    match_format: rules.format ?? "T20",
    overs_per_innings: rules.overs ?? 20,
    wickets_per_innings: rules.wickets ?? 10,
  };
}

const MATCH_FORMATS = new Set(["T20", "T10", "ODI", "Custom"]);

/**
 * Match format, overs and wickets from a tournament form. Overs default to
 * the format's own (20 for T20), wickets stay unset (null) when the form
 * has none.
 */
export function tournamentRulesFrom(formData: FormData):
  | {
      match_format: string;
      overs_per_innings: number;
      wickets_per_innings: number | null;
    }
  | { error: string } {
  const rawFormat = (formData.get("match_format") as string) || "T20";
  if (!MATCH_FORMATS.has(rawFormat)) return { error: "Unknown match format" };
  const presetOvers: Record<string, number> = { T20: 20, T10: 10, ODI: 50 };
  const oversRaw = (formData.get("overs_per_innings") as string | null)?.trim();
  const overs = oversRaw ? Number(oversRaw) : (presetOvers[rawFormat] ?? 20);
  if (!Number.isInteger(overs) || overs < 1 || overs > 50) {
    return { error: "Overs must be between 1 and 50" };
  }
  const wicketsRaw = (
    formData.get("wickets_per_innings") as string | null
  )?.trim();
  const wickets = wicketsRaw ? Number(wicketsRaw) : null;
  if (wickets !== null && (!Number.isInteger(wickets) || wickets < 1 || wickets > 15)) {
    return { error: "Wickets must be between 1 and 15" };
  }
  return {
    match_format: rawFormat,
    overs_per_innings: overs,
    wickets_per_innings: wickets,
  };
}

/** A tournament's stages, set by its organisers. */
export const TOURNAMENT_STATUSES: ReadonlySet<string> = new Set([
  "upcoming",
  "ongoing",
  "completed",
]);

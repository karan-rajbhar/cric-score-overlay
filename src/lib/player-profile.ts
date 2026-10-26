/**
 * What a player says about themselves on their profile: where they are,
 * their main role and how they bat and bowl. All optional, stored on
 * `users/{id}` (public: no contact details here).
 */

export const PLAYING_ROLES = [
  ["batter", "Batter"],
  ["bowler", "Bowler"],
  ["all_rounder", "All-rounder"],
  ["wicket_keeper", "Wicket-keeper"],
] as const;

export const BATTING_HANDS = [
  ["right", "Right-hand bat"],
  ["left", "Left-hand bat"],
] as const;

export const BOWLING_STYLES = [
  ["right_arm_fast", "Right-arm fast"],
  ["right_arm_medium", "Right-arm medium"],
  ["right_arm_off_break", "Right-arm off break"],
  ["right_arm_leg_break", "Right-arm leg break"],
  ["left_arm_fast", "Left-arm fast"],
  ["left_arm_medium", "Left-arm medium"],
  ["left_arm_orthodox", "Left-arm orthodox"],
  ["left_arm_wrist_spin", "Left-arm wrist spin"],
] as const;

export const LOCATION_MAX = 60;

export type PlayingRole = (typeof PLAYING_ROLES)[number][0];
export type BattingHand = (typeof BATTING_HANDS)[number][0];
export type BowlingStyle = (typeof BOWLING_STYLES)[number][0];

export interface PlayerDetails {
  location: string | null;
  playing_role: PlayingRole | null;
  batting_hand: BattingHand | null;
  bowling_style: BowlingStyle | null;
}

const labelOf = (
  list: readonly (readonly [string, string])[],
  value: string | null | undefined,
): string | null => list.find(([v]) => v === value)?.[1] ?? null;

export const playingRoleLabel = (v: string | null | undefined) =>
  labelOf(PLAYING_ROLES, v);

/** "Right-hand bat · Right-arm off break · Pune", whatever is set. */
export function playerDetailLine(
  p: Partial<PlayerDetails>,
  extra: Array<string | null | undefined> = [],
): string {
  return [
    labelOf(BATTING_HANDS, p.batting_hand),
    labelOf(BOWLING_STYLES, p.bowling_style),
    p.location?.trim() || null,
    ...extra,
  ]
    .filter(Boolean)
    .join(" · ");
}

function pick<T extends string>(
  list: readonly (readonly [T, string])[],
  value: unknown,
): T | null | undefined {
  if (value === null || value === "" || value === undefined) return null;
  return list.some(([v]) => v === value) ? (value as T) : undefined;
}

export type PlayerDetailsResult =
  | { ok: true; value: PlayerDetails }
  | { ok: false; error: string };

/** Checks a submitted form; empty values clear the field. */
export function cleanPlayerDetails(raw: {
  location?: unknown;
  playing_role?: unknown;
  batting_hand?: unknown;
  bowling_style?: unknown;
}): PlayerDetailsResult {
  const location =
    typeof raw.location === "string"
      ? raw.location.trim().replace(/\s+/g, " ")
      : "";
  if (location.length > LOCATION_MAX) {
    return { ok: false, error: `Location: at most ${LOCATION_MAX} characters` };
  }
  const playing_role = pick(PLAYING_ROLES, raw.playing_role);
  const batting_hand = pick(BATTING_HANDS, raw.batting_hand);
  const bowling_style = pick(BOWLING_STYLES, raw.bowling_style);
  if (
    playing_role === undefined ||
    batting_hand === undefined ||
    bowling_style === undefined
  ) {
    return { ok: false, error: "Choose one of the listed options" };
  }
  return {
    ok: true,
    value: {
      location: location || null,
      playing_role,
      batting_hand,
      bowling_style,
    },
  };
}

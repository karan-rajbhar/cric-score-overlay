"use client";

import { ChoiceGroup } from "~/components/ds/field";
import { clubSideOptions } from "~/lib/club-side-text";
import type { ClubSide } from "~/lib/firebase/types";

/**
 * "Whose stats count for <club>?": Both teams / Only <team1> / Only
 * <team2>, each saying what it means. The one control for a club match's
 * `club_side`, wherever it is set (new match, Add to club, Match settings),
 * so it reads the same everywhere. `value` null: nothing picked yet.
 */
export function ClubSideChoice({
  clubName,
  team1Name,
  team2Name,
  value,
  onChange,
  name = "club-side",
  className,
}: {
  clubName: string;
  team1Name: string;
  team2Name: string;
  value: ClubSide | null;
  onChange: (side: ClubSide) => void;
  /** Radio group name: unique on the page. */
  name?: string;
  className?: string;
}) {
  return (
    <ChoiceGroup
      legend={`Whose stats count for ${clubName}?`}
      name={name}
      layout="cards"
      value={value}
      onChange={onChange}
      options={clubSideOptions(team1Name, team2Name)}
      className={className}
    />
  );
}

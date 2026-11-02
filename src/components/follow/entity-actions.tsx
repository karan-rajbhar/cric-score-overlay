"use client";

import { CalendarSubscribe } from "~/components/calendar/calendar-subscribe";
import { cn } from "~/lib/utils";
import { FollowButton } from "./follow-button";

type EntityKind = "team" | "tournament" | "club" | "player" | "match";

/**
 * Follow and Add to calendar for a detail page header, as one insertion:
 * teams and tournaments get both, a club its calendar, a player or a
 * match the follow button.
 */
export function EntityActions({
  kind,
  id,
  name,
  only,
  className,
}: {
  kind: EntityKind;
  id: string;
  name: string;
  /** Just one of them: a phone's bar has Follow, its ⋯ sheet the calendar. */
  only?: "follow" | "calendar";
  /** Wraps the buttons in a row (pages that have no actions slot). */
  className?: string;
}) {
  const follow = kind !== "club" && only !== "calendar" && (
    <FollowButton kind={kind} id={id} name={name} />
  );
  const calendar = only !== "follow" &&
    (kind === "team" || kind === "tournament" || kind === "club") && (
      <CalendarSubscribe scope={kind} id={id} name={name} />
    );
  if (className === undefined) {
    return (
      <>
        {follow}
        {calendar}
      </>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {follow}
      {calendar}
    </div>
  );
}

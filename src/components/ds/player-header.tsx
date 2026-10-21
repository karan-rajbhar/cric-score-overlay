import type * as React from "react";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import type { TeamRef } from "~/components/ds/score";
import { cn } from "~/lib/utils";

/**
 * Profile header, after Scoreline's player page: given names light, family
 * name large, role under it, team in a white pill, photo or initials on the
 * right. Transparent: put it on a ScreenWash.
 */
export function PlayerHeader({
  name,
  role,
  detail,
  team,
  photoUrl,
  actions,
  className,
}: {
  name: string;
  /** "Batter", "All-rounder". */
  role?: string;
  /** "Right-hand bat · Right-arm off break". */
  detail?: string;
  team?: TeamRef;
  photoUrl?: string | null;
  actions?: React.ReactNode;
  className?: string;
}) {
  const words = name.trim().split(/\s+/);
  const family = words.length > 1 ? words.at(-1) : name;
  const given = words.length > 1 ? words.slice(0, -1).join(" ") : null;
  return (
    <section className={cn("flex items-center gap-4", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-balance leading-none">
          {given && (
            <span className="block text-xl font-normal text-foreground">
              {given}
            </span>
          )}
          <span className="mt-1 block text-[2.5rem] font-semibold leading-none tracking-tight text-foreground">
            {family}
          </span>
        </h1>
        {role && (
          <p className="mt-3 text-sm font-medium text-foreground">{role}</p>
        )}
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        {team && (
          <span className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 text-sm font-medium text-foreground shadow-soft">
            <TeamCrest {...team} size="xs" />
            <span className="truncate">{team.name}</span>
          </span>
        )}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <Avatar
        name={name}
        src={photoUrl}
        size="xl"
        className="ring-4 ring-card sm:h-24 sm:w-24 sm:text-2xl"
      />
    </section>
  );
}

/**
 * The same header for a team, club or tournament: labels on top (type,
 * season), the name large, a line of description and contact details, the
 * crest on the right, actions under it. Transparent: put it on the wash.
 */
export function ProfileHeader({
  name,
  crest,
  labels,
  description,
  meta,
  actions,
  bannerUrl,
  className,
}: {
  name: string;
  /** TeamCrest (size "xl") or a logo. */
  crest?: React.ReactNode;
  labels?: React.ReactNode;
  description?: React.ReactNode;
  /** MetaItems and links. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** A wide picture above the header. */
  bannerUrl?: string | null;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- user upload
        <img
          src={bannerUrl}
          alt=""
          className="h-28 w-full rounded-panel object-cover shadow-soft sm:h-40"
        />
      )}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {labels && <div className="flex flex-wrap gap-1.5">{labels}</div>}
          <h1 className="mt-2 text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.25rem]">
            {name}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {crest && <div className="shrink-0">{crest}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

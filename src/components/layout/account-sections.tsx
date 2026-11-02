"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  LogOut,
  Mail,
  PlusCircle,
  Shield,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "~/components/ds/avatar";
import { ListCard, ListRow, SectionHeader } from "~/components/ds/list";
import { Segmented } from "~/components/ds/tabs";
import { InviteDialog } from "~/components/invite-dialog";
import { NotificationSettings } from "~/components/follow/push-settings";
import { useInstallApp } from "~/components/pwa/install-app";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/lib/auth";
import { useSignOut, useUsername } from "~/lib/hooks/useAccount";
import { useTheme, type Theme } from "~/lib/theme-provider";

const PLACES = [
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserCheck },
] as const;

const CREATE = [
  { href: "/matches/create", label: "New match", icon: PlusCircle },
  { href: "/teams/create", label: "New team", icon: Users },
  { href: "/tournaments/create", label: "New tournament", icon: Trophy },
  { href: "/clubs/create", label: "New club", icon: Shield },
] as const;

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      className="h-[1.125rem] w-[1.125rem] shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

/** Sign in, or who is signed in with a link to their profile. */
export function AccountCard() {
  const { user, loading } = useAuth();
  const username = useUsername();
  if (loading) return <div className="h-16" aria-hidden="true" />;
  if (!user) {
    return (
      <div className="rounded-2xl bg-primary-soft/60 p-4">
        <p className="text-sm font-semibold text-foreground">
          Score your club&apos;s matches
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          CricScore is invite-only: sign in with the Google account your invite
          was sent to.
        </p>
        <Button asChild className="mt-3 w-full">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }
  const name = (user.user_metadata?.full_name as string | undefined) ?? "You";
  return (
    <ListCard>
      <ListRow
        href={`/players/${username ? `@${username}` : user.id}`}
        leading={
          <Avatar
            name={name}
            src={user.user_metadata?.avatar_url as string | undefined}
            size="md"
          />
        }
        title={name}
        subtitle={`${username ? `@${username} · ` : ""}My profile`}
      />
    </ListCard>
  );
}

/** Places with no tab of their own, for anyone. */
export function PlacesSection() {
  return (
    <ListCard>
      {PLACES.map(({ href, label, icon }) => (
        <ListRow
          key={href}
          href={href}
          leading={<RowIcon icon={icon} />}
          title={label}
        />
      ))}
    </ListCard>
  );
}

/** Everything a signed-in user can start. */
export function CreateSection() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Create" />
      <ListCard>
        {CREATE.map(({ href, label, icon }) => (
          <ListRow
            key={href}
            href={href}
            leading={<RowIcon icon={icon} />}
            title={label}
          />
        ))}
      </ListCard>
    </section>
  );
}

/** Inviting people, and the app on this device. */
export function InvitesSection() {
  const install = useInstallApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <section className="space-y-3">
      <SectionHeader title="Invites" />
      <ListCard>
        <ListRow
          onClick={() => setInviteOpen(true)}
          leading={<RowIcon icon={UserPlus} />}
          title="Invite someone"
        />
        <ListRow
          href="/invitations"
          leading={<RowIcon icon={Mail} />}
          title="Manage invites"
        />
        {install && (
          <ListRow
            onClick={install}
            leading={<RowIcon icon={Download} />}
            title="Install app"
          />
        )}
      </ListCard>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </section>
  );
}

/** Theme and notifications, and Sign out when signed in. */
export function SettingsSection() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { signOut, pending } = useSignOut();
  return (
    <section className="space-y-3">
      <SectionHeader title="Settings" />
      {user && <NotificationSettings />}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">Theme</span>
        <Segmented
          label="Theme"
          options={THEMES}
          value={theme}
          onChange={setTheme}
          className="w-full justify-between"
        />
      </div>
      {user && (
        <ListCard>
          <ListRow
            onClick={() => void signOut()}
            disabled={pending}
            leading={<LogOut className="h-[1.125rem] w-[1.125rem] shrink-0 text-destructive" aria-hidden="true" />}
            title={<span className="text-destructive">Sign out</span>}
          />
        </ListCard>
      )}
    </section>
  );
}

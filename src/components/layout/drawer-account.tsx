"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  LogOut,
  Mail,
  PlusCircle,
  Shield,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar } from "~/components/ds/avatar";
import { Segmented } from "~/components/ds/tabs";
import { InviteDialog } from "~/components/invite-dialog";
import { DrawerNotifications } from "~/components/follow/push-settings";
import { useInstallApp } from "~/components/pwa/install-app";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/lib/auth";
import { useSignOut, useUsername } from "~/lib/hooks/useAccount";
import { useTheme, type Theme } from "~/lib/theme-provider";
import { cn } from "~/lib/utils";

const rowClass =
  "flex min-h-[44px] w-full items-center gap-3 rounded-full px-3.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

const CREATE = [
  { href: "/matches/create", label: "New match", icon: PlusCircle },
  { href: "/teams/create", label: "New team", icon: Users },
  { href: "/tournaments/create", label: "New tournament", icon: Trophy },
  { href: "/clubs/create", label: "New club", icon: Shield },
] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 px-3 text-xs font-medium text-muted-foreground/75">
      {children}
    </div>
  );
}

/**
 * The top of the phone drawer, which stands in for the header on phones:
 * Sign in, or who is signed in with a link to their profile.
 */
export function DrawerAccount({ onNavigate }: { onNavigate: () => void }) {
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
          <Link href="/auth/login" onClick={onNavigate}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }
  const name = (user.user_metadata?.full_name as string | undefined) ?? "You";
  return (
    <Link
      href={`/players/${username ? `@${username}` : user.id}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 transition-colors hover:bg-accent"
    >
      <Avatar
        name={name}
        src={user.user_metadata?.avatar_url as string | undefined}
        size="md"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {username ? `@${username} · ` : ""}My profile
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}

/** Create, invites and install: the header's menus, in the drawer. */
export function DrawerActions({ onNavigate }: { onNavigate: () => void }) {
  const { user } = useAuth();
  const install = useInstallApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  if (!user) return null;
  return (
    <>
      <div className="space-y-1">
        <SectionTitle>Create</SectionTitle>
        {CREATE.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={rowClass}
          >
            <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
            {label}
          </Link>
        ))}
      </div>
      <div className="space-y-1">
        <SectionTitle>Invites</SectionTitle>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className={rowClass}
        >
          <UserPlus className="h-[1.125rem] w-[1.125rem] shrink-0" />
          Invite someone
        </button>
        <Link href="/invitations" onClick={onNavigate} className={rowClass}>
          <Mail className="h-[1.125rem] w-[1.125rem] shrink-0" />
          Manage invites
        </Link>
        {install && (
          <button type="button" onClick={install} className={rowClass}>
            <Download className="h-[1.125rem] w-[1.125rem] shrink-0" />
            Install app
          </button>
        )}
      </div>
      <DrawerNotifications />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** The bottom of the drawer: theme, and Sign out when signed in. */
export function DrawerFooter() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { signOut, pending } = useSignOut();
  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <div className="space-y-2 px-1">
        <span className="block px-2 text-xs font-medium text-muted-foreground/75">
          Theme
        </span>
        <Segmented
          label="Theme"
          options={THEMES}
          value={theme}
          onChange={setTheme}
          className="w-full justify-between"
        />
      </div>
      {user && (
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={pending}
          className={cn(
            rowClass,
            "text-destructive hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <LogOut className="h-[1.125rem] w-[1.125rem] shrink-0" />
          Sign out
        </button>
      )}
    </div>
  );
}

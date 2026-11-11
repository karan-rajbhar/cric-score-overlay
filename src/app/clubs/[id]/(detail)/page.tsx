import { ClubMembershipButton } from "~/components/clubs/club-membership-button";
import {
  ClubPendingInvites,
  type PendingClubInvite,
} from "~/components/clubs/club-pending-invites";
import { ClubMatchesTab } from "~/components/clubs/club-matches-tab";
import {
  ClubStatsTab,
  type ClubBatterLeader,
  type ClubBowlerLeader,
} from "~/components/clubs/club-stats-tab";
import { InviteMemberDialog } from "~/components/clubs/invite-member-dialog";
import {
  MemberActions,
} from "~/components/clubs/member-role-action";
import { ShowMoreLink } from "~/components/layout/pager";
import { Avatar } from "~/components/ds/avatar";
import { Chip } from "~/components/ds/chip";
import { PlayerLink } from "~/components/ds/player-link";
import { shortDate } from "~/lib/dates";
import { playerHrefOf } from "~/lib/player-href";
import { Card, CardContent } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Users } from "lucide-react";
import {
  clubMilestonesFromList,
  clubMilestonesOf,
  type ClubMilestoneAggregates,
  type MilestoneMatch,
} from "~/lib/firebase/club-milestones";
import {
  freshenOpenInnings,
  loadScopeLeaderboard,
  type ScopeMatch,
} from "~/lib/firebase/leaderboards";
import { isOpenClubInvite } from "~/lib/firebase/rpc/access";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import {
  loadClubViewer,
  MATCH_PAGE,
  MEMBER_COLUMNS,
  MEMBER_PAGE,
  shownCount,
  type ClubViewer,
  type MatchRow,
  type MemberRow,
  type SeasonRow,
} from "../club-view";

export const dynamic = "force-dynamic";

const MATCH_COLUMNS = `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                result_type, win_margin, win_margin_type, result_description, season_id, club_side,
                ${MATCH_TEAM_COLUMNS},
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
            `;

/**
 * The club tabs that cost reads to fill. This page is what re-renders when
 * `?tab=` changes: the layout, with the header and the cheap tabs, does not
 * (layouts do not re-render on navigation), so opening a tab reads only that
 * tab and a visitor who opens none pays for none. See `OnDemandTabs`.
 */
export default async function ClubTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string; matches?: string; members?: string }>;
}) {
  const { id } = await params;
  const shown = await searchParams;
  const tab = shown?.tab;
  if (tab !== "matches" && tab !== "stats" && tab !== "members") return null;
  const viewer = await loadClubViewer(id);
  if (tab === "matches") return <MatchesTab viewer={viewer} raw={shown?.matches} />;
  if (tab === "stats") return <StatsTab viewer={viewer} />;
  return <MembersTab viewer={viewer} raw={shown?.members} />;
}

async function MatchesTab({ viewer, raw }: { viewer: ClubViewer; raw?: string }) {
  const { db, club, isAdmin } = viewer;
  const matchLimit = shownCount(raw, MATCH_PAGE);
  const [{ data: matchRows }, { data: seasons }] = await Promise.all([
    db
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("club_id", club.id)
      .order("scheduled_at", { ascending: false })
      .limit(matchLimit + 1),
    db
      .from("club_seasons")
      .select("id, name, start_date, end_date, is_current")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false }),
  ]);
  const typedMatches = (await attachMatchTeams(
    db,
    (matchRows ?? []).slice(0, matchLimit),
  )) as unknown as MatchRow[];
  const moreMatches = (matchRows ?? []).length > matchLimit;
  // The listed live matches show their innings in play: reading them brings
  // the scores up to date (the summary on the match does not follow a ball).
  const live = typedMatches.filter((m) => m.status === "live");
  await freshenOpenInnings(db, live as unknown as ScopeMatch[]);
  return (
    <>
      <ClubMatchesTab
        clubId={club.id}
        matches={typedMatches}
        seasons={(seasons ?? []) as unknown as SeasonRow[]}
        isAdmin={isAdmin}
      />
      {moreMatches && (
        <ShowMoreLink
          href={`/clubs/${club.id}?tab=matches&matches=${matchLimit + MATCH_PAGE}`}
          label="Show older matches"
        />
      )}
    </>
  );
}

async function StatsTab({ viewer }: { viewer: ClubViewer }) {
  const { db, club } = viewer;
  // Innings in play feed the leaderboard and the milestones; the rest are
  // aggregations, so this costs the same for 5 matches or 500.
  const liveMatches = (await attachMatchTeams(
    db,
    (
      await db
        .from("matches")
        .select(`${MATCH_COLUMNS}, summary_runs, summary_wickets`)
        .eq("club_id", club.id)
        .eq("status", "live")
    ).data ?? [],
  )) as unknown as Array<MatchRow & MilestoneMatch>;
  const { data: aggregates } = await db.rpc<ClubMilestoneAggregates>(
    "club_milestones",
    { p_club_id: club.id, p_live_count: liveMatches.length },
  );
  // No aggregates (an index still building): the figures from the list, not
  // "no statistics" for a club with matches.
  const listed = aggregates
    ? []
    : ((await attachMatchTeams(
        db,
        (
          await db
            .from("matches")
            .select(MATCH_COLUMNS)
            .eq("club_id", club.id)
            .order("scheduled_at", { ascending: false })
            .limit(MATCH_PAGE)
        ).data ?? [],
      )) as unknown as Array<MatchRow & MilestoneMatch>);
  const hasMatches = aggregates ? aggregates.matches > 0 : listed.length > 0;
  const leaderboardData = hasMatches
    ? await loadScopeLeaderboard(
        db,
        "club",
        club.id,
        (aggregates ? liveMatches : listed) as unknown as ScopeMatch[],
      )
    : null;
  const battingLeaders: ClubBatterLeader[] = (leaderboardData?.batting ?? []).map(
    (b) => ({
      userId: b.userId,
      name: b.name,
      avatar: b.avatar,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      inningsCount: b.innings,
      highestScore: b.highestScore,
      strikeRate: b.strikeRateDisplay,
    }),
  );
  const bowlingLeaders: ClubBowlerLeader[] = (leaderboardData?.bowling ?? []).map(
    (bw) => ({
      userId: bw.userId,
      name: bw.name,
      avatar: bw.avatar,
      wickets: bw.wickets,
      overs: bw.overs,
      runs: bw.runsConceded,
      economy: bw.economyDisplay,
    }),
  );
  return (
    <ClubStatsTab
      clubId={club.id}
      clubName={club.name}
      milestones={
        aggregates
          ? clubMilestonesOf(
              {
                ...aggregates,
                top: await attachMatchTeams(db, aggregates.top),
              },
              liveMatches,
            )
          : clubMilestonesFromList(listed)
      }
      battingLeaders={battingLeaders}
      bowlingLeaders={bowlingLeaders}
      leaderboardData={leaderboardData}
    />
  );
}

async function MembersTab({ viewer, raw }: { viewer: ClubViewer; raw?: string }) {
  const { db, club, user, isOwner, isAdmin, isMember } = viewer;
  const memberLimit = shownCount(raw, MEMBER_PAGE);
  const membersOfClub = () =>
    db
      .from("club_memberships")
      .select(MEMBER_COLUMNS)
      .eq("club_id", club.id)
      .order("joined_at", { ascending: true });
  // Admins manage every member; everyone else sees a page at a time.
  let typedMembers = ((await membersOfClub().limit(memberLimit + 1)).data ??
    []) as unknown as MemberRow[];
  let moreMembers = typedMembers.length > memberLimit;
  if (moreMembers && isAdmin) {
    typedMembers = ((await membersOfClub()).data ?? []) as unknown as MemberRow[];
    moreMembers = false;
  } else {
    typedMembers = typedMembers.slice(0, memberLimit);
  }

  // Admins see the club's invites still waiting for a first sign-in.
  const pendingInvites: PendingClubInvite[] = isAdmin
    ? (
        ((
          await db
            .from("club_invitations")
            .select("id, email, status, expires_at, created_at")
            .eq("club_id", club.id)
        ).data ?? []) as Array<{
          id: string;
          email: string | null;
          status: string | null;
          expires_at: string | null;
          created_at: string | null;
        }>
      )
        .filter((i) => i.email && isOpenClubInvite(i))
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .map((i) => ({ id: i.id, email: i.email!, created_at: i.created_at }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Members
          </h2>
          <p className="text-xs text-muted-foreground">
            Owners, administrators, coaches, and registered players.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <InviteMemberDialog clubId={club.id} clubName={club.name} />
          )}
          <ClubMembershipButton
            clubId={club.id}
            isMember={isMember}
            isOwner={isOwner}
            isAuthenticated={!!user}
          />
        </div>
      </div>

      {isAdmin && (
        <ClubPendingInvites
          invites={pendingInvites}
          club={{ id: club.id, name: club.name }}
        />
      )}

      <Card>
        <CardContent className="p-0">
          {typedMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="No players or club administrators are registered in this club directory yet."
              className="border-0 bg-transparent py-12"
            />
          ) : (
            <div className="divide-y divide-border text-sm">
              {typedMembers.map((m) => {
                const isClubOwner = m.role === "owner";
                const isClubAdmin = m.role === "admin";
                const name = m.user?.full_name ?? "Unnamed member";
                // The name has the first line to itself on a phone; the
                // role and date go under it and the actions in a row menu
                // (/design#spec-row-actions).
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={name} src={m.user?.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-semibold text-foreground">
                        <PlayerLink name={name} href={playerHrefOf(m.user?.id)} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Chip
                          tone={
                            isClubOwner
                              ? "primary"
                              : isClubAdmin
                                ? "neutral"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {m.role}
                        </Chip>
                        {m.joined_at && <span>Joined {shortDate(m.joined_at)}</span>}
                      </div>
                    </div>
                    <MemberActions
                      clubId={club.id}
                      membershipId={m.id}
                      currentRole={m.role}
                      userName={name}
                      canChangeRole={isOwner && !isClubOwner}
                      canRemove={
                        (isOwner || (isAdmin && !isClubAdmin)) && !isClubOwner
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {moreMembers && (
        <ShowMoreLink
          href={`/clubs/${club.id}?tab=members&members=${memberLimit + MEMBER_PAGE}`}
          label="Show more members"
        />
      )}
    </div>
  );
}

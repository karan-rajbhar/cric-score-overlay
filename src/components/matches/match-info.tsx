"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Calendar,
  MapPin,
  Trophy,
  Users,
  Hash,
  Clock,
  CircleDot,
  Layers,
  CloudSun,
  Landmark,
} from "lucide-react";
import type { Match } from "~/lib/match-types";
import { formatPlayerRole } from "~/lib/cricket";

interface MatchInfoProps {
  match: Match;
}

export function MatchInfo({ match }: MatchInfoProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTossWinnerName = () => {
    if (match.toss_winner_team_id === match.team1_id) return match.team1.name;
    if (match.toss_winner_team_id === match.team2_id) return match.team2.name;
    return "Not decided";
  };

  const getPlayerRole = (role?: string | null) => formatPlayerRole(role);

  return (
    <Tabs defaultValue="match-info" className="w-full">
      <TabsList className="mb-4 grid h-auto w-full grid-cols-2">
        <TabsTrigger
          value="match-info"
          className="px-1.5 sm:px-3"
        >
          <Hash className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="truncate">Match info</span>
        </TabsTrigger>
        <TabsTrigger
          value="squads"
          className="px-1.5 sm:px-3"
        >
          <Users className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="truncate">Squads</span>
        </TabsTrigger>
      </TabsList>

      {/* Match Info Tab */}
      <TabsContent value="match-info">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Basic Info */}
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border/50 py-3.5">
              <CardTitle className="text-base sm:text-lg">Match details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Format
                  </p>
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {match.match_format}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  <CircleDot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Overs
                  </p>
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {match.overs_per_innings} overs per innings
                  </p>
                </div>
              </div>

              {match.ball_type && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <CircleDot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Ball type
                    </p>
                    <p className="font-semibold capitalize text-foreground text-sm sm:text-base">
                      {match.ball_type}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Venue
                  </p>
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {match.venue || "Not specified"}
                  </p>
                </div>
              </div>

              {match.scheduled_at && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Date & time
                    </p>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {formatDate(match.scheduled_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(match.scheduled_at)}
                    </p>
                  </div>
                </div>
              )}

              {match.actual_start_time && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Actual start
                    </p>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {formatTime(match.actual_start_time)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Toss & Conditions */}
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border/50 py-3.5">
              <CardTitle className="text-base sm:text-lg">Toss & conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Toss
                  </p>
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {match.toss_winner_team_id ? (
                      <>
                        {getTossWinnerName()} won the toss and elected to{" "}
                        <span className="font-semibold">
                          {match.toss_decision === "bowl" ? "bowl" : "bat"}
                        </span>
                      </>
                    ) : (
                      "Toss not conducted yet"
                    )}
                  </p>
                </div>
              </div>

              {match.weather_conditions && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <CloudSun className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Weather
                    </p>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {match.weather_conditions}
                    </p>
                  </div>
                </div>
              )}

              {match.pitch_conditions && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Pitch
                    </p>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {match.pitch_conditions}
                    </p>
                  </div>
                </div>
              )}

              {(match.umpire1_name || match.umpire2_name) && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Umpires
                    </p>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {[match.umpire1_name, match.umpire2_name]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match ID & Meta */}
          <Card className="md:col-span-2 overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border/50 py-3">
              <CardTitle className="text-base">Additional info</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Match ID</p>
                  <p className="font-mono text-xs break-all font-semibold text-foreground mt-0.5">
                    {match.id}
                  </p>
                </div>
                {match.tournament && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Tournament</p>
                    <p className="font-semibold text-sm text-foreground mt-0.5">
                      {match.tournament.name}
                    </p>
                  </div>
                )}
                {match.club && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Club</p>
                    <p className="font-semibold text-sm text-foreground mt-0.5">
                      {match.club.name}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Squads Tab */}
      <TabsContent value="squads">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Team 1 Squad */}
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border/50 py-3.5 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                    {match.team1.short_name?.slice(0, 2) ||
                      match.team1.name.slice(0, 2)}
                  </div>
                  {match.team1.name}
                </CardTitle>
                {match.team1.team_players && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {match.team1.team_players.length} players
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[50px] text-center text-xs font-medium text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Player
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right pr-4">
                      Role
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(match.team1.team_players || [])
                    .sort(
                      (a, b) =>
                        (a.batting_order || 99) - (b.batting_order || 99),
                    )
                    .map((tp, idx) => (
                      <TableRow key={tp.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-mono text-center text-xs font-semibold text-muted-foreground">
                          {tp.jersey_number || idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {tp.user?.full_name}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <span className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {getPlayerRole(tp.role_in_team)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {(!match.team1.team_players ||
                match.team1.team_players.length === 0) && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Squad not announced yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team 2 Squad */}
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader className="border-b border-border/50 py-3.5 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                    {match.team2.short_name?.slice(0, 2) ||
                      match.team2.name.slice(0, 2)}
                  </div>
                  {match.team2.name}
                </CardTitle>
                {match.team2.team_players && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {match.team2.team_players.length} players
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[50px] text-center text-xs font-medium text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Player
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right pr-4">
                      Role
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(match.team2.team_players || [])
                    .sort(
                      (a, b) =>
                        (a.batting_order || 99) - (b.batting_order || 99),
                    )
                    .map((tp, idx) => (
                      <TableRow key={tp.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-mono text-center text-xs font-semibold text-muted-foreground">
                          {tp.jersey_number || idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-foreground">
                          {tp.user?.full_name}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <span className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {getPlayerRole(tp.role_in_team)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {(!match.team2.team_players ||
                match.team2.team_players.length === 0) && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Squad not announced yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

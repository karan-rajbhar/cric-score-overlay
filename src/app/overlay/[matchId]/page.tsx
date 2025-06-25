"use client";

import { useEffect, useState } from "react";
import { supabase } from "~/lib/supabase";
import type { CricketMatch } from "~/types/cricket";

// Mock match data - replace with actual API call
const mockMatch: CricketMatch = {
  id: "1",
  title: "Mumbai Indians vs Chennai Super Kings",
  team1: {
    id: "team1",
    name: "Mumbai Indians",
    shortName: "MI",
    score: 185,
    wickets: 6,
    overs: 20.0,
    runRate: 9.25,
    players: [
      {
        id: "p1",
        name: "Rohit Sharma",
        runs: 45,
        balls: 32,
        fours: 4,
        sixes: 2,
        strikeRate: 140.6,
        isStriker: true,
      },
      {
        id: "p2",
        name: "Ishan Kishan",
        runs: 28,
        balls: 22,
        fours: 3,
        sixes: 1,
        strikeRate: 127.3,
        isStriker: false,
      },
    ],
    bowlers: [],
    extras: { wides: 5, noBalls: 2, byes: 3, legByes: 1, penalties: 0 },
  },
  team2: {
    id: "team2",
    name: "Chennai Super Kings",
    shortName: "CSK",
    score: 165,
    wickets: 8,
    overs: 20.0,
    runRate: 8.25,
    players: [],
    bowlers: [
      {
        id: "b1",
        name: "Deepak Chahar",
        overs: 4,
        maidens: 0,
        runs: 32,
        wickets: 2,
        economy: 8.0,
        isCurrentBowler: true,
      },
    ],
    extras: { wides: 8, noBalls: 1, byes: 2, legByes: 4, penalties: 0 },
  },
  currentInnings: 2,
  matchType: "T20",
  oversLimit: 20,
  target: 186,
  requiredRunRate: 12.5,
  currentOver: ["1", "4", "6", "W", "2"],
  partnership: { runs: 45, balls: 32 },
  status: "live",
  venue: "Wankhede Stadium",
  startTime: new Date(),
};

interface Props {
  params: { matchId: string };
}

export default function OverlayPage({ params }: Props) {
  const [match, setMatch] = useState<CricketMatch>(mockMatch);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Set up real-time subscription for match updates
    const channel = supabase
      .channel(`match_${params.matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${params.matchId}`,
        },
        (payload) => {
          console.log("Match update received:", payload);
          // Update match state with new data
          if (payload.new) {
            setMatch(payload.new as CricketMatch);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.matchId]);

  const battingTeam = match.currentInnings === 1 ? match.team1 : match.team2;
  const bowlingTeam = match.currentInnings === 1 ? match.team2 : match.team1;

  return (
    <div className="fixed inset-0 bg-transparent pointer-events-none">
      {/* Connection status indicator */}
      <div className="absolute top-4 right-4">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>

      {/* Main scoreboard overlay */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="overlay-scoreboard max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="text-2xl font-bold">{match.title}</div>
            <div className="text-sm opacity-75">{match.venue}</div>
          </div>

          {/* Main score display */}
          <div className="grid grid-cols-2 gap-8 mb-4">
            {/* Team 1 */}
            <div className="text-center">
              <div className="text-xl font-semibold mb-2">{match.team1.shortName}</div>
              <div className="text-3xl font-bold">
                {match.team1.score}/{match.team1.wickets}
              </div>
              <div className="text-lg">({match.team1.overs} overs)</div>
              <div className="text-sm opacity-75">RR: {match.team1.runRate.toFixed(2)}</div>
            </div>

            {/* Team 2 */}
            <div className="text-center">
              <div className="text-xl font-semibold mb-2">{match.team2.shortName}</div>
              <div className="text-3xl font-bold">
                {match.team2.score}/{match.team2.wickets}
              </div>
              <div className="text-lg">({match.team2.overs} overs)</div>
              <div className="text-sm opacity-75">RR: {match.team2.runRate.toFixed(2)}</div>
            </div>
          </div>

          {/* Current batting info */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-sm opacity-75 mb-1">Current Partnership</div>
              <div className="text-lg font-semibold">
                {match.partnership.runs} runs ({match.partnership.balls} balls)
              </div>
            </div>

            {/* Target info (if second innings) */}
            {match.currentInnings === 2 && match.target && (
              <div className="text-right">
                <div className="text-sm opacity-75 mb-1">Target: {match.target}</div>
                <div className="text-lg font-semibold text-orange-400">
                  Need: {match.target - battingTeam.score} runs
                </div>
                <div className="text-sm">
                  RRR: {match.requiredRunRate?.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Current batsmen */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-6">
              {battingTeam.players
                .filter(p => p.isStriker !== undefined)
                .map((player) => (
                  <div key={player.id} className="text-center">
                    <div className="text-sm opacity-75">
                      {player.name} {player.isStriker ? "*" : ""}
                    </div>
                    <div className="text-lg font-semibold">
                      {player.runs} ({player.balls})
                    </div>
                    <div className="text-xs opacity-60">
                      SR: {player.strikeRate?.toFixed(1)}
                    </div>
                  </div>
                ))}
            </div>

            {/* Current bowler */}
            {bowlingTeam.bowlers
              .filter(b => b.isCurrentBowler)
              .map((bowler) => (
                <div key={bowler.id} className="text-right">
                  <div className="text-sm opacity-75">{bowler.name}</div>
                  <div className="text-lg font-semibold">
                    {bowler.wickets}-{bowler.runs} ({bowler.overs} ov)
                  </div>
                  <div className="text-xs opacity-60">
                    Econ: {bowler.economy.toFixed(2)}
                  </div>
                </div>
              ))}
          </div>

          {/* Current over */}
          <div className="text-center">
            <div className="text-sm opacity-75 mb-2">This Over</div>
            <div className="flex justify-center space-x-2">
              {match.currentOver.map((ball, index) => (
                <div
                  key={index}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    ball === "W" ? "bg-red-500" :
                    ball === "4" ? "bg-green-500" :
                    ball === "6" ? "bg-purple-500" :
                    "bg-gray-600"
                  }`}
                >
                  {ball}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Match status indicator */}
      <div className="absolute top-4 left-4">
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          match.status === "live" ? "bg-red-500 animate-pulse" :
          match.status === "completed" ? "bg-green-500" :
          "bg-yellow-500"
        }`}>
          {match.status.toUpperCase()}
        </div>
      </div>
    </div>
  );
} 
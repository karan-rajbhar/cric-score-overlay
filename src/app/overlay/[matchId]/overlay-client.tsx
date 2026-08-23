"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "~/lib/supabase";

export interface LiveMatchState {
    match_id: string;
    title: string | null;
    status: string | null;
    match_format: string | null;
    overs_per_innings: number | null;
    venue: string | null;
    current_innings: number | null;
    current_over: number | null;
    current_ball: number | null;
    result_type: string | null;
    result_description: string | null;
    team1_name: string | null;
    team1_short_name: string | null;
    team2_name: string | null;
    team2_short_name: string | null;
    winning_team_name: string | null;
    innings_number: number | null;
    total_runs: number | null;
    total_wickets: number | null;
    total_overs: number | null;
    total_balls: number | null;
    extras_total: number | null;
    innings_completed: boolean | null;
    target_runs: number | null;
    batting_team_name: string | null;
    batting_team_short_name: string | null;
    bowling_team_name: string | null;
    bowling_team_short_name: string | null;
    striker_name: string | null;
    striker_runs: number | null;
    striker_balls: number | null;
    non_striker_name: string | null;
    non_striker_runs: number | null;
    non_striker_balls: number | null;
    current_bowler_name: string | null;
    bowler_balls: number | null;
    bowler_runs: number | null;
    bowler_wickets: number | null;
    partnership_runs: number | null;
    partnership_balls: number | null;
    this_over_balls: string | null;
    current_run_rate: number | null;
    runs_needed: number | null;
    balls_remaining: number | null;
    required_run_rate: number | null;
}

function oversText(balls: number | null): string {
    if (!balls) return "0.0";
    return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function BallChip({ label }: { label: string }) {
    let cls = "bg-white/10 text-white/90";
    if (label === "W") cls = "bg-red-600 text-white";
    else if (label === "4") cls = "bg-sky-500 text-white";
    else if (label === "6") cls = "bg-violet-500 text-white";
    else if (label.includes("wd") || label.includes("nb") || label.endsWith("b"))
        cls = "bg-amber-400 text-black";

    return (
        <span
            className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-sm font-semibold ${cls}`}
        >
            {label}
        </span>
    );
}

export function OverlayClient({
    matchId,
    initial,
}: {
    matchId: string;
    initial: LiveMatchState | null;
}) {
    const [state, setState] = useState<LiveMatchState | null>(initial);
    const [isConnected, setIsConnected] = useState(false);
    const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refetch = useCallback(async () => {
        const { data } = await supabase
            .from("live_match_state")
            .select("*")
            .eq("match_id", matchId)
            .single();
        if (data) setState(data as LiveMatchState);
    }, [matchId]);

    useEffect(() => {
        // Debounced refetch: a single ball triggers several table events.
        const scheduleRefetch = () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
            fetchTimer.current = setTimeout(() => void refetch(), 250);
        };

        const channel = supabase
            .channel(`overlay_${matchId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "ball_by_ball",
                    filter: `match_id=eq.${matchId}`,
                },
                scheduleRefetch
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "matches",
                    filter: `id=eq.${matchId}`,
                },
                scheduleRefetch
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "innings",
                    filter: `match_id=eq.${matchId}`,
                },
                scheduleRefetch
            )
            .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

        // Polling fallback for environments that throttle websockets
        // (e.g. hidden OBS browser sources).
        const poll = setInterval(() => void refetch(), 15000);

        return () => {
            void supabase.removeChannel(channel);
            clearInterval(poll);
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
        };
    }, [matchId, refetch]);

    if (!state) {
        return (
            <div className="fixed inset-0 flex items-center justify-center">
                <div className="rounded-lg bg-black/70 px-6 py-4 text-lg font-medium text-white">
                    Waiting for match data…
                </div>
            </div>
        );
    }

    const isLive = state.status === "live";
    const isComplete = state.status === "completed";
    const thisOverBalls = (state.this_over_balls ?? "").split(" ").filter(Boolean);

    return (
        <div className="fixed inset-0 bg-transparent p-6 pointer-events-none font-sans">
            {/* Connection indicator */}
            <div className="absolute top-5 right-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5">
                <span
                    className={`h-2 w-2 rounded-full ${
                        isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
                    }`}
                />
                <span className="text-xs font-medium tracking-wide text-white/80">
                    {isConnected ? "LIVE FEED" : "OFFLINE"}
                </span>
            </div>

            {/* Match status */}
            <div className="absolute top-5 left-5">
                <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white ${
                        isLive ? "bg-red-600" : isComplete ? "bg-emerald-600" : "bg-zinc-700"
                    }`}
                >
                    {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                    {state.status}
                </span>
            </div>

            <div className="absolute bottom-6 left-1/2 w-full max-w-3xl -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur-md">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
                    <span className="truncate text-sm font-semibold text-white/90">
                        {state.title}
                    </span>
                    <span className="ml-4 shrink-0 text-xs uppercase tracking-wider text-white/50">
                        {state.match_format} · {state.venue}
                    </span>
                </div>

                {isComplete ? (
                    /* Final result */
                    <div className="px-5 py-8 text-center">
                        <p className="text-3xl font-bold text-white">{state.result_description}</p>
                        {state.winning_team_name && (
                            <p className="mt-2 text-lg text-emerald-400">{state.winning_team_name}</p>
                        )}
                        <p className="mt-3 text-sm text-white/50 tabular-nums">
                            {state.team1_short_name} vs {state.team2_short_name}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Score row */}
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 px-5 py-4">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-white/50">
                                    {state.batting_team_short_name ?? state.batting_team_name} ·{" "}
                                    {state.innings_number === 2 ? "2nd" : "1st"} inn
                                </p>
                                <p className="mt-0.5 text-4xl font-bold leading-none text-white tabular-nums">
                                    {state.total_runs ?? 0}/{state.total_wickets ?? 0}
                                </p>
                                <p className="mt-1 text-sm text-white/60 tabular-nums">
                                    ({oversText(state.total_balls)} / {state.overs_per_innings} ov)
                                    · CRR{" "}
                                    <span className="tabular-nums">
                                        {state.current_run_rate ?? "—"}
                                    </span>
                                </p>
                            </div>

                            <div className="justify-self-center text-center">
                                <p className="text-[11px] uppercase tracking-widest text-white/40">
                                    This over
                                </p>
                                <div className="mt-1.5 flex gap-1.5">
                                    {thisOverBalls.length > 0 ? (
                                        thisOverBalls.map((b, idx) => <BallChip key={idx} label={b} />)
                                    ) : (
                                        <span className="text-xs text-white/30">—</span>
                                    )}
                                </div>
                                {state.partnership_runs !== null &&
                                    state.partnership_runs > 0 && (
                                        <p className="mt-2 text-xs text-white/50 tabular-nums">
                                            P&apos;ship {state.partnership_runs} ({oversText(state.partnership_balls)})
                                        </p>
                                    )}
                            </div>

                            <div className="justify-self-end text-right">
                                {state.target_runs !== null ? (
                                    <>
                                        <p className="text-[11px] uppercase tracking-widest text-white/40">
                                            Target {state.target_runs}
                                        </p>
                                        <p className="mt-0.5 text-xl font-bold text-amber-400 tabular-nums">
                                            Need {state.runs_needed} off {state.balls_remaining}
                                        </p>
                                        <p className="mt-0.5 text-xs text-white/60 tabular-nums">
                                            RRR {state.required_run_rate ?? "—"}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/50">
                                        {state.bowling_team_short_name ?? state.bowling_team_name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Players row */}
                        <div className="flex items-stretch justify-between border-t border-white/10 text-sm">
                            <div className="flex divide-x divide-white/10">
                                {[
                                    {
                                        name: state.striker_name,
                                        runs: state.striker_runs,
                                        balls: state.striker_balls,
                                        onStrike: true,
                                    },
                                    {
                                        name: state.non_striker_name,
                                        runs: state.non_striker_runs,
                                        balls: state.non_striker_balls,
                                        onStrike: false,
                                    },
                                ].map(
                                    (b, idx) =>
                                        b.name && (
                                            <div key={idx} className="px-5 py-2.5">
                                                <p className="font-medium text-white/90">
                                                    {b.name}
                                                    {b.onStrike && (
                                                        <span className="ml-1 text-emerald-400">*</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-white/55 tabular-nums">
                                                    {b.runs ?? 0} ({b.balls ?? 0})
                                                </p>
                                            </div>
                                        )
                                )}
                            </div>

                            {state.current_bowler_name && (
                                <div className="px-5 py-2.5 text-right">
                                    <p className="font-medium text-white/90">
                                        {state.current_bowler_name}
                                    </p>
                                    <p className="text-xs text-white/55 tabular-nums">
                                        {state.bowler_wickets ?? 0}-{state.bowler_runs ?? 0} (
                                        {oversText(state.bowler_balls)})
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getPartnerships } from "~/app/matches/queries";
import { supabase } from "~/lib/supabase/client";
import type { Match } from "~/lib/match-types";
import { Loader2 } from "lucide-react";

interface Partnership {
  id: string;
  innings_id: string;
  runs: number;
  balls: number;
  start_over: number;
  end_over?: number | null;
  is_current: boolean | null;
  batsman1: { full_name: string } | null;
  batsman2: { full_name: string } | null;
}

/** Partnerships as natively persisted by the scoring engine. */
export function MatchPartnerships({ match }: { match: Match }) {
  const [inningsGroups, setInningsGroups] = useState<Array<{
    inningsId: string;
    teamName: string;
    rows: Partnership[];
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPartnerships = async () => {
      const result = await getPartnerships(match.id);
      if (cancelled) return;
      if (result.error || !result.data) {
        setError(result.error ?? "Could not load partnerships");
        setInningsGroups([]);
        return;
      }

      const rows = result.data as unknown as Partnership[];
      const byInnings = new Map<string, Partnership[]>();
      for (const r of rows) {
        if (!byInnings.has(r.innings_id)) byInnings.set(r.innings_id, []);
        byInnings.get(r.innings_id)!.push(r);
      }

      setInningsGroups(
        [...byInnings.entries()].map(([inningsId, group]) => {
          const inn = match.innings?.find((i) => i.id === inningsId);
          return {
            inningsId,
            teamName: inn
              ? inn.team_id === match.team1_id
                ? match.team1.name
                : match.team2.name
              : "—",
            rows: group.sort((a, b) => a.start_over - b.start_over),
          };
        }),
      );
    };

    void fetchPartnerships();

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        match.id,
      );
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (isUuid) {
      channel = supabase
        .channel(`match_partnerships_${match.id}`)
        .on("broadcast", { event: "score_update" }, () => {
          void fetchPartnerships();
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [match]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Partnerships</CardTitle>
      </CardHeader>
      <CardContent>
        {inningsGroups === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : inningsGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No partnerships recorded yet.
          </p>
        ) : (
          <div className="space-y-6">
            {inningsGroups.map((g) => (
              <div key={g.inningsId}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.teamName}
                </p>
                <div className="space-y-1.5">
                  {g.rows.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                        p.is_current
                          ? "border-primary/40 bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {p.batsman1?.full_name ?? "—"} &amp;{" "}
                        {p.batsman2?.full_name ?? "—"}
                      </span>
                      <span className="tabular shrink-0 text-muted-foreground">
                        <strong className="text-foreground">{p.runs}</strong> (
                        {p.balls})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

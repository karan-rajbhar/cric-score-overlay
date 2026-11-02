"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MatchView } from "~/app/matches/[id]/match-detail";
import { matchTabFrom, type MatchTab } from "~/lib/match-tabs";
import { SAMPLE_MATCH, type MatchState } from "./sample-match";

/*
 * Dev-only: the real match page on sample data, in each state
 * (?state=finished|live|break|upcoming, ?scorer=1, ?tab=), for checking it at phone
 * width without a signed-in user or a database.
 */

function Preview() {
  const params = useSearchParams();
  const state = (params.get("state") ?? "finished") as MatchState;
  const match = SAMPLE_MATCH[state] ?? SAMPLE_MATCH.finished;
  const [tab, setTab] = useState<MatchTab>(() =>
    matchTabFrom(params.get("tab")),
  );
  // No ball log to read: the Balls tab and the charts show their empty states.
  const queries = useQueryClient();
  useMemo(() => {
    queries.setQueryData(["matchBallLog", match.id], []);
  }, [queries, match.id]);
  return (
    <MatchView
      match={match}
      isScorer={params.get("scorer") === "1"}
      activeTab={tab}
      onTabChange={setTab}
    />
  );
}

const noSubscribe = () => () => undefined;

/** In the browser only, like the real page (`MatchDetailsPage`). */
export default function MatchPreviewPage() {
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

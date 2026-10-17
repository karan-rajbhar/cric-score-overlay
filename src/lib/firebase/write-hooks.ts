/**
 * Server-side write hooks (the former Postgres triggers): run after every
 * successful builder write to keep derived documents in step.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { DataSource } from "./datasource";
import { refreshInningsSummary } from "./innings-summary";
import { refreshLiveScorecard } from "./live-scorecard-sync";
import { syncMatchParentSnapshots } from "./match-snapshots";
import type { WriteEvent } from "./query-builder";
import { maybeRecalculateStandings } from "./rpc/standings";
import { syncPlayerMatchesAfterWrite } from "./scorecard-sync";
import { syncTeamSnapshots } from "./team-snapshot";
import type { MatchesRow } from "./types";

export interface HookContext {
  ds: DataSource;
  db: Firestore | null;
}

export async function runWriteHooks(
  hc: HookContext,
  event: WriteEvent,
): Promise<void> {
  const { ds } = hc;
  if (event.table === "matches") {
    await maybeRecalculateStandings(
      ds,
      event.before as Partial<MatchesRow> | null,
      event.after as Partial<MatchesRow> | null,
    );
  }
  if (event.table === "matches" || event.table === "teams") {
    await syncTeamSnapshots(ds, event);
  }
  if (
    event.table === "matches" ||
    event.table === "tournaments" ||
    event.table === "clubs"
  ) {
    await syncMatchParentSnapshots(ds, event);
  }
  if (event.table === "matches" || event.table === "innings") {
    await syncPlayerMatchesAfterWrite(ds, event);
  }
  if (event.table === "innings") {
    const matchId = event.after?.match_id ?? event.before?.match_id;
    if (typeof matchId === "string") {
      await refreshInningsSummary(ds, matchId);
      await refreshLiveScorecard(ds, matchId, hc.db);
    }
  }
}

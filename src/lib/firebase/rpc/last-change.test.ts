/**
 * `live_state.last_change`: record_ball, undo_last_ball and update_ball
 * record who made the change (from the caller's session, no extra read);
 * every other live_state write keeps it.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { writeLiveState, type LiveStateDoc } from "../live-state";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
} from "../scoring/__fixtures__/golden";
import { stage2Driver } from "../scoring/__fixtures__/stage2";
import type { OversRow } from "../scorecard";
import { setCurrentBowler, undoLastBall, updateBall } from "./scoring";

describe.each([true, false])(
  "live_state.last_change (incremental: %s)",
  (incremental) => {
    it("names the scorer of the latest ball, undo or edit", async () => {
      const side = stage2Driver(syntheticTables(), incremental);
      const live = () =>
        side.ds
          .all("live_state")
          .find((d) => d.id === "M") as unknown as LiveStateDoc;
      const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
      side.ctx.scorerName = "Asha Rao";

      const before = Date.now();
      await replay.step({ kind: "ball", ball: { runs: 1 } });
      const first = live().last_change!;
      expect(first).toMatchObject({ uid: "admin-user", name: "Asha Rao" });
      expect(Date.parse(first.at)).toBeGreaterThanOrEqual(before - 1000);

      // A second scorer (also a match admin) records the next ball.
      const other = { ...side.ctx, uid: "co-scorer", scorerName: "Ben Ito" };
      const match = side.ds.all("matches").find((m) => m.id === "M")!;
      await side.ds.update("matches", "M", {
        match_admins: [
          ...((match.match_admins as string[]) ?? []),
          "co-scorer",
        ],
      });
      const prev = replay.driver.ctx;
      replay.driver.ctx = other;
      await replay.step({ kind: "ball", ball: { runs: 0 } });
      replay.driver.ctx = prev;
      expect(live().last_change).toMatchObject({
        uid: "co-scorer",
        name: "Ben Ito",
      });

      // Writes that are not ball-log changes keep it.
      await setCurrentBowler(side.ctx, "M", "b10").catch(() => undefined);
      await writeLiveState(side.ds, "M");
      expect(live().last_change).toMatchObject({ uid: "co-scorer" });

      await undoLastBall(side.ctx, "M");
      expect(live().last_change).toMatchObject({
        uid: "admin-user",
        name: "Asha Rao",
      });

      const ballId = (side.ds.all("overs") as unknown as OversRow[])[0]!
        .balls[0]!.id;
      await updateBall(other, {
        p_match_id: "M",
        p_ball_id: ballId,
        p_runs_scored: 2,
        p_extras: 0,
        p_extra_type: null,
        p_is_wicket: false,
      });
      expect(live().last_change).toMatchObject({ uid: "co-scorer" });
    });
  },
);

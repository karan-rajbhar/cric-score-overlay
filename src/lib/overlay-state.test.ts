import { describe, expect, it } from "vitest";
import {
  applyOverlayPatch,
  automaticRules,
  autoRulesIn,
  DEFAULT_AUTO_RULES,
  isAutomatic,
  manualAutoRules,
  overlayPatchOf,
  parseOverlayState,
  sceneOf,
  snapshotsOf,
  strapOnAir,
  type OverlayStateDoc,
} from "./overlay-state";

const NOW = 1_700_000_000_000;

describe("overlayPatchOf", () => {
  it("keeps what stays on air in the scene, field by field", () => {
    expect(overlayPatchOf({ type: "SET_THEME", theme: "light" }, NOW)).toEqual({
      scene: { theme: "light" },
    });
    expect(
      overlayPatchOf({ type: "SET_BROADCAST_VIEW", broadcastView: null }, NOW),
    ).toEqual({ scene: { view: null } });
    expect(
      overlayPatchOf({ type: "SHOW_CARD", card: "scorecard" }, NOW),
    ).toEqual({ scene: { card: "scorecard" } });
    expect(
      overlayPatchOf(
        { type: "TOGGLE_TICKER", visible: true, tickerText: " Next: Sat " },
        NOW,
      ),
    ).toEqual({ scene: { tickerVisible: true, tickerText: "Next: Sat" } });
  });

  it("maps old theme ids to the current themes", () => {
    expect(
      overlayPatchOf({ type: "SET_THEME", theme: "starsports" }, NOW),
    ).toEqual({
      scene: { theme: "standard" },
    });
  });

  it("turns an event card into a cue stamped with the server's time", () => {
    expect(
      overlayPatchOf(
        { type: "TRIGGER_STING", stingType: "six", id: "c1" },
        NOW,
      ),
    ).toEqual({ cue: { id: "c1", kind: "six", at: NOW } });
  });

  it("stores a lower third with when it went up, and only known fields", () => {
    const patch = overlayPatchOf(
      {
        type: "SHOW_STRAP",
        strap: {
          id: "s1",
          type: "custom",
          title: "Play resumes at 3:30",
          durationMs: 8000,
          // @ts-expect-error not a strap field
          onclick: "alert(1)",
        },
      },
      NOW,
    );
    expect(patch).toEqual({
      strap: {
        id: "s1",
        type: "custom",
        title: "Play resumes at 3:30",
        durationMs: 8000,
        at: NOW,
      },
    });
  });

  it("clears every one-off graphic", () => {
    expect(overlayPatchOf({ type: "PANIC_CLEAR" }, NOW)).toEqual({
      scene: { view: null, card: "none", hold: null },
      strap: null,
      cue: null,
    });
  });

  it("refuses what the overlay would not know", () => {
    expect(
      overlayPatchOf(
        { type: "TRIGGER_STING", stingType: "nope" as never },
        NOW,
      ),
    ).toBeNull();
    expect(
      overlayPatchOf({ type: "SET_LAYOUT", layout: "sideways" as never }, NOW),
    ).toBeNull();
    expect(
      overlayPatchOf(
        {
          type: "SET_CUSTOM_COLORS",
          customColors: { primary: "red", accent: "#fff" },
        },
        NOW,
      ),
    ).toBeNull();
    expect(overlayPatchOf({ type: "MADE_UP" }, NOW)).toBeNull();
    // A toggle without a value says nothing the server can store.
    expect(overlayPatchOf({ type: "TOGGLE_BUG" }, NOW)).toBeNull();
  });

  it("validates automatic rules", () => {
    expect(
      overlayPatchOf(
        {
          type: "SET_AUTO",
          auto: {
            wicket: { on: false, seconds: 999 },
            "Bad Id": { on: true, seconds: 4 },
          },
        },
        NOW,
      ),
    ).toEqual({ auto: { wicket: { on: false, seconds: 120 } } });
  });
});

describe("the stored state", () => {
  it("is what applying each command gives, and survives a read back", () => {
    let doc: OverlayStateDoc | null = null;
    const commands = [
      { type: "SET_THEME", theme: "custom", id: "a" },
      { type: "SET_LAYOUT", layout: "top", id: "b" },
      { type: "SHOW_CARD", card: "toss", id: "c" },
      { type: "TRIGGER_STING", stingType: "wicket", id: "d" },
    ] as const;
    for (const cmd of commands) {
      doc = applyOverlayPatch(doc, overlayPatchOf(cmd, NOW)!, cmd.id, NOW);
    }
    expect(doc).toMatchObject({
      version: 4,
      last_command_id: "d",
      scene: { theme: "custom", layout: "top", card: "toss" },
      cue: { id: "d", kind: "wicket", at: NOW },
    });
    expect(parseOverlayState(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("drops what is not valid when read", () => {
    const parsed = parseOverlayState({
      version: 2,
      scene: { theme: "volt", layout: "diagonal", card: "toss", sponsors: "x" },
      cue: { id: "x", kind: "dance", at: 1 },
    });
    expect(parsed?.scene).toEqual({ theme: "standard", card: "toss" });
    expect(parsed?.cue).toBeNull();
    expect(parseOverlayState(null)).toBeNull();
  });
});

describe("sceneOf", () => {
  it("starts from the defaults and the link, and the control room wins", () => {
    expect(sceneOf({}, null)).toMatchObject({
      theme: "standard",
      layout: "bottom",
      view: null,
      showBug: true,
      sound: false,
    });
    // Every old theme was a dark bar: Standard.
    expect(
      sceneOf({ layout: "compact", theme: "minimal" }, null),
    ).toMatchObject({
      layout: "compact",
      theme: "standard",
    });
    expect(sceneOf({ theme: "light" }, null).theme).toBe("light");
    // The old graphics-suite link shows the suite's scorebar.
    expect(sceneOf({ layout: "broadcast" }, null).view).toBe("1");
    expect(sceneOf({ layout: "compact" }, { layout: "top" }).layout).toBe(
      "top",
    );
  });
});

describe("lower thirds and automatic rules", () => {
  const base = applyOverlayPatch(
    null,
    overlayPatchOf(
      {
        type: "SHOW_STRAP",
        strap: { id: "s", type: "batsman", title: "", durationMs: 8000 },
      },
      NOW,
    )!,
    "s",
    NOW,
  );

  it("keeps a lower third on air for its duration only", () => {
    expect(strapOnAir(base, NOW + 7000)?.id).toBe("s");
    expect(strapOnAir(base, NOW + 9000)).toBeNull();
    const held = { ...base, strap: { ...base.strap!, durationMs: -1 } };
    expect(strapOnAir(held, NOW + 3_600_000)?.id).toBe("s");
  });

  it("is automatic until the producer takes over", () => {
    expect(isAutomatic(null)).toBe(true);
    expect(isAutomatic({ ...base, auto: manualAutoRules() })).toBe(false);
    expect(isAutomatic({ ...base, auto: DEFAULT_AUTO_RULES })).toBe(true);
    // Replays (off until OBS is set up) do not count.
    expect(
      isAutomatic({ ...base, auto: automaticRules(manualAutoRules()) }),
    ).toBe(true);
    expect(automaticRules(manualAutoRules()).replay_wicket?.on).toBe(false);
  });

  it("reads rules stored under the old ids", () => {
    const rules = autoRulesIn({
      ...base,
      auto: { wicket: { on: false, seconds: 9 }, milestone: { on: false, seconds: 5 } },
    });
    expect(rules.sting_wicket).toEqual({ on: false, seconds: 9 });
    expect(rules.batter_milestone?.on).toBe(false);
    expect(rules.hat_trick?.on).toBe(false);
    expect(rules.sting_six?.on).toBe(true);
  });
});

describe("Stream Deck commands", () => {
  it("are all things the overlay state takes", async () => {
    const { REMOTE_ACTIONS, remoteCommandFor } = await import(
      "~/lib/overlay/remote-actions"
    );
    for (const { id } of REMOTE_ACTIONS) {
      expect(overlayPatchOf(remoteCommandFor(id, NOW), NOW), id).not.toBeNull();
    }
  });

  it("moves the sponsor rotation on", () => {
    const patch = overlayPatchOf({ type: "NEXT_SPONSOR" }, NOW)!;
    expect(patch).toEqual({ nextSponsor: true });
    const once = applyOverlayPatch(null, patch, null, NOW);
    expect(applyOverlayPatch(once, patch, null, NOW).scene.sponsorIndex).toBe(
      2,
    );
  });
});

describe("replays, holds and snapshots", () => {
  it("names the replay scene and holds the overlay", () => {
    expect(
      overlayPatchOf({ type: "SET_REPLAY_SCENE", replayScene: " Replay " }, NOW),
    ).toEqual({ scene: { replayScene: "Replay" } });
    expect(overlayPatchOf({ type: "SET_HOLD", hold: "black" }, NOW)).toEqual({
      scene: { hold: "black" },
    });
    expect(overlayPatchOf({ type: "SET_HOLD", hold: null }, NOW)).toEqual({
      scene: { hold: null },
    });
    expect(
      overlayPatchOf({ type: "SET_HOLD", hold: "grey" as never }, NOW),
    ).toBeNull();
    const doc = applyOverlayPatch(
      null,
      overlayPatchOf({ type: "SET_HOLD", hold: "card" }, NOW)!,
      "h",
      NOW,
    );
    expect(parseOverlayState(JSON.parse(JSON.stringify(doc)))?.scene.hold).toBe(
      "card",
    );
  });

  it("takes the new graphics' views, straps and message forms", () => {
    expect(
      overlayPatchOf({ type: "SET_BROADCAST_VIEW", broadcastView: "42" }, NOW),
    ).toEqual({ scene: { view: "42", card: "none" } });
    const patch = overlayPatchOf(
      {
        type: "SHOW_STRAP",
        strap: { id: "m", type: "message", title: "Lunch", form: "single" },
      },
      NOW,
    );
    expect(patch?.strap).toMatchObject({ type: "message", form: "single" });
  });

  it("validates and caps snapshots, and stores them", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      team: `Team ${i}`,
      played: 5,
      won: 3,
      lost: 2,
      points: 6,
      nrr: 0.25,
    }));
    const snap = snapshotsOf({
      pointsTable: { title: "Group A", rows: [...rows, { team: "" }] },
      leaderboard: {
        title: "Most runs",
        metric: "Runs",
        rows: [{ name: "A", value: 120 }, { name: "", value: 3 }],
      },
      nextFixture: { team1: "One", team2: "Two", team1Logo: "javascript:x" },
      series: { "p-1": { matches: 4, runs: 80, best: "3-12" }, "bad id!": { matches: 1 } },
    })!;
    expect(snap.pointsTable?.rows).toHaveLength(16);
    expect(snap.leaderboard?.rows).toEqual([
      { name: "A", team: null, value: 120, detail: null, playerId: null },
    ]);
    expect(snap.nextFixture?.team1Logo).toBeNull();
    expect(Object.keys(snap.series ?? {})).toEqual(["p-1"]);
    const patch = overlayPatchOf({ type: "SET_SNAPSHOTS", snapshots: snap }, NOW)!;
    const doc = applyOverlayPatch(null, patch, "s", NOW);
    expect(doc.snapshots?.pointsTable?.title).toBe("Group A");
    expect(JSON.stringify(doc.snapshots).length).toBeLessThan(16 * 1024);
    expect(parseOverlayState(JSON.parse(JSON.stringify(doc)))?.snapshots).toEqual(
      doc.snapshots,
    );
    expect(overlayPatchOf({ type: "SET_SNAPSHOTS", snapshots: null }, NOW)).toEqual({
      snapshots: null,
    });
  });
});

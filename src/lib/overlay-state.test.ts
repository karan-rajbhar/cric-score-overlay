import { describe, expect, it } from "vitest";
import {
  applyOverlayPatch,
  DEFAULT_AUTO_RULES,
  isAutomatic,
  manualAutoRules,
  overlayPatchOf,
  parseOverlayState,
  sceneOf,
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
      scene: { view: null, card: "none" },
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
    expect(
      sceneOf({ layout: "compact", theme: "minimal" }, null),
    ).toMatchObject({
      layout: "compact",
      theme: "light",
    });
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
  });
});

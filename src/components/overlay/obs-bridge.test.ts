import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createObsBridge,
  getObsStudio,
  OBS_CONTROL,
  type ObsStudio,
} from "./obs-bridge";

function mockObs(level: number, scene = "Main", replaybuffer = true) {
  let current = scene;
  const obs = {
    pluginVersion: "2.24.0",
    getControlLevel: vi.fn((cb: (l: number) => void) => cb(level)),
    getStatus: vi.fn((cb: (s: { replaybuffer: boolean }) => void) =>
      cb({ replaybuffer }),
    ),
    getCurrentScene: vi.fn((cb: (s: { name: string }) => void) =>
      cb({ name: current }),
    ),
    setCurrentScene: vi.fn((name: string) => {
      current = name;
    }),
    saveReplayBuffer: vi.fn(() => {
      // OBS fires this once the file is written.
      setTimeout(() => window.dispatchEvent(new Event("obsReplaybufferSaved")), 50);
    }),
    startReplayBuffer: vi.fn(),
  } satisfies ObsStudio;
  (window as unknown as { obsstudio?: ObsStudio }).obsstudio = obs;
  return { obs, scene: () => current, cut: (s: string) => (current = s) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as { obsstudio?: ObsStudio }).obsstudio;
});

describe("obs bridge", () => {
  it("does nothing outside OBS", async () => {
    expect(getObsStudio()).toBeNull();
    const bridge = createObsBridge({ replayScene: "Replay" });
    expect(bridge.available).toBe(false);
    expect(await bridge.controlLevel()).toBe(OBS_CONTROL.NONE);
    expect(await bridge.replay({ seconds: 10 })).toBe("unavailable");
  });

  it("needs at least basic access to save", async () => {
    const { obs } = mockObs(OBS_CONTROL.READ_USER);
    const bridge = createObsBridge();
    expect(await bridge.replay({ seconds: 10 })).toBe("no_permission");
    expect(obs.saveReplayBuffer).not.toHaveBeenCalled();
  });

  it("saves the replay buffer with basic access, without switching scenes", async () => {
    const { obs } = mockObs(OBS_CONTROL.BASIC);
    const bridge = createObsBridge({ replayScene: "Replay" });
    expect(await bridge.replay({ seconds: 10 })).toBe("saved");
    expect(obs.saveReplayBuffer).toHaveBeenCalledTimes(1);
    expect(obs.setCurrentScene).not.toHaveBeenCalled();
  });

  it("starts a stopped replay buffer (advanced) instead of saving", async () => {
    const { obs } = mockObs(OBS_CONTROL.ADVANCED, "Main", false);
    const bridge = createObsBridge({ replayScene: "Replay" });
    expect(await bridge.replay({ seconds: 10 })).toBe("buffer_off");
    expect(obs.startReplayBuffer).toHaveBeenCalled();
    expect(obs.saveReplayBuffer).not.toHaveBeenCalled();
  });

  it("switches to the replay scene once saved, then back", async () => {
    const { obs, scene } = mockObs(OBS_CONTROL.ADVANCED);
    const bridge = createObsBridge({ replayScene: "Replay" });
    const done = bridge.replay({ seconds: 8 });
    await vi.advanceTimersByTimeAsync(49);
    expect(obs.setCurrentScene).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(scene()).toBe("Replay");
    // A second moment while the replay plays is skipped.
    expect(await bridge.replay({ seconds: 8 })).toBe("busy");
    await vi.advanceTimersByTimeAsync(8000);
    expect(await done).toBe("saved_and_switched");
    expect(scene()).toBe("Main");
  });

  it("stays put when the operator cut away during the replay", async () => {
    const { scene, cut } = mockObs(OBS_CONTROL.ADVANCED);
    const bridge = createObsBridge({ replayScene: "Replay" });
    const done = bridge.replay({ seconds: 5 });
    await vi.advanceTimersByTimeAsync(100);
    cut("Wide shot");
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(scene()).toBe("Wide shot");
  });

  it("switches after a timeout when OBS never reports the save", async () => {
    const { obs, scene } = mockObs(OBS_CONTROL.ADVANCED);
    obs.saveReplayBuffer.mockImplementation(() => undefined);
    const bridge = createObsBridge({ replayScene: "Replay", savedTimeoutMs: 1000 });
    const done = bridge.replay({ seconds: 2 });
    await vi.advanceTimersByTimeAsync(999);
    expect(scene()).toBe("Main");
    await vi.advanceTimersByTimeAsync(1);
    expect(scene()).toBe("Replay");
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(scene()).toBe("Main");
  });
});

/**
 * Automatic replay clips through OBS, from inside the overlay's browser
 * source (OBS's `window.obsstudio` API, obs-browser).
 *
 * On a four, six or wicket the automatic rules choose (`replay_*` in
 * `auto-graphics.ts`), the overlay saves OBS's replay buffer (needs the
 * browser source's page permission "Basic access to OBS") and, with
 * "Advanced access" and a replay scene named in the settings, switches to
 * that scene for the rule's seconds once OBS reports the file saved, then
 * back to the scene it came from (unless the operator moved on meanwhile).
 *
 * Playing the clip uses nothing beyond OBS itself: a Media Source in the
 * replay scene reads the replay file, which OBS overwrites on every save
 * when the replay buffer's file name is fixed, and "Restart playback when
 * source becomes active" starts it from the top on each switch. (OBS's
 * bundled instant-replay.lua does the same by picking the newest file; it
 * can pick the previous one if it runs before the save finishes, so the
 * bridge waits for OBS's `obsReplaybufferSaved` event.)
 *
 * Outside OBS (a normal browser, the control room preview) `window.obsstudio`
 * is absent and every call does nothing.
 */

/** obs-browser control levels. */
export const OBS_CONTROL = {
  NONE: 0,
  READ_OBS: 1,
  READ_USER: 2,
  BASIC: 3,
  ADVANCED: 4,
  ALL: 5,
} as const;

interface ObsScene {
  name: string;
}

interface ObsStatus {
  replaybuffer?: boolean;
  streaming?: boolean;
  recording?: boolean;
}

/** The parts of `window.obsstudio` the bridge uses. */
export interface ObsStudio {
  pluginVersion?: string;
  getControlLevel?: (cb: (level: number) => void) => void;
  getStatus?: (cb: (status: ObsStatus) => void) => void;
  getCurrentScene?: (cb: (scene: ObsScene) => void) => void;
  setCurrentScene?: (name: string) => void;
  saveReplayBuffer?: () => void;
  startReplayBuffer?: () => void;
}

/** The OBS browser API when the page runs in an OBS browser source. */
export function getObsStudio(
  win: Window | undefined = typeof window === "undefined" ? undefined : window,
): ObsStudio | null {
  const obs = (win as (Window & { obsstudio?: ObsStudio }) | undefined)
    ?.obsstudio;
  return obs && typeof obs === "object" ? obs : null;
}

export type ReplayResult =
  | "unavailable"
  | "no_permission"
  | "buffer_off"
  | "busy"
  | "saved"
  | "saved_and_switched";

export interface ObsBridgeOptions {
  /** The OBS scene that plays the replay (Advanced access); none: save only. */
  replayScene?: string | null;
  win?: Window;
  /** How long to wait for OBS to report the replay saved. */
  savedTimeoutMs?: number;
}

export interface ObsBridge {
  /** Whether the page runs inside OBS. */
  readonly available: boolean;
  /** The browser source's control level (0 outside OBS). */
  controlLevel(): Promise<number>;
  /** Save the replay buffer and, if set up, show it for `seconds`. */
  replay(item: { seconds: number }): Promise<ReplayResult>;
  dispose(): void;
}

function call<T>(fn: ((cb: (v: T) => void) => void) | undefined): Promise<T | null> {
  return new Promise((resolve) => {
    if (!fn) return resolve(null);
    try {
      fn((v) => resolve(v));
    } catch {
      resolve(null);
    }
  });
}

/** Resolves on OBS's "replay saved" event, or after `ms`. */
function savedOrTimeout(win: Window, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      win.removeEventListener("obsReplaybufferSaved", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    win.addEventListener("obsReplaybufferSaved", done);
  });
}

/** Whether a replay can be saved now ("ok"), or why not. */
async function readiness(
  obs: ObsStudio,
  lvl: number,
): Promise<"ok" | "no_permission" | "buffer_off"> {
  if (lvl < OBS_CONTROL.BASIC || !obs.saveReplayBuffer) return "no_permission";
  const status = await call<ObsStatus>(obs.getStatus?.bind(obs));
  if (status && status.replaybuffer === false) {
    // Start it for the next moment (Advanced access); nothing to save yet.
    if (lvl >= OBS_CONTROL.ADVANCED) obs.startReplayBuffer?.();
    return "buffer_off";
  }
  return "ok";
}

/** Cut to the replay scene for `seconds`, then back unless the operator moved on. */
async function showReplay(
  obs: ObsStudio,
  scene: string,
  seconds: number,
  later: (ms: number) => Promise<void>,
  isDisposed: () => boolean,
): Promise<ReplayResult> {
  const from = await call<ObsScene>(obs.getCurrentScene?.bind(obs));
  if (from?.name === scene) return "saved";
  obs.setCurrentScene!(scene);
  await later(Math.max(1, seconds) * 1000);
  if (isDisposed()) return "saved_and_switched";
  const now = await call<ObsScene>(obs.getCurrentScene?.bind(obs));
  if (from?.name && (!now || now.name === scene)) {
    obs.setCurrentScene!(from.name);
  }
  return "saved_and_switched";
}

export function createObsBridge(options: ObsBridgeOptions = {}): ObsBridge {
  const win =
    options.win ?? (typeof window === "undefined" ? undefined : window);
  const obs = getObsStudio(win);
  const savedTimeoutMs = options.savedTimeoutMs ?? 3000;
  let level: Promise<number> | null = null;
  let busy = false;
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const controlLevel = () => {
    if (!obs) return Promise.resolve(OBS_CONTROL.NONE);
    level ??= call<number>(obs.getControlLevel?.bind(obs)).then(
      (l) => l ?? OBS_CONTROL.NONE,
    );
    return level;
  };

  const later = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });

  return {
    available: !!obs,
    controlLevel,
    async replay({ seconds }) {
      if (!obs || !win || disposed) return "unavailable";
      const lvl = await controlLevel();
      const ready = await readiness(obs, lvl);
      if (ready !== "ok") return ready;
      if (busy) return "busy";
      busy = true;
      try {
        const saved = savedOrTimeout(win, savedTimeoutMs);
        obs.saveReplayBuffer!();
        const scene = options.replayScene?.trim();
        if (!scene || lvl < OBS_CONTROL.ADVANCED || !obs.setCurrentScene) {
          return "saved";
        }
        await saved;
        if (disposed) return "saved";
        return await showReplay(obs, scene, seconds, later, () => disposed);
      } finally {
        busy = false;
      }
    },
    dispose() {
      disposed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
  };
}

/** Recommended replay buffer length (s): scorer lag (~10 s) plus the moment. */
export const RECOMMENDED_REPLAY_BUFFER_SECONDS = 20;

/** Operator steps for the setup flow's "Automatic replays" section. */
export const OBS_REPLAY_SETUP_STEPS: readonly string[] = [
  "In OBS, open Settings → Output and turn on the Replay Buffer. Set Maximum Replay Time to 20 seconds (the scorer records a ball a few seconds after it happens; 20 seconds holds the delivery and the lead-up).",
  "Still in Output (Advanced mode, Replay Buffer tab or Recording), give replays a fixed file name and tick “Overwrite if file exists”, so the newest replay always has the same name.",
  "Make a scene called Replay. Add a Media Source pointing at that replay file, and tick “Restart playback when source becomes active” and “Close file when inactive”. Add the CricScore overlay to this scene too (Paste Reference) if you want the score on replays.",
  "Open the CricScore browser source's properties. Set Page permissions to “Advanced access to OBS” (needed to switch to the Replay scene; “Basic access” only saves clips), and leave “Shutdown source when not visible” off.",
  "Before the first ball, click Start Replay Buffer in OBS's Controls dock.",
  "In the CricScore control room, turn on the replay rules you want (wickets, sixes, fours) and enter the scene name Replay. Each one saves a clip, shows it for the rule's seconds and cuts back.",
];

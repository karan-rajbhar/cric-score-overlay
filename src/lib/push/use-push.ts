"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  currentPushEnv,
  disablePush,
  enablePush,
  getDeviceSubscription,
  pushAvailability,
  type PushAvailability,
} from "./client";

const noSubscribe = () => () => {};

/** Push on this device: whether it can be turned on, and whether it is. */
export function usePush(): {
  availability: PushAvailability;
  /** Null while checking. */
  enabled: boolean | null;
  busy: boolean;
  enable: () => Promise<{ ok: boolean; error?: string }>;
  disable: () => Promise<void>;
} {
  const availability = useSyncExternalStore(
    noSubscribe,
    () => pushAvailability(currentPushEnv()),
    (): PushAvailability => "unconfigured",
  );
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (availability !== "available") return;
    let live = true;
    void getDeviceSubscription().then((sub) => {
      if (live) setEnabled(Boolean(sub));
    });
    return () => {
      live = false;
    };
  }, [availability]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.ok) setEnabled(true);
      return res;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush();
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { availability, enabled, busy, enable, disable };
}

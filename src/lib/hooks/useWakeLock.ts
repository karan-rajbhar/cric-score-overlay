"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WakeLockState {
  isLocked: boolean;
  isSupported: boolean;
  error: Error | null;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

/**
 * Custom React hook to prevent screen sleep/timeout using the Screen Wake Lock API.
 * Essential for outdoor scorers so the screen doesn't turn off between deliveries or during field changes.
 */
export function useWakeLock(enabled = false): WakeLockState {
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.wakeLock);

  const request = useCallback((): Promise<void> => {
    if (!isSupported) return Promise.resolve();
    if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
      return Promise.resolve();
    }

    return navigator.wakeLock
      .request("screen")
      .then((sentinel) => {
        wakeLockSentinelRef.current = sentinel;
        setIsLocked(true);
        setError(null);

        sentinel.addEventListener("release", () => {
          setIsLocked(false);
          wakeLockSentinelRef.current = null;
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLocked(false);
      });
  }, [isSupported]);

  const release = useCallback((): Promise<void> => {
    if (wakeLockSentinelRef.current) {
      return wakeLockSentinelRef.current
        .release()
        .then(() => {
          wakeLockSentinelRef.current = null;
          setIsLocked(false);
        })
        .catch(() => {
          wakeLockSentinelRef.current = null;
          setIsLocked(false);
        });
    }
    return Promise.resolve();
  }, []);

  useEffect(() => {
    if (enabled && isSupported) {
      void request();

      const handleVisibilityChange = () => {
        if (
          document.visibilityState === "visible" &&
          enabled &&
          (!wakeLockSentinelRef.current || wakeLockSentinelRef.current.released)
        ) {
          void request();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        void release();
      };
    } else {
      void release();
    }
  }, [enabled, isSupported, request, release]);

  return {
    isLocked,
    isSupported,
    error,
    request,
    release,
  };
}

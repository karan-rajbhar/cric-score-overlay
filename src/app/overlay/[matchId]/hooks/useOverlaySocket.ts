"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "~/lib/supabase/client";
import type {
  LiveMatchState,
  ProducerCommand,
} from "~/components/overlay/types";

export interface UseOverlaySocketOptions {
  matchId: string;
  isRealUuid: boolean;
  onCommand: (command: ProducerCommand) => void;
  onStateUpdate: (state: LiveMatchState) => void;
  refetch: () => Promise<void>;
}

export function useOverlaySocket({
  matchId,
  isRealUuid,
  onCommand,
  onStateUpdate,
  refetch,
}: UseOverlaySocketOptions) {
  const [isConnected, setIsConnected] = useState(!isRealUuid);
  const fetchTimer = useRef<NodeJS.Timeout | null>(null);

  const onCommandRef = useRef(onCommand);
  const onStateUpdateRef = useRef(onStateUpdate);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    onCommandRef.current = onCommand;
    onStateUpdateRef.current = onStateUpdate;
    refetchRef.current = refetch;
  });

  useEffect(() => {
    const controlChannel = supabase
      .channel(`overlay_control_${matchId}`)
      .on(
        "broadcast",
        { event: "command" },
        ({ payload }: { payload: ProducerCommand }) => {
          if (payload) {
            onCommandRef.current(payload);
          }
        },
      )
      .subscribe();

    if (!isRealUuid) {
      return () => {
        void supabase.removeChannel(controlChannel);
      };
    }

    const scheduleRefetch = () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => void refetchRef.current(), 250);
    };

    const dataChannel = supabase
      .channel(`overlay_${matchId}`)
      .on(
        "broadcast",
        { event: "score_update" },
        ({ payload }: { payload?: { liveState?: LiveMatchState } }) => {
          if (payload?.liveState && payload.liveState.match_id === matchId) {
            onStateUpdateRef.current(payload.liveState);
          } else {
            void refetchRef.current();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ball_by_ball",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "innings",
          filter: `match_id=eq.${matchId}`,
        },
        scheduleRefetch,
      )
      .subscribe((status) => setIsConnected(status === "SUBSCRIBED"));

    const poll = setInterval(() => void refetchRef.current(), 15000);

    return () => {
      void supabase.removeChannel(controlChannel);
      void supabase.removeChannel(dataChannel);
      clearInterval(poll);
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
    };
  }, [matchId, isRealUuid]);

  return { isConnected };
}

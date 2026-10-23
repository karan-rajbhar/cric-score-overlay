"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Result<T> = { data: T | null; error: string | null };

/**
 * Loads a server action's `{ data, error }` on mount (and when `fetcher`
 * changes; keep it stable with useCallback). On failure it toasts the
 * error and shows `empty`. `reload` re-runs it after a change; `setData`
 * applies a result the change already returned.
 */
export function useServerResult<T>(
  fetcher: () => Promise<Result<T>>,
  empty: T | null,
  failMessage: string,
) {
  const [data, setData] = useState<T | null>(null);
  const apply = useCallback(
    (res: Result<T>) => {
      if (res.data !== null) {
        setData(res.data);
        return;
      }
      setData(empty);
      toast.error(res.error ?? failMessage);
    },
    // `empty` is a constant per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [failMessage],
  );

  useEffect(() => {
    let live = true;
    void fetcher().then((res) => {
      if (live) apply(res);
    });
    return () => {
      live = false;
    };
  }, [fetcher, apply]);

  const reload = useCallback(() => fetcher().then(apply), [fetcher, apply]);
  return { data, setData, reload };
}

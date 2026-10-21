"use client";

import { useSyncExternalStore } from "react";
import { Segmented } from "~/components/ds/tabs";
import { useTheme } from "~/lib/theme-provider";

const emptySubscribe = () => () => {};

/** Light / dark for checking both token sets (same setting as the app's). */
export function ThemeSwitch() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Segmented
      label="Theme"
      value={mounted ? resolvedTheme : "light"}
      onChange={setTheme}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}

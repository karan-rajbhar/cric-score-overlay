"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import {
  IOS_INSTALL_HINT,
  iosHintSeen,
  isIosSafari,
  isStandalone,
  markIosHintSeen,
  promptInstall,
  useCanInstall,
} from "~/lib/pwa/install-prompt";

function useIosInstallable(): boolean {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    // Client-only check (user agent), after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIos(
      isIosSafari(navigator.userAgent, navigator.maxTouchPoints) &&
        !isStandalone(),
    );
  }, []);
  return ios;
}

/**
 * "Install app" in the account menu: the browser's install dialog where it
 * offers one (Android, desktop Chrome / Edge), the Share hint on iOS Safari.
 */
export function InstallAppMenuItem() {
  const canInstall = useCanInstall();
  const ios = useIosInstallable();
  if (!canInstall && !ios) return null;
  return (
    <DropdownMenuItem
      onSelect={() => {
        if (canInstall) {
          void promptInstall();
        } else {
          markIosHintSeen();
          toast.info(IOS_INSTALL_HINT, { duration: 10_000, closeButton: true });
        }
      }}
      className="flex cursor-pointer items-center gap-2 text-xs"
    >
      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>Install app</span>
    </DropdownMenuItem>
  );
}

/** Shows the iOS "Add to Home Screen" hint once per device, when signed in. */
export function useIosInstallHint(signedIn: boolean): void {
  const ios = useIosInstallable();
  useEffect(() => {
    if (!signedIn || !ios || iosHintSeen()) return;
    markIosHintSeen();
    toast(IOS_INSTALL_HINT, { duration: 10_000, closeButton: true });
  }, [signedIn, ios]);
}

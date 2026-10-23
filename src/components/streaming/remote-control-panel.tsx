"use client";

import { useCallback, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  generateRemoteToken,
  getRemoteTokenStatus,
  revokeRemoteToken,
} from "~/app/overlay/remote-token-actions";
import {
  REMOTE_ACTIONS,
  remoteActionUrl,
} from "~/lib/overlay/remote-actions";
import type { RemoteTokenStatus } from "~/lib/overlay/remote-token";
import { CopyField } from "./copy-field";
import { useOrigin } from "./use-origin";
import { useServerResult } from "./use-server-result";

const TOKEN_PLACEHOLDER = "YOUR-TOKEN";

/** One URL per Stream Deck button, for `token` (or a placeholder). */
function ActionUrls({ token, idPrefix }: { token: string; idPrefix: string }) {
  const origin = useOrigin();
  return (
    <div className="space-y-3">
      {REMOTE_ACTIONS.map((a) => (
        <CopyField
          key={a.id}
          id={`${idPrefix}-${a.id}`}
          label={a.label}
          value={remoteActionUrl(origin, token, a.id)}
        />
      ))}
    </div>
  );
}

/**
 * Exact Bitfocus Companion steps, with the button URLs filled in when the
 * token was just created (otherwise a placeholder to replace).
 */
export function CompanionSetupDialog({ token }: { token?: string | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Companion setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Stream Deck with Bitfocus Companion</DialogTitle>
          <DialogDescription>
            Each Stream Deck button sends one request to CricScore, which puts
            the graphic on air.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Install Bitfocus Companion, connect the Stream Deck and open the
            Companion admin page.
          </li>
          <li>
            Connections: search for <strong>Generic HTTP</strong>, add{" "}
            <strong>Generic: HTTP Requests</strong> and save it with its
            default settings.
          </li>
          <li>
            Buttons: pick a key and give it a label, for example Four.
          </li>
          <li>
            Press actions: add <strong>Generic HTTP: POST</strong>, paste that
            button&apos;s URL from the list below and leave the body empty.
          </li>
          <li>Repeat for each button you want, then press one to test it.</li>
          <li>
            When the match is over, or if a URL leaks, revoke the token in the
            control room. A new token makes the old URLs stop working.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Keep these URLs private: anyone with one can change the graphics.
          Opening one in a browser does nothing; only Companion&apos;s POST
          sends it. More than 5 presses a second are refused (HTTP 429).
        </p>
        {!token && (
          <p className="text-xs text-muted-foreground">
            Replace {TOKEN_PLACEHOLDER} with the token shown when you created
            it, or create a new one.
          </p>
        )}
        <ActionUrls token={token ?? TOKEN_PLACEHOLDER} idPrefix="companion-url" />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Control room panel for a match's Stream Deck token: create, regenerate
 * (the old one stops working) or revoke. The token is shown once, right
 * after it is created; only its hash is stored.
 */
export function RemoteControlPanel({ matchId }: { matchId: string }) {
  const { data: status, reload: load } = useServerResult<RemoteTokenStatus>(
    useCallback(() => getRemoteTokenStatus(matchId), [matchId]),
    null,
    "Could not check the token",
  );
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (
      status?.active &&
      !confirm("Create a new token? Buttons using the current one stop working.")
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await generateRemoteToken(matchId);
      if (!res.data) {
        toast.error(res.error ?? "Could not create the token");
        return;
      }
      setToken(res.data.token);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm("Revoke the token? Stream Deck buttons stop working.")) return;
    setBusy(true);
    try {
      const res = await revokeRemoteToken(matchId);
      if (!res.data) {
        toast.error(res.error ?? "Could not revoke the token");
        return;
      }
      setToken(null);
      toast.success("Token revoked");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="remote-control-heading"
      className="space-y-3 rounded-xl bg-card p-4 shadow-soft"
    >
      <div className="flex items-start gap-2">
        <KeyRound
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 id="remote-control-heading" className="text-sm font-semibold">
            Stream Deck
          </h3>
          <p className="text-xs text-muted-foreground">
            Run the graphics from a Stream Deck through Bitfocus Companion.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        {status === null
          ? "Checking the token"
          : status.active
            ? `Token active since ${
                status.created_at
                  ? new Date(status.created_at).toLocaleString()
                  : "earlier"
              }`
            : "No token yet"}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={create} disabled={busy}>
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {status?.active ? "Regenerate token" : "Create token"}
        </Button>
        {status?.active && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={revoke}
            disabled={busy}
          >
            Revoke
          </Button>
        )}
        <CompanionSetupDialog token={token} />
      </div>

      {token && (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">
            Copy these now: the token is not shown again.
          </p>
          <CopyField id="remote-token" label="Token" value={token} />
          <ActionUrls token={token} idPrefix="remote-url" />
        </div>
      )}
    </section>
  );
}

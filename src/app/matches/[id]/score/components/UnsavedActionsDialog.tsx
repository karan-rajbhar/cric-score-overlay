"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export interface UnsavedAction {
  id: string;
  /** "Four, Starc to Kohli" (`describeQueuedAction`). */
  description: string;
  /** Why it was not saved, as the server said it (or that it was not sent). */
  error: string;
}

/**
 * The actions the server refused (and those queued after one it refused):
 * kept on this device until the scorer sends them again or discards them.
 */
export function UnsavedActionsDialog({
  open,
  onOpenChange,
  items,
  onResend,
  onDiscard,
  busy = false,
  offline = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UnsavedAction[];
  onResend: () => void;
  /** One action (its id), or all of them (null). */
  onDiscard: (id: string | null) => void;
  busy?: boolean;
  offline?: boolean;
}) {
  const [confirmAll, setConfirmAll] = useState(false);
  const [seen, setSeen] = useState(open);
  if (seen !== open) {
    setSeen(open);
    setConfirmAll(false);
  }
  const count = items.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-balance">
            {count === 1 ? "1 action not saved" : `${count} actions not saved`}
          </DialogTitle>
          <DialogDescription>
            The server refused these, or they came after one it refused. The
            score shows only what was saved. Send them again in order, or
            discard them.
          </DialogDescription>
        </DialogHeader>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing left to review.</p>
        ) : (
          <ol className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-border/70 py-1.5 pl-3 pr-1"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.error}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Discard: ${item.description}`}
                  disabled={busy}
                  onClick={() => onDiscard(item.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        )}
        {count > 0 &&
          (confirmAll ? (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <p className="text-sm">
                Discard {count === 1 ? "this action" : `all ${count} actions`}?
                They will not be on the scorecard.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  autoFocus
                  onClick={() => setConfirmAll(false)}
                >
                  Keep them
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => {
                    setConfirmAll(false);
                    onDiscard(null);
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => setConfirmAll(true)}
                >
                  Discard all
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={busy || offline}
                  onClick={onResend}
                >
                  {busy ? "Sending…" : "Send again"}
                </Button>
              </div>
              {offline && (
                <p className="text-xs text-muted-foreground">
                  Sending needs a connection.
                </p>
              )}
            </div>
          ))}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AtSign, Check, AlertCircle, Loader2, Sparkles } from "lucide-react";
import {
  checkUsernameAvailability,
  updateUsername,
} from "~/app/players/actions";
import { cleanHandle, validateUsername } from "~/lib/username";
import { toast } from "sonner";

interface EditUsernameDialogProps {
  currentUsername: string;
  trigger?: React.ReactNode;
  onSuccess?: (newUsername: string) => void;
}

export function EditUsernameDialog({
  currentUsername,
  trigger,
  onSuccess,
}: EditUsernameDialogProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(currentUsername);
  const [isChecking, setIsChecking] = useState(false);
  const [remoteCheck, setRemoteCheck] = useState<{
    checkedHandle: string;
    available: boolean;
    error?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setInputVal(currentUsername);
      setRemoteCheck(null);
    }
  };

  const cleaned = cleanHandle(inputVal);
  const isUnchanged = cleaned === cleanHandle(currentUsername);
  const localValidation = cleaned ? validateUsername(cleaned) : null;

  const availability = (() => {
    if (!cleaned) return null;
    if (isUnchanged) return { available: true };
    if (localValidation && !localValidation.isValid) {
      return { available: false, error: localValidation.error };
    }
    if (remoteCheck && remoteCheck.checkedHandle === cleaned) {
      return { available: remoteCheck.available, error: remoteCheck.error };
    }
    return null;
  })();

  // Debounced availability check
  useEffect(() => {
    if (!cleaned || isUnchanged || !localValidation?.isValid) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await checkUsernameAvailability(cleaned);
        setRemoteCheck({
          checkedHandle: cleaned,
          available: res.available,
          error: res.error,
        });
      } catch {
        setRemoteCheck({
          checkedHandle: cleaned,
          available: false,
          error: "Failed to check availability",
        });
      } finally {
        setIsChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [cleaned, isUnchanged, localValidation?.isValid]);

  const canSubmit =
    cleaned.length >= 3 &&
    !isUnchanged &&
    !isChecking &&
    availability?.available === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await updateUsername(cleaned);
      if (res.success && res.username) {
        toast.success(`Your handle is now @${res.username}!`);
        setOpen(false);
        onSuccess?.(res.username);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update handle");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 font-mono text-xs"
          >
            <AtSign className="h-3.5 w-3.5 text-primary" />
            <span>Edit Handle</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Claim Your Unique Handle
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your unique @handle is how other cricketers find, mention, and
              tag you across teams, scorecards, and tournaments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username-input" className="text-xs font-semibold">
                Username Handle
              </Label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-mono text-sm font-bold text-muted-foreground select-none">
                  @
                </span>
                <Input
                  id="username-input"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="your_handle"
                  className="pl-8 font-mono text-sm tracking-wide form-input"
                  aria-invalid={availability && !availability.available ? "true" : "false"}
                  aria-describedby="username-feedback"
                  required
                />
                <div className="absolute right-3 flex items-center">
                  {isChecking && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!isChecking && availability?.available && !isUnchanged && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                  {!isChecking && availability && !availability.available && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>

              {/* Status Feedback */}
              <div id="username-feedback" className="min-h-[20px] text-xs">
                {isChecking && (
                  <p className="text-muted-foreground">Checking availability…</p>
                )}
                {!isChecking && isUnchanged && (
                  <p className="text-muted-foreground">
                    This is your current handle (@{currentUsername}).
                  </p>
                )}
                {!isChecking && availability?.available && !isUnchanged && (
                  <p className="font-medium text-emerald-500">
                    ✓ @{cleaned} is available!
                  </p>
                )}
                {!isChecking && availability && !availability.available && (
                  <p className="font-medium text-destructive">
                    {availability.error}
                  </p>
                )}
              </div>
            </div>

            {/* Platform Rules Hint */}
            <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Handle Rules:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>3 to 30 characters long</li>
                <li>Letters, numbers, and underscores only</li>
                <li>Cannot start or end with an underscore</li>
                <li>Globally unique across the cricket platform</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Handle"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

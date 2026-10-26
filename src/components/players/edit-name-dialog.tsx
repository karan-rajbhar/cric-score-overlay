"use client";

import React, { useState, useTransition } from "react";
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
import { Loader2, Pencil } from "lucide-react";
import { updateFullName } from "~/app/players/actions";
import { toast } from "sonner";

interface EditNameDialogProps {
  currentName: string;
  trigger?: React.ReactNode;
}

export function EditNameDialog({ currentName, trigger }: EditNameDialogProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setValue(currentName);
  };

  const cleaned = value.trim().replace(/\s+/g, " ");
  const canSubmit = cleaned.length >= 2 && cleaned !== currentName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await updateFullName(cleaned);
      if (res.success) {
        toast.success("Name updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update name");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span>Edit name</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Change your name</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your name appears on your profile, teams and scorecards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="full-name-input" className="text-xs font-semibold">
              Name
            </Label>
            <Input
              id="full-name-input"
              type="text"
              autoComplete="name"
              autoCorrect="off"
              maxLength={60}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="form-input"
              required
            />
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
                "Save name"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useId, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { updateProfile } from "~/app/players/actions";
import {
  BATTING_HANDS,
  BOWLING_STYLES,
  LOCATION_MAX,
  PLAYING_ROLES,
  type PlayerDetails,
} from "~/lib/player-profile";
import { toast } from "sonner";

const NONE = "none";

interface EditProfileDialogProps {
  currentName: string;
  current: Partial<PlayerDetails>;
}

function OptionField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
      >
        <SelectTrigger id={id} aria-labelledby={`${id}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Name, location and how the player bats and bowls. */
export function EditProfileDialog({
  currentName,
  current,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [location, setLocation] = useState(current.location ?? "");
  const [role, setRole] = useState(current.playing_role ?? "");
  const [hand, setHand] = useState(current.batting_hand ?? "");
  const [style, setStyle] = useState(current.bowling_style ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const nameId = useId();
  const locationId = useId();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(currentName);
      setLocation(current.location ?? "");
      setRole(current.playing_role ?? "");
      setHand(current.batting_hand ?? "");
      setStyle(current.bowling_style ?? "");
    }
  };

  const cleanedName = name.trim().replace(/\s+/g, " ");
  const cleanedLocation = location.trim().replace(/\s+/g, " ");
  const changed =
    cleanedName !== currentName ||
    cleanedLocation !== (current.location ?? "") ||
    role !== (current.playing_role ?? "") ||
    hand !== (current.batting_hand ?? "") ||
    style !== (current.bowling_style ?? "");
  const canSubmit = cleanedName.length >= 2 && changed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await updateProfile({
        full_name: cleanedName,
        location: cleanedLocation,
        playing_role: role,
        batting_hand: hand,
        bowling_style: style,
      });
      if (res.success) {
        toast.success("Profile updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update profile");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Pencil className="h-3.5 w-3.5 text-primary" />
          <span>Edit profile</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Edit profile</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Shown on your profile, teams and scorecards. Everything except
              your name is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={nameId} className="text-xs font-semibold">
                Name
              </Label>
              <Input
                id={nameId}
                type="text"
                autoComplete="name"
                autoCorrect="off"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={locationId} className="text-xs font-semibold">
                Location
              </Label>
              <Input
                id={locationId}
                type="text"
                autoComplete="address-level2"
                autoCorrect="off"
                maxLength={LOCATION_MAX}
                placeholder="City or town"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="form-input"
              />
            </div>
            <OptionField
              label="Main role"
              value={role}
              onChange={setRole}
              options={PLAYING_ROLES}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionField
                label="Batting"
                value={hand}
                onChange={setHand}
                options={BATTING_HANDS}
              />
              <OptionField
                label="Bowling"
                value={style}
                onChange={setStyle}
                options={BOWLING_STYLES}
              />
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
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

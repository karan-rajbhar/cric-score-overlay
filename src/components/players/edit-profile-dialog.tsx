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

interface ProfileValues {
  name: string;
  location: string;
  role: string;
  hand: string;
  style: string;
}

const squash = (v: string) => v.trim().replace(/\s+/g, " ");

function valuesOf(
  currentName: string,
  current: Partial<PlayerDetails>,
): ProfileValues {
  return {
    name: currentName,
    location: current.location ?? "",
    role: current.playing_role ?? "",
    hand: current.batting_hand ?? "",
    style: current.bowling_style ?? "",
  };
}

/** The form's values, whether they differ from the saved ones, and reset. */
function useProfileForm(currentName: string, current: Partial<PlayerDetails>) {
  const saved = valuesOf(currentName, current);
  const [values, setValues] = useState(saved);
  const set = (key: keyof ProfileValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const name = squash(values.name);
  const location = squash(values.location);
  const changed =
    name !== saved.name ||
    location !== saved.location ||
    values.role !== saved.role ||
    values.hand !== saved.hand ||
    values.style !== saved.style;
  return {
    values,
    set,
    reset: () => setValues(saved),
    canSubmit: name.length >= 2 && changed,
    payload: {
      full_name: name,
      location,
      playing_role: values.role,
      batting_hand: values.hand,
      bowling_style: values.style,
    },
  };
}

function ProfileFields({
  values,
  set,
}: {
  values: ProfileValues;
  set: (key: keyof ProfileValues) => (value: string) => void;
}) {
  const nameId = useId();
  const locationId = useId();
  return (
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
          value={values.name}
          onChange={(e) => set("name")(e.target.value)}
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
          value={values.location}
          onChange={(e) => set("location")(e.target.value)}
          className="form-input"
        />
      </div>
      <OptionField
        label="Main role"
        value={values.role}
        onChange={set("role")}
        options={PLAYING_ROLES}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionField
          label="Batting"
          value={values.hand}
          onChange={set("hand")}
          options={BATTING_HANDS}
        />
        <OptionField
          label="Bowling"
          value={values.style}
          onChange={set("style")}
          options={BOWLING_STYLES}
        />
      </div>
    </div>
  );
}

/** Name, location and how the player bats and bowls. */
export function EditProfileDialog({
  currentName,
  current,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useProfileForm(currentName, current);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) form.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.canSubmit) return;
    startTransition(async () => {
      const res = await updateProfile(form.payload);
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
          <ProfileFields values={form.values} set={form.set} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!form.canSubmit || isPending}>
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

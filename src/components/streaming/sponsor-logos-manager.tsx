"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  deleteSponsorLogo,
  getSponsorLogos,
  saveSponsorLogos,
  uploadSponsorLogo,
} from "~/app/overlay/sponsor-actions";
import type { Sponsor, SponsorSlot } from "~/lib/firebase/types";
import {
  MAX_SPONSOR_LOGO_BYTES,
  SPONSOR_LOGO_ACCEPT,
} from "~/lib/overlay/sponsor-logo";
import { LOGO_MAX_PX, resizeImageFile } from "~/lib/image-resize";
import { useServerResult } from "./use-server-result";

type Scope = "club" | "tournament";

const SLOT_LABELS: { slot: SponsorSlot; label: string }[] = [
  { slot: "corner", label: "Corner" },
  { slot: "break", label: "Breaks" },
  { slot: "over_end", label: "End of over" },
];

function SlotBoxes({
  idPrefix,
  slots,
  onToggle,
  disabled,
}: {
  idPrefix: string;
  slots: SponsorSlot[];
  onToggle: (slot: SponsorSlot) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
      <legend className="sr-only">Where it shows</legend>
      {SLOT_LABELS.map(({ slot, label }) => {
        const id = `${idPrefix}-${slot}`;
        return (
          <span key={slot} className="flex items-center gap-1.5 text-xs">
            <input
              id={id}
              type="checkbox"
              checked={slots.includes(slot)}
              onChange={() => onToggle(slot)}
              disabled={disabled}
              className="h-4 w-4 accent-primary"
            />
            <label htmlFor={id}>{label}</label>
          </span>
        );
      })}
    </fieldset>
  );
}

function toggled(slots: SponsorSlot[], slot: SponsorSlot): SponsorSlot[] {
  return slots.includes(slot)
    ? slots.filter((s) => s !== slot)
    : [...slots, slot];
}

/**
 * Sponsor logos of a club or tournament (its admins): upload once with a
 * name and the overlay slots it may fill, then rename, re-slot, reorder or
 * remove. Every stream of their matches reuses them.
 */
export function SponsorLogosManager({
  scope,
  scopeId,
}: {
  scope: Scope;
  scopeId: string;
}) {
  const { data: sponsors, setData: setSponsors } = useServerResult(
    useCallback(() => getSponsorLogos(scope, scopeId), [scope, scopeId]),
    [],
    "Could not load sponsors",
  );
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<SponsorSlot[]>(["corner"]);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = async (
    work: () => Promise<{ data: Sponsor[] | null; error: string | null }>,
  ) => {
    setBusy(true);
    try {
      const res = await work();
      if (res.data) setSponsors(res.data);
      else toast.error(res.error ?? "Could not save");
      return Boolean(res.data);
    } finally {
      setBusy(false);
    }
  };

  const saveAll = (next: Sponsor[]) =>
    apply(() =>
      saveSponsorLogos(
        scope,
        scopeId,
        next.map((s) => ({ id: s.id, name: s.name, slots: s.slots })),
      ),
    );

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a logo file");
      return;
    }
    // Scaled down in the browser first (a phone photo becomes a few KB);
    // SVG is sent as it is.
    const logo =
      file.type === "image/svg+xml"
        ? file
        : await resizeImageFile(file, LOGO_MAX_PX);
    if (logo.size > MAX_SPONSOR_LOGO_BYTES) {
      toast.error("Logos must be 1 MB or smaller");
      return;
    }
    const form = new FormData();
    form.set("scope", scope);
    form.set("scopeId", scopeId);
    form.set("name", name);
    for (const s of slots) form.append("slots", s);
    form.set("file", logo);
    if (await apply(() => uploadSponsorLogo(form))) {
      setName("");
      setFile(null);
      setSlots(["corner"]);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const move = (index: number, by: -1 | 1) => {
    if (!sponsors) return;
    const next = [...sponsors];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    void saveAll(next);
  };

  const patch = (id: string, change: Partial<Sponsor>) => {
    if (!sponsors) return;
    void saveAll(sponsors.map((s) => (s.id === id ? { ...s, ...change } : s)));
  };

  const remove = (s: Sponsor) => {
    if (!confirm(`Remove ${s.name}?`)) return;
    void apply(() => deleteSponsorLogo(scope, scopeId, s.id));
  };

  return (
    <section
      aria-labelledby={`sponsors-heading-${scope}`}
      className="space-y-3"
    >
      <div>
        <h3 id={`sponsors-heading-${scope}`} className="text-sm font-semibold">
          Sponsor logos
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload each logo once. Streams of{" "}
          {scope === "club" ? "the club's" : "the tournament's"} matches use
          them in the slots you tick.
        </p>
      </div>

      {sponsors === null ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : sponsors.length === 0 ? (
        <p className="rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
          No sponsors yet.
        </p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border">
          {sponsors.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.logo_url}
                alt=""
                className="h-10 w-16 shrink-0 rounded-md bg-muted object-contain p-1"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={`sponsor-name-${s.id}`} className="sr-only">
                  Sponsor name
                </Label>
                <Input
                  id={`sponsor-name-${s.id}`}
                  defaultValue={s.name}
                  maxLength={60}
                  autoCorrect="off"
                  disabled={busy}
                  onBlur={(e) => {
                    const value = e.currentTarget.value.trim();
                    if (value && value !== s.name) patch(s.id, { name: value });
                  }}
                  className="h-9 text-sm"
                />
                <SlotBoxes
                  idPrefix={`sponsor-${s.id}`}
                  slots={s.slots}
                  disabled={busy}
                  onToggle={(slot) =>
                    patch(s.id, { slots: toggled(s.slots, slot) })
                  }
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move ${s.name} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  
                  disabled={busy || i === sponsors.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move ${s.name} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => remove(s)}
                  aria-label={`Remove ${s.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={upload}
        className="space-y-2 rounded-xl border border-dashed border-border p-3"
      >
        <div className="space-y-1">
          <Label htmlFor={`new-sponsor-file-${scope}`} className="text-xs">
            Logo (PNG, JPEG, WebP or SVG, up to 1 MB)
          </Label>
          <input
            ref={fileRef}
            id={`new-sponsor-file-${scope}`}
            type="file"
            accept={SPONSOR_LOGO_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`new-sponsor-name-${scope}`} className="text-xs">
            Name
          </Label>
          <Input
            id={`new-sponsor-name-${scope}`}
            value={name}
            maxLength={60}
            autoCorrect="off"
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
        <SlotBoxes
          idPrefix={`new-sponsor-${scope}`}
          slots={slots}
          onToggle={(slot) => setSlots((cur) => toggled(cur, slot))}
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || !file || !name.trim()}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Add sponsor
        </Button>
      </form>
    </section>
  );
}

/** "Sponsor logos" button and dialog, for the tournament page. */
export function SponsorLogosDialog({
  scope,
  scopeId,
}: {
  scope: Scope;
  scopeId: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Sponsor logos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sponsor logos</DialogTitle>
          <DialogDescription>
            Logos for the stream overlay of every match here.
          </DialogDescription>
        </DialogHeader>
        <SponsorLogosManager scope={scope} scopeId={scopeId} />
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { TeamLogo } from "~/components/teams/team-logo";
import { updateTeamLogo, removeTeamLogo } from "~/app/teams/actions";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";

interface TeamLogoEditorProps {
  teamId: string;
  teamName: string;
  shortName?: string | null;
  logoUrl?: string | null;
}

export function TeamLogoEditor({
  teamId,
  teamName,
  shortName,
  logoUrl,
}: TeamLogoEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(logoUrl ?? null);

  const handleFile = async (file: File) => {
    setSaving(true);
    const result = await updateTeamLogo(teamId, file);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not upload logo");
    } else {
      setCurrent(result.data);
      toast.success("Logo updated");
    }
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    const result = await removeTeamLogo(teamId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setCurrent(null);
      toast.success("Logo removed");
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <TeamLogo
          name={teamName}
          shortName={shortName}
          logoUrl={current}
          className="h-20 w-20 rounded-full text-xl shadow-soft ring-4 ring-card sm:h-24 sm:w-24 sm:text-2xl"
        />
        {saving && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => inputRef.current?.click()}
          disabled={saving}
          aria-label={current ? "Change logo" : "Upload logo"}
          title="PNG, JPG, WebP or SVG, up to 2 MB"
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
        {current && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void handleRemove()}
            disabled={saving}
            aria-label="Remove logo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

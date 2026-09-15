"use client";

import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { TeamLogo } from "~/components/teams/team-logo";
import { updateTeamLogo, removeTeamLogo } from "~/app/teams/actions";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

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
    <div className="flex flex-col items-start gap-3">
      <div className="relative">
        <TeamLogo
          name={teamName}
          shortName={shortName}
          logoUrl={current}
          className="h-16 w-16 rounded-lg text-lg"
        />
        {saving && (
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
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
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={saving}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {current ? "Change logo" : "Upload logo"}
        </Button>
        {current && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleRemove()}
            disabled={saving}
          >
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WebP or SVG · max 2 MB. Without a logo, initials are generated
        automatically.
      </p>
    </div>
  );
}

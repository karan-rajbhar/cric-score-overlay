"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createNextRound,
  previewNextRound,
  type NextRoundOptions,
  type NextRoundPreview,
} from "~/app/tournaments/bracket-actions";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** Knockout and mixed tournaments get rounds; leagues get round-robin fixtures. */
export function isBracketFormat(format: string | null | undefined): boolean {
  return format === "knockout" || format === "mixed";
}

const GROUP_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const QUALIFIER_OPTIONS = [1, 2, 3, 4];

/**
 * "Create next round" for a knockout or mixed tournament: shows what would
 * be created (groups, a knockout round with its byes) or why nothing can
 * be yet, and creates it on confirm.
 */
export function NextRoundDialog({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<NextRoundOptions>({
    groupCount: 2,
    qualifiersPerGroup: 2,
  });
  const [preview, setPreview] = useState<NextRoundPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(
    async (next: NextRoundOptions) => {
      setLoading(true);
      try {
        const res = await previewNextRound(tournamentId, next);
        if (res.error) toast.error(res.error);
        setPreview(res.data);
      } finally {
        setLoading(false);
      }
    },
    [tournamentId],
  );

  const show = () => {
    setOpen(true);
    void refresh(options);
  };

  const choose = (next: NextRoundOptions) => {
    setOptions(next);
    void refresh(next);
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await createNextRound(tournamentId, options);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Could not create the next round");
        return;
      }
      toast.success(
        `${res.data.label}: ${res.data.count} ${res.data.count === 1 ? "match" : "matches"} created`,
      );
      setOpen(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    !!preview && (preview.kind === "groups" || preview.kind === "knockout");

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}>
        Create next round
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create next round</DialogTitle>
            <DialogDescription>
              Matches are created between known teams only, so create each
              round once the previous one has results. Seeds follow the order
              teams were confirmed; the best seed left plays the worst.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {preview?.needsGroupCount && (
              <div className="space-y-2">
                <Label htmlFor="next-round-groups">Groups</Label>
                <Select
                  value={String(options.groupCount ?? 2)}
                  onValueChange={(v) =>
                    choose({ ...options, groupCount: Number(v) })
                  }
                >
                  <SelectTrigger id="next-round-groups">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.filter(
                      (n) => n * 2 <= Math.max(4, preview.teamCount),
                    ).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} groups
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {preview?.needsQualifiers && (
              <div className="space-y-2">
                <Label htmlFor="next-round-qualifiers">
                  Teams through from each group
                </Label>
                <Select
                  value={String(options.qualifiersPerGroup ?? 2)}
                  onValueChange={(v) =>
                    choose({ ...options, qualifiersPerGroup: Number(v) })
                  }
                >
                  <SelectTrigger id="next-round-qualifiers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFIER_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div aria-live="polite" aria-busy={loading}>
              {loading && !preview ? (
                <p className="text-sm text-muted-foreground">Working it out…</p>
              ) : preview?.message ? (
                <p className="rounded-xl bg-muted p-3 text-sm text-foreground">
                  {preview.message}
                </p>
              ) : preview && canCreate ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {preview.label}
                  </h3>
                  <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl bg-muted px-3">
                    {preview.matches.map((m, i) => (
                      <li
                        key={`${m.label}-${i}`}
                        className="flex items-baseline gap-3 py-2 text-sm"
                      >
                        <span className="w-28 shrink-0 text-muted-foreground">
                          {m.label}
                        </span>
                        <span className="min-w-0 truncate text-foreground">
                          {m.home} vs {m.away}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {preview.byes.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Byes to the next round: {preview.byes.join(", ")}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={!canCreate || creating || loading}>
              {creating
                ? "Creating…"
                : canCreate
                  ? `Create ${preview!.matches.length} ${preview!.matches.length === 1 ? "match" : "matches"}`
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  createStreamChannel,
  getStreamChannelsForMatch,
  putMatchOnChannel,
} from "~/app/overlay/channel/actions";
import { channelPath, type StreamChannel } from "~/lib/overlay/channel-link";
import { CopyField } from "./copy-field";
import { useOrigin } from "./use-origin";
import { useServerResult } from "./use-server-result";

function statusOf(channel: StreamChannel, matchId: string): string {
  if (channel.match_id === matchId) return "On air: this match";
  if (channel.match_id) return "Showing another match";
  return "Off air";
}

/**
 * Puts a match on a stream channel (a fixed overlay link): the channels of
 * its club (or tournament's club) and the producer's own, with each one's
 * OBS URL. A producer without a club channel can create a personal one.
 * For the control room / "Stream this match" setup flow.
 *
 * `onChange` gets the channel after each switch (on or off air).
 */
export function ChannelPicker({
  matchId,
  onChange,
}: {
  matchId: string;
  onChange?: (channel: StreamChannel) => void;
}) {
  const origin = useOrigin();
  const {
    data: channels,
    setData: setChannels,
    reload: load,
  } = useServerResult(
    useCallback(() => getStreamChannelsForMatch(matchId), [matchId]),
    [],
    "Could not load channels",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const put = async (channel: StreamChannel, on: boolean) => {
    if (
      on &&
      channel.match_id &&
      channel.match_id !== matchId &&
      !confirm(`${channel.name} is showing another match. Switch it to this one?`)
    ) {
      return;
    }
    setBusyId(channel.id);
    try {
      const res = await putMatchOnChannel(channel.id, on ? matchId : null);
      if (!res.data) {
        toast.error(res.error ?? "Could not change the channel");
        return;
      }
      const updated = res.data;
      setChannels(
        (channels ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
      onChange?.(updated);
    } finally {
      setBusyId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createStreamChannel(null, name);
      if (!res.data) {
        toast.error(res.error ?? "Could not create the channel");
        return;
      }
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <section aria-labelledby="channel-picker-heading" className="space-y-3">
      <div>
        <h3 id="channel-picker-heading" className="text-sm font-semibold">
          Stream channel
        </h3>
        <p className="text-xs text-muted-foreground">
          Put this match on a fixed overlay link, so OBS keeps the same
          browser source from match to match.
        </p>
      </div>

      {channels === null ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <p className="rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
          No channels for this match yet. Club admins add them on the club
          page, or create your own below.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {channels.map((c) => {
            const onAir = c.match_id === matchId;
            return (
              <li key={c.id} className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.club_id ? "Club channel" : "Your channel"} ·{" "}
                      {statusOf(c, matchId)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={onAir ? "outline" : "default"}
                    disabled={busyId === c.id}
                    onClick={() => void put(c, !onAir)}
                    className="shrink-0"
                  >
                    {busyId === c.id && (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    )}
                    {onAir ? "Take off air" : "Put on air"}
                  </Button>
                </div>
                <CopyField
                  id={`picker-channel-url-${c.id}`}
                  label="OBS browser source URL"
                  value={`${origin}${channelPath(c.id)}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={create} className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="personal-channel-name" className="text-xs font-medium">
            New channel of your own
          </Label>
          <Input
            id="personal-channel-name"
            value={name}
            maxLength={60}
            autoCorrect="off"
            placeholder="My stream"
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={creating || !name.trim()}
          className="h-10 gap-1"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create
        </Button>
      </form>
    </section>
  );
}

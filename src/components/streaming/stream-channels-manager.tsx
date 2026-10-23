"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  createStreamChannel,
  deleteStreamChannel,
  getClubStreamChannels,
  putMatchOnChannel,
  renameStreamChannel,
} from "~/app/overlay/channel/actions";
import { channelPath, type StreamChannel } from "~/lib/overlay/channel-link";
import { CopyField } from "./copy-field";
import { useOrigin } from "./use-origin";
import { useServerResult } from "./use-server-result";

function ChannelRow({
  channel,
  onChanged,
}: {
  channel: StreamChannel;
  onChanged: () => void;
}) {
  const origin = useOrigin();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const [busy, setBusy] = useState(false);

  const act = async (
    work: () => Promise<{ error: string | null }>,
    done?: string,
  ) => {
    setBusy(true);
    try {
      const res = await work();
      if (res.error) {
        toast.error(res.error);
        return false;
      }
      if (done) toast.success(done);
      onChanged();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await act(() => renameStreamChannel(channel.id, name))) {
      setEditing(false);
    }
  };

  const remove = () => {
    if (
      !confirm(
        `Delete ${channel.name}? OBS sources using its link go blank for good.`,
      )
    ) {
      return;
    }
    void act(() => deleteStreamChannel(channel.id), "Channel deleted");
  };

  const nameId = `channel-name-${channel.id}`;
  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
            <Label htmlFor={nameId} className="sr-only">
              Channel name
            </Label>
            <Input
              id={nameId}
              value={name}
              maxLength={60}
              autoCorrect="off"
              onChange={(e) => setName(e.target.value)}
              className="h-9 min-w-0 flex-1 text-sm"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </form>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{channel.name}</p>
            <p className="text-xs text-muted-foreground">
              {channel.match_id ? (
                <>
                  On air:{" "}
                  <Link
                    href={`/matches/${channel.match_id}`}
                    className="underline underline-offset-2"
                  >
                    view match
                  </Link>
                </>
              ) : (
                "Off air"
              )}
            </p>
          </div>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {channel.match_id && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => putMatchOnChannel(channel.id, null),
                    "Channel off air",
                  )
                }
              >
                Take off air
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${channel.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={remove}
              disabled={busy}
              aria-label={`Delete ${channel.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <CopyField
        id={`channel-url-${channel.id}`}
        label="OBS browser source URL"
        value={`${origin}${channelPath(channel.id)}`}
      />
    </li>
  );
}

/**
 * A club's stream channels (club admins): one fixed overlay link per
 * ground or camera position. Add, rename, delete, take off air; producers
 * put matches on them from the control room (`ChannelPicker`).
 */
export function StreamChannelsManager({ clubId }: { clubId: string }) {
  const { data: channels, reload: load } = useServerResult(
    useCallback(() => getClubStreamChannels(clubId), [clubId]),
    [],
    "Could not load channels",
  );
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await createStreamChannel(clubId, name);
      if (!res.data) {
        toast.error(res.error ?? "Could not add the channel");
        return;
      }
      setName("");
      void load();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section aria-labelledby="stream-channels-heading" className="space-y-3">
      <div>
        <h3 id="stream-channels-heading" className="text-sm font-semibold">
          Overlay links
        </h3>
        <p className="text-xs text-muted-foreground">
          One fixed link per ground or camera. Add it to OBS once; whichever
          match is put on the channel shows there.
        </p>
      </div>

      {channels === null ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <p className="rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
          No channels yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {channels.map((c) => (
            <ChannelRow key={c.id} channel={c} onChanged={load} />
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="new-channel-name" className="text-xs font-medium">
            New channel
          </Label>
          <Input
            id="new-channel-name"
            value={name}
            maxLength={60}
            autoCorrect="off"
            placeholder="Main ground"
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={adding || !name.trim()}
          className="h-10 gap-1"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </form>
    </section>
  );
}

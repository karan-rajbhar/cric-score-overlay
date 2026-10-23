"use client";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { SponsorLogosManager } from "./sponsor-logos-manager";
import { StreamChannelsManager } from "./stream-channels-manager";

/**
 * Club page (admins): the club's overlay links (stream channels) and
 * sponsor logos. The dialog's content mounts, and loads them, only when
 * opened.
 */
export function ClubStreamingDialog({ clubId }: { clubId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Streaming
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Streaming</DialogTitle>
          <DialogDescription>
            Fixed overlay links for your grounds and the sponsor logos your
            streams show.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <StreamChannelsManager clubId={clubId} />
          <div className="border-t border-border pt-4">
            <SponsorLogosManager scope="club" scopeId={clubId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

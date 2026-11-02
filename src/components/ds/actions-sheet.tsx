"use client";

import type * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ds/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

/**
 * The ⋯ button of a phone's top bar: everything but a screen's one main
 * action, so the header stays short. Holds the same buttons tablets show in
 * a row, each of which may open its own dialog, on top of this one. Give it
 * those buttons as children: they fill the width and a full 44px.
 */
export function ActionsSheet({
  title,
  label = "More actions",
  children,
}: {
  /** What the actions are about: the screen's name. */
  title: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="surface" size="icon" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogDescription className="sr-only">{label}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 [&>*]:min-h-11 [&>*]:w-full">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

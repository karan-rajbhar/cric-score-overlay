"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Card, CardHeader } from "~/components/ds/card";
import { Button } from "~/components/ui/button";
import type { Match } from "~/lib/match-types";
import {
  DEFAULT_AUTO_RULES,
  isAutomatic,
  manualAutoRules,
} from "~/lib/overlay-state";
import { cn } from "~/lib/utils";
import { ChannelPicker } from "~/components/streaming/channel-picker";
import { OverlayPreview } from "./overlay-preview";
import { OVERLAY_THEMES, resolveOverlayTheme } from "./overlay-themes";
import type { LiveMatchState } from "./types";
import { useOverlayProducer } from "./use-overlay-producer";
import { useOverlayLayers } from "./use-overlay-state";

type ToolId = "obs" | "prism" | "vmix";

/** Plain steps per streaming tool; "the link" is the one in step 3. */
export const STREAM_TOOLS: Array<{
  id: ToolId;
  label: string;
  device: string;
  steps: string[];
}> = [
  {
    id: "obs",
    label: "OBS Studio",
    device: "On a laptop",
    steps: [
      "Open OBS and pick the scene with your camera.",
      "Under Sources, click + and choose Browser.",
      "Name it CricScore, then paste the link into URL.",
      "Set Width to 1920 and Height to 1080, then click OK.",
      "In the Sources list, drag CricScore above your camera.",
    ],
  },
  {
    id: "prism",
    label: "PRISM Live Studio",
    device: "On a phone",
    steps: [
      "Scan the QR code below with the phone, or send it the link.",
      "In PRISM, set up your broadcast and open Widgets.",
      "Add a web widget and paste the link.",
      "Stretch the widget to fill the whole screen: it is clear apart from the graphics.",
      "Go live in landscape.",
    ],
  },
  {
    id: "vmix",
    label: "vMix",
    device: "On a Windows PC",
    steps: [
      "Click Add Input and choose Web Browser.",
      "Paste the link into URL.",
      "Set the size to 1920 by 1080, then click OK.",
      "Turn the new input on as Overlay 1 (the 1 under its preview).",
    ],
  },
];

/** The fields OBS asks for, in its own words. */
const OBS_FIELDS: Array<[string, string]> = [
  [
    "Width / Height",
    "1920 and 1080. OBS starts at 800 by 600, which cuts the graphics off.",
  ],
  ["Custom CSS", "Leave it as it is: it keeps the page see-through."],
  [
    "Shutdown source when not visible",
    "Leave it off, so the score keeps up while you switch scenes.",
  ],
  [
    "Control audio via OBS",
    "Turn it on if you want the event-card sounds in your stream.",
  ],
];

export const TROUBLESHOOTING: Array<[string, string]> = [
  [
    "Graphics cut off or too big",
    "Open the source's properties and set Width 1920, Height 1080.",
  ],
  [
    "The score stopped changing",
    "Right-click the source and choose Refresh. Check the scorer's phone is online.",
  ],
  [
    "A white or black box over the camera",
    "Set Custom CSS back to OBS's default (body background transparent).",
  ],
  [
    "No sound from event cards",
    "Turn on Sound in the control room and Control audio via OBS in the source.",
  ],
];

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-score text-sm tabular-nums text-primary-soft-foreground">
              {n}
            </span>
            <span className="[text-wrap:balance]">{title}</span>
          </span>
        }
        description={description}
      />
      <div className="px-4 pb-5 sm:px-5">{children}</div>
    </Card>
  );
}

interface StreamSetupProps {
  matchId: string;
  overlayUrl: string;
  qrDataUrl: string | null;
  /** May send commands (a scorer or organiser of the match). */
  canProduce: boolean;
  state: LiveMatchState | null;
  match: Match | null;
  serverNow?: number;
}

/**
 * "Stream this match": how to put the score on a stream, step by step,
 * from the match page. Anyone may follow it (the overlay link is public);
 * the steps that change the overlay are for the match's scorers.
 */
export function StreamSetup({
  matchId,
  overlayUrl,
  qrDataUrl,
  canProduce,
  state,
  match,
  serverNow,
}: StreamSetupProps) {
  const [tool, setTool] = useState<ToolId>("obs");
  const [copied, setCopied] = useState(false);
  const producer = useOverlayProducer(matchId);
  const { doc, send, last } = producer;
  const layers = useOverlayLayers({
    doc,
    loaded: producer.loaded,
    state,
    serverNow,
    muted: true,
  });
  const theme = resolveOverlayTheme(layers.scene.theme);
  const automatic = isAutomatic(doc);
  const linkId = useId();
  const chosen = STREAM_TOOLS.find((t) => t.id === tool)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The field stays selectable for a manual copy.
    }
  };

  const testSent = last?.label === "Test graphic";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Step n={1} title="How will you stream?">
        <div
          role="radiogroup"
          aria-label="Streaming tool"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {STREAM_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tool === t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                tool === t.id
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-sm text-muted-foreground">
                {t.device}
              </span>
            </button>
          ))}
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
          {chosen.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Step>

      <Step
        n={2}
        title="Pick a look"
        description={
          canProduce
            ? "The overlay changes as soon as you pick."
            : "Only this match's scorers, organisers and streamers can change it."
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {OVERLAY_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!canProduce}
              aria-pressed={theme === t.id}
              onClick={() =>
                void send(
                  { type: "SET_THEME", theme: t.id },
                  `Theme: ${t.label}`,
                )
              }
              className={cn(
                "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed",
                theme === t.id
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card hover:bg-accent disabled:hover:bg-card",
              )}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-sm text-muted-foreground">
                {t.description}
              </span>
            </button>
          ))}
        </div>
        <OverlayPreview
          className="mt-4"
          state={state}
          match={match}
          layers={layers}
          label="Preview of the overlay over a camera picture"
        />
      </Step>

      <Step
        n={3}
        title="Add the overlay"
        description="The same link works for every tool, and for the whole match."
      >
        <label htmlFor={linkId} className="text-sm font-medium">
          Overlay link
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id={linkId}
            readOnly
            value={overlayUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 font-mono text-sm"
          />
          <Button type="button" size="lg" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Link copied" : ""}
        </p>
        {qrDataUrl && (
          <div className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR code of the overlay link"
              width={132}
              height={132}
              className="rounded-lg"
            />
            <p className="text-sm text-muted-foreground">
              Streaming from a phone? Scan this with it to open the link there.
            </p>
          </div>
        )}
        {canProduce && (
          <details className="mt-4 rounded-xl border border-border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Streaming every match from the same ground?
            </summary>
            <p className="mt-2 text-muted-foreground">
              Use the ground&apos;s fixed link instead: set it up in OBS once,
              then put each match on it here.
            </p>
            <div className="mt-3">
              <ChannelPicker matchId={matchId} />
            </div>
          </details>
        )}
        {tool === "obs" && (
          <dl className="mt-4 divide-y divide-border rounded-xl border border-border text-sm">
            {OBS_FIELDS.map(([field, what]) => (
              <div
                key={field}
                className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr]"
              >
                <dt className="font-medium">{field}</dt>
                <dd className="text-muted-foreground">{what}</dd>
              </div>
            ))}
          </dl>
        )}
      </Step>

      <Step
        n={4}
        title="Check it works"
        description="Send a test strip and look for it on your stream."
      >
        {canProduce ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void send(
                  {
                    type: "SHOW_STRAP",
                    strap: {
                      id: `test-${Date.now()}`,
                      type: "custom",
                      badge: "Test",
                      title: "Your overlay is working",
                      durationMs: 8000,
                    },
                  },
                  "Test graphic",
                )
              }
            >
              Send test graphic
            </Button>
            <p role="status" aria-live="polite" className="mt-2 text-sm">
              {testSent && last?.status === "on_air"
                ? 'Sent. A strip saying "Your overlay is working" shows above the score for 8 seconds.'
                : testSent && last?.status === "failed"
                  ? `Not sent. ${last.message}`
                  : testSent
                    ? "Sending…"
                    : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask one of this match&apos;s scorers or streamers to send a test
            from this page, or wait for the next ball: the score updates on its
            own.
          </p>
        )}
      </Step>

      <Step n={5} title="Who runs the graphics?">
        {canProduce ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={automatic}
              onClick={() =>
                void send(
                  { type: "SET_AUTO", auto: DEFAULT_AUTO_RULES },
                  "Automatic graphics",
                )
              }
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                automatic
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">
                Automatic (recommended)
              </span>
              <span className="block text-sm text-muted-foreground">
                Fours, sixes, wickets and fifties get a card by themselves.
                Nobody needs to watch the overlay.
              </span>
            </button>
            <Link
              href={`/overlay/${matchId}/control`}
              onClick={() =>
                void send(
                  { type: "SET_AUTO", auto: manualAutoRules() },
                  "Manual graphics",
                )
              }
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                !automatic
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">
                I&apos;ll run the graphics
              </span>
              <span className="block text-sm text-muted-foreground">
                Opens the control room: cards, lower thirds, sponsors.
              </span>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Event cards show by themselves after fours, sixes, wickets and
            fifties. The match&apos;s scorers and streamers can change that in
            the control room.
          </p>
        )}
      </Step>

      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold">If something looks wrong</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {TROUBLESHOOTING.map(([problem, fix]) => (
            <div key={problem}>
              <dt className="font-medium">{problem}</dt>
              <dd className="text-muted-foreground">{fix}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

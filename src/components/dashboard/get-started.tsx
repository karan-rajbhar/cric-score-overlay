"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { cardSurface } from "~/components/ds/card";
import { getOnboardingProgress } from "~/app/dashboard/actions";
import {
  onboardingComplete,
  onboardingSteps,
  type OnboardingProgress,
} from "~/app/dashboard/onboarding";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function getStartedKey(userId: string): string {
  return `cricscore:get-started:${userId}`;
}

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the checklist just shows again.
  }
}

/**
 * Dismissible first-run checklist: create a team, add players, create a
 * match, optionally invite a co-scorer. Hidden for good once dismissed or
 * once the required steps are done (remembered per user in localStorage,
 * so returning users pay no reads).
 */
export function GetStarted({ userId }: { userId: string }) {
  const key = getStartedKey(userId);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Dismissed or done: no request, and `progress` stays null (hidden).
    if (readFlag(key)) return;
    let active = true;
    getOnboardingProgress()
      .then((p) => {
        if (!active || !p) return;
        if (onboardingComplete(p)) {
          writeFlag(key, "done");
          setHidden(true);
          return;
        }
        setProgress(p);
      })
      .catch(() => {
        // Not essential: leave the dashboard as it is.
      });
    return () => {
      active = false;
    };
  }, [key]);

  if (hidden || !progress) return null;

  const steps = onboardingSteps(progress);
  const done = steps.filter((s) => s.done).length;
  const dismiss = () => {
    writeFlag(key, "dismissed");
    setHidden(true);
  };

  // One compact row that opens the steps (N11): the first screen of Home
  // stays the live matches.
  return (
    <section
      aria-labelledby="get-started-title"
      className={cn(cardSurface, "flex items-start gap-1 p-1")}
    >
      <details className="group min-w-0 flex-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <h2
              id="get-started-title"
              className="text-sm font-semibold text-foreground"
            >
              Set up a team and your first match
            </h2>
            <span className="block text-xs tabular-nums text-muted-foreground">
              {done} of {steps.length} done
            </span>
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ol className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          {steps.map((step, i) => {
            // Why a step waits, instead of a faded box with no reason.
            const waits = !step.done && !step.href;
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      step.done
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {step.label}
                    {step.optional && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {waits
                      ? step.id === "players"
                        ? "After you create a team."
                        : "After you create a match."
                      : step.description}
                  </span>
                </span>
                <span className="sr-only">
                  {step.done ? " Done." : " Not done yet."}
                </span>
              </>
            );
            const itemClass =
              "flex min-h-11 items-start gap-3 rounded-xl bg-muted/40 p-3";
            return (
              <li key={step.id}>
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className={cn(itemClass, "transition-colors hover:bg-accent")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={itemClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </details>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 text-muted-foreground"
        onClick={dismiss}
        aria-label="Dismiss the set-up checklist"
      >
        <X />
      </Button>
    </section>
  );
}

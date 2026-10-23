"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
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

  return (
    <section
      aria-labelledby="get-started-title"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="get-started-title"
            className="text-balance text-base font-semibold text-foreground"
          >
            Get started
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {done} of {steps.length}
            </span>{" "}
            done. Set up a team and your first match.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground"
          onClick={dismiss}
          aria-label="Dismiss get started checklist"
        >
          <X />
        </Button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step, i) => {
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold tabular-nums",
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
                  {step.description}
                </span>
              </span>
              <span className="sr-only">
                {step.done ? " Done." : " Not done yet."}
              </span>
            </>
          );
          const itemClass =
            "flex items-start gap-3 rounded-lg border border-border/70 p-3";
          return (
            <li key={step.id}>
              {step.href && !step.done ? (
                <Link
                  href={step.href}
                  className={cn(
                    itemClass,
                    "transition-colors hover:bg-accent/50",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className={cn(itemClass, !step.done && "opacity-60")}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

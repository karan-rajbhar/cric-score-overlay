"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Radio, Trophy, Tv, Sparkles, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Radio,
    badge: "Live Engine",
    title: "Real-time Ball-by-Ball",
    description:
      "Precision ball-by-ball scoring that keeps every projection in sync — strike rotation, partnerships, fall of wickets, and run rates update atomically.",
  },
  {
    icon: Trophy,
    badge: "Clubs & Cups",
    title: "Tournament Ecosystem",
    description:
      "Manage club rosters, squads, fixtures, and standings. Full scorecards, wagon wheel telemetry, and player honours stored match by match.",
  },
  {
    icon: Tv,
    badge: "OBS Ready",
    title: "Stream Broadcast Overlays",
    description:
      "Glassmorphic and sunlit TV broadcast overlays for OBS Studio with instant animations, live wagon-wheels, and low-latency fallback polling.",
  },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-10 pb-16 sm:space-y-16">
      {/* Sunlit Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-card via-card/90 to-emerald-500/5 px-4 py-10 text-center shadow-sm sm:rounded-3xl sm:px-12 sm:py-24">
        {/* Playful Ambient Background Circles */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl">
          <h1 className="text-balance text-3xl font-black tracking-tight text-foreground sm:text-5xl sm:leading-[1.15] md:text-6xl">
            Score &amp; Stream Cricket with{" "}
            <span className="gradient-joy-text">Broadcast Precision</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:mt-6 sm:text-lg">
            Real-time ball-by-ball matchday scoring, dynamic trajectory wagon
            wheels, instant OBS broadcast overlays, and complete tournament
            management. Built for clubs, schools, and cricket streamers.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {user ? (
              <>
                <Button
                  asChild
                  size="lg"
                  className="interactive-button h-11 w-full rounded-xl bg-primary px-7 font-bold shadow-md hover:bg-primary/90 sm:w-auto"
                >
                  <Link href="/matches/create" className="gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Score New Match</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="interactive-button h-11 w-full rounded-xl border-border/80 px-7 font-semibold sm:w-auto"
                >
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  size="lg"
                  className="interactive-button h-11 w-full rounded-xl bg-primary px-7 font-bold shadow-md hover:bg-primary/90 sm:w-auto"
                >
                  <Link href="/auth/signup" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Start Free Account</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="interactive-button h-11 w-full rounded-xl border-border/80 px-7 font-semibold sm:w-auto"
                >
                  <Link href="/matches">Browse Live Matches</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Core Toolkit
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Engineered for Grassroots &amp; Broadcast Leagues
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, badge, title, description }) => (
            <Card
              key={title}
              className="group rounded-2xl border-border/70 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/80 bg-background text-primary shadow-sm transition-transform duration-200 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge variant="outline" className="text-[10.5px]">
                    {badge}
                  </Badge>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Matchday Walkthrough */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 sm:rounded-3xl sm:p-10">
        <div className="max-w-2xl">
          <Badge variant="success" className="mb-3">
            Quick Start Guide
          </Badge>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            Live in Under 3 Minutes
          </h2>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Designed to make scoring seamless on touchscreens while giving your
            viewers a broadcast experience.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-8 md:grid-cols-2">
          {/* For Scorers */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-950 dark:text-emerald-200 sm:text-base">
              <Zap className="h-4 w-4 text-emerald-600" />
              For Scorers &amp; Officials
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs sm:mt-4 sm:space-y-3 sm:text-sm">
              {[
                "Pick match teams or create custom playing XIs",
                "Record toss decision and select opening batters",
                "Single-tap scoring for runs, extras, and wickets",
                "Automatic wagon-wheel logging and wagon radar generation",
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 sm:gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {idx + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* For Streamers */}
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-sky-950 dark:text-sky-200 sm:text-base">
              <Tv className="h-4 w-4 text-sky-600" />
              For OBS Streamers &amp; Channels
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs sm:mt-4 sm:space-y-3 sm:text-sm">
              {[
                "Copy the OBS browser source URL from the match dashboard",
                "Paste into OBS as 1920×1080 transparent browser source",
                "Switch between 29+ TV broadcast views with one click",
                "Zero lag: WebSocket realtime with instant polling failover",
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 sm:gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-700 dark:text-sky-300">
                    {idx + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center sm:mt-8">
          <Button
            asChild
            size="lg"
            className="interactive-button w-full rounded-xl bg-primary px-8 font-bold sm:w-auto"
          >
            <Link href={user ? "/matches/create" : "/auth/signup"}>
              {user ? "Score a Match Now" : "Get Started Free"}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

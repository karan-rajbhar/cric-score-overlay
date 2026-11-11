"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  CloudOff,
  MoreHorizontal,
  RotateCcw,
  SearchX,
  Share2,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { BallChip, KeypadButton } from "~/components/ds/ball";
import { Button } from "~/components/ds/button";
import { Chip } from "~/components/ds/chip";
import { EmptyState } from "~/components/ds/empty-state";
import { ChoiceGroup, Field, Input, SearchField } from "~/components/ds/field";
import { ListCard, ListRow } from "~/components/ds/list";
import { MatchCard } from "~/components/ds/match-card";
import { MatchNote } from "~/components/ds/score";
import { cn } from "~/lib/utils";
import { Caption, DocSection, Specimen } from "../_components/doc";
import { RESULT, TEAMS } from "../_components/sample";

/**
 * Targets for the UI/UX audit of 11 November 2026
 * (`docs/ui-ux-audit-2026-11-11.md`). Each specimen names the entries it
 * answers. They are drawn here from tokens and design-system pieces, so a
 * fix can be compared with them; the app's own components change in the fix.
 */

/** A phone-wide box, so a specimen is judged at the width it is for. */
function PhoneBox({
  width = 390,
  className,
  children,
}: {
  width?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ maxWidth: width }}
      className={cn(
        "mx-auto w-full rounded-xl border border-border bg-background p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CouldNotLoad() {
  return (
    <Specimen
      id="spec-could-not-load"
      title="Could not load"
      usage="A list that could not be read says so in the list's place, with Try again. It never shows the empty state: empty means the read worked and found nothing. No error text from the database. (N2, M6, M18)"
      bodyClassName="grid gap-4 md:grid-cols-2"
    >
      <div>
        <EmptyState
          icon={CloudOff}
          title="Could not load matches"
          description="Check your connection and try again."
          action={
            <Button variant="outline" size="md">
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          }
        />
        <Caption>the read failed</Caption>
      </div>
      <div>
        <EmptyState
          icon={SearchX}
          title="Nothing live right now"
          description="Live matches show here as soon as one starts."
        />
        <Caption>the read worked and found nothing</Caption>
      </div>
    </Specimen>
  );
}

function ErrorScreens() {
  return (
    <Specimen
      id="spec-error-screens"
      title="Not found and something went wrong"
      usage="Both say what happened in plain words and offer the nearest useful place. No error text, no digest. Home leads to the landing page when signed out, never to the sign-in wall. (N6, N7, N20)"
      bodyClassName="grid gap-4 md:grid-cols-2"
    >
      <EmptyState
        icon={SearchX}
        title="This match is not here"
        description="It may have been deleted, or the link is not complete."
        action={<Button variant="outline">All matches</Button>}
      />
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="The page could not be shown. Try again in a moment."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button>Try again</Button>
            <Button variant="outline">Home</Button>
          </div>
        }
      />
    </Specimen>
  );
}

/** The top bar's target layout: side tracks never give way to the title. */
function TargetBar({ title }: { title: string }) {
  return (
    <div className="grid grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center gap-2">
      <Button
        variant="surface"
        size="icon"
        aria-label="Back"
        className="justify-self-start"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <p className="truncate text-center text-base font-semibold text-foreground">
        {title}
      </p>
      <div className="flex items-center gap-2 justify-self-end">
        <Button variant="surface" size="icon" aria-label="Share">
          <Share2 aria-hidden="true" />
        </Button>
        <Button variant="surface" size="icon" aria-label="More actions">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function LongTitle() {
  const title = "Strikers vs Warriors - Championship Opener";
  return (
    <Specimen
      id="spec-long-title"
      title="Top bar with a long title"
      usage="The title ends in an ellipsis before the buttons. The back button and the actions keep their width; only the title gives way. (M1)"
      bodyClassName="space-y-4"
    >
      <div>
        <PhoneBox>
          <TargetBar title={title} />
        </PhoneBox>
        <Caption>390 px</Caption>
      </div>
      <div>
        <PhoneBox width={320}>
          <TargetBar title={title} />
        </PhoneBox>
        <Caption>320 px</Caption>
      </div>
    </Specimen>
  );
}

function LateFixture() {
  return (
    <Specimen
      id="spec-fixture-late"
      title="A fixture past its start time"
      usage="A match that has not started when its time has passed stays listed for its scorers and its club, says so, and gives the time it was due with the year when that is not this year. It is not called Upcoming. (M3, M17, N10)"
    >
      <PhoneBox>
        <div className="rounded-xl bg-card p-4 shadow-soft ring-1 ring-border/40 dark:ring-border">
          <p className="text-center text-xs text-muted-foreground">
            Summer League
          </p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <TeamCrest {...TEAMS.northfield} />
              <span className="text-sm font-medium text-foreground">
                {TEAMS.northfield.name}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Chip tone="warning">Not started</Chip>
              <span className="font-score text-sm tabular-nums text-muted-foreground">
                due 14:00
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <TeamCrest {...TEAMS.eastside} />
              <span className="text-sm font-medium text-foreground">
                {TEAMS.eastside.name}
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Was due Sat 10 Aug 2024 · Central Park Ground
          </p>
        </div>
      </PhoneBox>
    </Specimen>
  );
}

function ResultWithDate() {
  return (
    <Specimen
      id="spec-result-date"
      title="A result says when and in what"
      usage="The card's first line is the date, the competition and the format. The match header carries the same date under the competition. The competition comes from the match's own snapshot, so a league game is never filed under Friendly matches. (M2, M4)"
    >
      <PhoneBox className="p-0 sm:p-4">
        <MatchCard
          href="#spec-result-date"
          competition="Sat 25 Oct · Summer League · T20"
          status="completed"
          first={{ ...RESULT.first, dim: true }}
          second={RESULT.second}
          note={<MatchNote tone="result">{RESULT.note}</MatchNote>}
        />
      </PhoneBox>
    </Specimen>
  );
}

function RowWithActions() {
  return (
    <Specimen
      id="spec-row-actions"
      title="A person row with a status and actions"
      usage="On a phone the name has the first line to itself. Role and date go on the second line; Make admin and Remove go in the row's menu. A name is the last thing to be cut. The row opens the person. (T1, T7, P8)"
    >
      <PhoneBox className="p-0">
        <ListCard>
          {[
            { name: "Venkataraghavan Srinivasaraghavan", role: "Admin" },
            { name: "Amit Patel", role: "Member" },
          ].map((m) => (
            <ListRow
              key={m.name}
              leading={<Avatar name={m.name} />}
              title={m.name}
              subtitle={
                <span className="flex items-center gap-2">
                  <Chip tone={m.role === "Admin" ? "primary" : "outline"}>
                    {m.role}
                  </Chip>
                  Joined 1 Jun 2024
                </span>
              }
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${m.name}`}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              }
            />
          ))}
        </ListCard>
      </PhoneBox>
    </Specimen>
  );
}

function AddPlayer() {
  return (
    <Specimen
      id="spec-add-player"
      title="Adding or picking a player"
      usage="People found come first, each with a line that tells them apart. Someone who cannot be used stays in the list with the reason. Someone in both squads is offered, and joins the side they first bat or bowl for. The search says where it stands. Creating comes last and is the quiet button. (P1, S1)"
    >
      <PhoneBox>
        <SearchField aria-label="Search players" defaultValue="mi" />
        <ListCard className="mt-3">
          <ListRow
            onClick={() => undefined}
            leading={<Avatar name="Mike Wilson" />}
            title="Mike Wilson"
            subtitle="@mike_wilson · 42 matches"
            trailing={
              <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
            }
          />
          <ListRow
            onClick={() => undefined}
            leading={<Avatar name="Chris Miller" />}
            title="Chris Miller"
            subtitle="Also in Strikers' squad"
            trailing={
              <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
            }
          />
          <ListRow
            onClick={() => undefined}
            disabled
            leading={<Avatar name="Dan Milton" />}
            title="Dan Milton"
            subtitle="Batting for Strikers in this match"
          />
        </ListCard>
        <p className="mt-2 text-xs text-muted-foreground">
          3 people match &ldquo;mi&rdquo;. Pick only the same person.
        </p>
        <Button variant="outline" className="mt-3 w-full">
          <UserPlus aria-hidden="true" />
          Add &ldquo;mi&rdquo; as a new player
        </Button>
      </PhoneBox>
    </Specimen>
  );
}

function FormErrors() {
  return (
    <Specimen
      id="spec-form-errors"
      title="A form sent with mistakes"
      usage="A mistake in a field shows under that field, and focus moves to the first one. Something that is not about a field (no connection) is a callout above the button. A toast only confirms what worked. The browser's own bubbles are off (noValidate). (F1, N18)"
    >
      <PhoneBox className="space-y-4">
        <Field label="Tournament name" error="Enter the tournament's name.">
          {(p) => <Input {...p} placeholder="e.g. Summer Cup 2026" />}
        </Field>
        <Field label="Start date">
          {(p) => <Input {...p} defaultValue="20 Dec 2026" />}
        </Field>
        <Field label="End date" error="The end date is before the start date.">
          {(p) => <Input {...p} defaultValue="1 Dec 2026" />}
        </Field>
        <Field label="Venue" optional>
          {(p) => <Input {...p} placeholder="e.g. Riverside ground" />}
        </Field>
        <Button className="w-full">Create tournament</Button>
      </PhoneBox>
    </Specimen>
  );
}

function TouchSizes() {
  const sizes = [
    {
      px: 44,
      rule: "Anything tapped on a phone or tablet: buttons, rows, menu items, tabs, the keys of a sheet.",
    },
    {
      px: 36,
      rule: "Only in a desktop toolbar used with a mouse, with 8 px between neighbours.",
    },
    {
      px: 24,
      rule: "The floor for anything, and never for an action that deletes or removes.",
    },
  ];
  return (
    <Specimen
      id="spec-touch-sizes"
      title="Touch sizes"
      usage="Measured on the smaller side. A whole row is the target, not only the text in it. (M9, N16, N17, P8, T10, S5)"
    >
      <ul className="space-y-3">
        {sizes.map((s) => (
          <li key={s.px} className="flex items-center gap-4">
            <span
              style={{ width: s.px, height: s.px }}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary-soft font-score text-xs font-semibold tabular-nums text-primary-soft-foreground"
            >
              {s.px}
            </span>
            <span className="text-sm text-foreground">{s.rule}</span>
          </li>
        ))}
      </ul>
    </Specimen>
  );
}

function DatesAndTimes() {
  const rows = [
    [
      "On a card or in a row",
      "Sat 25 Oct",
      "Add the year when it is not this year: Sat 10 Aug 2024",
    ],
    ["In a table", "20 Jul 2024", ""],
    ["A range", "15 Jul to 30 Aug 2024", "The year once, at the end"],
    ["A time", "19:30", "24-hour, as the cards have it"],
    ["In full (match details)", "Saturday 10 August 2024, 19:30", ""],
    ["Past its time, not started", "Was due Sat 10 Aug 2024, 19:30", ""],
  ];
  return (
    <Specimen
      id="spec-dates"
      title="Dates and times"
      usage="Day before month, the month as a word, one helper for all of them. Never 2024-07-15, Jul 20, 2024 or 1/6/2024. (P5, T3, T7, M17)"
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              Where
            </th>
            <th scope="col" className="py-2 font-medium">
              Written as
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([where, written, note]) => (
            <tr key={where}>
              <td className="py-2 pr-4 align-top text-muted-foreground">
                {where}
              </td>
              <td className="py-2 align-top">
                <span className="font-medium tabular-nums text-foreground">
                  {written}
                </span>
                {note && (
                  <span className="block text-xs text-muted-foreground">
                    {note}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Specimen>
  );
}

function ChoiceDialog() {
  const [winner, setWinner] = useState("");
  const [decision, setDecision] = useState("");
  const missing = !winner
    ? "Choose who won the toss"
    : !decision
      ? "Choose bat or bowl"
      : null;
  return (
    <Specimen
      id="spec-choice-dialog"
      title="A dialog that records a choice"
      usage="One header (a title and one line of help, no icon tile), choices as tiles with one selected look, nothing chosen when it opens, and one footer: the main button full width, saying what is missing while it cannot be pressed, the way out under it. (S7, S8, M14)"
    >
      <PhoneBox className="space-y-4 bg-card shadow-float">
        <div className="space-y-1 text-center">
          <p className="text-lg font-semibold text-foreground">Toss</p>
          <p className="text-sm text-muted-foreground">
            The opening batters and bowler come next.
          </p>
        </div>
        <ChoiceGroup
          legend="Who won the toss?"
          name="spec-toss"
          value={winner}
          onChange={setWinner}
          options={[
            { value: "riv", label: TEAMS.riverside.name },
            { value: "hil", label: TEAMS.hilltop.name },
          ]}
        />
        <ChoiceGroup
          legend="They chose to"
          name="spec-decision"
          layout="cards"
          value={decision}
          onChange={setDecision}
          options={[
            { value: "bat", label: "Bat" },
            { value: "bowl", label: "Bowl" },
          ]}
        />
        <div className="space-y-2">
          <Button className="w-full" disabled={Boolean(missing)}>
            {missing ?? "Start match"}
          </Button>
          <Button variant="ghost" className="w-full">
            Cancel
          </Button>
        </div>
      </PhoneBox>
    </Specimen>
  );
}

type Slot = "idle" | "noBall" | "offline";

/** The one row above the keys that changes; the keys below it never move. */
function KeypadSlot({ slot }: { slot: Slot }) {
  if (slot === "noBall") {
    return (
      <div className="flex h-11 items-center gap-1.5 rounded-lg bg-warning/10 px-2 text-xs font-medium text-warning">
        <span className="shrink-0">No ball, runs</span>
        {["Bat", "Byes", "Leg byes"].map((label, i) => (
          <span
            key={label}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center rounded-full",
              i === 0
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground ring-1 ring-border",
            )}
          >
            {label}
          </span>
        ))}
        <span className="shrink-0 pl-1 text-foreground">Cancel</span>
      </div>
    );
  }
  if (slot === "offline") {
    return (
      <div className="flex h-11 items-center gap-2 rounded-lg bg-muted px-3 text-xs font-medium text-foreground">
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        Offline: 1 ball waiting to send
      </div>
    );
  }
  return (
    <div className="flex h-11 items-center px-1 text-xs text-muted-foreground">
      New over, waiting for the first ball
    </div>
  );
}

/** Top bar, scoreboard, the two batters and the bowler: one line each. */
function SmallScoreboard() {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2">
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Strikers v Thunder
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Saved
        </span>
        <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
        <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
      </div>
      <div className="shrink-0 rounded-xl bg-hero px-3 py-2 text-hero-foreground">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-score text-2xl font-bold tabular-nums">
            5/0{" "}
            <span className="text-sm font-medium opacity-80">(0.2 of 20)</span>
          </span>
          <span className="text-xs font-medium opacity-90">Run rate 15.00</span>
        </div>
        <p className="text-xs opacity-80">Strikers · 1st innings · T20</p>
      </div>
      <div className="shrink-0 divide-y divide-border rounded-xl bg-card text-sm ring-1 ring-border/60">
        {[
          ["Mike Wilson *", "1 (1)"],
          ["David Brown", "4 (1)"],
          ["Jordan Bell", "0/5 (0.2)"],
        ].map(([name, figure], i) => (
          <div
            key={name}
            className="flex h-10 items-center justify-between px-3"
          >
            <span className={cn("truncate", i === 0 && "font-semibold")}>
              {name}
            </span>
            <span className="font-score font-semibold tabular-nums">
              {figure}
            </span>
          </div>
        ))}
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-1">
        <span className="text-xs font-semibold text-foreground">Over 1</span>
        <BallChip kind="run" label="1" size="sm" />
        <BallChip kind="four" label="4" size="sm" />
      </div>
    </>
  );
}

/** The keys: the same grid whatever is armed; only the captions change. */
function SmallKeypad({ armed }: { armed: boolean }) {
  const inAll = (runs: number) => (armed ? `${runs + 1} in all` : undefined);
  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-1.5">
        {[0, 1, 2, 3].map((r) => (
          <KeypadButton
            key={r}
            className="min-h-0 [&>span:nth-child(2)]:text-xs"
            caption={inAll(r)}
            aria-label={`${r} runs`}
          >
            {r}
          </KeypadButton>
        ))}
        <KeypadButton
          tone="four"
          className="min-h-0 [&>span:nth-child(2)]:text-xs"
          caption={inAll(4) ?? "Four"}
        >
          4
        </KeypadButton>
        <KeypadButton
          tone="six"
          className="min-h-0 [&>span:nth-child(2)]:text-xs"
          caption={inAll(6) ?? "Six"}
        >
          6
        </KeypadButton>
        <KeypadButton
          className="min-h-0 [&>span:nth-child(2)]:text-xs"
          caption={inAll(5)}
          aria-label="5 runs"
        >
          5
        </KeypadButton>
        <KeypadButton
          tone="action"
          className="min-h-0 [&>span:nth-child(2)]:text-xs"
          aria-label="More runs"
        >
          7+
        </KeypadButton>
        {["Wide", "No ball", "Bye", "Leg bye"].map((x) => (
          <KeypadButton
            key={x}
            tone="extra"
            className={cn(
              "min-h-0 [&>span]:text-xs",
              armed && x === "No ball" && "ring-2 ring-primary",
            )}
          >
            {x}
          </KeypadButton>
        ))}
      </div>
      <div className="grid h-12 shrink-0 grid-cols-2 gap-1.5">
        <KeypadButton tone="wicket" className="min-h-0 [&>span]:text-base">
          Wicket
        </KeypadButton>
        <KeypadButton tone="action" className="min-h-0 [&>span]:text-base">
          Undo
        </KeypadButton>
      </div>
    </>
  );
}

/** The scoring column drawn to fit 360 x 640, nothing under 12 px. */
function SmallScoringScreen({ slot, label }: { slot: Slot; label: string }) {
  return (
    <figure className="shrink-0">
      <div
        style={{ width: 360, height: 640 }}
        className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-background p-2"
      >
        <SmallScoreboard />
        <div className="shrink-0">
          <KeypadSlot slot={slot} />
        </div>
        <SmallKeypad armed={slot === "noBall"} />
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

function ScoringSmall() {
  return (
    <Specimen
      id="spec-scoring-small"
      title="The scoring screen at 360 by 640"
      usage="The whole column fits with Wicket and Undo on screen. One fixed row above the keys holds whatever changes: an armed extra and its choice, the note after Undo, the offline state. The keys below it never move or shrink. No text under 12 px; the scoreboard is one block and says each thing once. (S2, S3, S4, S11)"
    >
      {/* relative: the ball chips' screen-reader text is absolutely
          positioned, and would otherwise widen the page from inside the
          frames that are scrolled out of view. */}
      <div className="no-scrollbar relative flex gap-4 overflow-x-auto pb-1">
        <SmallScoringScreen slot="idle" label="Between balls" />
        <SmallScoringScreen
          slot="noBall"
          label="No ball armed: same keys, same places"
        />
        <SmallScoringScreen
          slot="offline"
          label="Offline: said in the row, not in a toast"
        />
      </div>
    </Specimen>
  );
}

function Qualification() {
  const rows = [
    {
      team: "Bay Strikers",
      tone: "success" as const,
      status: "Qualified",
      line: "Top two is certain.",
    },
    {
      team: "Old Town CC",
      tone: "neutral" as const,
      status: "In contention",
      line: "Needs 1 win from 2 games.",
    },
    {
      team: "Northfield",
      tone: "neutral" as const,
      status: "In contention",
      line: "No games left and level on points: goes through on net run rate only.",
    },
    {
      team: "Eastside Eagles",
      tone: "danger" as const,
      status: "Eliminated",
      line: "Cannot reach 4 points.",
    },
  ];
  return (
    <Specimen
      id="spec-qualification"
      title="Qualification wording"
      usage="What a team needs is worked out from the games it has left, and is never something it cannot do. Words in full: played, games left, points. (T4)"
    >
      <ListCard>
        {rows.map((r) => (
          <ListRow
            key={r.team}
            title={r.team}
            subtitle={r.line}
            trailing={<Chip tone={r.tone}>{r.status}</Chip>}
          />
        ))}
      </ListCard>
    </Specimen>
  );
}

export function StatesSection() {
  return (
    <DocSection
      id="states"
      title="States and edge cases"
      description="What a screen shows when something is late, missing, too long or too small. These are the targets for the UI/UX audit of 11 November 2026 (docs/ui-ux-audit-2026-11-11.md); each names the entries it answers."
    >
      <CouldNotLoad />
      <ErrorScreens />
      <LongTitle />
      <div className="grid gap-8 lg:grid-cols-2">
        <LateFixture />
        <ResultWithDate />
        <RowWithActions />
        <AddPlayer />
        <FormErrors />
        <ChoiceDialog />
      </div>
      <ScoringSmall />
      <div className="grid gap-8 lg:grid-cols-2">
        <TouchSizes />
        <Qualification />
      </div>
      <DatesAndTimes />
    </DocSection>
  );
}

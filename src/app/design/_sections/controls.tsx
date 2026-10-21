"use client";

import { useState } from "react";
import { Bell, MoreHorizontal, Plus, Search, Share2 } from "lucide-react";
import { Button } from "~/components/ds/button";
import { Chip, LiveChip, MatchStatusChip } from "~/components/ds/chip";
import {
  Checkbox,
  ChoiceGroup,
  Field,
  Input,
  SearchField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "~/components/ds/field";
import {
  Segmented,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/tabs";
import { Caption, DocSection, Specimen } from "../_components/doc";
import { TEAMS } from "../_components/sample";

function Buttons() {
  return (
    <Specimen
      title="Buttons"
      usage="Pills. One primary action per view (navy, with a soft navy shadow), soft for the next most likely, outline or ghost for the rest. Surface buttons are the round white ones on the wash. Phones: a view's main action spans the width."
      bodyClassName="space-y-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button>Start scoring</Button>
        <Button variant="soft">Scorecard</Button>
        <Button variant="outline">Edit squad</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete match</Button>
        <Button variant="link">See all</Button>
      </div>
      <Caption>
        variant: primary · soft · outline · ghost · destructive · link
      </Caption>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <Button>
          <Plus aria-hidden="true" />
          New match
        </Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
      </div>
      <Caption>size: sm 36 · md 44 · lg 48 px · loading · disabled</Caption>
      <div className="flex flex-wrap items-center gap-3 rounded-panel bg-hero p-4">
        <Button variant="surface" size="icon" aria-label="Search">
          <Search />
        </Button>
        <Button variant="surface" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <Button variant="surface" size="icon" aria-label="Share match">
          <Share2 />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreHorizontal />
        </Button>
      </div>
      <Caption>size: icon 44 · icon-sm 36 · always with aria-label</Caption>
      <div className="max-w-sm">
        <Button className="w-full">Follow live</Button>
      </div>
    </Specimen>
  );
}

function Fields() {
  const [toss, setToss] = useState<string | null>(null);
  const [decision, setDecision] = useState<"bat" | "bowl" | null>(null);
  return (
    <Specimen
      title="Fields"
      usage="44 px controls with the label above, hint below, error above the hint. Search is a pill with autocorrect off. A few choices are radios drawn as pills or cards; nothing is preselected."
      bodyClassName="grid gap-6 md:grid-cols-2"
    >
      <Field label="Match title" hint="Shown on the scorecard and the overlay.">
        {(p) => <Input {...p} placeholder="Riverside v Hilltop" />}
      </Field>
      <Field label="Overs per innings" error="Enter a number from 1 to 50.">
        {(p) => <Input {...p} inputMode="numeric" defaultValue="0" />}
      </Field>
      <Field label="Format">
        {(p) => (
          <Select>
            <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
              <SelectValue placeholder="Choose a format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t20">T20</SelectItem>
              <SelectItem value="odi">One day (50 overs)</SelectItem>
              <SelectItem value="t10">T10</SelectItem>
              <SelectItem value="custom">Custom overs</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      <Field label="Venue" optional>
        {(p) => <Input {...p} placeholder="Ground name" />}
      </Field>
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-foreground">
          Search
        </span>
        <SearchField
          aria-label="Search players, teams, matches"
          placeholder="Players, teams, matches"
        />
      </div>
      <Field label="Notes" optional>
        {(p) => <Textarea {...p} placeholder="Pitch, weather, anything else" />}
      </Field>
      <ChoiceGroup
        legend="Who won the toss?"
        name="toss"
        value={toss}
        onChange={setToss}
        options={[
          { value: "riv", label: TEAMS.riverside.name },
          { value: "hil", label: TEAMS.hilltop.name },
        ]}
      />
      <ChoiceGroup
        legend="They chose to"
        name="decision"
        layout="cards"
        value={decision}
        onChange={setDecision}
        options={[
          { value: "bat", label: "Bat", description: "Set a target" },
          { value: "bowl", label: "Bowl", description: "Chase" },
        ]}
      />
      <Checkbox
        label="Free hit after a no-ball"
        description="The next legal delivery cannot be a wicket except run out."
        defaultChecked
      />
    </Specimen>
  );
}

function TabsAndFilters() {
  const [filter, setFilter] = useState<"all" | "boundaries" | "wickets">("all");
  return (
    <Specimen
      title="Tabs and filters"
      usage="Pill tabs switch panels: the selected one is navy with a soft shadow, the rest white with a hairline. Segmented buttons filter one list. Both scroll sideways on phones rather than wrap."
      bodyClassName="space-y-6"
    >
      <Tabs defaultValue="summary">
        <TabsList aria-label="Match sections">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
          <TabsTrigger value="balls">Balls</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        {["summary", "scorecard", "balls", "stats", "info"].map((v) => (
          <TabsContent
            key={v}
            value={v}
            className="rounded-lg bg-muted p-4 text-sm text-muted-foreground"
          >
            The {v} panel.
          </TabsContent>
        ))}
      </Tabs>
      <Segmented
        label="Filter deliveries"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "boundaries", label: "Boundaries" },
          { value: "wickets", label: "Wickets" },
        ]}
      />
    </Specimen>
  );
}

function Chips() {
  return (
    <Specimen
      title="Chips"
      usage="Short labels. The live chip is the only red pill and its dot the only pulse in the product; the quiet form is for dense lists. Captain and keeper are written (c) and (wk), not chips."
      bodyClassName="space-y-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <LiveChip />
        <LiveChip quiet />
        <MatchStatusChip status="innings_break" />
        <MatchStatusChip status="scheduled" />
        <MatchStatusChip status="completed" />
        <MatchStatusChip status="abandoned" />
      </div>
      <Caption>
        LiveChip · MatchStatusChip status=live | innings_break | scheduled |
        completed | abandoned
      </Caption>
      <div className="flex flex-wrap items-center gap-2">
        <Chip>T20</Chip>
        <Chip tone="primary">Round 3</Chip>
        <Chip tone="success">Qualified</Chip>
        <Chip tone="warning">Rain delay</Chip>
        <Chip tone="danger">Eliminated</Chip>
        <Chip tone="outline">Batter</Chip>
        <Chip size="sm">sm</Chip>
      </div>
      <Caption>
        Chip tone: neutral · primary · success · warning · danger · outline
      </Caption>
    </Specimen>
  );
}

export function ControlsSection() {
  return (
    <DocSection
      id="controls"
      title="Controls"
      description="Things people press, type into and choose from."
    >
      <Buttons />
      <Fields />
      <div className="grid gap-6 xl:grid-cols-2">
        <TabsAndFilters />
        <Chips />
      </div>
    </DocSection>
  );
}

"use client";

import { Search } from "lucide-react";
import {
  GreetingBar,
  NotificationsButton,
  TabBar,
} from "~/components/ds/app-bar";
import { BallChip, OverStrip } from "~/components/ds/ball";
import { Button } from "~/components/ds/button";
import { Card } from "~/components/ds/card";
import { SectionHeader } from "~/components/ds/list";
import { MatchCard } from "~/components/ds/match-card";
import { PlayerHeader } from "~/components/ds/player-header";
import { MatchNote } from "~/components/ds/score";
import { CreaseTable } from "~/components/ds/scorecard";
import { ScreenWash, Sheet } from "~/components/ds/screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ds/tabs";
import { DocSection, PhoneFrame } from "../_components/doc";
import {
  LiveCarousel,
  MatchPageTop,
  ProfileSheet,
  UpcomingGroup,
} from "../_components/examples";
import {
  CREASE,
  LAST_OVER,
  PLAYER,
  RESULT,
  TAB_BAR_ITEMS,
  THIS_OVER,
} from "../_components/sample";

/** The phone tab bar, floating at the bottom of the frame. */
function FrameTabBar({ current }: { current: string }) {
  return (
    <div className="sticky bottom-3 z-10 px-3 pb-3">
      <TabBar
        items={TAB_BAR_ITEMS.map((t) => ({
          ...t,
          active: t.label === current,
        }))}
      />
    </div>
  );
}

function HomeScreen() {
  return (
    <PhoneFrame title="Home">
      <ScreenWash className="px-4 pt-5">
        <GreetingBar
          name="Aditya"
          greeting="Good afternoon"
          actions={
            <>
              <Button variant="surface" size="icon" aria-label="Search">
                <Search />
              </Button>
              <NotificationsButton hasNew />
            </>
          }
        />
        <div className="mt-5">
          <LiveCarousel />
        </div>
      </ScreenWash>
      <div className="space-y-4 px-4 pb-4 pt-4">
        <SectionHeader
          title="Upcoming"
          href="#screens"
          actionLabel="See more"
        />
        <UpcomingGroup />
        <SectionHeader title="Results" href="#screens" actionLabel="See more" />
        <MatchCard
          competition={RESULT.competition}
          status="completed"
          first={{ ...RESULT.first, dim: true }}
          second={RESULT.second}
          note={<MatchNote tone="result">{RESULT.note}</MatchNote>}
        />
      </div>
      <FrameTabBar current="Home" />
    </PhoneFrame>
  );
}

function LivePanel() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CreaseTable
          batters={CREASE.batters}
          strikerName={CREASE.striker}
          bowler={CREASE.bowler}
        />
        <div className="border-t border-border px-4 py-3">
          <OverStrip balls={THIS_OVER} total={5} />
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Over 16</span>
          <span className="font-score tabular-nums text-muted-foreground">
            12 runs
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {LAST_OVER.map((b, i) => (
            <BallChip key={i} {...b} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Desai to Sethi, caught by Joshi at long-on.
        </p>
      </Card>
    </div>
  );
}

function MatchScreen() {
  return (
    <PhoneFrame title="Match centre">
      <ScreenWash className="px-4 pb-10 pt-5">
        <MatchPageTop />
      </ScreenWash>
      <Sheet className="-mt-6 px-4 sm:px-4">
        <Tabs defaultValue="live">
          <TabsList aria-label="Match sections">
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="balls">Balls</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
          <TabsContent value="live">
            <LivePanel />
          </TabsContent>
          {["scorecard", "balls", "info"].map((v) => (
            <TabsContent
              key={v}
              value={v}
              className="text-sm text-muted-foreground"
            >
              The {v} panel.
            </TabsContent>
          ))}
        </Tabs>
      </Sheet>
      <FrameTabBar current="Matches" />
    </PhoneFrame>
  );
}

function PlayerScreen() {
  return (
    <PhoneFrame title="Player">
      <ScreenWash className="px-5 pb-12 pt-6">
        <PlayerHeader
          name={PLAYER.name}
          role={PLAYER.role}
          detail={PLAYER.detail}
          team={PLAYER.team}
        />
      </ScreenWash>
      <Sheet className="-mt-6 px-4 sm:px-4">
        <ProfileSheet />
      </Sheet>
      <FrameTabBar current="Search" />
    </PhoneFrame>
  );
}

export function ScreensSection() {
  return (
    <DocSection
      id="screens"
      title="Screens"
      description="The pieces put together at phone width, as a check that they read as one product. Swipe the live card on Home; the tab bar floats at the bottom of each frame."
    >
      <div className="grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
        <HomeScreen />
        <MatchScreen />
        <PlayerScreen />
      </div>
    </DocSection>
  );
}

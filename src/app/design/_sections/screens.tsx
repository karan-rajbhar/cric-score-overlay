"use client";

import type * as React from "react";
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
import { PlayerAwardRow } from "~/components/ds/player-award";
import { Disclosure } from "~/components/ds/disclosure";
import { Facts } from "~/components/ds/facts";
import { MatchNote, ScoreLine } from "~/components/ds/score";
import { BattingCard, CreaseTable } from "~/components/ds/scorecard";
import { ScreenWash, Sheet, TopStrip } from "~/components/ds/screen";
import { PinnedTabs, Tabs, TabsContent } from "~/components/ds/tabs";
import { InningsSummaryCard } from "~/components/matches/match-summary";
import { DocSection, PhoneFrame } from "../_components/doc";
import {
  LiveCarousel,
  MatchPageTop,
  ProfileSheet,
  UpcomingGroup,
} from "../_components/examples";
import {
  BATTING,
  CREASE,
  FIXTURE,
  LAST_OVER,
  LIVE_MATCH_TABS,
  MATCH_TABS,
  PLAYER,
  RESULT,
  RESULT_AWARD,
  RESULT_FIRST_INNINGS,
  RESULT_SIDE,
  TAB_BAR_ITEMS,
  TEAMS,
  THIS_OVER,
  UPCOMING_MATCH_TABS,
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

/** The tabs on their sheet; only the first panel is filled in. */
function MatchSheet({
  tabs,
  children,
}: {
  tabs: readonly { value: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <Sheet className="-mt-6 px-4 sm:px-4">
      <Tabs defaultValue={tabs[0]?.value}>
        <PinnedTabs label="Match sections" tabs={tabs} />
        <TabsContent value={tabs[0]?.value ?? ""}>{children}</TabsContent>
        {tabs.slice(1).map((t) => (
          <TabsContent
            key={t.value}
            value={t.value}
            className="text-sm text-muted-foreground"
          >
            The {t.label} panel.
          </TabsContent>
        ))}
      </Tabs>
    </Sheet>
  );
}

/** Finished: the tabs start high, and Summary opens on who shone. */
function MatchResultScreen() {
  return (
    <PhoneFrame title="Match: finished">
      <ScreenWash className="px-4 pb-10 pt-3">
        <MatchPageTop state="result" />
      </ScreenWash>
      <MatchSheet tabs={MATCH_TABS}>
        <div className="space-y-4">
          <PlayerAwardRow award={RESULT_AWARD} href="#screens" />
          <InningsSummaryCard
            team={{ name: TEAMS.bay.name, short_name: "BAY" }}
            stats={RESULT_FIRST_INNINGS}
            won={false}
          />
          <InningsSummaryCard
            team={{ name: TEAMS.oldTown.name, short_name: "OTC" }}
            stats={RESULT_SIDE}
            won
          />
        </div>
      </MatchSheet>
      <FrameTabBar current="Matches" />
    </PhoneFrame>
  );
}

/** Live: the score and the crease on the first screen. */
function MatchLiveScreen() {
  return (
    <PhoneFrame title="Match: live, for a scorer">
      <ScreenWash className="px-4 pb-10 pt-3">
        <MatchPageTop state="live" />
      </ScreenWash>
      <MatchSheet tabs={LIVE_MATCH_TABS}>
        <LivePanel />
      </MatchSheet>
      <FrameTabBar current="Matches" />
    </PhoneFrame>
  );
}

/** Before the start: only the tabs that have something in them. */
function MatchUpcomingScreen() {
  return (
    <PhoneFrame title="Match: upcoming">
      <ScreenWash className="px-4 pb-10 pt-3">
        <MatchPageTop state="upcoming" />
      </ScreenWash>
      <MatchSheet tabs={UPCOMING_MATCH_TABS}>
        <Disclosure title="Match details" defaultOpen>
          <Facts
            facts={[
              ["Overs", "8 overs per innings"],
              ["Venue", FIXTURE.venue],
              ["Date", FIXTURE.date],
              ["Time", FIXTURE.time],
            ]}
          />
        </Disclosure>
      </MatchSheet>
      <FrameTabBar current="Matches" />
    </PhoneFrame>
  );
}

/** Scrolled: the header has gone; the score and the tabs stay. */
function MatchScrolledScreen() {
  return (
    <PhoneFrame title="Match: scrolled down a long tab">
      <TopStrip show className="static md:block">
        <ScoreLine
          sides={[
            { code: "BAY", score: "151/8 (20)", dim: true },
            { code: "OTC", score: "152/5 (18.4)" },
          ]}
        />
      </TopStrip>
      <div className="bg-card px-4 pb-4">
        <Tabs defaultValue="scorecard">
          <PinnedTabs label="Match sections" tabs={MATCH_TABS} />
          <TabsContent value="scorecard">
            <BattingCard
              title="Batting"
              rows={BATTING.rows}
              extras={BATTING.extras}
              total={BATTING.total}
              dense
            />
          </TabsContent>
        </Tabs>
      </div>
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
      <FrameTabBar current="More" />
    </PhoneFrame>
  );
}

export function ScreensSection() {
  return (
    <DocSection
      id="screens"
      title="Screens"
      description="The pieces put together at phone width, as a check that they read as one product. Swipe the live card on Home; the tab bar floats at the bottom of each frame. The match page is shown in each of its states."
    >
      <div className="grid gap-8 lg:grid-cols-2 2xl:grid-cols-3">
        <HomeScreen />
        <MatchResultScreen />
        <MatchLiveScreen />
        <MatchUpcomingScreen />
        <MatchScrolledScreen />
        <PlayerScreen />
      </div>
    </DocSection>
  );
}

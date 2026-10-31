"use client";

import { RotateCcw } from "lucide-react";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { BallChip, KeypadButton, OverStrip } from "~/components/ds/ball";
import { Button } from "~/components/ds/button";
import { Card } from "~/components/ds/card";
import { ChartLegend, OverBarsChart, WormChart } from "~/components/ds/charts";
import { MatchCard } from "~/components/ds/match-card";
import { PartnershipList } from "~/components/ds/partnership";
import { PlayerAwardCard } from "~/components/ds/player-award";
import { PlayerHeader } from "~/components/ds/player-header";
import { MatchNote } from "~/components/ds/score";
import {
  BattingCard,
  BowlingCard,
  CreaseTable,
  FallOfWickets,
} from "~/components/ds/scorecard";
import { ScreenWash, Sheet } from "~/components/ds/screen";
import { PointsTable, RankList } from "~/components/ds/standings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ds/tabs";
import { Caption, DocSection, Specimen } from "../_components/doc";
import {
  FixtureHero,
  LiveCarousel,
  MatchPageTop,
  ProfileSheet,
  ResultHero,
  UpcomingGroup,
} from "../_components/examples";
import {
  BATTING,
  BATTING_DETAIL,
  BOWLING,
  CREASE,
  FALL_OF_WICKETS,
  LAST_OVER,
  LIVE,
  PLAYER,
  RESULT,
  SAMPLE_LOGO,
  STANDINGS,
  TEAMS,
  THIS_OVER,
  TOP_RUNS,
} from "../_components/sample";

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

function Identity() {
  return (
    <Specimen
      title="Team crests and avatars"
      usage="Round. An uploaded logo is shown as it is, like Scoreline's crests; without one, the short code (teams) or initials (people) on a tint picked from the name, so it stays the same everywhere."
      bodyClassName="space-y-5"
    >
      <div className="flex flex-wrap items-end gap-4">
        {SIZES.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1.5">
            <TeamCrest {...TEAMS.riverside} size={s} />
            <span className="font-mono text-2xs text-muted-foreground">
              {s}
            </span>
          </div>
        ))}
        <TeamCrest {...TEAMS.hilltop} size="lg" />
        <TeamCrest {...TEAMS.oldTown} size="lg" />
        <TeamCrest name="Central CC" logoUrl={SAMPLE_LOGO} size="lg" />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {SIZES.map((s) => (
          <Avatar key={s} name="Arjun Mehta" size={s} />
        ))}
        <Avatar name="Kabir Shah" size="lg" />
        <Avatar name="Imran Qureshi" size="lg" />
      </div>
      <Caption>
        TeamCrest · Avatar size: xs 24 · sm 32 · md 40 · lg 56 · xl 80
      </Caption>
    </Specimen>
  );
}

function Headers() {
  return (
    <Specimen
      title="Match header"
      usage="Scoreline's match card for cricket: crests either side with one short line under each name; in the middle the status chip over the one figure that matters now (the batting side's score, or the start time). A white card on the wash. Live matches swipe sideways; the dots show how many."
      bodyClassName="grid gap-6 p-0 sm:p-0 xl:grid-cols-2"
    >
      <ScreenWash className="overflow-hidden rounded-xl p-4">
        <LiveCarousel />
      </ScreenWash>
      <ScreenWash className="space-y-4 overflow-hidden rounded-xl p-4">
        <ResultHero />
        <FixtureHero />
      </ScreenWash>
    </Specimen>
  );
}

function MatchPage() {
  return (
    <Specimen
      title="Match page top"
      usage="The match page opens on the wash: back, title, share; the header without its card, with each side's top performers under it (as Scoreline lists scorers). The sheet rises over it with the tabs."
      bodyClassName="p-0 sm:p-0"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-xl">
        <ScreenWash className="px-4 pb-10 pt-4">
          <MatchPageTop />
        </ScreenWash>
        <Sheet className="-mt-6">
          <Tabs defaultValue="live">
            <TabsList aria-label="Match sections">
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
              <TabsTrigger value="balls">Balls</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>
            <TabsContent value="live">
              <OverStrip balls={THIS_OVER} total={5} />
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
      </div>
    </Specimen>
  );
}

function Cards() {
  return (
    <Specimen
      title="Match lists"
      usage="Live and finished matches: two rows in batting order and one line. Upcoming: one card per competition, each fixture Scoreline's crest, time, crest."
      bodyClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <MatchCard
        href="#cricket"
        competition={LIVE.competition}
        status="live"
        first={{ ...LIVE.first, dim: true }}
        second={LIVE.second}
        note={<MatchNote tone="live">{LIVE.note}</MatchNote>}
      />
      <MatchCard
        href="#cricket"
        competition={RESULT.competition}
        status="completed"
        first={{ ...RESULT.first, dim: true }}
        second={RESULT.second}
        note={<MatchNote tone="result">{RESULT.note}</MatchNote>}
      />
      <UpcomingGroup />
    </Specimen>
  );
}

function Deliveries() {
  return (
    <Specimen
      title="Deliveries"
      usage="One chip per ball. Colour only for what matters: four, six, wicket, extras. Each chip reads out its meaning to screen readers."
      bodyClassName="space-y-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BallChip kind="dot" label="0" />
        <BallChip kind="run" label="2" />
        <BallChip kind="four" label="4" />
        <BallChip kind="six" label="6" />
        <BallChip kind="wicket" label="W" />
        <BallChip kind="wicket" label="W+3" />
        <BallChip kind="extra" label="wd+1" />
        <BallChip kind="extra" label="nb+2" />
        <BallChip kind="extra" label="lb1" />
      </div>
      <Caption>BallChip kind: dot · run · four · six · wicket · extra</Caption>
      <OverStrip balls={THIS_OVER} total={5} />
      <OverStrip title="Over 16" balls={LAST_OVER} total={12} />
      <div className="flex items-center gap-1">
        {LAST_OVER.map((b, i) => (
          <BallChip key={i} size="sm" {...b} />
        ))}
      </div>
      <Caption>OverStrip · BallChip size=sm for the ball log</Caption>
    </Specimen>
  );
}

function Crease() {
  return (
    <Specimen
      title="At the crease"
      usage="The two batters in batting order (striker marked *) and the bowler, then this over."
    >
      <Card className="overflow-hidden">
        <CreaseTable
          batters={CREASE.batters}
          strikerName={CREASE.striker}
          bowler={CREASE.bowler}
        />
        <div className="space-y-2 border-t border-border px-4 py-3">
          <OverStrip balls={THIS_OVER} total={5} />
          <p className="font-score text-xs tabular-nums text-muted-foreground">
            CRR {LIVE.rates.current} · RRR {LIVE.rates.required} · Partnership
            54 (38)
          </p>
        </div>
      </Card>
    </Specimen>
  );
}

function Keypad() {
  return (
    <Specimen
      title="Scoring keypad"
      usage="Large keys in a 4-column grid that fills the phone. Fours and sixes in their colours, the wicket key red, extras amber, actions grey."
    >
      <div className="mx-auto grid max-w-sm grid-cols-4 gap-2">
        {["0", "1", "2", "3"].map((r) => (
          <KeypadButton key={r} aria-label={`${r} runs`}>
            {r}
          </KeypadButton>
        ))}
        <KeypadButton tone="four" caption="Four">
          4
        </KeypadButton>
        <KeypadButton tone="six" caption="Six">
          6
        </KeypadButton>
        <KeypadButton tone="run" aria-label="5 runs">
          5
        </KeypadButton>
        <KeypadButton tone="wicket" caption="Wicket">
          W
        </KeypadButton>
        <KeypadButton tone="extra" caption="Wide">
          Wd
        </KeypadButton>
        <KeypadButton tone="extra" caption="No-ball">
          Nb
        </KeypadButton>
        <KeypadButton tone="extra" caption="Bye">
          B
        </KeypadButton>
        <KeypadButton tone="extra" caption="Leg bye">
          Lb
        </KeypadButton>
        <KeypadButton
          tone="action"
          caption="Undo"
          aria-label="Undo last ball"
          className="col-span-4"
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </KeypadButton>
      </div>
    </Specimen>
  );
}

function Scorecards() {
  return (
    <Specimen
      title="Scorecard"
      usage="Names left in Urbanist, figures right in Outfit; runs and wickets semibold, strike rate and economy muted. Not out in green."
      bodyClassName="grid gap-4 xl:grid-cols-2"
    >
      <BattingCard {...BATTING} />
      <div className="space-y-4">
        <BowlingCard {...BOWLING} />
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Fall of wickets
          </h3>
          <FallOfWickets wickets={FALL_OF_WICKETS} />
        </Card>
      </div>
    </Specimen>
  );
}

function DismissalDetail() {
  return (
    <Specimen
      title="Dismissal detail"
      usage="On the match page a batter's name opens their profile (so do bowlers' names, and the top batters and bowlers on the summary), and the dismissal is a button: it opens the ball, who bowled to whom, how the batter went and the score at the fall, under their row. Several can be open; not-out batters stay plain. The printed report keeps the static card."
    >
      <div className="max-w-xl" data-specimen="dismissal-detail">
        <BattingCard {...BATTING_DETAIL} expandable />
      </div>
    </Specimen>
  );
}

function Award() {
  return (
    <Specimen
      title="Player of the match"
      usage="Under the result in the match hero and the report: their picture with the award mark, name and side, and what they did as figure tiles."
    >
      <div className="space-y-3" data-specimen="award">
        <PlayerAwardCard
          award={{
            name: "Arjun Mehta",
            avatarUrl: null,
            team: "Riverside Warriors",
            batting: { runs: 74, balls: 48, fours: 7, sixes: 3, notOut: true },
            bowling: { wickets: 2, runs: 21, overs: "3.0", maidens: 0 },
          }}
        />
        <PlayerAwardCard
          award={{
            name: "Ryan Martinez",
            avatarUrl: null,
            team: "Metro Strikers",
            batting: { runs: 50, balls: 31, fours: 5, sixes: 2, notOut: false },
            bowling: null,
          }}
        />
        <PlayerAwardCard
          award={{
            name: "Siddharth Venkataraman",
            avatarUrl: null,
            team: "Riverside Warriors",
            batting: null,
            bowling: { wickets: 4, runs: 18, overs: "4.0", maidens: 1 },
          }}
        />
      </div>
    </Specimen>
  );
}

function Partnerships() {
  return (
    <Specimen
      title="Partnerships"
      usage="One row per wicket stand on one scale: the bar is split by who scored (first batter dark, second light, extras grey), each batter's runs (balls) under it."
    >
      <PartnershipList
        inningsTotal={168}
        stands={[
          {
            key: "1",
            wicket: 1,
            names: ["Arjun Mehta", "Kabir Shah"],
            runs: 64,
            balls: 41,
            shares: [
              { runs: 38, balls: 22 },
              { runs: 22, balls: 19 },
            ],
            best: true,
          },
          {
            key: "2",
            wicket: 2,
            names: ["Arjun Mehta", "Dev Patel"],
            runs: 31,
            balls: 24,
            shares: [
              { runs: 12, balls: 9 },
              { runs: 17, balls: 15 },
            ],
            live: true,
          },
        ]}
      />
    </Specimen>
  );
}

const WORM = [
  [6, 0],
  [14, 0],
  [21, 1],
  [33, 1],
  [41, 1],
  [49, 2],
  [58, 2],
  [64, 2],
  [72, 3],
  [85, 3],
  [93, 3],
  [101, 4],
  [109, 4],
  [118, 4],
  [126, 5],
  [131, 5],
  [140, 5],
  [151, 6],
  [160, 6],
  [168, 6],
] as const;
const CHASE = [
  [8, 0],
  [15, 0],
  [27, 0],
  [34, 1],
  [40, 1],
  [52, 1],
  [60, 2],
  [69, 2],
  [75, 2],
  [82, 3],
  [91, 3],
  [100, 3],
  [108, 3],
  [117, 4],
  [124, 4],
  [133, 4],
  [142, 4],
] as const;
const sideOf = (rows: readonly (readonly [number, number])[]) =>
  rows.map(([runs, wkts], i) => ({
    over: i + 1,
    total: runs,
    totalWickets: wkts,
    runs: runs - (rows[i - 1]?.[0] ?? 0),
    wickets: wkts - (rows[i - 1]?.[1] ?? 0),
  }));

function Charts() {
  const sides = [
    { key: "riv", label: "RIV", series: 1 as const, overs: sideOf(WORM) },
    { key: "hil", label: "HIL", series: 2 as const, overs: sideOf(CHASE) },
  ];
  return (
    <Specimen
      title="Charts"
      usage="The two sides in the validated pair (series-1 / series-2), 2 px lines, bars 2 px apart with rounded tops, quiet gridlines, a legend with the scores and a hover read-out per over."
      bodyClassName="grid gap-4 xl:grid-cols-2"
    >
      <Card className="space-y-3 p-4">
        <ChartLegend
          items={[
            { label: "RIV", value: "168/6", series: 1, shape: "line" },
            { label: "HIL", value: "142/4", series: 2, shape: "line" },
          ]}
        />
        <WormChart
          label="Run progression: RIV 168/6 vs HIL 142/4"
          maxOvers={20}
          series={sides.map((s) => ({
            ...s,
            points: s.overs.map((o) => ({
              over: o.over,
              runs: o.total,
              wicketsSoFar: o.totalWickets,
              wickets: o.wickets,
            })),
          }))}
        />
      </Card>
      <Card className="space-y-3 p-4">
        <ChartLegend
          items={[
            { label: "RIV", series: 1 },
            { label: "HIL", series: 2 },
            { label: "Wicket", swatch: "bg-wicket", shape: "dot" },
          ]}
        />
        <OverBarsChart
          label="Runs per over: RIV vs HIL"
          maxOvers={20}
          series={sides}
        />
      </Card>
    </Specimen>
  );
}

function Standings() {
  return (
    <Specimen
      title="Points table and leaderboard"
      usage="Qualifying places get a navy rank and a line under the last of them. Leaderboards rank by one figure; no medals."
      bodyClassName="grid gap-4 xl:grid-cols-2"
    >
      <PointsTable title="Summer League 2026" rows={STANDINGS} qualify={4} />
      <RankList title="Most runs" unit="Runs" rows={TOP_RUNS} />
    </Specimen>
  );
}

function Profile() {
  return (
    <Specimen
      title="Player profile"
      usage="Scoreline's player page: given name light, family name large, on the wash; the sheet holds the tabs, the career tiles (an icon per label) and the batting profile as bars."
      bodyClassName="p-0 sm:p-0"
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-xl">
        <ScreenWash className="px-5 pb-12 pt-6">
          <PlayerHeader
            name={PLAYER.name}
            role={PLAYER.role}
            detail={PLAYER.detail}
            team={PLAYER.team}
            actions={
              <Button variant="surface" size="sm">
                Follow
              </Button>
            }
          />
        </ScreenWash>
        <Sheet className="-mt-6">
          <ProfileSheet />
        </Sheet>
      </div>
    </Specimen>
  );
}

export function CricketSection() {
  return (
    <DocSection
      id="cricket"
      title="Cricket"
      description="The components only a cricket app needs, built from the same tokens."
    >
      <Identity />
      <Headers />
      <MatchPage />
      <Cards />
      <div className="grid gap-6 xl:grid-cols-2">
        <Deliveries />
        <Crease />
      </div>
      <Keypad />
      <Scorecards />
      <DismissalDetail />
      <Award />
      <Partnerships />
      <Charts />
      <Standings />
      <Profile />
    </DocSection>
  );
}

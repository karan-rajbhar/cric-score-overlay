"use client";

import { Button } from "~/components/ds/button";
import { Carousel } from "~/components/ds/carousel";
import { CompetitionGroup, FixtureCard } from "~/components/ds/match-card";
import {
  HeroScore,
  HeroTime,
  InningsScore,
  MatchNote,
  ScoreHero,
} from "~/components/ds/score";
import { ScreenBar } from "~/components/ds/screen";
import { ShareMenu, type ShareMenuItem } from "~/components/ds/share-menu";
import { MeterList } from "~/components/ds/meter";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ds/tabs";
import {
  Bell,
  CalendarDays,
  FileText,
  Gauge,
  ImageIcon,
  Info,
  Link2,
  MoreHorizontal,
  Play,
  Share2,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  FIXTURE,
  LIVE,
  LIVE_2,
  PERFORMERS,
  PLAYER,
  PLAYER_METERS,
  RESULT,
  TEAMS,
} from "./sample";

/*
 * The sample screens' building blocks, composed once and used by both the
 * Cricket specimens and the Screens section.
 */

const scoreLine = (i: { runs: number; wickets: number; overs: string }) =>
  `${i.runs}/${i.wickets} (${i.overs})`;

/** Hilltop Hawks chasing 169: the live card for the home screen. */
export function LiveHero({ action = true }: { action?: boolean }) {
  return (
    <ScoreHero
      competition={LIVE.competition.split(" · ")[0]}
      stage="Match 12"
      status="live"
      home={{
        team: LIVE.first.team,
        detail: scoreLine(LIVE.first.innings),
        dim: true,
      }}
      away={{ team: LIVE.second.team, detail: "Batting" }}
      centre={<HeroScore innings={LIVE.second.innings} />}
      note={<MatchNote tone="live">{LIVE.note}</MatchNote>}
    >
      {action && <Button className="w-full">Follow live</Button>}
    </ScoreHero>
  );
}

/** A second live match, first innings, for the carousel. */
export function LiveHeroSecond() {
  return (
    <ScoreHero
      competition={LIVE_2.competition}
      stage={LIVE_2.stage}
      status="live"
      home={{ team: LIVE_2.batting.team, detail: "Batting" }}
      away={{ team: LIVE_2.bowling.team, detail: "Yet to bat", dim: true }}
      centre={<HeroScore innings={LIVE_2.batting.innings} />}
      note={<MatchNote>{LIVE_2.note}</MatchNote>}
    >
      <Button className="w-full">Follow live</Button>
    </ScoreHero>
  );
}

/** Every live match, swipeable. */
export function LiveCarousel() {
  return (
    <Carousel label="Live matches">
      <LiveHero />
      <LiveHeroSecond />
    </Carousel>
  );
}

export function ResultHero() {
  return (
    <ScoreHero
      competition={RESULT.competition.split(" · ")[0]}
      stage="Match 11"
      status="completed"
      home={{
        team: RESULT.first.team,
        detail: <InningsScore innings={RESULT.first.innings} dim />,
        dim: true,
      }}
      away={{
        team: RESULT.second.team,
        detail: <InningsScore innings={RESULT.second.innings} />,
      }}
      note={<MatchNote tone="result">{RESULT.note}</MatchNote>}
    />
  );
}

export function FixtureHero() {
  return (
    <ScoreHero
      competition={FIXTURE.competition}
      stage={FIXTURE.stage}
      status="scheduled"
      home={{ team: FIXTURE.home }}
      away={{ team: FIXTURE.away }}
      centre={<HeroTime time={FIXTURE.time} />}
      note={
        <MatchNote>
          {FIXTURE.date} · {FIXTURE.venue}
        </MatchNote>
      }
    />
  );
}

/** A finished match has more than a link to send. */
export const MATCH_SHARE_ITEMS: readonly ShareMenuItem[] = [
  { label: "Share link", icon: Link2 },
  { label: "Share image", icon: ImageIcon },
  { label: "Match report", icon: FileText },
];

/** The bar: back, the match's own title, Share and the ⋯ menu. */
function MatchBar({ title, finished }: { title: string; finished?: boolean }) {
  return (
    <ScreenBar
      title={title}
      backHref="#cricket"
      action={
        <>
          {finished ? (
            <ShareMenu items={MATCH_SHARE_ITEMS} />
          ) : (
            <Button variant="surface" size="icon" aria-label="Share link">
              <Share2 />
            </Button>
          )}
          <Button
            variant="surface"
            size="icon"
            aria-label="More match actions"
          >
            <MoreHorizontal />
          </Button>
        </>
      }
    />
  );
}

/**
 * The top of the match page in each state: the header without its card, and
 * one action at most (Continue scoring, or Follow). Everything else lives
 * in Share, the ⋯ menu or a tab, so the tabs start high on the screen.
 */
export function MatchPageTop({
  state = "live",
}: {
  state?: "live" | "result" | "upcoming";
}) {
  if (state === "result") {
    return (
      <>
        <MatchBar
          title={`${RESULT.first.team.name} vs ${RESULT.second.team.name}`}
          finished
        />
        <ScoreHero
          plain
          compact
          className="mt-3"
          competition={RESULT.competition.split(" · ")[0]}
          stage="T20 · 20 overs"
          home={{
            team: RESULT.first.team,
            detail: <InningsScore innings={RESULT.first.innings} dim inline />,
            extra: PERFORMERS.first.map((p) => <p key={p}>{p}</p>),
            dim: true,
          }}
          away={{
            team: RESULT.second.team,
            detail: <InningsScore innings={RESULT.second.innings} inline />,
            extra: PERFORMERS.second.map((p) => <p key={p}>{p}</p>),
          }}
          note={<MatchNote tone="result">{RESULT.note}</MatchNote>}
        />
      </>
    );
  }
  if (state === "upcoming") {
    return (
      <>
        <MatchBar title={`${FIXTURE.home.name} vs ${FIXTURE.away.name}`} />
        <ScoreHero
          plain
          compact
          className="mt-3"
          competition={FIXTURE.competition}
          stage="8 overs"
          home={{ team: FIXTURE.home }}
          away={{ team: FIXTURE.away }}
          centre={<HeroTime time={FIXTURE.time} label={FIXTURE.stage} />}
          note={
            <MatchNote>
              {FIXTURE.date} · {FIXTURE.venue}
            </MatchNote>
          }
        >
          <div className="flex justify-center">
            <Button variant="outline" size="sm">
              <Bell />
              Follow
            </Button>
          </div>
        </ScoreHero>
      </>
    );
  }
  return (
    <>
      <MatchBar
        title={`${LIVE.first.team.name} vs ${LIVE.second.team.name}`}
      />
      <ScoreHero
        plain
        compact
        className="mt-3"
        competition={LIVE.competition.split(" · ")[0]}
        stage="T20 · 20 overs"
        status="live"
        home={{
          team: LIVE.first.team,
          detail: scoreLine(LIVE.first.innings),
          extra: PERFORMERS.first.map((p) => <p key={p}>{p}</p>),
          dim: true,
        }}
        away={{
          team: LIVE.second.team,
          detail: "Batting",
          extra: PERFORMERS.second.map((p) => <p key={p}>{p}</p>),
        }}
        centre={<HeroScore innings={LIVE.second.innings} />}
        note={<MatchNote tone="live">{LIVE.note}</MatchNote>}
      >
        <div className="flex justify-center">
          <Button size="sm">
            <Play />
            Continue scoring
          </Button>
        </div>
      </ScoreHero>
    </>
  );
}

/** The upcoming list: fixtures grouped under their competition. */
export function UpcomingGroup() {
  return (
    <CompetitionGroup name={FIXTURE.competition} aside="Round 4">
      <FixtureCard bare {...FIXTURE} />
      <FixtureCard
        bare
        date="Sunday 26 October"
        time="2:00 pm"
        home={TEAMS.oldTown}
        away={TEAMS.riverside}
        venue="Riverside Oval"
      />
    </CompetitionGroup>
  );
}

const STAT_ICONS: Record<string, LucideIcon> = {
  Matches: CalendarDays,
  Runs: TrendingUp,
  Average: Target,
  "Strike rate": Gauge,
};

/** Scoreline's "Appearances" block: four tiles with an icon per label. */
export function PlayerTiles({ count = 4 }: { count?: number }) {
  return (
    <StatGrid className="sm:grid-cols-2">
      {PLAYER.stats.slice(0, count).map((s) => (
        <StatTile
          key={s.label}
          label={s.label}
          value={s.value}
          icon={STAT_ICONS[s.label] ?? Info}
        />
      ))}
    </StatGrid>
  );
}

/** The profile sheet: tabs, career tiles, batting profile bars. */
export function ProfileSheet() {
  return (
    <Tabs defaultValue="stats">
      <TabsList aria-label="Profile sections">
        <TabsTrigger value="bio">Biodata</TabsTrigger>
        <TabsTrigger value="stats">Statistics</TabsTrigger>
        <TabsTrigger value="matches">Matches</TabsTrigger>
      </TabsList>
      <TabsContent value="stats" className="space-y-6">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Career</h2>
          <PlayerTiles />
        </section>
        <section>
          <h2 className="text-xl font-semibold">Batting profile</h2>
          <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
            Bar: rank among Summer League batters (full = best)
          </p>
          <MeterList items={PLAYER_METERS} />
        </section>
      </TabsContent>
      {["bio", "matches"].map((v) => (
        <TabsContent
          key={v}
          value={v}
          className="text-sm text-muted-foreground"
        >
          The {v} panel.
        </TabsContent>
      ))}
    </Tabs>
  );
}

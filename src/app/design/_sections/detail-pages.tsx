"use client";

import { Plus, Users, Trophy, Shield, Award } from "lucide-react";
import { ActionsSheet } from "~/components/ds/actions-sheet";
import { Button } from "~/components/ds/button";
import { Chip } from "~/components/ds/chip";
import { ProfileHeader } from "~/components/ds/player-header";
import { ScreenBar, ScreenWash, Sheet } from "~/components/ds/screen";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { PinnedTabs, Tabs, TabsContent } from "~/components/ds/tabs";
import { TeamCrest } from "~/components/ds/avatar";
import { DocSection, PhoneFrame, Specimen } from "../_components/doc";
import { TEAMS } from "../_components/sample";

const CLUB_TABS = [
  { value: "teams", label: "Teams" },
  { value: "matches", label: "Matches" },
  { value: "stats", label: "Stats" },
  { value: "members", label: "Members" },
];

/** A club on a phone: one action in the bar, the rest behind ⋯. */
function ClubScreen() {
  return (
    <PhoneFrame title="Club">
      <ScreenWash className="px-4 pb-8 pt-3">
        <ScreenBar
          className="mb-4"
          backHref="#detail-pages"
          action={
            <>
              <Button variant="outline" size="sm">
                Join club
              </Button>
              <ActionsSheet title="Riverside CC" label="Club actions">
                <Button variant="outline" size="sm">
                  Add to calendar
                </Button>
                <Button variant="outline" size="sm">
                  Club settings
                </Button>
              </ActionsSheet>
            </>
          }
        />
        <ProfileHeader
          name="Riverside CC"
          crest={<TeamCrest {...TEAMS.riverside} size="xl" />}
          labels={
            <>
              <Chip tone="outline">Community club</Chip>
              <Chip tone="primary">2026 season · Active</Chip>
              <Chip tone="outline">2025 season</Chip>
            </>
          }
          description="A community club on the river, playing weekend T20 cricket since 1986, with teams for every age and a long waiting list for the seconds."
        />
      </ScreenWash>
      <Sheet className="-mt-6 px-4 sm:px-4">
        <StatGrid compact>
          <StatTile compact icon={Shield} label="Teams" value={4} />
          <StatTile compact icon={Trophy} label="Tournaments" value={2} />
          <StatTile compact icon={Award} label="Hall of fame" value={3} />
          <StatTile compact icon={Users} label="Members" value={86} />
        </StatGrid>
        <Tabs defaultValue="teams" className="mt-3">
          <PinnedTabs label="Club sections" tabs={CLUB_TABS} />
          {CLUB_TABS.map((t) => (
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
    </PhoneFrame>
  );
}

export function DetailPagesSection() {
  return (
    <DocSection
      id="detail-pages"
      title="Detail pages"
      description="Clubs, teams, tournaments and players follow the match page: what it is, one action, then the tabs on the first screen, which stay in reach. The name comes back in a strip above the tabs once the header has scrolled away (PinnedTitle)."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <ClubScreen />
        <div className="space-y-6">
          <Specimen
            title="Actions sheet"
            usage="The ⋯ button of a phone's top bar: everything but the one main action, as the same buttons tablets show in a row. Each opens its own dialog on top."
          >
            <div className="flex justify-center py-1">
              <ActionsSheet title="Riverside CC" label="Club actions">
                <Button size="sm">
                  <Plus />
                  New team
                </Button>
                <Button variant="outline" size="sm">
                  Add to calendar
                </Button>
                <Button variant="outline" size="sm">
                  Club settings
                </Button>
              </ActionsSheet>
            </div>
          </Specimen>
          <Specimen
            title="Figures above tabs"
            usage="StatGrid compact: one row on phones, the figure over its label, so the tabs stay on the first screen. Tiles from tablets up."
          >
            <StatGrid compact>
              <StatTile compact icon={Shield} label="Played" value={18} />
              <StatTile compact icon={Trophy} label="Won" value={11} />
              <StatTile compact label="Lost" value={7} />
              <StatTile compact label="Win rate" value="61%" />
            </StatGrid>
          </Specimen>
        </div>
      </div>
    </DocSection>
  );
}

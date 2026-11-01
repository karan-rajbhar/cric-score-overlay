"use client";

import {
  AlertTriangle,
  CalendarDays,
  Download,
  Home,
  Info,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Share2,
  Shield,
  Trash2,
  Trophy,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";
import { PageHeader } from "~/components/layout/page";
import {
  GreetingBar,
  NotificationsButton,
  TabBar,
} from "~/components/ds/app-bar";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { Button } from "~/components/ds/button";
import { Card, CardHeader } from "~/components/ds/card";
import { EmptyState } from "~/components/ds/empty-state";
import {
  ListCard,
  ListRow,
  MetaItem,
  NavItem,
  SectionHeader,
} from "~/components/ds/list";
import { Disclosure } from "~/components/ds/disclosure";
import { ScreenBar, ScreenWash, Sheet } from "~/components/ds/screen";
import { Caption, DocSection, Specimen } from "../_components/doc";
import { TAB_BAR_ITEMS, TEAMS } from "../_components/sample";

function ScreenTop() {
  return (
    <Specimen
      title="Top of a screen"
      usage="The wash behind the top of the screen, fading into the page. Home opens with a greeting and round actions; other screens with a back button, the title and one action. The sheet rises over the wash to hold tabs and content."
      bodyClassName="grid gap-6 lg:grid-cols-2"
    >
      <ScreenWash className="overflow-hidden rounded-xl px-4 pb-8 pt-4">
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
      </ScreenWash>
      <div className="overflow-hidden rounded-xl">
        <ScreenWash className="px-4 pb-10 pt-4">
          <ScreenBar
            title="Match centre"
            backHref="#content"
            action={
              <Button variant="surface" size="icon" aria-label="Match info">
                <Info />
              </Button>
            }
          />
        </ScreenWash>
        <Sheet className="-mt-6 text-sm text-muted-foreground">
          The sheet: tabs and content go here.
        </Sheet>
      </div>
    </Specimen>
  );
}

function Navigation() {
  return (
    <Specimen
      title="Navigation"
      usage="Phones: a floating tab bar at the bottom, where the thumb is. Every tab is a place with a URL, the current one is a navy circle, and every tab keeps its label. Tablets and desktop: the sidebar, where the current page is lavender. See Principles."
      bodyClassName="grid gap-8 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-start"
    >
      <TabBar items={TAB_BAR_ITEMS} />
      <nav aria-label="Example sidebar" className="flex gap-6">
        <div className="w-56 space-y-1">
          <NavItem href="#content" icon={Home} label="Home" />
          <NavItem href="#content" icon={Radio} label="Matches" active />
          <NavItem href="#content" icon={Trophy} label="Tournaments" />
          <NavItem href="#content" icon={Shield} label="Clubs" />
          <NavItem href="#content" icon={Users} label="Teams" />
        </div>
        <div className="space-y-1">
          <NavItem href="#content" icon={Home} label="Dashboard" collapsed />
          <NavItem
            href="#content"
            icon={Radio}
            label="Matches"
            active
            collapsed
          />
          <NavItem
            href="#content"
            icon={Trophy}
            label="Tournaments"
            collapsed
          />
        </div>
      </nav>
    </Specimen>
  );
}

function PageHeaderSpecimen() {
  return (
    <Specimen
      title="Page header"
      usage="Desktop pages open with the title, one line of description and at most two actions (phones: actions share the full width). Existing PageHeader, new tokens."
    >
      <PageHeader
        title="Summer League 2026"
        description="T20 · 6 teams · Central Park Ground"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Share2 aria-hidden="true" />
              Share
            </Button>
            <Button size="sm">
              <Plus aria-hidden="true" />
              Add match
            </Button>
          </>
        }
      />
    </Specimen>
  );
}

function CardSpecimens() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Specimen
        title="Card"
        usage="White, 18 px radius, a soft shadow and no visible border (a hairline in dark mode). Title semibold, description muted."
      >
        <Card>
          <CardHeader
            title="Match info"
            description="Toss, venue and officials"
            action={
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
            }
          />
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
            <MetaItem icon={MapPin}>Central Park Ground</MetaItem>
            <MetaItem icon={CalendarDays}>Sat 25 Oct, 9:30 am</MetaItem>
          </div>
        </Card>
      </Specimen>
      <Specimen
        title="Section header"
        usage="A section title with a quiet link to the full list, as in Scoreline's See More."
        bodyClassName="space-y-5"
      >
        <SectionHeader title="Upcoming matches" href="#cricket" />
        <SectionHeader
          title="Top run scorers"
          description="Summer League 2026"
          href="#cricket"
          actionLabel="Leaderboard"
        />
      </Specimen>
    </div>
  );
}

function DisclosureSpecimen() {
  return (
    <Specimen
      title="Disclosure"
      usage="Secondary content that folds on phones and stays open from md up. What people came for stays open; aside and below say what is inside."
    >
      <Disclosure
        title="Partnerships"
        aside={
          <span className="font-score text-sm tabular-nums text-muted-foreground">
            Best 46
          </span>
        }
      >
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Each stand, its runs and who scored them.
        </p>
      </Disclosure>
    </Specimen>
  );
}

function ListSpecimen() {
  return (
    <Specimen
      title="List rows"
      usage="One card with hairline rows: crest or avatar, title, subtitle, a trailing figure or chevron. A selected row is lavender. Rows are at least 56 px tall."
    >
      <ListCard className="max-w-xl">
        <ListRow
          href="#cricket"
          leading={<TeamCrest {...TEAMS.riverside} size="md" />}
          title={TEAMS.riverside.name}
          subtitle="16 players · Captain Aditya Joshi"
        />
        <ListRow
          leading={<Avatar name="Arjun Mehta" />}
          title="Arjun Mehta (c)"
          subtitle="Batter · Hilltop Hawks"
          trailing={
            <span className="font-score text-sm font-semibold tabular-nums">
              287
            </span>
          }
        />
        <ListRow
          selected
          leading={<Avatar name="Pranav Sethi" />}
          title="Pranav Sethi (wk)"
          subtitle="Wicketkeeper"
        />
      </ListCard>
    </Specimen>
  );
}

export function ContentSection() {
  return (
    <DocSection
      id="content"
      title="Layout and content"
      description="How screens, cards and lists are put together."
    >
      <ScreenTop />
      <Navigation />
      <PageHeaderSpecimen />
      <CardSpecimens />
      <DisclosureSpecimen />
      <ListSpecimen />
    </DocSection>
  );
}

function MatchCardSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl bg-card p-4 shadow-soft"
      aria-hidden="true"
    >
      <div className="flex justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

function Callouts() {
  return (
    <Specimen
      title="Callouts"
      usage="Inline, above the content they are about. Existing Alert, new tokens."
      bodyClassName="space-y-3"
    >
      <Alert className="rounded-xl">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>You are offline</AlertTitle>
        <AlertDescription>
          3 balls are saved on this phone and will be sent when you are back
          online.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive" className="rounded-xl">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Ball not saved</AlertTitle>
        <AlertDescription>
          The server refused it. Check the over and try again.
        </AlertDescription>
      </Alert>
    </Specimen>
  );
}

function EmptyAndLoading() {
  return (
    <>
      <Specimen
        title="Empty state"
        usage="Say what would be here and offer the one action that fills it."
      >
        <EmptyState
          icon={Radio}
          title="No matches yet"
          description="Matches you create or score will show up here."
          action={
            <Button size="sm">
              <Plus aria-hidden="true" />
              Create a match
            </Button>
          }
        />
      </Specimen>
      <Specimen
        title="Loading"
        usage="Skeletons shaped like the content for first loads; a spinner with words for actions. Spinners keep turning under reduced motion."
        bodyClassName="space-y-4"
      >
        <MatchCardSkeleton />
        <p
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading scorecard
        </p>
      </Specimen>
    </>
  );
}

function Overlays() {
  return (
    <Specimen
      title="Toast, dialog and menu"
      usage="Toasts only for results of background work (a failed sync, an export). Dialogs ask for decisions, with the safe choice first. Menus hold rare actions; destructive last, in red."
      bodyClassName="flex flex-wrap items-center gap-3"
    >
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Couldn't send 2 balls", {
            description: "They are kept on this phone and retried.",
          })
        }
      >
        Show a toast
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open a dialog</Button>
        </DialogTrigger>
        <DialogContent className="rounded-panel shadow-float sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End the innings?</DialogTitle>
            <DialogDescription>
              Hilltop Hawks will start their chase of 169. You can undo this
              from the next ball.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="outline">Keep scoring</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button>End innings</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="surface" size="icon" aria-label="Match actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-xl border-0 shadow-float"
        >
          <DropdownMenuItem>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete match
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Caption>Existing Dialog and DropdownMenu, with ds buttons</Caption>
    </Specimen>
  );
}

export function FeedbackSection() {
  return (
    <DocSection
      id="feedback"
      title="Feedback"
      description="Telling people what happened, what is loading and what needs a decision. Routine actions confirm inline, not with a toast."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Callouts />
        <EmptyAndLoading />
        <Overlays />
      </div>
    </DocSection>
  );
}

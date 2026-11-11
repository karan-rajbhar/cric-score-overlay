import { cardDate } from "~/lib/dates";
import { globalSearch } from "./actions";
import { Input } from "~/components/ui/input";
import { StatusBadge } from "~/components/ui/status-badge";
import { MatchStatusChip } from "~/components/ds/chip";
import { ScreenBar } from "~/components/ds/screen";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { ListCard, ListRow } from "~/components/ds/list";
import { PageContainer, PageHeader, SectionHeader } from "~/components/layout/page";
import { Search } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const metadata = { title: "Search" };

export const dynamic = "force-dynamic";

const WHAT = "Teams, matches, players, clubs and tournaments";

function Section<T>({
  title,
  items,
  render,
  moreHref,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  /** There are more than these: the list that holds them all (N13). */
  moreHref?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeader
        title={title}
        count={moreHref ? undefined : items.length}
        href={moreHref ?? undefined}
        actionLabel="Show all"
      />
      {/* The shared rows (N14): crest or avatar, name, line, chevron. */}
      <ListCard>{items.map(render)}</ListCard>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const result = q.trim().length >= 2 ? await globalSearch(q) : null;
  const term = encodeURIComponent(q.trim());

  const hasResults =
    result &&
    (result.matches.length > 0 ||
      result.teams.length > 0 ||
      result.players.length > 0 ||
      result.clubs.length > 0 ||
      result.tournaments.length > 0);

  return (
    <PageContainer size="narrow">
      <ScreenBar title="Search" backHref="/" className="md:hidden" />
      <PageHeader
        className="max-md:hidden"
        title="Search"
        description={WHAT}
      />

      <form action="/search" method="GET" role="search" className="space-y-2">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            id="search-query"
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            defaultValue={q}
            aria-label="Search"
            placeholder="Search"
            // The browser's own clear cross is not the app's (N14).
            className="h-11 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
            // Only on an empty page: after a search, or coming Back to one,
            // the keyboard would cover the results.
            autoFocus={!q}
          />
        </div>
        {/* Phones have no page header: say what can be found. */}
        {!q && (
          <p className="text-sm text-muted-foreground md:hidden">{WHAT}</p>
        )}
      </form>

      {q && !result && (
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters
        </p>
      )}

      {result && !hasResults && (
        <EmptyState
          icon={Search}
          title={`No results for "${q}"`}
          description="Nothing matched. Check the spelling or try a shorter term."
          primaryAction={{
            label: "Browse matches",
            href: "/matches",
          }}
          secondaryAction={{
            label: "Browse tournaments",
            href: "/tournaments",
          }}
        />
      )}

      {result && hasResults && (
        <div className="space-y-6">
          <Section
            title="Matches"
            moreHref={result.more?.matches ? `/matches?search=${term}` : null}
            items={result.matches}
            render={(x) => (
              <ListRow
                key={x.id}
                href={`/matches/${x.id}`}
                title={x.title}
                // When and where, so two of one name differ (N13).
                subtitle={
                  [cardDate(x.scheduled_at), x.venue]
                    .filter(Boolean)
                    .join(" · ") || "Date to be confirmed"
                }
                trailing={<MatchStatusChip status={x.status} />}
              />
            )}
          />

          <Section
            title="Teams"
            moreHref={result.more?.teams ? `/teams?view=all&search=${term}` : null}
            items={result.teams}
            render={(x) => (
              <ListRow
                key={x.id}
                href={`/teams/${x.id}`}
                leading={
                  <TeamCrest
                    name={x.name}
                    shortName={x.short_name}
                    logoUrl={x.logo_url}
                    size="sm"
                  />
                }
                title={x.name}
              />
            )}
          />

          <Section
            title="Players"
            moreHref={result.more?.players ? `/players?q=${term}` : null}
            items={result.players}
            render={(x) => (
              <ListRow
                key={x.id}
                href={`/players/${x.username ? `@${x.username}` : x.id}`}
                leading={<Avatar name={x.full_name} src={x.avatar_url} size="sm" />}
                title={x.full_name}
                subtitle={x.username ? `@${x.username}` : undefined}
              />
            )}
          />

          <Section
            title="Clubs"
            moreHref={result.more?.clubs ? `/clubs?view=all&search=${term}` : null}
            items={result.clubs}
            render={(x) => (
              <ListRow
                key={x.id}
                href={`/clubs/${x.id}`}
                leading={
                  <TeamCrest
                    name={x.name}
                    shortName={x.short_name}
                    logoUrl={x.logo_url}
                    size="sm"
                  />
                }
                title={x.name}
                subtitle={x.location ?? undefined}
              />
            )}
          />

          <Section
            title="Tournaments"
            moreHref={result.more?.tournaments ? `/tournaments?search=${term}` : null}
            items={result.tournaments}
            render={(x) => (
              <ListRow
                key={x.id}
                href={`/tournaments/${x.id}`}
                title={x.name}
                trailing={<StatusBadge status={x.status} />}
              />
            )}
          />
        </div>
      )}
    </PageContainer>
  );
}

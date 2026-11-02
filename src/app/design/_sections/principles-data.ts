/**
 * What research and this app's own mistakes taught about navigation and
 * forms. Plain data, so `/design` shows it and anyone improving a page can
 * read it here. Add to it when a study, a guideline or a real bug changes
 * how screens are built, and say how strong the evidence is.
 */

export type Evidence = "study" | "guideline" | "pattern" | "learned";

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  study: "User study",
  guideline: "Platform guideline",
  pattern: "Seen in sports apps",
  learned: "Learned in CricScore",
};

export interface Principle {
  title: string;
  rule: string;
  /** Why, in a sentence: the finding or the bug behind it. */
  why: string;
  evidence: Evidence;
  /** The code that carries it out, where one piece does. */
  appliedIn?: string;
}

export interface PrincipleGroup {
  title: string;
  principles: readonly Principle[];
}

export const PRINCIPLE_GROUPS: readonly PrincipleGroup[] = [
  {
    title: "Finding your way",
    principles: [
      {
        title: "Keep the main places in sight",
        rule: "Four or five main places stay visible in the tab bar. Hide only what is used rarely.",
        why: "NN/g measured a drop of more than 20% in discoverability with hidden navigation, and mobile tasks took 15% longer than with partly visible navigation.",
        evidence: "study",
        appliedIn: "MobileTabBar",
      },
      {
        title: "Link to what is hidden from inside pages",
        rule: "Anything not in a tab is linked from the pages where people need it.",
        why: "NN/g's advice when not everything fits: in-page links offset the cost of hiding it. Teams and Players have no tab, so More lists them, and a club's page has its own teams and members.",
        evidence: "study",
        appliedIn: "PlacesSection",
      },
      {
        title: "A tab goes somewhere",
        rule: "Tabs are places with a URL, never actions. More is a page, so Back, reload and sharing work.",
        why: "Apple: use a tab bar to support navigation, not to provide actions. NHL and ESPN both make More a real screen.",
        evidence: "guideline",
      },
      {
        title: "One tab is always lit",
        rule: "Every page belongs to one section. Add a new section to navSectionOf.",
        why: "Clubs, Teams and Players once lit nothing, so people could not tell where they were.",
        evidence: "learned",
        appliedIn: "navSectionOf",
      },
      {
        title: "A tab holds what its name says",
        rule: "Everything under a tab belongs to that name. A list that needs a home goes on More, not behind the nearest tab.",
        why: "The Clubs tab once held a Clubs / Teams / Players switch, but those lists showed every team and player. A club's page has Teams too, so one word meant two things under one tab.",
        evidence: "learned",
        appliedIn: "navSectionOf",
      },
      {
        title: "One place, one name",
        rule: "A destination has one name everywhere, and each screen offers one way to reach it.",
        why: "Home was also called Dashboard, the logo opened a third page, and desktop had four ways to Search. A finished match had three ways to share.",
        evidence: "learned",
      },
      {
        title: "A screen's content starts on its first screen",
        rule: "Keep a detail screen's header short: what it is, the one figure that matters, one action at most. The rest goes in a tab, Share or the ⋯ menu; figures sit in one row, chips on one line, a description in two.",
        why: "A finished match's tabs started 610px down an 844px phone, under the player of the match and three buttons. FotMob, ESPN and Real Sports start theirs about a third of the way down, and FotMob keeps its player of the match inside the first tab.",
        evidence: "pattern",
        appliedIn: "MatchHero, PlayerAwardRow, ShareMenu, ActionsSheet, StatGrid compact",
      },
      {
        title: "Long screens keep their tabs in reach",
        rule: "Tabs stay on screen as a long tab scrolls, with one thin line saying what the screen is about. Keep what is pinned short, so it does not hide the content.",
        why: "NN/g: sticky headers make their contents easier to find and more likely to be used. Changing tab from the bottom of a 2,700px Stats tab meant scrolling all the way back.",
        evidence: "study",
        appliedIn: "PinnedTabs, TopStrip, PinnedTitle",
      },
      {
        title: "Offer only the tabs that have something in them",
        rule: "A tab appears once it has content. Before a match starts, that is Summary and Squads. Whoever can fill a tab, such as a club's admins, still sees it.",
        why: "Four of a fixture's six tabs only said that nothing had happened yet.",
        evidence: "learned",
        appliedIn: "matchTabsOf, PlayerActivityTabs",
      },
      {
        title: "An action goes when its moment has passed",
        rule: "Hide what no longer applies to the person looking, and check first whether anyone still needs it.",
        why: "A finished match offered everyone a Scorers button and Stream this match, and a finished tournament Schedule match. Scorers went, but Stream stays for scorers and streamers: a stream outlasts the last ball, and it is the one way back to the control room.",
        evidence: "learned",
        appliedIn: "MatchMoreMenu",
      },
    ],
  },
  {
    title: "Back and URLs",
    principles: [
      {
        title: "Back returns where you came from",
        rule: "Follow the real history inside the app. On a link opened fresh, go to the page's natural parent.",
        why: "Back built from URL parameters went to the wrong page whenever a link missed one.",
        evidence: "learned",
        appliedIn: "BackLink, matchTrail",
      },
      {
        title: "Back never leaves the app or goes in circles",
        rule: "Use history only when the previous page is known to be ours, skip a page that leads straight back, and treat a replace as taking the old page's place.",
        why: "A plain history check can drop people out of the app, scoring and the match page can send each other back forever, and a redirect leaves one history entry where the trail counted two.",
        evidence: "learned",
        appliedIn: "in-app-history",
      },
      {
        title: "Back never reopens a used form",
        rule: "Skip a create form or sign-in on the way back, and go to the page's parent instead.",
        why: "Following history alone would take someone who just created a club back to the filled-in form.",
        evidence: "learned",
        appliedIn: "backTarget",
      },
      {
        title: "A URL names the thing, not the journey",
        rule: "Query parameters hold a view or a filter (?tab=, ?view=, a team's ?tournamentId=) or prefill a form (?clubId= on create), never how someone got there.",
        why: "One match had many URLs, and a shared link carried the sender's path.",
        evidence: "learned",
      },
      {
        title: "What is on screen survives a reload",
        rule: "Tabs live in ?tab=, set with replaceState so changing tab adds no history entry and no server read.",
        why: "The match tab lived in memory, so a reload or a trip to a player page lost it.",
        evidence: "learned",
        appliedIn: "UrlTabs",
      },
    ],
  },
  {
    title: "Searching and adding",
    principles: [
      {
        title: "Still looking is not nothing found",
        rule: "Show searching, found nobody and could not search as three different states, and keep the text with a way to retry.",
        why: "A failed search read as no such player, so scorers added a duplicate.",
        evidence: "pattern",
        appliedIn: "usePlayerSearch, PlayerSearchNote",
      },
      {
        title: "Creating is a separate choice from picking",
        rule: "List what exists first. Creating waits for the search, says it creates, and Enter never guesses.",
        why: "Enter added a new player before the search had answered.",
        evidence: "pattern",
      },
      {
        title: "Nobody disappears without a reason",
        rule: "When someone found cannot be used, show them with why. Filter a result out only if it is listed elsewhere on screen.",
        why: "Players in the other squad were silently left out, which is how the first duplicates were made.",
        evidence: "learned",
        appliedIn: "whyNotAddable",
      },
      {
        title: "Tell two of one name apart",
        rule: "Show what separates them (team, username, matches played), and never let a hint squeeze the name.",
        why: "Rows of identical names cannot be told apart, and a truncated name defeats the row.",
        evidence: "pattern",
      },
      {
        title: "Read every field the search knows",
        rule: "A list on screen matches the same fields, word by word, as the server does.",
        why: "Rows matched names only, so a search by @username hid a squad player.",
        evidence: "learned",
        appliedIn: "playerMatches",
      },
      {
        title: "Ask twice only when the mistake is costly",
        rule: "Confirm a second person of exactly the same name, or an irreversible merge. Do not stop routine scoring.",
        why: "A duplicate splits a player's statistics, and a merge cannot be undone.",
        evidence: "learned",
      },
    ],
  },
  {
    title: "Checking the work",
    principles: [
      {
        title: "Test with the data production has",
        rule: "Run a change through the whole path on realistic data, not only with mocked answers.",
        why: "Mocked tests passed, then the seed data showed a duplicate hiding the real profile.",
        evidence: "learned",
      },
      {
        title: "Check every claim against the code",
        rule: "Before saying something is done everywhere, search for every place it applies.",
        why: "A review of \"all fixed\" found create pages, labels and a search box that had been missed.",
        evidence: "learned",
      },
      {
        title: "Look at it on a phone",
        rule: "Check real renders at phone width and measure tap targets (44px).",
        why: "Tests passed while Try again was 20px tall and a hint cut names off.",
        evidence: "learned",
      },
    ],
  },
];

export interface ReferenceApp {
  app: string;
  takeaway: string;
}

/** Screens looked at through Lazyweb (from its descriptions of them). */
export const REFERENCE_APPS: readonly ReferenceApp[] = [
  {
    app: "MLB",
    takeaway: "Five tabs for what fans do most: Home, Scores, Watch, Standings, News.",
  },
  {
    app: "NHL",
    takeaway: "More is a real screen: tiles for Stats, Teams and Rosters, then a list.",
  },
  {
    app: "ESPN",
    takeaway: "More leads with your saved teams and leagues, then everything else.",
  },
  {
    app: "FotMob",
    takeaway: "A team page opens on what matters next: follow, next match, form.",
  },
  {
    app: "MLS, Fixtured",
    takeaway: "Team pages split into tabs for matches, results, roster and details.",
  },
  {
    app: "FotMob (match)",
    takeaway: "Score and scorers, then five short tabs about 38% down. Player of the match is a card inside the first tab; share and follow are in the top bar.",
  },
  {
    app: "ESPN, Real Sports (match)",
    takeaway: "A compact score, then tabs 31 to 39% down. No cricket app was in the library, so these are football and baseball, and only the top of each screen.",
  },
];

export interface Source {
  label: string;
  href: string;
  /** What to keep in mind when relying on it. */
  note?: string;
}

export const SOURCES: readonly Source[] = [
  {
    label: "NN/g: Hamburger menus and hidden navigation hurt UX metrics",
    href: "https://www.nngroup.com/articles/hamburger-menus/",
  },
  {
    label: "Apple Human Interface Guidelines: Tab bars",
    href: "https://developer.apple.com/design/human-interface-guidelines/tab-bars",
    note: "Read through search excerpts; the page itself did not load.",
  },
  {
    label: "Material Design 3: Navigation bar",
    href: "https://m3.material.io/components/navigation-bar/guidelines",
    note: "Not read directly. Its 3 to 5 destinations comes from secondary sources.",
  },
  {
    label: "NN/g: Sticky headers",
    href: "https://www.nngroup.com/articles/sticky-headers/",
    note: "Read through search excerpts.",
  },
  {
    label: "WCAG failure F110: a sticky header covering the focused element",
    href: "https://www.w3.org/WAI/WCAG22/Techniques/failures/F110.html",
    note: "Why what is pinned stays thin.",
  },
  {
    label: "SaaSFrame: Combobox patterns",
    href: "https://www.saasframe.io/patterns/combobox",
    note: "A pattern guide, not a study.",
  },
  {
    label: "Play-Cricket: Merging player records",
    href: "https://play-cricket.ecb.co.uk/hc/en-us/articles/115003512849-Merging-Player-Records",
  },
];

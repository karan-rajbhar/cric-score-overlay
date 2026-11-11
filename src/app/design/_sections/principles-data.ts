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
      {
        title: "A form is a task",
        rule: "Create and edit screens hide the tab bar, show one way out and keep the submit button in reach.",
        why: "The match wizard stacked its Start bar on the tab bar, which left half a phone screen for the form, and less with the keyboard up.",
        evidence: "learned",
      },
      {
        title: "The lit tab follows the trail",
        rule: "A detail page lights the section its own trail starts from, on the tab bar and the sidebar alike.",
        why: "Going from a club to one of its teams moved the lit tab to More while Back still led to the club.",
        evidence: "learned",
        appliedIn: "navSectionOf",
      },
      {
        title: "Phone actions open the sheet",
        rule: "On a phone a screen's extra actions open the actions sheet, with 44 px rows. Dropdown menus are for a mouse.",
        why: "The match page and the scoring screen kept desktop dropdowns with 32 px rows, 18 of them on the scoring screen.",
        evidence: "learned",
        appliedIn: "ActionsSheet",
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
      {
        title: "In both squads is not out",
        rule: "A squad is a standing list. Rule someone out of a side only once they have batted or bowled for the other in this match, and say so on their row.",
        why: "Seven players in both squads vanished from the fielding side, which was left four names to bowl and to catch.",
        evidence: "learned",
      },
    ],
  },
  {
    title: "States and feedback",
    principles: [
      {
        title: "Could not load is not empty",
        rule: "When a read fails, say so where the list would be and offer Try again. The empty state is for a read that worked and found nothing.",
        why: "With the database out of reach, Home said No live matches right now and offered New match.",
        evidence: "learned",
      },
      {
        title: "A notice never covers the score or the way back",
        rule: "Toasts sit clear of the top bar and the scoreboard. A state that lasts, such as offline or unsent, is a line on the screen, not a toast.",
        why: "Toasts covered the back button for four seconds, and the offline toast covered who was on strike.",
        evidence: "learned",
      },
      {
        title: "An error sits on the field that caused it",
        rule: "A mistake in a field shows under that field and takes focus. Only what is not about a field goes above the button. Toasts confirm; they do not report mistakes.",
        why: "One form used the browser's bubble, a red box a screen away from the field, and a toast.",
        evidence: "learned",
        appliedIn: "Field",
      },
      {
        title: "Nothing that goes on the record is chosen for you",
        rule: "A dialog that records a decision opens with nothing selected, and its button says what is still missing.",
        why: "The toss opened on Bat, and the penalty and abandonment dialogs on a reason nobody had picked.",
        evidence: "learned",
      },
      {
        title: "The saved theme paints first",
        rule: "Apply the stored theme before the first paint, and show the same choice in the switch.",
        why: "A saved dark theme flashed light on every load, and the switch showed Light on a dark page.",
        evidence: "learned",
      },
    ],
  },
  {
    title: "Touch and reading",
    principles: [
      {
        title: "44 px to tap",
        rule: "On phones and tablets every control is at least 44 px on its smaller side, and a row is the target, not the text in it. Nothing is under 24 px, least of all a delete.",
        why: "Squad names were 20 px links, menu rows 32 px, and a season's delete button 24 px inside a chip. Apple asks for 44 pt, WCAG 2.5.8 for 24 px at least.",
        evidence: "guideline",
      },
      {
        title: "12 px to read",
        rule: "No text under 12 px. On the scoring screen, 14 px for anything that says what a tap will record.",
        why: "The scoreboard used 10 px and the keys 9 px, on the screen read outdoors at arm's length.",
        evidence: "learned",
      },
      {
        title: "Keys stay where they are",
        rule: "Arming an extra, undoing a ball or losing the connection changes one fixed row above the keypad. The keys never move or shrink.",
        why: "Wide moved every key down 45 px and No ball 100 px, just before the tap that records the runs.",
        evidence: "learned",
      },
      {
        title: "The scoring screen fits the screen it is on",
        rule: "Size the scoring column to the visible height and check it at 360 by 640 with an extra armed.",
        why: "It needed 730 px, so Wicket and Undo were below the fold on small phones and inside browser tabs.",
        evidence: "learned",
      },
      {
        title: "A name is the last thing to be cut",
        rule: "When a row or a bar runs out of room, wrap or move its chips and actions before the name is truncated.",
        why: "A club's member list showed A…, Ry… and Da… beside Make admin and Remove, and a long match title ran under its own buttons.",
        evidence: "learned",
      },
      {
        title: "One date, one way to write it",
        rule: "Day, then the month as a word, from one helper. The year shows when it is not this year.",
        why: "The same app showed Sat 10 Aug, Jul 20, 2024, 1/6/2024 and 2024-07-15.",
        evidence: "learned",
      },
      {
        title: "Small text on a tint passes 4.5 to 1",
        rule: "Check chip and key labels against their own tint, in light mode as well as dark.",
        why: "Won, Ongoing and the wide and no-ball chips measured 4.1 to 4.4 to 1 in light mode. WCAG AA asks for 4.5.",
        evidence: "guideline",
      },
    ],
  },
  {
    title: "Accessibility",
    principles: [
      {
        title: "One h1, and no level skipped",
        rule: "Every page has one h1 that names it. Sections are h2, cards inside them h3.",
        why: "Home and three create pages had no h1, and the match page went from h1 straight to h4.",
        evidence: "guideline",
      },
      {
        title: "A way past the navigation",
        rule: "A skip link comes first, each nav has a name, and a page has one main.",
        why: "Thirteen tab stops came before the content on every page, and the scoring screen had a main inside a main.",
        evidence: "guideline",
      },
      {
        title: "The spoken name starts with what is shown",
        rule: "An aria-label begins with the visible text, then adds detail.",
        why: "Voice control could not tap Dot or a match card, because their labels used other words (WCAG 2.5.3).",
        evidence: "guideline",
      },
      {
        title: "Every control and column has a name",
        rule: "Icon buttons, selects and table headers get a label, hidden if need be.",
        why: "Two filters on the match Stats tab were announced as combo box and nothing more.",
        evidence: "guideline",
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
    label: "WCAG 2.2: Target size (minimum), 2.5.8",
    href: "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    note: "24 px is the floor; 44 px is Apple's and this app's working size.",
  },
  {
    label: "WCAG 2.2: Label in name, 2.5.3",
    href: "https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html",
  },
  {
    label: "WCAG 2.2: Contrast (minimum), 1.4.3",
    href: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
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

# UI/UX audit, 11 November 2026

A list of the UI and UX problems found in CricScore on 11 November 2026, written so that a later session can fix them one by one. The baseline is `main` at `84b7200` (the merge of PR #52). The only changes made alongside this document are to the `/design` reference page (`src/app/design/`), so that each entry can point at what the fix should look like. No app code was changed.

104 entries: 5 high, 35 medium, 64 low.

The app was looked at running, not only read: a local build on the Firebase emulators with the seeded demo data, driven through a headless browser at 390 x 844 (the main phone size), 320, 360 and 375 px wide phones, an 820 px tablet and a 1440 px desktop, in light and dark, signed in as a club owner, as a plain member and signed out. Each entry was then traced to the file and line that causes it.

Streaming is in alpha and is being worked on separately, so it is not in this audit: the stream setup page, the overlay control room, the overlay output and channels, the sponsor manager, Stream Deck tokens and the streamers part of the scorers dialog.

## How to read an entry

Severity is about the effect on the person using the screen:

- high: a task cannot be finished or is easily done wrong, content is unreadable or cut off, a screen is unusable at a supported size, or a control cannot be reached
- medium: friction or confusion people will hit in normal use, an inconsistency that makes them stop, a missing state or missing feedback
- low: polish, or a rule of the design system broken with little effect

Status says how the finding was established:

- seen on screen: it is in a screenshot or in the measured output of the page
- from code: the state could not be produced locally (a loading file, the install prompt, push), so the code path was read

Design reference says what to build towards. `/design#spec-...` is a specimen added to the reference page for this audit; a principle is in `/design#principles`; the other anchors are the sections that were already there. Open `/design` on a dev server (`npm run dev:local`) to see them. Where an entry says "no specimen", the Fix line is the whole instruction.

Evidence paths (`shots/...`, `kit/...`) are relative to `.claude/ui-ux-audit-2026-11-11/` in the repository. That folder is ignored by git: it holds the screenshots cited here, the raw notes per area and the small tool that took them (`kit/README.md` says how to run it against a dev server to check a fix).

Line numbers are from the baseline commit and will drift, so search for the quoted name if a line no longer matches.

Fix one entry, or one theme from the list below, per commit. Check each fix on a phone-sized screen at 390 and 360 px before calling it done, and in dark mode where colour is involved.

## Fix this first: N1 is a crash, not a design problem

A tournament page fails for its own organiser while the tournament is not over: "Something went wrong. Attempted to call isBracketFormat() from the server but isBracketFormat is on the client." Signed out, or as a plain club member, the same page opens.

- Cause: `src/app/tournaments/[id]/(detail)/layout.tsx:59` imports `isBracketFormat` from `src/components/tournaments/next-round-dialog.tsx`, a `"use client"` file, and calls it at `:644` and `:650` inside the organiser-only branch. A server component cannot call a function exported from a client module.
- Since: commit `517a013` (the split into on-demand tabs), so it is in production. Production has no tournaments yet, which is why nobody has hit it.
- Fix: move `isBracketFormat` to a plain module (for example `~/lib/tournament-format.ts`) and import it from there in both files. Add a render test of the layout as an organiser.
- Because of this crash the organiser's side of the tournament page (Register team, registrations, Generate fixtures, Create next round, Manage, points adjustments) could not be looked at. Review those on screen once it is fixed.

## The five high findings

| Id  | Problem                                                                                            | Where                  |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| N1  | A tournament page crashes for its own organiser                                                    | tournament layout      |
| N2  | Home and the landing page say "No live matches" when the lists could not be read                   | Home, landing          |
| T1  | On a phone the club's Members list cuts every name to one to three letters                         | club page, Members     |
| S1  | A player in both teams' squads is given to one side without a word, and disappears from the other  | scoring screen pickers |
| S2  | The scoring screen needs 730 px of height, so on shorter phones Wicket and Undo are below the fold | scoring screen         |

## Coverage

| Area                                                                    | Entries                        | Notes                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| N. App shell, navigation, Home, More, search, sign-in, error pages      | 39 (2 high, 14 medium, 23 low) |                                                                                       |
| M. Matches list, match page (all tabs and states), report, Players page | 19 (0 high, 7 medium, 12 low)  |                                                                                       |
| P. Teams and players                                                    | 10 (0 high, 3 medium, 7 low)   |                                                                                       |
| T. Clubs and tournaments                                                | 12 (1 high, 3 medium, 8 low)   | Tournament page seen as a member and signed out only (N1)                             |
| F. Create flows and forms                                               | 6 (0 high, 2 medium, 4 low)    | Forms were not submitted for real, to keep the seed clean                             |
| S. Scoring screen                                                       | 13 (2 high, 5 medium, 6 low)   | First over of a test match; the break, the chase and the result card were not reached |
| X. Across the app (automated sweeps of 26 screens)                      | 5 (0 high, 1 medium, 4 low)    |                                                                                       |
| Streaming: setup, control room, overlay, channels, sponsors             | not reviewed                   | Alpha, handled separately                                                             |

Each area ends with what was covered and what was not.

## Themes: fix these once, not screen by screen

Most entries are instances of a few root causes. Fixing the shared piece closes several at a time.

1. A failed read looks like an empty list or a raw error. Lists say "nothing here" and offer to create something; error screens print database text. One "could not load" state and one error screen, used everywhere. Entries: N2, N6, N7, N20, M6, M18.
2. Names and titles are cut before the things around them. Actions and chips keep their width and the name gets what is left. Entries: T1, M1, M7, M8, M16, T5, N30.
3. On phones, menus are desktop dropdowns. The match page and the scoring screen open small dropdowns with 32 px rows where the other detail pages open the actions sheet. Entries: M13, S5, N17, N23.
4. Sizes for touch and for reading. Controls under 44 px, text under 12 px, three text colours a shade under AA contrast. Entries: M9, N16, N17, P8, T5, T10, S4, X1, X2, X5.
5. Dates. Four formats, one of them month-first, one of them raw ISO; a fixture whose time has passed drops out of lists and is still called upcoming; results carry no date. One helper and one rule for late fixtures. Entries: P5, T3, T7, M3, M4, M17, N10, T12.
6. The scoring screen moves under the thumb and does not fit short phones. One fixed row above the keys for everything that changes, and a column sized to the visible height. Entries: S2, S3, S4, S11.
7. Picking and adding people. Two places break the app's own rules: the team page's Add player box, and the match pickers that drop anyone who is in both squads. Entries: P1, S1, S10, P7, M10.
8. Forms. Errors arrive as browser bubbles, a red box far from the field, or a toast; pages have no heading; required and optional are marked three ways. Build them with the design system's `Field`. Entries: F1, F3, F4, F5, N18, N8.
9. Dialogs. Different header styles, button layouts and selected looks; some open with an answer already chosen; one is a browser confirm box. Entries: M14, S7, S8, S9, N37.
10. Where a tab change lands, and what a reload keeps. Costly tabs throw the page back to the top; the Matches filters are lost on reload. Entries: T2, M5, N35.
11. Accessibility basics. Pages without an h1, skipped heading levels, no skip link, names that do not contain the visible text, two unnamed selects. Entries: N21, N26, M11, F3, S12, X3, X4.

## The design reference: what changed on /design

Only files under `src/app/design/` changed.

A new section, "States and edge cases" (`/design#states`, `src/app/design/_sections/states.tsx`), holds the targets:

| Anchor                 | Shows                                                                                                               | Entries                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `#spec-could-not-load` | A failed list beside an empty one                                                                                   | N2, M6, M18               |
| `#spec-error-screens`  | Not found, and something went wrong                                                                                 | N6, N7, N20               |
| `#spec-long-title`     | The top bar with a long title and two actions, at 390 and 320 px                                                    | M1                        |
| `#spec-fixture-late`   | A fixture past its start time                                                                                       | M3, M17, N10              |
| `#spec-result-date`    | A result card with its date and competition                                                                         | M2, M4                    |
| `#spec-row-actions`    | A person row with a status and a row menu at phone width                                                            | T1, T7, P8                |
| `#spec-add-player`     | Adding or picking a player: found first, the reason on a row that cannot be used, a row in both squads, create last | P1, S1                    |
| `#spec-form-errors`    | A form sent with mistakes                                                                                           | F1, N18                   |
| `#spec-choice-dialog`  | A dialog that records a choice: one header, choice tiles, nothing preselected, one footer                           | S7, S8, M14               |
| `#spec-scoring-small`  | The scoring screen at 360 x 640: between balls, No ball armed, offline. The keys do not move                        | S2, S3, S4, S11           |
| `#spec-touch-sizes`    | 44, 36 and 24 px and where each is allowed                                                                          | M9, N16, N17, P8, T10, S5 |
| `#spec-qualification`  | Qualification wording                                                                                               | T4                        |
| `#spec-dates`          | Dates and times                                                                                                     | P5, T3, T7, M17           |

The specimens are drawn from tokens and design-system pieces inside the reference page. They are pictures of the target, not the components to ship: the fix changes the app's own components (for example `ScreenBar` for the long title) until they match.

New principles in `/design#principles` (`src/app/design/_sections/principles-data.ts`):

- Finding your way: "A form is a task", "The lit tab follows the trail", "Phone actions open the sheet"
- Searching and adding: "In both squads is not out"
- States and feedback (new group): "Could not load is not empty", "A notice never covers the score or the way back", "An error sits on the field that caused it", "Nothing that goes on the record is chosen for you", "The saved theme paints first"
- Touch and reading (new group): "44 px to tap", "12 px to read", "Keys stay where they are", "The scoring screen fits the screen it is on", "A name is the last thing to be cut", "One date, one way to write it", "Small text on a tint passes 4.5 to 1"
- Accessibility (new group): "One h1, and no level skipped", "A way past the navigation", "The spoken name starts with what is shown", "Every control and column has a name"

Two smaller changes: `Specimen` takes an `id` so documents can link to one, and the sample match's innings-break state (`/design/match?state=break`) now has the untouched second innings the engine really creates, so it reads "Innings break" with the target instead of "Live".

Not drawn, on purpose (the Fix line is enough, or the state is better judged in the app): the sign-in states, the first-run card on Home, grouped search results, the sidebar between 768 and 1023 px, the scorecard at 320 px, the phone form of a player's innings row, a header with more chips than fit, the match wizard without the tab bar.

`AGENTS.md` was left alone. When the fixes land, its `/design` paragraph should gain the new section and the three new groups of principles.

Checks run on the `/design` changes: `npx vitest run src/app/design` (2 tests pass), `npm run typecheck` (passes), `npx eslint src/app/design` (0 errors; 1 warning that was there before), and the page was looked at on phone and desktop, light and dark. It does not scroll sideways at 390 px.

## Suggested order of work

1. N1, on its own, first. Then look at the organiser's tournament controls on screen and add what that shows.
2. The other highs: S2 and S3 together (the scoring screen's layout), S1 (players in both squads), T1 (member rows), N2 (failed reads).
3. The shared pieces, each of which closes a theme: the date helper and the late-fixture rule (theme 5), `ScreenBar` and row layouts (theme 2), the actions sheet on phones (theme 3), the forms on `Field` (theme 8), the error and could-not-load states (theme 1), the dialog anatomy (theme 9).
4. The remaining mediums, area by area: M, S, T, P, F, N.
5. The lows, grouped by file so each file is touched once.

Entries that change engine behaviour and need care beyond layout: S1 (who may bowl), S6 (batting order of the openers, pinned by the golden replay fixtures), M3 (which fixtures a list query returns, which needs an index check).

## How it was checked, and what was not

- Build: `npm run dev:local` with the emulator flags forced on, so the cloud dev project named in `.env.local` was never touched. Seed data from `firebase/seed/data.json`.
- People: John Smith (owner of Metropolitan Cricket Club and creator of most seeded matches), David Brown (plain member), signed out.
- Tool: `kit/shot.mjs` opens a path at a viewport and theme, runs clicks, and saves screenshots; `--audit` measures sideways scroll, tap targets, unnamed controls and small text; `--axe` runs axe-core. `kit/sweep.mjs` runs the measurements over 26 screens in one go.
- Area N was reviewed by a separate reviewer early in the session; M, P, T, F, S and X in the main session.
- Things the local build cannot show were judged from code and are marked so: `loading.tsx` files, the install prompt, push permission, the service worker's update toast.
- Seed artefacts that are not findings: seeded live matches have no live document, so their list cards show the run rate where a real match shows the chase, and seeded balls are numbered by delivery, so a wide gets its own number on the Balls tab. The engine numbers them correctly.
- Data added to the local emulator only: one invited account with a very long name, and one match ("Strikers vs Thunder", in its first over).

Not looked at: the tournament page as its organiser (N1); the innings break, the chase, the result card, super over and player-of-the-match dialog on the scoring screen; a second scorer on the same match and the unsent-actions dialog; the summary image and the PDF files themselves; the print layout of the report; club settings, branding and invite dialogs; desktop layouts of the create forms; anything under streaming.

## Index by severity

High (5):

| Id  | Problem                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- |
| N1  | A tournament page crashes for its own organiser                                                    |
| N2  | Home and the landing page say "No live matches" when the lists could not be read                   |
| T1  | On a phone the club's Members list cuts every name to one to three letters                         |
| S1  | A player in both teams' squads is given to one side without a word, and disappears from the other  |
| S2  | The scoring screen needs 730 px of height, so on shorter phones Wicket and Undo are below the fold |

Medium (35):

| Id  | Problem                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------- |
| N3  | After Google sends a phone back, the sign-in screen sits idle while the session is created                    |
| N4  | A stored dark theme paints light first, and the theme switch on More shows the wrong option                   |
| N5  | Between 768 and about 1000 px the open sidebar squeezes the page until the live score overlaps the team names |
| N6  | A match that does not exist shows a database error and "Try again"                                            |
| N7  | The error screen prints the raw error text                                                                    |
| N8  | The sign-in page shows any text from the URL as its error, and a "%" in it crashes the page                   |
| N9  | The big live card on Home opens the match only from its button                                                |
| N10 | "Your upcoming matches" keeps overdue fixtures at the top for ever                                            |
| N11 | The Get started checklist takes the first screen of Home for every new member, players included               |
| N12 | Toasts cover the back bar on phones and do not look like the app                                              |
| N13 | Search shows 5 results per group as if that were all                                                          |
| N16 | Tap targets under 44 px on the entry screens                                                                  |
| N17 | On tablets the header and its menus are sized for a mouse                                                     |
| N18 | After a successful invite the email field turns red beside "Invite saved"                                     |
| M1  | A long title in a phone screen's top bar runs under the action buttons                                        |
| M2  | Match cards in lists never name the competition, and Home files tournament fixtures under "Friendly matches"  |
| M3  | A fixture more than three hours past its start time is in no list on Matches                                  |
| M4  | Results and live cards carry no date, and neither does the match header                                       |
| M5  | The Matches filter and status tabs are lost on reload and Back, and the box is not the shared list search     |
| M7  | At 320 px the batting table truncates names and stacks dismissals one word per line                           |
| M13 | On phones the match page's ⋯ opens a desktop dropdown, where every other detail page opens the actions sheet  |
| P1  | The team page's Add player box breaks the app's own rules for adding people                                   |
| P2  | A player's Batting and Bowling tables are 750 px wide on a phone, with nothing to say they scroll             |
| P3  | Recent form and Best batting label every innings "Match"                                                      |
| T2  | Opening a costly tab from further down the page throws you back to the top of the screen                      |
| T3  | The tournament header shows its dates as "2024-07-15 to 2024-08-30"                                           |
| T4  | The qualification calculator tells a team with no games left that it "Needs 1 win"                            |
| F1  | Form errors arrive three different ways, and the field at fault is often not the one marked                   |
| F2  | The match wizard stacks a sticky Start bar on top of the tab bar                                              |
| S3  | Arming an extra, undoing a ball or opening More runs moves every key on the pad                               |
| S4  | The scoreboard and the keys use 9 to 11 px text                                                               |
| S5  | Match tools on a phone is an 18-row dropdown with 32 px rows                                                  |
| S6  | The openers' batting order follows their user ids, not who took strike                                        |
| S7  | Dialogs that decide something arrive with an answer already chosen                                            |
| X1  | Three text colours sit just under the AA contrast line in light mode                                          |

Low (64):

| Id  | Problem                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| N14 | The Search page is built from its own pieces, not the shared ones                                             |
| N15 | Desktop: the header search ignores one letter in silence, and the Search page has two search boxes            |
| N19 | Pages under /matches lose "                                                                                   | CricScore", the 404 screen has no title |
| N20 | "Home" on the 404 and error screens sends a signed-out visitor to Sign in                                     |
| N21 | Home has no h1, and the live section is two landmarks with one name                                           |
| N22 | The signed-in person has three different avatars                                                              |
| N23 | Opening any dropdown menu draws a focus ring round the whole panel                                            |
| N24 | The lit tab and the page's own trail disagree on some detail pages                                            |
| N25 | Back is announced as "Back to <parent>" even when it returns somewhere else                                   |
| N26 | No skip link, and the header is an unnamed nav                                                                |
| N27 | Sidebar group labels fail contrast                                                                            |
| N28 | Three ways to start a match on desktop Home, one of them an action in the navigation                          |
| N29 | More: Install app sits under "Invites", notifications use a different look, the theme switch is uneven        |
| N30 | A long invited email runs out of the sign-in card                                                             |
| N31 | Signed-out gates come in three forms, and "Sign in" forgets where you were                                    |
| N32 | Loading states: Home's skeleton is another page's, and four routes have none                                  |
| N33 | The offline page talks only to scorers and does not look like the app                                         |
| N34 | The installed app opens on the sign-in wall for anyone signed out                                             |
| N35 | Section titles come in two sizes, and "See more" under Results opens the unfiltered list                      |
| N36 | Invites page details                                                                                          |
| N37 | The sign-out warning is a browser confirm box                                                                 |
| N38 | On Android the tab bar rides on top of the keyboard                                                           |
| N39 | No side safe-area padding in landscape                                                                        |
| M6  | The Matches error and empty states are generic                                                                |
| M8  | Top performers rows cut off the figures to make room for the team name                                        |
| M9  | Small tap targets on the match page                                                                           |
| M10 | Squads tab: "Player" under every name, "Vice Captain" in title case, bare "#7"                                |
| M11 | Match page headings skip levels                                                                               |
| M12 | The extras line breaks before its last figure                                                                 |
| M14 | Match dialogs: one is titled "Club", and titles are centred in some and left-aligned in others                |
| M15 | The match report scrolls sideways by a few pixels on a phone                                                  |
| M16 | Head to head cuts the team names to five letters, and past-meeting cards cut the date                         |
| M17 | An upcoming match's header gives the day without the year and still says "Upcoming" after the day has passed  |
| M18 | The live panel says "This over: yet to start" whenever it has no balls to show                                |
| M19 | On wide screens single-column lists on the match page stretch edge to edge                                    |
| P4  | A player's Stats tab repeats the same figures two or three times and gives a non-bowler a screen of zeros     |
| P5  | Dates come in three formats                                                                                   |
| P6  | On phones the team record tiles do not add up                                                                 |
| P7  | Squad roles are written three ways, and "Player" sits under every other name                                  |
| P8  | In a squad only the 20 px name is a link, and the role menu does not show the current role                    |
| P9  | Username or handle: the same thing has two names, and its dialog is in title case and monospace               |
| P10 | Small inconsistencies on the player and team headers                                                          |
| T5  | Header chips run under the crest, and seasons are managed from chips with a 24 px delete button               |
| T6  | "Club owner" is a disabled button, shown twice                                                                |
| T7  | Club members cannot be opened, and their joining date is in the browser's numeric format                      |
| T8  | The desktop club header has eight buttons of equal weight with the main one last                              |
| T9  | Leaderboard cards: league nicknames and two title sizes                                                       |
| T10 | Contact links in the club's actions sheet are tiny, and "X" is one letter                                     |
| T11 | Hall of fame wording and controls                                                                             |
| T12 | A tournament past its end date still says "Ongoing", and its list card runs to four lines of description      |
| F3  | Create pages have no heading and call the same thing by different names                                       |
| F4  | Required and optional fields are marked three ways                                                            |
| F5  | Placeholder examples: "E.G. RCB", and a real franchise as the sample                                          |
| F6  | Back is a text link on forms and a round button everywhere else                                               |
| S8  | Scoring dialogs come in two header styles, two button layouts and three "selected" looks                      |
| S9  | Match settings is written in jargon                                                                           |
| S10 | Squads in a match: a bin on every row, with nothing to say what it removes                                    |
| S11 | The offline notice is a toast that covers the striker                                                         |
| S12 | Keypad keys are announced by a name that does not contain what they show, and the page has two main landmarks |
| S13 | Small things on the scoring screen                                                                            |
| X2  | Text fields under 16 px on phones                                                                             |
| X3  | Two selects with no name, one empty table header                                                              |
| X4  | Cards and keys whose spoken name leaves out what they show                                                    |
| X5  | 11 px text is everywhere there are figures                                                                    |

## N. App shell, navigation and entry screens

Screenshots: `shots/N/`.

### N1. A tournament page crashes for its own organiser

- Severity: high
- Where: `/tournaments/<id>` signed in as the organiser of a tournament that is not over (John on `...440001` and `...440003`), every viewport; `src/app/tournaments/[id]/(detail)/layout.tsx:59` (import), `:644` and `:650` (calls); `src/components/tournaments/next-round-dialog.tsx:37`
- What happens: the page is replaced by the error screen: "Something went wrong. Attempted to call isBracketFormat() from the server but isBracketFormat is on the client." Signed out, or as a plain member (David), the same page renders, because the calls sit inside `isTournamentAdmin && !over`. The helper is exported from a `"use client"` file and called in a server layout.
- Why it matters: the person who runs the tournament cannot open it, so no fixtures, registrations or points table for them. "Try again" fails the same way.
- Fix: move `isBracketFormat` to a plain module (for example `~/lib/tournament-format.ts`), import it from there in both the layout and `next-round-dialog.tsx`. Add a render test of the layout as an organiser.
- Design reference: none needed (a defect, not a design question)
- Evidence: `shots/N/d-tournament.phone.light.png`, `shots/N/d-tournament3.phone.light.png` (crash), `shots/N/d-tournament-david.phone.light.png`, `shots/N/d-tournament.phone.light.anon.png` (fine)
- Status: seen on screen

### N2. Home and the landing page say "No live matches" when the lists could not be read

- Severity: high
- Where: `/dashboard` and `/` (and every list fed by the same hook), all viewports; `src/app/dashboard/page.tsx:166-192` and `:213-243`, `src/components/home/landing-page.tsx:112-136`, `src/lib/hooks/useMatchQueries.ts:403-419`
- What happens: with the browser unable to reach Firestore (requests to it aborted, the page itself loads), Home shows within 3 seconds "No live matches right now. Start a match to score it ball by ball" with a primary "New match" button, and "No completed matches yet". The seed has two live matches and four results. The Firestore client answers an unreachable server with an empty result from its cache, not an error, and the pages read only `data` and `isLoading`, never `isError`.
- Why it matters: a scorer on a weak signal at the ground (or behind a blocker that stops Firestore) is told their live match does not exist and is offered "New match". This is the same mistake as the app's own principle "Still looking is not nothing found": could not load must not read as nothing there.
- Fix: make the list read fail when it did not reach the server (in `fetchMatchList` use a server read, or treat an empty `fromCache` snapshot as an error), then in the three sections show a "Could not load matches" state with "Try again" when `isError` (and keep the skeleton while `isFetching` with no data). Never show the "New match" card unless the read succeeded.
- Design reference: /design#spec-could-not-load; principle "Could not load is not empty" (/design#principles)
- Evidence: `shots/N/nofs-dashboard.phone.t3000.png`, `shots/N/nofs-dashboard.phone.t30000.png`, `shots/N/nofs-landing.phone.t3000.png` (made with `n-nofirestore.mjs` in the kit folder)
- Status: seen on screen

### N3. After Google sends a phone back, the sign-in screen sits idle while the session is created

- Severity: medium
- Where: `/auth/login` on touch devices (redirect flow), phone and tablet; `src/app/auth/login/page.tsx:147-181`, `src/lib/auth.tsx:322-332`
- What happens: on return from Google the page shows the untouched "Continue with Google" button until the session request answers. With that request slowed to 5 s the screen looked exactly like before signing in for the whole time, then jumped to Home. The "Signing in with Google…" state exists only for the popup flow on desktop (`googleLoading` is local state and is lost by the redirect).
- Why it matters: on a slow connection the person believes sign-in failed and taps again, which starts a second round trip to Google.
- Fix: expose a `signingIn` flag from `AuthProvider` (true from `takeRedirectPending()` until `finishSignIn` settles or fails) and have the login page show the disabled "Signing you in…" button for it, the same face the popup flow uses.
- Design reference: No specimen. The three states (idle, signing in, refused) are in the Fix; the pieces are /design#controls (Buttons) and /design#feedback (Callouts).
- Evidence: `shots/N/firstrun.phone.t2500.png`, `shots/N/firstrun.phone.t4000.png` (idle button during sign-in), `shots/N/firstrun.phone.t6000.png` (Home), compare `shots/N/refused.desktop.while-popup.png`
- Status: seen on screen

### N4. A stored dark theme paints light first, and the theme switch on More shows the wrong option

- Severity: medium
- Where: every page on a full load; `/more` phone; `src/lib/theme-provider.tsx:41-80`, `src/app/layout.tsx:78-88`, `src/components/layout/account-sections.tsx:171-180`
- What happens: (1) with "Dark" saved, the first paint of a full page load is the light theme (at DOMContentLoaded `<html>` has no `dark` class and the body is `rgb(250,250,253)`); the class is added in an effect after hydration. (2) On `/more` the page is dark but the Theme control shows "Light" selected, with a hydration mismatch in the console: the server renders "light", the client state starts from localStorage, and React does not patch the attribute. The header's `ThemeToggle` avoids this with a mounted check, the Segmented on More does not.
- Why it matters: people pick dark for evening matches and get a white flash on every reload, search submit and app launch. The control then tells them the theme is Light.
- Fix: set the class before paint with a small inline script in `<head>` that reads `cricket-ui-theme` (and `prefers-color-scheme` for "system"); read the theme for the More control with `useSyncExternalStore` or a mounted check as `ThemeToggle` does. Also drive `themeColor` from the chosen theme, not only the OS setting (`src/app/layout.tsx:60-63`).
- Design reference: Principle "The saved theme paints first" (/design#principles)
- Evidence: `shots/N/theme-dark-first-paint.phone.png` (light first paint with dark saved), `shots/N/more.phone.dark.2of2.png` ("Light" selected on a dark page); console: "A tree hydrated but some attributes of the server rendered HTML didn't match"
- Status: seen on screen

### N5. Between 768 and about 1000 px the open sidebar squeezes the page until the live score overlaps the team names

- Severity: medium
- Where: `/dashboard` and `/` at tablet portrait (820x1180, 768x1024) and a phone in landscape (844x390); `src/components/layout/app-sidebar.tsx:75-79`, `src/lib/stores/useSidebarStore.ts:13`, `src/components/ds/carousel.tsx:96-99`
- What happens: from `md` the sidebar is 260 px wide by default, leaving about 510 px. The live cards switch to a two-column grid at `md` regardless, so each is about 245 px wide: "78/4" touches "Riverside" on both sides and "108/3" covers the first letter of "Metropolitan". Result cards show "Metropo…" v "Metropolit…". On a landscape phone the 56 px header and the sidebar leave about 330 px of height for content.
- Why it matters: content is cut off on an iPad held upright and on any phone turned sideways, both normal at a ground.
- Fix: start the sidebar collapsed below `lg` (keep the user's choice from `lg` up), and move the carousel's `gridFromMd` grid and the two-column card grids to `lg`, or use a container query on the content width.
- Design reference: No specimen. The rule is the Fix; /design#content (Navigation) shows the sidebar.
- Evidence: `shots/N/dashboard.tablet.light.png`, `shots/N/dashboard-landscape.phone.light.png`, `shots/N/d-team.tablet.light.png`
- Status: seen on screen

### N6. A match that does not exist shows a database error and "Try again"

- Severity: medium
- Where: `/matches/<unknown or deleted id>`, all viewports; `src/app/matches/[id]/match-detail.tsx:333-356`, `src/app/matches/[id]/page.tsx:28`
- What happens: a well-formed id with no match shows "Couldn't load match. JSON object requested, multiple (or no) rows returned", a malformed id shows "Invalid match ID". Both offer "Try again", which cannot help. No `h1`, tab title "Match". Missing players, teams, clubs and tournaments all show the shared "Page not found" screen instead.
- Why it matters: links to deleted matches travel on WhatsApp. The person reads a temporary fault and retries, and sees internal wording.
- Fix: when the read answers "no rows" or the id is invalid, call the shared not-found screen (or render the same copy: "This match is no longer here. It may have been deleted."), with "Matches" as the way on. Keep "Couldn't load match" plus "Try again" only for real failures, with plain copy, never `error.message`.
- Design reference: /design#spec-error-screens
- Evidence: `shots/N/nf-match-uuid.phone.light.png`, `shots/N/notfound-match.phone.light.png`, compare `shots/N/nf-team.phone.light.png`
- Status: seen on screen

### N7. The error screen prints the raw error text

- Severity: medium
- Where: any page that throws, all viewports; `src/app/error.tsx:34-43`
- What happens: the screen shows `error.message` under "Something went wrong" (seen: "Attempted to call isBracketFormat() from the server…", and "URI malformed" on the sign-in page) and a monospace "Digest: 3420445829". In a production build a server error's message is Next.js's own paragraph about Server Components and digests, which would be shown as is.
- Why it matters: it says nothing a scorer can act on and reads as broken software. The copy rule is plain words.
- Fix: fixed copy ("This page could not be loaded. Try again, or go back to where you were."), keep the digest as a small "Error code" line for support, keep "Try again", and add Back (`BackLink`) beside Home.
- Design reference: /design#spec-error-screens
- Evidence: `shots/N/d-tournament.phone.light.png`, `shots/N/login-badparam.phone.light.anon.png`
- Status: seen on screen

### N8. The sign-in page shows any text from the URL as its error, and a "%" in it crashes the page

- Severity: medium
- Where: `/auth/login?error=…&message=…`; `src/app/auth/login/page.tsx:44-62`
- What happens: `?error=oauth_error&message=<anything>` renders that text in the red alert of the real sign-in card ("Your account is locked. Send your password to…" displayed as CricScore's own message). `message=100%25` throws `URIError` (the value is decoded twice) and the page is replaced by "Something went wrong. URI malformed". Nothing in the code produces these parameters any more; the other branches say "Session creation failed" and "OAuth authentication failed".
- Why it matters: a crafted link can put a convincing instruction on the sign-in screen, and the leftover copy is jargon.
- Fix: delete the `error` / `message` handling. Errors already arrive through `redirectError` and the local `error` state. Reword `"Could not establish a server session"` (`src/lib/auth.tsx:166`) to plain copy.
- Design reference: `/design#feedback` (Callouts)
- Evidence: `shots/N/login-injected.phone.light.anon.png`, `shots/N/login-badparam.phone.light.anon.png`, `shots/N/login-invite-error.phone.light.anon.png`
- Status: seen on screen

### N9. The big live card on Home opens the match only from its button

- Severity: medium
- Where: `/dashboard` and `/`, phone and desktop; `src/components/matches/live-hero-card.tsx:28-50`
- What happens: tapping the score, the teams or the title of a live card does nothing. Only "Follow live" (40 px tall) opens the match. Fixture cards and result cards right below are tappable as a whole.
- Why it matters: the score is the largest thing on the screen and the natural thing to tap. Two behaviours for a match card on one page.
- Fix: make the card body a link to `/matches/<id>` as `MatchCard` does (stretched link, buttons above it), keep "Score" as the separate action for scorers. Consider "Open match" or "Watch live" for the button, since "Follow" elsewhere means subscribing.
- Design reference: `/design#screens` (Home, live carousel), `/design#cricket` (match cards)
- Evidence: `shots/N/dashboard.phone.light.1of3.png`; step log: tap on "78/4" left the URL at `/dashboard`, tap on the fixture card's "19:30" opened the match
- Status: seen on screen

### N10. "Your upcoming matches" keeps overdue fixtures at the top for ever

- Severity: medium
- Where: `/dashboard`, all viewports; `src/app/dashboard/actions.ts:79-85` and `:113-117`, `src/app/dashboard/page.tsx:194-199`
- What happens: the section lists scheduled matches oldest first with no lower date, six at most. The seeded fixture from August 2024 shows as "Sat 10 Aug · 19:30 · Upcoming", with no year, 27 months later. The general "Upcoming" list starts 3 hours before now, so the two sections follow different rules.
- Why it matters: a fixture that was rained off and never started stays first, labelled Upcoming, and six of them push every real fixture out of the section.
- Fix: list from 3 hours before now like `fetchMatchList`, soonest first. Show older unstarted fixtures separately as "Not started" with the year when it is not this year and the two actions that resolve them (Start, Reschedule), or leave them to the Matches list.
- Design reference: /design#spec-fixture-late; /design#screens (Home, Upcoming group)
- Evidence: `shots/N/dashboard.phone.light.1of3.png`, `shots/N/dashboard.desktop.light.1of2.png`
- Status: seen on screen

### N11. The Get started checklist takes the first screen of Home for every new member, players included

- Severity: medium
- Where: `/dashboard` for any account that has not created a team and a match (David, a plain club member, and a brand-new invitee), phone 390 and 320; `src/app/dashboard/page.tsx:164`, `src/components/dashboard/get-started.tsx:77-171`
- What happens: a four-step card (Create a team, Add players, Create a match, Invite a co-scorer) fills the first screen, so the live matches start below the fold. Steps 2 and 4 are greyed at 60% with no reason given. The card is drawn with a border (`rounded-xl border`), not the floating card. Its dismiss button is 40 px.
- Why it matters: most invited people play or follow, they do not set up teams. The rule is "scores are the hero"; here a setup list for organisers is.
- Fix: one compact row under the live carousel ("Set up a team and your first match · 0 of 4", opening the steps in a `Disclosure` or sheet), shown only to accounts that are in no squad and admin no club. Say why a step waits ("after you create a team"). Use `cardSurface`.
- Design reference: /design#content (Card, Disclosure). No specimen for the first-run card: follow the Fix.
- Evidence: `shots/N/dashboard-david.phone.light.1of3.png`, `shots/N/dashboard-newuser.small.light.1of4.png`, `shots/N/firstrun.phone.t9000.png`
- Status: seen on screen

### N12. Toasts cover the back bar on phones and do not look like the app

- Severity: medium
- Where: every phone screen; `src/app/layout.tsx:92`
- What happens: `<Toaster richColors position="top-center" />` puts toasts 16 px from the top, full width. A two-line toast spans 16 to 108 px and hides the back button, the title and the top actions for its 4 seconds; "New version available" stays until dismissed (`duration: Infinity`, `src/components/pwa/service-worker-registrar.tsx:73-90`). There is no safe-area offset, so in the installed app on an iPhone (viewport-fit cover) the toast starts under the status bar. Toasts use sonner's system font, tinted fill and 8 px corners, not Urbanist and the card look.
- Why it matters: Back cannot be tapped while a toast is up, and a lasting toast sits on the header (on the scoring screen, on the score).
- Fix: `mobileOffset={{ top: "calc(env(safe-area-inset-top) + 4.25rem)" }}` so toasts sit below the 44 px bar (or bottom-centre above the tab bar), `toastOptions` with the app's font, `rounded-2xl`, `shadow-float` and the token colours instead of `richColors`. Show the update offer as a thin inline strip, not a toast.
- Design reference: Principle "A notice never covers the score or the way back" (/design#principles); /design#feedback (Toast, dialog and menu)
- Evidence: `shots/N/toast-phone.phone.light.toast.png` (toast top 16, bottom 108; back button at 20 to 64)
- Status: seen on screen (placement and look), from code (safe area, update toast)

### N13. Search shows 5 results per group as if that were all

- Severity: medium
- Where: `/search?q=…`, all viewports; `src/app/search/actions.ts:41-45`, `src/app/search/page.tsx:16-36`
- What happens: each group is cut at 5 and its count chip shows the number listed ("Matches 5" for "strikers", where more matches match). There is no "Show all" and nothing says the list is cut. Match rows show title and venue only, so "Strikers vs Warriors - Championship…" and "MCC Derby - Strikers vs Warriors (…" cannot be told apart by date or score.
- Why it matters: a match or player beyond the fifth cannot be reached from search, and the chip tells the person there are no more.
- Fix: read 6, show 5, and when there is a sixth show "Show all" linking to the list with the query (`/players?q=`, `/teams?view=all&search=`, `/clubs?view=all&search=`, `/tournaments?search=`; the Matches list keeps its search in component state today and needs a `?search=` first). Drop the count chip or word it "5+". Add the date (and result or "Live") to match rows.
- Design reference: /design#content (Section header, List rows). No specimen for grouped results: follow the Fix.
- Evidence: `shots/N/search-strikers.phone.light.png`, `shots/N/search-strikers.small.light.png`
- Status: seen on screen

### N14. The Search page is built from its own pieces, not the shared ones

- Severity: low
- Where: `/search`, all viewports; `src/app/search/page.tsx:29`, `:63-80`, `:104-221`
- What happens: results are hand-made rows in a bordered box (`rounded-xl border`), not `ListCard` / `ListRow`: no chevrons, no team crests, players as a one-letter `Initials` ("J") where the rest of the app shows `Avatar` ("JS"), usernames in a monospace face (`font-mono`), team rows repeating the short name as a subtitle. The field shows the browser's blue clear cross. On phones the placeholder is cut ("Search matches, teams, players, clubs, to") and the page under it is blank until a search is made. The field takes focus again after every search and on coming Back from a result (`autoFocus`), which raises the keyboard over the results.
- Why it matters: the rule is that lists use the shared pieces and text is in Urbanist; two looks for a player row make people check whether it is the same thing.
- Fix: `ListCard` + `ListRow` with `Avatar` / `TeamCrest`, `MatchStatusChip` as trailing, handle in the normal face. Placeholder "Search", with the description line ("Teams, matches, players, clubs and tournaments") shown on phones too. `autoFocus` only when `q` is empty. Style or hide the native clear button.
- Design reference: `/design#content` (List rows), `/design#controls` (Fields)
- Evidence: `shots/N/search-john.phone.light.png`, `shots/N/search-empty.phone.light.png`, `shots/N/more.phone.light.1of2.png` (the same person as "JS"); step log: after Back from a result `document.activeElement` is `#search-query`
- Status: seen on screen

### N15. Desktop: the header search ignores one letter in silence, and the Search page has two search boxes

- Severity: low
- Where: header from 1024 px, `/search` desktop; `src/components/navigation-bar.tsx:94-126`, `src/app/search/page.tsx:57-80`
- What happens: one letter plus Enter in the header field does nothing and says nothing (the page says "Type at least 2 characters"). On `/search` the header field and the page field sit one above the other and do not share their text (the header keeps "joh" or stays empty while the page field has the query). The header placeholder names "matches, tournaments, players", the page five kinds. The hint always reads "Ctrl K", on a Mac too, and between 768 and 1023 px Ctrl+K is swallowed although the field is hidden.
- Why it matters: the principles record "desktop had four ways to Search"; this is the same thing again on a smaller scale.
- Fix: on `/search` hide the header field (or make it the only one, synced with `?q=`). In the header submit any non-empty text and let the page say "Type at least 2 characters". Show "⌘K" on Apple platforms, and send Ctrl+K to `/search` when the field is not rendered. One placeholder wording.
- Design reference: `/design#principles` ("One place, one name")
- Evidence: `shots/N/header-search.desktop.light.one-char.png`, `shots/N/header-search.desktop.light.after-enter.png`
- Status: seen on screen

### N16. Tap targets under 44 px on the entry screens

- Severity: medium
- Where: phone and tablet; `src/components/ui/button.tsx:25-31`, `src/components/ui/empty-state.tsx:55-58` and `:84-88`, `src/components/ds/tabs.tsx:146-148`, `src/components/ds/carousel.tsx:17-35`, `src/components/ds/list.tsx:33-39`, `src/components/ui/dialog.tsx` (Close), `src/components/invite-dialog.tsx:96`, `src/components/invitations/sent-invites-list.tsx:109-148`
- What happens (measured): `ui/button` default is 40 px: "Sign in" and "Browse matches" on the landing page, "Sign in" on More, "Follow live" / "Score" on the live cards, Home / Matches / Search on the 404 screen, "Create invite". `EmptyState` actions are 36 px ("Browse matches", "Browse tournaments"). Invites: "Invite" 36 px, "Send message again" / "Revoke" / "Confirm revoke" / "Keep invite" 36 px, "Share on WhatsApp" 36 px. Dialog Close 36x36. Theme switch 32 px tall and only as wide as each word (59, 57, 74 px) inside a 358 px bar. Carousel dots 28x24 and 10x24. "See more" and "All matches" 20 px tall.
- Why it matters: the app's own check is "measure tap targets (44px)", and `ds/button` already uses 44.
- Fix: on phones use `ds/button` sizes (md 44) for these, or raise `ui/button` default to `h-11` below `sm`; `EmptyState` actions to default size; Segmented `h-11` on phones with `flex-1` options when stretched; dots as 44x24 hit areas (or drop the buttons and keep the swipe); give "See more" `min-h-11` with padding.
- Design reference: /design#spec-touch-sizes; principle "44 px to tap" (/design#principles)
- Evidence: audit output of `landing`, `more`, `search-none`, `invitations-list`, `invite-dialog`, `notfound` runs; `shots/N/more.phone.light.2of2.png`, `shots/N/invitations-list.phone.light.confirm.png`
- Status: seen on screen

### N17. On tablets the header and its menus are sized for a mouse

- Severity: medium
- Where: 768 px and up on touch devices (tablet, phone in landscape); `src/components/navigation-bar.tsx:72-81`, `:131-144`, `:161-205`, `:214-280`, `src/components/ui/theme-toggle.tsx:41-45`, `src/components/ds/page-trail.tsx:35-38`, `src/components/layout/app-sidebar.tsx:106`
- What happens (measured at 820 px): sidebar toggle, Search, theme and the user button are 36x36, "Create" is 36 px tall, sidebar rows 40 px, the Back button of `PageTrail` 36 px. The user menu has eight rows of 28 px in 12 px type, "Sign out" directly under "Install app"; the Create menu is the same.
- Why it matters: an iPad at the scorer's table is a touch device. 28 px rows make the wrong row easy to hit.
- Fix: under `(pointer: coarse)` give header buttons 44 px, menu rows `min-h-11` with `text-sm`, `PageTrail`'s Back the `icon` size. Give every row of the user menu an icon or none (four have one, four do not).
- Design reference: /design#spec-touch-sizes; principle "44 px to tap" (/design#principles)
- Evidence: `shots/N/tablet-menu.tablet.light.user-menu.png`; audit of `/dashboard` at tablet; step log: every menu item 214x28, 12 px
- Status: seen on screen

### N18. After a successful invite the email field turns red beside "Invite saved"

- Severity: medium
- Where: Invite someone dialog (More, header menu, `/invitations`), all viewports; `src/components/invite-dialog.tsx:73-81` and `:111-141`
- What happens: on success the field is emptied; it is `required` and has been typed in, so it gets the invalid red border, directly above the grey "Invite saved. Send them the message below." The primary "Create invite" stays above a second primary "Share on WhatsApp".
- Why it matters: the screen looks like an error right after it worked, and the next step (send the message) competes with a button that would start another invite.
- Fix: after success replace the form with the result: "Invite saved for <email>", the message with Share and Copy as the main actions, and a quiet "Invite someone else" that brings the field back. If the form stays, reset it with `form.reset()` so the invalid state clears.
- Design reference: /design#spec-form-errors; /design#feedback (dialog: one primary action)
- Evidence: `shots/N/invite-dialog.phone.light.created.png`
- Status: seen on screen

### N19. Pages under /matches lose "| CricScore", the 404 screen has no title

- Severity: low
- Where: `/matches/create` ("New match"), `/matches/<id>` (the share title alone), `/matches/<id>/players` ("Players"), `/matches/<id>/stream` ("Stream this match"), missing match ("Match"); any unknown URL (default "CricScore — Live Cricket Scoring & Overlay"); `src/app/matches/layout.tsx:4`, `src/app/not-found.tsx`
- What happens: the string title in the matches layout replaces the root template for everything below it. Every other section keeps "<page> | CricScore". The match's Players page has the same tab title as the Players directory.
- Why it matters: tabs, history and the screen reader's page announcement lose the app name, and two different pages are both "Players".
- Fix: in `src/app/matches/layout.tsx` use `title: { default: "Matches", template: "%s | CricScore" }`. Add `metadata = { title: "Page not found" }` to `not-found.tsx`. Title the match Players page "Players · <match>" (or "Match players").
- Design reference: AGENTS.md, Working guidelines 3 ("Every page has a title")
- Evidence: titles printed by the runs and by `curl` of each route (listed above)
- Status: seen on screen

### N20. "Home" on the 404 and error screens sends a signed-out visitor to Sign in

- Severity: low
- Where: unknown URL or a page error, signed out; `src/app/not-found.tsx:22`, `src/app/error.tsx:48`
- What happens: "Home" links to `/dashboard`, which the route guard turns into `/auth/login?redirect=/dashboard` for a visitor. The 404 copy names "match, team, tournament or club" but not a player.
- Why it matters: someone following a dead shared link is offered Home and gets a sign-in wall for an invite-only app.
- Fix: link to `/` (signed-in visitors are redirected to `/dashboard` there without a read). Copy: "This page is not here. It may have been moved or deleted."
- Design reference: /design#spec-error-screens; /design#principles ("One place, one name")
- Evidence: `shots/N/notfound-anon.phone.light.anon.png`, `shots/N/notfound-anon.phone.light.anon.after-home.png`
- Status: seen on screen

### N21. Home has no h1, and the live section is two landmarks with one name

- Severity: low
- Where: `/dashboard`, all viewports; `src/components/ds/app-bar.tsx:24-31`, `src/app/dashboard/page.tsx:166-170`
- What happens: the greeting is two `<p>`; the first heading is an `h2`. axe: `page-has-heading-one`, and `landmark-unique` for `section[aria-label="Live matches"]` wrapping the carousel's own `section aria-label="Live matches"`. With no name on the account the bar reads "Good morning" over a large bold "there". At 320 px a 15-letter first name is cut ("Venkataragha…").
- Why it matters: screen reader users jump by headings and landmarks; every other screen has one `h1`.
- Fix: render the greeting as the `h1` ("Good morning, John" in one heading, same look), drop the outer `aria-label` (or use a plain `div`). With no name show the greeting alone. Let the name wrap to two lines before truncating.
- Design reference: Principle "One h1, and no level skipped" (/design#principles); /design#content (Top of a screen: GreetingBar)
- Evidence: audit and axe of `/dashboard` (`h1Count: 0`), `shots/N/dashboard-newuser.small.light.1of4.png`
- Status: seen on screen

### N22. The signed-in person has three different avatars

- Severity: low
- Where: Home greeting, More, desktop header; `src/app/dashboard/page.tsx:137-140`, `src/components/ds/app-bar.tsx:24`, `src/components/navigation-bar.tsx:214-223`
- What happens: Home passes the first name to `Avatar`, so John is "JO" on green; More passes the full name: "JS" on lavender; the header button is a grey "J" and never shows the Google photo. The avatar's own comment says a person keeps their colour everywhere.
- Why it matters: the same person looks like three accounts.
- Fix: give `GreetingBar` the full name for the avatar (a separate `avatarName` prop) and use `Avatar` (with `src`) inside the header's user button.
- Design reference: `/design#content` (Top of a screen, List rows: Avatar)
- Evidence: `shots/N/dashboard.phone.light.1of3.png`, `shots/N/more.phone.light.1of2.png`, `shots/N/shell-desktop.desktop.light.user-menu.png`, `shots/N/more-newuser.phone.light.png` ("VS") against `shots/N/firstrun.phone.t9000.png` ("VE")
- Status: seen on screen

### N23. Opening any dropdown menu draws a focus ring round the whole panel

- Severity: low
- Where: every `DropdownMenu` (user menu, Create, theme, the ⋯ menus), after a mouse click or tap as well; `src/styles/globals.css:248-250`, `src/components/ui/dropdown-menu.tsx:60-76` and `:43-56`
- What happens: Radix moves focus to the menu panel, the global `*:focus-visible` rule gives it a 2 px navy ring with a 2 px offset, so the menu appears with a heavy outline (checked: the panel matches `:focus-visible` after a pointer click).
- Why it matters: it reads as a selected or error state and does not match the borderless floating menu in the design reference.
- Fix: add `focus-visible:ring-0 focus-visible:ring-offset-0` (the panel already has `outline-none` semantics) to `DropdownMenuContent` and `DropdownMenuSubContent`; check Select and Popover panels for the same.
- Design reference: `/design#feedback` (Toast, dialog and menu)
- Evidence: `shots/N/shell-desktop-mouse.desktop.light.user-menu-after-mouse.png`, `shots/N/tablet-menu.tablet.light.user-menu.png`
- Status: seen on screen

### N24. The lit tab and the page's own trail disagree on some detail pages

- Severity: low
- Where: a club's team (`/teams/<id>`: phone lights More, desktop lights Teams, Back and the breadcrumb say Clubs › Metropolitan Cricket Club); a tournament's match (lights Matches, trail says Tournaments › East Coast…); `/search` and `/auth/login` light nothing on phones; `/more`, `/invitations`, `/search` light nothing in the desktop sidebar; `src/lib/navigation.ts:16-31` against the trails at `:52-110`, `src/components/layout/app-sidebar.tsx:67-72`
- What happens: going Clubs › club › team moves the lit tab from Clubs to More while Back still leads to the club. The sidebar uses its own path-prefix rule, not `navSectionOf`.
- Why it matters: "One tab is always lit" exists so people can tell where they are; here the two signals on one screen point to different places.
- Fix: decide which wins and write it down. Simplest: a detail page lights the section of its trail's first crumb (pass it from the page, or derive it in one helper used by both the tab bar and the sidebar); light More for `/search` and `/auth/login` on phones.
- Design reference: Principle "The lit tab follows the trail" (/design#principles)
- Evidence: step logs of `d-team` (lit "More" / "Teams", back "Back to Metropolitan Cricket Club"), `d-match` (lit "Matches", crumbs "Tournaments > East Coast Cricket Championship 2024"), `shots/N/d-team.tablet.light.png`
- Status: seen on screen

### N25. Back is announced as "Back to <parent>" even when it returns somewhere else

- Severity: low
- Where: every `ScreenBar` and `PageTrail` Back; `src/components/ds/screen.tsx:75-87`, `src/components/ds/page-trail.tsx:26-41`
- What happens: coming from a match to a player, the button's name (and its tooltip on desktop) is "Back to Players", and it goes back to the match, as designed.
- Why it matters: a screen reader user is told a destination that is not where they land.
- Fix: in `BackLink`, when `backTarget()` gives a history step, set the label to "Back" (resolve it after mount); keep "Back to <parent>" only when the parent link will be used.
- Design reference: `/design#principles` ("Back returns where you came from")
- Evidence: step log of `journey1`: label "Back to Players->/players", landed on `/matches/…440005`
- Status: seen on screen

### N26. No skip link, and the header is an unnamed nav

- Severity: low
- Where: tablet and desktop shell; `src/components/layout/app-shell.tsx:48-60`, `src/components/navigation-bar.tsx:66` and `:72-81`
- What happens: 13 tab stops (six in the header, seven in the sidebar) come before the page content on every page. The header is a `<nav>` with no name (there is no `header` / banner landmark), next to navs named Main, Footer and Breadcrumb. "Toggle sidebar" has no state (`aria-expanded` or `aria-pressed`).
- Why it matters: WCAG 2.4.1 (Bypass blocks) for keyboard users; landmarks should be told apart.
- Fix: a visually hidden "Skip to content" link as the first focusable element, targeting `main` (`id`, `tabIndex={-1}`); make the header a `<header>`; add `aria-expanded={!collapsed}` and `aria-controls` to the toggle.
- Design reference: Principle "A way past the navigation" (/design#principles, Accessibility)
- Evidence: step log of `kbd` (focus order), `shots/N/kbd.desktop.light.tab8.png`; audit `landmarks: header:0`
- Status: seen on screen

### N27. Sidebar group labels fail contrast

- Severity: low
- Where: desktop and tablet sidebar, light theme; the Notifications heading on More uses the same class; `src/components/layout/app-sidebar.tsx:91`, `src/components/follow/push-settings.tsx:35-38`
- What happens: "Matches" and "Competitions" are 12 px in `text-muted-foreground/75`: 3.31:1 on white (axe `color-contrast`, needs 4.5:1). "Home" also sits under the label "Matches".
- Why it matters: WCAG 1.4.3.
- Fix: `text-muted-foreground` without the opacity. Rename the first group (or drop its label) so Home is not filed under Matches.
- Design reference: `/design#foundations` (Colour, Typography)
- Evidence: axe output of the landing page at desktop; `shots/N/landing.desktop.light.anon.png`
- Status: seen on screen

### N28. Three ways to start a match on desktop Home, one of them an action in the navigation

- Severity: low
- Where: `/dashboard` from 768 px; `src/components/layout/app-sidebar.tsx:38-43`, `src/components/navigation-bar.tsx:149-205`, `src/app/dashboard/page.tsx:153-159`
- What happens: "New match" is a sidebar row among the places, the header has "Create" › New match, and the greeting has a round "+" (a fourth appears in the empty live card). The sidebar and tab bar also use different icons for Matches (`Radio` and `CalendarDays`) and list Tournaments and Clubs in opposite orders.
- Why it matters: "each screen offers one way to reach it", and navigation holds places, not actions.
- Fix: drop "New match" from the sidebar, hide the greeting's "+" from `md` up (the header's Create is there). Use one icon per place and one order in both navigations.
- Design reference: `/design#principles` ("One place, one name", "A tab goes somewhere")
- Evidence: `shots/N/dashboard.desktop.light.1of2.png`
- Status: seen on screen

### N29. More: Install app sits under "Invites", notifications use a different look, the theme switch is uneven

- Severity: low
- Where: `/more`, phone; `src/components/layout/account-sections.tsx:132-160` and `:163-205`, `src/components/follow/push-settings.tsx:8-66`
- What happens: "Install app" is the third row of the "Invites" card. "Manage invites" opens a page called "Invites". The notification block (where push is available) is drawn like the desktop sidebar: a 12 px grey heading and a pill row, inside a page of `SectionHeader` + `ListCard` rows, and it confirms with a toast ("Notifications are on") although the design says routine actions confirm inline; its row says "Turn on notifications" / "Turn off on this device" instead of showing the state. The Theme control is stretched with `justify-between`, so the selected pill hugs "Light" at the left edge and the three options are not thirds.
- Why it matters: small mismatches on the page that holds the settings; a row under the wrong heading is harder to find.
- Fix: a card "This device" with Install app, Notifications (a `ListRow` with a switch and the state as subtitle) and Theme; name the link and the page the same ("Invites"); give the Segmented options `flex-1`.
- Design reference: `/design#content` (List rows, Section header), `/design#controls` (Tabs and filters), `/design#feedback` ("Routine actions confirm inline, not with a toast")
- Evidence: `shots/N/more.phone.light.2of2.png`; notifications block from code (push is not configured on the dev server)
- Status: seen on screen (Install, theme, naming), from code (notifications)

### N30. A long invited email runs out of the sign-in card

- Severity: low
- Where: `/auth/login?invite=<long email>`, 320 px (emails over about 34 characters) and 390 px (over about 44); `src/app/auth/login/page.tsx:126-131`
- What happens: "Sign in with Google using <email>" does not break the address; it runs past the card edge and is clipped without an ellipsis.
- Why it matters: the address is the one instruction on the screen (which Google account to pick).
- Fix: `break-all` (or `[overflow-wrap:anywhere]`) on the email span, on its own line.
- Design reference: /design#controls (Fields)
- Evidence: `shots/N/login-long.small.light.anon.png`
- Status: seen on screen

### N31. Signed-out gates come in three forms, and "Sign in" forgets where you were

- Severity: low
- Where: signed out; `src/proxy.ts:15-21`, `src/app/matches/create/page.tsx:916-921`, `src/app/clubs/create/page.tsx:43-48`, `src/app/tournaments/create/page.tsx:306-311`, `src/app/teams/create/page.tsx:317-329`, `src/components/navigation-bar.tsx:294`, `src/components/home/landing-page.tsx:88`, `src/components/layout/account-sections.tsx:72`
- What happens: `/dashboard` and `/invitations` redirect to the sign-in page with no word on why; the match, club and tournament create pages show a "Sign in required" card at the top (an `h1`); the team create page shows a different one (icon, `h2`, centred, "You must be signed in…"). The header's, the landing page's and More's "Sign in" carry no `redirect`, so signing in from a match page lands on Home.
- Why it matters: one job done three ways; after signing in, the person has to find the match again.
- Fix: one `SignInRequired` piece (the `EmptyState` look, one sentence saying what signing in allows and that CricScore is invite-only) for the four create pages; on the sign-in page show "Sign in to continue to <page>" when `redirect` is set; add `?redirect=<current path>` to the header link.
- Design reference: `/design#feedback` (Empty state)
- Evidence: `shots/N/anon-create-match.phone.light.anon.png`, `shots/N/anon-create-team.phone.light.anon.png`, `shots/N/anon-dashboard.phone.light.anon.png`
- Status: seen on screen

### N32. Loading states: Home's skeleton is another page's, and four routes have none

- Severity: low
- Where: `src/app/dashboard/loading.tsx`, `src/components/ui/skeleton.tsx:3-13`; no `loading.tsx` for `/more`, `/search`, `/invitations`, `/auth/login`, `/`
- What happens: Home's skeleton is a page title with a description and a full-width button, a 224 px block and three stat tiles; the real screen is an avatar greeting with two round buttons, a 290 px live card and no tiles, so everything shifts when it arrives. Routes without a loading file give no feedback between the tap and the server's answer (every page is rendered per request). Skeletons carry no status for screen readers.
- Why it matters: "the same shape, so nothing jumps" is the stated aim of the match skeleton; a tap on More or Search with no response reads as a missed tap on a slow network.
- Fix: shape the Home skeleton like `GreetingBar` + one `h-72` card + section title + cards; add a root `src/app/loading.tsx` (or one per route above); put `role="status"` with a visually hidden "Loading" on each loading root.
- Design reference: `/design#feedback` (Loading: "Skeletons shaped like the content")
- Evidence: code; a held navigation showed no change 1.2 s after the tap (`shots/N/loading-dashboard.phone.png`), which the dev server does not prefetch, so this is not proof for production
- Status: from code

### N33. The offline page talks only to scorers and does not look like the app

- Severity: low
- Where: `/offline.html` (served by the service worker for any page while offline); `public/offline.html`
- What happens: with nothing saved it reads "Open a match you've scored before on this device…" followed by "No matches are saved on this device yet." A follower gets no line that fits them. The card is bordered with 12 px corners and a square-cornered button, in the system font; dark follows the OS, not the theme chosen in the app.
- Why it matters: the first sentence asks for something the second says is impossible.
- Fix: lead with "You're offline. This page needs a connection." and show the scorer paragraph only above a non-empty list; pill button and `rounded-2xl` card without the border; read `cricket-ui-theme` for dark.
- Design reference: `/design#feedback` (Callouts: "You are offline"), `/design#foundations` (Radius)
- Evidence: `shots/N/offline.phone.light.anon.png`
- Status: seen on screen

### N34. The installed app opens on the sign-in wall for anyone signed out

- Severity: low
- Where: installed PWA; `src/app/manifest.ts:16`, `src/proxy.ts:15-21`
- What happens: `start_url` is `/dashboard`, which redirects a signed-out visitor to `/auth/login?redirect=/dashboard`. The landing page with live matches is at `/`.
- Why it matters: "Anyone can follow matches from a shared link", and a follower who installs the app is met by a sign-in screen they cannot pass.
- Fix: `start_url: "/"` (signed-in users are redirected to `/dashboard` on the server at no read; `id` already keeps the app's identity).
- Design reference: `/design#principles` ("One place, one name": Home)
- Evidence: `shots/N/anon-dashboard.phone.light.anon.png` (where `/dashboard` lands signed out)
- Status: from code

### N35. Section titles come in two sizes, and "See more" under Results opens the unfiltered list

- Severity: low
- Where: Home and More (20 px titles) against the landing page and Search (16 px); `src/components/ds/list.tsx:7-43` and `src/components/layout/page.tsx:132-181`, both exported as `SectionHeader`; `src/app/dashboard/page.tsx:204-214`
- What happens: the same kind of heading is `text-xl` on Home and `text-base` on the signed-out home. "See more" beside Results and beside Upcoming both go to `/matches`, which opens on All (its filter lives in component state, not the URL).
- Why it matters: two components with one name drift apart; "See more" should show more of what it sits beside.
- Fix: keep one `SectionHeader` (add `count` and `live` to the ds one, delete the other). Give the Matches list `?status=` and link `/matches?status=completed` and `?status=scheduled`.
- Design reference: `/design#content` (Section header), `/design#principles` ("What is on screen survives a reload")
- Evidence: `shots/N/dashboard.phone.light.2of3.png` against `shots/N/landing.phone.light.anon.2of2.png`
- Status: seen on screen

### N36. Invites page details

- Severity: low
- Where: `/invitations`, phone; `src/app/invitations/page.tsx:30`, `src/components/invitations/sent-invites-list.tsx:107-149` and `:187-191`, `src/components/invite-dialog.tsx:96`
- What happens: "Showing the latest 50." is shown above an empty list. The page's one action, "Invite", is a 36 px outline button. Tapping "Revoke" puts "Confirm revoke" in the same place under the finger. The empty card has no action and a blank band where one would be; its `h3` follows the `h1` directly. The list is a bordered box, not the floating card.
- Why it matters: a double tap on Revoke confirms it; the rest is polish.
- Fix: say "Showing the latest 50" only when 50 are listed; primary 44 px "Invite"; confirm revoke in the shared Dialog (or swap the order so "Keep invite" lands under the finger); pass the invite action to the empty state; `ListCard`.
- Design reference: `/design#feedback` (Empty state, dialog: safe choice first), `/design#content` (List rows)
- Evidence: `shots/N/invitations.phone.light.png`, `shots/N/invitations-list.phone.light.confirm.png`; axe `heading-order`
- Status: seen on screen

### N37. The sign-out warning is a browser confirm box

- Severity: low
- Where: More and the header menu, when scoring actions are still unsent; `src/lib/hooks/useAccount.ts:54-58`
- What happens: `window.confirm` with a four-sentence message. Without unsent actions sign-out is immediate, lands on `/` and says nothing.
- Why it matters: the one warning that protects unsent balls is the only dialog not drawn by the app, with OK / Cancel for a choice that needs named buttons; some in-app browsers suppress `confirm`.
- Fix: the shared Dialog: "2 scoring changes have not been sent", body in two short lines, buttons "Stay signed in" (first) and "Sign out anyway".
- Design reference: `/design#feedback` (dialog: "the safe choice first")
- Evidence: `shots/N/signout.phone.light.t3300.png` (plain sign-out); the warning from code
- Status: from code

### N38. On Android the tab bar rides on top of the keyboard

- Severity: low
- Where: any phone screen with a text field (Search, list search, create forms); `src/app/layout.tsx:59` (`interactiveWidget: "resizes-content"`), `src/components/layout/mobile-tab-bar.tsx:22`
- What happens: with `resizes-content` the layout viewport shrinks when the keyboard opens, so the fixed tab bar (about 80 px with its margin) sits directly above the keyboard and takes that much of the space left for results.
- Why it matters: on a 640 px tall phone roughly 300 px remain above the keyboard; the bar takes a quarter of it while typing.
- Fix: hide the tab bar while a text field has focus and the visual viewport is shorter than the window (`ViewportVars` already publishes `--vvh`), for example a `data-keyboard` attribute on the root that the bar's wrapper reads.
- Design reference: Principle "A form is a task" (/design#principles) for forms; elsewhere follow the Fix.
- Evidence: code only; the headless browser has no on-screen keyboard
- Status: from code

### N39. No side safe-area padding in landscape

- Severity: low
- Where: phones with a notch held sideways (at 768 px and wider they get the tablet shell); `src/components/layout/app-shell.tsx:73`, `src/components/layout/app-sidebar.tsx:77`, `src/components/navigation-bar.tsx:67`
- What happens: the page uses `viewportFit: "cover"` and pads only top and bottom with safe-area insets. The fixed sidebar starts at `left-0` and the header at `px-3`, so their first 45 to 60 px lie under the notch or the rounded corner.
- Why it matters: the sidebar icons and the sidebar toggle are partly hidden on the notch side.
- Fix: add `pl-[env(safe-area-inset-left)]` / `pr-[env(safe-area-inset-right)]` to the header, the sidebar (and its width offset on `main`) and the content gutter.
- Design reference: `/design#foundations` (Spacing)
- Evidence: code only (no notch in the headless browser); layout at 844x390 in `shots/N/dashboard-landscape.phone.light.png`
- Status: from code

#### Covered

- `/` signed out: phone, small, desktop, dark (phone); with Firestore unreachable (phone). Signed in: redirect to `/dashboard`.
- `/auth/login` signed out: phone, small, desktop, dark; `?invite=` (short and long email), `?error=` variants, `?redirect=`; refused sign-in on desktop (popup) and phone (redirect); a first sign-in of an invited account on phone with the session request slowed; signed in: redirect.
- `/dashboard`: John (phone, small via the new user, tablet 820 and 768, phone landscape 844x390, desktop, dark phone and desktop), David (phone), a brand-new invited account (phone 320 and 390, desktop); with Firestore unreachable; live carousel, upcoming, following (empty), results, greeting and its buttons, Get started.
- `/more`: signed in and signed out, phone and desktop, small, dark; long name; Invite someone dialog (open, empty, bad email, success); sign-out (throwaway account).
- `/search`: empty, `?q=john`, `strikers`, `ri`, no results, one letter; phone, small, desktop, dark; header search on desktop (one letter, Enter).
- `/invitations`: empty and with a pending invite (resend, revoke confirm), phone, small; signed out (redirect).
- Shell: phone tab bar (lit tab on every kind of page, 320 px), desktop header (user menu, Create, theme menu), sidebar expanded and collapsed, tablet header and menu sizes, footer; detail-page shell on phone (match, player, team, club, tournament: Back, title, lit tab, pinned strip on scroll) and desktop / tablet (`PageTrail`).
- Back and titles: Home › match › player › Back › Back; Home › Search › query › player › Back › Back; Back on pages opened directly (labels and targets); titles of 26 routes.
- Not found and errors: unknown URL (signed in and out), bad and unknown match id, unknown player / team / club / tournament, the error screen (through the tournament crash and the sign-in parameter crash), `public/offline.html`.
- Signed out on `/dashboard`, `/invitations`, `/matches/create`, `/teams/create`, `/clubs/create`, `/tournaments/create`.
- Theme: light, dark, stored dark on first paint, the three switches (More, header menu).
- Keyboard: tab order through header and sidebar, focus rings, Enter on a focused link; focus after navigation (stays on `body`; Next announces the title).
- From code: install prompt (`install-app.tsx`, `install-prompt.ts`), "New version available" toast (`service-worker-registrar.tsx`), notification settings (`push-settings.tsx`), `loading.tsx` files, `in-app-history.ts`, `navigation.ts`, `proxy.ts`, `manifest.ts`.

Data I added to the emulator (nothing seeded was changed or removed): one invite from John to `uxaudit.n@example.com`, now accepted, and that account's profile "Venkataraghavan Srinivasaraghavan-Balasubramaniam" (`@venkataraghavan_sriniv`), which now appears on Players and in search. It is useful for long-name checks. Two refused sign-ins left no account behind. David followed and unfollowed Riverside Titans (back to not following).

#### Not covered

- Install prompt, iOS "Add to Home Screen" hint, "New version available" toast, notification permission UI: not reachable on the dev server (no service worker or push on localhost, headless browser has no install prompt). Judged from code; N12 and N29 carry what I found.
- `loading.tsx` on screen: the dev server does not prefetch, so a held navigation shows the old page, not the skeleton. Judged from code (N32).
- Safe-area insets, the on-screen keyboard, iOS standalone mode: not simulated by the headless browser (N12, N38, N39 are from code).
- `src/app/error.tsx` in a production build (the wording Next.js substitutes for server errors): not seen, dev only.
- Screen reader output: not run; heading, landmark and name checks came from the audit and axe.
- Content of the detail pages, lists, create forms and the scoring screen: other reviewers' areas. I looked only at their shell. Two things outside my area that I ran into are in the file because they block the screens I was on: N1 (tournament crash) and N6 (missing match).

## M. Matches list, match page and report

Screenshots: `shots/M/`.

### M1. A long title in a phone screen's top bar runs under the action buttons

- Severity: medium
- Where: every detail screen whose `ScreenBar` has a title and actions; seen on `/matches/<id>` at 390 and 320 px; `src/components/ds/screen.tsx:64` (grid) and `:89` (`min-w-0` on the actions)
- What happens: "Strikers vs Warriors - Championship Opener" is not cut with an ellipsis. It runs on under the Share and ⋯ buttons, and a stray letter shows in the gap between them. The grid is `1fr / minmax(0,auto) / 1fr` and the actions wrapper has `min-w-0`, so with a long title the right track shrinks to nothing and the buttons overflow back over the text.
- Why it matters: the name of the screen is half covered on the first thing people read, and it looks broken.
- Fix: keep the side tracks at least as wide as their content: `grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)]` and drop `min-w-0` from the actions wrapper. The `truncate` on the `h1` then does its job. Add a test with a 60-character title and two actions.
- Design reference: /design#spec-long-title; principle "A name is the last thing to be cut" (/design#principles)
- Evidence: `shots/M/m1-small.small.light.sheet1.png`, `shots/M/m1-summary.phone.light.sheet.png`
- Status: seen on screen

### M2. Match cards in lists never name the competition, and Home files tournament fixtures under "Friendly matches"

- Severity: medium
- Where: `/matches`, `/dashboard`, `/`; `src/components/matches/match-card.tsx:96` (`match.tournament?.name ?? match.club?.name`), `src/lib/firebase/team-snapshot.ts:178` (`attachMatchTeams` sets teams only), `src/app/dashboard/page.tsx:55`
- What happens: the card header shows only "T20 · 20 overs". The list rows carry `tournament_snapshot` and `club_snapshot`, but nothing copies them to `match.tournament` / `match.club`, which is what the card reads. On Home the seeded championship semi-final is grouped under "Friendly matches" for the same reason.
- Why it matters: two results between the same sides cannot be told apart, and a league fixture is labelled a friendly.
- Fix: fall back to the snapshots where the embed is absent (one helper, for example `competitionNameOf(match)` in `~/lib/cricket`, used by the card and by Home's grouping). No extra reads.
- Design reference: /design#spec-result-date; /design#cricket (Match lists)
- Evidence: `shots/M/matches.phone.light.sheet.png`, `shots/smoke/dashboard.phone.light.png`
- Status: seen on screen

### M3. A fixture more than three hours past its start time is in no list on Matches

- Severity: medium
- Where: `/matches`, all filters; `src/app/matches/match-list.ts:28` (`UPCOMING_GRACE_MS`) and `:47`
- What happens: the two seeded fixtures (start times in the past, never started) appear under no filter. "Upcoming" says "No upcoming matches on the schedule". Home still lists the same fixture as upcoming (N10 is the other side of this).
- Why it matters: a match that starts late (rain, a late team) drops off the list the moment people go looking for it, and its scorer has to find it through the tournament or Home.
- Fix: decide one rule for a fixture whose time has passed and use it on both screens. Suggested: keep it in Upcoming for its scorers and its club's members until it starts or is cancelled, marked "Not started" with the time it was due; for everyone else keep the grace period but make it a day, not three hours.
- Design reference: /design#spec-fixture-late
- Evidence: `shots/M/matches-filters.phone.light.sheet1.png` (upcoming tile)
- Status: seen on screen

### M4. Results and live cards carry no date, and neither does the match header

- Severity: medium
- Where: `/matches`, `/dashboard` Results; the match page header; `src/components/matches/match-card.tsx:158` (competition line), `src/components/matches/match-hero.tsx`
- What happens: a finished match shows scores and the result but not when it was played. On the match page the date is only inside the folded "Match details".
- Why it matters: a result from last season reads the same as this morning's. Sports apps put the date on every result row.
- Fix: put the short date ("Sat 10 Aug", `matchStart`) in the card's header line for finished matches, and under the competition line of the match hero for finished and upcoming matches.
- Design reference: /design#spec-result-date
- Evidence: `shots/M/matches.phone.light.sheet.png`, `shots/M/m1-summary.phone.light.sheet.png`
- Status: seen on screen

### M5. The Matches filter and status tabs are lost on reload and Back, and the box is not the shared list search

- Severity: medium
- Where: `/matches`, all viewports; `src/app/matches/page.tsx:35` (state), `:126` (the `Input`)
- What happens: the status filter and the text filter are React state. Reload, Back from a match, or sharing the link returns "All matches" with an empty box. The box is a hand-built `Input` (36 px high, no `type="search"`, no form), not `ListSearch`.
- Why it matters: breaks "What is on screen survives a reload" and "every list has `ListSearch`" (AGENTS.md, Navigation). Someone who filtered to Results, opened one and came back has to filter again.
- Fix: keep both in the URL (`?status=`, `?search=`) with `setUrlParam`, and use `ListSearch`.
- Design reference: /design#controls (Tabs and filters), principle "What is on screen survives a reload".
- Evidence: `shots/M/matches-filters.phone.light.sheet1.png`
- Status: seen on screen (filter), from code (reload)

### M6. The Matches error and empty states are generic

- Severity: low
- Where: `/matches`; `src/app/matches/page.tsx:147` (error), `:163` (empty)
- What happens: a failed read prints the raw error message in red. Every empty filter shows the live "radio" icon and the title "No matches found"; "All" says "No matches match the selected criteria."
- Why it matters: a raw message tells a spectator nothing (same family as N6, N7). The live icon on an empty Upcoming list is the wrong picture.
- Fix: error: "Could not load matches. Check your connection and try again." with the Try again button (log the detail). Empty: title and icon per filter ("Nothing live right now", "No fixtures scheduled", "No results yet").
- Design reference: /design#spec-could-not-load; /design#feedback (Empty state)
- Evidence: `shots/M/matches-filters.phone.light.sheet1.png`
- Status: seen on screen (empty), from code (error)

### M7. At 320 px the batting table truncates names and stacks dismissals one word per line

- Severity: medium
- Where: `/matches/<id>?tab=scorecard`, `small` viewport; `src/components/ds/scorecard.tsx:211` (name), the dismissal toggle at `:378`
- What happens: with five figure columns the name column is about 110 px: "David Bro…", "Tom Garc…", and "c Kevin Taylor b James Anderson" wraps into five lines. At 390 px it is fine.
- Why it matters: 320 px phones (iPhone SE, small Androids) get a scorecard where names are cut and rows are tall and ragged.
- Fix: below 360 px let the dismissal take its own full-width row under the name and figures, and drop the strike-rate column (it is in Stats). Keep 390 px as it is.
- Design reference: /design#cricket (Scorecard); principle "A name is the last thing to be cut" (/design#principles). No 320 px specimen: follow the Fix.
- Evidence: `shots/M/m1-small.small.light.sheet1.png` (scorecard2 tile)
- Status: seen on screen

### M8. Top performers rows cut off the figures to make room for the team name

- Severity: low
- Where: `/matches/<id>?tab=stats`, phone; `src/components/matches/match-superstars.tsx:118`
- What happens: "Metropolitan Strikers · 52 (34) · 1…", "Riverside Warriors · 40 (28) · 1/29 (…". The full team name comes first, so what the player did is what gets truncated.
- Why it matters: the figures are the reason for the row.
- Fix: put the figures first and the team short code after ("52 (34) · 1 ct · STR"), or wrap to two lines on phones.
- Design reference: /design#cricket (Points table and leaderboard, `RankList`).
- Evidence: `shots/M/m1-stats.phone.light.sheet.png`
- Status: seen on screen

### M9. Small tap targets on the match page

- Severity: low
- Where: match page, phone; dismissal toggles in the batting table 24 to 32 px high (`src/components/ds/scorecard.tsx:378`), "Show all N moments" 36 px (`src/components/matches/match-summary.tsx:389`), the Stats team filter 32 px and "How points work" 36 px, the Stats jump bar buttons 36 px
- What happens: these are under the 44 px the rest of the page keeps.
- Why it matters: WCAG 2.5.8 asks for 24 px at least, Apple and Material for 44 to 48; the dismissal toggle sits at the minimum with other toggles right above and below it.
- Fix: make the whole batter row the toggle for its dismissal detail, and give the others `min-h-11` on phones.
- Design reference: /design#spec-touch-sizes; principle "44 px to tap" (/design#principles)
- Evidence: audit output of `m1-scorecard`, `m1-summary`, `m1-small`
- Status: seen on screen

### M10. Squads tab: "Player" under every name, "Vice Captain" in title case, bare "#7"

- Severity: low
- Where: `/matches/<id>?tab=squads`; `src/components/matches/match-squads.tsx:49` and `:54`
- What happens: each row has a subtitle with the squad role, which for most is just "Player". Roles read "Vice Captain", "Wicket-keeper". The shirt number is a bare "#7" at the right edge.
- Why it matters: AGENTS.md: captain and keeper are "(c)" / "(wk)" after the name, labels are sentence case. Eleven rows that say "Player" are noise, and they double the height of the list.
- Fix: show "(c)", "(vc)", "(wk)" after the name, drop the subtitle when the role is plain player, and either label the number ("Shirt 7" for screen readers) or drop it.
- Design reference: /design#content (List rows: "Arjun Mehta (c)").
- Evidence: `shots/M/m1-balls-squads.phone.light.sheet1.png`
- Status: seen on screen

### M11. Match page headings skip levels

- Severity: low
- Where: match page; `src/components/matches/match-summary.tsx:142` (`h4`), `:350` (`h3`), Scorecard and Stats sections (`h3`)
- What happens: the page goes from the `h1` straight to `h4` ("Top batters") and `h3` sections; there is no `h2`.
- Why it matters: screen reader users move by heading level; a skipped level reads as missing content (WCAG 1.3.1, advisory).
- Fix: tab sections `h2`, cards inside them `h3`.
- Design reference: Principle "One h1, and no level skipped" (/design#principles)
- Evidence: audit output of `m1-summary`
- Status: seen on screen (audit)

### M12. The extras line breaks before its last figure

- Severity: low
- Where: Scorecard, phone; `src/components/ds/scorecard.tsx` (extras row)
- What happens: "Extras (b 2, lb 4, wd 6, nb" / "2)".
- Why it matters: a lone "2)" on its own line.
- Fix: `text-wrap: balance` or non-breaking spaces inside each pair ("nb 2"), and let the breakdown use the full row width under the label.
- Design reference: /design#cricket (Scorecard).
- Evidence: `shots/M/m1-scorecard.phone.light.sheet.png`
- Status: seen on screen

### M13. On phones the match page's ⋯ opens a desktop dropdown, where every other detail page opens the actions sheet

- Severity: medium
- Where: `/matches/<id>`, phone; `src/components/matches/match-more-menu.tsx:145` (a `DropdownMenu` at every width). Club, team, player and tournament pages use `ActionsSheet` (`src/components/ds/actions-sheet.tsx`)
- What happens: a small menu drops from the ⋯ button with 32 px rows; "Delete match" sits one row under "Reschedule" / "DLS calculator". The other four detail pages open a bottom sheet with full-width buttons.
- Why it matters: one job, two patterns (AGENTS.md: "on phones a detail page's actions are its one main action in the bar plus `ActionsSheet`"). The rows are small for a thumb, and the destructive item is easy to hit by mistake (it does ask for the title, so the cost is a wasted dialog).
- Fix: below `md` render the same items in `ActionsSheet`, with Delete match last and set apart; keep the dropdown from `md` up.
- Design reference: /design#detail-pages (Actions sheet); principle "Phone actions open the sheet" (/design#principles)
- Evidence: `shots/M/menus-live.phone.light.sheet1.png` (menu tile), `shots/M/menus-other.phone.light.sheet1.png`
- Status: seen on screen

### M14. Match dialogs: one is titled "Club", and titles are centred in some and left-aligned in others

- Severity: low
- Where: phone; `src/components/matches/match-club-dialog.tsx:199` (title), `src/components/matches/reschedule-match-dialog.tsx:125` (`text-left`), `src/components/ui/dialog.tsx:88` (default: centred on phones)
- What happens: the menu item says "Change club" and the dialog it opens is headed "Club". "Reschedule match" is left-aligned while Match scorers, DLS calculator, Delete match and Club are centred. "Reschedule match" also edits the venue and umpires.
- Why it matters: a dialog title should repeat the action that opened it; mixed alignment looks unfinished.
- Fix: title "Change club" / "Add to a club" to match the menu item; drop the `text-left` override (or make left the default everywhere); rename the item and dialog "Change date, venue or umpires" or split the umpires out.
- Design reference: /design#spec-choice-dialog
- Evidence: `shots/M/menus-other.phone.light.sheet1.png`, `shots/M/menus-live.phone.light.sheet1.png`
- Status: seen on screen

### M15. The match report scrolls sideways by a few pixels on a phone

- Severity: low
- Where: `/matches/<id>/report`, 390 px; `src/app/matches/[id]/report/` and `src/components/report/`
- What happens: the page is 396 px wide in a 390 px window, so it drifts sideways when scrolled. The toolbar buttons (Share PDF, Share link, Print, Close) are 36 px high.
- Why it matters: a sideways wobble on a 12,000 px long page, and the report is what people share.
- Fix: find the element 6 px too wide (likely a table or a `.report-page` with fixed padding) and give it `min-w-0` / `max-w-full`; toolbar buttons `h-11` on phones.
- Design reference: none needed
- Evidence: audit of `report` (`scrollWidth 396 > 390`), `shots/M/report.phone.light.sheet.png`
- Status: seen on screen (audit)

### M16. Head to head cuts the team names to five letters, and past-meeting cards cut the date

- Severity: low
- Where: match page, upcoming Summary and Stats → Head to head, phone; `src/components/matches/head-to-head.tsx`
- What happens: under the two win counts the names read "Strik…" and "War…". The header line of a past meeting reads "East Coast Cricket Championship 2024 · 20 Jul 2…".
- Why it matters: the crests beside the numbers already say STR and WAR, so the cut names add nothing; the date is the one part of the header that must not be cut.
- Fix: drop the names under the counts (or show the short codes); in the card header keep the date whole and truncate the competition name.
- Design reference: /design#cricket (Match lists).
- Evidence: `shots/M/states-anon.phone.light.anon.sheet1.png` (sched6-anon-2 tile)
- Status: seen on screen

### M17. An upcoming match's header gives the day without the year and still says "Upcoming" after the day has passed

- Severity: low
- Where: `/matches/<id>` for a scheduled match; `src/components/matches/match-hero.tsx:281` (`start?.date`), `scheduledTime`
- What happens: "19:30 Upcoming · Saturday 10 August" for a fixture dated August 2024, seen in November 2026.
- Why it matters: the reader cannot tell this was due two years ago (see M3 for the list side of the same gap).
- Fix: add the year when it is not the current one; once the start time has passed, replace "Upcoming" with "Not started" and say "Was due Sat 10 Aug 2024, 19:30".
- Design reference: /design#spec-fixture-late; /design#spec-dates
- Evidence: `shots/M/states-anon.phone.light.anon.sheet1.png` (sched6-anon tile)
- Status: seen on screen

### M18. The live panel says "This over: yet to start" whenever it has no balls to show

- Severity: low
- Where: match page, Live tab; `src/components/matches/match-live-panel.tsx:212`
- What happens: with the live document missing or not yet loaded, a match at 13.4 overs reads "This over: yet to start" under a bowler shown with 2.4 overs.
- Why it matters: it states something untrue for a moment on every load, and for good when the live document is absent.
- Fix: show the line only when the live data is loaded and the over really has no ball (ball 0 of the over); otherwise leave the row out or show its skeleton.
- Design reference: Principle "Could not load is not empty" (/design#principles)
- Evidence: `shots/M/m3-live-scorer.phone.light.sheet.png`
- Status: seen on screen (seeded match without a live document), from code (the loading case)

### M19. On wide screens single-column lists on the match page stretch edge to edge

- Severity: low
- Where: match page, desktop 1440 px: Top performers in Stats, the Player of the match row in Summary; `src/components/matches/match-superstars.tsx`, `src/components/matches/match-summary.tsx`
- What happens: a player's name sits at the left edge and their figure about 1,000 px away at the right edge.
- Why it matters: the eye has to travel the whole screen to pair a name with its number.
- Fix: cap these lists at a reading width (`max-w-3xl`) or lay Top performers out in two columns from `lg`.
- Design reference: /design#cricket (Points table and leaderboard).
- Evidence: `shots/M/d-m1.desktop.light.stats.png`, `shots/M/d-m1.desktop.light.summary.png`
- Status: seen on screen

#### Covered

- `/matches`: phone (all four filters, empty search), desktop, signed in
- Match page, finished (match 1): Summary, Scorecard, Balls, Stats, Squads on phone; Summary, Scorecard, Stats at 320 px; Summary, Scorecard, Stats on desktop; Summary, Scorecard, Balls in dark
- Match page, live (3 as scorer, 5 signed out), upcoming (6 signed out and as scorer, Squads), tied (8), phone; live on desktop and in dark
- ⋯ menu on live, upcoming and finished matches; Match scorers (scorers part), DLS calculator, Delete match, Reschedule, Change club dialogs; share menu, phone
- Match report on a phone; match Players page with the Replace panel open
- `/design/match?state=break`

#### Not covered

- The summary image and the PDF themselves (the buttons were seen, the files were not opened)
- Print layout of the report
- The club suggestion card (no seeded finished match without a club)
- Seed artefacts, not reported: live cards show "Run rate" instead of the chase and the Balls tab numbers a wide as its own ball, both because the seeded live matches have no live document and seeded balls are numbered by delivery

## P. Teams and players

Screenshots: `shots/P/`.

### P1. The team page's Add player box breaks the app's own rules for adding people

- Severity: medium
- Where: `/teams/<id>?tab=squad` → Add player, all viewports; `src/components/teams/add-player-dialog.tsx:150` (create button), `:172` (result rows)
- What happens: typing "mi" puts "Add "mi" as a new player" first, as the widest and most coloured thing in the dialog, above the people found. The two people found (Chris Miller, Mike Wilson) are already in this squad, and are offered with an add icon and no reason. The rows are hand-built: a one-letter grey avatar, the handle in a monospace font, no "42 matches" or "Club member" line.
- Why it matters: /design principles "Creating is a separate choice from picking" (list what exists first) and "Nobody disappears without a reason" (someone who cannot be used says why). This is the path that makes duplicate players, which split a person's stats. Tapping someone already in the squad ends in an error toast.
- Fix: list the found people first with the shared row (`Avatar`, `foundPlayerHint`, `whyNotAddable` → "Already in Metropolitan Strikers", disabled), then `PlayerSearchNote`, then the create button last and quieter, as `PlayerPicker` and `QuickPlayers` do.
- Design reference: /design#spec-add-player; /design#principles ("Creating is a separate choice from picking", "Nobody disappears without a reason")
- Evidence: `shots/P/team-actions.phone.light.sheet1.png` (add-player-typed tile)
- Status: seen on screen

### P2. A player's Batting and Bowling tables are 750 px wide on a phone, with nothing to say they scroll

- Severity: medium
- Where: `/players/<id>?tab=batting` (and bowling), phone; `src/components/players/player-activity-tabs.tsx:340` and `:458` (`overflow-x-auto`, three columns at `min-w-[180px]`)
- What happens: the table shows Match, Runs, Balls, SR, 4s and half of "6s"; Dismissal and Result are off the right edge. No fade, no hint.
- Why it matters: how the player got out and whether the side won are invisible unless someone thinks to drag the table sideways.
- Fix: on phones show each innings as a two-line row (opponent and date; then "15 (14) · 2 fours · run out · won by 16 runs"), keeping the table from `md` up. Or fold Dismissal and Result into the first column's second line.
- Design reference: /design#cricket (Player profile). No specimen of the phone row: follow the Fix.
- Evidence: `shots/P/player-tabs.phone.light.sheet1.png` (batting tile)
- Status: seen on screen

### P3. Recent form and Best batting label every innings "Match"

- Severity: medium
- Where: `/players/<id>` Stats tab; `src/components/players/recent-form.tsx:36`, `src/components/players/player-milestones.tsx:41`, `src/lib/recent-form.ts:39`
- What happens: each Recent form tile reads "52 / 34 balls / Match". The match documents are not loaded on the Stats tab (they load when a listing tab opens), so the title is missing and the fallback word shows.
- Why it matters: the third line is there to say which game it was, and says nothing.
- Fix: take the label from what the player's own record already holds (the date and the opponent's short name: "v WAR · 20 Jul"), and leave the line out when neither is known. No extra reads.
- Design reference: /design#cricket (Player profile).
- Evidence: `shots/P/player-anon.phone.light.anon.sheet.png` (mike2 tile)
- Status: seen on screen

### P4. A player's Stats tab repeats the same figures two or three times and gives a non-bowler a screen of zeros

- Severity: low
- Where: `/players/<id>` Stats tab, phone; `src/components/players/season-statistics.tsx` and `player-milestones.tsx`
- What happens: Matches shows in the top tiles and in Batting; fifties and hundreds in Batting and again in Milestones; five-wicket hauls in Bowling and again in Milestones. A batter who has never bowled gets a Bowling card of a zero and two dashes, a Fielding card of three zeros and a Milestones card of four zeros and a dash: about a screen and a half of empty tiles.
- Why it matters: the page is three screens long for a player with two matches, and most of it is noise.
- Fix: show a discipline's card only when it has something in it (as the tabs already do), and keep each figure in one place (milestones keep bests only).
- Design reference: /design#principles ("Offer only the tabs that have something in them"), /design#cricket (Player profile).
- Evidence: `shots/P/player.phone.light.sheet.png`
- Status: seen on screen

### P5. Dates come in three formats

- Severity: low
- Where: player Batting / Bowling tables "Jul 20, 2024" (`src/components/players/player-activity-tabs.tsx:168`, `en-US`); match cards "Sat 10 Aug"; match details "Saturday, 10 August 2024, 19:30"; head to head "20 Jul 2024"
- What happens: the month-first American order appears on one screen only.
- Why it matters: 10/08 and 08/10 confusion is the classic date mistake; one app should have one order.
- Fix: one helper for a short date ("20 Jul 2024", with the weekday where there is room) in `~/lib/cricket` or a small `~/lib/dates`, used everywhere; drop the `en-US` call.
- Design reference: /design#spec-dates; principle "One date, one way to write it" (/design#principles)
- Evidence: `shots/P/player-tabs.phone.light.sheet1.png` (batting tile)
- Status: seen on screen

### P6. On phones the team record tiles do not add up

- Severity: low
- Where: `/teams/<id>`, phone; the compact stat row in `src/app/teams/[id]/page.tsx` (desktop shows "1 tied or no result" under Played)
- What happens: "Played 3 · Won 2 · Lost 0 · Win rate 100%". The tied match is counted in Played and nowhere else; the note that explains it is dropped in the compact row.
- Why it matters: the numbers look wrong.
- Fix: when a side has ties or no-results, show them as their own compact tile ("Tied / NR 1") in place of Win rate, or keep the note under Played.
- Design reference: /design#detail-pages (Figures above tabs).
- Evidence: `shots/P/team.phone.light.sheet.png`, `shots/P/d-team.desktop.light.png`
- Status: seen on screen

### P7. Squad roles are written three ways, and "Player" sits under every other name

- Severity: low
- Where: team Squad tab ("Captain (c)", "Wicket-keeper (wk)", "Vice-captain (vc)", "Player"), match Squads tab ("Vice Captain", "Wicket-keeper", "Player"; M10), the team header ("Mike Wilson (c) · Ryan Martinez (vc)"); `src/app/teams/[id]/page.tsx` squad rows, `src/components/matches/match-squads.tsx:49`
- What happens: the same role is spelled differently on each screen, and the word plus its abbreviation are both shown on the team page.
- Why it matters: AGENTS.md: captain and keeper are "(c)" / "(wk)". Rows that say "Player" add height and no information.
- Fix: one `formatPlayerRole` output used by both: the name followed by "(c)", "(vc)" or "(wk)", no subtitle for a plain player.
- Design reference: /design#content (List rows).
- Evidence: `shots/P/team-actions.phone.light.sheet1.png` (row-menu tile), `shots/M/m1-balls-squads.phone.light.sheet1.png`
- Status: seen on screen

### P8. In a squad only the 20 px name is a link, and the role menu does not show the current role

- Severity: low
- Where: `/teams/<id>?tab=squad`, phone; squad rows in `src/app/teams/[id]/page.tsx`
- What happens: the tap target that opens a player is the name text, 20 px high; the rest of the row does nothing. The row's ⋯ menu offers "Make wicket-keeper" to the player who already is the keeper, with no tick on the current role.
- Why it matters: rows on a phone are expected to be tappable as a whole; a menu of roles that hides the current one invites a needless tap.
- Fix: make the row (avatar and text) the link, as `ListCard` rows are elsewhere; in the menu use radio items for the role with the current one checked.
- Design reference: /design#spec-row-actions; /design#spec-touch-sizes
- Evidence: audit of `team-squad` (`201x20 <a> "Mike Wilson"`), `shots/P/team-actions.phone.light.sheet1.png`
- Status: seen on screen

### P9. Username or handle: the same thing has two names, and its dialog is in title case and monospace

- Severity: low
- Where: player page ⋯ → "Edit handle"; `src/components/players/` username dialog
- What happens: the sheet button says "Edit handle" in a bold monospace face; the dialog is titled "Choose a username", the field is "Username handle", the rules are "Handle Rules:", the button is "Save Handle", and one rule reads "Globally unique across the cricket platform".
- Why it matters: one thing, one name ("One place, one name" in /design applies to wording too); AGENTS.md asks for sentence case and plain copy.
- Fix: call it "username" everywhere: "Change username", "Username", "Save username", rules in plain words ("Nobody else can have the same username"). Use the normal font; keep `@` as a prefix.
- Design reference: /design#controls (Fields).
- Evidence: `shots/P/player-edit.phone.light.sheet.png`, `shots/P/player-tabs.phone.light.sheet1.png` (actions tile)
- Status: seen on screen

### P10. Small inconsistencies on the player and team headers

- Severity: low
- Where: `/players/<id>`, `/teams/<id>`, phone
- What happens: (a) the team chip on a player's header has a one-letter crest ("S") where every other crest is the short code ("STR"); (b) a signed-in player sees their own email in their header with nothing to say only they can see it; (c) the team header carries two chips, the short name ("Strikers") and "Club", beside a title and crest that already say both; (d) the Season select and the team chip are 32 to 36 px high.
- Why it matters: small, but each makes someone stop: is my email public, what is "Club".
- Fix: (a) `TeamCrest` in the chip; (b) "Only you can see this" beside the email, or move it to the ⋯ sheet (AGENTS.md: contact details go there); (c) drop the short-name chip, and make the club chip the club's name linking to it; (d) `min-h-11` on phones.
- Design reference: /design#cricket (Player profile, Team crests and avatars).
- Evidence: `shots/P/player.phone.light.sheet.png`, `shots/P/team.phone.light.sheet.png`
- Status: seen on screen

#### Covered

- `/teams` (mine, all, empty search), `/players`, phone
- `/teams/<id>`: Matches and Squad tabs, the row menu, Add player (typed), the team actions sheet on phone; Squad on desktop
- `/players/<id>`: own profile (Stats, Batting, Matches, Teams, actions sheet, Edit profile, Edit handle with a taken name), another player signed out (with a live innings), phone; own profile on desktop (shot taken, nothing to add)

#### Not covered

- Edit team dialog, Share squad, the merge and claim-email dialogs for placeholder players (no placeholder in the seed)
- Bowling tab (the seeded user has no bowling; same table as Batting)
- `/teams/create` (covered with the create flows, area F)

## T. Clubs and tournaments

Screenshots: `shots/T/`. The tournament page was seen as a plain club member and signed out only: for its organiser it crashes (N1), so the organiser's controls on it are not reviewed.

### T1. On a phone the club's Members list cuts every name to one to three letters

- Severity: high
- Where: `/clubs/<id>?tab=members` as the club owner, 390 px; `src/app/clubs/[id]/(detail)/page.tsx:302` to `:345`
- What happens: the rows read "A…", "Ry…", "Da…", "Lis…", "Bo…". The role badge, "Make admin" and the remove button are `shrink-0` on one line with the name, which gets what is left: about 30 px. The avatar shows one letter. On desktop the names are whole.
- Why it matters: the owner cannot tell which member a row is, on the screen where they promote and remove people. Removing or promoting the wrong person is one tap away.
- Fix: on phones give the name the full first line, the badge and "Joined" the second, and move Make admin / Remove into a row ⋯ menu (as the team squad rows do), or let the actions wrap under the name. Two-letter initials with `Avatar`.
- Design reference: /design#spec-row-actions; principle "A name is the last thing to be cut" (/design#principles)
- Evidence: `shots/T/club-tabs.phone.light.sheet2.png` (members, members2 tiles); desktop `shots/T/d-club-members.desktop.light.png`
- Status: seen on screen

### T2. Opening a costly tab from further down the page throws you back to the top of the screen

- Severity: medium
- Where: club page (Matches, Stats, Members) and tournament page (Fixtures, Teams, Stats) on phones; `src/components/ui/on-demand-tabs.tsx:55` (`open`), `:91` (`TabSkeleton`)
- What happens: with the tabs pinned, tapping Hall of fame (a cheap tab) opens it at its top under the pinned tabs. Tapping Matches, Stats or Members lands at the very top of the page: the header, the figures and the tabs fill the screen and the new tab's content is below the fold. The costly tab first renders a three-row skeleton, the page becomes shorter than the scroll position, the browser clamps to the top, and nothing moves it back when the content arrives.
- Why it matters: every tab change on a long club or tournament page costs a scroll, and two tabs in the same bar behave differently. AGENTS.md: "a tab changed from further down opens at its top".
- Fix: keep the panel's height while it loads (a `min-height` of the viewport on the on-demand panel) and run `settleUnderPinnedTabs` when the content arrives, as `Tabs` does for cheap tabs.
- Design reference: /design#principles ("Long screens keep their tabs in reach").
- Evidence: `shots/T/club-tabs.phone.light.sheet1.png` (matches, stats tiles against the hof tile in sheet2), `shots/T/tourn-tabs.phone.light.sheet1.png` (teams tile)
- Status: seen on screen

### T3. The tournament header shows its dates as "2024-07-15 to 2024-08-30"

- Severity: medium
- Where: `/tournaments/<id>`, all viewports; the header `meta` in `src/app/tournaments/[id]/(detail)/layout.tsx`
- What happens: raw ISO dates in the header; the tournaments list writes the same dates as "15 Jul 2024 to 30 Aug 2024".
- Why it matters: database notation on the main screen of a competition (see P5 for the other formats in use).
- Fix: the shared short-date helper: "15 Jul to 30 Aug 2024".
- Design reference: /design#spec-dates
- Evidence: `shots/T/tourn.phone.light.sheet.png`
- Status: seen on screen

### T4. The qualification calculator tells a team with no games left that it "Needs 1 win"

- Severity: medium
- Where: tournament → Points table → Qualification calculator; `src/components/tournaments/qualification-calculator.tsx:82`
- What happens: Metropolitan Thunder: "Remaining: 0 gms · Max Possible: 2 pts · Scenario: Needs 1 win and strong NRR to qualify." The text is built from points alone and falls back to "1 win" when no points are needed. The grid uses "pl", "gms", "Max Possible", and wraps "(2 / pl)". The button says "Qualification calculator", the dialog "Qualification & cutoff calculator".
- Why it matters: it states something impossible, on the screen people open to find out what their team needs.
- Fix: branch on remaining matches: none left and level on points → "Level on points: goes through on net run rate only"; none left and behind → eliminated; otherwise "Needs N wins from M games". Write the labels in full ("Played 2", "2 games left", "Most it can reach: 8 points"). One name for the dialog.
- Design reference: /design#spec-qualification
- Evidence: `shots/T/tourn-tabs.phone.light.sheet1.png` (qualcalc tile)
- Status: seen on screen

### T5. Header chips run under the crest, and seasons are managed from chips with a 24 px delete button

- Severity: low
- Where: club and tournament headers, phone; `src/app/clubs/[id]/(detail)/layout.tsx:263` to `:285`, `ProfileHeader` labels
- What happens: the chip row is cut by the round crest ("2024 Championship Se", "M…"). On the club header each past season is a chip with a 24 px bin inside it for admins; the row scrolls sideways, so that bin can sit half under the crest.
- Why it matters: cut-off chips look broken; a delete control inside a chip in a scrolling row is easy to hit and hard to see.
- Fix: end the chip row before the crest (or put the crest above it on phones) with the usual fade; show at most the current season as a chip and move season management (list, add, delete) into Club settings or a "Seasons" sheet.
- Design reference: /design#detail-pages (Club); principle "44 px to tap" (/design#principles) for the delete control. No specimen of the overflowing chips: follow the Fix.
- Evidence: `shots/T/club.phone.light.sheet.png`, `shots/T/tourn.phone.light.sheet.png`, audit of `club` (`24x24 "Delete season"`)
- Status: seen on screen

### T6. "Club owner" is a disabled button, shown twice

- Severity: low
- Where: club header and the Members tab; `src/components/clubs/club-membership-button.tsx:39`
- What happens: the owner's status is a greyed-out button beside the ⋯, and again beside "Invite member". On desktop it sits in the middle of the action row.
- Why it matters: a disabled button reads as "something you cannot do", not as "this is you".
- Fix: a `Chip` ("Owner", "Admin", "Member") in the header labels, once; keep a button only for Join / Leave.
- Design reference: /design#controls (Chips).
- Evidence: `shots/T/club.phone.light.sheet.png`, `shots/T/d-club-members.desktop.light.png`
- Status: seen on screen

### T7. Club members cannot be opened, and their joining date is in the browser's numeric format

- Severity: low
- Where: `/clubs/<id>?tab=members`; `src/app/clubs/[id]/(detail)/page.tsx:309` and `:314`
- What happens: a member's name is plain text, not a link to their player page. "Joined 1/6/2024" comes from `toLocaleDateString()` with no locale, so it is 1 June or 6 January depending on the browser.
- Why it matters: every other list of people in the app opens the person; the date is ambiguous.
- Fix: `PlayerLink` (not prefetched) on the name; the shared date helper ("Joined 1 Jun 2024").
- Design reference: /design#spec-row-actions; /design#spec-dates
- Evidence: `shots/T/d-club-members.desktop.light.png`
- Status: seen on screen

### T8. The desktop club header has eight buttons of equal weight with the main one last

- Severity: low
- Where: `/clubs/<id>` as an admin, desktop; `adminTools` and `actions` in `src/app/clubs/[id]/(detail)/layout.tsx`
- What happens: Branding & media, Club settings, Streaming, New season, Add to calendar, Club owner (disabled), New tournament, New team, in one row.
- Why it matters: nothing leads; the primary action is the eighth thing read.
- Fix: New team first, one "New" menu for tournament and season, settings and branding under ⋯ (the phone sheet already groups them).
- Design reference: /design#content (Page header).
- Evidence: `shots/T/d-club-members.desktop.light.png`
- Status: seen on screen

### T9. Leaderboard cards: league nicknames and two title sizes

- Severity: low
- Where: club Stats and tournament Stats; `src/components/clubs/club-stats-tab.tsx` and the shared leaderboard overview
- What happens: the first three cards are titled "Orange cap", "Purple cap" and "MVP leader" in one size, the rest ("Most sixes", "Highest individual score") in a smaller one. The tab is "Stats", its heading "Leaderboard".
- Why it matters: "Orange cap" and "Purple cap" are one league's names for most runs and most wickets (the label on the right has to translate them); sibling cards should share a title style.
- Fix: title the cards "Most runs", "Most wickets", "Most valuable player", all in the same size; heading "Leaderboard" → "Stats" or drop it.
- Design reference: /design#cricket (Points table and leaderboard).
- Evidence: `shots/T/tourn-tabs.phone.light.sheet2.png`, `shots/T/club-tabs.phone.light.sheet1.png` (stats2 tile)
- Status: seen on screen

### T10. Contact links in the club's actions sheet are tiny, and "X" is one letter

- Severity: low
- Where: club ⋯ sheet, phone; `src/components/clubs/club-contacts.tsx`
- What happens: under the buttons, the email, phone, "X" and "Instagram" are 16 px high text links; the X link is 8 px wide.
- Why it matters: untappable on a phone, and "X" alone does not read as a link.
- Fix: one row per contact with an icon and a label ("Email", "Call", "X (Twitter)", "Instagram"), `min-h-11`.
- Design reference: /design#spec-touch-sizes; /design#detail-pages (Actions sheet)
- Evidence: `shots/T/club-tabs.phone.light.sheet2.png` (actions tile), audit (`8x16 <a> "X"`)
- Status: seen on screen

### T11. Hall of fame wording and controls

- Severity: low
- Where: `/clubs/<id>?tab=hall-of-fame`; the hall of fame card in `src/app/clubs/[id]/(detail)/layout.tsx:440` onwards, `src/components/clubs/hall-of-fame-dialog.tsx`
- What happens: "Add to Hall of Fame" (title case; the tab is "Hall of fame"), "32 Wickets @ 14.2 AVG", "Single Season Bowling Record", and a bare bin icon in the corner of every card for admins.
- Why it matters: AGENTS.md: sentence case, no ALL-CAPS labels; a delete control with no label on each card.
- Fix: sentence case throughout ("32 wickets at 14.2"); put Remove (and Edit) in a card ⋯ menu.
- Design reference: /design#content (Card).
- Evidence: `shots/T/club-tabs.phone.light.sheet2.png` (hof tile)
- Status: seen on screen

### T12. A tournament past its end date still says "Ongoing", and its list card runs to four lines of description

- Severity: low
- Where: `/tournaments`, the club's Tournaments tab; `src/components/tournaments/tournament-card.tsx`
- What happens: tournaments that ended in August 2024 carry the green "Ongoing" chip (the status is changed by hand). Each card shows the whole description, three to four lines.
- Why it matters: the chip claims something the dates beside it contradict; long descriptions push the list to one and a half cards per screen.
- Fix: when the end date has passed and the status is not completed, show "Ended 30 Aug 2024" and ask the organiser to close it; clamp the description to two lines on cards.
- Design reference: /design#cricket (Match lists: tournament card).
- Evidence: `shots/T/clubs.phone.light.sheet1.png`
- Status: seen on screen

#### Covered

- `/clubs` (mine, all), `/tournaments`, phone
- `/clubs/<id>` as its owner: header, Teams, Tournaments, Matches, Stats, Hall of fame, Members, the actions sheet on phone; Members on desktop
- `/tournaments/<id>` as a plain member: header, Points table, Qualification calculator, Fixtures, Teams, Stats on phone; desktop shot taken

#### Not covered

- The tournament page as its organiser (N1 crash): Register team, registrations and their approval, Generate fixtures, Create next round, Manage tournament, points adjustments, Schedule match. Review these on screen once N1 is fixed.
- Club settings, Branding & media, Invite member, New season, Add to hall of fame dialogs (forms are sampled in area F)
- Streaming dialog (alpha, out of scope)
- `/clubs/<id>/stats-report`

## F. Create flows and forms

Screenshots: `shots/F/`.

### F1. Form errors arrive three different ways, and the field at fault is often not the one marked

- Severity: medium
- Where: `/teams/create`, `/clubs/create`, `/tournaments/create`, dialogs with fields; `src/app/tournaments/create/page.tsx` (the red box above the button), `src/app/teams/create/page.tsx`, `src/components/ui/input.tsx` (40 px). The design system's field is `src/components/ds/field.tsx` (`Field`: 44 px control, `aria-invalid`, error under the label)
- What happens: an empty required field gets the browser's own bubble ("Please fill out this field."), which vanishes and differs per browser. A wrong value caught by the app ("The end date is before the start date") is a red box above the submit button, a screen away from the End date field, which is not marked. Failures from the server are toasts. None of these forms uses `Field`.
- Why it matters: people have to hunt for what to fix; a toast is gone before it is read; screen readers are not told which field is invalid.
- Fix: build these forms with `Field`: the message under the field it belongs to (`aria-invalid`, `aria-describedby`), focus moved to the first invalid field on submit, `noValidate` on the form so the app's wording is used. Keep a toast only for failures that are not about a field (network).
- Design reference: /design#spec-form-errors; principle "An error sits on the field that caused it" (/design#principles)
- Evidence: `shots/F/validation.phone.light.sheet.png`
- Status: seen on screen

### F2. The match wizard stacks a sticky Start bar on top of the tab bar

- Severity: medium
- Where: `/matches/create`, phone; `src/app/matches/create/` (the sticky footer), the app shell's tab bar
- What happens: "Start match" and its hint sit in a bar pinned above the tab bar. Together they cover about 190 px of an 844 px screen, so a little over half the height is left for the form. On Android the tab bar also rides above the keyboard (N38), which leaves under 400 px while typing.
- Why it matters: the form people came to fill has the least room on the screen, and five navigation tabs sit under a task they are in the middle of.
- Fix: on task screens (create match, team, club, tournament, and their edit forms) hide the tab bar, as a full-screen task does elsewhere; keep the sticky Start bar on the wizard, with safe-area padding.
- Design reference: Principle "A form is a task" (/design#principles). No frame of the wizard: the scoring screen already hides the tab bar the same way.
- Evidence: `shots/F/wizard1.phone.light.sheet.png`
- Status: seen on screen

### F3. Create pages have no heading and call the same thing by different names

- Severity: low
- Where: `/teams/create` ("New team" then "Create a team"), `/clubs/create` ("Create club"), `/tournaments/create` ("Create tournament"), `/matches/create` ("New match", the only real `h1`); `src/app/teams/create/page.tsx:96`, `src/app/clubs/create/page.tsx:85`, `src/app/tournaments/create/page.tsx:92` (`CardTitle`, a `div`)
- What happens: three of the four pages have no `h1` or any heading. Menus and buttons that lead here say "New team", "New tournament"; the pages say "Create a team", "Create tournament".
- Why it matters: a screen reader user lands on a page with no heading; the name changes between the button and the page it opens.
- Fix: an `h1` on each ("New team", "New club", "New tournament", "New match"), submit buttons "Create team" etc. as now.
- Design reference: /design#content (Page header).
- Evidence: audit output of `team-create`, `club-create`, `tourn-create` (`h1Count: 0`)
- Status: seen on screen (audit)

### F4. Required and optional fields are marked three ways

- Severity: low
- Where: the create forms
- What happens: "Team name \*" (no legend for the star), "Affiliated club (optional)", and fields that are optional but say nothing ("Short name", "About the team", "Venue", "Description").
- Why it matters: people cannot tell what they may skip.
- Fix: one convention, the design system's: mark the optional ones ("optional" from `Field`), nothing on required ones, since most fields here are optional and required ones are few.
- Design reference: /design#controls (Fields: `optional`).
- Evidence: `shots/F/team-create.phone.light.sheet.png`, `shots/F/tourn-create.phone.light.sheet.png`
- Status: seen on screen

### F5. Placeholder examples: "E.G. RCB", and a real franchise as the sample

- Severity: low
- Where: `/teams/create`; `src/app/teams/create/page.tsx:128` (`uppercase` on the input), `src/components/teams/edit-team-dialog.tsx:157`
- What happens: the short-name field is upper-cased with CSS, which also upper-cases its placeholder to "E.G. RCB". The examples are "Royal Challengers" / "RCB" and "Lord's Cricket Ground".
- Why it matters: "E.G." in capitals looks like a bug; the app's rule elsewhere is to keep real leagues' names out.
- Fix: `placeholder:normal-case`, and made-up examples ("e.g. Hilltop Hawks", "e.g. HAW", "e.g. Riverside ground").
- Design reference: /design#controls (Fields).
- Evidence: `shots/F/team-create.phone.light.sheet.png`
- Status: seen on screen

### F6. Back is a text link on forms and a round button everywhere else

- Severity: low
- Where: the four create pages, phone ("‹ Back", 40 px high); detail screens use `ScreenBar`'s round button
- What happens: two looks for the same control, and the form's is the smaller one.
- Why it matters: consistency; the round button is the 44 px one.
- Fix: `ScreenBar` (back, the page's name) on the create pages.
- Design reference: /design#content (Top of a screen).
- Evidence: `shots/F/wizard1.phone.light.sheet.png`, `shots/F/team-create.phone.light.sheet.png`
- Status: seen on screen

#### Covered

- `/matches/create`: first screen, team picker (empty and typed), Custom format, Schedule, More options, the disabled Start state, phone
- `/teams/create`, `/clubs/create`, `/tournaments/create`: full forms, empty submit, a wrong date range, phone

#### Not covered

- Submitting each form for real and the screen that follows (kept the seed clean); the wizard's player step (`QuickPlayers`) after two new teams
- Desktop layouts of the forms
- Edit dialogs (team, club settings, branding), invite dialogs

## S. Scoring screen

Reviewed on a match made for the purpose through the wizard (Metropolitan Strikers v Metropolitan Thunder, T20). Screenshots: `shots/S/`.

### S1. A player in both teams' squads is given to one side without a word, and disappears from the other

- Severity: high
- Where: `/matches/<id>/score`: bowler picker, the catcher / fielder list in the Wicket dialog, the Squads dialog; `src/app/matches/[id]/score/components/BowlerDialog.tsx:85` (`excludeIds: battingTeamPlayerIds`), `src/app/matches/[id]/score/components/player-rows.ts:161` (`rosterOf`), `src/app/matches/[id]/score/useScoring.ts:2808` ("Cannot select a batting team player as bowler")
- What happens: Strikers (13) and Thunder (11) share seven players in their standing squads. In the match, Squads shows "Metropolitan Thunder (4)", the bowler picker offers four names and the catcher list the same four. The seven are not listed as unavailable; they are just absent. Nothing at the wizard, the toss or the picker says so.
- Why it matters: a club's internal game between two of its own sides is the common case for overlapping squads. The scorer cannot give the ball to Thunder's captain and is not told why. /design principle "Nobody disappears without a reason"; `whyNotAddable` already says a squad is a standing roster and only having played for the other side rules someone out.
- Fix: rule a player out of a side only once they have a part in this match for the other side. Until then list them on both, with "Also in Strikers' squad" as the hint. Anyone ruled out stays in the list, disabled, with the reason ("Batting for Strikers"). When the squads overlap at the start, say it once at the toss ("7 players are in both squads: they join the side they first bat or bowl for").
- Design reference: /design#spec-add-player; principle "In both squads is not out" (/design#principles)
- Evidence: `shots/S/openers.phone.light.sheet.png` (after-openers tile), `shots/S/tools.phone.light.sheet2.png` (squads), `shots/S/wicket-flow.phone.light.sheet1.png` (caught tile)
- Status: seen on screen

### S2. The scoring screen needs 730 px of height, so on shorter phones Wicket and Undo are below the fold

- Severity: high
- Where: `/matches/<id>/score`, phones under about 730 px of viewport height: 360x640, 375x667 (iPhone SE), and taller phones inside a browser tab with its bars showing; `src/app/matches/[id]/score/page.tsx` layout, `src/components/matches/scoring-panel.tsx`, `src/components/matches/live-match-hud.tsx`
- What happens: the page is 730 px tall at 360, 375 and 390 px widths. At 375x667 the Wicket / Undo row is off the screen; at 360x640 the extras row sits on the bottom edge. With No ball armed the page grows to 836 px and the 4 / 6 / 5 row is cut as well.
- Why it matters: AGENTS.md: below 640 px the layout "must fit one phone screen without scrolling". Scrolling between balls on the one screen used all match long, and Undo is the key that falls off.
- Fix: size the column to the dynamic viewport (`100dvh`) and let the keypad take what is left, with a floor per key; below about 700 px of height shrink the HUD first (one line: score, overs, CRR; drop "balls remaining" and Proj) and the batter / bowler cards to one row each. Test at 360x640 and 375x667 with an extra armed.
- Design reference: /design#spec-scoring-small; principle "The scoring screen fits the screen it is on" (/design#principles)
- Evidence: `shots/S/sizes.phone.light.sheet1.png` (360x640, 375x667, 375-noball), `shots/S/small.small.light.sheet1.png`
- Status: seen on screen

### S3. Arming an extra, undoing a ball or opening More runs moves every key on the pad

- Severity: medium
- Where: scoring keypad, phone; `src/components/matches/scoring-panel.tsx`
- What happens: tapping Wide inserts a banner above the keys, so the whole pad moves down about 45 px. No ball inserts the banner and an "Off the bat / Byes / Leg byes" row: the pad moves about 100 px and the keys shrink. After Undo, the "Ball removed" notice does the same. "More" opens a panel inside the pad that pushes Wide / No ball / Bye / Leg bye and Wicket / Undo down, off the screen at 844 px. The run chips in it (7 to 13) are about 36 px.
- Why it matters: the next tap after Wide or No ball is a run key, and it has just moved from under the thumb. A mis-tap here is a wrong ball.
- Fix: keep one fixed-height slot above the keys for the armed-extra banner and the undo notice (empty when idle, or holding the "New over" line), put the no-ball choice inside that slot, and open More runs as a small sheet over the pad instead of inside it.
- Design reference: /design#spec-scoring-small; principle "Keys stay where they are" (/design#principles)
- Evidence: `shots/S/main.phone.light.sheet1.png` (wide-armed against after-4), `shots/S/dialogs1.phone.light.sheet.png` (noball-armed, more-runs), `shots/S/wicket-flow.phone.light.sheet2.png`
- Status: seen on screen

### S4. The scoreboard and the keys use 9 to 11 px text

- Severity: medium
- Where: scoring screen, phone; `src/components/matches/live-match-hud.tsx`, `src/components/matches/scoring-panel.tsx` (17 uses of sizes under 12 px between them)
- What happens: "118 balls remaining (19.4 ov)", "On strike", "Overs: 0.2 / 4" and "Econ: 15.00" are 10 px; the words under the keys ("Dot", "Four", "1 Nb", "1+1 (2)") are 9 px.
- Why it matters: this screen is read outdoors, at arm's length, in sun. AGENTS.md: rem font sizes, no `text-[10px]`. The armed-extra labels ("2+1 (3)") are the ones that say what a tap will record.
- Fix: nothing under 12 px (`text-xs`); 13 to 14 px for the labels on keys. Make room by dropping what repeats (see S2: "balls remaining" and the overs in brackets say the same thing).
- Design reference: /design#spec-scoring-small; principle "12 px to read" (/design#principles)
- Evidence: audit output of `main` (`textUnder12px`), `shots/S/dialogs1.phone.light.sheet.png`
- Status: seen on screen

### S5. Match tools on a phone is an 18-row dropdown with 32 px rows

- Severity: medium
- Where: scoring screen ⋮, phone; the menu in `src/app/matches/[id]/score/page.tsx`
- What happens: one tall menu holds settings, Correct a ball, Replace a player, Retire (x2), Penalty runs, DLS, End the match early, Squads, scorers, Add to club, three share items, Invite, three preferences and Delete match, in 32 px rows. It fills an 844 px screen edge to edge and would need its own scroll on a shorter one. Squads, Share live score and Correct a ball are also buttons on the screen. Delete match is the last row, at the thumb.
- Why it matters: the rows are small for a tap made in a hurry between balls, and the rare and destructive sit among the routine.
- Fix: on phones a sheet (`Sheet` / `ActionsSheet`) with 44 px rows: "This match" (settings, retire, penalty, DLS, correct, replace), "People" (squads, scorers), "Share", "Preferences". Drop what the screen already has a button for. Move End the match early and Delete match to the end, set apart.
- Design reference: /design#detail-pages (Actions sheet); /design#spec-touch-sizes; principle "Phone actions open the sheet" (/design#principles)
- Evidence: `shots/S/tools.phone.light.sheet1.png` (tools-menu tile)
- Status: seen on screen

### S6. The openers' batting order follows their user ids, not who took strike

- Severity: medium
- Where: the scoreboard's two batter rows and every scorecard after it; `src/lib/firebase/scoring/ball-docs.ts:639` (`newcomers ... .sort()`)
- What happens: Mike Wilson was chosen as striker and David Brown as non-striker. The scoreboard lists David first and gives him position 1, because the two new batters are added in id order.
- Why it matters: the batter who faces the first ball is number 1 on a scorecard. Here the order of the openers is in effect random, and the scorer sees it flip the moment they confirm.
- Fix: add the striker first, then the non-striker. The comment says the replay fixtures pin the sorted order, so this needs the golden fixtures regenerated and a decision on old matches (leave them).
- Design reference: none needed (engine order, not layout)
- Evidence: `shots/S/openers.phone.light.sheet.png` (picked) against `shots/S/main.phone.light.sheet1.png` (main)
- Status: seen on screen, cause from code

### S7. Dialogs that decide something arrive with an answer already chosen

- Severity: medium
- Where: Toss ("Bat" selected before a winner is chosen; `TossDialog.tsx`), Penalty / bonus runs (Penalty runs, 5, and the reason "Ball hit a fielder's helmet on the ground"; `PenaltyBonusDialog.tsx`), End the match early (reason "Rain / Inclement Weather", result "Abandoned (points shared / split)"; `AbandonMatchDialog.tsx`)
- What happens: a default is selected in each, so Confirm records it unless the scorer notices.
- Why it matters: AGENTS.md: dialogs "preselect nobody"; /design Fields: "nothing is preselected". A wrong toss decision, penalty reason or abandonment reason goes into the record and the result text.
- Fix: no default for the toss decision, the penalty reason or the abandonment reason and result; keep the submit button disabled with what is missing as its label, as the Wicket and Bowler dialogs already do. "5" for penalty runs can stay (the Laws make it 5).
- Design reference: /design#spec-choice-dialog; principle "Nothing that goes on the record is chosen for you" (/design#principles)
- Evidence: `shots/S/start.phone.light.sheet2.png`, `shots/S/tools2.phone.light.sheet1.png`
- Status: seen on screen

### S8. Scoring dialogs come in two header styles, two button layouts and three "selected" looks

- Severity: low
- Where: `src/app/matches/[id]/score/components/*Dialog.tsx`
- What happens: Record wicket and End this innings have a centred title; Toss and the pickers a left-aligned one; Match settings, Penalty and End the match early a left-aligned one with an icon tile. Buttons are full-width and stacked in most, a right-aligned pair in Penalty and End the match early. A selected dismissal is filled black, a selected batter is a lavender tint with a ring, a selected fielder a ring with a tick, a selected penalty type navy.
- Why it matters: each dialog has to be read afresh; black is not a colour of the design system.
- Fix: one dialog header (title, one line of help, no icon tile), one footer (primary full-width, secondary under it on phones), one selected style for choice tiles (the navy fill, or tint plus ring plus tick, used everywhere).
- Design reference: /design#spec-choice-dialog
- Evidence: `shots/S/wicket-flow.phone.light.sheet1.png`, `shots/S/tools2.phone.light.sheet1.png`, `shots/S/tools.phone.light.sheet1.png`
- Status: seen on screen

### S9. Match settings is written in jargon

- Severity: low
- Where: Match tools → Match rules & settings; `src/app/matches/[id]/score/components/MatchSettingsDialog.tsx`
- What happens: the menu item is "Match rules & settings", the dialog "Match settings & rules". Copy: "special Stumps-grade rules mid-game", "Max balls per over (inclusive of extras)", "Unlimited (standard MCC)", "Overs conclude automatically once this delivery count is reached to prevent dragged overs", "Standard: 6 (The Hundred: 5, Box: 4/8)", "Local / box cricket extras".
- Why it matters: AGENTS.md asks for plain copy; a volunteer scorer should not need to know what "Stumps-grade" means.
- Fix: one name ("Match settings"). Plain help lines: "End an over after this many balls, wides and no-balls included", "No limit", "Usually 6".
- Design reference: /design#controls (Fields: hint text).
- Evidence: `shots/S/tools2.phone.light.sheet1.png` (settings tile)
- Status: seen on screen

### S10. Squads in a match: a bin on every row, with nothing to say what it removes

- Severity: low
- Where: scoring screen → Squads; `src/app/matches/[id]/score/components/SquadManagerDialog.tsx`
- What happens: each player has an unlabelled bin. It is not clear whether it takes the player out of this match or out of the team's standing squad.
- Why it matters: a destructive control with an unclear reach, one tap from a name.
- Fix: a labelled action ("Remove from this match's squad" in a row menu, or the word "Remove"), with the consequence in the confirm.
- Design reference: /design#content (List rows).
- Evidence: `shots/S/tools.phone.light.sheet2.png`
- Status: seen on screen

### S11. The offline notice is a toast that covers the striker

- Severity: low
- Where: scoring screen, phone, when the connection drops; the toast in `src/app/matches/[id]/score/useScoring.ts`
- What happens: "Network connection lost. Scoring is working in offline mode." appears as a toast over the batter rows, then goes. The ball recorded offline showed at once, which is right.
- Why it matters: it hides who is on strike for a few seconds, and once it has gone the only sign of being offline is the small status in the top bar (N12 covers toasts in general).
- Fix: no toast; show the state in the fixed slot above the keypad (S3) or as a thin line under the top bar: "Offline: 1 ball waiting to send", until it clears.
- Design reference: /design#spec-scoring-small (the offline frame); principle "A notice never covers the score or the way back" (/design#principles)
- Evidence: `shots/S/small.small.light.sheet1.png` (offline-320 tile)
- Status: seen on screen

### S12. Keypad keys are announced by a name that does not contain what they show, and the page has two main landmarks

- Severity: low
- Where: scoring screen; `src/components/matches/scoring-panel.tsx` (`aria-label="0 runs (dot ball)"` on a key that shows "0 Dot"), `src/app/matches/[id]/score/page.tsx` (`main` inside the shell's `main`)
- What happens: axe: label-content-name-mismatch on the run keys and over-strip balls; two nested `main` landmarks; the HUD's `h3` follows the `h1` directly.
- Why it matters: voice control users say what they see ("tap Dot"), which only works when the accessible name contains the visible text (WCAG 2.5.3).
- Fix: names that start with the visible text ("0, dot ball", "4, four"); make the scoring column a `div` or `section`; HUD heading `h2`.
- Design reference: Principles "The spoken name starts with what is shown" and "A way past the navigation" (/design#principles, Accessibility)
- Evidence: axe output of `dark`
- Status: seen on screen (axe)

### S13. Small things on the scoring screen

- Severity: low
- Where: scoring screen
- What happens: (a) "End innings" sits in the scoreboard beside the score at all times, 32 px high; it confirms first, but it is a once-an-innings action in the most looked-at spot. (b) The top bar's second line repeats the title and is cut ("Metropolitan Strikers vs Metrop…"). (c) The menu button is ⋮ here and ⋯ on every other screen. (d) In the openers dialog only the batter in the active slot is ticked in the list; the other chosen opener is not. (e) On desktop the header shows a chip that says "Awake" with no explanation. (f) Sunlight mode, a good idea, is three taps deep in Match tools.
- Why it matters: each is a small stumble on the screen used most.
- Fix: (a) move End innings to Match tools, or keep it but show it only when the innings can sensibly end (last over, nine down); (b) put the format and innings there instead ("T20 · 1st innings"); (c) one icon; (d) tick both; (e) "Screen stays on"; (f) offer Sunlight mode once, the first time the screen is opened outdoors-bright, or put it in the top bar's overflow first group.
- Design reference: /design#cricket (At the crease, Scoring keypad).
- Evidence: `shots/S/main.phone.light.sheet1.png`, `shots/S/openers.phone.light.sheet.png`, `shots/S/d-score.desktop.light.png`, `shots/S/sizes.phone.light.sheet1.png` (sunlight)
- Status: seen on screen

#### Covered

- Wizard → toss → openers → first bowler → main screen, phone
- Recording a single, a four, an offline two; Wide and No ball armed; More runs; Wicket (caught, fielder, next batter, closing without choosing); Undo and its notice
- Match tools menu; mid-over bowler change; Correct a ball; End innings confirm; Squads; batter change; Match settings; Penalty / bonus runs; End the match early
- 320x568, 360x640, 375x667, 390x844; dark; sunlight mode; desktop 1440

#### Not covered

- Edit ball dialog past its first step, Retire dialog, DLS from the scoring screen, Revise target, wagon wheel prompt, voice announcements
- Innings break, the chase, the result card, super over, player of the match dialog (the test match was left in its first over)
- The unsent-actions dialog and the sync banner's refused state; a second scorer on the same match
- `/design/scoring`

#### Data added

One match, "Strikers vs Thunder" (`6cde8cd8-329e-4bea-9e1d-a8772686c16b`), live, 7/0 after 0.3 overs. Local emulator only.

## X. Across the app

From automated sweeps of 26 screens (`kit/sweep.mjs`: 390 px light and dark, 320 px, 820 px) and from patterns that showed up in more than one area. Raw output: `kit/sweep-phone-light.jsonl`, `kit/sweep-phone-dark.jsonl`, `kit/sweep-small-light.jsonl`, `kit/sweep-tablet-light.jsonl`.

What came back clean: no screen scrolls sideways at 320 px (the report page at 390 px is M15); dark mode has no contrast failures on any of the 26 screens; no visible control is without a name except the two in X3.

### X1. Three text colours sit just under the AA contrast line in light mode

- Severity: medium
- Where: light theme; tokens in `src/styles/globals.css:64` (`--success`), `:77` (`--extra`), and the key labels in `src/components/matches/scoring-panel.tsx`
- What happens: success text on its tint (the "Won" and "Ongoing" chips): 4.43:1 (`#157f3c` on `#e8f2ec`). Extras on their tint (the "wd" / "nb" ball chips, 11 on one Balls tab): 4.1:1 (`#b35309` on `#f4e5da`). The word under the green Four key on the scoring screen: 4.49:1. WCAG AA asks for 4.5:1 at these sizes (all are 9 to 12 px).
- Why it matters: these are the smallest texts in the app and carry state (won, wide, no-ball), read outdoors.
- Fix: darken the two foregrounds a step (success to about `142 72% 26%`, extra to about `26 90% 33%`) or lighten the tints, and re-run the sweep. The key label goes with S4 (bigger text).
- Design reference: /design#foundations (Colour); principle "Small text on a tint passes 4.5 to 1" (/design#principles)
- Evidence: `kit/sweep-phone-light.jsonl` (`/tournaments`, `/matches/…0001`, `…?tab=balls`, the scoring screen)
- Status: seen on screen (axe)

### X2. Text fields under 16 px on phones

- Severity: low
- Where: 390 px: the leaderboard's "Search players" (12 px; `src/components/leaderboard/leaderboard-view.tsx:2340`), the textareas on the create forms (14 px: "About the team", "About the tournament")
- What happens: iOS Safari zooms the page when a field with text under 16 px is focused, and does not zoom back.
- Why it matters: the layout jumps and stays zoomed on the most common phone browser.
- Fix: `text-base` on phones for every input, textarea and select (the design system's `Field` already does: `text-base sm:text-sm`).
- Design reference: /design#controls (Fields).
- Evidence: `kit/sweep-phone-light.jsonl` (`/clubs/…?tab=stats`, `/teams/create`, `/tournaments/create`)
- Status: seen on screen (computed size)

### X3. Two selects with no name, one empty table header

- Severity: low
- Where: match Stats tab: the two filter selects (wagon wheel "All players" and one more; `src/components/matches/wagon-wheel.tsx`); player Batting table: an empty `th` (`src/components/players/player-activity-tabs.tsx:344` area)
- What happens: axe `button-name` (2) and `empty-table-header` (1). A screen reader says "combo box" with no label.
- Why it matters: WCAG 4.1.2.
- Fix: `aria-label` ("Batter", "Innings") on the triggers; a visually hidden header ("Opponent") on the column.
- Design reference: Principle "Every control and column has a name" (/design#principles, Accessibility)
- Evidence: `kit/sweep-phone-light.jsonl`
- Status: seen on screen (axe)

### X4. Cards and keys whose spoken name leaves out what they show

- Severity: low
- Where: match cards on Home, Matches and head to head (`matchCardLabel` in `src/components/matches/match-card.tsx:58`), the Stats run filters ("Show 1s only (34)" on a button that shows "1s 34"), the scoring keys (S12)
- What happens: axe `label-content-name-mismatch`: the `aria-label` replaces the visible text with different words.
- Why it matters: voice control ("tap Riverside Titans") matches on the visible words (WCAG 2.5.3). Screen reader users are well served by the longer label; voice users are not.
- Fix: start each label with the text as shown ("Riverside Warriors 94 for 5, Riverside Titans 78 for 4, live …"), or use `aria-describedby` for the extra detail.
- Design reference: Principle "The spoken name starts with what is shown" (/design#principles, Accessibility)
- Evidence: `kit/sweep-phone-light.jsonl` (`/dashboard`, `/matches`, `…?tab=stats`)
- Status: seen on screen (axe)

### X5. 11 px text is everywhere there are figures

- Severity: low
- Where: leaderboard sub-lines ("4 inn • Avg: 32.50 • SR: 141.30": 56 pieces on the club Stats tab), chart axes and stat-tile labels on the match Stats tab (38), partnership rows on the Scorecard (13), the overs beside a score ("13.4 ov")
- What happens: `text-2xs` (11 px) is the working size for secondary figures.
- Why it matters: with S4, the smallest text sits on the numbers people came for. 11 px is under the 12 px most guidelines treat as the floor for body text on a phone.
- Fix: 12 px (`text-xs`) as the floor on phones; keep 11 px only for chart axis ticks. Decide it once in the type scale.
- Design reference: Principle "12 px to read" (/design#principles)
- Evidence: `kit/sweep-phone-light.jsonl` (`tinyCount`)
- Status: seen on screen (computed size)

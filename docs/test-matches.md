# Test matches: who plays them, what they need, what was built. 23 November 2026

Until now a match on CricScore could be T20, T10, ODI or Custom: one innings a side with an overs limit. There was no way to score a Test, a two-day club game or any match where each side bats twice. The engine also treated innings 3 and 4 as a super over, so such a match could not be scored by working around it.

This document sets out the people who play these matches, what they need from a scoring app (from the Laws and from what other scoring apps do), and what this change adds.

## Personas

### 1. Priya, club scorer in a two-day league

Scores for her club's first XI in a Saturday-and-Sunday competition. Each side bats twice, there is no overs limit, and the match runs over two afternoons. She scores on a phone at the ground, sometimes with a weak signal.

- Needs to **declare** an innings when the captain closes it, and record a **forfeit** when a side gives up an innings to chase a result (Law 15).
- Needs the app to ask about the **follow-on** at the right moment and know the lead the match needs: 100 runs in a two-day game (Law 14.1.1).
- Needs **stumps** at the end of Saturday so the score waits overnight, and **lunch and tea** so people following know play has stopped.
- Needs a **draw** when time runs out on Sunday, with the not-out batters' runs still counting in their records.
- Must never have the match end itself after 20 overs or call the third innings a super over.

### 2. Marcus, league organiser

Runs a club league whose fixtures are two-day matches. He creates the season's fixtures in one go and keeps the points table.

- Needs to set **Test** as the league's match format with the **number of days**, and have generated fixtures take it.
- Needs **draws** in the points table, and no net run rate in a format where it means nothing.

### 3. Coach Dev, school two-innings games

Runs under-15 matches where each side bats twice but each innings has an overs limit (for example 20), finished in one day.

- Needs a **Custom** match with **two innings a side**, an overs limit per innings, and one day (follow-on at 75).

### 4. Aisha, parent following from home

Follows her son's two-day game on the match page.

- Needs to see each side's score the way Test scores are written, **"245 & 180/4"**, who **leads or trails** and by how much, **"Day 2"**, **"Stumps, day 1"** or **"Lunch"**, and results like **"won by an innings and 23 runs"** or **"Match drawn"**.

### 5. Ravi, club streamer

Streams club cricket with the overlay. The overlay already has a Test-style package (Test classic) that shows a lead or deficit and "325 & 112-2".

- Needs the engine to give the overlay a real fourth innings, the chase without a balls count, and the day and break of play.

## What the Laws and other apps do

- **Laws of Cricket.** A match is one or two innings a side (Law 13). The side batting first may make the other follow on when it leads by 200 in a match of five days or more, 150 in three or four, 100 in two and 75 in one (Law 14.1.1); it is the captain's choice, not automatic. A captain may declare an innings closed, or forfeit one before it starts, and a forfeited innings counts as completed (Law 15). A side that has not passed the other's total after the third innings loses by an innings; a match neither won nor tied when time runs out is drawn (Law 16). [MCC Laws via Wikipedia: follow-on](https://en.wikipedia.org/wiki/Follow_on), [Declaration and forfeiture](https://www.wikipedia.com/wiki/Declared)
- **PlayHQ (Cricket Australia).** Two-day games have their own score entry. An innings closes as *All out, Compulsory close, Declared, Follow on, In progress* or *End of game*; scorers record **stumps** at the end of a day, and the stumps status shows on the public scorecard and the PlayCricket app. [Ending an over, innings, game or day](https://support.playhq.com/hc/en-us/articles/23974516978076-Ending-an-Over-Innings-Game-or-Day), [2Day format score entry](https://support.playhq.com/hc/en-us/articles/23975479241244-2Day-Format-Score-Entry), [PlayCricket: stumps](https://playcricketsupport.cricket.com.au/hc/en-us/articles/8227076526735)
- **Play-Cricket Scorer Pro (ECB).** Scores two-innings matches with the same *Next innings / End innings* controls, and the result is chosen when the scorecard is finalised. [Ending an innings](https://play-cricket.ecb.co.uk/hc/en-us/articles/360000409469-Ending-An-Innings-PCS-Pro)
- **CricHeroes.** Publishes a follow-on calculator with the same thresholds by match length. [Follow-on rule](https://blog.cricheroes.com/follow-on-rule-test-cricket)
- **Other scorers.** Skipper lists Test and multi-innings matches with declarations, follow-ons, days and draws; Skorit and nxCricket list multi-innings formats. [Skipper](https://apps.apple.com/app/id6760088967), [Skorit](https://apps.apple.com/ca/app/skorit/id6739847320), [nxCricket](https://apps.apple.com/gb/app/nxcricket/id362065447)
- **Cricsheet**, the open ball-by-ball format the app exports, has match types *Test* and *MDM* (multi-day match), no overs for a Test, `declared` and `forfeited` on an innings, and a win "by an innings and N runs".

The help centres block automated reading in places, so some details come from search excerpts.

## What was built

| Need | What the app does now |
| --- | --- |
| Create a Test | The match wizard offers **Test** next to T20, T10, ODI and Custom, with **Days** (1 to 5). A Test has two innings a side and no overs limit. |
| Two innings with an overs limit | **Custom** has **Innings per side: One / Two**; with two, the overs apply to each innings and Days sets the follow-on. |
| Leagues of Tests | A tournament can take **Test** with **Days per match**; generated fixtures and the wizard take it. A draw earns a point each, as a tie does (a **draws** figure on the table row), and Tests add nothing to net run rate. |
| Right innings order | Innings 2 has no target; innings 3 belongs to the side that batted first; innings 4 chases the lead plus one. A Test never starts a super over. |
| Declare and forfeit | **Declare or end innings** (Match tools, and beside the score near the end) asks **Declare** or **All out**. Declaring before a ball is a forfeit. Scorecards show "450/7d" and "forfeited". |
| Follow-on | When the side batting first leads by enough, the innings-break card says the lead and the lead needed, and offers **Enforce** or **Don't enforce**. Only before the third innings' first ball. The scorecard marks "2nd innings (f/o)". |
| Win by an innings | Worked out after the third innings: "Alpha won by an innings and 70 runs". An edit that takes the margin away reopens the match into its fourth innings. |
| Days and breaks | **Lunch, tea or stumps** in Match tools. Stumps keeps the close-of-play score for the day; **Start day 2** begins the next one; a stumps called by mistake can be taken back. The keypad waits during a break. Viewers see "Stumps, day 1" or "Lunch, day 2". |
| Draw | **Draw the match (time is up)** ends a live Test as "Match drawn". The innings in play closes where it stands, so not-out batters and bowlers keep their figures in careers and leaderboards; an innings opened but not started is dropped. |
| Scores as Tests are written | Match cards, the match header, the score strip, share messages and the share image show "245 & 180/4". The live line reads "Day 2 · Lions trail by 120 runs", or "Lions need 230 runs to win" in the fourth innings, with no balls count or required rate. |
| Stats and exports | Top performers take both innings. Team records count each innings as a total. The Cricsheet export says *Test* (or *MDM*), leaves out overs, and marks declarations, forfeits, innings wins and draws. |
| Overlay | `live_state` carries the day and break for Tests; the standard overlay names each side's 1st and 2nd innings, shows the day, and "Need 230 to win" in the chase. Test classic already showed the lead and "325 & 112-2". |
| Offline | Ending an innings offline opens the next one on the phone exactly as the server will (no target after innings 1 and 2, the lead plus one after innings 3, nothing after a win by an innings). The follow-on and a draw need a connection; the screen says so. |

## Walked through as each persona (23 November 2026)

On the local emulators, in Chrome, signed in as a seeded scorer:

- **Priya**: created a two-day Test in the wizard, scored it ball by ball, declared the first innings, bowled the other side out, called lunch and resumed, called stumps on day 1, started day 2, set up the fourth-innings chase ("Need 27 runs to win", no balls count) and drew the match. A second, one-day Test: 80 declared, the other side out for 1, the follow-on offered (lead 79, 75 needed), enforced, and won by an innings and 77 runs.
- **Aisha**: the match page at stumps ("Stumps, day 1 · Metropolitan Strikers lead by 30 runs"), after the draw and after the innings win, on desktop and a phone; the match list; the four-innings scorecard.
- **Marcus**: created a Test league of two-day matches ("Test · 2 days" on its page).
- **Ravi**: the overlay of a Test.
- **Coach Dev**: Custom with two innings a side and an overs limit in the wizard (the engine rules are covered by tests).

It caught, and these were fixed before release: the break card and the list cards left the "d" off a declared total; the Summary listed a player twice when they batted in both innings (and React warned about it); the player of the match showed one innings of figures; the overlay called the fourth innings "of 1 over"; the wizard did not hydrate when it remembered a Test.

## Not built yet

- **First-innings points.** Many club two-day competitions give points for a first-innings lead in a drawn match; rules differ by competition, so the table uses win 2, tie or draw 1 for now.
- **Overs per day and the new ball.** No count of overs bowled today, or of overs since the new ball (due after 80 in a Test).
- **Each day's date.** The close-of-play scores are kept per day of play, but not the calendar date of each day.
- **A follow-on offline.** Deciding it needs a connection.

## Where it lives

- Rules shared by the engine, the phone and the screens: `src/lib/multi-innings.ts`.
- Engine: `src/lib/firebase/scoring/result.ts` (`advanceAfterInnings`, `inningsLimits`, `isSuperOverInnings`), `src/lib/firebase/rpc/scoring.ts` (`end_innings` with a declaration, `set_follow_on`, `draw_match`).
- Tests: `src/lib/multi-innings.test.ts`, `src/lib/firebase/rpc/test-match.test.ts`.

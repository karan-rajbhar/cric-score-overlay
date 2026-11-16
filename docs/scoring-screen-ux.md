# The scoring screen: seeing the match while scoring, and choosing the openers. Research, 15 November 2026

Two problems a scorer raised after the 15 November matches, the evidence on how scoring apps solve them, and the proposed design. The proposal is drawn at `/design/scoring` (dev only) for review; nothing in the app has changed yet.

## The problems

1. **A scorer cannot look at the match while scoring.** The scoring screen shows the two batters, the bowler, this over and the keypad. To check the scorecard (who has how many, the bowlers' figures, the fall of wickets) or the ball-by-ball, the scorer leaves for the match page through *Full scorecard* or the ⋯ menu, and has to find the way back. Scorers check these all the time: before choosing the next bowler (who has overs left), after a wicket (what the batter made), when the other team asks the score, and when something looks wrong.
2. **Choosing the opening batters is confusing.** The dialog asks for the striker, then the non-striker. Once the striker is chosen, the list for the non-striker does not make it plain who was picked: the striker's row only carries a small grey "Striker" tag among the other rows' details, so it reads as if the pick vanished.

## What scoring apps do

- **GameChanger** (baseball and softball scorekeeping, the most used amateur scorekeeping app in the US): the scoring screen has its own tab bar while a game is scored: *Score, My Team, Opponent, Plays, Stats*. The game state stays in a slim header on every tab (inning, balls, strikes and outs, both teams' runs), the batter and pitcher sit under it, the scoring input owns the middle with Undo and Redo beside it. Checking the box score or the play-by-play is one tap, and *Score* brings the scorer back exactly where they were. (Screen from the Lazyweb library: "Includes navigation to score, my team, opponent, plays, and stats, plus undo/redo controls".)
- **Stumps** (cricket): the scoring page has a live summary and a live scorecard next to the wickets keypad, according to its feature page's screenshots ("Scoring Live Summary", "Scoring Live Scorecard", "Scoring Page Wickets Keypad"), and a *More* menu for settings. Its listings name the views a match has: summary, scorecard, partnerships, fall of wickets, ball by ball. [Features](https://stumpsapp.com/features), [App Store](https://apps.apple.com/us/app/stumps-the-cricket-scorer/id1487782108)
- **CricHeroes**: a match is organised as *Match information, Summary, Full scorecard, Commentary, Analysis*; insights work during live matches too. How the scorer reaches them mid-match is not documented. [How CricHeroes builds its scorecard](https://medium.com/cricheroes/improving-grassroots-cricket-one-scorecard-at-a-time-42bab384b38), [App Store](https://apps.apple.com/us/app/cricheroes-cricket-scoring-app/id1222844050)
- **Opening batters**: NV Play shows the striker and the non-striker together, as two dropdowns side by side, with *Swap batters* next to them; Cricket Australia's app asks for the strike batter, then the non-strike batter, then the bowler, one screen each; PlayHQ the same order after the toss. [NV Play mobile scoring](https://support.nvplay.com/hc/en-gb/articles/5618438972185-Common-Questions-About-Mobile-Scoring), [Cricket Australia: opening batters and bowler](https://mycricketsupport.cricket.com.au/hc/en-us/articles/115001155286-How-to-select-the-opening-batters-bowler-Tablet), [PlayHQ e-scoring](https://support.playhq.com/hc/en-us/articles/24948598336156)
- **Platform guidance**: Apple's guidelines put a segmented control where people switch views of the same thing in place, and a tab bar for an app's sections; switching in place keeps the person's context. [Apple HIG: segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)
- **This app's own rule** (`/design#principles`, "Nobody disappears without a reason"): a choice must stay visible with what it is, not vanish from the list.

The help centres block automated reading, so the cricket apps' details come from search excerpts and their store pages; GameChanger's from a screenshot.

## Proposal

### A. Score, Scorecard and Balls while scoring

- The scoring screen gets three views of the match, switched in place: **Score** (the screen as today: batters, bowler, this over, keypad), **Scorecard** (the innings in play, then the earlier innings folded: batting with how out, bowling, fall of wickets, partnerships folded) and **Balls** (every over, latest first, with its bowler, runs and the balls as chips).
- The score line stays on every view (runs/wickets, overs, the chase or run rate), so the scorer never loses the state of the match, as GameChanger keeps the game state in its header.
- Switching keeps everything: the keypad comes back as it was (an armed extra, the wagon wheel step), nothing is sent or lost.
- The keypad is on *Score* only, so a ball is never scored by accident while reading the scorecard.
- On *Balls*, tapping a ball opens *Fix a mistake* on it (phase 1 of `docs/scoring-corrections.md`): the place mistakes are noticed is where they are fixed.
- **The switch takes the header's place** (decided on review, 15 November). Today's header (exit, "RIV vs HIL", "HIL batting · 2nd innings · T20", the save status, Squads, Share, Match tools) becomes the top bar every other detail screen has (`ScreenBar`): the round back button, **Score | Scorecard | Balls** where the title was (a segmented control, as tall as the bar's 44 px buttons; Apple puts one in the navigation bar for views of one thing), and ⋯ on the right, over the wash.
  - Squads and Share the live score move into ⋯ (Match tools: Squads at the top, Share in its Share group, beside the broadcast overlay).
  - What the header said in small type moves to the score card's top line, which phones hide today only because the header said it: the batting side and the innings on the left ("Hilltop Hawks · Inns 2 · T20"), the save status on the right (Saved ✓, Saving…, Not saved (n) to send again, Offline (n), the co-scorer's chip). `LiveMatchHUD` takes `sideOnPhones` and `status` for this.
  - The screen keeps one `h1` for screen readers ("Scoring RIV vs HIL"); the ⋯ sheet is titled with the match.
  - Before the start, the header's Toss button has no bar to sit in: the Score view shows the toss instead (to settle when building).
  - Measured on the specimen: the screen fits without scrolling at 405×900 and at 360×740 (a small Android, where the keypad is already at its smallest), with a few pixels to spare over today's.
  - Considered and dropped: the switch as a row under today's header (it fitted at 360×740 only as a slim 40 px control, and kept a header the screen does not need) and a tab bar under the keypad as GameChanger has it (next to Wicket and Undo, where a slip changes the view mid-ball).

### B. Choosing the opening batters

- Both ends are on screen together as two cards, **Striker** and **Non-striker**, each with the player chosen or "Choose", the one being filled outlined, and **Swap** between them (as NV Play).
- The squad list keeps everyone in it. A player chosen for an end keeps their row, marked with a coloured pill naming the end ("Striker" / "Non-striker") and a tick, in place; nothing disappears or moves.
- Tapping a player fills the end being chosen, then the dialog moves on to the other end by itself. Tapping the player already at the other end swaps them; tapping a filled end card makes it the one being chosen.
- Nothing is preselected, and Confirm names the pair: "Start with Sandeep sir on strike and Vinayak".

## Built (15 November 2026)

Both parts are in the real scoring screen. `/design/scoring` (dev only) is now its reference: the real score card, keypad, switch, Scorecard, Balls and batter dialog on a sample chase, in each keypad state (normal, free hit, after undo, sunlight) and save status; the 360 by 640 drawing on `/design` ("The scoring screen at 360 by 640") follows it.

- The top bar replaced the header at every size (one tab list, so one place for it). The Score view keeps the keypad mounted while another view is open, with its keyboard shortcuts off.
- Scorecard is the match page's scorecard (one tab per innings, opening on the one in play; partnerships folded), built from the screen's own state, so it costs no reads and moves with instant scoring and offline; `getScoringState` and the per-ball delta now keep each innings' fall of wickets as stored (ids), named from the squads. Names are not links there.
- The score card on phones has no top line of its own (the scoring column must fit 360 by 640 with an extra armed, the principle "The scoring screen fits the screen it is on"): the save status sits at its top right, beside the score, and the batting side (and a super over) on the line under the score ("ABH · Run rate 12.00 · Projected 60", "HIL need 27 runs from 21 balls"). From sm up the top line stays as reviewed. The card's stand is now the engine's current partnership, not the runs since the last wicket.
- Balls lists every over (bowler, runs, the balls) from the match's ball log, read only while the view is open and again only when the log changes; the read is shared with Fix a mistake. A scorer's tap on a ball, or on an over's Change bowler, opens Fix a mistake there.
- The score card was cleaned up (asked for after the review): each figure once and the same words on every size (the overs "16.3 of 20 ov"; first innings "Run rate 12.00 · Projected 60", from sm with "45 at 8 an over, 53 at 10"; a chase "Need 27 runs from 21 balls" then "Target 169 · 6 wickets left · needs 7.71 an over", from sm with the run rate and "0.90 an over ahead"), the overs bar labelled with the balls left, and the board's colour tokens instead of white at an opacity; gone: "Inns 1", "CRR", "RRR", "RPO", "Proj", "wkts", the four-figure chase grid and the "Projected score" box, which repeated the rest. Phones under 700 px tall show the chase's headline only, so the keypad fits 360 by 640 in a chase too.
- The header's Toss button went: the Score view's "Record toss & start" card already offers it. Squads and Share the live score moved into Match tools, with the broadcast overlay.
- The batter dialog: end cards with the end's pill, every chosen batter marked in place, a hint that names who stays marked, and a button that names the pair.

Checked on the local emulator at 405×900, 360×740 and 360×640 with Wide armed (the Score view fits without scrolling), at 1024×768, in dark mode and in sunlight mode: the views switch and come back with the keypad as it was, `?tab=` opens a view directly, and an offline reload on any view opens (the service worker keys the page by its path). The two rules agreed are on `/design#principles`: "Read the match without leaving the keypad" and "A choice made earlier stays in sight".

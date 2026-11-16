# Fixing scoring mistakes: research and plan, 15 November 2026

How scorers correct a match after the fact, what goes wrong with the tools CricScore has today, what established scoring apps do, and the plan to fix it in three phases. Phase 1 is specified in enough detail to build from; phases 2 and 3 are outlined.

The baseline is `main` at `5f9acc5`. The engine operation `correctBallPlayers` (`src/lib/firebase/rpc/scoring.ts`) was added on `matches-fixes` while repairing the matches below and is what phase 1 builds on.

## Why: three matches on 15 November

Three Vinayak 11 v Omkar 11 matches scored on phones on 15 November needed repairs in the database (see the backups `~/backups/cricscore-prod-2026-11-15-*`). Every one of them was a mistake a scorer could not fix in the app:

- **Batters at the wrong ends.** In the second match the app had Sandeep sir on strike and Vinayak at the other end when it was the other way round, and gave Vinayak's caught wicket (4.4) to Sandeep sir, who batted on. Nothing in the app fixes who was on strike for a stretch of balls, and a caught wicket can only go to the striker.
- **A duplicate made to work around it.** To put Sandeep sir back at the crease the co-scorer searched "sandip", found nobody (the player is "Sandeep sir"), created "Sandip Sir" and used *Wrong player: replace*, which moved Vinayak's whole innings, his real runs included, to the new player.
- **Two scorers undoing each other.** A minute later the other scorer replaced "Sandip Sir" back with Vinayak on the Players page; a minute after that the first scorer replaced him again. Neither screen said what the other had done.
- **A finished over credited to the wrong bowler.** In the third match the bowlers of overs 4 and 6 were swapped, and the catch at 3.6 was given to the bowler of over 4. Fixing it in the app would have taken twelve one-ball edits.
- **Duplicates of regulars.** "Mahesh", "Amit", "Kalpesh", "Harsh", "Mayur", "Raju" and "Ram" each existed twice, mostly created mid-match.

## What a scorer can do today

| Tool | Where | What it does | Where it falls short |
|---|---|---|---|
| Undo | Keypad | Removes the last action | Last action only |
| Edit ball | Keypad (last ball), a chip of this over, *Edit balls* (`EarlierBallsDialog` → `EditBallDialog` → `update_ball`) | Runs, extras, how out, fielder, striker, bowler of one ball; who is out only for a run out or obstructing | Only while the match is live (`onEditBalls` is offered for `status === "live"`), only the current innings (`inningsId={currentInnings?.id}`); not the non-striker or the shot; one ball at a time; a change of runs does not touch who faced the later balls |
| Change (batter) | Scoreboard → `BatsmenDialog` | Swaps in another batter | Only before the batter has faced a ball |
| Swap ends | Keypad / `BatsmenDialog` | Changes who faces the next ball | The next ball only |
| Wrong player: replace X | `BatsmenDialog` (`replace_batter`) | Moves everything X did in this innings to a squad player who has not batted | Whole innings only; nobody already in the match can be chosen |
| Retire | `BatsmenDialog`, Match tools | Records a retirement | Not editable afterwards (undo only while it is the last entry) |
| Wrong bowler / Can't finish the over | `BowlerDialog` (`reassignOverBowler`) | Fixes the bowler of the over in play | Once the over ends: ball by ball in Edit ball |
| Replace | Match ⋯ menu → Players page (`replace_player`) | Moves a player's whole match to another player | Away from the scorecard where mistakes are noticed; anyone with a part in the match is never offered; whole match only; no notice to the other scorer |
| Merge | Team page squad row (`mergePlayer`) | Turns a placeholder into the real player | Refuses two players who appear in the same match, even when they never played at the same time |

Underneath, the engine already supports more than the screens offer: `update_ball` works on a completed match and on any innings, and every correction recomputes the innings from the ball log (`recomputeInnings`), which is pure and already runs on the phone for instant scoring.

## Gaps

- G1. No way to say the batters were at the wrong ends for a stretch of balls.
- G2. A striker-only wicket (caught, bowled, lbw, stumped, hit wicket) cannot be given to the other batter.
- G3. Replace is all or nothing (whole innings or whole match) and never offers a player who is already in the match, so it cannot express a mix-up between two players who both played.
- G4. A finished over's bowler is fixed ball by ball.
- G5. Nothing can be corrected after the match ends, or in an earlier innings, from the screens.
- G6. A missed ball cannot be inserted and a double entry cannot be removed unless it is the last one.
- G7. Retirements and penalty runs cannot be edited once other entries follow.
- G8. Search misses spelling variants ("sandip" / "Sandeep sir"), and when the right player is unavailable the screens offer to add a new one.
- G9. The other scorer is told only "X is also scoring", never what changed; Replace does not even mark the change.
- G10. Nothing shows the effect of a correction before it is saved.
- G11. No history of corrections and no undo of one.
- G12. Nothing flags a match that looks wrong (a strike change the runs do not explain, near-identical names, players created mid-match, a bowler in consecutive overs).

## What established scoring apps do

- **NV Play** (pro scoring software used by the ECB and Cricket Australia): corrections are made in an edit mode on the ball-by-ball list. Balls can be inserted (before a ball, or at the end of an over) and deleted (a wicket only when it is the last ball). An *Auto Correct* prompt appears whenever an edit changes who should be on strike: update all later balls, or continue without. Changing the bowler asks whether it is for the whole over or this delivery. Replacing a batter who has scored asks whether to replace them for the whole innings or retire them and bring the new player in from that point. [Scoring and editing a match](https://support.nvplay.com/hc/en-gb/sections/360008895933-Scoring-and-Editing-a-Match), [Inserting deliveries](https://support.nvplay.com/hc/en-gb/articles/46799774107801-Inserting-Deliveries), [Deleting deliveries](https://support.nvplay.com/hc/en-gb/articles/360055262594), [Editing runs and extras](https://support.nvplay.com/hc/en-gb/articles/47158487135257-Editing-Runs-and-Extras), [Changing and swapping a batter](https://support.nvplay.com/hc/en-gb/articles/360057004794-Changing-and-Swapping-a-Batter), [Changing the bowler](https://support.nvplay.com/hc/en-gb/articles/360057094073)
- **Play-Cricket Scorer Pro** (ECB): edit mode can swap the striker and non-striker on a ball. Adding or moving a wicket on an earlier ball offers to move the later balls to the next batter ("auto-reassignment of subsequent balls"), or continue without. It refuses to give a wicket to a batter who is out later on until that later wicket is fixed. Changing a batter asks whether it is for the whole innings. [Editing wickets in edit mode, and auto-reassignment](https://play-cricket.ecb.co.uk/hc/en-us/articles/360001225137-Editing-or-Adding-Wickets-Retirements-in-Edit-Mode-and-Auto-Reassignment-of-Subsequent-Balls-PCS-Pro), [Editing wickets on previous balls](https://play-cricket.ecb.co.uk/hc/en-us/articles/360001244777-Editing-or-Adding-Wickets-or-Retirements-to-Previous-Balls-PCS-Pro), [Changing bowler/batter](https://play-cricket.ecb.co.uk/hc/en-us/articles/360000241609-Changing-Bowler-Batter-PCS-Pro)
- **PlayHQ** (Cricket Australia's e-scoring): an options menu on every ball and every over. The bowler is changed for one ball or the whole over, and the over's figures move with it. The strike is fixed with "Update strike batter for subsequent balls this over". An event can be replaced (a dot by a run). A batter is swapped for the whole innings only before their first ball. [Editing bowlers, batters, runs and line-ups](https://support.playhq.com/hc/en-au/articles/9601067169561-Editing-bowlers-batters-value-of-runs-extras-team-line-ups), [Changing a batter or bowler](https://support.playhq.com/hc/en-us/articles/23973978575900-Changing-a-Batter-or-Bowler), [e-scoring booklet (PDF)](https://cncc.org.au/wp-content/uploads/PlayHQ-Cricket-EScoring-Booklet.pdf)
- **CricHeroes**: *Edit Scorecard*: tap a ball, a batter or a bowler. Editing stays open after the match (scorer and tournament creator until the tournament ends; captains for 8 days, their own innings). A saved edit cannot be undone. [How to edit scorecards](https://blog.cricheroes.com/?p=4955)
- **MyCricket** (Cricket Australia, older app): a pencil on each ball; delete only in the current over; undo any number of balls in reverse. [How to edit a ball](https://mycricketsupport.cricket.com.au/hc/en-us/articles/115001122243-How-to-Edit-a-Ball-Mobile)

The help centres block automated reading, so these summaries come from search-result excerpts of the pages linked, not full reads.

What they share: corrections start from the ball or the over; the scorer says how far a fix reaches; the app proposes the knock-on fix for later balls and asks; impossible states are refused with a reason. None of them shows the effect before saving or keeps a history of corrections, and none of them has to cope with two scorers on one match the way CricScore does.

## Principles

These are added to `/design#principles` (group "Fixing mistakes", `src/app/design/_sections/principles-data.ts`):

1. Start a fix where the mistake is seen: the ball, the over, the player on the scorecard.
2. Ask what happened, in cricket words ("The batters were at the wrong ends"), not which tool to use ("Replace").
3. Say how far a fix reaches: this ball, this over, until a chosen ball, the rest of the innings, the whole match.
4. Offer the knock-on fix for later balls; never apply it silently.
5. Show what will change before saving.
6. Never steer to a new player when the right one exists: name the similar player, and when they cannot be picked, say which fix to use instead.
7. Tell the other scorer what was corrected, by whom.

## Plan

### Phase 1: the corrections the 15 November matches needed

Mostly screens on the engine that exists, plus two engine operations built on `correctBallPlayers`.

#### 1.1 Correct balls after the match and in any innings

- *Edit balls* becomes *Fix a mistake* and is offered while the match is live **and** once it has ended (the scoring screen's finished card). The dialog lists every innings (a switch at the top, latest first), each over with its bowler, and each ball.
- The ball's teams follow its innings: the batting and bowling sides passed to Edit ball are those of the innings the ball is in, not of the innings in play.
- Engine: nothing new (`update_ball` already settles a finished match: `settleAfterEdit`).
- Acceptance: on a finished match a scorer can open any ball of either innings, edit it, and the scorecard, result and records follow.

#### 1.2 Change the bowler of a whole over

- In *Fix a mistake*, each over shows its bowler with *Change*. Picking another player of the bowling side moves every ball of that over to them (their figures, wickets and maidens follow). Fielders on the over's wickets are untouched; a catch credited to the wrong player is fixed on the ball.
- Two swapped overs are two changes (over 4 to Karan, over 6 to Kishor).
- Engine: `correct_over_bowler` `{ p_match_id, p_innings_id, p_over_number, p_bowler_id }`: the server takes the over's balls from the log and applies `correctBallPlayers` to them (events without a bowler stay as they are).
- Refused: a bowler from the batting side; an over with no balls.

#### 1.3 The batters were at the wrong ends

- On a ball: *The batters were at the wrong ends from here*. The scorer picks until when: the end of this over, the next wicket, the end of the innings, or a ball they tap. The sheet shows each batter's figures before and after (`recomputeInnings` on the phone, from the ball log the dialog has read).
- What it does: on every entry in the range the two batters at the crease on the first ball (A and B) change places: wherever the log names A it names B and the other way round (striker, non-striker, batter out). A wicket in the range moves with them, and after it the batter left in carries on under their real name.
- Engine: `swap_batters` `{ p_match_id, p_innings_id, p_from_ball_id, p_to_ball_id | null }` (null: the end of the innings), computed on the server from the log, applied with `correctBallPlayers`.
- Refused (engine, so every caller is covered): a batter named on a ball after being out (except a retired-hurt batter who resumes), the same batter at both ends.

#### 1.4 The wrong batter was given out

- In Edit ball, on a wicket that only the striker can suffer (caught, bowled, lbw, stumped, hit wicket), *Wrong batter given out? <non-striker> was out* explains: "For a caught wicket the batter out faced the ball, so <non-striker> was on strike. Their names change places from this ball to the end of the innings." It opens 1.3 with this ball as the start and the end of the innings as the end, with the preview.
- This is the Sandeep sir / Vinayak repair: Vinayak takes the 4.4 ball and the wicket, and the balls after it that the log gave Vinayak go to Sandeep sir, who batted on.
- A run out or obstructing the field keeps today's *Who was out* choice (either batter, no swap).

#### 1.5 Tell the other scorer what was corrected

- `live_state.last_change` carries what a correction did: `correction: { kind, over, ball, from_id, to_id, scope }` for `swap_batters`, `correct_over_bowler`, `update_ball`, `replace_batter` and `replace_player` (Replace sets `last_change` too, which it does not today).
- The scoring screen shows another scorer's correction as a strip under the header for two minutes, with the names resolved from the scorecard it holds: "Karan changed the bowler of over 4 to Karan Rajbhar", "Amit: Sandeep sir and Vinayak changed ends from 2.3 to the end of the innings". A plain ball keeps today's "X is also scoring" chip.
- No extra reads: it rides on the `live_state` the screen already follows.

#### 1.6 Similar names before adding a player

- Before a new player is created from a picker, a name that sounds like someone in either squad of the match (or found by the search) takes a second tap, as an identical name does today (`useSameNameCheck`): "Sandeep sir is in Vinayak 11's squad. Is this them?"
- The comparison drops honorifics (sir, bhai, ji, da), folds common spellings (ee/i, oo/u, aa/a, w/v, sh/s, doubled letters) and ignores case, spaces and accents: `similarName` in `~/lib/player-search`, one rule for every picker.
- When the similar player cannot be picked (already batted, out, in the match), the note says which fix to use ("If the names were mixed up, use *The batters were at the wrong ends* on the ball where it started").

#### Phase 1 engine and contract work

- `correctBallPlayers` gains `guardClientAction` (a re-sent action is not applied twice) and the batting-after-out check, and becomes the core of `swap_batters` and `correct_over_bowler`.
- The three operations are scoring actions like Edit ball: queue types and payload schemas (`~/lib/offline-queue`, `~/lib/scoring-replay/schemas.ts`, v1: new types need no new version), cases in `dispatch.ts`, server mutations next to `updateBall` in `app/matches/mutations.ts`, rpc names in `rpc/index.ts`, descriptions in `describe-action.ts`, and the replay contract test.
- Tests: engine tests per operation on the synthetic match (as `correct-ball-players.test.ts`), the replay contract, the dialogs (testing-library), and the 15 November cases replayed against copies of those matches.

### Phase 2: confidence

Phase 1 shipped on `matches-fixes`. Phase 2 makes corrections safe to trust: every one is previewed, recorded and can be undone, the right player can always be chosen, and search finds the spellings scorers actually type.

#### 2.1 Edit ball shows what changes

- Edit ball lists the figures that change before *Save*, as the other corrections do: each batter's and bowler's line old and new, and the innings total when it moves ("Total: 71/5 → 70/5"). When the match is over and the total moves, it says the result is worked out again.
- One implementation of an edited ball: `editedBall(ball, edit)` in `~/lib/firebase/scoring/ball-docs.ts` builds the entry `update_ball` stores, and the preview runs `recomputeInnings` over the log with it.
- The log: Fix a mistake hands over the innings it has read; from the keypad (a ball of this over) Edit ball reads the match's ball log when it opens, as Fix a mistake does (`getMatchBallLog`), and shows the form at once with the preview following.

#### 2.2 Corrections are recorded, can be undone, and never land on data that moved

- **Stale refusal.** A correction sends a stamp of the entries it was worked out from (`logStamp` in `~/lib/scoring-correction`: a hash of each entry's id, players, runs, extras and wicket fields, the same function on both sides). The engine compares it with the log it reads and refuses with `changed_meanwhile` when another scorer, or a ball scored meanwhile, changed them: "The balls changed since you opened this. Check them again." Edit ball stamps its ball; the batters' ends the range; an over's bowler the over. The stamp is optional (`expect`), so queued actions from before stay valid.
- **History.** Every correction (Edit ball, the batters' ends, an over's bowler, someone else batting from a ball, Replace, an undo) writes one `corrections/{id}` document in its transaction: `match_id`, `innings_id`, `at`, `by` (uid and name), the `CorrectionNote`, and the entries it changed with each one's fields before and after (`entries: [{ id, before, after }]`, only the fields that changed). Server-only (no rule needed: rules deny by default); read through `rpc("match_corrections")`, the latest 20, one indexed query (`match_id` + `at` desc), only when the history is opened. Deleted with the match (`delete_match`).
- **Undo.** *Fix a mistake* has a *History* view: each correction in words, who and when, and *Undo* on the latest corrections of the ball log that are not undone. `undo_correction` puts back each entry's `before` fields, refused with `changed_meanwhile` when an entry no longer holds its `after` fields (something later changed it; undo that first), then recomputes as any correction does and records the undo in the history (it cannot itself be undone; correct again instead). A Replace for the whole match is undone by moving the player back (`movePlayer`), refused when the player put back is now in the match.

#### 2.3 Someone else was batting, from a ball

- On a ball: *Someone else was batting from here*, picking the batter at either end (the striker or the non-striker) and who really batted, then until when (as the batters' ends). The batter named on the range's entries becomes the one picked: striker, non-striker, batter out. Unlike Replace, the balls before stay with the batter recorded, and the one picked may already be in the innings when the log allows it (not out, not at the other end; `battingAfterOut` and both ends checked).
- Engine: `rename_batter` `{ p_innings_id, p_from_ball_id, p_to_ball_id | null, p_from_id, p_to_id, p_expect }` on the same core.
- The Players page's Replace offers people already in the match too: picking one swaps the two players for the whole match (`swap_players`: every entry, scorecard and award naming one names the other), for two names mixed up all match long. The panel says so: "Vinayak's part and Sandeep sir's part change places."

#### 2.4 Merging a duplicate who appears in the same match

- In a match both appear in, `mergePlayer` refuses when they appear in the same innings (one person cannot be on both sides of an innings, or twice on one) **or played for different teams in that match** (each one's team in a match: the side they batted for, or fielded for when they only bowled or fielded). Two different people of one name on opposite sides never share an innings when neither bowls nor fields, so the innings rule alone would join them, and a merge cannot be undone. Otherwise the duplicate's innings are renamed to the player kept (scorecard, log, award) and the match's records are rebuilt, so one player has one record for the match. The Mahesh repair of 15 November (both for Vinayak 11: one batted, one bowled while Vinayak 11 fielded) is then one merge.
- The preview says how many matches have both: "In 1 match both appear, in different innings: their figures join."

#### 2.5 Search finds spelling variants

- Each searchable document's `search_prefixes` also holds one sound-alike token per word, `~` + its sound key (`soundKey` in `derive.mjs`, the rule `nameSoundKey` uses: "~sandip" for "Sandeep"); honorifics add none.
- `prefixSearch` looks them up only when the ordinary lookups found nobody, with the typed words' sound keys, and keeps the documents whose words all sound like the typed ones. A search that finds someone costs what it did; one that finds nobody costs one query more.
- `scripts/migrate-search-sound-keys.mjs` (idempotent, `--dry-run`, in `scripts/migrate.mjs`) rewrites `search_prefixes` of every searchable document from `derive.mjs`; the write path already does for new and renamed ones.

#### Phase 2 contract and tests

- New queued actions (v1, new types): `renameBatter`; `expect` added to `updateBall`, `swapBatters`, `correctOverBowler` (optional). `undoCorrection` and `swapPlayers` are server actions (online only, like Replace today).
- Tests: engine tests for the stamp, history, undo (including refused undo), rename, swap and same-match merge; the dialogs' new views; `prefixSearch` with sound tokens; the migration's plan; `read-costs.test.ts` still within its bounds.

### Phase 3: completeness

- Insert a missed ball and delete a stray one, with the strike follow-up for later balls (NV Play's Auto Correct): "Ball 3.4 now ends with Vinayak on strike. Update who faced the later balls of this over?".
- Edit retirements and penalty runs in place.
- *Check this match*: flags strike changes the runs do not explain, near-identical names, players created mid-match, a bowler in consecutive overs, an over with too many balls; offered on the finished card and before the result is shared.

## Open questions

- Who may correct a finished match, and for how long. Today any scorer of the match, with no limit (the engine allows it). CricHeroes limits captains to 8 days and their own innings; tournaments may want to lock results once the points table is final.
- Whether a correction to a match in a finished tournament should recalculate the points table (net run rate changes with the runs, not with who scored them; phase 1's corrections never change totals).

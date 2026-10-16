# AGENTS.md

Operating notes for agents working on **CricScore** (`cric-score-overlay`).

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Firebase: Auth, Firestore, Storage. Local dev uses the Emulator Suite (`npm run emulators`, `npm run seed`)
- Tailwind CSS + shadcn/ui primitives
- Vitest + Testing Library (jsdom)
- Dev server on port 3005 (`npm run dev`)

## Data layer

- Server code uses `createServerClient()` from `~/lib/firebase/server`; browser code uses `createClient()` / `firebase` from `~/lib/firebase`.
- Queries use the chainable builder in `~/lib/firebase/query-builder.ts` (`from().select().eq().order()...`). Embedded relations are resolved from `<singular>_id` columns or `table_column_fkey` hints.
- Named procedures (`rpc("record_ball", ...)`) are TypeScript functions in `~/lib/firebase/rpc/`. The scoring engine recomputes every innings from the ball log inside a Firestore transaction.
- Collection metadata (columns, defaults, unique constraints, cascades) lives in `~/lib/firebase/schema.ts`. Add a column there and in `types.ts` when the model changes.
- Writes never happen from the browser; `firestore.rules` only allows public reads.
- Realtime: viewers listen to the single `live_state/{matchId}` doc (`useLiveState`, `watchDoc`); its `version` is the change signal and heavier data refetches once per change, debounced. No polling and no collection listeners (their first snapshot bills every document). A server action that changes what viewers see must call `refreshLiveState` / `refreshLiveMatchesFor` from `~/lib/firebase/live-sync`.

## Working guidelines

1. Keep changes focused and minimal. Preserve existing behaviour and APIs.
2. Verify what you touch:
   ```bash
   npx vitest run <path/to/test.ts>
   npm run typecheck
   npm run lint
   ```
3. Frontend: responsive and accessible (ARIA, labels), `text-wrap: balance` for titles, `tabular-nums` for score figures, `content-visibility: auto` for long lists.
4. Visual style: calm sports-data look; scores are the hero, chrome stays quiet.
   - No decorative motion (`animate-ping`/`bounce`, glows, sparkles). The only pulse is the small red "Live" dot; skeletons and spinners keep theirs.
   - Icons only when they carry meaning; no Sparkles/Zap/Flame/Crown ornaments or emoji. Captain/keeper are "(c)"/"(wk)".
   - `font-semibold` headings, `font-bold` only for score figures; sentence-case labels instead of ALL-CAPS tracked micro-labels (table headers and the "LIVE" chip excepted).
   - Flat cards (`bg-card`, border, at most `shadow-sm`); no decorative gradients, coloured shadows or blur blobs. Colour signals state (live, wicket, boundary, win/loss) and primary actions.
   - Plain copy: no hype, no exclamation marks. The OBS overlay follows the same rules (no bold ALL-CAPS); team short codes are data and stay as-is.

## Local testing

- `npm run emulators` (Auth :9099, Firestore :8088, Storage :9199, UI :4000), then `npm run seed`, then `npm run dev` (port 3005). `npm run dev:local` does all three.
- Sign in with any seeded account, e.g. `john.smith@email.com` / `password123`. Sign-up is email + password or Google; phone sign-in is planned but not built.
- Emulator data lives in memory: re-seed after restarting the emulators.
- See "Troubleshooting" in `README.md` for the two environment traps (leftover service worker on port 3005, stale Turbopack cache after deleting files).

## Scoring screen

- `src/app/matches/[id]/score/page.tsx` composes `LiveMatchHUD`, `ScoringPanel` and the dialogs under `score/components/`. Match-level actions live in the Match Tools menu; squads are managed in `SquadManagerDialog`.
- Below 640px the layout is a single column that must fit one phone screen without scrolling: the HUD hides card headers and shows its controls inline (`useMediaQuery`), and the keypad grows to fill the remaining height (`max-sm:flex-1`). Keep new elements out of that column or hide them on phones.
- Undo removes the last ball and reopens the innings/match it closed; the ball log is the source of truth, so never patch totals directly.

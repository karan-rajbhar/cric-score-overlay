# AGENTS.md

Operating notes for agents working on **CricScore** (`cric-score-overlay`).

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Firebase: Auth (Google only), Firestore, Storage. Local dev uses the Emulator Suite or a cloud dev project, chosen in `.env.local`
- Tailwind CSS + shadcn/ui primitives
- Vitest + Testing Library (jsdom)
- Dev server on port 3005 (`npm run dev` adds a Cloudflare tunnel; `npm run dev:no-tunnel` without)

## Data layer

- Server code uses `createServerClient()` from `~/lib/firebase/server`; browser code uses `createClient()` / `firebase` from `~/lib/firebase`.
- Queries use the chainable builder in `~/lib/firebase/query-builder.ts` (`from().select().eq().order()...`). Embedded relations are resolved from `<singular>_id` columns or `table_column_fkey` hints.
- Named procedures (`rpc("record_ball", ...)`) are TypeScript functions in `~/lib/firebase/rpc/`. The scoring engine recomputes every innings from the ball log inside a Firestore transaction.
- Collection metadata (columns, defaults, unique constraints, cascades) lives in `~/lib/firebase/schema.ts`. Add a column there and in `types.ts` when the model changes.
- Scorecards live inside `innings` docs (`batting`, `bowling`, `fall_of_wickets`, `partnerships` arrays plus `last_ball` / `last_over_bowler_id` caches); the ball log is one `overs/{inningsId}_{over}` doc per over; `player_matches/{matchId}_{userId}` holds completed-innings figures for career pages (`~/lib/firebase/scorecard.ts`). `from("batting_performances" | "bowling_performances" | "fall_of_wickets" | "partnerships" | "ball_by_ball")` still works read-only via `legacy-rows.ts` (needs an `innings_id` / `match_id` filter, or `user_id` for batting/bowling). Only the scoring engine writes these documents.
- Writes never happen from the browser; `firestore.rules` only allows public reads.
- Derived copies are maintained on the server, never by callers (schema stage 3, `scripts/migrate-stage3.mjs` backfills them): search keys (`name_lower`/`title_lower`, `search_prefixes`) and roster / membership name snapshots by `derived-fields.ts` on every write; `matches.innings_summary`, `player_career_stats/{userId}` and the leaderboard shards `leaderboards/{scope}_{id}_{k}` (players hashed into `LEADERBOARD_SHARDS` = 8 per scope, `stats.mjs`; pages read all 8, an update touches only the changed players' shards) inside the scoring transactions (`innings-summary.ts`, `stats-sync.ts`); tournament / club / team snapshots on matches by the write hooks. Search with `prefixSearch` (`search.ts`), not `ilike` (which scans).
- `npx vitest run src/lib/firebase/read-costs.test.ts` bounds the billed reads of each hot page on the seed; keep new queries indexed (equality + order / limit or `array-contains` + order need an entry in `firestore.indexes.json`; the emulator does not check).
- `users` is public, so it holds no contact details. Email/phone live in server-only `users_private/{uid}` (`~/lib/firebase/user-private`); look up by exact email there, never return emails to the browser (a user's own email comes from their session).
- Matches carry `team1_snapshot` / `team2_snapshot` ({ id, name, short_name, logo_url }). Match lists select `MATCH_TEAM_COLUMNS` and call `attachMatchTeams` instead of embedding `teams`; the server write hook keeps snapshots fresh when a team's name/short name/logo changes. Embed `teams` only when full team data (rosters) is needed.
- Realtime: viewers listen to the single `live_state/{matchId}` doc (`useLiveState`, `watchDoc`); its `version` is the change signal. No polling and no collection listeners (their first snapshot bills every document). A server action that changes what viewers see must call `refreshLiveState` / `refreshLiveMatchesFor` from `~/lib/firebase/live-sync`.
- Live match page, zero server requests per ball: Summary / Scorecard / Top performers / Stats follow `live_scorecard/{matchId}` (compact scorecard of every innings, `live-scorecard.ts`; written by the scoring transactions and `writeLiveState`, built on first view by `ensureLiveScorecard`); the ball log re-reads only the `overs` docs named by `live_state.overs_changed` (`useMatchBallLogQuery`); `getMatch` refetches only on status / innings / `live_state.match_rev` changes. The overlay stays on `live_state` only.

## Auth and invites

- Sign-in is Google only and invite-only. `/api/auth/session` (`src/app/api/auth/session/route.ts`) calls `canSignIn` in `~/lib/firebase/rpc/access.ts`: allowed when the account already has a profile, its email is in `ALLOWED_EMAILS` (bootstrap admins; env var locally, Secret Manager secret `allowed-emails` in production), a seeded/placeholder profile has that email, or a pending invite / club invite exists. Refused accounts get a 403 and their new Auth account is deleted.
- Invites send no email: `InviteDialog` / `InviteShare` build a sign-in link message to share on WhatsApp or copy; the match scorers dialog invites new scorers the same way. There is no email/password sign-in, sign-up page or phone sign-in.

## Deploys and migrations

- Production: Firebase project `cricscore-prod-7411`, App Hosting backend `cricscore` (asia-southeast1, `apphosting.yaml`), Firestore in asia-southeast1 (delete protection, PITR, daily backups kept 7 days), domain cricscore.altorstudio.com (Cloudflare DNS, records DNS-only). Never deploy, push or touch the cloud project unless asked.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on PRs. A merge to `main` deploys Firestore rules + indexes, runs `node scripts/migrate.mjs`, then rolls out that commit on App Hosting. `main` is protected (PR only, required check).
- Monitoring: Cloud Monitoring uptime check on `/api/health`, alerts on downtime and logged errors; browser errors reach the server log via `/api/client-error`.
- Offline / PWA: `public/sw.js` (hand-written) is registered by `ServiceWorkerRegistrar` only in production on https (never dev or localhost; there it unregisters any worker). Each build installs a new worker (`/sw.js?v=<NEXT_PUBLIC_BUILD_ID>`) with fresh caches; updates wait for the "New version available" toast, which is held back while scoring actions are queued. It caches `/_next/static`, icons and manifest, and `/matches/:id/score` HTML (network-first); it never touches POST / server actions, RSC fetches, `/api`, `/__/*` or other origins. Kill switch: set `"disabled": true` in `public/sw-config.json` and deploy (workers unregister and drop their caches on the next navigation or activation); `NEXT_PUBLIC_SW_DISABLED=true` at build also unregisters from the page.
- Mid-match deploys are safe for queued scoring actions: the offline queue replays through the stable route `POST /api/scoring/replay`, not server actions (whose ids change every build, so a pre-deploy client got "Failed to find Server Action"). Online direct actions stay server actions. Contract in `~/lib/scoring-replay/protocol.ts` (zod schemas in `schemas.ts`): `{ v, matchId, actions: [{ id, type, payload, queuedAt }] }`. To change a payload shape incompatibly, add v2 schemas and keep accepting v1 (old queues outlive deploys); an optional field or a new action type needs no new version. An unknown `v` gets 400 `unsupported_version` and the client keeps its queue.
- Data migrations are idempotent `scripts/migrate-<name>.mjs` scripts (`--project=<id>`, `--dry-run`), listed in order in `scripts/migrate.mjs`, which records applied ones in the `_migrations` collection so each runs once per project. Never auto-run destructive steps (e.g. `migrate-stage2 --delete-old`); do those by hand after verifying.

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

- `npm run dev:local`: emulators (Auth :9099, Firestore :8088, Storage :9199, UI :4000) + `seed --if-empty` + `dev:no-tunnel` on :3005. Emulator data persists in `firebase/emulator-data` across restarts; `npm run seed` wipes and reloads (Firestore and Auth).
- `npm run dev`: dev server + Cloudflare tunnel (`scripts/dev-tunnel.sh`) for phones; fixed host with `DEV_TUNNEL_NAME` / `DEV_TUNNEL_HOST` in `.env.local`, else a random trycloudflare URL. It registers the host as an Auth authorized domain (`scripts/firebase-auth-domain.mjs`) and skips the tunnel when the emulators are in use.
- Cloud dev project instead of emulators: set `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false`, the Firebase config and `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local`. `npm run seed -- --project=<id>` refuses ids containing "prod".
- Signing in on the emulator: "Sign in with Google" → **Add new account** in the fake picker → a seeded email such as `john.smith@email.com` (`scripts/seed-emulator.mjs`; seeded users have no passwords).
- Environment traps (details in `README.md` → Troubleshooting): leftover service worker on port 3005; stale Turbopack cache after deleting files; `ChunkLoadError` or hangs over the tunnel. For the last two, stop the dev server, `rm -rf .next`, restart.

## Scoring screen

- `src/app/matches/[id]/score/page.tsx` composes `LiveMatchHUD`, `ScoringPanel` and the dialogs under `score/components/`. Match-level actions live in the Match Tools menu; squads are managed in `SquadManagerDialog`.
- Below 640px the layout is a single column that must fit one phone screen without scrolling: the HUD hides card headers and shows its controls inline (`useMediaQuery`), and the keypad grows to fill the remaining height (`max-sm:flex-1`). Keep new elements out of that column or hide them on phones.
- Undo removes the last ball and reopens the innings/match it closed; the ball log is the source of truth, so never patch totals directly.
- Offline: actions are queued in localStorage (`~/lib/offline-queue`) and replayed in order, one flusher per match, in batches of 10 to `/api/scoring/replay` (`src/app/api/scoring/replay/`: session cookie, same-origin `Origin`, JSON only, 64 KiB / 20 actions). It runs each action through the same mutation as the server action, with the queue id as `p_client_action_id`, stops at the first failure and answers `applied` / `duplicate` / `failed` per action. A new queueable action type needs a schema in `schemas.ts` (it fails to compile otherwise), a case in `dispatch.ts`, and engine code that calls `guardClientAction` so a re-sent batch is not applied twice.

# CricScore

Live cricket scoring, club and tournament management, and an OBS browser-source overlay.
Built with Next.js 16, React 19 and Firebase (Auth, Firestore, Storage).

Production: https://cricscore.altorstudio.com

## Run it locally

Requirements: Node 22+ and a Java 21+ runtime for the emulators
(`brew install openjdk@21` on macOS; the launcher finds it automatically).

### Against the emulators (no Firebase project needed)

```bash
cp .env.example .env.local   # NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
npm install
npm run dev:local            # emulators + seed (only if empty) + dev server
```

Or in separate terminals: `npm run emulators`, then `npm run seed` once, then
`npm run dev:no-tunnel`. The app is on http://localhost:3005 and the emulator UI
on http://localhost:4000.

Emulator data is saved to `firebase/emulator-data` when the emulators stop and
loaded on the next start, so seeding is needed once. `npm run seed` wipes and
reloads everything (Firestore and Auth accounts); `--keep` adds the seed without
wiping, `--if-empty` skips when data exists. Delete `firebase/emulator-data` to
start from scratch.

### Signing in

Sign-in is **Google only** and **invite-only**: there is no email/password login
and no sign-up page. An account may sign in when it already has a profile, its
email is on the `ALLOWED_EMAILS` list (the first admins), or someone invited
that email. Anyone else is refused and their new Auth account is deleted.

In the emulator, click "Sign in with Google", choose **Add new account** in the
fake account picker and enter a seeded email, e.g. `john.smith@email.com`. The
first sign-in with a seeded email takes over that demo profile (seeded users have
no passwords; see `scripts/seed-emulator.mjs`).

Signed-in users invite others from the Invite dialog (navigation bar, dashboard,
player pages). No email is sent: the dialog produces a message with a sign-in
link to send on WhatsApp or copy. A match's scorers dialog does the same for
someone new invited as a scorer of that match.

### Against a cloud dev project

Set `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false`, the `NEXT_PUBLIC_FIREBASE_*`
values, `FIREBASE_SERVICE_ACCOUNT_JSON` and `ALLOWED_EMAILS` in `.env.local`
(see `.env.example`). `npm run seed -- --project=<id>` loads the demo data into
a dev project; it refuses any project id containing "prod".

### Phone testing over a tunnel

`npm run dev` runs the dev server plus a Cloudflare tunnel (`scripts/dev-tunnel.sh`,
needs `cloudflared`). It prints a random `*.trycloudflare.com` URL each run, or a
fixed address when `DEV_TUNNEL_NAME` and `DEV_TUNNEL_HOST` are set in
`.env.local`. The tunnel host is added to the project's Auth authorized domains
(`scripts/firebase-auth-domain.mjs`) so Google sign-in works on the phone; quick
tunnel hosts are removed on exit. With the emulators in use it skips the tunnel,
because a phone can't reach them (set `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` to
your LAN IP to test on the same Wi-Fi instead).

### Ports

| Port        | Owner                     | Purpose                                          |
| ----------- | ------------------------- | ------------------------------------------------ |
| 3005        | `npm run dev`             | The app                                          |
| 8088        | Firestore emulator (Java) | Database API (8080 is left free for other tools) |
| 9099        | Auth emulator             | Sign-in                                          |
| 9199        | Storage emulator          | Logos and club assets                            |
| 4000        | Emulator UI               | Browse and edit emulator data                    |
| 4400, 4500  | Emulator hub and logging  | Internal to the Emulator Suite                   |
| 9150        | Firestore emulator        | WebSocket used by the Emulator UI                |
| random high | Firestore emulator (Java) | Internal listeners of the same Java process      |

Only 3005, 8088, 9099 and 9199 are used by the app. Set `"ui": { "enabled": false }`
in `firebase.json` to drop 4000 and 9150.

### Troubleshooting

- **"module factory is not available" or stale chunks after a reload.** Another
  app that once ran on `localhost:3005` may have left a service worker behind
  (this project has none). Unregister it in DevTools → Application → Service
  Workers and clear its caches.
- **`ENOENT ... stat <deleted file>` from `globals.css` after deleting a source
  file.** Turbopack cached the Tailwind file list. Stop the dev server, delete
  `.next`, and start it again.
- **`ChunkLoadError` or pages hanging over the tunnel.** Stop the dev server,
  `rm -rf .next`, and start it again.

## Scripts

| Command                    | What it does                                                |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Dev server on port 3005 + Cloudflare tunnel                 |
| `npm run dev:no-tunnel`    | Dev server only                                             |
| `npm run dev:local`        | Emulators + `seed --if-empty` + `dev:no-tunnel`             |
| `npm run tunnel`           | Tunnel to an already running dev server                     |
| `npm run emulators`        | Firebase emulators (Auth, Firestore, Storage)               |
| `npm run seed`             | Load `firebase/seed/data.json` (emulator or dev project)    |
| `npm test`                 | Vitest, single run                                          |
| `npm run lint`             | ESLint                                                      |
| `npm run typecheck`        | `tsc --noEmit`                                              |
| `npm run build`            | Production build                                            |
| `node scripts/migrate.mjs` | Run pending data migrations (emulator, or `--project=<id>`) |

## How it is put together

```
src/
├── app/                  # App Router pages, server actions, API routes
│   ├── api/auth/session/ # ID token -> session cookie (invite-only check)
│   ├── api/health/       # Uptime check
│   ├── api/client-error/ # Browser errors -> server log
│   ├── auth/login/       # Google sign-in
│   ├── invitations/      # Invite actions
│   ├── matches/          # List, create, detail, live scoring
│   ├── overlay/[matchId] # OBS browser source + producer control room
│   └── clubs/ teams/ tournaments/ players/ search/ dashboard/
├── components/           # UI (shadcn/ui primitives under ui/)
└── lib/
    ├── firebase/         # Data layer
    │   ├── client.ts     # Browser SDK: reads, realtime channels
    │   ├── server.ts     # Admin SDK: reads, writes, named procedures
    │   ├── query-builder.ts  # from().select().eq()... over Firestore
    │   ├── rpc/          # Scoring engine, profiles, access, standings, permissions
    │   ├── scoring/      # Pure innings recompute + result rules
    │   └── views.ts      # Computed live-match and over-summary views
    └── auth.tsx          # Auth context (Google sign-in)
```

**Data.** Each Firestore collection mirrors one domain table (`matches`, `innings`,
`teams`, ...). Documents use snake*case fields and ISO timestamps. An innings
document holds its own scorecard, the ball log is one `overs/{inningsId}*{over}`document per over, and`player*matches` keeps each player's figures per match.
Career stats (`player_career_stats/{userId}`) and tournament / club leaderboards
(`leaderboards/{scope}*{id}\_{k}`, players hashed into 8 shards so a scope never
hits the 1 MiB document limit) are updated incrementally from `player_matches`.

**Auth.** The browser signs in with Google and posts its ID token to
`/api/auth/session`, which checks access (`lib/firebase/rpc/access.ts`), sets an
HTTP-only session cookie, ensures a `users` profile and accepts pending invites.
Server code verifies that cookie with the Admin SDK.

**Scoring.** Every delivery runs through `lib/firebase/rpc/scoring.ts` inside a
Firestore transaction. The ball log is the source of truth: figures, partnerships,
fall of wickets and totals are recomputed from it on every change, so undo and
edits can never leave the scorecard stale.

**Realtime.** Clients listen to Firestore for changes to a match and exchange
light broadcast messages under `broadcasts/{topic}/messages` (score pings and
overlay producer commands). Messages carry a TTL field so Firestore expires them.

**Security.** All writes go through server actions using the Admin SDK after
permission checks. `firestore.rules` and `storage.rules` only grant browsers the
public reads the app needs.

## Production

- **Hosting.** Firebase project `cricscore-prod-7411`, App Hosting backend
  `cricscore` in asia-southeast1, configured by `apphosting.yaml`. `ALLOWED_EMAILS`
  comes from the Secret Manager secret `allowed-emails`.
- **Domain.** `cricscore.altorstudio.com`, DNS on Cloudflare. The records must be
  DNS-only (grey cloud), not proxied.
- **Database.** Firestore in asia-southeast1 with delete protection,
  point-in-time recovery and daily backups (7-day retention).
- **Deploys.** `.github/workflows/ci.yml` runs lint, typecheck, tests and build on
  every PR. A merge to `main` then deploys Firestore rules and indexes, runs
  `node scripts/migrate.mjs` (pending data migrations, recorded in `_migrations`),
  and creates an App Hosting rollout of that commit. `main` is protected: changes
  land by PR with the check passing.
- **Migrations.** Add `scripts/migrate-<name>.mjs` (idempotent, `--project` and
  `--dry-run`, emulator by default) and append its name to `MIGRATIONS` in
  `scripts/migrate.mjs`.
- **Monitoring.** A Cloud Monitoring uptime check on `/api/health`, with alerts
  for downtime and for logged errors. Browser errors reach the log through
  `/api/client-error`.

The `Dockerfile`, `docker-compose.yml` and `Caddyfile` remain for self-hosting
on any Docker host; production does not use them.

## OBS overlay

Add a Browser Source pointing at `https://<host>/overlay/<matchId>` at 1920×1080.
Open `/overlay/<matchId>/control` (match admins only) to push cards, stings and
tickers to the overlay. `/overlay/test` renders demo data without a match.

# CricScore

Live cricket scoring, club and tournament management, and an OBS browser-source overlay.
Built with Next.js 16, React 19 and Firebase (Auth, Firestore, Storage).

## Run it locally

Everything runs against the Firebase Emulator Suite. No Firebase project, keys or
network access are needed. Requirements: Node 22+ and a Java 21+ runtime for the emulators (`brew install openjdk@21` on macOS; the launcher finds it automatically).

```bash
npm install
npm run emulators     # terminal 1: Auth :9099, Firestore :8088, Storage :9199, UI :4000
npm run seed          # once: loads demo clubs, teams, matches and accounts
npm run dev           # terminal 2: http://localhost:3005
```

Or in a single terminal:

```bash
npm run dev:local     # starts the emulators, seeds, then runs the dev server
```

Sign in with any seeded account, for example `john.smith@email.com` / `password123`.
Google sign-in works too: the Auth emulator shows a fake account picker.
Browse data at the emulator UI, http://localhost:4000.

Emulator data is in memory. Re-run `npm run seed` after restarting the emulators
(`npm run seed -- --keep` adds the seed without wiping what is already there). A full
re-seed also recreates the demo accounts, so sign in again afterwards.

Testing from a phone on the same Wi-Fi: set `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`
to your LAN IP in `.env` so the browser can reach the emulators.

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

Only 3005, 8088, 9099 and 9199 are used by the app. The rest belong to the
Emulator Suite; set `"ui": { "enabled": false }` in `firebase.json` to drop 4000
and 9150. Stopping `npm run emulators` (Ctrl+C) shuts down the Java process too.

### Troubleshooting

- **"module factory is not available" or stale chunks after a reload.** Another
  app that once ran on `localhost:3005` may have left a service worker behind
  (this project has none). Unregister it in DevTools → Application → Service
  Workers and clear its caches.
- **`ENOENT ... stat <deleted file>` from `globals.css` after deleting a source
  file.** Turbopack cached the Tailwind file list. Stop the dev server, delete
  `.next`, and start it again.

## Scripts

| Command              | What it does                                     |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Next.js dev server on port 3005                  |
| `npm run emulators`  | Firebase emulators (Auth, Firestore, Storage)    |
| `npm run seed`       | Load `firebase/seed/data.json` into the emulator |
| `npm run dev:local`  | Emulators + seed + dev server in one terminal    |
| `npm test`           | Vitest, single run                               |
| `npm run test:watch` | Vitest in watch mode                             |
| `npm run lint`       | ESLint                                           |
| `npm run typecheck`  | `tsc --noEmit`                                   |
| `npm run build`      | Production build                                 |

## How it is put together

```
src/
├── app/                  # App Router pages, server actions, API routes
│   ├── api/auth/session/ # Exchanges a Firebase ID token for the session cookie
│   ├── auth/             # Login, signup, password reset
│   ├── matches/          # List, create, detail, live scoring
│   ├── overlay/[matchId] # OBS browser source + producer control room
│   └── clubs/ teams/ tournaments/ players/ search/
├── components/           # UI (shadcn/ui primitives under ui/)
└── lib/
    ├── firebase/         # Data layer
    │   ├── client.ts     # Browser SDK: reads, realtime channels
    │   ├── server.ts     # Admin SDK: reads, writes, named procedures
    │   ├── query-builder.ts  # from().select().eq()... over Firestore
    │   ├── rpc/          # Scoring engine, profiles, standings, permissions
    │   ├── scoring/      # Pure innings recompute + result rules
    │   └── views.ts      # Computed live-match and over-summary views
    └── auth.tsx          # Auth context (email + password, Google)
```

**Data.** Each Firestore collection mirrors one domain table (`matches`, `innings`,
`teams`, ...). Documents use snake_case fields and ISO timestamps. An innings
document holds its own scorecard (batting, bowling, fall of wickets and
partnership arrays), the ball log is one `overs/{inningsId}_{over}` document per
over, and `player_matches` keeps each player's figures per match for career
pages (see `lib/firebase/scorecard.ts`). Queries on the former row collections
(`batting_performances`, `ball_by_ball`, ...) are answered from those documents.

**Auth.** The browser signs in with Firebase Auth and posts its ID token to
`/api/auth/session`, which sets an HTTP-only session cookie and ensures a
`users` profile exists. Server code verifies that cookie with the Admin SDK.

**Scoring.** Every delivery runs through `lib/firebase/rpc/scoring.ts` inside a
Firestore transaction. The ball log is the source of truth: batting and bowling
figures, partnerships, fall of wickets and innings totals are recomputed from it
on every change, so undo and in-place edits can never leave the scorecard stale.

**Realtime.** Clients listen to Firestore for changes to a match and exchange
light broadcast messages under `broadcasts/{topic}/messages` (score pings and
overlay producer commands). Messages carry a TTL field so Firestore expires them.

**Security.** All writes go through server actions using the Admin SDK after
permission checks. `firestore.rules` and `storage.rules` only grant browsers the
public reads the app needs.

## Deploying

1. Create a Firebase project, enable Email/Password and Google sign-in, Firestore
   and Storage.
2. Deploy rules: `npx firebase deploy --only firestore:rules,firestore:indexes,storage --project <id>`.
3. Set the `NEXT_PUBLIC_FIREBASE_*` values and `FIREBASE_SERVICE_ACCOUNT_JSON`
   (see `.env.example`), with `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false`.
4. Build and run with Docker: `docker compose up -d --build` (Caddy terminates TLS;
   set `APP_DOMAIN` and `LETSENCRYPT_EMAIL`). Copy the repo to any Docker host
   and run the same command there.

## OBS overlay

Add a Browser Source pointing at `http://<host>:3005/overlay/<matchId>` at 1920×1080.
Open `/overlay/<matchId>/control` (match admins only) to push cards, stings and
tickers to the overlay. `/overlay/test` renders demo data without a match.

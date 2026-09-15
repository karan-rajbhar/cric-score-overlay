# 🏏 Cricket Platform - Modern Live Scoring & Management

A professional cricket management platform built with Next.js 16, React 19, and Supabase. Live scoring, club management, and OBS streaming overlay integration.

## ✨ Features

- **🔴 Live Scoring**: Ball-by-ball scoring interface
- **📺 OBS Integration**: Browser-source overlay at `/overlay/[matchId]`
- **🏆 Team & Match Management**: Clubs, teams, players, matches
- **🔐 Authentication**: Supabase Auth (email + OAuth)
- **🎯 Type-Safe**: End-to-end TypeScript with auto-generated Supabase types

## 🚀 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19
- **Backend**: Next.js Server Actions + Supabase (PostgreSQL, Auth, Storage)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Testing**: Vitest + Testing Library
- **Quality**: ESLint (flat config) + Prettier + Husky pre-commit hooks
- **CI**: GitHub Actions (lint → typecheck → test → build)

## 📋 Prerequisites

- Node.js 22+ (see `.nvmrc`)
- npm
- Docker (for local Supabase)

## 🛠️ Quick Start

```bash
npm install

# First-time setup: install deps + start local Supabase (migrations + seed data)
make first-time

# Start development (Supabase + Next.js on port 3001)
make dev
```

Or without make:

```bash
npx supabase start   # local Postgres/Auth/Storage/Realtime + Studio at :54323
npm run dev          # http://localhost:3001
```

Copy `.env.example` to `.env.local` for cloud Supabase; local dev works with defaults.

## 🧪 Scripts

| Command              | What it does                            |
| -------------------- | --------------------------------------- |
| `npm run dev`        | Dev server (port 3001)                  |
| `npm run build`      | Production build                        |
| `npm run lint`       | ESLint                                  |
| `npm run typecheck`  | `tsc --noEmit`                          |
| `npm run check`      | Lint + typecheck + tests (quality gate) |
| `npm test`           | Run tests once (Vitest)                 |
| `npm run test:watch` | Tests in watch mode                     |
| `npm run format`     | Format everything with Prettier         |
| `npm run db:types`   | Regenerate Supabase DB types            |

Makefile equivalents exist for most (`make test`, `make coverage`, `make db-reset`, …).

## 🤖 Automated Testing

Powered by **Vitest** + **@testing-library/react** in jsdom:

- Config: `vitest.config.ts` (path alias `~/` → `src/`, setup in `vitest.setup.ts`)
- Tests live next to the code as `*.test.ts(x)`
- Coverage: `npm run test:coverage`

```bash
npm test                 # single run (CI mode)
npm run test:watch       # watch mode while developing
```

Pre-commit hooks (Husky + lint-staged) auto-format and lint-fix staged files.
CI runs the full gate — lint, typecheck, tests, build — on every push/PR.

## 🏗️ Project Structure

```
src/
├── app/                  # Next.js App Router pages & server actions
│   ├── auth/             # Login, signup, OAuth callback
│   ├── dashboard/
│   ├── matches/          # List, create, detail, scoring panel
│   ├── overlay/[matchId]/ # OBS browser-source overlay
│   └── teams/
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── matches/          # Scoring panel, batsmen, bowler, stats
│   └── teams/
├── lib/                  # Supabase clients (browser/server), auth context
├── styles/
├── types/                # Domain types (cricket.ts)
└── env.js                # Env validation (@t3-oss/env-nextjs)
supabase/
├── config.toml           # Local dev configuration
├── migrations/           # Database schema migrations
└── seed.sql              # Sample data
```

## 🎯 Usage

### For Scorers

1. Create teams, then create a match from the dashboard
2. Open the match and start ball-by-ball scoring
3. Share the match URL with viewers

### For Streamers (OBS)

1. Add a **Browser Source** in OBS
2. URL: `http://localhost:3001/overlay/<matchId>` (1920×1080)
3. Check "Shutdown source when not visible"

## 📦 Database Schema

Managed via SQL migrations in `supabase/migrations/`. Core tables:
`profiles`, `clubs`, `teams`, `team_players`, `matches`, `innings`,
`batting_performances`, `bowling_performances`, `ball_by_ball`.

After changing the schema locally:

```bash
make db-reset    # replay migrations + seed
make types       # regenerate src/lib/supabase/types.ts
```

## 🚀 Deployment

1. Push to GitHub — CI validates every PR
2. Create a Supabase project, run `npx supabase db push`
3. Deploy to Vercel, setting `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

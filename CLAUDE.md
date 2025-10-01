# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Commands
- `make dev` - Start full development environment (Supabase + Next.js server)
- `make server` - Start only Next.js development server
- `make stop` - Stop all development services
- `make build` - Build application for production
- `make lint` - Run ESLint linting
- `pnpm dev` - Start Next.js development server on port 3001
- `pnpm build` - Build the application
- `pnpm lint` - Run linting

### Database Commands
- `make db-start` - Start Supabase local development stack
- `make db-stop` - Stop Supabase
- `make db-reset` - Reset database to initial state
- `make db-studio` - Open Supabase Studio at http://localhost:54323
- `pnpm supabase:start` - Start Supabase services
- `pnpm supabase:stop` - Stop Supabase services
- `pnpm supabase:reset` - Reset Supabase database

### Setup Commands
- `make first-time` - Complete first-time setup (install deps + start database)
- `make install` - Install dependencies with pnpm
- `make setup` - Install dependencies and start database

## Project Architecture

### Tech Stack
- **Frontend**: Next.js 14 with App Router, React, TypeScript
- **Backend**: tRPC for type-safe API, Next.js API routes
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **Authentication**: Supabase Auth with middleware protection
- **Styling**: Tailwind CSS with shadcn/ui components
- **Package Manager**: pnpm (required)

### Key Architecture Patterns

#### tRPC Integration
- API routes defined in `src/server/api/routers/`
- Main router in `src/server/api/root.ts`
- Client-side tRPC setup in `src/trpc/react.tsx`
- Server-side client in `src/trpc/server.ts`
- All API calls are type-safe and auto-generated

#### Supabase Client Architecture
- Multiple Supabase client configurations for different contexts:
  - `src/lib/supabase/client.ts` - Client-side operations
  - `src/lib/supabase/server.ts` - Server-side operations
  - `src/lib/supabase/actions.ts` - Server actions
  - `src/lib/db.ts` - Legacy client (being phased out)
- Client-safe exports in `src/lib/supabase/index.ts`

#### Authentication Flow
- Middleware in `middleware.ts` handles route protection
- Dashboard routes require authentication
- OAuth callback processing at `/auth/callback`
- Protected routes use `ProtectedRoute` component or `useProtectedRoute` hook

#### Real-time Features
- Supabase real-time subscriptions for live scoring
- WebSocket connections for instant updates
- Real-time overlay synchronization for OBS streaming

### Core Domain Models

#### Cricket Data Structure
- **CricketMatch**: Main match entity with teams, scores, and status
- **Team**: Contains players, bowlers, scores, and extras
- **Player**: Individual player stats and status
- **Bowler**: Bowling statistics and performance
- **ScoringEvent**: Type-safe scoring events (runs, wickets, extras)

#### Database Schema
- Uses Supabase PostgreSQL with migrations in `supabase/migrations/`
- Real-time subscriptions enabled on match data
- Row Level Security (RLS) for data access control

### Component Structure

#### UI Components
- Built with shadcn/ui components in `src/components/ui/`
- Custom cricket components:
  - `ScoreCard` - Display match scores
  - `NavigationBar` - Main navigation
  - `ProtectedRoute` - Authentication wrapper

#### Page Structure
- Next.js 14 App Router in `src/app/`
- Dynamic overlay routes at `/overlay/[matchId]` for OBS integration
- Dashboard at `/dashboard` (protected)
- Auth pages at `/auth/*`

### Development Workflow

#### Local Development
1. Run `make first-time` for initial setup
2. Use `make dev` to start full development stack
3. Access app at http://localhost:3001
4. Access Supabase Studio at http://localhost:54323

#### Environment Setup
- Local development uses Supabase CLI (no env vars needed)
- Production requires Supabase project URL and keys
- Environment validation in `src/env.js`

#### Code Organization
- Type definitions in `src/types/cricket.ts`
- Server logic in `src/server/`
- Client utilities in `src/lib/`
- Styles in `src/styles/globals.css`

### Testing and Quality

#### Linting
- ESLint configuration in `eslint.config.js`
- Run with `make lint` or `pnpm lint`
- TypeScript strict mode enabled

#### Build Process
- Next.js build with `make build`
- Outputs to `.next/` directory
- Production deployment ready

### Cricket-Specific Features

#### Live Scoring
- Ball-by-ball scoring with real-time updates
- Support for T20, ODI, TEST, and T10 formats
- Comprehensive scoring events (runs, wickets, extras)

#### OBS Integration
- Overlay pages at `/overlay/[matchId]`
- Real-time score updates without refresh
- Designed for 1920x1080 streaming resolution

#### Match Management
- Tournament and club organization
- Player statistics and performance tracking
- Match status management (upcoming, live, completed)

### Important Notes

- Always use pnpm for package management
- Database changes require migrations in `supabase/migrations/`
- Real-time features depend on Supabase subscriptions
- OBS overlays are optimized for streaming use cases
- Authentication state is managed through Supabase Auth
- Type safety is enforced throughout the application via tRPC and TypeScript
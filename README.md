# 🏏 Cricket Platform - Modern Live Scoring & Management

A professional cricket management platform built with Next.js, tRPC, and Supabase. Perfect for live scoring, club management, and OBS streaming integration.

## ✨ Features

- **🔴 Live Scoring**: Real-time ball-by-ball scoring with instant updates
- **📺 OBS Integration**: Professional overlay for live streaming
- **🏆 Tournament Management**: Create and manage tournaments and clubs
- **📱 Mobile Ready**: Works seamlessly on mobile devices
- **⚡ Real-time Updates**: Powered by Supabase real-time subscriptions
- **🎯 Type-Safe**: End-to-end TypeScript with tRPC and auto-generated Supabase types
- **🔐 Authentication**: Built-in user management with Supabase Auth
- **💾 File Storage**: Integrated media storage with Supabase Storage

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: tRPC, Next.js API Routes
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Styling**: Tailwind CSS
- **Local Development**: Supabase CLI
- **Package Manager**: pnpm
- **Deployment**: Vercel + Supabase

## 📋 Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn
- Docker (for Supabase local development)

## 🛠️ Quick Start

### Option 1: Local Development (Recommended)

```bash
# Clone and install
git clone <your-repo-url>
cd cricket-platform
pnpm install

# First-time setup (installs Supabase CLI and starts local stack)
make first-time

# Start development
make dev
```

This will:
- Install all dependencies
- Set up Supabase CLI
- Start local PostgreSQL, Auth, Storage, and Realtime
- Run database migrations
- Seed with sample data
- Start the Next.js development server

Open [http://localhost:3001](http://localhost:3001) to see the app.
Supabase Studio will be available at [http://localhost:54323](http://localhost:54323).

### Option 2: Production Supabase

If you prefer to use Supabase cloud:

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your keys
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

4. Run the migrations:
```bash
npx supabase db push
```

5. Start development:
```bash
pnpm dev
```

## 🎯 Usage

### For Scorers

1. **Create a Match**: Use the tRPC API to create matches and teams
2. **Start Scoring**: Use the scoring interface to update scores in real-time
3. **Manage Players**: Add/edit player details and statistics
4. **Share**: Share the match URL with viewers

### For Streamers (OBS Integration)

1. **Get Overlay URL**: For any match, the overlay is available at `/overlay/[matchId]`
2. **Add to OBS**: 
   - Add a "Browser Source" in OBS
   - Set URL to `http://localhost:3001/overlay/1` (demo match)
   - Set Width: 1920, Height: 1080
   - Check "Shutdown source when not visible"
3. **Customize**: Position and resize the overlay as needed
4. **Go Live**: The overlay will update in real-time as scores change

### Example Overlay URLs
- `http://localhost:3001/overlay/1` - Demo match overlay
- `http://localhost:3001/overlay/match_123` - Specific match overlay

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Homepage
│   ├── api/               # tRPC API routes
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts
│   └── overlay/           # OBS overlay pages
│       └── [matchId]/
│           └── page.tsx
├── lib/                   # Utilities and configurations
│   └── db.ts             # Supabase client setup
├── server/               # tRPC backend
│   └── api/
│       ├── trpc.ts       # tRPC configuration
│       ├── root.ts       # Main router
│       └── routers/      # API route handlers
│           └── matches.ts
├── trpc/                # tRPC client configuration
│   ├── react.tsx        # React Query provider
│   ├── server.ts        # Server-side client
│   └── shared.ts        # Shared utilities
├── styles/              # Global CSS and Tailwind
│   └── globals.css
├── types/               # TypeScript type definitions
│   └── cricket.ts
└── supabase/            # Supabase configuration
    ├── config.toml      # Local development config
    ├── migrations/      # Database migrations
    └── seed.sql         # Sample data
```

## 📊 Database Schema

The platform uses Supabase PostgreSQL with the following main tables:

```sql
-- Authentication (built into Supabase)
auth.users                 # User authentication

-- Core application tables
profiles                   # User profiles (extends auth.users)
clubs                     # Cricket clubs and organizations
tournaments               # Tournament management
teams                     # Team information
players                   # Player details and statistics
matches                   # Match metadata and status
innings                   # Innings-level data
batting_performances      # Individual batting statistics
bowling_performances      # Individual bowling statistics
ball_by_ball             # Detailed ball-by-ball scoring data
```

### Real-time Subscriptions

All tables support real-time updates through Supabase's built-in WebSocket connections:
- Live score updates
- Match status changes
- Player performance updates
- Real-time overlay synchronization

## 🔄 Real-time Features

The platform uses Supabase Realtime for instant updates:

- **Live Scoring**: Scores update across all connected clients instantly
- **Match Status**: Real-time match state changes
- **Player Statistics**: Live player performance updates
- **Overlay Updates**: OBS overlays update automatically without refresh
- **Connection Management**: Automatic reconnection on network issues

## 🎨 Customization

### Themes
- Default cricket theme (green/red)
- Dark mode support
- Custom color schemes via Tailwind

### Overlay Customization
- Multiple layout options
- Custom team colors
- Adjustable font sizes
- Show/hide specific elements
- Real-time theme switching

## 📱 Mobile Support

The platform is fully responsive and optimized for:
- **Mobile browsers** for live scoring on the go
- **Tablet devices** perfect for scorers and umpires
- **Desktop** for full management and administration
- **Touch interfaces** with large, accessible buttons

## 🚀 Deployment

### Vercel + Supabase (Recommended)

1. **Deploy Database**:
   - Create a Supabase project
   - Run migrations: `npx supabase db push`

2. **Deploy Frontend**:
   - Push your code to GitHub
   - Connect your repo to Vercel
   - Add environment variables in Vercel dashboard:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```
   - Deploy automatically on push

### Manual Deployment

```bash
pnpm build
pnpm start
```

## 🔧 Development

### Available Commands

```bash
# Setup and development
make first-time          # Complete first-time setup
make dev                # Start Next.js development server
make dev-db             # Start Supabase local development stack
make dev-stop           # Stop all development services

# Building and testing
make build              # Build for production
make lint               # Run ESLint
make format             # Format code with Prettier
make test               # Run tests

# Database operations
make db-migrate         # Run database migrations
make db-seed            # Seed database with sample data
make db-reset           # Reset database with fresh data
make db-studio          # Open Supabase Studio (database GUI)

# Package management
make install            # Install dependencies
make clean              # Clean node_modules and lock files
```

### Adding New Features

1. **Backend**: Add new tRPC routers in `src/server/api/routers/`
2. **Frontend**: Create new pages in `src/app/`
3. **Components**: Add reusable components in `src/components/`
4. **Types**: Update TypeScript types in `src/types/`
5. **Database**: Add migrations in `supabase/migrations/`

### Supabase Features

The platform leverages these Supabase features:

- **Database**: PostgreSQL with Row Level Security (RLS)
- **Auth**: Built-in authentication with multiple providers
- **Realtime**: WebSocket subscriptions for live updates
- **Storage**: File uploads and media management
- **Edge Functions**: Server-side logic (if needed)
- **Studio**: Visual database management

## 📝 API Routes

The platform provides several tRPC endpoints:

```typescript
// Match management
matches.getAll()           // Get all matches
matches.getById(id)        // Get specific match
matches.create(data)       // Create new match
matches.updateScore(data)  // Update match score

// Club management
clubs.getAll()            // Get all clubs
clubs.create(data)        // Create new club

// Tournament management
tournaments.getAll()       // Get all tournaments
tournaments.create(data)   // Create new tournament
```

All endpoints are fully type-safe with automatic TypeScript inference.

## 🐛 Troubleshooting

### Common Issues

1. **Supabase Not Starting**:
   - Make sure Docker is running
   - Run `make dev-stop` then `make dev-db`

2. **Environment Variables**:
   - For local development, no env vars needed
   - For production, ensure all Supabase keys are set

3. **Real-time Not Working**:
   - Check Supabase RLS policies
   - Verify WebSocket connections in browser dev tools

4. **Build Errors**:
   - Run `make lint` to check for TypeScript issues
   - Ensure all dependencies are installed with `make install`

5. **Database Issues**:
   - Reset database: `make db-reset`
   - Check migrations: `make db-migrate`
   - Open Supabase Studio: `make db-studio`

### Getting Help

1. Check the [Next.js docs](https://nextjs.org/docs)
2. Visit [Supabase docs](https://supabase.com/docs)
3. Review [tRPC documentation](https://trpc.io/docs)
4. Check [Supabase CLI documentation](https://supabase.com/docs/reference/cli)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `make test`
5. Run linting: `make lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [T3 Stack](https://create.t3.gg/) principles
- Powered by [Supabase](https://supabase.com) for backend services
- Inspired by modern cricket scoring needs
- Designed for professional broadcasting with OBS
- Real-time features enabled by Supabase Realtime

---


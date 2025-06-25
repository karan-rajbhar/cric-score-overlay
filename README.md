# 🏏 Cricket Platform - Modern Live Scoring & Management

A professional cricket management platform built with Next.js, tRPC, and Supabase. Perfect for live scoring, club management, and OBS streaming integration.

## ✨ Features

- **🔴 Live Scoring**: Real-time ball-by-ball scoring with instant updates
- **📺 OBS Integration**: Professional overlay for live streaming
- **🏆 Tournament Management**: Create and manage tournaments and clubs
- **📱 Mobile Ready**: Works seamlessly on mobile devices
- **⚡ Real-time Updates**: Powered by Supabase real-time subscriptions
- **🎯 Type-Safe**: End-to-end TypeScript with tRPC

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: tRPC, Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn
- A Supabase account

## 🛠️ Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cricket-platform
pnpm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your keys
3. Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
DATABASE_URL="your-database-url"
```

### 3. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🎯 Usage

### For Scorers

1. **Create a Match**: Go to `/matches/create` and set up teams
2. **Start Scoring**: Use the scoring interface to update scores in real-time
3. **Manage Players**: Add/edit player details and statistics
4. **Share**: Share the match URL with viewers

### For Streamers (OBS Integration)

1. **Get Overlay URL**: For any match, the overlay is available at `/overlay/[matchId]`
2. **Add to OBS**: 
   - Add a "Browser Source" in OBS
   - Set URL to `http://localhost:3000/overlay/your-match-id`
   - Set Width: 1920, Height: 1080
   - Check "Shutdown source when not visible"
3. **Customize**: Position and resize the overlay as needed
4. **Go Live**: The overlay will update in real-time as scores change

### Example Overlay URLs
- `http://localhost:3000/overlay/match_123` - Basic overlay
- `http://localhost:3000/overlay/match_123?theme=dark` - Dark theme
- `http://localhost:3000/overlay/match_123?minimal=true` - Minimal view

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Homepage
│   ├── overlay/           # OBS overlay pages
│   └── matches/           # Match management pages
├── components/            # Reusable UI components
├── lib/                   # Utilities and configurations
│   ├── supabase.ts       # Supabase client setup
│   └── db.ts             # Database utilities
├── server/               # tRPC backend
│   └── api/
│       └── routers/      # API route handlers
├── styles/              # Global CSS and Tailwind
├── types/               # TypeScript type definitions
└── trpc/                # tRPC client configuration
```

## 📊 Database Schema

The platform uses Supabase with the following main tables:

```sql
-- Users and authentication
users (id, email, name, role, created_at)

-- Clubs and organizations  
clubs (id, name, description, owner_id, created_at)

-- Tournaments
tournaments (id, name, club_id, format, start_date, end_date)

-- Matches
matches (id, title, team1_id, team2_id, status, created_at)

-- Real-time scoring data
match_scores (match_id, team_id, score, wickets, overs, updated_at)

-- Ball-by-ball data
ball_by_ball (id, match_id, over, ball, runs, wickets, updated_at)
```

## 🔄 Real-time Features

The platform uses Supabase Realtime for instant updates:

- **Live Scoring**: Scores update across all connected clients
- **Match Status**: Real-time match state changes
- **Player Statistics**: Live player performance updates
- **Overlay Updates**: OBS overlays update automatically

## 🎨 Customization

### Themes
- Default cricket theme (green/red)
- Dark mode support
- Custom color schemes

### Overlay Customization
- Multiple layout options
- Custom team colors
- Adjustable font sizes
- Show/hide specific elements

## 📱 Mobile Support

The platform is fully responsive and works great on:
- Mobile browsers for scoring
- Tablet devices for scorers
- Desktop for full management

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Manual Deployment

```bash
pnpm build
pnpm start
```

## 🔧 Development

### Available Scripts

```bash
pnpm dev             # Start development server
pnpm build           # Build for production
pnpm start           # Start production server
pnpm lint            # Run ESLint
pnpm db:push         # Push database schema
pnpm db:studio       # Open database studio
```

### Adding New Features

1. **Backend**: Add new tRPC routers in `src/server/api/routers/`
2. **Frontend**: Create new pages in `src/app/`
3. **Components**: Add reusable components in `src/components/`
4. **Types**: Update TypeScript types in `src/types/`

## 📝 API Routes

The platform provides several tRPC endpoints:

- `matches.getAll` - Get all matches
- `matches.getById` - Get specific match
- `matches.create` - Create new match
- `matches.updateScore` - Update match score
- `clubs.getAll` - Get all clubs
- `tournaments.getAll` - Get all tournaments

## 🐛 Troubleshooting

### Common Issues

1. **Environment Variables**: Make sure all required env vars are set
2. **Supabase Connection**: Check your Supabase URL and keys
3. **Real-time Not Working**: Verify Supabase RLS policies
4. **Build Errors**: Run `pnpm lint` to check for issues

### Getting Help

1. Check the [Next.js docs](https://nextjs.org/docs)
2. Visit [Supabase docs](https://supabase.com/docs)
3. Review [tRPC documentation](https://trpc.io/docs)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [T3 Stack](https://create.t3.gg/)
- Inspired by modern cricket scoring needs
- Designed for professional broadcasting

---

**Ready to revolutionize cricket scoring?** 🏏

Get started in minutes with our modern, real-time cricket platform! 
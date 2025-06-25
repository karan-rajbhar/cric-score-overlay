# 🚀 Quick Setup Guide

## Get up and running in 5 minutes!

### 1. Install Dependencies (Already Done!)
```bash
# ✅ Dependencies installed with pnpm
pnpm install
```

### 2. Set up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

**For quick testing, use these demo values:**

```env
# Demo Supabase project (for testing only)
NEXT_PUBLIC_SUPABASE_URL="https://demo.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="demo-key"
SUPABASE_SERVICE_ROLE_KEY="demo-service-key"

# Demo database
DATABASE_URL="postgresql://demo:demo@localhost:5432/cricket_demo"

# Next Auth (generate a secret)
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Start Development Server

```bash
pnpm dev
```

Visit: http://localhost:3000 🎉

### 4. Test the OBS Overlay

Visit: http://localhost:3000/overlay/demo-match

This shows a mock cricket match overlay that you can add to OBS as a Browser Source.

## 📺 OBS Setup Instructions

1. **Add Browser Source** in OBS
2. **URL**: `http://localhost:3000/overlay/demo-match`
3. **Width**: 1920
4. **Height**: 1080
5. **Check**: "Shutdown source when not visible"
6. **Uncheck**: "Control audio via OBS"

## 🏏 Quick Demo Data

The platform includes demo match data so you can see it working immediately:

- **Match**: Mumbai Indians vs Chennai Super Kings
- **Status**: Live match in progress
- **Scores**: Real-time updates (simulated)
- **Players**: Sample batting/bowling statistics

## 🗂️ Key Pages to Explore

- `/` - Homepage with live matches
- `/overlay/demo-match` - OBS overlay for streaming
- `/matches` - Match management (future)
- `/dashboard` - Scorer dashboard (future)

## 🔧 Development Tips

### File Structure
```
src/
├── app/                 # Next.js pages
├── components/          # React components
├── lib/                 # Utilities
├── server/             # tRPC backend
├── styles/             # CSS files
└── types/              # TypeScript types
```

### Adding New Features
1. **API**: Add tRPC routers in `src/server/api/routers/`
2. **Pages**: Create pages in `src/app/`
3. **Components**: Add to `src/components/`
4. **Types**: Update `src/types/cricket.ts`

### Real-time Updates
The platform uses Supabase Realtime for live updates. When you connect to a real Supabase project, scores will update automatically across all connected clients.

## 🎯 Next Steps

1. **Set up Supabase** (for real-time features)
2. **Create match forms** (for user input)
3. **Add authentication** (for user management)
4. **Build scoring interface** (for live updates)
5. **Deploy to Vercel** (for production use)

## 🐛 Common Issues

**Port already in use?**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
pnpm dev
```

**TypeScript errors?**
```bash
# Check for issues
pnpm lint
```

**Missing dependencies?**
```bash
# Reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 🎊 You're All Set!

Your modern cricket platform is ready to use. Start exploring the features and building your cricket management system!

**Need help?** Check the main README.md for detailed documentation. 
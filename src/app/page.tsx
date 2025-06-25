import Link from "next/link";
import { api } from "~/trpc/server";

export default async function HomePage() {
  // This will work once we have tRPC set up properly
  // const matches = await api.matches.getAll.query({ status: "live" });

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          Cricket Platform
        </h1>
        <p className="text-xl text-white/80 mb-8">
          Professional cricket match scoring and club management
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/matches/create"
            className="cricket-button text-lg px-8 py-3"
          >
            Start New Match
          </Link>
          <Link
            href="/dashboard"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Live matches section */}
      <div className="cricket-card">
        <h2 className="text-2xl font-bold text-white mb-6">🔴 Live Matches</h2>
        
        {/* Mock live match */}
        <div className="space-y-4">
          <div className="bg-white/5 rounded-lg p-4 border-l-4 border-cricket-ball">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Mumbai Indians vs Chennai Super Kings
                </h3>
                <p className="text-white/60">T20 • Wankhede Stadium</p>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">MI: 185/6 (20.0)</div>
                <div className="text-white font-bold">CSK: 165/8 (20.0)</div>
                <div className="text-cricket-ball text-sm">MI won by 20 runs</div>
              </div>
            </div>
          </div>

          <Link
            href="/matches"
            className="block text-center text-cricket-ball hover:text-cricket-ball/80 transition-colors"
          >
            View all matches →
          </Link>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="cricket-card">
          <div className="text-cricket-ball text-3xl mb-4">⚡</div>
          <h3 className="text-xl font-bold text-white mb-2">Live Scoring</h3>
          <p className="text-white/70">
            Real-time ball-by-ball scoring with instant updates for all viewers
          </p>
        </div>

        <div className="cricket-card">
          <div className="text-cricket-ball text-3xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-white mb-2">Tournament Management</h3>
          <p className="text-white/70">
            Organize tournaments, manage teams, and track statistics
          </p>
        </div>

        <div className="cricket-card">
          <div className="text-cricket-ball text-3xl mb-4">📺</div>
          <h3 className="text-xl font-bold text-white mb-2">OBS Integration</h3>
          <p className="text-white/70">
            Professional overlay for live streaming with customizable designs
          </p>
        </div>
      </div>

      {/* Quick start section */}
      <div className="cricket-card">
        <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">For Scorers</h3>
            <ol className="text-white/70 space-y-1">
              <li>1. Create a new match</li>
              <li>2. Set up teams and players</li>
              <li>3. Start live scoring</li>
              <li>4. Share with viewers</li>
            </ol>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">For Streamers</h3>
            <ol className="text-white/70 space-y-1">
              <li>1. Get the overlay URL</li>
              <li>2. Add browser source in OBS</li>
              <li>3. Position and customize</li>
              <li>4. Go live!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 
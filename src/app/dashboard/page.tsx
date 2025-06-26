"use client";

import { useAuth } from "~/lib/auth";
import Link from "next/link";

export default function DashboardPage() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cricket-ball mx-auto"></div>
          <p className="mt-2 text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="cricket-card">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}! 🏏
            </h1>
            <p className="text-white/70">
              Ready to manage your cricket matches and tournaments?
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/matches/create" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">⚡</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            Start New Match
          </h3>
          <p className="text-white/70">
            Create and start scoring a new cricket match
          </p>
        </Link>

        <Link href="/matches" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            View Matches
          </h3>
          <p className="text-white/70">
            Browse all your matches and their statistics
          </p>
        </Link>

        <Link href="/teams" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">👥</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            Manage Teams
          </h3>
          <p className="text-white/70">
            Create and manage your cricket teams
          </p>
        </Link>

        <Link href="/tournaments" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">🏆</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            Tournaments
          </h3>
          <p className="text-white/70">
            Organize and manage cricket tournaments
          </p>
        </Link>

        <Link href="/clubs" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">🏟️</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            Clubs
          </h3>
          <p className="text-white/70">
            Manage cricket clubs and their members
          </p>
        </Link>

        <Link href="/profile" className="cricket-card hover:bg-white/10 transition-colors group">
          <div className="text-cricket-ball text-3xl mb-4">⚙️</div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cricket-ball transition-colors">
            Profile Settings
          </h3>
          <p className="text-white/70">
            Update your profile and preferences
          </p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="cricket-card">
        <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
        <div className="space-y-4">
          <div className="text-center py-8 text-white/60">
            <div className="text-4xl mb-2">📈</div>
            <p>No recent activity yet</p>
            <p className="text-sm">Start creating matches to see your activity here</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="cricket-card">
        <h2 className="text-2xl font-bold text-white mb-4">Profile Information</h2>
        <div className="space-y-2 text-white/80">
          <p><span className="font-medium">Email:</span> {user.email}</p>
          <p><span className="font-medium">User ID:</span> {user.id}</p>
          <p><span className="font-medium">Account created:</span> {new Date(user.created_at).toLocaleDateString()}</p>
          {user.user_metadata?.full_name && (
            <p><span className="font-medium">Full Name:</span> {user.user_metadata.full_name}</p>
          )}
        </div>
      </div>
    </div>
  );
} 
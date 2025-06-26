"use client";

import { useAuth } from "~/lib/auth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "~/components/ProtectedRoute";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

            <div className="grid gap-6">
              <div className="bg-card text-card-foreground rounded-lg border p-6">
                <h2 className="text-xl font-semibold mb-4">Welcome back!</h2>
                <p className="text-muted-foreground mb-4">
                  You are signed in as: <span className="font-medium">{user?.email}</span>
                </p>
                <div className="space-y-2">
                  <p><strong>User ID:</strong> {user?.id}</p>
                  {user?.user_metadata?.full_name && (
                    <p><strong>Name:</strong> {user.user_metadata.full_name}</p>
                  )}
                  <p><strong>Last Sign In:</strong> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              <div className="bg-card text-card-foreground rounded-lg border p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <button
                    onClick={() => router.push('/overlay/test')}
                    className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <h3 className="font-medium">View Overlay</h3>
                    <p className="text-sm text-muted-foreground">Test the cricket score overlay</p>
                  </button>

                  <button
                    onClick={() => alert('Match management coming soon!')}
                    className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <h3 className="font-medium">Manage Matches</h3>
                    <p className="text-sm text-muted-foreground">Create and manage cricket matches</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 
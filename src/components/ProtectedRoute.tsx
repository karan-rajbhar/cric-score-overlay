"use client";

import { useAuth } from "~/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  loadingComponent?: React.ReactNode;
}

export default function ProtectedRoute({
  children,
  redirectTo = '/auth/login',
  loadingComponent
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if we're sure there's no user and not loading
    if (!loading && !user) {
      console.log('ProtectedRoute: No authenticated user, redirecting to', redirectTo);
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  // Show loading while auth is initializing
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Checking authentication status
          </div>
        </div>
      </div>
    );
  }

  // Show nothing if no user (will redirect)
  if (!user) {
    return null;
  }

  // Render children if user is authenticated
  return <>{children}</>;
} 
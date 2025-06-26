import { useAuth } from "~/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface UseProtectedRouteOptions {
  redirectTo?: string;
  onUnauthenticated?: () => void;
}

export function useProtectedRoute(options: UseProtectedRouteOptions = {}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { redirectTo = '/auth/login', onUnauthenticated } = options;

  useEffect(() => {
    // Only redirect if we're sure there's no user and not loading
    if (!loading && !user) {
      console.log('useProtectedRoute: No authenticated user, redirecting to', redirectTo);
      
      if (onUnauthenticated) {
        onUnauthenticated();
      } else {
        router.push(redirectTo);
      }
    }
  }, [user, loading, router, redirectTo, onUnauthenticated]);

  return {
    user,
    loading,
    isAuthenticated: !!user && !loading,
    isUnauthenticated: !user && !loading
  };
} 
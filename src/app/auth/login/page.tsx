"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";

function LoginPageInner() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive OAuth errors from URL params during render (no state/effect needed)
  const urlError = (() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return null;
    switch (errorParam) {
      case "oauth_error": {
        const messageParam = searchParams.get("message");
        return messageParam
          ? decodeURIComponent(messageParam)
          : "OAuth authentication failed. Please try again.";
      }
      case "session_error":
        return "Session creation failed. Please try again.";
      case "unexpected_error":
        return "An unexpected error occurred. Please try again.";
      default:
        return "Authentication failed. Please try again.";
    }
  })();
  const displayError = error ?? urlError;

  // Invite links carry the invited email so Google suggests that account.
  const inviteEmail = (() => {
    const value = searchParams.get("invite")?.trim().toLowerCase();
    return value?.includes("@") ? value : undefined;
  })();

  // Redirect authenticated users to destination or dashboard (side effects belong in effects,
  // never in render).
  useEffect(() => {
    if (user) {
      // Only same-site paths: invite links carry `next`, so never follow
      // an absolute or protocol-relative URL.
      const target =
        searchParams.get("redirect") ?? searchParams.get("next") ?? "";
      const redirect =
        target.startsWith("/") && !target.startsWith("//")
          ? target
          : "/dashboard";
      router.push(redirect);
      router.refresh();
    }
  }, [user, router, searchParams]);

  if (user) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    const { error } = await signInWithGoogle(inviteEmail);

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // Don't set loading to false here as the redirect will happen
  };

  return (
    <div className="flex min-h-[65vh] w-full items-center justify-center py-4 sm:py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">
            Sign in to CricScore
          </h1>
          <p className="text-sm text-muted-foreground">
            CricScore is invite-only. Anyone can follow matches from a shared
            link.
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="pb-4">
            <CardDescription className="text-center text-sm">
              {inviteEmail ? (
                <>
                  Sign in with Google using{" "}
                  <span className="font-semibold text-foreground">
                    {inviteEmail}
                  </span>
                </>
              ) : (
                "Use the Google account your invite was sent to"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Display */}
            {displayError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            {/* Google Sign In */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              variant="outline"
              className="h-11 w-full"
            >
              {googleLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                  Signing in with Google…
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="text-primary underline-offset-4 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="text-primary underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

"use client";

import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useState, useEffect } from "react";

export default function AuthDebugPage() {
  const { user, loading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [cookies, setCookies] = useState<string>('');

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      setSessionInfo({ data, error });
    };

    checkSession();
    setCookies(document.cookie);
  }, []);

  const refreshSession = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.refreshSession();
    console.log('Refresh result:', { data, error });
    setSessionInfo({ data, error });
  };

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Authentication Debug</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Auth Context State */}
          <Card>
            <CardHeader>
              <CardTitle>Auth Context State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <strong>Loading:</strong> <Badge variant={loading ? "destructive" : "secondary"}>{loading.toString()}</Badge>
              </div>
              <div>
                <strong>User:</strong> <Badge variant={user ? "default" : "outline"}>{user ? "Authenticated" : "Not authenticated"}</Badge>
              </div>
              {user && (
                <div className="space-y-2 mt-4">
                  <div><strong>Email:</strong> {user.email}</div>
                  <div><strong>ID:</strong> <code className="text-xs">{user.id}</code></div>
                  <div><strong>Provider:</strong> {user.app_metadata?.provider}</div>
                  <div><strong>Last Sign In:</strong> {user.last_sign_in_at}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Session Information
                <Button onClick={refreshSession} size="sm" variant="outline">
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionInfo ? (
                <div className="space-y-3">
                  <div>
                    <strong>Has Session:</strong> <Badge variant={sessionInfo.data?.session ? "default" : "outline"}>
                      {sessionInfo.data?.session ? "Yes" : "No"}
                    </Badge>
                  </div>
                  {sessionInfo.error && (
                    <div>
                      <strong>Error:</strong> 
                      <div className="text-red-500 text-sm mt-1">{sessionInfo.error.message}</div>
                    </div>
                  )}
                  {sessionInfo.data?.session && (
                    <div className="space-y-2">
                      <div><strong>Access Token:</strong> <code className="text-xs">...{sessionInfo.data.session.access_token.slice(-10)}</code></div>
                      <div><strong>Expires At:</strong> {new Date(sessionInfo.data.session.expires_at * 1000).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div>Loading session info...</div>
              )}
            </CardContent>
          </Card>

          {/* Browser Cookies */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Browser Cookies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded text-sm font-mono overflow-x-auto">
                {cookies || "No cookies found"}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Debug Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={() => window.location.href = '/auth/login'} variant="outline">
                Go to Login
              </Button>
              <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                Go to Dashboard
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
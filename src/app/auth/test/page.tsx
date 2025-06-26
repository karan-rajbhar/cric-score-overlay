"use client";

import { useAuth } from "~/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { User, Mail, Phone, LogOut, ExternalLink } from "lucide-react";

export default function AuthTestPage() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Authentication Test</h1>
        
        {user ? (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-cricket-primary" />
                Authenticated User
                <Badge className="bg-cricket-secondary/10 text-cricket-secondary">
                  Logged In
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <strong>User ID:</strong>
                  <code className="px-2 py-1 bg-muted rounded text-sm">{user.id}</code>
                </div>
                
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <strong>Email:</strong>
                    <span>{user.email}</span>
                    {user.email_confirmed_at && (
                      <Badge variant="outline" className="text-xs">Verified</Badge>
                    )}
                  </div>
                )}
                
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <strong>Phone:</strong>
                    <span>{user.phone}</span>
                    {user.phone_confirmed_at && (
                      <Badge variant="outline" className="text-xs">Verified</Badge>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <strong>Provider:</strong>
                  <Badge variant="outline">
                    {user.app_metadata?.provider || 'email'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <strong>Created:</strong>
                  <span className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <strong>Last Sign In:</strong>
                  <span className="text-sm text-muted-foreground">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t space-y-3">
                <Button 
                  onClick={() => signOut()} 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
                
                <Button asChild variant="default" className="flex items-center gap-2">
                  <a href="/dashboard">
                    <ExternalLink className="h-4 w-4" />
                    Go to Dashboard
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Not Authenticated
                <Badge variant="outline" className="text-muted-foreground">
                  Logged Out
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                You are not currently logged in. Please use one of the authentication methods to test.
              </p>
              
              <div className="space-y-2">
                <Button asChild className="w-full" variant="default">
                  <a href="/auth/login">
                    Go to Login
                  </a>
                </Button>
                
                <Button asChild className="w-full" variant="outline">
                  <a href="/auth/signup">
                    Go to Signup
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Environment Info */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Environment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <strong>Supabase URL:</strong>
              <code className="px-2 py-1 bg-muted rounded text-xs">
                {typeof window !== 'undefined' ? 
                  process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set' : 
                  'Server-side'
                }
              </code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <strong>Environment:</strong>
              <Badge variant="outline" className="text-xs">
                {process.env.NODE_ENV || 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
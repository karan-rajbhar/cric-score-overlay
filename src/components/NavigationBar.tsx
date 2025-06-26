"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { Activity, Trophy, Users, BarChart3 } from "lucide-react";

export function NavigationBar() {
  const { user, signOut, loading } = useAuth();

  return (
    <nav className="nav-glass sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link 
              href="/" 
              className="group flex items-center gap-3 text-xl font-bold text-foreground hover:text-cricket-primary transition-all duration-300"
            >
              <div className="relative">
                <div className="text-2xl group-hover:animate-bounce">🏏</div>
                <div className="absolute inset-0 bg-cricket-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <span className="bg-gradient-to-r from-cricket-primary to-cricket-secondary bg-clip-text text-transparent">
                Cricket Platform
              </span>
            </Link>
          </div>
          
          {!loading && (
            <div className="flex items-center space-x-6">
              {user ? (
                // Authenticated navigation
                <>
                  <div className="hidden md:flex items-center space-x-6">
                    <Link 
                      href="/dashboard" 
                      className="group flex items-center gap-2 text-muted-foreground hover:text-cricket-primary transition-all duration-300 font-medium px-3 py-2 rounded-lg hover:bg-cricket-primary/10"
                    >
                      <BarChart3 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Dashboard
                    </Link>
                    <Link 
                      href="/matches" 
                      className="group flex items-center gap-2 text-muted-foreground hover:text-cricket-accent transition-all duration-300 font-medium px-3 py-2 rounded-lg hover:bg-cricket-accent/10"
                    >
                      <Activity className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Matches
                    </Link>
                    <Link 
                      href="/clubs" 
                      className="group flex items-center gap-2 text-muted-foreground hover:text-cricket-secondary transition-all duration-300 font-medium px-3 py-2 rounded-lg hover:bg-cricket-secondary/10"
                    >
                      <Users className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      Clubs
                    </Link>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <ThemeToggle />
                    <Badge 
                      variant="secondary" 
                      className="bg-cricket-primary/10 text-cricket-primary border-cricket-primary/20 hover:bg-cricket-primary/20 transition-all duration-300 px-3 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-cricket-secondary rounded-full animate-pulse"></div>
                        {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                      </div>
                    </Badge>
                    <Button
                      onClick={() => signOut()}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 transition-all duration-300 rounded-lg"
                    >
                      Sign out
                    </Button>
                  </div>
                </>
              ) : (
                // Unauthenticated navigation
                <>
                  <ThemeToggle />
                  <div className="flex items-center space-x-3">
                    <Button 
                      asChild 
                      variant="ghost" 
                      className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-300 rounded-lg"
                    >
                      <Link href="/auth/login">
                        Sign in
                      </Link>
                    </Button>
                    <Button 
                      asChild 
                      className="btn-primary relative overflow-hidden group"
                    >
                      <Link href="/auth/signup" className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        Get Started
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Navigation Menu (optional - can be expanded later) */}
      {user && (
        <div className="md:hidden border-t border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="px-4 py-2 flex space-x-4 overflow-x-auto">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-cricket-primary transition-colors whitespace-nowrap"
            >
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </Link>
            <Link 
              href="/matches" 
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-cricket-accent transition-colors whitespace-nowrap"
            >
              <Activity className="h-3 w-3" />
              Matches
            </Link>
            <Link 
              href="/clubs" 
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-cricket-secondary transition-colors whitespace-nowrap"
            >
              <Users className="h-3 w-3" />
              Clubs
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
} 
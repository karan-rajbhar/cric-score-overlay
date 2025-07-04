"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { ScoreCard } from "~/components/ScoreCard";
import { Zap, Trophy, Tv, BarChart3, Shield, Clock } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();

  // Mock data for the scorecard demo
  const mockMatch = {
    id: "1",
    team1: "Mumbai Indians",
    team2: "Chennai Super Kings",
    status: "live" as const,
    team1Score: {
      runs: 185,
      wickets: 6,
      overs: 20.0
    },
    team2Score: {
      runs: 165,
      wickets: 8,
      overs: 20.0
    },
    currentBatsmen: {
      batsman1: { name: "MS Dhoni", runs: 45, balls: 32 },
      batsman2: { name: "Ravindra Jadeja", runs: 23, balls: 18 }
    },
    recentOvers: ["4 1 6 W 2 4", "1 1 4 2 1 6", "W 4 1 1 2 4"]
  };

  return (
    <div className="min-h-screen">
      {/* Modern Hero Section - 2025 Style */}
      <section className="relative py-24 md:py-32 hero-gradient">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center space-y-8">
            <div className="space-y-6">
              <div className="inline-block">
                <Badge className="bg-cricket-primary/10 text-cricket-primary border-cricket-primary/20 px-4 py-2 text-sm font-medium">
                  ✨ Modern Cricket Platform 2025
                </Badge>
              </div>
              <h1 className="hero-title animate-float">
                Cricket Platform
              </h1>
              <p className="hero-subtitle">
                Professional cricket match scoring and club management platform
                with real-time updates, modern UI, and seamless OBS integration
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <>
                  <Button asChild size="lg" className="btn-primary text-lg group">
                    <Link href="/matches/create" className="flex items-center gap-3">
                      <Zap className="h-5 w-5 group-hover:animate-pulse" />
                      Start New Match
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="btn-secondary">
                    <Link href="/dashboard" className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5" />
                      Dashboard
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="btn-primary text-lg group">
                    <Link href="/auth/signup" className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 group-hover:animate-bounce" />
                      Get Started Free
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="btn-secondary">
                    <Link href="/auth/login" className="flex items-center gap-3">
                      <Shield className="h-5 w-5" />
                      Sign In
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-20 space-y-24">
        {/* Live Match Demo */}
        <section className="space-y-12">
          <div className="text-center space-y-6">
            <Badge className="bg-cricket-accent/10 text-cricket-accent border-cricket-accent/20 px-4 py-2">
              🔴 Live Experience
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-cricket-primary to-foreground bg-clip-text text-transparent">
              Real-Time Cricket Scoring
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Experience how our platform brings cricket matches to life with instant updates,
              professional scoring, and beautiful visualizations
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <ScoreCard match={mockMatch} />
          </div>
        </section>

        {/* Features Grid - Modern 2025 Design */}
        <section className="space-y-12">
          <div className="text-center space-y-6">
            <Badge className="bg-cricket-secondary/10 text-cricket-secondary border-cricket-secondary/20 px-4 py-2">
              🏆 Platform Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-cricket-secondary to-foreground bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Complete cricket management solution with modern design and powerful features
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="feature-card group">
              <CardContent className="p-8 text-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto bg-cricket-accent/10 rounded-2xl flex items-center justify-center group-hover:bg-cricket-accent/20 transition-colors">
                    <Zap className="h-8 w-8 text-cricket-accent animate-float" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-foreground">Live Scoring</CardTitle>
                <p className="text-muted-foreground leading-relaxed">
                  Real-time ball-by-ball scoring with instant updates. Professional scorecards 
                  that sync automatically across all devices and platforms.
                </p>
              </CardContent>
            </Card>

            <Card className="feature-card group">
              <CardContent className="p-8 text-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto bg-cricket-secondary/10 rounded-2xl flex items-center justify-center group-hover:bg-cricket-secondary/20 transition-colors">
                    <Trophy className="h-8 w-8 text-cricket-secondary animate-float" style={{ animationDelay: '1s' }} />
                  </div>
                </div>
                <CardTitle className="text-2xl text-foreground">Tournament Management</CardTitle>
                <p className="text-muted-foreground leading-relaxed">
                  Organize tournaments, manage teams, track detailed statistics, and create 
                  beautiful leaderboards for your cricket competitions.
                </p>
              </CardContent>
            </Card>

            <Card className="feature-card group">
              <CardContent className="p-8 text-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto bg-cricket-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-cricket-primary/20 transition-colors">
                    <Tv className="h-8 w-8 text-cricket-primary animate-float" style={{ animationDelay: '2s' }} />
                  </div>
                </div>
                <CardTitle className="text-2xl text-foreground">OBS Integration</CardTitle>
                <p className="text-muted-foreground leading-relaxed">
                  Professional overlay system for live streaming with customizable designs. 
                  Perfect for broadcasting matches online with style.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Stats Section - Modern Cards */}
        <section className="glass-card p-12">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground mb-4">Platform Statistics</h3>
            <p className="text-muted-foreground">Trusted by cricket communities worldwide</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div className="space-y-3">
              <div className="text-4xl font-bold text-cricket-secondary">1,000+</div>
              <div className="text-muted-foreground font-medium">Matches Scored</div>
            </div>
            <div className="space-y-3">
              <div className="text-4xl font-bold text-cricket-accent">50+</div>
              <div className="text-muted-foreground font-medium">Active Tournaments</div>
            </div>
            <div className="space-y-3">
              <div className="text-4xl font-bold text-cricket-primary">10,000+</div>
              <div className="text-muted-foreground font-medium">Registered Players</div>
            </div>
            <div className="space-y-3">
              <div className="text-4xl font-bold text-cricket-secondary">24/7</div>
              <div className="text-muted-foreground font-medium">Live Support</div>
            </div>
          </div>
        </section>

        {/* Quick Start Guide - Modern Layout */}
        <section className="space-y-12">
          <div className="text-center space-y-6">
            <Badge className="bg-cricket-primary/10 text-cricket-primary border-cricket-primary/20 px-4 py-2">
              🚀 Quick Start
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-cricket-primary to-foreground bg-clip-text text-transparent">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Simple setup process that gets you scoring matches instantly
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="glass-card group">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-cricket-primary" />
                  For Scorers
                  <Badge className="bg-cricket-secondary/10 text-cricket-secondary border-cricket-secondary/20 ml-auto">
                    Easy Setup
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {[
                    "Create a new match with team details",
                    "Set up players and batting order",
                    "Start live scoring with intuitive interface", 
                    "Share scoreboard link with viewers"
                  ].map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cricket-primary/20 text-cricket-primary flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card group">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground flex items-center gap-3">
                  <Tv className="h-6 w-6 text-cricket-accent" />
                  For Streamers
                  <Badge className="bg-cricket-accent/10 text-cricket-accent border-cricket-accent/20 ml-auto">
                    Pro Features
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {[
                    "Generate custom OBS overlay URL",
                    "Configure design and branding",
                    "Add overlay to your streaming setup",
                    "Go live with professional graphics"
                  ].map((step, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-cricket-accent/20 text-cricket-accent flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
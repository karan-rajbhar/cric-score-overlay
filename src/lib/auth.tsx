"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "~/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithPhone: (phone: string) => Promise<{ error: any }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signUpWithPhone: (phone: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Enhanced session initialization with retry logic for OAuth flows
    const initializeAuth = async () => {
      try {
        console.log('Auth context: Initializing authentication...');

        // Check if we're potentially coming from an OAuth redirect
        const isFromOAuth = typeof window !== 'undefined' &&
          (window.location.pathname === '/dashboard' || window.location.search.includes('code='));

        let session = null;
        let retryCount = 0;
        const maxRetries = isFromOAuth ? 3 : 1;

        // Retry logic for OAuth flows where session might not be immediately available
        while (!session && retryCount < maxRetries) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            console.error('Auth context: Error getting session:', error);
            break;
          }

          session = data.session;

          if (!session && retryCount < maxRetries - 1) {
            console.log(`Auth context: No session found, retry ${retryCount + 1}/${maxRetries} in 500ms...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          retryCount++;
        }

        console.log('Auth context: Session result:', session?.user?.email || 'no session');
        setUser(session?.user ?? null);
        setLoading(false);

      } catch (error) {
        console.error('Auth context: Error during initialization:', error);
        setUser(null);
        setLoading(false);
      }
    };

    // Initialize authentication
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email || 'no session');
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle different auth events
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        console.log('User signed in, creating profile if needed:', user.email);

        // Create profile on sign in (only if not done by server callback)
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .single();

          if (!profile) {
            console.log('Creating profile for user:', user.email);
            await supabase.from("profiles").insert({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              phone: user.phone || null,
            });
          } else {
            console.log('Profile already exists for user:', user.email);
          }
        } catch (error) {
          console.error('Error handling profile:', error);
        }

        console.log('Auth context: User authenticated, ready for navigation');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing state');
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const supabase = createClient();

    // Get the current origin, fallback to localhost for development
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3001';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const signInWithPhone = async (phone: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    return { error };
  };

  const verifyOTP = async (phone: string, token: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signUpWithPhone = async (phone: string, password: string, fullName?: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      phone,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('Starting sign out process...');
      setLoading(true);

      const supabase = createClient();

      // First, clear the local state immediately
      setUser(null);

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Supabase sign out error:', error);
        // Don't throw error, still proceed with clearing local state
      }

      console.log('Sign out completed, redirecting to home');

      // Force redirect after a short delay
      setTimeout(() => {
        // Use window.location for more reliable redirect
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        } else {
          router.push('/');
        }
      }, 100);

    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear the local state and redirect
      setUser(null);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        } else {
          router.push('/');
        }
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        signInWithPhone,
        verifyOTP,
        signUp,
        signUpWithPhone,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 
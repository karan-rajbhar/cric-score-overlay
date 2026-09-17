"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "~/lib/supabase";
import type { AuthError } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyOTP: (
    phone: string,
    token: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error: AuthError | null }>;
  signUpWithPhone: (
    phone: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(
    () =>
      typeof window === "undefined" ||
      !window.location.pathname.startsWith("/overlay"),
  );
  const router = useRouter();

  useEffect(() => {
    // If running inside OBS overlay browser source, skip client-side auth initialization
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/overlay")
    ) {
      return;
    }

    const supabase = createClient();

    // Simple, reliable session initialization
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth initialization error:", error);
          setUser(null);
        } else {
          setUser(session?.user ?? null);
          console.log("Auth initialized:", session?.user?.email || "no user");
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Initialize authentication
    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(
        "Auth state changed:",
        event,
        session?.user?.email || "no session",
      );

      // Update user state
      setUser(session?.user ?? null);
      setLoading(false);

      // Non-blocking deferred profile sync on actual sign in
      if (event === "SIGNED_IN" && session?.user) {
        setTimeout(() => {
          void supabase.rpc("ensure_own_profile");
        }, 0);
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
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3001";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
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
      type: "sms",
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (!error && data?.session?.user) {
      void supabase.rpc("ensure_own_profile");
    }
    return { error };
  };

  const signUpWithPhone = async (
    phone: string,
    password: string,
    fullName?: string,
  ) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      phone,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (!error && data?.session?.user) {
      void supabase.rpc("ensure_own_profile");
    }
    return { error };
  };

  const signOut = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
    }

    // Clear local state and redirect
    setUser(null);
    router.push("/");
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

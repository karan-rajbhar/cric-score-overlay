"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getFirebaseAuth, toAppUser } from "~/lib/firebase/client";
import {
  toAuthError,
  type AppUser,
  type AuthError,
} from "~/lib/firebase/auth-types";

type Result = Promise<{ error: AuthError | null }>;

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Result;
  signInWithGoogle: () => Result;
  signUp: (email: string, password: string, fullName?: string) => Result;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Result;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Readable twin of the HTTP-only session cookie, set by the session route,
 * so the browser can tell whether the server still believes it is signed in.
 */
const SESSION_HINT_COOKIE = "cric_session_hint";

function hasServerSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`));
}

/** Sends the ID token to the server so it can issue the session cookie. */
async function syncServerSession(user: FirebaseUser | null): Promise<void> {
  if (!user) {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(
      () => undefined,
    );
    return;
  }
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not establish a server session");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isOverlay =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/overlay");
  const [user, setUser] = useState<AppUser | null>(null);
  // The OBS overlay runs unauthenticated; skip auth bootstrapping there.
  const [loading, setLoading] = useState(!isOverlay);
  const router = useRouter();
  const syncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOverlay) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          if (syncedUidRef.current !== firebaseUser.uid) {
            await syncServerSession(firebaseUser);
            syncedUidRef.current = firebaseUser.uid;
          }
          setUser(toAppUser(firebaseUser));
        } else {
          // The browser is signed out but the server may still hold a session
          // cookie (expired token, account recreated, emulator restart).
          // Clear it so server-rendered pages and the route guard agree.
          if (syncedUidRef.current || hasServerSessionHint()) {
            await syncServerSession(null);
            syncedUidRef.current = null;
            router.refresh();
          }
          setUser(null);
        }
      } catch (err) {
        console.error("Auth session sync failed:", err);
        setUser(firebaseUser ? toAppUser(firebaseUser) : null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isOverlay, router]);

  const finishSignIn = useCallback(async (firebaseUser: FirebaseUser) => {
    await syncServerSession(firebaseUser);
    syncedUidRef.current = firebaseUser.uid;
    setUser(toAppUser(firebaseUser));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Result => {
      try {
        const cred = await signInWithEmailAndPassword(
          getFirebaseAuth(),
          email.trim(),
          password,
        );
        await finishSignIn(cred.user);
        return { error: null };
      } catch (err) {
        return { error: toAuthError(err) };
      }
    },
    [finishSignIn],
  );

  const signInWithGoogle = useCallback(async (): Result => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(getFirebaseAuth(), provider);
      await finishSignIn(cred.user);
      return { error: null };
    } catch (err) {
      return { error: toAuthError(err) };
    }
  }, [finishSignIn]);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string): Result => {
      try {
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          email.trim(),
          password,
        );
        if (fullName?.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
          await cred.user.reload();
        }
        await finishSignIn(getFirebaseAuth().currentUser ?? cred.user);
        return { error: null };
      } catch (err) {
        return { error: toAuthError(err) };
      }
    },
    [finishSignIn],
  );

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch (err) {
      console.error("Sign out error:", err);
    }
    await syncServerSession(null);
    syncedUidRef.current = null;
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const resetPassword = useCallback(async (email: string): Result => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim(), {
        url: `${window.location.origin}/auth/login`,
      });
      return { error: null };
    } catch (err) {
      return { error: toAuthError(err) };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        signUp,
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

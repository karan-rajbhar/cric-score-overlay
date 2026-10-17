"use client";

import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
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
  /** `loginHint` makes Google suggest that account first. */
  signInWithGoogle: (loginHint?: string) => Result;
  signOut: () => Promise<void>;
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

const INVITE_ONLY_CODE = "app/invite-only";

/**
 * Sends the ID token to the server so it can issue the session cookie. The
 * server refuses accounts without an invite; those are signed out here too.
 */
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
  if (res.status === 403) {
    await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
    throw Object.assign(new Error("CricScore is invite-only"), {
      code: INVITE_ONLY_CODE,
    });
  }
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
        const invited = toAuthError(err).code !== INVITE_ONLY_CODE;
        setUser(firebaseUser && invited ? toAppUser(firebaseUser) : null);
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

  const signInWithGoogle = useCallback(
    async (loginHint?: string): Result => {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: "select_account",
          ...(loginHint ? { login_hint: loginHint } : {}),
        });
        const cred = await signInWithPopup(getFirebaseAuth(), provider);
        await finishSignIn(cred.user);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut,
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

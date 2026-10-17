"use client";

import {
  getRedirectResult,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
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
  /** Why a redirect sign-in failed after returning to the app, if it did. */
  redirectError: AuthError | null;
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
 * Popup failures where a full-page redirect still works (popup blockers,
 * in-app browsers and other environments without popups). A user closing
 * the popup is a cancel, not one of these.
 */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

export function shouldFallbackToRedirect(err: unknown): boolean {
  const code = toAuthError(err).code;
  return code !== undefined && REDIRECT_FALLBACK_CODES.has(code);
}

/** Marks a pending redirect sign-in so only the return trip asks for it. */
const REDIRECT_PENDING_KEY = "cric_google_redirect";

function markRedirectPending(): void {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
  } catch {
    // Storage blocked: the redirect result is then picked up by onIdTokenChanged.
  }
}

function takeRedirectPending(): boolean {
  try {
    const pending = sessionStorage.getItem(REDIRECT_PENDING_KEY) !== null;
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function createGoogleProvider(loginHint?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return provider;
}

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
  const [redirectError, setRedirectError] = useState<AuthError | null>(null);
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

  // Back from a redirect sign-in: create the session cookie the same way the
  // popup path does, and keep the error (e.g. invite-only) for the login page.
  useEffect(() => {
    if (isOverlay || !takeRedirectPending()) return;
    getRedirectResult(getFirebaseAuth())
      .then(async (result) => {
        if (result) await finishSignIn(result.user);
      })
      .catch((err: unknown) => {
        console.error("Google redirect sign-in failed:", err);
        setRedirectError(toAuthError(err));
      });
  }, [isOverlay, finishSignIn]);

  const signInWithGoogle = useCallback(
    async (loginHint?: string): Result => {
      setRedirectError(null);
      const auth = getFirebaseAuth();
      const provider = createGoogleProvider(loginHint);
      try {
        const cred = await signInWithPopup(auth, provider);
        await finishSignIn(cred.user);
        return { error: null };
      } catch (err) {
        if (!shouldFallbackToRedirect(err)) return { error: toAuthError(err) };
      }
      // The browser refused the popup: continue in this tab instead. The page
      // navigates away; the result is handled when the app loads again.
      try {
        markRedirectPending();
        await signInWithRedirect(auth, provider);
        return { error: null };
      } catch (err) {
        takeRedirectPending();
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
        redirectError,
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

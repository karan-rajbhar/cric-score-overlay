/**
 * Auth shapes shared by the browser auth context and the server session.
 *
 * `AppUser` keeps the fields the UI already reads (`id`, `email`, `phone`,
 * `user_metadata.full_name`, ...) so components did not have to change
 * when the identity provider moved to Firebase Auth.
 */

export interface AppUserMetadata {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  username?: string;
  [key: string]: unknown;
}

export interface AppUser {
  id: string;
  email: string | null;
  phone: string | null;
  user_metadata: AppUserMetadata;
  /** Identity provider id, e.g. `password`, `google.com`, `phone`. */
  provider?: string | null;
}

export interface AuthError {
  message: string;
  code?: string;
}

/** Normalises Firebase error codes into readable messages. */
export function toAuthError(err: unknown): AuthError {
  const code =
    typeof err === "object" &&
    err &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  const fallback =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Authentication failed";
  const friendly: Record<string, string> = {
    "app/invite-only":
      "CricScore is invite-only. Ask someone who uses it to invite your Google email.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-login-credentials": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters long.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user":
      "The sign-in window was closed before completing sign in.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/popup-blocked":
      "Your browser blocked the sign-in popup. Allow popups and try again.",
    "auth/invalid-phone-number":
      "Please enter a valid phone number in international format.",
    "auth/invalid-verification-code": "That verification code is not valid.",
    "auth/code-expired":
      "The verification code has expired. Request a new one.",
    "auth/missing-verification-code":
      "Enter the verification code you received.",
    "auth/network-request-failed":
      "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled.",
  };
  return { message: (code && friendly[code]) || fallback, code };
}
